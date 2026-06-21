import { log, clientIp } from "../lib/logger.js";

export function apiLogger(req, res, next) {
  if (!req.path.startsWith("/api/")) return next();
  if (req.path === "/api/health") return next();

  const start = Date.now();
  const ip = clientIp(req);
  const method = req.method;
  const path = req.originalUrl || req.url;

  res.on("finish", () => {
    const ms = Date.now() - start;
    const status = res.statusCode;
    if (req.method === "GET" && status === 200 && (path.startsWith("/api/products") || path.startsWith("/api/settings/public"))) {
      return;
    }
    log.http(`${method} ${path}`, `${status} · ${ip} · ${ms}ms`);
  });

  next();
}
