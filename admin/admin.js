/* AR STORE Admin Dashboard (local-first, non-breaking integration)
   - Uses the same localStorage keys as the storefront for orders/users/reviews/settings.
   - Writes catalog overrides to ADMIN_CATALOG_KEY which storefront reads via getCatalog().
*/

const KEYS = {
  settings: "arStoreSettings",
  accounts: "arStoreAccounts",
  profile: "arStoreProfile",
  purchases: "arStorePurchases",
  orders: "arStoreAdminOrders",
  adminCatalog: "arStoreAdminCatalog",
  reviews: "arStoreReviews",
  adminSession: "arStoreAdminSession",
  finance: "arStoreFinance",
  adminCreds: "arStoreAdminCreds"
};

const DEFAULT_ADMIN_USERNAME = "Mondir AR";
const DEFAULT_ADMIN_PASSWORD = "ARSTORE";

// Security enhancements
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

const LOGIN_ATTEMPTS_KEY = "arStoreAdminLoginAttempts";

let ordersCache = null;
let customersCache = null;

function getLoginAttempts(){
  return readLS(LOGIN_ATTEMPTS_KEY, { count: 0, lockedUntil: 0 });
}

function recordFailedLogin(){
  const a = getLoginAttempts();
  a.count = (a.count || 0) + 1;
  if(a.count >= MAX_LOGIN_ATTEMPTS){
    a.lockedUntil = Date.now() + LOCKOUT_DURATION;
  }
  writeLS(LOGIN_ATTEMPTS_KEY, a);
}

function clearLoginAttempts(){
  localStorage.removeItem(LOGIN_ATTEMPTS_KEY);
}

function isLoginLocked(){
  const a = getLoginAttempts();
  if(a.lockedUntil && Date.now() < a.lockedUntil) return a.lockedUntil;
  if(a.lockedUntil && Date.now() >= a.lockedUntil){
    clearLoginAttempts();
  }
  return 0;
}

function safeParse(str, fallback){
  try{ return JSON.parse(str); }catch(_e){ return fallback; }
}

function sanitizeInput(input) {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();
}

function validateAdminInput(input) {
  return typeof input === 'string' && input.length > 0 && input.length <= 100;
}

function readLS(key, fallback){
  return safeParse(localStorage.getItem(key), fallback);
}

function writeLS(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}

function formatMoney(n){
  const v = Number(n || 0);
  return Number.isFinite(v) ? String(Math.round(v)) : "0";
}

function byText(q, ...parts){
  const s = (q || "").trim().toLowerCase();
  if(!s) return true;
  return parts.join(" ").toLowerCase().includes(s);
}

function statusTag(status){
  const st = String(status || "pending").toLowerCase();
  const legacy = st === "shipped" ? "in_delivery" : st;
  const cls = legacy === "in_delivery" ? "shipped" : legacy;
  return `<span class="tag ${cls}">${cls}</span>`;
}

function el(id){ return document.getElementById(id); }

function sha256Fallback(text){
  const K = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
  ];
  const rotr = (n,x)=> (x>>>n) | (x<<(32-n));
  const ch = (x,y,z)=> (x&y) ^ (~x&z);
  const maj = (x,y,z)=> (x&y) ^ (x&z) ^ (y&z);
  const s0 = x=> rotr(2,x) ^ rotr(13,x) ^ rotr(22,x);
  const s1 = x=> rotr(6,x) ^ rotr(11,x) ^ rotr(25,x);
  const g0 = x=> rotr(7,x) ^ rotr(18,x) ^ (x>>>3);
  const g1 = x=> rotr(17,x) ^ rotr(19,x) ^ (x>>>10);
  const bytes = new TextEncoder().encode(String(text));
  const bitLen = bytes.length * 8;
  const withOne = new Uint8Array(((bytes.length + 9 + 63) >> 6) << 6);
  withOne.set(bytes);
  withOne[bytes.length] = 0x80;
  new DataView(withOne.buffer).setUint32(withOne.length - 4, bitLen);
  const H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  for(let i=0;i<withOne.length;i+=64){
    const w = new Uint32Array(64);
    for(let j=0;j<16;j++) w[j] = new DataView(withOne.buffer, i + j*4, 4).getUint32(0);
    for(let j=16;j<64;j++) w[j] = (g1(w[j-2]) + w[j-7] + g0(w[j-15]) + w[j-16]) >>> 0;
    let [a,b,c,d,e,f,g,h] = H;
    for(let j=0;j<64;j++){
      const t1 = (h + s1(e) + ch(e,f,g) + K[j] + w[j]) >>> 0;
      const t2 = (s0(a) + maj(a,b,c)) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0]=(H[0]+a)>>>0; H[1]=(H[1]+b)>>>0; H[2]=(H[2]+c)>>>0; H[3]=(H[3]+d)>>>0;
    H[4]=(H[4]+e)>>>0; H[5]=(H[5]+f)>>>0; H[6]=(H[6]+g)>>>0; H[7]=(H[7]+h)>>>0;
  }
  return H.map(v=> v.toString(16).padStart(8,"0")).join("");
}

async function sha256(text){
  if(globalThis.crypto?.subtle?.digest){
    try{
      const enc = new TextEncoder().encode(String(text));
      const buf = await crypto.subtle.digest("SHA-256", enc);
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
    }catch(_e){}
  }
  return sha256Fallback(text);
}

function toggleAdminPassword(inputId, btnId){
  const input = el(inputId);
  const btn = el(btnId);
  if(!input || !btn) return;
  if(input.type === "password"){
    input.type = "text";
    btn.textContent = "🙈";
    btn.setAttribute("aria-label", "Hide password");
  }else{
    input.type = "password";
    btn.textContent = "👁";
    btn.setAttribute("aria-label", "Show password");
  }
}
window.toggleAdminPassword = toggleAdminPassword;

function getSession(){
  return readLS(KEYS.adminSession, null);
}
function setSession(session){
  writeLS(KEYS.adminSession, session);
}
function clearSession(){
  localStorage.removeItem(KEYS.adminSession);
}

function getOrders(){
  if(ordersCache) return ordersCache;
  let arr = readLS(KEYS.orders, []);
  if(!Array.isArray(arr) || !arr.length){
    const legacy = readLS("arStoreOrders", []);
    if(Array.isArray(legacy) && legacy.length){
      arr = legacy;
      writeLS(KEYS.orders, arr);
    }
  }
  return Array.isArray(arr) ? arr : [];
}
function setOrders(arr){
  const next = Array.isArray(arr) ? arr : [];
  ordersCache = next;
  writeLS(KEYS.orders, next);
}

async function refreshOrdersFromServer(){
  if(!canUseServer() || !window.ARStoreSync) return false;
  try{
    const rows = await ARStoreSync.fetchAdminOrders();
    ordersCache = rows;
    writeLS(KEYS.orders, rows);
    return true;
  }catch(e){
    console.warn("Orders sync failed:", e.message);
    return false;
  }
}

async function refreshCustomersFromServer(){
  if(!canUseServer() || !window.ARStoreSync) return false;
  try{
    const rows = await ARStoreSync.fetchAdminUsers();
    customersCache = (Array.isArray(rows) ? rows : [])
      .filter(u=> String(u?.role||"").toUpperCase() !== "ADMIN")
      .map(u=>({
        name: u.fullName || u.email,
        email: u.email,
        createdAt: u.createdAt,
        orderCount: u._count?.orders || 0,
        source: "server"
      }));
    return true;
  }catch(e){
    console.warn("Customers sync failed:", e.message);
    return false;
  }
}

function getCustomers(){
  if(customersCache) return customersCache;
  const acc = readLS(KEYS.accounts, []);
  return Array.isArray(acc) ? acc : [];
}

function getSettings(){
  const s = readLS(KEYS.settings, {});
  return s && typeof s === "object" ? s : {};
}
function setSettings(s){
  writeLS(KEYS.settings, s && typeof s === "object" ? s : {});
}

function getCatalog(){
  const raw = readLS(KEYS.adminCatalog, null);
  if(raw && typeof raw === "object" && Array.isArray(raw.products) && raw.categories && typeof raw.categories === "object"){
    return {
      ...raw,
      categoryDefs: Array.isArray(raw.categoryDefs) && raw.categoryDefs.length ? raw.categoryDefs : getCategoryDefs()
    };
  }
  const defs = getCategoryDefs();
  const categories = {};
  defs.forEach(c=>{ categories[c.id] = []; });
  return {products: [], categories, categoryDefs: defs};
}
function setCatalog(cat){
  const defs = Array.isArray(cat?.categoryDefs) && cat.categoryDefs.length ? cat.categoryDefs : getCategoryDefs();
  const categories = (cat?.categories && typeof cat.categories === "object") ? {...cat.categories} : {};
  defs.forEach(c=>{
    if(!Array.isArray(categories[c.id])) categories[c.id] = [];
  });
  const next = {
    products: Array.isArray(cat?.products) ? cat.products : [],
    categories,
    categoryDefs: defs
  };
  writeLS(KEYS.adminCatalog, next);
  return next;
}

const FALLBACK_CATEGORY_DEFS = [
  { id: 1, name: "Parfum", image: "parf.jpeg" },
  { id: 2, name: "Electronics", image: "2.jpeg" },
  { id: 3, name: "Clothing", image: "3.jpeg" },
  { id: 4, name: "Watches", image: "4.jpeg" },
  { id: 5, name: "Shoes", image: "5.jpeg" }
];

function getCategoryDefs(){
  const settings = getSettings();
  if(Array.isArray(settings.catalogCategories) && settings.catalogCategories.length){
    if(window.ARStoreSync) return ARStoreSync.parseCategories(settings.catalogCategories);
    return settings.catalogCategories.map((c, i)=>({
      id: parseInt(c.id, 10) || i + 1,
      name: String(c.name || `Category ${i + 1}`).trim(),
      image: String(c.image || c.imageUrl || "").trim()
    }));
  }
  const cat = readLS(KEYS.adminCatalog, null);
  if(cat && Array.isArray(cat.categoryDefs) && cat.categoryDefs.length) return cat.categoryDefs;
  if(window.ARStoreSync) return ARStoreSync.DEFAULT_CATEGORIES.map(c=>({...c}));
  return FALLBACK_CATEGORY_DEFS.map(c=>({...c}));
}

let categoriesDraft = [];
let productImagesDraft = [];
let productsView = "catalogues";
let selectedCategoryId = null;
let editingCatalogueId = null;
let catalogueFormImage = "";

function syncCategoriesDraftFromSettings(){
  categoriesDraft = getCategoryDefs().map(c=>({...c}));
}

function categoryNameById(id){
  const c = getCategoryDefs().find(x=> x.id === Number(id));
  return c ? c.name : `Cat ${id}`;
}

function canUseServer(){
  return window.ARStoreSync && typeof ARStoreSync.canUseAdminServer === "function" && ARStoreSync.canUseAdminServer();
}

async function requireAdminServer(){
  if(!window.ARStoreSync) return false;
  const serverUp = await ARStoreSync.pingServer();
  if(!serverUp) return false;
  const ok = await ARStoreSync.ensureAdminSession();
  if(!ok) handleAdminUnauthorized("Login required.");
  return ok;
}

async function hasAdminServerSession(){
  if(!window.ARStoreSync) return false;
  try{
    const serverUp = await ARStoreSync.pingServer();
    if(!serverUp) return false;
    return await ARStoreSync.ensureAdminSession();
  }catch(_e){
    return false;
  }
}

function handleAdminUnauthorized(message){
  if(window.ARStoreSync) ARStoreSync.setAdminToken("");
  clearSession();
  adminAppMounted = false;
  showLoginShell();
  const fb = el("loginFeedback");
  if(fb) fb.textContent = message || "Session expired. Please log in again.";
  showToast(message || "Session expired — please log in again");
}

function resolveCategoryIdForSave(){
  const raw = el("productCategory")?.value || selectedCategoryId || categoriesDraft[0]?.id || 1;
  const id = Math.max(1, parseInt(raw, 10) || 1);
  selectedCategoryId = id;
  if(el("productCategory")) el("productCategory").value = String(id);
  return id;
}

function collectProductImagesFromForm(){
  const pending = String(el("productImageUrl")?.value || "").trim();
  const images = productImagesDraft.map(u=> String(u || "").trim()).filter(Boolean);
  if(pending && !images.includes(pending)) images.push(pending);
  return images;
}

function saveProductLocal(p){
  const cat = getCatalog();
  const next = Array.isArray(cat.products) ? [...cat.products] : [];
  const normalized = normalizeProduct(p);
  const idx = next.findIndex(x=> x.id === normalized.id);
  if(idx >= 0) next[idx] = normalized;
  else next.unshift(normalized);
  setCatalog(catalogFromProducts(next));
  return normalized;
}

async function deleteProductLocal(id){
  const cat = getCatalog();
  setCatalog(catalogFromProducts((cat.products || []).filter(x=> x.id !== id)));
}

async function saveProductWithSync(p, existingId){
  let images = Array.isArray(p.images) ? [...p.images] : [];
  const needsUpload = images.some(u => String(u).startsWith("data:"));
  if(needsUpload){
    if(!(await requireAdminServer())){
      const up = window.ARStoreSync && await ARStoreSync.pingServer();
      if(up) throw new Error("Unauthorized");
      showToast("Server offline — run START-SERVER.bat or use Image URL");
      throw new Error("Server offline");
    }
    try{
      for(let i = 0; i < images.length; i++){
        if(String(images[i]).startsWith("data:")){
          images[i] = await ARStoreSync.uploadImageDataUrl(images[i]);
        }
      }
    }catch(e){
      if(e.status === 401 || e.status === 403){
        handleAdminUnauthorized("Login expired — sign in again to upload images.");
        throw e;
      }
      throw e;
    }
  }
  const synced = normalizeProduct({ ...p, images, img: images[0] || p.img || "" });
  saveProductLocal(synced);

  if(await requireAdminServer()){
    try{
      await ARStoreSync.saveProduct(synced, existingId || undefined);
      showToast("Product saved & synced to store");
      return synced;
    }catch(e){
      if(e.status === 401 || e.status === 403){
        handleAdminUnauthorized("Login expired — product saved locally only.");
      }else{
        showToast("Saved locally — " + (e.message || "server sync failed"));
      }
      return synced;
    }
  }
  showToast("Product saved locally — open /admin/ on this server to sync");
  return synced;
}

