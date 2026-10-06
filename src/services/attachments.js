import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

export const ATTACHMENTS_BUCKET = "team-attachments";
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const ATTACHMENT_TYPES = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** @param {{ teamId: string, folder: string, file: File }} params
 * @returns {Promise<{data: any[], error: any}>} */
export async function uploadTeamAttachment({ teamId, folder, file }) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase non configurato");
  }
  if (!teamId) {
    throw new Error("teamId mancante");
  }
  if (!file) {
    throw new Error("File mancante");
  }

  if (file.size > MAX_ATTACHMENT_SIZE) {
    throw new Error("La distinta supera il limite di 10 MB.");
  }
  const extension = file.name.split(".").pop().toLowerCase();
  const contentType = !file.type || file.type === "application/octet-stream"
    ? ATTACHMENT_TYPES[extension]
    : file.type;
  if (!Object.values(ATTACHMENT_TYPES).includes(contentType)) {
    throw new Error("Formato non supportato. Usa un PDF oppure un'immagine JPG, PNG o WebP.");
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${teamId}/${folder}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType,
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .getPublicUrl(path);

  return {
    name: file.name,
    type: contentType,
    size: file.size,
    bucket: ATTACHMENTS_BUCKET,
    path,
    url: data.publicUrl,
    uploadedAt: new Date().toISOString(),
  };
}

/** @param {any} attachment
 * @returns {Promise<{data: any[], error: any}>} */
export async function deleteTeamAttachment(attachment) {
  if (!isSupabaseConfigured || !supabase || !attachment?.path) return;

  const { error } = await supabase.storage
    .from(attachment.bucket || ATTACHMENTS_BUCKET)
    .remove([attachment.path]);

  if (error && import.meta.env.DEV) {
    console.warn("[attachments] deleteTeamAttachment fallita:", error.message);
  }
}
