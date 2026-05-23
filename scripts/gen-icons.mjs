/**
 * gen-icons.mjs
 * Converte resources/icon.svg e resources/splash.svg in PNG,
 * poi lancia @capacitor/assets per generare tutti i formati nativi.
 *
 * Uso: node scripts/gen-icons.mjs
 * (richiede: npm install -D @capacitor/assets)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// ── Verifica dipendenze ────────────────────────────────────────────────────────
let sharp;
try {
  ({ default: sharp } = await import("sharp"));
} catch {
  console.error("❌  sharp non trovato. Installa @capacitor/assets:\n   npm install -D @capacitor/assets");
  process.exit(1);
}

// ── Helper ─────────────────────────────────────────────────────────────────────
function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

async function svgToPng(svgPath, pngPath, size) {
  const svg = readFileSync(svgPath);
  await sharp(svg)
    .resize(size, size, { fit: "contain", background: { r: 15, g: 23, b: 42, alpha: 1 } })
    .png()
    .toFile(pngPath);
  console.log(`✓  ${pngPath} (${size}×${size})`);
}

// ── Genera PNG sorgente ────────────────────────────────────────────────────────
const resDir = join(root, "resources");
ensureDir(resDir);

const iconSvg   = join(resDir, "icon.svg");
const iconPng   = join(resDir, "icon.png");
const splashSvg = join(resDir, "splash.svg");
const splashPng = join(resDir, "splash.png");

if (!existsSync(iconSvg)) {
  console.error("❌  resources/icon.svg non trovato.");
  process.exit(1);
}

console.log("\n📐  Conversione SVG → PNG...\n");
await svgToPng(iconSvg,   iconPng,   1024);

if (existsSync(splashSvg)) {
  await svgToPng(splashSvg, splashPng, 2732);
}

// ── Lancia @capacitor/assets ──────────────────────────────────────────────────
console.log("\n📦  Generazione icone native con @capacitor/assets...\n");
try {
  execSync("npx capacitor-assets generate --iconBackgroundColor #0f172a --splashBackgroundColor #0f172a", {
    cwd: root,
    stdio: "inherit",
  });
  console.log("\n✅  Icone generate! Ora lancia: npm run cap:sync\n");
} catch (e) {
  console.error("❌  capacitor-assets generate fallito:", e.message);
  process.exit(1);
}