function refreshAfterProductSave(catId){
  selectedCategoryId = Math.max(1, parseInt(catId, 10) || 1);
  if(el("prodCategoryTitle")) el("prodCategoryTitle").textContent = categoryNameById(selectedCategoryId);
  if(el("prodCategorySub")) el("prodCategorySub").textContent = `${countProductsInCategory(selectedCategoryId)} products · visible on storefront`;
  el("productId").value = "";
  el("productName").value = "";
  el("productPrice").value = "";
  if(el("productCostPrice")) el("productCostPrice").value = "";
  el("productDesc").value = "";
  if(el("productStockMax")) el("productStockMax").value = "";
  if(el("productVideoUrl")) el("productVideoUrl").value = "";
  renderProductVideoPreview();
  productImagesDraft = [];
  if(el("productImageUrl")) el("productImageUrl").value = "";
  renderProductImagesGallery();
  showProductsView("category");
  renderCategoryProducts();
  renderCataloguesGrid();
  renderOverview();
}

async function warnIfNoServerSync(){
  if(canUseServer()) return;
  if(!window.ARStoreSync) return;
  try{
    const ok = await ARStoreSync.pingServer();
    if(!ok){
      showToast("Server offline — run START-SERVER.bat · changes save locally only");
    }else{
      showToast("Not synced with server — please log out and sign in again.");
    }
  }catch(_e){
    showToast("Open /admin/ with START-SERVER.bat running on this PC");
  }
}

function countProductsInCategory(catId){
  const catalog = getCatalog();
  return (catalog.products || []).filter(p=> Number(p.categoryId) === Number(catId)).length;
}

function updateProdBreadcrumb(){
  const bc = el("prodBreadcrumb");
  if(!bc) return;
  if(productsView === "catalogues") bc.textContent = "Catalogues";
  else if(productsView === "category") bc.textContent = `Catalogues / ${categoryNameById(selectedCategoryId)}`;
  else if(productsView === "catalogue-form") bc.textContent = editingCatalogueId ? "Edit catalogue" : "New catalogue";
  else if(productsView === "product-form"){
    const editing = el("productId")?.value;
    bc.textContent = `Catalogues / ${categoryNameById(selectedCategoryId)} / ${editing ? "Edit" : "New"} product`;
  }
}

function showProductsView(view){
  productsView = view;
  const views = {
    catalogues: el("prodViewCatalogues"),
    category: el("prodViewCategory"),
    "catalogue-form": el("prodViewCatalogueForm"),
    "product-form": el("prodViewProductForm")
  };
  Object.entries(views).forEach(([key, node])=>{
    if(node) node.style.display = key === view ? "block" : "none";
  });
  const search = el("prodSearchInput");
  if(search){
    search.style.display = (view === "catalogues" || view === "category") ? "block" : "none";
    search.placeholder = view === "category" ? "Search products…" : "Search catalogues…";
    search.value = "";
  }
  updateProdBreadcrumb();
  if(view === "catalogues") renderCataloguesGrid();
  else if(view === "category") renderCategoryProducts();
}

function productsNavigateBack(){
  if(productsView === "product-form"){
    showProductsView("category");
    return true;
  }
  if(productsView === "catalogue-form"){
    showProductsView("catalogues");
    return true;
  }
  if(productsView === "category"){
    showProductsView("catalogues");
    return true;
  }
  return false;
}

async function persistCategories(cleaned){
  const list = cleaned || categoriesDraft;
  if(!list.length){ showToast("At least one catalogue required"); return false; }
  const usedIds = new Set();
  let nextId = 1;
  const finalList = list.map((c, idx)=>{
    let id = parseInt(c.id, 10);
    if(!id || usedIds.has(id)){
      while(usedIds.has(nextId)) nextId++;
      id = nextId;
      nextId++;
    }
    usedIds.add(id);
    return {
      id,
      name: String(c.name || `Catalogue ${idx + 1}`).trim() || `Catalogue ${idx + 1}`,
      nameEn: String(c.nameEn || "").trim(),
      nameFr: String(c.nameFr || "").trim(),
      image: String(c.image || "").trim()
    };
  });
  categoriesDraft = finalList;
  const settings = {...getSettings(), catalogCategories: finalList};
  const categoryImages = {};
  finalList.forEach(c=>{ if(c.image) categoryImages[c.id] = c.image; });
  settings.categoryImages = categoryImages;
  setSettings(settings);
  const cat = getCatalog();
  setCatalog(catalogFromProducts(cat.products || [], finalList));
  if(canUseServer()){
    try{
      await ARStoreSync.saveSettings(settings);
      showToast("Catalogue saved & synced");
    }catch(e){
      showToast(e.status === 401
        ? "Catalogue saved locally — logout & login again"
        : "Catalogue saved locally — " + (e.message || "sync failed"));
    }
  }
  return true;
}

function renderCataloguesGrid(){
  const grid = el("cataloguesGrid");
  const empty = el("cataloguesEmpty");
  if(!grid) return;
  syncCategoriesDraftFromSettings();
  const q = String(el("prodSearchInput")?.value || "").trim().toLowerCase();
  const defs = categoriesDraft.filter(c=> !q || String(c.name||"").toLowerCase().includes(q));
  if(!defs.length){
    if(empty) empty.style.display = "block";
    grid.innerHTML = "";
    return;
  }
  if(empty) empty.style.display = "none";
  grid.innerHTML = defs.map(c=>{
    const count = countProductsInCategory(c.id);
    return `
    <article class="zara-card" data-cat-id="${c.id}">
      <div class="zara-card-media" data-open-cat="${c.id}">
        ${c.image ? `<img src="${escapeHtml(c.image)}" alt="${escapeHtml(c.name)}">` : `<div class="no-img">No cover</div>`}
      </div>
      <div class="zara-card-foot">
        <div class="zara-card-name">${escapeHtml(c.name)}</div>
        <div class="zara-card-meta">${count} product${count === 1 ? "" : "s"}</div>
      </div>
      <div class="zara-card-actions">
        <button class="btn secondary small" type="button" data-edit-cat="${c.id}">Edit</button>
        <button class="btn danger small" type="button" data-del-cat="${c.id}">Delete</button>
      </div>
    </article>`;
  }).join("");

  grid.querySelectorAll("[data-open-cat]").forEach(node=>{
    node.addEventListener("click", (e)=>{
      if(e.target.closest("[data-edit-cat],[data-del-cat]")) return;
      const id = parseInt(node.getAttribute("data-open-cat"), 10);
      openCategoryProducts(id);
    });
  });
  grid.querySelectorAll("[data-edit-cat]").forEach(btn=>{
    btn.addEventListener("click", (e)=>{
      e.stopPropagation();
      openCatalogueForm(parseInt(btn.getAttribute("data-edit-cat"), 10));
    });
  });
  grid.querySelectorAll("[data-del-cat]").forEach(btn=>{
    btn.addEventListener("click", async (e)=>{
      e.stopPropagation();
      const id = parseInt(btn.getAttribute("data-del-cat"), 10);
      await deleteCatalogue(id);
    });
  });
}

function openCategoryProducts(catId){
  selectedCategoryId = catId;
  showProductsView("category");
  const title = el("prodCategoryTitle");
  const sub = el("prodCategorySub");
  if(title) title.textContent = categoryNameById(catId);
  if(sub) sub.textContent = `${countProductsInCategory(catId)} products · visible on storefront`;
}

function renderCategoryProducts(){
  const grid = el("categoryProductsGrid");
  const empty = el("categoryProductsEmpty");
  if(!grid || !selectedCategoryId) return;
  const q = String(el("prodSearchInput")?.value || "").trim().toLowerCase();
  const catalog = getCatalog();
  const products = (catalog.products || []).filter(p=>
    Number(p.categoryId) === Number(selectedCategoryId) &&
    (!q || byText(q, p.name, p.price, p.id))
  );
  if(!products.length){
    if(empty) empty.style.display = "block";
    grid.innerHTML = "";
    return;
  }
  if(empty) empty.style.display = "none";
  grid.innerHTML = products.map(p=>{
    const imgCount = Array.isArray(p.images) ? p.images.length : (p.img ? 1 : 0);
    return `
    <article class="zara-card" data-pid="${escapeHtml(p.id)}">
      <div class="zara-card-media" data-edit-prod="${escapeHtml(p.id)}">
        ${p.img ? `<img src="${escapeHtml(p.img)}" alt="${escapeHtml(p.name||"")}">` : `<div class="no-img">No photo</div>`}
        ${imgCount > 1 ? `<span class="img-count">${imgCount}</span>` : ""}
      </div>
      <div class="zara-card-foot">
        <div class="zara-card-name">${escapeHtml(p.name||"—")}</div>
        <div class="zara-card-meta">${formatMoney(p.price)} MAD · cost ${formatMoney(p.costPrice||0)}${p.stockMax > 0 ? ` · stock ${p.stockMax}` : ""}${p.videoUrl ? " · video" : ""}</div>
      </div>
      <div class="zara-card-actions">
        <button class="btn secondary small" type="button" data-edit-prod-btn="${escapeHtml(p.id)}">Edit</button>
        <button class="btn danger small" type="button" data-del-prod="${escapeHtml(p.id)}">Delete</button>
      </div>
    </article>`;
  }).join("");

  const openEditor = (id)=> openProductForm(id);
  grid.querySelectorAll("[data-edit-prod]").forEach(node=>{
    node.addEventListener("click", ()=> openEditor(node.getAttribute("data-edit-prod")));
  });
  grid.querySelectorAll("[data-edit-prod-btn]").forEach(btn=>{
    btn.addEventListener("click", (e)=>{
      e.stopPropagation();
      openEditor(btn.getAttribute("data-edit-prod-btn"));
    });
  });
  grid.querySelectorAll("[data-del-prod]").forEach(btn=>{
    btn.addEventListener("click", async (e)=>{
      e.stopPropagation();
      const id = btn.getAttribute("data-del-prod");
      if(!id || !confirm("Delete this product?")) return;
      try{
        await deleteProductWithSync(id);
        renderCategoryProducts();
        renderCataloguesGrid();
        renderOverview();
        showToast("Product deleted");
      }catch(_e){
        showToast("Delete failed");
      }
    });
  });
}

function setCatalogueFormPreview(src){
  const wrap = el("catalogueFormPreview");
  if(!wrap) return;
  wrap.innerHTML = src ? `<img src="${escapeHtml(src)}" alt="Cover">` : `<span class="cover-placeholder">Cover image</span>`;
}

function openCatalogueForm(catId){
  syncCategoriesDraftFromSettings();
  editingCatalogueId = catId || null;
  catalogueFormImage = "";
  const existing = catId ? categoriesDraft.find(c=> c.id === catId) : null;
  if(el("catalogueFormTitle")) el("catalogueFormTitle").textContent = existing ? "Edit Catalogue" : "Add Catalogue";
  if(el("catalogueFormName")) el("catalogueFormName").value = existing?.name || "";
  if(el("catalogueFormNameEn")) el("catalogueFormNameEn").value = existing?.nameEn || "";
  if(el("catalogueFormNameFr")) el("catalogueFormNameFr").value = existing?.nameFr || "";
  if(el("catalogueFormImageUrl")) el("catalogueFormImageUrl").value = existing?.image || "";
  catalogueFormImage = existing?.image || "";
  setCatalogueFormPreview(catalogueFormImage);
  if(el("catalogueFormDelete")) el("catalogueFormDelete").style.display = existing ? "inline-flex" : "none";
  showProductsView("catalogue-form");
}

async function deleteCatalogue(catId){
  syncCategoriesDraftFromSettings();
  const cat = categoriesDraft.find(c=> c.id === catId);
  if(!cat) return;
  if(categoriesDraft.length <= 1){ showToast("Keep at least one catalogue"); return; }
  if(!confirm(`Delete catalogue "${cat.name}"? Products will move to another catalogue.`)) return;
  const fallback = categoriesDraft.find(c=> c.id !== catId);
  const catalog = getCatalog();
  const products = (catalog.products || []).map(p=>{
    if(Number(p.categoryId) === Number(catId)) return {...p, categoryId: fallback.id};
    return p;
  });
  categoriesDraft = categoriesDraft.filter(c=> c.id !== catId);
  if(await persistCategories()){
    setCatalog(catalogFromProducts(products, categoriesDraft));
    showToast("Catalogue deleted");
    showProductsView("catalogues");
    renderOverview();
  }
}

async function deleteProductWithSync(id){
  await deleteProductLocal(id);
  if(canUseServer()){
    try{
      await ARStoreSync.deleteProduct(id);
    }catch(e){
      showToast("Removed locally — " + (e.message || "server sync failed"));
    }
  }
}

function openProductForm(productId){
  syncCategoriesDraftFromSettings();
  const isEdit = Boolean(productId);
  if(el("productFormTitle")) el("productFormTitle").textContent = isEdit ? "Edit Product" : "Add Product";
  if(el("productDeleteBtn")) el("productDeleteBtn").style.display = isEdit ? "inline-flex" : "none";
  if(isEdit) loadProductIntoForm(productId);
  else{
    resetProductForm();
    const catId = Math.max(1, parseInt(selectedCategoryId, 10) || categoriesDraft[0]?.id || 1);
    selectedCategoryId = catId;
    if(el("productCategory")) el("productCategory").value = String(catId);
  }
  showProductsView("product-form");
}

function renderProductsPage(){
  const slideshow = el("productCardSlideshow");
  if(slideshow){
    const s = getSettings();
    slideshow.checked = s.productCardSlideshow === true || s.productCardSlideshow === "true";
  }
  if(productsView === "catalogues") renderCataloguesGrid();
  else if(productsView === "category") renderCategoryProducts();
  updateProdBreadcrumb();
}

function renderProducts(){
  renderProductsPage();
}

function getFinance(){
  const f = readLS(KEYS.finance, null);
  if(!f || typeof f !== "object"){
    return {
      expenses: [], // {id, amount, type, note, createdAt}
      refunds: [],  // {id, amount, note, createdAt}
      ads: [],      // {id, revenue, expense, campaign, createdAt}
      payments: []  // optional overrides: {id, method, amount, createdAt}
    };
  }
  return {
    expenses: Array.isArray(f.expenses) ? f.expenses : [],
    refunds: Array.isArray(f.refunds) ? f.refunds : [],
    ads: Array.isArray(f.ads) ? f.ads : [],
    payments: Array.isArray(f.payments) ? f.payments : []
  };
}

