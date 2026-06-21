import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { authMiddleware, requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { log } from "../lib/logger.js";
import { primaryImage, serializeImageUrls } from "../lib/productImages.js";

export const productsRouter = Router();

productsRouter.use(authMiddleware);

productsRouter.get("/", async (_req, res) => {
  const products = await prisma.product.findMany({ orderBy: { createdAt: "desc" } });
  res.json(products);
});

productsRouter.get("/:id", async (req, res) => {
  const p = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!p) return res.status(404).json({ error: "Not found" });
  res.json(p);
});

productsRouter.post("/", requireAuth, requireAdmin, async (req, res) => {
  const { name, nameEn, nameFr, description, price, costPrice, categoryId, imageUrl, imageUrls, videoUrl, stockMax } = req.body || {};
  if (!name) return res.status(400).json({ error: "name required" });
  const cover = primaryImage(imageUrl, imageUrls);
  if (!cover) return res.status(400).json({ error: "at least one image required" });
  const p = await prisma.product.create({
    data: {
      name: String(name),
      nameEn: String(nameEn || ""),
      nameFr: String(nameFr || ""),
      description: String(description || ""),
      price: Number(price) || 0,
      costPrice: Number(costPrice) || 0,
      categoryId: Math.max(1, parseInt(categoryId, 10) || 1),
      imageUrl: cover,
      imageUrls: serializeImageUrls(cover, imageUrls),
      videoUrl: String(videoUrl || "").trim(),
      stockMax: Math.max(0, parseInt(stockMax, 10) || 0)
    }
  });
  const { broadcastCatalogUpdate } = await import("../lib/broadcast.js");
  broadcastCatalogUpdate(req.app.get("io"));
  log.catalog("Product created", `"${p.name}" · cat ${p.categoryId} · ${p.price} MAD`);
  res.json(p);
});

productsRouter.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const data = {};
    for (const k of ["name", "nameEn", "nameFr", "description"]) {
      if (req.body[k] != null) data[k] = String(req.body[k]);
    }
    if (req.body.price != null) data.price = Number(req.body.price) || 0;
    if (req.body.costPrice != null) data.costPrice = Number(req.body.costPrice) || 0;
    if (req.body.categoryId != null) data.categoryId = Math.max(1, parseInt(req.body.categoryId, 10) || 1);
    if (req.body.videoUrl != null) data.videoUrl = String(req.body.videoUrl || "").trim();
    if (req.body.stockMax != null) data.stockMax = Math.max(0, parseInt(req.body.stockMax, 10) || 0);
    if (req.body.imageUrl != null || req.body.imageUrls != null) {
      const cover = primaryImage(req.body.imageUrl, req.body.imageUrls);
      if (cover) {
        data.imageUrl = cover;
        data.imageUrls = serializeImageUrls(cover, req.body.imageUrls ?? req.body.imageUrl);
      }
    }
    const p = await prisma.product.update({ where: { id: req.params.id }, data });
    const { broadcastCatalogUpdate } = await import("../lib/broadcast.js");
    broadcastCatalogUpdate(req.app.get("io"));
    const changes = Object.keys(data).join(", ") || "fields";
    log.catalog("Product updated", `"${p.name}" · ${changes}`);
    res.json(p);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return res.status(404).json({ error: "Not found" });
    }
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
});

productsRouter.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
    await prisma.product.delete({ where: { id: req.params.id } });
    const { broadcastCatalogUpdate } = await import("../lib/broadcast.js");
    broadcastCatalogUpdate(req.app.get("io"));
    log.catalog("Product deleted", existing ? `"${existing.name}" · id=${req.params.id.slice(0, 8)}…` : req.params.id);
    res.json({ ok: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return res.status(404).json({ error: "Not found" });
    }
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
});
