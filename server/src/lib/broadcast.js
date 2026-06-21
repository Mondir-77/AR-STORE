import { log } from "./logger.js";

export function broadcastCatalogUpdate(io) {
  io.of("/public").to("storefront").emit("catalog:updated", { at: Date.now() });
  log.catalog("Live update sent to all clients", "catalog:updated");
}

export function broadcastSettingsUpdate(io) {
  io.of("/public").to("storefront").emit("settings:updated", { at: Date.now() });
  log.settings("Live update sent to all clients", "settings:updated");
}

export function broadcastOrdersUpdate(io) {
  io.of("/public").to("storefront").emit("orders:updated", { at: Date.now() });
  io.to("admin").emit("orders:updated", { at: Date.now() });
}