function setFinance(fin){
  const next = {
    expenses: Array.isArray(fin?.expenses) ? fin.expenses : [],
    refunds: Array.isArray(fin?.refunds) ? fin.refunds : [],
    ads: Array.isArray(fin?.ads) ? fin.ads : [],
    payments: Array.isArray(fin?.payments) ? fin.payments : []
  };
  writeLS(KEYS.finance, next);
  return next;
}

function uid(prefix){
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2,8)}`;
}

function getReviews(){
  const raw = readLS(KEYS.reviews, {});
  return raw && typeof raw === "object" ? raw : {};
}
async function setReviews(map){
  const next = map && typeof map === "object" ? map : {};
  writeLS(KEYS.reviews, next);
  if(canUseServer() && window.ARStoreSync){
    try{
      await ARStoreSync.saveReviews(next);
    }catch(e){
      console.warn("Reviews sync failed:", e.message);
    }
  }
}

function computeKPIs(){
  const orders = getOrders();
  const customers = getCustomers();
  const catalog = getCatalog();
  const revenue = orders.reduce((sum,o)=> sum + Number(o?.revenue || 0), 0);
  return {
    totalOrders: orders.length,
    totalUsers: customers.length,
    totalProducts: (catalog.products || []).length,
    revenue: Math.round(revenue)
  };
}

function startOfDay(ts){
  const d = new Date(ts);
  d.setHours(0,0,0,0);
  return d.getTime();
}

function endOfDay(ts){
  const d = new Date(ts);
  d.setHours(23,59,59,999);
  return d.getTime();
}

function clampRange(fromTs, toTs){
  const a = Number(fromTs), b = Number(toTs);
  if(!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return {from: Math.min(a,b), to: Math.max(a,b)};
}

function getRangePreset(preset){
  const now = Date.now();
  const todayStart = startOfDay(now);
  if(preset === "today") return {from: todayStart, to: endOfDay(now)};
  if(preset === "7d") return {from: startOfDay(now - 6*86400000), to: endOfDay(now)};
  if(preset === "month"){
    const d = new Date(now);
    d.setDate(1); d.setHours(0,0,0,0);
    return {from: d.getTime(), to: endOfDay(now)};
  }
  if(preset === "year"){
    const d = new Date(now);
    d.setMonth(0,1); d.setHours(0,0,0,0);
    return {from: d.getTime(), to: endOfDay(now)};
  }
  return {from: startOfDay(now - 6*86400000), to: endOfDay(now)};
}

function inRange(ts, range){
  const t = Number(ts || 0);
  return t >= range.from && t <= range.to;
}

function normalizeStatus(s){
  const st = String(s || "").toLowerCase().trim();
  if(st === "in_delivery") return "shipped"; // storefront uses in_delivery; admin uses shipped
  return st || "pending";
}

function getOrderPaymentMethod(o){
  // Best-effort: if present use it; else infer from channel
  const m = String(o?.paymentMethod || "").toLowerCase().trim();
  if(m) return m;
  const ch = String(o?.channel || "").toLowerCase().trim();
  if(ch.includes("cash")) return "cash";
  if(ch.includes("card")) return "card";
  if(ch.includes("online") || ch.includes("paypal") || ch.includes("stripe")) return "online";
  if(ch.includes("whatsapp") || ch.includes("gmail") || ch.includes("cart")) return "online";
  return "online";
}

function computeAnalytics(range){
  const ordersAll = getOrders();
  const orders = ordersAll.filter(o=> inRange(o?.createdAt || 0, range));
  const finance = getFinance();

  const revenue = orders.reduce((sum,o)=> sum + (Number(o?.revenue || 0) || 0), 0);
  const refunds = (finance.refunds||[]).filter(r=> inRange(r?.createdAt || 0, range)).reduce((sum,r)=> sum + (Number(r?.amount||0)||0), 0);
  const expenses = (finance.expenses||[]).filter(e=> inRange(e?.createdAt || 0, range)).reduce((sum,e)=> sum + (Number(e?.amount||0)||0), 0);
  const adRevenue = (finance.ads||[]).filter(a=> inRange(a?.createdAt || 0, range)).reduce((sum,a)=> sum + (Number(a?.revenue||0)||0), 0);
  const adExpense = (finance.ads||[]).filter(a=> inRange(a?.createdAt || 0, range)).reduce((sum,a)=> sum + (Number(a?.expense||0)||0), 0);

  // Profit uses product cost if available
  const catalog = getCatalog();
  const costByName = new Map((catalog.products||[]).map(p=> [String(p?.name||"").toLowerCase(), Number(p?.costPrice || p?.cost || 0) || 0]));
  const productAgg = new Map(); // name -> {name, sell, cost, qty, revenue, profit}

  let profit = 0;
  orders.forEach(o=>{
    const items = Array.isArray(o?.items) ? o.items : [];
    items.forEach(it=>{
      const name = String(it?.name || o?.product?.name || "—");
      const key = name.toLowerCase();
      const qty = Math.max(1, parseInt(it?.qty,10) || 1);
      const sell = Number(it?.price ?? o?.product?.price ?? 0) || 0;
      const cost = Number(it?.costPrice ?? it?.cost ?? costByName.get(key) ?? 0) || 0;
      const per = sell - cost;
      const p = per * qty;
      profit += p;
      const cur = productAgg.get(key) || {name, sell, cost, qty:0, revenue:0, profit:0};
      cur.sell = sell || cur.sell;
      cur.cost = cost || cur.cost;
      cur.qty += qty;
      cur.revenue += sell * qty;
      cur.profit += p;
      productAgg.set(key, cur);
    });
  });

  const losses = refunds + adExpense + expenses;
  const netProfit = revenue + adRevenue - (expenses + refunds + adExpense);

  const statusCounts = orders.reduce((acc,o)=>{
    const st = normalizeStatus(o?.status);
    acc[st] = (acc[st]||0) + 1;
    return acc;
  }, {});

  const payment = orders.reduce((acc,o)=>{
    const method = getOrderPaymentMethod(o);
    acc[method] = (acc[method]||0) + (Number(o?.revenue||0)||0);
    return acc;
  }, {cash:0, card:0, online:0});

  // Build timeseries (daily)
  const buckets = new Map(); // dayTs -> {dayTs, revenue, profit, expenses}
  const addBucket = (ts)=>{
    const day = startOfDay(ts);
    if(!buckets.has(day)) buckets.set(day, {dayTs:day, revenue:0, profit:0, expenses:0});
    return buckets.get(day);
  };
  orders.forEach(o=>{
    const b = addBucket(o?.createdAt || Date.now());
    b.revenue += (Number(o?.revenue||0)||0);
  });
  // allocate profit by order day (approx) using computed profit share
  orders.forEach(o=>{
    const items = Array.isArray(o?.items) ? o.items : [];
    const dayBucket = addBucket(o?.createdAt || Date.now());
    items.forEach(it=>{
      const name = String(it?.name || o?.product?.name || "—");
      const qty = Math.max(1, parseInt(it?.qty,10) || 1);
      const sell = Number(it?.price ?? o?.product?.price ?? 0) || 0;
      const cost = Number(it?.costPrice ?? it?.cost ?? costByName.get(name.toLowerCase()) ?? 0) || 0;
      dayBucket.profit += (sell - cost) * qty;
    });
  });
  (finance.expenses||[]).filter(e=> inRange(e?.createdAt || 0, range)).forEach(e=>{
    const b = addBucket(e?.createdAt || Date.now());
    b.expenses += (Number(e?.amount||0)||0);
  });

  const series = Array.from(buckets.values()).sort((a,b)=>a.dayTs-b.dayTs);

  return {
    range,
    orders,
    revenue,
    profit,
    refunds,
    expenses,
    losses,
    netProfit,
    totalOrders: orders.length,
    statusCounts,
    adRevenue,
    adExpense,
    adNet: adRevenue - adExpense,
    payment,
    products: Array.from(productAgg.values()),
    series
  };
}

function computePrevRange(range){
  const span = range.to - range.from;
  const prevTo = range.from - 1;
  const prevFrom = prevTo - span;
  return {from: prevFrom, to: prevTo};
}

function pctChange(cur, prev){
  const a = Number(cur||0), b = Number(prev||0);
  if(!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  if(b === 0) return a === 0 ? 0 : 100;
  return ((a - b) / Math.abs(b)) * 100;
}

function iconForKpi(key){
  const map = {
    revenue:"💳",
    profit:"💰",
    losses:"📉",
    net:"🧾",
    orders:"📦",
    refunds:"↩️"
  };
  return map[key] || "•";
}

function renderKpiCards(cur, prev){
  const root = el("analyticsKpis");
  if(!root) return;
  const cards = [
    {key:"revenue", label:"Total Revenue", value:cur.revenue, prev:prev.revenue},
    {key:"profit", label:"Total Profit", value:cur.profit, prev:prev.profit},
    {key:"losses", label:"Total Losses", value:cur.losses, prev:prev.losses},
    {key:"net", label:"Net Profit", value:cur.netProfit, prev:prev.netProfit},
    {key:"orders", label:"Total Orders", value:cur.totalOrders, prev:prev.totalOrders},
    {key:"refunds", label:"Refunds", value:cur.refunds, prev:prev.refunds}
  ];
  root.innerHTML = cards.map(c=>{
    const p = pctChange(c.value, c.prev);
    const up = p >= 0;
    const cls = up ? "trend-up" : "trend-down";
    const arrow = up ? "▲" : "▼";
    return `
      <div class="kpi-card">
        <div class="kpi-icon" aria-hidden="true">${iconForKpi(c.key)}</div>
        <div class="kpi-label">${c.label}</div>
        <div class="kpi-value">${formatMoney(c.value)}${c.key==="orders" ? "" : " MAD"}</div>
        <div class="kpi-trend ${cls}">${arrow} ${Math.abs(p).toFixed(1)}% vs previous</div>
      </div>
    `;
  }).join("");
}

function svgLineChart(containerId, points, opts){
  const wrap = el(containerId);
  if(!wrap) return;
  const w = 600, h = 220, pad = 28;
  const xs = points.map(p=>p.x);
  const ys = points.map(p=>p.y);
  const minX = Math.min(...xs, 0), maxX = Math.max(...xs, 1);
  const minY = Math.min(...ys, 0), maxY = Math.max(...ys, 1);
  const sx = (x)=> pad + ((x - minX) / (maxX - minX || 1)) * (w - pad*2);
  const sy = (y)=> (h - pad) - ((y - minY) / (maxY - minY || 1)) * (h - pad*2);
  const d = points.map((p,i)=> `${i===0?"M":"L"} ${sx(p.x).toFixed(2)} ${sy(p.y).toFixed(2)}`).join(" ");
  wrap.innerHTML = `
    <div class="chart-tooltip" style="display:none;" id="${containerId}-tt"></div>
    <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="${escapeHtml(opts?.label||"chart")}">
      <defs>
        <linearGradient id="${containerId}-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="rgba(201,162,39,0.45)"></stop>
          <stop offset="100%" stop-color="rgba(201,162,39,0.00)"></stop>
        </linearGradient>
      </defs>
      <path d="${d} L ${sx(points[points.length-1]?.x||0)} ${h-pad} L ${sx(points[0]?.x||0)} ${h-pad} Z" fill="url(#${containerId}-grad)"></path>
      <path d="${d}" fill="none" stroke="rgba(232,212,139,0.95)" stroke-width="2.5"></path>
      ${points.map(p=> `<circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="3.5" fill="rgba(201,162,39,0.9)"></circle>`).join("")}
      <rect x="0" y="0" width="${w}" height="${h}" fill="transparent"></rect>
    </svg>
  `;
}

function svgBarChart(containerId, bars, opts){
  const wrap = el(containerId);
  if(!wrap) return;
  const w = 600, h = 220, pad = 28;
  const max = Math.max(...bars.map(b=>b.value), 1);
  const bw = (w - pad*2) / Math.max(1, bars.length);
  wrap.innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="${escapeHtml(opts?.label||"chart")}">
      ${bars.map((b,i)=>{
        const x = pad + i*bw + bw*0.18;
        const barW = bw*0.64;
        const barH = ((b.value||0)/max) * (h-pad*2);
        const y = (h-pad) - barH;
        return `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="10" fill="${b.color}"></rect>`;
      }).join("")}
    </svg>
  `;
}

