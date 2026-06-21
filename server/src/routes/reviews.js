import { Router } from "express";
import rateLimit from "express-rate-limit";
import { prisma } from "../lib/prisma.js";
import { broadcastSettingsUpdate } from "../lib/broadcast.js";

export const reviewsRouter = Router();

const reviewLimiter = rateLimit({ windowMs: 60_000, max: 20 });

async function getReviewsMap() {
  const row = await prisma.storeSetting.findUnique({ where: { key: "reviews" } });
  if (!row?.value) return {};
  try {
    const parsed = JSON.parse(row.value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function saveReviewsMap(map) {
  const value = JSON.stringify(map);
  await prisma.storeSetting.upsert({
    where: { key: "reviews" },
    create: { key: "reviews", value },
    update: { value }
  });
}

reviewsRouter.get("/", async (_req, res) => {
  res.json(await getReviewsMap());
});

reviewsRouter.post("/", reviewLimiter, async (req, res) => {
  const productName = String(req.body?.productName || "").trim().slice(0, 120);
  const text = String(req.body?.text || "").trim().slice(0, 2000);
  const user = String(req.body?.user || "User").trim().slice(0, 80);
  const rating = Math.max(1, Math.min(5, parseInt(req.body?.rating, 10) || 5));
  if (!productName || !text) return res.status(400).json({ error: "productName and text required" });

  const map = await getReviewsMap();
  const entry = map[productName] || { rating: 4.7, count: 0, comments: [] };
  entry.rating = rating;
  entry.comments = Array.isArray(entry.comments) ? entry.comments : [];
  entry.comments.unshift({
    user,
    time: new Date().toISOString(),
    text
  });
  entry.count = (entry.count || 0) + 1;
  map[productName] = entry;
  await saveReviewsMap(map);
  broadcastSettingsUpdate(req.app.get("io"));
  res.status(201).json({ ok: true, reviews: map });
});
