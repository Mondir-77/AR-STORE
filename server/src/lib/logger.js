const TAGS = {
  catalog: "CATALOG",
  settings: "SETTINGS",
  upload: "UPLOAD",
  socket: "SOCKET",
  http: "HTTP",
  auth: "AUTH",
  server: "SERVER"
};

function ts() {
  return new Date().toLocaleTimeString("fr-FR", { hour12: false });
}

function line(tag, message, detail) {
  const base = `[${ts()}] [${tag}] ${message}`;
  if (detail != null && detail !== "") {
    console.log(`${base} — ${detail}`);
  } else {
    console.log(base);
  }
}

export const log = {
  catalog(msg, detail) {
    line(TAGS.catalog, msg, detail);
  },
  settings(msg, detail) {
    line(TAGS.settings, msg, detail);
  },
  upload(msg, detail) {
    line(TAGS.upload, msg, detail);
  },
  socket(msg, detail) {
    line(TAGS.socket, msg, detail);
  },
  http(msg, detail) {
    line(TAGS.http, msg, detail);
  },
  auth(msg, detail) {
    line(TAGS.auth, msg, detail);
  },
  server(msg, detail) {
    line(TAGS.server, msg, detail);
  }
};

export function clientIp(reqOrSocket) {
  const raw =
    reqOrSocket?.ip ||
    reqOrSocket?.headers?.["x-forwarded-for"] ||
    reqOrSocket?.handshake?.address ||
    "?";
  return String(raw).replace("::ffff:", "");
}
