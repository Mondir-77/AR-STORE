import "dotenv/config";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { Server } from "socket.io";
import { authRouter } from "./routes/auth.js";
import { productsRouter } from "./routes/products.js";
import { ordersRouter, adminOrdersRouter } from "./routes/orders.js";
import { chatRouter, adminChatRouter } from "./routes/messages.js";
import { adminRouter } from "./routes/admin.js";
import { aiRouter, adminAiRouter } from "./routes/ai.js";
import { settingsRouter } from "./routes/settings.js";
import { uploadRouter } from "./routes/upload.js";
import { reviewsRouter } from "./routes/reviews.js";
import { verifyToken } from "./middleware/auth.js";
import { apiLogger } from "./middleware/apiLogger.js";
import { log, clientIp } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "..");

const PORT = parseInt(process.env.PORT || "3000", 10);

const app = express();
const httpServer = createServer(app);

app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "12mb" }));

const limiter = rateLimit({ windowMs: 60_000, max: 300 });
app.use("/api/", limiter);

const authLimiter = rateLimit({ windowMs: 15 * 60_000, max: 40 });
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use(apiLogger);

app.use("/api/auth", authRouter);
app.use("/api/products", productsRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/admin/orders", adminOrdersRouter);
app.use("/api/chat", chatRouter);
app.use("/api/admin/chat", adminChatRouter);
app.use("/api/admin", adminRouter);
app.use("/api/ai", aiRouter);
app.use("/api/admin/ai", adminAiRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/admin/upload", uploadRouter);

const UPLOADS = path.join(__dirname, "..", "uploads");
app.use("/uploads", express.static(UPLOADS));

app.use(express.static(ROOT));

const io = new Server(httpServer, {
  cors: { origin: true, credentials: true }
});

app.set("io", io);

const publicIo = io.of("/public");
publicIo.on("connection", (socket) => {
  socket.join("storefront");
  const ip = clientIp(socket);
  log.socket("Client connected (live updates)", `${ip} · id=${socket.id.slice(0, 8)}`);
  socket.on("disconnect", (reason) => {
    log.socket("Client disconnected", `${ip} · ${reason}`);
  });
});

io.use((socket, next) => {
  const token =
    socket.handshake.auth?.token ||
    (typeof socket.handshake.headers?.authorization === "string" && socket.handshake.headers.authorization.startsWith("Bearer ")
      ? socket.handshake.headers.authorization.slice(7)
      : null);
  const payload = verifyToken(token);
  if (!payload?.sub) return next(new Error("Unauthorized"));
  socket.userId = payload.sub;
  socket.userRole = payload.role;
  next();
});

io.on("connection", (socket) => {
  if (socket.userRole === "ADMIN") socket.join("admin");
  socket.join(`user:${socket.userId}`);
});

function getLocalAddresses() {
  const addrs = [];
  for (const nets of Object.values(os.networkInterfaces())) {
    for (const net of nets || []) {
      if (net.family === "IPv4" && !net.internal) addrs.push(net.address);
    }
  }
  return addrs;
}

httpServer.listen(PORT, "0.0.0.0", () => {
  const lanIps = getLocalAddresses();
  const phoneIp = lanIps.find((ip) => ip.startsWith("192.168.") || ip.startsWith("10.")) || lanIps[0];
  console.log("");
  console.log("========================================");
  console.log("  AR STORE — Local Server (live log)");
  console.log("========================================");
  console.log(`  Port:    ${PORT}`);
  console.log(`  Local:   http://localhost:${PORT}`);
  for (const ip of lanIps) {
    console.log(`  Network: http://${ip}:${PORT}`);
  }
  if (phoneIp) {
    console.log(`  Phone:   http://${phoneIp}:${PORT}  (same Wi-Fi)`);
    console.log(`  Admin:   http://${phoneIp}:${PORT}/admin/`);
  } else {
    console.log(`  Admin:   http://localhost:${PORT}/admin/`);
  }
  console.log("");
  console.log("  Updates appear below (products, images, settings…)");
  console.log("  Press Ctrl+C to stop.");
  console.log("========================================");
  console.log("");
  log.server("Server started", `listening on 0.0.0.0:${PORT}`);
});

async function shutdown() {
  try {
    await prisma.$disconnect();
  } catch (_) {}
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
