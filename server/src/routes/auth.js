import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { signToken, authMiddleware, requireAuth } from "../middleware/auth.js";
import { log, clientIp } from "../lib/logger.js";

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const fullName = String(req.body?.fullName || "").trim();
    if (!email || !password || password.length < 6) {
      return res.status(400).json({ error: "Invalid email or password (min 6 chars)" });
    }
    if (!fullName) return res.status(400).json({ error: "Full name required" });
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ error: "Email already registered" });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, passwordHash, fullName, role: "USER" }
    });
    const token = signToken(user);
    log.auth("User registered", `${email} · ${clientIp(req)}`);
    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        createdAt: user.createdAt
      }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
});

authRouter.post("/login", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      log.auth("Login failed", `${email} · ${clientIp(req)}`);
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      log.auth("Login failed", `${email} · ${clientIp(req)}`);
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = signToken(user);
    log.auth("Login OK", `${email} · role=${user.role} · ${clientIp(req)}`);
    return res.json({
      token,
      user: { id: user.id, email: user.email, fullName: user.fullName, avatarUrl: user.avatarUrl, role: user.role }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
});

authRouter.get("/me", authMiddleware, requireAuth, async (req, res) => {
  const u = req.user;
  return res.json({
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    avatarUrl: u.avatarUrl,
    role: u.role
  });
});

authRouter.patch("/profile", authMiddleware, requireAuth, async (req, res) => {
  try {
    const fullName = req.body?.fullName != null ? String(req.body.fullName).trim() : undefined;
    const avatarUrl = req.body?.avatarUrl != null ? String(req.body.avatarUrl).trim() : undefined;
    const data = {};
    if (fullName !== undefined) data.fullName = fullName || req.user.fullName;
    if (avatarUrl !== undefined) data.avatarUrl = avatarUrl || null;
    const user = await prisma.user.update({ where: { id: req.user.id }, data });
    return res.json({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      role: user.role
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
});

authRouter.post("/password", authMiddleware, requireAuth, async (req, res) => {
  const current = String(req.body?.currentPassword || "");
  const nextPass = String(req.body?.newPassword || "");
  if (nextPass.length < 6) return res.status(400).json({ error: "New password too short" });
  const ok = await bcrypt.compare(current, req.user.passwordHash);
  if (!ok) return res.status(400).json({ error: "Current password incorrect" });
  const passwordHash = await bcrypt.hash(nextPass, 10);
  await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } });
  return res.json({ ok: true });
});
