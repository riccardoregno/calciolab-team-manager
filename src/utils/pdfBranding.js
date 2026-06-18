/**
 * Shared PDF branding utilities.
 * Provides consistent header (team logo + name) and footer (CalcioLab logo) across all PDFs.
 */

const CALCIOLAB_LOGO_URL = "/calciolab-logo.svg";

export async function loadImageBase64(url) {
  if (!url) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || 300;
        canvas.height = img.naturalHeight || 300;
        canvas.getContext("2d").drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export async function loadBrandingAssets(teamLogoUrl) {
  const [calciolabLogo, teamLogo] = await Promise.all([
    loadImageBase64(CALCIOLAB_LOGO_URL),
    teamLogoUrl ? loadImageBase64(teamLogoUrl) : Promise.resolve(null),
  ]);
  return { calciolabLogo, teamLogo };
}

const CA = [37, 99, 235];   // accent blue
const CW = [255, 255, 255]; // white
const CM = [100, 116, 139]; // muted

/**
 * Draws the branded page header.
 * Returns the Y position where body content should start.
 */
export function drawBrandedHeader(doc, { teamName, subtitle, dateStr, teamLogo }) {
  const W = doc.internal.pageSize.getWidth();
  const H = 26;

  doc.setFillColor(...CA);
  doc.rect(0, 0, W, H, "F");

  // Team logo top-right
  if (teamLogo) {
    try { doc.addImage(teamLogo, "PNG", W - 28, 3, 20, 20); } catch { /* skip */ }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...CW);
  doc.text(teamName || "Squadra", 14, 12);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.text(subtitle || "", 14, 20);
  if (dateStr) doc.text(dateStr, teamLogo ? W - 32 : W - 14, 20, { align: "right" });

  return H + 8;
}

/**
 * Draws the branded footer on every page of the document.
 * Call this AFTER all content has been added.
 */
export function drawBrandedFooters(doc, { teamName, dateStr, calciolabLogo }) {
  const pages = doc.internal.getNumberOfPages();
  const W = doc.internal.pageSize.getWidth();

  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);

    // Separator line
    doc.setDrawColor(...CM);
    doc.setLineWidth(0.3);
    doc.line(14, 287, W - 14, 287);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...CM);
    doc.text(`${teamName || ""} · ${dateStr || ""}`, 14, 292);
    doc.text(`${i} / ${pages}`, W / 2, 292, { align: "center" });

    // CalcioLab logo bottom-right
    if (calciolabLogo) {
      try {
        doc.addImage(calciolabLogo, "PNG", W - 22, 287, 8, 6);
      } catch { /* skip */ }
    }
    doc.setTextColor(...CM);
    doc.setFontSize(6.5);
    doc.text("calciolab.org", W - 14, 292, { align: "right" });
  }
}
