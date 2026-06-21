import bcrypt from "bcryptjs";
import { prisma } from "./prisma.js";

const GUEST_EMAIL = "guest@arstore.local";

export async function getGuestUser() {
  let user = await prisma.user.findUnique({ where: { email: GUEST_EMAIL } });
  if (!user) {
    const passwordHash = await bcrypt.hash("guest-not-used", 10);
    user = await prisma.user.create({
      data: {
        email: GUEST_EMAIL,
        passwordHash,
        fullName: "Guest",
        role: "USER"
      }
    });
  }
  return user;
}

async function resolveProduct(row, byId, byName) {
  const pid = String(row.productId || "").trim();
  if (pid && byId[pid]) return byId[pid];
  const name = String(row.name || "").trim().toLowerCase();
  if (name && byName[name]) return byName[name];
  const price = Number(row.price);
  if (name) {
    const match = Object.values(byId).find(
      (p) => p.name.toLowerCase() === name && (!Number.isFinite(price) || p.price === price)
    );
    if (match) return match;
  }
  return null;
}

export async function createOrderRecord({
  userId,
  items,
  customerName,
  customerPhone,
  customerCity,
  paymentMethod,
  channel,
  note
}) {
  const rows = Array.isArray(items) ? items : [];
  const allProducts = await prisma.product.findMany();
  const byId = Object.fromEntries(allProducts.map((p) => [p.id, p]));
  const byName = {};
  for (const p of allProducts) {
    const k = p.name.toLowerCase();
    if (!byName[k]) byName[k] = p;
  }

  let totalRevenue = 0;
  let totalCost = 0;
  const lineData = [];
  const skipped = [];

  for (const row of rows) {
    const p = await resolveProduct(row, byId, byName);
    if (!p) {
      skipped.push(String(row.name || row.productId || "item"));
      continue;
    }
    const qty = Math.max(1, parseInt(row.qty, 10) || 1);
    const unitPrice = Number(row.price) > 0 ? Number(row.price) : p.price;
    const unitCost = p.costPrice || 0;
    totalRevenue += unitPrice * qty;
    totalCost += unitCost * qty;
    lineData.push({ productId: p.id, qty, unitPrice, unitCost });
  }

  if (!lineData.length && !String(note || "").trim() && !skipped.length) {
    return { error: "No valid items", status: 400 };
  }

  const extraNote = skipped.length ? `Unmatched: ${skipped.join(", ")}` : "";
  const fullNote = [note, extraNote].filter(Boolean).join(" | ").trim();

  const totalProfit = totalRevenue - totalCost;
  const order = await prisma.order.create({
    data: {
      userId,
      status: "pending",
      paymentMethod: String(paymentMethod || channel || "online").slice(0, 64),
      channel: String(channel || "").slice(0, 64),
      note: fullNote.slice(0, 2000),
      customerName: customerName || null,
      customerPhone: customerPhone || null,
      customerCity: customerCity || null,
      totalRevenue,
      totalCost,
      totalProfit,
      items: lineData.length ? { create: lineData } : undefined
    },
    include: { items: { include: { product: true } }, user: { select: { id: true, email: true, fullName: true } } }
  });

  return { order };
}
