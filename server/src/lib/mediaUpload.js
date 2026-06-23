import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, "..", "..", "uploads");

let cloudinaryClient = null;

export function isCloudinaryConfigured() {
  if (String(process.env.CLOUDINARY_URL || "").trim()) return true;
  const name = String(process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  const key = String(process.env.CLOUDINARY_API_KEY || "").trim();
  const secret = String(process.env.CLOUDINARY_API_SECRET || "").trim();
  return Boolean(name && key && secret);
}

async function getCloudinary() {
  if (!isCloudinaryConfigured()) return null;
  if (cloudinaryClient) return cloudinaryClient;
  const { v2 } = await import("cloudinary");
  if (String(process.env.CLOUDINARY_URL || "").trim()) {
    v2.config({ secure: true });
  } else {
    v2.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true
    });
  }
  cloudinaryClient = v2;
  return cloudinaryClient;
}

function extFromMime(mime) {
  const map = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/quicktime": ".mov"
  };
  return map[mime] || (mime.startsWith("video/") ? ".mp4" : ".jpg");
}

async function uploadLocal(buf, { mime, isVideo }) {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  const prefix = isVideo ? "vid_" : "img_";
  const name = `${prefix}${Date.now()}_${Math.random().toString(16).slice(2, 8)}${extFromMime(mime)}`;
  await fs.writeFile(path.join(UPLOADS_DIR, name), buf);
  return `/uploads/${name}`;
}

export async function uploadMediaBuffer(buf, { mime, isVideo }) {
  const cld = await getCloudinary();
  if (cld) {
    const resourceType = isVideo ? "video" : "image";
    return new Promise((resolve, reject) => {
      const stream = cld.uploader.upload_stream(
        { folder: "ar-store", resource_type: resourceType },
        (err, result) => {
          if (err) return reject(err);
          if (!result?.secure_url) return reject(new Error("Cloudinary upload returned no URL"));
          resolve(result.secure_url);
        }
      );
      stream.end(buf);
    });
  }
  return uploadLocal(buf, { mime, isVideo });
}

export function mediaStorageLabel() {
  return isCloudinaryConfigured() ? "cloudinary" : "local";
}
