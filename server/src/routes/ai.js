import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authMiddleware, requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

async function openAiComplete(system, user) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      temperature: 0.4
    })
  });
  if (!r.ok) {
    const t = await r.text();
    console.error("OpenAI error", r.status, t);
    return null;
  }
  const j = await r.json();
  return j.choices?.[0]?.message?.content?.trim() || null;
}

function fallbackStoreReply(userMessage, products) {
  const q = userMessage.toLowerCase();
  const lines = products.slice(0, 8).map((p) => `- ${p.name} (${p.price} MAD)`);
  if (q.includes("cheap") || q.includes("budget") || q.includes("moins cher")) {
    const sorted = [...products].sort((a, b) => a.price - b.price);
    return `Voici des options abordables :\n${sorted
      .slice(0, 5)
      .map((p) => `- ${p.name} — ${p.price} MAD`)
      .join("\n")}`;
  }
  if (q.includes("compare") || q.includes("diff")) {
    return "Indiquez deux noms de produits et je résumerai les différences (prix, catégorie). Catalogue :\n" + lines.join("\n");
  }
  return (
    "Je suis l’assistant AR Store (mode hors-API). Voici un aperçu du catalogue :\n" +
    lines.join("\n") +
    "\n\nPosez une question précise (recommandation, taille, livraison, etc.)."
  );
}

function fallbackAdminReply(userMessage, stats, topProducts) {
  const q = userMessage.toLowerCase();
  if (q.includes("profitable") || q.includes("profit")) {
    const top = topProducts[0];
    return top
      ? `Le produit le plus rentable en volume est « ${top.name} » avec environ ${top.profit.toFixed(2)} MAD de marge cumulée (sur commandes enregistrées).`
      : "Pas encore assez de commandes pour classer les produits.";
  }
  if (q.includes("sales") || q.includes("vente") || q.includes("today")) {
    return `Chiffres globaux : revenus ${stats.revenue.toFixed(2)} MAD, profit net ${stats.profit.toFixed(2)} MAD, ${stats.orders} commandes, ${stats.users} clients.`;
  }
  return `Résumé rapide : ${stats.orders} commandes, ${stats.users} utilisateurs, profit total ${stats.profit.toFixed(
    2
  )} MAD. Posez une question ciblée (ex. « produit le plus rentable ? », « tendance des ventes ? »).`;
}

export const aiRouter = Router();
aiRouter.use(authMiddleware);

aiRouter.post("/store", requireAuth, async (req, res) => {
  const message = String(req.body?.message || "").trim();
  if (!message) return res.status(400).json({ error: "Empty message" });
  const products = await prisma.product.findMany({ orderBy: { price: "asc" } });
  const system =
    "Tu es l’assistant d’une boutique en ligne (AR Store). Réponds en français ou darija si l’utilisateur écrit ainsi. Sois concis, utile, et honnête sur les limites.";
  const ctx = products.map((p) => `${p.name}: ${p.price} MAD — ${p.description?.slice(0, 120)}`).join("\n");
  const text =
    (await openAiComplete(system + "\nCatalogue:\n" + ctx, message)) || fallbackStoreReply(message, products);
  res.json({ reply: text });
});

export const adminAiRouter = Router();
adminAiRouter.use(authMiddleware, requireAuth, requireAdmin);

adminAiRouter.post("/chat", async (req, res) => {
  const message = String(req.body?.message || "").trim();
  if (!message) return res.status(400).json({ error: "Empty message" });
  const [agg, userCount, orderCount, productRows] = await Promise.all([
    prisma.order.aggregate({ _sum: { totalRevenue: true, totalProfit: true } }),
    prisma.user.count({ where: { role: "USER" } }),
    prisma.order.count(),
    prisma.orderItem.findMany({ include: { product: true } })
  ]);
  const stats = {
    revenue: agg._sum.totalRevenue || 0,
    profit: agg._sum.totalProfit || 0,
    users: userCount,
    orders: orderCount
  };
  const byProduct = {};
  for (const it of productRows) {
    const id = it.productId;
    if (!byProduct[id]) byProduct[id] = { name: it.product.name, profit: 0, qty: 0 };
    byProduct[id].profit += (it.unitPrice - it.unitCost) * it.qty;
    byProduct[id].qty += it.qty;
  }
  const topProducts = Object.values(byProduct).sort((a, b) => b.profit - a.profit);
  const system =
    "Tu es un analyste e-commerce pour un admin. Réponds en français. Donne des recommandations actionnables, chiffres quand possible.";
  const text =
    (await openAiComplete(
      system + `\nStats: revenue=${stats.revenue}, profit=${stats.profit}, orders=${stats.orders}, users=${stats.users}\nTop produits par marge: ${JSON.stringify(
        topProducts.slice(0, 8)
      )}`,
      message
    )) || fallbackAdminReply(message, stats, topProducts);
  res.json({ reply: text });
});
