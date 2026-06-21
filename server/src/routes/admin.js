import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { authMiddleware, requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

export const adminRouter = Router();
adminRouter.use(authMiddleware, requireAuth, requireAdmin);

adminRouter.get("/stats", async (_req, res) => {
  const [userCount, orderCount, agg] = await Promise.all([
    prisma.user.count({ where: { role: "USER" } }),
    prisma.order.count(),
    prisma.order.aggregate({
      _sum: { totalRevenue: true, totalProfit: true, totalCost: true }
    })
  ]);
  res.json({
    users: userCount,
    orders: orderCount,
    revenue: agg._sum.totalRevenue || 0,
    profit: agg._sum.totalProfit || 0,
    cost: agg._sum.totalCost || 0
  });
});

adminRouter.post("/password", async (req, res) => {
  const password = String(req.body?.password || "");
  if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } });
  res.json({ ok: true });
});

adminRouter.get("/users", async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      fullName: true,
      avatarUrl: true,
      role: true,
      createdAt: true,
      _count: { select: { orders: true } }
    },
    take: 500
  });
  res.json(users);
});

adminRouter.get("/analytics/orders-by-day", async (req, res) => {
  const days = Math.min(90, Math.max(7, parseInt(req.query.days, 10) || 30));
  const from = new Date();
  from.setDate(from.getDate() - days);
  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: from } },
    select: { createdAt: true, totalRevenue: true, totalProfit: true, totalCost: true }
  });
  const buckets = {};
  for (const o of orders) {
    const d = o.createdAt.toISOString().slice(0, 10);
    if (!buckets[d]) buckets[d] = { revenue: 0, profit: 0, cost: 0, count: 0 };
    buckets[d].revenue += o.totalRevenue;
    buckets[d].profit += o.totalProfit;
    buckets[d].cost += o.totalCost;
    buckets[d].count += 1;
  }
  const series = Object.keys(buckets)
    .sort()
    .map((k) => ({ day: k, ...buckets[k] }));
  res.json({ series });
});

adminRouter.get("/analytics/product-profit", async (_req, res) => {
  const items = await prisma.orderItem.findMany({
    include: { product: true }
  });
  const byProduct = {};
  for (const it of items) {
    const id = it.productId;
    if (!byProduct[id]) {
      byProduct[id] = {
        productId: id,
        name: it.product.name,
        qty: 0,
        revenue: 0,
        cost: 0,
        profit: 0
      };
    }
    byProduct[id].qty += it.qty;
    byProduct[id].revenue += it.unitPrice * it.qty;
    byProduct[id].cost += it.unitCost * it.qty;
    byProduct[id].profit += (it.unitPrice - it.unitCost) * it.qty;
  }
  res.json(Object.values(byProduct).sort((a, b) => b.profit - a.profit));
});
