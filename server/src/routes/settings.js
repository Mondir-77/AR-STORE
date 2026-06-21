import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authMiddleware, requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { log } from "../lib/logger.js";

export const settingsRouter = Router();
settingsRouter.use(authMiddleware);

settingsRouter.get("/public", async (_req, res) => {
  const rows = await prisma.storeSetting.findMany();
  res.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
});

settingsRouter.get("/", requireAuth, requireAdmin, async (_req, res) => {
  const rows = await prisma.storeSetting.findMany();
  res.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
});

settingsRouter.put("/", requireAuth, requireAdmin, async (req, res) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  for (const [key, value] of Object.entries(body)) {
    const v = typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
    await prisma.storeSetting.upsert({
      where: { key: String(key) },
      create: { key: String(key), value: v },
      update: { value: v }
    });
  }
  const { broadcastSettingsUpdate } = await import("../lib/broadcast.js");
  broadcastSettingsUpdate(req.app.get("io"));
  log.settings("Settings saved (bulk)", Object.keys(body).join(", "));
  const rows = await prisma.storeSetting.findMany();
  res.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
});

settingsRouter.put("/:key", requireAuth, requireAdmin, async (req, res) => {
  const key = String(req.params.key);
  const value = String(req.body?.value ?? "");
  const row = await prisma.storeSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value }
  });
  const { broadcastSettingsUpdate } = await import("../lib/broadcast.js");
  broadcastSettingsUpdate(req.app.get("io"));
  const preview = value.length > 60 ? value.slice(0, 60) + "…" : value;
  log.settings("Setting updated", `${key} = ${preview}`);
  res.json(row);
});
