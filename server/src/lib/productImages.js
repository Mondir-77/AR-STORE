export function parseImageUrls(value, fallbackUrl = "") {
  if (Array.isArray(value)) {
    return value.map((u) => String(u || "").trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    const s = value.trim();
    if (s.startsWith("[")) {
      try {
        const arr = JSON.parse(s);
        if (Array.isArray(arr)) return arr.map((u) => String(u || "").trim()).filter(Boolean);
      } catch (_e) {}
    }
    return [s];
  }
  return fallbackUrl ? [String(fallbackUrl)] : [];
}

export function primaryImage(imageUrl, imageUrls) {
  const list = parseImageUrls(imageUrls, imageUrl);
  return list[0] || String(imageUrl || "");
}

export function serializeImageUrls(imageUrl, imageUrls) {
  const list = parseImageUrls(imageUrls, imageUrl);
  const primary = list[0] || String(imageUrl || "");
  const all = list.length ? list : primary ? [primary] : [];
  return JSON.stringify(all);
}
