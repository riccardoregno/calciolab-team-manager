// All avatar sizes, including the formation printout, use the same crop.
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
export function getPlayerPhotoSettings(player = {}) {
  return { size: Math.min(180, Math.max(60, finite(player.photoSize ?? 100, 100))),
    x: Math.min(50, Math.max(-50, finite(player.photoOffsetX ?? 0, 0))),
    y: Math.min(50, Math.max(-50, finite(player.photoOffsetY ?? 0, 0))) };
}
export function getPlayerPhotoTransform(player = {}) {
  const { size, x, y } = getPlayerPhotoSettings(player);
  return `scale(${size / 100}) translate(${x}%, ${y}%)`;
}
export function getPlayerPhotoStyle(player = {}) {
  return { width: "100%", height: "100%", maxWidth: "none", display: "block", flexShrink: 0,
    objectFit: "cover", objectPosition: "center", transformOrigin: "center", transform: getPlayerPhotoTransform(player) };
}
