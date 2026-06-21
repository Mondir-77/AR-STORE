import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authMiddleware, requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { createOrderRecord, getGuestUser } from "../lib/orderHelper.js";
import { broadcastOrdersUpdate } from "../lib/broadcast.js";

export const ordersRouter = Router();
ordersRouter.use(authMiddleware);

async function handleCreateOrder(req, res, userId) {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const customer = req.body?.customer || {};
    const result = await createOrderRecord({
      userId,
      items,
      customerName: String(req.body?.customerName || customer.name || req.user?.fullName || "").trim(),
      customerPhone: String(req.body?.customerPhone || customer.phone || "").trim(),
      customerCity: String(req.body?.customerCity || customer.city || "").trim(),
      paymentMethod: String(req.body?.paymentMethod || req.body?.channel || "online"),
      channel: String(req.body?.channel || ""),
      note: String(req.body?.note || "")
    });
    if (result.error) return res.status(result.status || 400).json({ error: result.error });
    broadcastOrdersUpdate(req.app.get("io"));
    res.status(201).json(result.order);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
}

ordersRouter.post("/guest", async (req, res) => {
  try {
    const guest = await getGuestUser();
    return handleCreateOrder(req, res, guest.id);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

ordersRouter.post("/", requireAuth, async (req, res) => {
  return handleCreateOrder(req, res, req.user.id);
});

ordersRouter.get("/mine", requireAuth, async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" },
    include: { items: { include: { product: true } } }
  });
  res.json(orders);
});

export const adminOrdersRouter = Router();
adminOrdersRouter.use(authMiddleware, requireAuth, requireAdmin);

adminOrdersRouter.get("/", async (req, res) => {
  const { status, from, to, minProfit, q } = req.query;
  const where = {};
  if (status && String(status) !== "all") where.status = String(status);
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(String(from));
    if (to) where.createdAt.lte = new Date(String(to));
  }
  if (minProfit != null && minProfit !== "") {
    where.totalProfit = { gte: Number(minProfit) || 0 };
  }
  if (q) {
    const s = String(q).trim();
    where.OR = [
      { id: { contains: s } },
      { customerName: { contains: s } },
      { customerPhone: { contains: s } },
      { channel: { contains: s } },
      { note: { contains: s } }
    ];
  }
  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, email: true, fullName: true } }, items: { include: { product: true } } },
    take: 500
  });
  res.json(orders);
});

adminOrdersRouter.patch("/:id", async (req, res) => {
  const status = req.body?.status != null ? String(req.body.status) : undefined;
  const allowed = ["pending", "in_delivery", "delivered", "cancelled"];
  if (status && !allowed.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }
  const data = {};
  if (status) data.status = status;
  try {
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data,
      include: { user: { select: { id: true, email: true, fullName: true } }, items: { include: { product: true } } }
    });
    broadcastOrdersUpdate(req.app.get("io"));
    res.json(order);
  } catch (e) {
    if (e.code === "P2025") return res.status(404).json({ error: "Not found" });
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

adminOrdersRouter.delete("/:id", async (req, res) => {
  try {
    await prisma.order.delete({ where: { id: req.params.id } });
    broadcastOrdersUpdate(req.app.get("io"));
    res.json({ ok: true });
  } catch (e) {
    if (e.code === "P2025") return res.status(404).json({ error: "Not found" });
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

adminOrdersRouter.get("/:id", async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { user: { select: { id: true, email: true, fullName: true } }, items: { include: { product: true } } }
  });
  if (!order) return res.status(404).json({ error: "Not found" });
  res.json(order);
});
