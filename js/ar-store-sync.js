/**
 * AR STORE — Server sync client (catalog, settings, live updates)
 */
(function (global) {
  const TOKEN_KEY = "arStoreJwt";
  const ADMIN_TOKEN_KEY = "arStoreAdminJwt";
  const CATALOG_KEY = "arStoreAdminCatalog";
  const SETTINGS_KEY = "arStoreSettings";

  let socket = null;
  let socketLoading = false;

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  function setToken(token) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }

  function getAdminToken() {
    return localStorage.getItem(ADMIN_TOKEN_KEY) || "";
  }

  function setAdminToken(token) {
    if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token);
    else localStorage.removeItem(ADMIN_TOKEN_KEY);
  }

  function resolveAuthToken(auth) {
    if (auth === "none") return "";
    if (auth === "admin") return getAdminToken();
    if (auth === "any") return getAdminToken() || getToken();
    return getToken();
  }

  function adminEmailFromUsername(username) {
    const u = String(username || "").trim();
    if (u.includes("@")) return u.toLowerCase();
    if (/^mondir\s*ar$/i.test(u) || u === "MondirAR") return "admin@arstore.local";
    return "admin@arstore.local";
  }

  const ACCOUNTS_KEY = "arStoreAccounts";

  function readLocalAccounts() {
    try {
      const rows = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "[]");
      return Array.isArray(rows) ? rows : [];
    } catch (_e) {
      return [];
    }
  }

  function upsertLocalAccount({ name, email, createdAt, source, avatar }) {
    const em = String(email || "").trim().toLowerCase();
    if (!em) return;
    const accounts = readLocalAccounts();
    const idx = accounts.findIndex((a) => String(a?.email || "").toLowerCase() === em);
    const entry = {
      name: String(name || em).trim() || em,
      email: em,
      createdAt: createdAt || new Date().toISOString(),
      source: source || "server"
    };
    if (avatar) entry.avatar = avatar;
    if (idx >= 0) accounts[idx] = { ...accounts[idx], ...entry };
    else accounts.push(entry);
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  }

  async function registerUser(fullName, email, password) {
    const data = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ fullName, email, password }),
      auth: "none"
    });
    if (data.token) setToken(data.token);
    if (data.user?.email) {
      upsertLocalAccount({
        name: data.user.fullName || fullName,
        email: data.user.email,
        createdAt: data.user.createdAt,
        avatar: data.user.avatarUrl || undefined,
        source: "server"
      });
    }
    return data;
  }

  async function loginUser(email, password) {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: String(email).trim().toLowerCase(), password }),
      auth: "none"
    });
    if (data.token) setToken(data.token);
    return data;
  }

  async function api(path, options = {}) {
    const { auth = "user", ...fetchOptions } = options;
    const headers = { ...(fetchOptions.headers || {}) };
    if (fetchOptions.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
    const token = resolveAuthToken(auth);
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(path, { ...fetchOptions, headers });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (_) {
      data = { raw: text };
    }
    if (!res.ok) {
      const err = new Error(data?.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  const DEFAULT_CATEGORIES = [
    { id: 1, name: "Parfum", image: "parf.jpeg" },
    { id: 2, name: "Electronics", image: "2.jpeg" },
    { id: 3, name: "Clothing", image: "3.jpeg" },
    { id: 4, name: "Watches", image: "4.jpeg" },
    { id: 5, name: "Shoes", image: "5.jpeg" }
  ];

  function parseProductImages(p) {
    if (Array.isArray(p?.images)) return p.images.map((u) => String(u || "").trim()).filter(Boolean);
    const raw = p?.imageUrls;
    if (typeof raw === "string" && raw.trim().startsWith("[")) {
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return arr.map((u) => String(u || "").trim()).filter(Boolean);
      } catch (_e) {}
    }
    const single = String(p?.img || p?.imageUrl || "").trim();
    return single ? [single] : [];
  }

  function parseCategories(raw) {
    let list = raw;
    if (typeof raw === "string") {
      try {
        list = JSON.parse(raw);
      } catch (_e) {
        list = null;
      }
    }
    if (!Array.isArray(list) || !list.length) return DEFAULT_CATEGORIES.map((c) => ({ ...c }));
    return list
      .map((c, i) => ({
        id: parseInt(c.id, 10) || i + 1,
        name: String(c.name || `Category ${i + 1}`).trim(),
        nameEn: String(c.nameEn || "").trim(),
        nameFr: String(c.nameFr || "").trim(),
        image: String(c.image || c.imageUrl || "").trim()
      }))
      .filter((c) => c.name);
  }

  function localizedName(item, lang) {
    if (!item) return "";
    const l = String(lang || "en").toLowerCase();
    const base = String(item.name || "").trim();
    const en = String(item.nameEn || "").trim();
    const fr = String(item.nameFr || "").trim();
    if (l === "fr" && fr) return fr;
    if (l === "en" && en) return en;
    return base || en || fr;
  }

  function productToFrontend(p) {
    const images = parseProductImages(p);
    const img = images[0] || String(p.imageUrl || "").trim();
    return {
      id: p.id,
      name: p.name,
      nameEn: String(p.nameEn || "").trim(),
      nameFr: String(p.nameFr || "").trim(),
      price: p.price,
      costPrice: p.costPrice || 0,
      img,
      images: images.length ? images : img ? [img] : [],
      desc: p.description || "",
      categoryId: parseInt(p.categoryId, 10) || 1,
      videoUrl: String(p.videoUrl || "").trim(),
      stockMax: Math.max(0, parseInt(p.stockMax, 10) || 0)
    };
  }

  function productToApi(p) {
    const images = Array.isArray(p.images)
      ? p.images.map((u) => String(u || "").trim()).filter(Boolean)
      : parseProductImages(p);
    const imageUrl = images[0] || String(p.img || p.imageUrl || "").trim();
    return {
      name: p.name,
      nameEn: String(p.nameEn || "").trim(),
      nameFr: String(p.nameFr || "").trim(),
      description: p.desc || "",
      price: Number(p.price) || 0,
      costPrice: Number(p.costPrice || p.cost || 0) || 0,
      categoryId: Math.max(1, parseInt(p.categoryId, 10) || 1),
      imageUrl,
      imageUrls: JSON.stringify(images.length ? images : imageUrl ? [imageUrl] : []),
      videoUrl: String(p.videoUrl || "").trim(),
      stockMax: Math.max(0, parseInt(p.stockMax, 10) || 0)
    };
  }

  function catalogFromProducts(products, categoryDefs) {
    const defs = parseCategories(categoryDefs);
    const categories = {};
    defs.forEach((c) => {
      categories[c.id] = [];
    });
    (products || []).forEach((p) => {
      const c = Math.max(1, parseInt(p.categoryId, 10) || 1);
      if (!categories[c]) categories[c] = [];
      categories[c].push({
        id: p.id,
        img: p.img,
        name: p.name,
        nameEn: p.nameEn || "",
        nameFr: p.nameFr || "",
        price: p.price,
        desc: p.desc || "",
        images: Array.isArray(p.images) ? p.images : p.img ? [p.img] : [],
        videoUrl: p.videoUrl || "",
        stockMax: p.stockMax || 0
      });
    });
    return { products, categories, categoryDefs: defs };
  }

  function parseSettingsFlat(flat) {
    if (!flat || typeof flat !== "object") return {};
    const s = { ...flat };
    if (typeof s.categoryImages === "string") {
      try {
        s.categoryImages = JSON.parse(s.categoryImages);
      } catch (_) {
        s.categoryImages = {};
      }
    }
    if (typeof s.catalogCategories === "string") {
      s.catalogCategories = parseCategories(s.catalogCategories);
    }
    if (typeof s.reviews === "string") {
      try {
        s.reviews = JSON.parse(s.reviews);
      } catch (_) {
        s.reviews = {};
      }
    }
    return s;
  }

  function settingsToFlat(settings) {
    const out = {};
    Object.entries(settings || {}).forEach(([k, v]) => {
      if (v == null) return;
      out[k] = typeof v === "object" ? JSON.stringify(v) : String(v);
    });
    return out;
  }

  async function loginAdmin(username, password) {
    const email = adminEmailFromUsername(username);
    const data = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      auth: "none"
    });
    if (data.user?.role !== "ADMIN") {
      setAdminToken("");
      throw new Error("Not an admin account");
    }
    setAdminToken(data.token);
    return data;
  }

  function looksLikeJwt(token) {
    return typeof token === "string" && token.split(".").length === 3 && token.length > 40;
  }

  function sanitizeAdminToken() {
    const t = getAdminToken();
    if (t && !looksLikeJwt(t)) setAdminToken("");
  }

  async function ensureAdminSession() {
    sanitizeAdminToken();
    await migrateAdminTokenFromLegacy();
    sanitizeAdminToken();
    if (!getAdminToken()) return false;
    if (!(await pingServer())) return false;
    return verifyAdminSession();
  }

  async function verifyAdminSession() {
    if (!getAdminToken() || !looksLikeJwt(getAdminToken())) {
      setAdminToken("");
      return false;
    }
    try {
      await api("/api/admin/stats", { auth: "admin" });
      return true;
    } catch (e) {
      if (e.status === 401 || e.status === 403) setAdminToken("");
      return false;
    }
  }

  async function migrateAdminTokenFromLegacy() {
    if (getAdminToken() && looksLikeJwt(getAdminToken())) return true;
    const legacy = getToken();
    if (!legacy || !looksLikeJwt(legacy)) return false;
    try {
      const res = await fetch("/api/admin/stats", {
        headers: { Authorization: `Bearer ${legacy}` }
      });
      if (res.ok) {
        setAdminToken(legacy);
        return true;
      }
    } catch (_) {}
    return false;
  }

  async function fetchProducts() {
    const rows = await api("/api/products", { auth: "none" });
    return Array.isArray(rows) ? rows.map(productToFrontend) : [];
  }

  async function fetchCatalog() {
    const settings = await fetchSettings();
    const products = await fetchProducts();
    const catalog = catalogFromProducts(products, settings.catalogCategories);
    localStorage.setItem(CATALOG_KEY, JSON.stringify(catalog));
    return catalog;
  }

  async function fetchSettings() {
    const flat = await api("/api/settings/public", { auth: "none" });
    const settings = parseSettingsFlat(flat);
    if (Object.keys(settings).length) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }
    if (settings.reviews && typeof settings.reviews === "object") {
      localStorage.setItem(REVIEWS_KEY, JSON.stringify(settings.reviews));
    }
    return settings;
  }

  async function saveProduct(p, existingId) {
    const ready = await ensureAdminSession();
    if (!ready) {
      const err = new Error("Unauthorized");
      err.status = 401;
      throw err;
    }
    const body = productToApi(p);
    let saved;
    if (existingId && !String(existingId).startsWith("p_") && !String(existingId).startsWith("seed_")) {
      saved = await api(`/api/products/${existingId}`, { method: "PATCH", body: JSON.stringify(body), auth: "admin" });
    } else if (existingId) {
      const products = await fetchProducts();
      const match = products.find(
        (x) => x.name === p.name && String(x.categoryId) === String(p.categoryId)
      );
      if (match) {
        saved = await api(`/api/products/${match.id}`, { method: "PATCH", body: JSON.stringify(body), auth: "admin" });
      } else {
        saved = await api("/api/products", { method: "POST", body: JSON.stringify(body), auth: "admin" });
      }
    } else {
      saved = await api("/api/products", { method: "POST", body: JSON.stringify(body), auth: "admin" });
    }
    await fetchCatalog();
    return productToFrontend(saved);
  }

  async function deleteProduct(id) {
    let targetId = id;
    if (String(id).startsWith("p_") || String(id).startsWith("seed_")) {
      let local = null;
      try {
        const cat = JSON.parse(localStorage.getItem(CATALOG_KEY) || "{}");
        local = (cat.products || []).find((x) => x.id === id);
      } catch (_) {}
      if (!local) return;
      const products = await fetchProducts();
      const match = products.find(
        (x) => x.name === local.name && Number(x.categoryId) === Number(local.categoryId)
      );
      if (!match) return;
      targetId = match.id;
    }
    await api(`/api/products/${targetId}`, { method: "DELETE", auth: "admin" });
    await fetchCatalog();
  }

  async function saveSettings(settings) {
    const flat = settingsToFlat(settings);
    if (settings.reviews && typeof settings.reviews === "object") {
      flat.reviews = JSON.stringify(settings.reviews);
    }
    await api("/api/settings", { method: "PUT", body: JSON.stringify(flat), auth: "admin" });
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    if (settings.reviews) localStorage.setItem(REVIEWS_KEY, JSON.stringify(settings.reviews));
    return settings;
  }

  async function uploadImageDataUrl(dataUrl) {
    const ready = await ensureAdminSession();
    if (!ready) {
      const err = new Error("Unauthorized");
      err.status = 401;
      throw err;
    }
    const data = await api("/api/admin/upload", {
      method: "POST",
      body: JSON.stringify({ dataUrl }),
      auth: "admin"
    });
    return data.url;
  }

  async function uploadImageFile(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = async () => {
        try {
          resolve(await uploadImageDataUrl(String(r.result || "")));
        } catch (e) {
          reject(e);
        }
      };
      r.onerror = () => reject(new Error("file_read_failed"));
      r.readAsDataURL(file);
    });
  }

  function loadSocketIo() {
    if (global.io) return Promise.resolve(global.io);
    if (socketLoading) {
      return new Promise((resolve) => {
        const t = setInterval(() => {
          if (global.io) {
            clearInterval(t);
            resolve(global.io);
          }
        }, 50);
      });
    }
    socketLoading = true;
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "/socket.io/socket.io.js";
      s.onload = () => {
        socketLoading = false;
        resolve(global.io);
      };
      s.onerror = () => {
        socketLoading = false;
        reject(new Error("socket.io load failed"));
      };
      document.head.appendChild(s);
    });
  }

  const REVIEWS_KEY = "arStoreReviews";

  function orderToFrontend(o) {
    const items = Array.isArray(o?.items) ? o.items : [];
    const first = items[0]?.product || items[0] || {};
    return {
      id: o.id,
      status: o.status || "pending",
      createdAt: o.createdAt ? new Date(o.createdAt).getTime() : Date.now(),
      channel: o.channel || o.paymentMethod || "online",
      paymentMethod: o.paymentMethod || "online",
      note: o.note || "",
      customer: {
        name: o.customerName || o.user?.fullName || "",
        phone: o.customerPhone || "",
        city: o.customerCity || "",
        email: o.user?.email || ""
      },
      items: items.map((it) => ({
        productId: it.productId,
        name: it.product?.name || it.name || "Item",
        price: it.unitPrice ?? it.price ?? 0,
        qty: it.qty || 1,
        img: it.product?.imageUrl || it.img || "",
        costPrice: it.unitCost ?? it.costPrice ?? 0
      })),
      revenue: Number(o.totalRevenue ?? o.revenue ?? 0) || 0,
      cost: Number(o.totalCost ?? 0) || 0,
      profit: Number(o.totalProfit ?? 0) || 0,
      product: {
        name: first.name || items[0]?.name || "—",
        img: first.imageUrl || first.img || "",
        price: first.price ?? items[0]?.unitPrice ?? 0
      },
      userKey: o.user?.email ? `local:${String(o.user.email).toLowerCase()}` : "guest",
      _server: true
    };
  }

  function buildOrderPayload(payload) {
    const customer = payload.customer || {};
    const items = (Array.isArray(payload.items) ? payload.items : []).map((it) => ({
      productId: it.productId || it.id || undefined,
      name: it.name,
      price: it.price,
      qty: it.qty || it.quantity || 1
    }));
    if (!items.length && payload.product?.name) {
      items.push({
        productId: payload.product.id,
        name: payload.product.name,
        price: payload.product.price,
        qty: 1
      });
    }
    return {
      items,
      customerName: customer.name || "",
      customerPhone: customer.phone || "",
      customerCity: customer.city || "",
      channel: payload.channel || "online",
      paymentMethod: payload.paymentMethod || payload.channel || "online",
      note: payload.note || ""
    };
  }

  async function submitOrder(payload) {
    const body = buildOrderPayload(payload);
    const token = getToken();
    if (token) {
      try {
        return await api("/api/orders", { method: "POST", body: JSON.stringify(body) });
      } catch (e) {
        if (e.status !== 401) throw e;
      }
    }
    try {
      const session = JSON.parse(localStorage.getItem("arStoreSession") || "null");
      if (session?.email && session.mode !== "guest") {
        const err = new Error("Session expired — order saved locally only");
        err.localOnly = true;
        throw err;
      }
    } catch (e) {
      if (e?.localOnly) throw e;
    }
    return api("/api/orders/guest", { method: "POST", body: JSON.stringify(body) });
  }

  async function fetchAdminOrders() {
    const rows = await api("/api/admin/orders", { auth: "admin" });
    return Array.isArray(rows) ? rows.map(orderToFrontend) : [];
  }

  async function updateAdminOrderStatus(id, status) {
    return api(`/api/admin/orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
      auth: "admin"
    });
  }

  async function deleteAdminOrder(id) {
    return api(`/api/admin/orders/${id}`, { method: "DELETE", auth: "admin" });
  }

  async function fetchAdminUsers() {
    return api("/api/admin/users", { auth: "admin" });
  }

  async function fetchAdminStats() {
    return api("/api/admin/stats", { auth: "admin" });
  }

  async function adminAiChat(message) {
    const data = await api("/api/admin/ai/chat", {
      method: "POST",
      body: JSON.stringify({ message }),
      auth: "admin"
    });
    return data?.reply || "";
  }

  async function updateAdminPassword(password) {
    return api("/api/admin/password", {
      method: "POST",
      body: JSON.stringify({ password }),
      auth: "admin"
    });
  }

  async function saveReviews(reviews) {
    const map = reviews && typeof reviews === "object" ? reviews : {};
    localStorage.setItem(REVIEWS_KEY, JSON.stringify(map));
    if (!getAdminToken()) return map;
    let current = {};
    try {
      current = parseSettingsFlat(JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"));
    } catch (_) {}
    await saveSettings({ ...current, reviews: map });
    return map;
  }

  function imgSrc(url) {
    const u = String(url || "").trim();
    if (!u || u.startsWith("data:") || /^https?:\/\//i.test(u)) return u;
    if (!u.includes(" ")) return u;
    return u.replace(/ /g, "%20");
  }

  async function fetchMyOrders() {
    const rows = await api("/api/orders/mine");
    return Array.isArray(rows) ? rows.map(orderToFrontend) : [];
  }

  async function submitReview(productName, user, text, rating) {
    const data = await api("/api/reviews", {
      method: "POST",
      body: JSON.stringify({ productName, user, text, rating })
    });
    if (data?.reviews) localStorage.setItem(REVIEWS_KEY, JSON.stringify(data.reviews));
    return data;
  }

  async function fetchReviews() {
    const map = await api("/api/reviews", { auth: "none" });
    if (map && typeof map === "object") {
      localStorage.setItem(REVIEWS_KEY, JSON.stringify(map));
    }
    return map;
  }

  async function initLiveSync(handlers = {}) {
    try {
      await loadSocketIo();
      if (socket) return socket;
      socket = global.io("/public", { transports: ["websocket", "polling"] });
      socket.on("catalog:updated", async () => {
        await fetchCatalog();
        handlers.onCatalog?.();
      });
      socket.on("settings:updated", async () => {
        await fetchSettings();
        handlers.onSettings?.();
      });
      socket.on("orders:updated", async () => {
        handlers.onOrders?.();
      });
      socket.on("connect", async () => {
        try {
          await fetchCatalog();
          await fetchSettings();
          handlers.onCatalog?.();
          handlers.onSettings?.();
        } catch (_) {}
      });
      return socket;
    } catch (e) {
      console.warn("Live sync unavailable:", e.message);
      return null;
    }
  }

  async function pingServer() {
    try {
      const res = await fetch("/api/health");
      return res.ok;
    } catch (_) {
      return false;
    }
  }

  function canUseServer() {
    return Boolean(getToken());
  }

  function canUseAdminServer() {
    return looksLikeJwt(getAdminToken());
  }

  global.ARStoreSync = {
    TOKEN_KEY,
    ADMIN_TOKEN_KEY,
    CATALOG_KEY,
    SETTINGS_KEY,
    REVIEWS_KEY,
    getToken,
    setToken,
    getAdminToken,
    setAdminToken,
    verifyAdminSession,
    ensureAdminSession,
    migrateAdminTokenFromLegacy,
    looksLikeJwt,
    sanitizeAdminToken,
    loginAdmin,
    registerUser,
    loginUser,
    upsertLocalAccount,
    fetchCatalog,
    fetchSettings,
    fetchProducts,
    saveProduct,
    deleteProduct,
    saveSettings,
    uploadImageDataUrl,
    uploadImageFile,
    initLiveSync,
    pingServer,
    canUseServer,
    canUseAdminServer,
    productToFrontend,
    productToApi,
    catalogFromProducts,
    parseCategories,
    localizedName,
    parseProductImages,
    DEFAULT_CATEGORIES,
    orderToFrontend,
    submitOrder,
    fetchMyOrders,
    fetchAdminOrders,
    updateAdminOrderStatus,
    deleteAdminOrder,
    fetchAdminUsers,
    fetchAdminStats,
    adminAiChat,
    updateAdminPassword,
    saveReviews,
    imgSrc,
    submitReview,
    fetchReviews
  };
})(window);
