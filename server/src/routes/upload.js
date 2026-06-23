import { Router } from "express";
import { authMiddleware, requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { log } from "../lib/logger.js";
import { uploadMediaBuffer, mediaStorageLabel } from "../lib/mediaUpload.js";

export const uploadRouter = Router();
uploadRouter.use(authMiddleware);

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
    const url = await uploadMediaBuffer(buf, { mime, isVideo });
    const kb = Math.round(buf.length / 1024);
    const storage = mediaStorageLabel();
    log.upload(isVideo ? "Video uploaded" : "Image uploaded", `${url} · ${kb} KB · ${mime} · ${storage}`);
    res.json({ url, storage });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Upload failed" });
  }
});
