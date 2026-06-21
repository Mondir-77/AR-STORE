import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authMiddleware, requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

export const chatRouter = Router();
chatRouter.use(authMiddleware);

async function getOrCreateConversation(userId) {
  let conv = await prisma.conversation.findUnique({ where: { userId } });
  if (!conv) {
    conv = await prisma.conversation.create({ data: { userId } });
  }
  return conv;
}

chatRouter.get("/", requireAuth, async (req, res) => {
  const conv = await getOrCreateConversation(req.user.id);
  const messages = await prisma.message.findMany({
    where: { conversationId: conv.id },
    orderBy: { createdAt: "asc" },
    take: 500
  });
  res.json({ conversationId: conv.id, messages });
});

chatRouter.post("/", requireAuth, async (req, res) => {
  const body = String(req.body?.body || "").trim().slice(0, 4000);
  if (!body) return res.status(400).json({ error: "Empty message" });
  const conv = await getOrCreateConversation(req.user.id);
  const msg = await prisma.message.create({
    data: {
      conversationId: conv.id,
      fromRole: req.user.role === "ADMIN" ? "ADMIN" : "USER",
      fromUserId: req.user.id,
      body
    }
  });
  await prisma.conversation.update({
    where: { id: conv.id },
    data: { updatedAt: new Date() }
  });
  const io = req.app.get("io");
  if (io) {
    io.to("admin").emit("chat:message", {
      conversationId: conv.id,
      userId: req.user.id,
      message: msg
    });
    io.to(`user:${req.user.id}`).emit("chat:message", { conversationId: conv.id, message: msg });
  }
  res.status(201).json(msg);
});

export const adminChatRouter = Router();
adminChatRouter.use(authMiddleware, requireAuth, requireAdmin);

adminChatRouter.get("/conversations", async (_req, res) => {
  const conversations = await prisma.conversation.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      user: { select: { id: true, email: true, fullName: true, avatarUrl: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 }
    }
  });
  res.json(conversations);
});

adminChatRouter.get("/conversations/:userId", async (req, res) => {
  const conv = await prisma.conversation.findUnique({
    where: { userId: req.params.userId },
    include: {
      user: { select: { id: true, email: true, fullName: true, avatarUrl: true } },
      messages: { orderBy: { createdAt: "asc" }, take: 500 }
    }
  });
  if (!conv) return res.status(404).json({ error: "No conversation" });
  res.json(conv);
});

adminChatRouter.post("/conversations/:userId/reply", async (req, res) => {
  const body = String(req.body?.body || "").trim().slice(0, 4000);
  if (!body) return res.status(400).json({ error: "Empty message" });
  const conv = await getOrCreateConversation(req.params.userId);
  const msg = await prisma.message.create({
    data: {
      conversationId: conv.id,
      fromRole: "ADMIN",
      fromUserId: req.user.id,
      body
    }
  });
  await prisma.conversation.update({
    where: { id: conv.id },
    data: { updatedAt: new Date() }
  });
  const io = req.app.get("io");
  if (io) {
    io.to("admin").emit("chat:message", {
      conversationId: conv.id,
      userId: req.params.userId,
      message: msg
    });
    io.to(`user:${req.params.userId}`).emit("chat:message", { conversationId: conv.id, message: msg });
  }
  res.status(201).json(msg);
});
