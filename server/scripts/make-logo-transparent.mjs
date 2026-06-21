import sharp from "sharp";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "..");
const INPUT = path.join(ROOT, "ar-store-logo-original.png");
const OUT_TMP = path.join(ROOT, "ar-store-logo-transparent.png");
const OUT_LOGO = path.join(ROOT, "ar-store-logo.png");
const ICON_192 = path.join(ROOT, "icons", "icon-192.png");
const ICON_512 = path.join(ROOT, "icons", "icon-512.png");

function isBackground(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const sat = max === 0 ? 0 : (max - min) / max;

  if (lum < 52) return 1;
  if (lum < 128 && sat < 0.28) return 1;
  if (lum < 155 && sat < 0.2) return Math.min(1, (155 - lum) / 28);
  return 0;
}

async function removeBackground(inputPath) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const bg = isBackground(r, g, b);
    if (bg >= 1) {
      data[i + 3] = 0;
    } else if (bg > 0) {
      data[i + 3] = Math.round(data[i + 3] * (1 - bg));
    }
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 }
  })
    .trim({ threshold: 10 })
    .png();
}

const pipeline = await removeBackground(INPUT);
const pngBuffer = await pipeline.png().toBuffer();
fs.writeFileSync(OUT_LOGO, pngBuffer);
await sharp(pngBuffer).resize(192, 192, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toFile(ICON_192);
await sharp(pngBuffer).resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toFile(ICON_512);

console.log("Logo saved:", OUT_LOGO);