function svgPieChart(containerId, slices, opts){
  const wrap = el(containerId);
  if(!wrap) return;
  const w = 240, h = 220, cx = 120, cy = 110, r = 78;
  const total = slices.reduce((s,a)=> s + (a.value||0), 0) || 1;
  let acc = -Math.PI/2;
  const arc = (a0,a1)=>{
    const x0 = cx + r*Math.cos(a0), y0 = cy + r*Math.sin(a0);
    const x1 = cx + r*Math.cos(a1), y1 = cy + r*Math.sin(a1);
    const large = (a1-a0) > Math.PI ? 1 : 0;
    return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
  };
  const paths = slices.map(s=>{
    const a = (s.value||0)/total * Math.PI*2;
    const p = arc(acc, acc+a);
    acc += a;
    return `<path d="${p}" fill="${s.color}"></path>`;
  }).join("");
  wrap.innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${escapeHtml(opts?.label||"chart")}">
      ${paths}
      <circle cx="${cx}" cy="${cy}" r="${r*0.58}" fill="rgba(0,0,0,0.14)"></circle>
    </svg>
  `;
}

function renderProfitProductsTable(analytics){
  const table = el("profitProductsTable");
  const empty = el("profitProductsEmpty");
  if(!table || !empty) return;
  const q = String(el("profitProductSearch")?.value || "").trim().toLowerCase();
  const sort = String(el("profitProductSort")?.value || "best_selling");
  const rows = (analytics.products||[]).filter(p=> !q || String(p.name||"").toLowerCase().includes(q));
  const sorted = rows.sort((a,b)=>{
    if(sort === "best_selling") return (b.qty||0) - (a.qty||0);
    if(sort === "least_profitable") return (a.profit||0) - (b.profit||0);
    return (b.profit||0) - (a.profit||0);
  });
  if(!sorted.length){
    empty.style.display = "block";
    table.innerHTML = "";
    return;
  }
  empty.style.display = "none";
  table.innerHTML = `
    <div class="row header" style="grid-template-columns:1.2fr 0.8fr 0.8fr 0.7fr 0.8fr 0.8fr;">
      <div class="cell">Product</div>
      <div class="cell">Selling</div>
      <div class="cell">Cost</div>
      <div class="cell">Qty</div>
      <div class="cell">Total profit</div>
      <div class="cell">Profit %</div>
    </div>
    ${sorted.slice(0, 30).map(p=>{
      const sell = Number(p.sell||0)||0;
      const cost = Number(p.cost||0)||0;
      const qty = Number(p.qty||0)||0;
      const per = sell - cost;
      const totalProfit = per * qty;
      const pct = cost > 0 ? ((sell - cost)/cost)*100 : 0;
      return `
        <div class="row" style="grid-template-columns:1.2fr 0.8fr 0.8fr 0.7fr 0.8fr 0.8fr;">
          <div class="cell" style="font-weight:900;">${escapeHtml(p.name||"—")}</div>
          <div class="cell"><span class="tag">${formatMoney(sell)} MAD</span></div>
          <div class="cell"><span class="tag">${formatMoney(cost)} MAD</span></div>
          <div class="cell"><span class="tag">${formatMoney(qty)}</span></div>
          <div class="cell"><span class="tag">${formatMoney(totalProfit)} MAD</span></div>
          <div class="cell"><span class="tag">${pct.toFixed(1)}%</span></div>
        </div>
      `;
    }).join("")}
  `;
}

let currentSettingsTab = "store";
let currentAnalyticsRange = getRangePreset("7d");
let adminPageHistory = [];
let settingsTabHistory = [];

function showToast(msg){
  const t = el("adminToast");
  if(!t) return;
  t.textContent = String(msg || "");
  t.classList.add("show");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(()=> t.classList.remove("show"), 3200);
}

async function getAdminCredentials(){
  const stored = readLS(KEYS.adminCreds, null);
  if(stored?.username && stored?.passwordHash){
    return { username: String(stored.username), passwordHash: String(stored.passwordHash) };
  }
  return { username: DEFAULT_ADMIN_USERNAME, passwordHash: await sha256(DEFAULT_ADMIN_PASSWORD) };
}

function usernameMatchesAdmin(username, creds){
  const u = String(username || "").trim();
  const lower = u.toLowerCase();
  return (
    u === DEFAULT_ADMIN_USERNAME ||
    u === "MondirAR" ||
    lower === "admin@arstore.local" ||
    u === creds.username ||
    lower === String(creds.username || "").trim().toLowerCase()
  );
}

async function verifyLocalAdminLogin(username, pass){
  const creds = await getAdminCredentials();
  if(!usernameMatchesAdmin(username, creds)) return false;
  const hash = await sha256(pass);
  return hash === creds.passwordHash;
}

async function verifyAdminLogin(username, pass){
  if(window.ARStoreSync){
    try{
      await ARStoreSync.loginAdmin(username, pass);
      return true;
    }catch(_e){
      /* try local credentials (offline / changed local password) */
    }
  }
  return verifyLocalAdminLogin(username, pass);
}

async function updateAdminCredentials(username, newPass){
  const creds = await getAdminCredentials();
  const next = {
    username: String(username || creds.username).trim() || creds.username,
    passwordHash: newPass ? await sha256(newPass) : creds.passwordHash,
    updatedAt: Date.now()
  };
  writeLS(KEYS.adminCreds, next);
  return next;
}

function setSettingsTab(tab, options = {}){
  const { fromBack = false } = options;
  if(!fromBack && currentSettingsTab && currentSettingsTab !== tab){
    settingsTabHistory.push(currentSettingsTab);
  }
  currentSettingsTab = tab;
  document.querySelectorAll("[data-settings-tab]").forEach(b=>{
    const active = b.getAttribute("data-settings-tab") === tab;
    b.classList.toggle("active", active);
    b.setAttribute("aria-selected", active ? "true" : "false");
  });
  document.querySelectorAll("[data-settings-panel]").forEach(p=>{
    p.classList.toggle("active", p.getAttribute("data-settings-panel") === tab);
  });
  updateAdminBackBtn(document.querySelector(".nav-item.active")?.dataset?.page || "settings");
  const subs = {
    store: "Name, footer and branding",
    contact: "WhatsApp, email, Instagram",
    site: "Backgrounds and category images",
    admin: "Login credentials and security"
  };
  if(document.querySelector(".nav-item.active")?.dataset?.page === "settings"){
    el("pageSubtitle").textContent = subs[tab] || "Full site control";
  }
}

function renderProfitsAndAnalytics(){
  const cur = computeAnalytics(currentAnalyticsRange);
  const prev = computeAnalytics(computePrevRange(currentAnalyticsRange));
  renderKpiCards(cur, prev);

  // charts
  const pts = (cur.series||[]).map((d,i)=>({x:i, y: Number(d.profit||0)||0, label:new Date(d.dayTs).toLocaleDateString()}));
  const growth = (cur.series||[]).map((d,i)=>({x:i, y: Number(d.revenue||0)||0, label:new Date(d.dayTs).toLocaleDateString()}));
  svgLineChart("chartProfitLine", pts.length?pts:[{x:0,y:0}], {label:"Profit over time"});
  svgLineChart("chartGrowthArea", growth.length?growth:[{x:0,y:0}], {label:"Growth trend"});

  svgBarChart("chartRevVsExp", [
    {label:"Revenue", value:cur.revenue, color:"rgba(201,162,39,0.85)"},
    {label:"Expenses", value:(cur.expenses + cur.adExpense + cur.refunds), color:"rgba(239,68,68,0.80)"}
  ], {label:"Revenue vs expenses"});

  const dist = [
    {label:"Orders", value:cur.revenue, color:"rgba(201,162,39,0.85)"},
    {label:"Ads", value:cur.adRevenue, color:"rgba(34,197,94,0.80)"}
  ];
  svgPieChart("chartRevenueDist", dist, {label:"Revenue distribution"});

  // losses breakdown
  svgPieChart("chartLossBreakdown", [
    {label:"Refunds", value:cur.refunds, color:"rgba(245,158,11,0.85)"},
    {label:"Ad spend", value:cur.adExpense, color:"rgba(201,162,39,0.65)"},
    {label:"Ops expenses", value:cur.expenses, color:"rgba(239,68,68,0.80)"}
  ], {label:"Loss breakdown"});

  // payments breakdown
  svgPieChart("chartPaymentBreakdown", [
    {label:"Cash", value:cur.payment.cash||0, color:"rgba(201,162,39,0.85)"},
    {label:"Card", value:cur.payment.card||0, color:"rgba(232,212,139,0.75)"},
    {label:"Online", value:cur.payment.online||0, color:"rgba(34,197,94,0.80)"}
  ], {label:"Payment breakdown"});

  // meta cards
  const adsMeta = el("adsMeta");
  const lossMeta = el("lossMeta");
  if(adsMeta){
    adsMeta.innerHTML = `
      Ad revenue: <strong>${formatMoney(cur.adRevenue)} MAD</strong><br/>
      Ad expenses: <strong>${formatMoney(cur.adExpense)} MAD</strong><br/>
      Net ad profit: <strong>${formatMoney(cur.adNet)} MAD</strong>
    `;
  }
  if(lossMeta){
    lossMeta.innerHTML = `
      Refunds: <strong>${formatMoney(cur.refunds)} MAD</strong><br/>
      Operational expenses: <strong>${formatMoney(cur.expenses)} MAD</strong><br/>
      Total losses: <strong>${formatMoney(cur.losses)} MAD</strong>
    `;
  }

  renderProfitProductsTable(cur);
}

function aiRiskLevel(cur, prev){
  const p = pctChange(cur.netProfit, prev.netProfit);
  const lossP = pctChange(cur.losses, prev.losses);
  if(p < -20 || lossP > 25) return "High";
  if(p < -8 || lossP > 12) return "Medium";
  return "Low";
}

function renderAI(){
  const cur = computeAnalytics(currentAnalyticsRange);
  const prev = computeAnalytics(computePrevRange(currentAnalyticsRange));

  const risk = aiRiskLevel(cur, prev);
  const summary = el("aiSummary");
  const riskEl = el("aiRisk");
  const alertsEl = el("aiAlerts");
  const insightsEl = el("aiInsights");
  if(summary){
    summary.innerHTML = `
      <div><strong>Daily summary:</strong> Revenue ${formatMoney(cur.revenue)} MAD, Net ${formatMoney(cur.netProfit)} MAD, Orders ${formatMoney(cur.totalOrders)}.</div>
      <div style="margin-top:8px;"><strong>Weekly insight:</strong> Profit change ${pctChange(cur.netProfit, prev.netProfit).toFixed(1)}% vs previous period.</div>
    `;
  }
  if(riskEl){
    const color = risk==="High" ? "rgba(239,68,68,0.18)" : risk==="Medium" ? "rgba(245,158,11,0.18)" : "rgba(34,197,94,0.18)";
    riskEl.style.background = color;
    riskEl.innerHTML = `Risk level: <strong>${risk}</strong>`;
  }
  if(alertsEl){
    const alerts = [];
    const netDrop = pctChange(cur.netProfit, prev.netProfit);
    if(netDrop < -25) alerts.push({type:"warn", text:`⚠️ Profit dropped ${Math.abs(netDrop).toFixed(1)}%`});
    const lossUp = pctChange(cur.losses, prev.losses);
    if(lossUp > 25) alerts.push({type:"warn", text:`⚠️ Losses increased ${lossUp.toFixed(1)}%`});
    const topLossProduct = (cur.products||[]).slice().sort((a,b)=> (a.profit||0) - (b.profit||0))[0];
    if(topLossProduct && (topLossProduct.profit||0) < 0){
      alerts.push({type:"info", text:`💡 ${topLossProduct.name} is not profitable in this range.`});
    }
    if(!alerts.length) alerts.push({type:"info", text:"💡 No unusual activity detected."});
    alertsEl.innerHTML = alerts.map(a=> `<div class="ai-alert ${a.type}">${escapeHtml(a.text)}</div>`).join("");
  }

  if(insightsEl){
    const insights = [];
    const best = (cur.products||[]).slice().sort((a,b)=> (b.qty||0)-(a.qty||0))[0];
    if(best){
      insights.push({
        title:`Increase price for high-demand product: ${best.name}`,
        meta:`Demand is strong (sold ${best.qty}). Consider +5% price to improve margin.`,
        action:{type:"raise_price", name:best.name, pct:5}
      });
    }
    const low = (cur.products||[]).slice().sort((a,b)=> (a.profit||0)-(b.profit||0))[0];
    if(low){
      insights.push({
        title:`Review low-profit product: ${low.name}`,
        meta:`Total profit ${formatMoney(low.profit)} MAD. Add/verify cost price and consider pricing.`,
        action:{type:"open_products"}
      });
    }
    insights.push({
      title:"Reduce expenses if net profit is trending down",
      meta:"Track operational + ad expenses and cap spend on low-performing campaigns.",
      action:{type:"add_expense"}
    });
    insightsEl.innerHTML = insights.map((i, idx)=>{
      return `
        <div class="ai-insight">
          <div class="title">${escapeHtml(i.title)}</div>
          <div class="meta">${escapeHtml(i.meta)}</div>
          <div class="actions" style="margin-top:10px;">
            <button class="btn secondary small" type="button" data-ai-apply="${idx}">Apply suggestion</button>
          </div>
        </div>
      `;
    }).join("");

    insightsEl.querySelectorAll("[data-ai-apply]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const idx = parseInt(btn.getAttribute("data-ai-apply")||"-1", 10);
        const item = insights[idx];
        if(!item) return;
        if(!confirm("Apply this suggestion?")) return;
        applyAISuggestion(item);
      });
    });
  }
}

function applyAISuggestion(s){
  if(s?.action?.type === "raise_price"){
    const pct = Number(s.action.pct||0)||0;
    const name = String(s.action.name||"").toLowerCase();
    const cat = getCatalog();
    const next = (cat.products||[]).map(p=>{
      if(String(p?.name||"").toLowerCase() !== name) return p;
      const price = Number(p.price||0)||0;
      const newPrice = Math.max(0, Math.round(price * (1 + pct/100)));
      return {...p, price:newPrice};
    });
    setCatalog(catalogFromProducts(next));
    renderProducts();
    renderOverview();
    renderProfitsAndAnalytics();
    renderAI();
    return;
  }
  if(s?.action?.type === "open_products"){
    setActivePage("products");
    refreshPage("products");
    return;
  }
  if(s?.action?.type === "add_expense"){
    addExpensePrompt();
    return;
  }
}

function addExpensePrompt(){
  const amount = Number(prompt("Expense amount (MAD):", "0")||0) || 0;
  if(amount <= 0) return;
  const note = String(prompt("Expense note:", "Operational expense")||"").trim();
  const fin = getFinance();
  fin.expenses.unshift({id:uid("exp"), amount, type:"operational", note, createdAt: Date.now()});
  setFinance(fin);
  renderProfitsAndAnalytics();
  renderAI();
}

function addAdPrompt(){
  const revenue = Number(prompt("Ad revenue (MAD):", "0")||0) || 0;
  const expense = Number(prompt("Ad expense (MAD):", "0")||0) || 0;
  const campaign = String(prompt("Campaign name:", "Campaign")||"").trim();
  const fin = getFinance();
  fin.ads.unshift({id:uid("ad"), revenue, expense, campaign, createdAt: Date.now()});
  setFinance(fin);
  renderProfitsAndAnalytics();
  renderAI();
}

function exportCsvFromAnalytics(cur){
  const rows = [];
  rows.push(["Metric","Value"]);
  rows.push(["Revenue", cur.revenue]);
  rows.push(["Profit", cur.profit]);
  rows.push(["Losses", cur.losses]);
  rows.push(["Net profit", cur.netProfit]);
  rows.push(["Orders", cur.totalOrders]);
  rows.push(["Refunds", cur.refunds]);
  rows.push([]);
  rows.push(["Product","Selling","Cost","Qty Sold","Total Profit","Profit %"]);
  (cur.products||[]).forEach(p=>{
    const sell = Number(p.sell||0)||0;
    const cost = Number(p.cost||0)||0;
    const qty = Number(p.qty||0)||0;
    const per = sell - cost;
    const totalProfit = per * qty;
    const pct = cost>0 ? ((sell - cost)/cost)*100 : 0;
    rows.push([p.name, sell, cost, qty, totalProfit, pct.toFixed(2)]);
  });
  return rows.map(r=> r.map(v=>{
    const s = String(v ?? "");
    if(s.includes(",") || s.includes("\"") || s.includes("\n")) return `"${s.replace(/\"/g,'""')}"`;
    return s;
  }).join(",")).join("\n");
}

function downloadText(filename, text, type){
  const blob = new Blob([text], {type: type || "text/plain"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportPdfReport(cur){
  const html = `
  <html><head><title>AR STORE Report</title>
  <style>
    body{font-family:Inter,Arial,sans-serif;padding:24px;}
    h1{margin:0 0 10px;}
    .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:14px;}
    .card{border:1px solid #ddd;border-radius:12px;padding:12px;}
    table{width:100%;border-collapse:collapse;margin-top:14px;}
    th,td{border:1px solid #ddd;padding:8px;font-size:12px;text-align:left;}
  </style></head><body>
    <h1>Profits & Analytics</h1>
    <div>Range: ${new Date(cur.range.from).toLocaleDateString()} → ${new Date(cur.range.to).toLocaleDateString()}</div>
    <div class="grid">
      <div class="card"><strong>Revenue</strong><div>${formatMoney(cur.revenue)} MAD</div></div>
      <div class="card"><strong>Profit</strong><div>${formatMoney(cur.profit)} MAD</div></div>
      <div class="card"><strong>Net</strong><div>${formatMoney(cur.netProfit)} MAD</div></div>
      <div class="card"><strong>Losses</strong><div>${formatMoney(cur.losses)} MAD</div></div>
      <div class="card"><strong>Orders</strong><div>${formatMoney(cur.totalOrders)}</div></div>
      <div class="card"><strong>Refunds</strong><div>${formatMoney(cur.refunds)} MAD</div></div>
    </div>
    <h2 style="margin-top:18px;">Products</h2>
    <table>
      <thead><tr><th>Product</th><th>Selling</th><th>Cost</th><th>Qty</th><th>Total profit</th><th>Profit %</th></tr></thead>
      <tbody>
        ${(cur.products||[]).map(p=>{
          const sell = Number(p.sell||0)||0;
          const cost = Number(p.cost||0)||0;
          const qty = Number(p.qty||0)||0;
          const totalProfit = (sell - cost) * qty;
          const pct = cost>0 ? ((sell - cost)/cost)*100 : 0;
          return `<tr><td>${escapeHtml(p.name||"—")}</td><td>${formatMoney(sell)}</td><td>${formatMoney(cost)}</td><td>${formatMoney(qty)}</td><td>${formatMoney(totalProfit)}</td><td>${pct.toFixed(1)}%</td></tr>`;
        }).join("")}
      </tbody>
    </table>
    <script>window.print();</script>
  </body></html>`;
  const win = window.open("", "_blank");
  if(!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
}

function pushChat(role, text){
  const log = el("aiChatLog");
  if(!log) return;
  const div = document.createElement("div");
  div.className = `chat-msg ${role}`;
  div.textContent = String(text||"");
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

function handleAIQuery(q){
  const query = String(q||"").trim();
  if(!query) return;
  const cur = computeAnalytics(currentAnalyticsRange);
  const best = (cur.products||[]).slice().sort((a,b)=> (b.qty||0)-(a.qty||0))[0];
  const profitable = (cur.products||[]).slice().sort((a,b)=> (b.profit||0)-(a.profit||0))[0];
  const loss = (cur.products||[]).slice().sort((a,b)=> (a.profit||0)-(b.profit||0))[0];
  const lowProfitReason = cur.expenses > 0 || cur.adExpense > 0 || cur.refunds > 0;

  const lq = query.toLowerCase();
  if(lq.includes("today") && (lq.includes("earn") || lq.includes("revenue") || lq.includes("profit"))){
    const today = computeAnalytics(getRangePreset("today"));
    return `Today: revenue ${formatMoney(today.revenue)} MAD, net ${formatMoney(today.netProfit)} MAD, orders ${formatMoney(today.totalOrders)}.`;
  }
  if(lq.includes("best product") || lq.includes("best") || lq.includes("top product")){
    if(best) return `Best selling product: ${best.name} (${formatMoney(best.qty)} sold).`;
    return "No product sales data in this range.";
  }
  if(lq.includes("most profitable") || lq.includes("profitable product")){
    if(profitable) return `Most profitable product: ${profitable.name} (profit ${formatMoney(profitable.profit)} MAD).`;
    return "No profit data yet (add cost prices to products).";
  }
  if(lq.includes("why") && lq.includes("profit") && (lq.includes("drop") || lq.includes("down"))){
    const prev = computeAnalytics(computePrevRange(currentAnalyticsRange));
    const netDrop = pctChange(cur.netProfit, prev.netProfit);
    const drivers = [];
    if(netDrop < 0){
      if(cur.revenue < prev.revenue) drivers.push("lower revenue");
      if(cur.expenses > prev.expenses) drivers.push("higher operational expenses");
      if(cur.adExpense > prev.adExpense) drivers.push("higher ad spend");
      if(cur.refunds > prev.refunds) drivers.push("more refunds");
    }
    const reason = drivers.length ? drivers.join(", ") : (lowProfitReason ? "expenses/refunds increased" : "insufficient cost data to compute profit drivers");
    return `Profit is down ${Math.abs(netDrop).toFixed(1)}% vs previous period. Likely drivers: ${reason}.`;
  }
  if(lq.includes("monthly report") || lq.includes("month")){
    const month = computeAnalytics(getRangePreset("month"));
    return `Monthly: revenue ${formatMoney(month.revenue)} MAD, net ${formatMoney(month.netProfit)} MAD, losses ${formatMoney(month.losses)} MAD.`;
  }
  if(lq.includes("report") || lq.includes("summary")){
    return `Range summary: revenue ${formatMoney(cur.revenue)} MAD, profit ${formatMoney(cur.profit)} MAD, net ${formatMoney(cur.netProfit)} MAD, orders ${formatMoney(cur.totalOrders)}.`;
  }
  if(loss && (loss.profit||0) < 0){
    return `Alert: ${loss.name} is negative profit (${formatMoney(loss.profit)} MAD). Add/verify cost price or adjust pricing.`;
  }
  return `I can help with revenue, profit, losses, best products, and reports. Try: "How much did I earn today?" or "Show monthly report".`;
}

function updateAdminBackBtn(page){
  const btn = el("adminBackBtn");
  const mobileBack = el("mobileBackBtn");
  if(!btn && !mobileBack) return;
  const onSettingsSub = page === "settings" && settingsTabHistory.length > 0;
  let label = "← Back";
  let title = "Previous page";
  if(page === "overview"){
    label = "← Store";
    title = "Return to storefront";
  } else if(onSettingsSub){
    title = "Previous settings section";
  }
  if(btn){
    btn.textContent = label;
    btn.title = title;
  }
  if(mobileBack){
    mobileBack.textContent = page === "overview" ? "← Store" : "← Back";
    mobileBack.title = title;
  }
}

function closeSidebar(){
  el("adminSidebar")?.classList.remove("open");
  el("sidebarOverlay")?.classList.remove("visible");
}

function openSidebar(){
  el("adminSidebar")?.classList.add("open");
  el("sidebarOverlay")?.classList.add("visible");
}

function toggleSidebar(){
  if(el("adminSidebar")?.classList.contains("open")) closeSidebar();
  else openSidebar();
}

function adminNavigateBack(){
  const current = document.querySelector(".nav-item.active")?.dataset?.page;
  if(current === "products" && productsNavigateBack()) return;
  if(current === "settings" && settingsTabHistory.length > 0){
    const prevTab = settingsTabHistory.pop();
    setSettingsTab(prevTab, { fromBack: true });
    return;
  }
  if(adminPageHistory.length > 0){
    const prev = adminPageHistory.pop();
    if(prev === "settings") settingsTabHistory = [];
    setActivePage(prev, { fromBack: true });
    refreshPage(prev);
    return;
  }
  if(current && current !== "overview"){
    setActivePage("overview", { fromBack: true, skipHistory: true });
    refreshPage("overview");
    return;
  }
  window.location.href = "../index.html";
}

function setActivePage(page, options = {}){
  const { fromBack = false, skipHistory = false } = options;
  const current = document.querySelector(".nav-item.active")?.dataset?.page;
  if(!fromBack && !skipHistory && current && current !== page){
    adminPageHistory.push(current);
    if(current === "settings") settingsTabHistory = [];
  }
  if(page !== "settings" && current === "settings"){
    settingsTabHistory = [];
  }
  document.querySelectorAll(".nav-item").forEach(b=>{
    b.classList.toggle("active", b.dataset.page === page);
  });
  document.querySelectorAll(".page").forEach(p=>{
    const isActive = p.id === `page-${page}`;
    if(isActive && !p.classList.contains("active")){
      p.style.animation = "none";
      void p.offsetWidth;
      p.style.animation = "";
    }
    p.classList.toggle("active", isActive);
  });
  const settingsSubtitles = {
    store: "Name, footer and branding",
    contact: "WhatsApp, email, Instagram",
    site: "Backgrounds and category images",
    admin: "Login credentials and security"
  };
  const titleMap = {
    overview: ["Overview", "Store insights & quick actions"],
    orders: ["Orders", "Manage orders and statuses"],
    products: ["Products", "Catalogues, products & photos"],
    analytics: ["Analytics", "Profits, charts and reports"],
    ai: ["AI Assistant", "Smart insights and local chat"],
    users: ["Customers", "Registered accounts"],
    reviews: ["Reviews", "Moderate product reviews"],
    settings: ["Settings", settingsSubtitles[currentSettingsTab] || "Full site control"]
  };
  const [t, st] = titleMap[page] || ["Dashboard", ""];
  el("pageTitle").textContent = t;
  el("pageSubtitle").textContent = st;
  updateAdminBackBtn(page);
  closeSidebar();
}

function renderOverview(){
  const k = computeKPIs();
  el("kpiOrders").textContent = String(k.totalOrders);
  el("kpiUsers").textContent = String(k.totalUsers);
  el("kpiProducts").textContent = String(k.totalProducts);
  el("kpiRevenue").textContent = String(k.revenue);

  const orders = getOrders().slice(0,6);
  const list = el("recentOrdersList");
  const empty = el("recentOrdersEmpty");
  if(!orders.length){
    empty.style.display = "block";
    list.innerHTML = "";
    return;
  }
  empty.style.display = "none";
  list.innerHTML = orders.map(o=>{
    const customer = o?.customer?.name || "—";
    const when = new Date(o?.createdAt || Date.now()).toLocaleString();
    const total = formatMoney(o?.revenue || 0);
    return `
      <div class="list-item">
        <div class="list-item-left">
          <div style="min-width:0;">
            <div class="title">${customer}</div>
            <div class="meta">${o.id} • ${when} • ${o.channel || "—"}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          ${statusTag(o.status)}
          <div class="tag">${total} MAD</div>
          <button class="btn secondary small" type="button" data-open-order="${o.id}">Open</button>
        </div>
      </div>
    `;
  }).join("");

  list.querySelectorAll("[data-open-order]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      setActivePage("orders");
      refreshPage("orders");
      el("ordersSearch").value = btn.getAttribute("data-open-order") || "";
      renderOrders();
    });
  });
}

function renderOrders(){
  const q = el("ordersSearch").value || "";
  const status = el("ordersStatusFilter").value || "";
  const orders = getOrders().filter(o=>{
    const st = String(o?.status || "pending").toLowerCase();
    const normalized = st === "shipped" ? "in_delivery" : st;
    if(status && normalized !== status) return false;
    const itemsText = (o?.items||[]).map(i=>`${i?.name||""}`).join(" ");
    return byText(q, o?.id, o?.customer?.name, o?.customer?.phone, o?.customer?.city, itemsText);
  });

  const table = el("ordersTable");
  const empty = el("ordersEmpty");
  if(!orders.length){
    empty.style.display = "block";
    table.innerHTML = "";
    return;
  }
  empty.style.display = "none";

  table.innerHTML = `
    <div class="row header">
      <div class="cell">Order</div>
      <div class="cell">Customer</div>
      <div class="cell">Status</div>
      <div class="cell">Revenue</div>
      <div class="cell">Actions</div>
    </div>
    ${orders.map(o=>{
      const when = new Date(o?.createdAt || Date.now()).toLocaleString();
      const customer = o?.customer?.name || "—";
      const phone = o?.customer?.phone || "—";
      const city = o?.customer?.city || "—";
      const total = formatMoney(o?.revenue || 0);
      const items = Array.isArray(o?.items) ? o.items : [];
      const itemsLabel = items.slice(0,3).map(i=>`${i?.name||"Item"} x${i?.qty||1}`).join(" • ") + (items.length>3 ? ` • +${items.length-3}` : "");
      return `
        <div class="row" data-order-id="${o.id}" style="cursor:pointer;">
          <div class="cell">
            <div style="font-weight:900;overflow:hidden;text-overflow:ellipsis;">${o.id}</div>
            <div class="meta">${when} • ${o.channel || "—"} • ${itemsLabel || "—"}</div>
          </div>
          <div class="cell">
            <div style="font-weight:900;">${customer}</div>
            <div class="meta">${phone} • ${city}</div>
          </div>
          <div class="cell">
            <select class="input" data-status style="min-width:160px;">
              ${[["pending","pending"],["in_delivery","shipped"],["delivered","delivered"],["cancelled","cancelled"]].map(([val,label])=>{
                const cur = String(o.status||"pending").toLowerCase();
                const selVal = cur === "shipped" ? "in_delivery" : cur;
                return `<option value="${val}" ${selVal===val?"selected":""}>${label}</option>`;
              }).join("")}
            </select>
          </div>
          <div class="cell"><span class="tag">${total} MAD</span></div>
          <div class="cell" style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn secondary small" type="button" data-details>Details</button>
            <button class="btn danger small" type="button" data-delete>Delete</button>
          </div>
        </div>
      `;
    }).join("")}
  `;

  table.querySelectorAll("[data-status]").forEach(sel=>{
    sel.addEventListener("change", async ()=>{
      const row = sel.closest("[data-order-id]");
      const id = row?.getAttribute("data-order-id");
      const status = sel.value;
      if(canUseServer() && window.ARStoreSync){
        try{
          await ARStoreSync.updateAdminOrderStatus(id, status);
          await refreshOrdersFromServer();
          renderOrders();
          renderOverview();
          return;
        }catch(e){
          showToast("Status saved locally — " + (e.message || "sync failed"));
        }
      }
      const ordersAll = getOrders();
      const idx = ordersAll.findIndex(o=>o.id===id);
      if(idx>=0){
        ordersAll[idx] = {...ordersAll[idx], status};
        setOrders(ordersAll);
        renderOverview();
      }
    });
  });

  table.querySelectorAll("[data-delete]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const row = btn.closest("[data-order-id]");
      const id = row?.getAttribute("data-order-id");
      if(canUseServer() && window.ARStoreSync){
        try{
          await ARStoreSync.deleteAdminOrder(id);
          await refreshOrdersFromServer();
          renderOrders();
          renderOverview();
          return;
        }catch(e){
          showToast("Delete failed — " + (e.message || "server error"));
        }
      }
      const next = getOrders().filter(o=>o.id!==id);
      setOrders(next);
      renderOrders();
      renderOverview();
    });
  });

  table.querySelectorAll("[data-details]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      btn.closest("[data-order-id]")?.setAttribute("data-stop", "1");
      const row = btn.closest("[data-order-id]");
      const id = row?.getAttribute("data-order-id");
      openOrderDetails(id);
    });
  });

  // Row click opens premium details too (except when interacting with controls)
  table.querySelectorAll("[data-order-id]").forEach(row=>{
    row.addEventListener("click", (e)=>{
      const t = e.target;
      if(t && (t.closest("select") || t.closest("button"))) return;
      const id = row.getAttribute("data-order-id");
      openOrderDetails(id);
    });
  });
}

function openOrderDetails(orderId){
  const modal = el("orderDetailModal");
  const body = el("orderDetailBody");
  const sub = el("orderDetailSub");
  if(!modal || !body || !sub) return;
  const o = getOrders().find(x=>x.id===orderId);
  if(!o) return;
  const p = o?.product || (Array.isArray(o?.items) ? o.items[0] : null) || {};
  const when = new Date(o?.createdAt || Date.now()).toLocaleString();
  const customerName = o?.customer?.name || "—";
  const customerPhone = o?.customer?.phone || "—";
  const customerCity = o?.customer?.city || "—";
  const price = (p?.price != null) ? p.price : (o?.revenue || 0);
  const img = p?.img || "";
  const name = p?.name || (Array.isArray(o?.items) ? (o.items[0]?.name||"—") : "—");

  // Revenue / Profit (display-only, no logic changes)
  const items = Array.isArray(o?.items) ? o.items : [];
  const computedRevenue = items.reduce((sum, it)=>{
    const unit = Number(it?.price || 0);
    const qty = Math.max(1, parseInt(it?.qty, 10) || 1);
    return sum + (Number.isFinite(unit) ? unit * qty : 0);
  }, 0);
  const revenue = Number(o?.revenue ?? computedRevenue ?? price ?? 0) || 0;
  const cost = Number(o?.cost ?? p?.cost ?? o?.productCost ?? o?.costPrice ?? null);
  const hasCost = Number.isFinite(cost);
  const profit = hasCost ? (revenue - cost) : null;
  const paymentStatusRaw = String(o?.paymentStatus || "").toLowerCase().trim();
  const paymentStatus = paymentStatusRaw
    ? paymentStatusRaw
    : (String(o?.status||"").toLowerCase()==="delivered" ? "paid" : "pending");

  sub.textContent = `${o.id} • ${when}`;
  body.innerHTML = `
    <div class="od-grid">
      <div class="od-top">
        <div class="od-image">
          ${img ? `<img src="${escapeHtml(img)}" alt="">` : `<div class="od-no-img">No image</div>`}
        </div>
        <div class="od-summary">
          <div class="od-name">${escapeHtml(name)}</div>
          <div class="od-price">${formatMoney(price)} MAD</div>
          <div class="od-row">
            <span class="od-pill">Status: ${escapeHtml(String(o.status||"pending"))}</span>
            <span class="od-pill">Channel: ${escapeHtml(String(o.channel||"—"))}</span>
          </div>
        </div>
      </div>
      <div class="od-meta-grid">
        <div class="od-meta-item od-meta-wide"><strong>Order ID</strong>${escapeHtml(o.id)}</div>
        <div class="od-meta-item"><strong>Customer</strong>${escapeHtml(customerName)}</div>
        <div class="od-meta-item"><strong>Phone</strong>${escapeHtml(customerPhone)}</div>
        <div class="od-meta-item"><strong>City</strong>${escapeHtml(customerCity)}</div>
      </div>
      <div class="od-rev">
        <div class="od-rev-head">
          <div class="od-rev-title"><span class="od-rev-icon" aria-hidden="true">💰</span> Revenue</div>
          <div class="od-rev-status ${paymentStatus==='paid'?'paid':'pending'}">${escapeHtml(paymentStatus)}</div>
        </div>
        <div class="od-rev-grid">
          <div class="od-rev-item">
            <div class="od-rev-label">Product price</div>
            <div class="od-rev-value">${formatMoney(price)} MAD</div>
          </div>
          <div class="od-rev-item">
            <div class="od-rev-label">Total revenue</div>
            <div class="od-rev-value">${formatMoney(revenue)} MAD</div>
          </div>
          <div class="od-rev-item">
            <div class="od-rev-label">Estimated profit</div>
            <div class="od-rev-value ${profit!=null && profit>=0 ? 'pos' : (profit!=null ? 'neg' : '')}">
              ${profit==null ? "—" : `${formatMoney(profit)} MAD`}
            </div>
            <div class="od-rev-hint">${hasCost ? `Cost: ${formatMoney(cost)} MAD` : "Add cost to enable profit."}</div>
          </div>
        </div>
      </div>
    </div>
  `;
  modal.style.display = "flex";
}

function closeOrderDetails(){
  const modal = el("orderDetailModal");
  if(modal) modal.style.display = "none";
}

function makeProductId(){
  return `p_${Date.now()}_${Math.random().toString(16).slice(2,8)}`;
}

function normalizeProduct(p){
  const images = window.ARStoreSync
    ? ARStoreSync.parseProductImages(p)
    : (Array.isArray(p.images) ? p.images.map(u=>String(u||"").trim()).filter(Boolean) : (p.img ? [String(p.img).trim()] : []));
  const price = Number(p.price || 0);
  const costPrice = Number(p.costPrice || p.cost || 0);
  const stockMax = Math.max(0, parseInt(p.stockMax, 10) || 0);
  const img = images[0] || String(p.img || "").trim();
  return {
    id: String(p.id || makeProductId()),
    name: String(p.name || "").trim(),
    nameEn: String(p.nameEn || "").trim(),
    nameFr: String(p.nameFr || "").trim(),
    price: Number.isFinite(price) ? price : 0,
    costPrice: Number.isFinite(costPrice) ? costPrice : 0,
    stockMax,
    img,
    images: images.length ? images : (img ? [img] : []),
    videoUrl: String(p.videoUrl || "").trim(),
    desc: String(p.desc || p.description || "").trim(),
    categoryId: Math.max(1, parseInt(p.categoryId, 10) || 1)
  };
}

function catalogFromProducts(products, categoryDefs){
  const normalized = (products || []).map(normalizeProduct);
  const defs = categoryDefs || getCategoryDefs();
  if(window.ARStoreSync) return ARStoreSync.catalogFromProducts(normalized, defs);
  const categories = {};
  defs.forEach(c=>{ categories[c.id] = []; });
  normalized.forEach(p=>{
    const c = Math.max(1, parseInt(p.categoryId, 10) || 1);
    if(!categories[c]) categories[c] = [];
    categories[c].push({
      id: p.id,
      img: p.img,
      name: p.name,
      nameEn: p.nameEn || "",
      nameFr: p.nameFr || "",
      price: p.price,
      desc: p.desc,
      images: p.images || (p.img ? [p.img] : []),
      videoUrl: p.videoUrl || "",
      stockMax: p.stockMax || 0
    });
  });
  return { products: normalized, categories, categoryDefs: defs };
}

function renderProductImagesGallery(){
  const wrap = el("productImagesGallery");
  if(!wrap) return;
  if(!productImagesDraft.length){
    wrap.innerHTML = `<div class="hint" style="margin:0;">No images yet — add URL or upload.</div>`;
    return;
  }
  wrap.innerHTML = productImagesDraft.map((src, idx)=>`
    <div class="img-gallery-item ${idx === 0 ? "primary" : ""}" data-iidx="${idx}">
      ${idx === 0 ? `<span class="img-badge">MAIN</span>` : ""}
      <img src="${escapeHtml(src)}" alt="Product ${idx + 1}">
      <div class="img-gallery-tools">
        <button type="button" data-img-up title="Move left">↑</button>
        <button type="button" data-img-main title="Set main">★</button>
        <button type="button" data-img-down title="Move right">↓</button>
        <button type="button" data-img-del title="Remove">✕</button>
      </div>
    </div>
  `).join("");

  wrap.querySelectorAll("[data-img-up]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const i = parseInt(btn.closest("[data-iidx]")?.getAttribute("data-iidx"), 10);
      if(i <= 0) return;
      [productImagesDraft[i - 1], productImagesDraft[i]] = [productImagesDraft[i], productImagesDraft[i - 1]];
      renderProductImagesGallery();
    });
  });
  wrap.querySelectorAll("[data-img-down]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const i = parseInt(btn.closest("[data-iidx]")?.getAttribute("data-iidx"), 10);
      if(i < 0 || i >= productImagesDraft.length - 1) return;
      [productImagesDraft[i + 1], productImagesDraft[i]] = [productImagesDraft[i], productImagesDraft[i + 1]];
      renderProductImagesGallery();
    });
  });
  wrap.querySelectorAll("[data-img-main]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const i = parseInt(btn.closest("[data-iidx]")?.getAttribute("data-iidx"), 10);
      if(i <= 0) return;
      const [item] = productImagesDraft.splice(i, 1);
      productImagesDraft.unshift(item);
      renderProductImagesGallery();
    });
  });
  wrap.querySelectorAll("[data-img-del]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const i = parseInt(btn.closest("[data-iidx]")?.getAttribute("data-iidx"), 10);
      productImagesDraft.splice(i, 1);
      renderProductImagesGallery();
    });
  });
}

function addProductImageUrlFromInput(){
  const url = String(el("productImageUrl")?.value || "").trim();
  if(!url) return;
  productImagesDraft.push(url);
  el("productImageUrl").value = "";
  renderProductImagesGallery();
}

async function addProductImageFiles(files){
  const list = Array.from(files || []).filter(f=>{
    if(!f) return false;
    if(f.type && f.type.startsWith("image/")) return true;
    return /\.(jpe?g|png|webp|gif|heic|heif|bmp)$/i.test(String(f.name || ""));
  });
  if(!list.length){
    showToast("No image selected");
    return;
  }
  let added = 0;
  for(const file of list){
    if(file.size > 8 * 1024 * 1024){
      showToast("Image too large (max 8MB): " + (file.name || "image"));
      continue;
    }
    let url = "";
    try{
      const serverUp = window.ARStoreSync && await ARStoreSync.pingServer();
      if(serverUp){
        const authed = await hasAdminServerSession();
        if(authed){
          url = await ARStoreSync.uploadImageFile(file);
        }else{
          showToast("Log in on this device to upload to server — saving locally…");
          url = await fileToDataUrl(file);
        }
      }else{
        url = await fileToDataUrl(file);
      }
    }catch(e){
      if(e.status === 401 || e.status === 403){
        handleAdminUnauthorized("Login expired — sign in again to upload photos.");
        return;
      }
      try{
        url = await fileToDataUrl(file);
        showToast("Photo saved locally — " + (file.name || "image"));
      }catch(_e2){
        showToast("Upload failed for " + (file.name || "image"));
        continue;
      }
    }
    if(url){
      productImagesDraft.push(url);
      added++;
    }
  }
  renderProductImagesGallery();
  if(added) showToast(`${added} image(s) added`);
}

function renderProductVideoPreview(){
  const wrap = el("productVideoPreview");
  const url = String(el("productVideoUrl")?.value || "").trim();
  if(!wrap) return;
  if(!url){
    wrap.innerHTML = "";
    return;
  }
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]+)/);
  if(yt){
    wrap.innerHTML = `<iframe src="https://www.youtube.com/embed/${escapeHtml(yt[1])}" title="Video preview" allowfullscreen loading="lazy" style="width:100%;max-width:420px;aspect-ratio:16/9;border:0;border-radius:12px;"></iframe>`;
    return;
  }
  if(/\.(mp4|webm|mov)(\?|$)/i.test(url) || url.startsWith("/uploads/") || url.startsWith("data:video/")){
    wrap.innerHTML = `<video controls src="${escapeHtml(url)}" style="width:100%;max-width:420px;max-height:220px;border-radius:12px;background:#000;"></video>`;
    return;
  }
  wrap.innerHTML = `<a class="link" href="${escapeHtml(url)}" target="_blank" rel="noopener">Open video link</a>`;
}

async function addProductVideoFile(file){
  if(!file) return;
  const isVideo = String(file.type || "").startsWith("video/") || /\.(mp4|webm|mov|m4v)$/i.test(String(file.name || ""));
  if(!isVideo){
    showToast("Please choose a video file");
    return;
  }
  if(file.size > 50 * 1024 * 1024){
    showToast("Video too large (max 50MB)");
    return;
  }
  try{
    const serverUp = window.ARStoreSync && await ARStoreSync.pingServer();
    if(serverUp){
      const authed = await hasAdminServerSession();
      if(authed){
        const url = await ARStoreSync.uploadImageFile(file);
        if(el("productVideoUrl")) el("productVideoUrl").value = url;
        renderProductVideoPreview();
        showToast("Video uploaded");
        return;
      }
      showToast("Log in on this device to upload video.");
      return;
    }
    if(file.size > 12 * 1024 * 1024){
      showToast("Video too large for offline mode — use server login");
      return;
    }
    const localUrl = await fileToDataUrl(file);
    if(el("productVideoUrl")) el("productVideoUrl").value = localUrl;
    renderProductVideoPreview();
    showToast("Video saved locally");
  }catch(e){
    if(e.status === 401 || e.status === 403){
      handleAdminUnauthorized("Login expired — sign in again to upload video.");
      return;
    }
    showToast("Video upload failed");
  }
}

function loadProductIntoForm(id){
  if(!id) return;
  const cat = getCatalog();
  const p = (cat.products||[]).find(x=>x.id===id);
  if(!p) return;
  selectedCategoryId = p.categoryId || selectedCategoryId;
  el("productId").value = p.id;
  el("productName").value = p.name || "";
  if(el("productNameEn")) el("productNameEn").value = p.nameEn || "";
  if(el("productNameFr")) el("productNameFr").value = p.nameFr || "";
  el("productPrice").value = String(p.price || 0);
  const costEl = el("productCostPrice");
  if(costEl) costEl.value = String(p.costPrice || 0);
  if(el("productStockMax")) el("productStockMax").value = String(p.stockMax || 0);
  el("productDesc").value = p.desc || "";
  if(el("productVideoUrl")) el("productVideoUrl").value = p.videoUrl || "";
  renderProductVideoPreview();
  if(el("productCategory")) el("productCategory").value = String(p.categoryId || selectedCategoryId || 1);
  productImagesDraft = Array.isArray(p.images) && p.images.length
    ? [...p.images]
    : (p.img ? [p.img] : []);
  el("productImageUrl").value = "";
  renderProductImagesGallery();
}

function exportCatalogJson(){
  const cat = getCatalog();
  downloadText("ar_store_catalog.json", JSON.stringify(cat, null, 2), "application/json");
  showToast("Catalog exported");
}

function exportCatalogCsv(){
  const products = getCatalog().products || [];
  const rows = [["id","name","price","costPrice","categoryId","desc","img","images"]];
  products.forEach(p=>{
    const images = Array.isArray(p.images) ? p.images.join("|") : (p.img || "");
    rows.push([p.id, p.name, p.price, p.costPrice||0, p.categoryId||1, p.desc||"", p.img||"", images]);
  });
  const csv = rows.map(r=> r.map(v=>{
    const s = String(v ?? "");
    return (s.includes(",") || s.includes("\"")) ? `"${s.replace(/"/g,'""')}"` : s;
  }).join(",")).join("\n");
  downloadText("ar_store_products.csv", csv, "text/csv");
  showToast("CSV exported");
}

