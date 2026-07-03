import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

export const ATTACHMENTS_BUCKET = "team-attachments";

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

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${teamId}/${folder}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .getPublicUrl(path);

  return {
    name: file.name,
    type: file.type,
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
