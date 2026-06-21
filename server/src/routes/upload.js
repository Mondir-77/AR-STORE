import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { authMiddleware, requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { log } from "../lib/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, "..", "..", "uploads");

export const uploadRouter = Router();
uploadRouter.use(authMiddleware);

async function ensureUploadsDir() {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
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

uploadRouter.post("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const dataUrl = String(req.body?.dataUrl || "");
    const imageMatch = dataUrl.match(/^data:(image\/[\w+.-]+);base64,(.+)$/);
    const videoMatch = dataUrl.match(/^data:(video\/[\w+.-]+);base64,(.+)$/);
    const match = imageMatch || videoMatch;
    if (!match) return res.status(400).json({ error: "Invalid image or video data" });
    const mime = match[1];
    const buf = Buffer.from(match[2], "base64");
    const isVideo = mime.startsWith("video/");
    const maxBytes = isVideo ? 50 * 1024 * 1024 : 8 * 1024 * 1024;
    if (buf.length > maxBytes) {
      return res.status(400).json({ error: isVideo ? "Video too large (max 50MB)" : "Image too large (max 8MB)" });
    }
    await ensureUploadsDir();
    const prefix = isVideo ? "vid_" : "img_";
    const name = `${prefix}${Date.now()}_${Math.random().toString(16).slice(2, 8)}${extFromMime(mime)}`;
    await fs.writeFile(path.join(UPLOADS_DIR, name), buf);
    const url = `/uploads/${name}`;
    const kb = Math.round(buf.length / 1024);
    log.upload(isVideo ? "Video uploaded" : "Image uploaded", `${url} · ${kb} KB · ${mime}`);
    res.json({ url });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Upload failed" });
  }
});