function importCatalogJson(file){
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const data = JSON.parse(String(reader.result||""));
      const products = Array.isArray(data?.products) ? data.products : (Array.isArray(data) ? data : null);
      if(!products) throw new Error("invalid");
      const normalized = products.map(p=>{
        const n = normalizeProduct(p);
        if(Array.isArray(p.images)) n.images = p.images;
        else if(typeof p.images === "string" && p.images.includes("|")){
          n.images = p.images.split("|").map(u=>u.trim()).filter(Boolean);
          n.img = n.images[0] || n.img;
        }
        return n;
      });
      const defs = Array.isArray(data?.categoryDefs) ? data.categoryDefs : getCategoryDefs();
      setCatalog(catalogFromProducts(normalized, defs));
      productsView = "catalogues";
      renderProductsPage();
      renderOverview();
      showToast(`Imported ${normalized.length} product(s)`);
    }catch(e){
      showToast("Invalid JSON file");
    }
  };
  reader.readAsText(file);
}

function exportOrdersCsv(){
  const orders = getOrders();
  const rows = [["id","status","customer","phone","city","revenue","channel","createdAt"]];
  orders.forEach(o=>{
    rows.push([
      o.id, o.status, o?.customer?.name||"", o?.customer?.phone||"", o?.customer?.city||"",
      o.revenue||0, o.channel||"", new Date(o.createdAt||0).toISOString()
    ]);
  });
  const csv = rows.map(r=> r.map(v=> `"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\n");
  downloadText("ar_store_orders.csv", csv, "text/csv");
  showToast("Orders exported");
}

function resetProductForm(){
  el("productId").value = "";
  el("productName").value = "";
  if(el("productNameEn")) el("productNameEn").value = "";
  if(el("productNameFr")) el("productNameFr").value = "";
  el("productPrice").value = "";
  const costEl = el("productCostPrice");
  if(costEl) costEl.value = "";
  el("productDesc").value = "";
  if(el("productStockMax")) el("productStockMax").value = "";
  if(el("productVideoUrl")) el("productVideoUrl").value = "";
  renderProductVideoPreview();
  if(el("productCategory")) el("productCategory").value = String(selectedCategoryId || 1);
  el("productImageUrl").value = "";
  el("productImageFile").value = "";
  if(el("productVideoFile")) el("productVideoFile").value = "";
  productImagesDraft = [];
  renderProductImagesGallery();
}

function renderUsers(){
  const q = String(el("usersSearch")?.value || "").trim().toLowerCase();
  const local = readLS(KEYS.accounts, []);
  const server = customersCache || [];
  const merged = new Map();
  [...local, ...server].forEach(u=>{
    const email = String(u?.email||"").toLowerCase();
    if(!email) return;
    merged.set(email, {...merged.get(email), ...u});
  });
  const users = [...merged.values()].filter(u=>{
    if(!q) return true;
    return String(u?.name||"").toLowerCase().includes(q) || String(u?.email||"").toLowerCase().includes(q);
  });
  const table = el("usersTable");
  const empty = el("usersEmpty");
  if(!users.length){
    empty.style.display = "block";
    table.innerHTML = "";
    return;
  }
  empty.style.display = "none";
  table.innerHTML = `
    <div class="row header">
      <div class="cell">Name</div>
      <div class="cell">Email</div>
      <div class="cell">Registered</div>
    </div>
    ${users.map(u=>{
      const when = u?.createdAt ? new Date(u.createdAt).toLocaleDateString() : (u?.source === "server" ? "Server" : "Local account");
      const extra = u?.orderCount ? ` • ${u.orderCount} orders` : "";
      return `
      <div class="row row-3">
        <div class="cell cell-wrap"><strong>${escapeHtml(u?.name || "—")}</strong></div>
        <div class="cell cell-wrap">${escapeHtml(u?.email || "—")}</div>
        <div class="cell cell-wrap muted-cell">${escapeHtml(when)}${extra}</div>
      </div>
    `;
    }).join("")}
  `;
}

function flattenReviews(map){
  const out = [];
  Object.keys(map || {}).forEach(productName=>{
    const r = map[productName];
    const comments = Array.isArray(r?.comments) ? r.comments : [];
    comments.forEach((c, idx)=>{
      out.push({
        productName,
        idx,
        user: c?.user || "User",
        time: c?.time || "",
        text: c?.text || ""
      });
    });
  });
  return out;
}

function renderReviews(){
  const q = el("reviewsSearch").value || "";
  const map = getReviews();
  const all = flattenReviews(map).filter(r=>byText(q, r.productName, r.user, r.text));

  const list = el("reviewsList");
  const empty = el("reviewsEmpty");
  if(!all.length){
    empty.style.display = "block";
    list.innerHTML = "";
    return;
  }
  empty.style.display = "none";
  list.innerHTML = all.map(r=>{
    return `
      <div class="list-item" data-prod="${encodeURIComponent(r.productName)}" data-idx="${r.idx}">
        <div style="min-width:0;">
          <div class="title">${r.productName}</div>
          <div class="meta">${r.user} • ${r.time}</div>
          <div style="margin-top:8px;font-weight:700;line-height:1.45;white-space:normal;">${escapeHtml(r.text)}</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn danger small" type="button" data-del>Delete</button>
        </div>
      </div>
    `;
  }).join("");

  list.querySelectorAll("[data-del]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const row = btn.closest("[data-prod]");
      const productName = decodeURIComponent(row.getAttribute("data-prod") || "");
      const idx = parseInt(row.getAttribute("data-idx") || "-1", 10);
      const mapNow = getReviews();
      const entry = mapNow[productName];
      if(!entry || !Array.isArray(entry.comments)) return;
      entry.comments.splice(idx, 1);
      mapNow[productName] = entry;
      await setReviews(mapNow);
      renderReviews();
    });
  });
}

function escapeHtml(s){
  const div = document.createElement("div");
  div.textContent = String(s || "");
  return div.innerHTML;
}

function renderSettings(){
  const s = getSettings();
  el("settingsStoreName").value = s.storeName || "";
  el("settingsFooterText").value = s.footerText || "";
  el("settingsLoginBg").value = s.loginBg || "";
  el("settingsStoreBg").value = s.storeBg || "";
  if(el("settingsWhatsapp")) el("settingsWhatsapp").value = s.whatsapp || "212632592347";
  if(el("settingsEmail")) el("settingsEmail").value = s.email || "mondiraghbalou@gmail.com";
  if(el("settingsInstagram")) el("settingsInstagram").value = s.instagram || "https://www.instagram.com/ar_store_7/";
  if(el("settingsSupportHours")) el("settingsSupportHours").value = s.supportHours || "Mon–Sat 9:00–21:00";
  if(el("productCardSlideshow")){
    el("productCardSlideshow").checked = s.productCardSlideshow === true || s.productCardSlideshow === "true";
  }
  const brandLogo = el("adminBrandLogo");
  if(brandLogo) brandLogo.alt = s.storeName || "AR STORE";
  getAdminCredentials().then(c=>{
    if(el("adminCredsUser")) el("adminCredsUser").value = c.username;
  });
}

function saveSettingsPartial(patch){
  const next = {...getSettings(), ...patch};
  const persist = async ()=>{
    setSettings(next);
    if(canUseServer()){
      try{
        await ARStoreSync.saveSettings(next);
        showToast("Settings saved & synced");
      }catch(e){
        showToast("Settings saved locally — " + (e.message || "sync failed"));
      }
    }else{
      showToast("Settings saved (local)");
    }
    renderSettings();
    renderOverview();
  };
  persist();
}

function showLoginShell(){
  const auth = el("authShell");
  const app = el("appShell");
  if(auth) auth.style.display = "flex";
  if(app) app.style.display = "none";
  const userInput = el("loginUser");
  const passInput = el("loginPass");
  if(userInput) userInput.value = "";
  if(passInput) passInput.value = "";
}

function hideLoginShell(){
  const auth = el("authShell");
  const app = el("appShell");
  if(auth) auth.style.display = "none";
  if(app) app.style.display = "grid";
}

let adminAppMounted = false;

function mountApp(session){
  if(!session?.username) throw new Error("Invalid admin session");
  hideLoginShell();
  if(el("adminUserPill")) el("adminUserPill").textContent = session.username;
  if(adminAppMounted) return;

  try{
  if(window.ARStoreSync){
    if(ARStoreSync.canUseAdminServer()){
      ARStoreSync.fetchCatalog().then(()=>{
        productsView = "catalogues";
        selectedCategoryId = null;
        renderProductsPage();
        renderOverview();
      }).catch(()=>{
        renderProductsPage();
        renderOverview();
      });
      ARStoreSync.fetchSettings().then(()=>{
        renderProductsPage();
        renderSettings();
      }).catch(()=>{});
      refreshOrdersFromServer().then(()=>{
        renderOverview();
        if(document.getElementById("page-orders")?.classList.contains("active")) renderOrders();
      });
      refreshCustomersFromServer().then(()=>{
        if(document.getElementById("page-users")?.classList.contains("active")) renderUsers();
      });
    }else{
      productsView = "catalogues";
      renderProductsPage();
      renderOverview();
    }
    ARStoreSync.initLiveSync({
      onCatalog(){
        if(!ARStoreSync.canUseAdminServer()) return;
        ARStoreSync.fetchCatalog().then(()=>{
          renderProductsPage();
          renderOverview();
        }).catch(()=>{});
        if(document.getElementById("page-analytics")?.classList.contains("active")) renderProfitsAndAnalytics();
      },
      onSettings(){
        if(!ARStoreSync.canUseAdminServer()) return;
        ARStoreSync.fetchSettings().then(()=>{
          renderProductsPage();
          renderSettings();
        }).catch(()=>{});
      },
      onOrders(){
        if(!ARStoreSync.canUseAdminServer()) return;
        refreshOrdersFromServer().then(()=>{
          renderOverview();
          if(document.getElementById("page-orders")?.classList.contains("active")) renderOrders();
          if(document.getElementById("page-analytics")?.classList.contains("active")) renderProfitsAndAnalytics();
        });
      }
    });
  }else{
    productsView = "catalogues";
    renderProductsPage();
  }
  warnIfNoServerSync();

  // nav
  document.querySelectorAll(".nav-item").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      if(btn.dataset.page === "products"){
        productsView = "catalogues";
        selectedCategoryId = null;
      }
      setActivePage(btn.dataset.page);
      refreshPage(btn.dataset.page);
    });
  });

  el("logoutBtn").addEventListener("click", ()=>{
    if(window.ARStoreSync) ARStoreSync.setAdminToken("");
    clearSession();
    adminAppMounted = false;
    showLoginShell();
    window.location.reload();
  });

  el("adminBackBtn")?.addEventListener("click", adminNavigateBack);

  // overview quick actions
  el("qaAddProduct").addEventListener("click", ()=>{
    setActivePage("products");
    productsView = "catalogues";
    showProductsView("catalogues");
    refreshPage("products");
  });
  el("qaOpenOrders").addEventListener("click", ()=>{
    setActivePage("orders");
    refreshPage("orders");
  });
  el("qaOpenAnalytics")?.addEventListener("click", ()=>{
    setActivePage("analytics");
    refreshPage("analytics");
  });
  el("qaOpenSettings").addEventListener("click", ()=>{
    setActivePage("settings");
    refreshPage("settings");
  });

  el("sidebarToggle")?.addEventListener("click", toggleSidebar);
  el("sidebarOverlay")?.addEventListener("click", closeSidebar);
  el("mobileMenuBtn")?.addEventListener("click", toggleSidebar);
  el("mobileBackBtn")?.addEventListener("click", adminNavigateBack);
  el("mobileHomeBtn")?.addEventListener("click", ()=>{
    closeSidebar();
    setActivePage("overview", { skipHistory: true });
    refreshPage("overview");
  });

  // orders interactions
  el("ordersSearch").addEventListener("input", renderOrders);
  el("ordersStatusFilter").addEventListener("change", renderOrders);
  el("ordersExportBtn")?.addEventListener("click", exportOrdersCsv);

  // products — Zara-style navigation
  el("prodSearchInput")?.addEventListener("input", ()=>{
    if(productsView === "category") renderCategoryProducts();
    else renderCataloguesGrid();
  });
  el("prodAddCatalogue")?.addEventListener("click", ()=> openCatalogueForm(null));
  el("prodBackCatalogues")?.addEventListener("click", ()=> showProductsView("catalogues"));
  el("prodAddProduct")?.addEventListener("click", ()=> openProductForm(null));
  el("catalogueFormBack")?.addEventListener("click", ()=> showProductsView("catalogues"));
  el("catalogueFormCancel")?.addEventListener("click", ()=> showProductsView("catalogues"));
  el("productFormBack")?.addEventListener("click", ()=> showProductsView("category"));
  el("catalogueFormImageUrl")?.addEventListener("input", ()=>{
    catalogueFormImage = String(el("catalogueFormImageUrl")?.value || "").trim();
    setCatalogueFormPreview(catalogueFormImage);
  });
  el("catalogueFormUpload")?.addEventListener("change", async ()=>{
    const file = el("catalogueFormUpload").files?.[0];
    el("catalogueFormUpload").value = "";
    if(!file || !file.type.startsWith("image/")) return;
    try{
      if(canUseServer()){
        catalogueFormImage = await ARStoreSync.uploadImageFile(file);
      }else{
        catalogueFormImage = await fileToDataUrl(file);
      }
      if(el("catalogueFormImageUrl")) el("catalogueFormImageUrl").value = catalogueFormImage;
      setCatalogueFormPreview(catalogueFormImage);
      showToast("Cover uploaded");
    }catch(_e){
      try{
        catalogueFormImage = await fileToDataUrl(file);
        if(el("catalogueFormImageUrl")) el("catalogueFormImageUrl").value = catalogueFormImage;
        setCatalogueFormPreview(catalogueFormImage);
        showToast("Cover saved locally");
      }catch(_e2){
        showToast("Upload failed");
      }
    }
  });
  el("catalogueForm")?.addEventListener("submit", async (e)=>{
    e.preventDefault();
    syncCategoriesDraftFromSettings();
    const name = String(el("catalogueFormName")?.value || "").trim();
    const nameEn = String(el("catalogueFormNameEn")?.value || "").trim();
    const nameFr = String(el("catalogueFormNameFr")?.value || "").trim();
    const image = String(el("catalogueFormImageUrl")?.value || catalogueFormImage || "").trim();
    if(!name){ showToast("Name required"); return; }
    if(editingCatalogueId){
      const idx = categoriesDraft.findIndex(c=> c.id === editingCatalogueId);
      if(idx >= 0) categoriesDraft[idx] = {...categoriesDraft[idx], name, nameEn, nameFr, image};
    }else{
      const maxId = categoriesDraft.reduce((m, c)=> Math.max(m, parseInt(c.id, 10) || 0), 0);
      categoriesDraft.push({ id: maxId + 1, name, nameEn, nameFr, image });
    }
    if(await persistCategories()){
      showToast("Catalogue saved");
      showProductsView("catalogues");
      renderOverview();
    }
  });
  el("catalogueFormDelete")?.addEventListener("click", ()=>{
    if(editingCatalogueId) deleteCatalogue(editingCatalogueId);
  });
  el("productCardSlideshow")?.addEventListener("change", (e)=>{
    saveSettingsPartial({ productCardSlideshow: Boolean(e.target.checked) });
  });
  el("productImageUrlAdd")?.addEventListener("click", addProductImageUrlFromInput);
  el("productImageUrl")?.addEventListener("keydown", (e)=>{
    if(e.key === "Enter"){ e.preventDefault(); addProductImageUrlFromInput(); }
  });
  el("productImageFile")?.addEventListener("change", async ()=>{
    await addProductImageFiles(el("productImageFile").files);
    el("productImageFile").value = "";
  });
  el("productVideoFile")?.addEventListener("change", async ()=>{
    const f = el("productVideoFile")?.files?.[0];
    if(f) await addProductVideoFile(f);
    if(el("productVideoFile")) el("productVideoFile").value = "";
  });
  el("productVideoClear")?.addEventListener("click", ()=>{
    if(el("productVideoUrl")) el("productVideoUrl").value = "";
    renderProductVideoPreview();
  });
  el("productVideoUrl")?.addEventListener("input", renderProductVideoPreview);
  el("productResetBtn")?.addEventListener("click", resetProductForm);
  el("productDeleteBtn")?.addEventListener("click", async ()=>{
    const id = el("productId")?.value;
    if(!id || !confirm("Delete this product?")) return;
    try{
      await deleteProductWithSync(id);
      refreshAfterProductSave(selectedCategoryId || 1);
      showToast("Product deleted");
    }catch(_e){
      showToast("Delete failed");
    }
  });
  el("productForm")?.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const images = collectProductImagesFromForm();
    const catId = resolveCategoryIdForSave();
    if(!String(el("productName")?.value || "").trim()) return;
    if(!images.length){
      showToast("Add a photo: paste URL + Add, or upload");
      return;
    }
    try{
      const p = normalizeProduct({
        id: el("productId").value || undefined,
        name: el("productName").value,
        nameEn: el("productNameEn")?.value || "",
        nameFr: el("productNameFr")?.value || "",
        price: el("productPrice").value,
        costPrice: el("productCostPrice")?.value,
        img: images[0],
        images,
        desc: el("productDesc").value,
        videoUrl: el("productVideoUrl")?.value || "",
        stockMax: el("productStockMax")?.value || 0,
        categoryId: catId
      });
      await saveProductWithSync(p, el("productId").value || undefined);
      refreshAfterProductSave(catId);
      if(document.getElementById("page-analytics")?.classList.contains("active")) renderProfitsAndAnalytics();
      if(document.getElementById("page-ai")?.classList.contains("active")) renderAI();
    }catch(err){
      showToast("Save failed: " + (err.message || "error"));
    }
  });

  el("productsExportJson")?.addEventListener("click", exportCatalogJson);
  el("productsImportFile")?.addEventListener("change", (e)=>{
    importCatalogJson(e.target.files?.[0]);
    e.target.value = "";
  });

  // reviews interactions
  el("reviewsSearch").addEventListener("input", renderReviews);
  el("reviewsRefresh").addEventListener("click", renderReviews);
  el("usersSearch")?.addEventListener("input", renderUsers);

  // settings — store info
  el("settingsForm").addEventListener("submit", (e)=>{
    e.preventDefault();
    saveSettingsPartial({
      storeName: String(el("settingsStoreName").value || "").trim(),
      footerText: String(el("settingsFooterText").value || "").trim()
    });
  });

  el("contactForm")?.addEventListener("submit", (e)=>{
    e.preventDefault();
    saveSettingsPartial({
      whatsapp: String(el("settingsWhatsapp")?.value || "").trim(),
      email: String(el("settingsEmail")?.value || "").trim(),
      instagram: String(el("settingsInstagram")?.value || "").trim(),
      supportHours: String(el("settingsSupportHours")?.value || "").trim()
    });
  });

  el("siteForm")?.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const next = {...getSettings()};
    next.loginBg = String(el("settingsLoginBg")?.value || "").trim();
    next.storeBg = String(el("settingsStoreBg")?.value || "").trim();
    setSettings(next);
    if(canUseServer()){
      try{
        await ARStoreSync.saveSettings(next);
        showToast("Visual settings saved & synced");
      }catch(err){
        showToast("Saved locally — " + (err.message || "sync failed"));
      }
    }else{
      showToast("Visual settings saved (local)");
    }
    renderSettings();
  });

  el("adminCredsForm")?.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const user = String(el("adminCredsUser")?.value || "").trim();
    const p1 = String(el("adminCredsPass")?.value || "");
    const p2 = String(el("adminCredsPass2")?.value || "");
    if(!user){ showToast("Username required"); return; }
    if(p1 && p1 !== p2){ showToast("Passwords do not match"); return; }
    if(p1 && p1.length < 6){ showToast("Password must be 6+ characters"); return; }
    await updateAdminCredentials(user, p1 || null);
    if(p1 && canUseServer() && window.ARStoreSync){
      try{
        await ARStoreSync.updateAdminPassword(p1);
        showToast("Admin credentials updated (local + server)");
      }catch(err){
        showToast("Local creds saved — server password: " + (err.message || "sync failed"));
      }
    }else{
      showToast("Admin credentials updated");
    }
    el("adminCredsPass").value = "";
    el("adminCredsPass2").value = "";
  });

  el("resetLoginLock")?.addEventListener("click", ()=>{
    clearLoginAttempts();
    showToast("Login lock cleared");
  });

  // Settings sub-tabs
  document.querySelectorAll("[data-settings-tab]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      setSettingsTab(btn.getAttribute("data-settings-tab"));
    });
  });

  // Profits controls
  document.querySelectorAll("[data-range]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      document.querySelectorAll("[data-range]").forEach(b=> b.classList.toggle("active", b === btn));
      currentAnalyticsRange = getRangePreset(btn.getAttribute("data-range"));
      renderProfitsAndAnalytics();
      if(document.getElementById("page-ai")?.classList.contains("active")) renderAI();
    });
  });
  el("profitApplyCustom")?.addEventListener("click", ()=>{
    const from = el("profitFrom")?.value ? new Date(el("profitFrom").value).getTime() : null;
    const to = el("profitTo")?.value ? new Date(el("profitTo").value).getTime() : null;
    const r = clampRange(from, to);
    if(!r) return;
    currentAnalyticsRange = {from: startOfDay(r.from), to: endOfDay(r.to)};
    document.querySelectorAll("[data-range]").forEach(b=> b.classList.remove("active"));
    renderProfitsAndAnalytics();
    if(document.getElementById("page-ai")?.classList.contains("active")) renderAI();
  });
  el("profitProductSearch")?.addEventListener("input", ()=> renderProfitProductsTable(computeAnalytics(currentAnalyticsRange)));
  el("profitProductSort")?.addEventListener("change", ()=> renderProfitProductsTable(computeAnalytics(currentAnalyticsRange)));

  // Finance quick add
  el("addExpenseEntry")?.addEventListener("click", addExpensePrompt);
  el("addAdEntry")?.addEventListener("click", addAdPrompt);

  // Export
  el("exportCsv")?.addEventListener("click", ()=>{
    const cur = computeAnalytics(currentAnalyticsRange);
    const csv = exportCsvFromAnalytics(cur);
    downloadText("profits_analytics.csv", csv, "text/csv");
  });
  el("exportExcel")?.addEventListener("click", ()=>{
    const cur = computeAnalytics(currentAnalyticsRange);
    const csv = exportCsvFromAnalytics(cur);
    downloadText("profits_analytics.xls", csv, "application/vnd.ms-excel");
  });
  el("exportPdf")?.addEventListener("click", ()=>{
    const cur = computeAnalytics(currentAnalyticsRange);
    exportPdfReport(cur);
  });

  // AI chat
  el("aiChatSend")?.addEventListener("click", async ()=>{
    const input = el("aiChatInput");
    const q = String(input?.value || "").trim();
    if(!q) return;
    pushChat("user", q);
    if(input) input.value = "";
    if(canUseServer() && window.ARStoreSync){
      try{
        const ans = await ARStoreSync.adminAiChat(q);
        pushChat("ai", ans || handleAIQuery(q));
        return;
      }catch(e){
        console.warn("AI server fallback:", e.message);
      }
    }
    pushChat("ai", handleAIQuery(q));
  });
  el("aiChatInput")?.addEventListener("keydown", (e)=>{
    if(e.key !== "Enter") return;
    e.preventDefault();
    el("aiChatSend")?.click();
  });

  setActivePage("overview", { skipHistory: true });
  refreshPage("overview");

  el("orderDetailClose")?.addEventListener("click", closeOrderDetails);
  el("orderDetailModal")?.addEventListener("click", (e)=>{
    if(e.target && e.target.id === "orderDetailModal") closeOrderDetails();
  });

  adminAppMounted = true;
  }catch(mountErr){
    adminAppMounted = false;
    showLoginShell();
    throw mountErr;
  }
}

function refreshPage(page){
  if(page === "overview") renderOverview();
  if(page === "orders"){
    refreshOrdersFromServer().finally(()=> renderOrders());
  }
  if(page === "products"){
    if(productsView === "catalogues" || !selectedCategoryId) productsView = "catalogues";
    renderProductsPage();
    renderOverview();
  }
  if(page === "analytics") renderProfitsAndAnalytics();
  if(page === "ai") renderAI();
  if(page === "users"){
    refreshCustomersFromServer().finally(()=> renderUsers());
  }
  if(page === "reviews"){
    if(canUseServer() && window.ARStoreSync){
      ARStoreSync.fetchReviews().finally(()=> renderReviews());
    }else renderReviews();
  }
  if(page === "settings"){ renderSettings(); setSettingsTab(currentSettingsTab, { fromBack: true }); }
}

function fileToDataUrl(file){
  return new Promise((resolve,reject)=>{
    const r = new FileReader();
    r.onload = ()=> resolve(String(r.result || ""));
    r.onerror = ()=> reject(new Error("file_read_failed"));
    r.readAsDataURL(file);
  });
}

async function initAdminAuth(){
  const session = getSession();
  if(!session?.username) return;

  if(window.ARStoreSync){
    ARStoreSync.sanitizeAdminToken?.();
    await ARStoreSync.migrateAdminTokenFromLegacy();
    const serverUp = await ARStoreSync.pingServer();
    if(serverUp){
      const valid = await ARStoreSync.ensureAdminSession();
      if(!valid){
        clearSession();
        ARStoreSync.setAdminToken("");
        showLoginShell();
        const fb = el("loginFeedback");
        if(fb) fb.textContent = "Login required.";
        return;
      }
    }else if(session.token !== "offline"){
      ARStoreSync.setAdminToken("");
    }
  }

  try{
    mountApp(session);
  }catch(err){
    console.error("Admin auto-login failed:", err);
    clearSession();
    if(window.ARStoreSync) ARStoreSync.setAdminToken("");
    adminAppMounted = false;
    showLoginShell();
    const fb = el("loginFeedback");
    if(fb) fb.textContent = "Dashboard failed to load. Login again.";
  }
}

initAdminAuth();

