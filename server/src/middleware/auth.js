import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

const DEFAULT_DEV_SECRET = "dev-insecure-change-me";
export const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_DEV_SECRET;

// Don't break local dev, but warn loudly if running with the default secret.
if (JWT_SECRET === DEFAULT_DEV_SECRET) {
  const env = String(process.env.NODE_ENV || "").toLowerCase();
  const msg =
    "[SECURITY] JWT_SECRET is using the default dev value. Set JWT_SECRET in server environment variables.";
  if (env === "production") console.error(msg);
  else console.warn(msg);
}

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export function verifyToken(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export async function authMiddleware(req, res, next) {
  try {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : null;
    const payload = verifyToken(token);
    if (!payload?.sub) {
      req.user = null;
      return next();
    }
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    req.user = user || null;
    req.jwtPayload = payload;
    next();
  } catch (e) {
    console.error(e);
    // Fail closed: if auth lookup fails, treat as unauthenticated.
    req.user = null;
    req.jwtPayload = null;
    next();
  }
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  next();
}
