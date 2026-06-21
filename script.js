/**
 * AR STORE - Script.js (Deprecated)
 * 
 * NOTE: This file has been consolidated into index.html
 * All application functionality is now defined in the main HTML file.
 * 
 * This file is kept for backwards compatibility only.
 */

console.log("✓ AR STORE: All scripts are now defined in index.html. This file is deprecated.");



// --- Current state ---
let currentProduct = null;

// --- Auth: Sign In Modal ---
function openSignInModal() {
  playClickSound();
  document.getElementById('signInModal').classList.add('active');
}

function closeSignInModal() {
  playClickSound();
  document.getElementById('signInModal').classList.remove('active');
}

function signInAndNavigate() {
  const email = document.getElementById('emailInput').value.trim();
  const pass = document.getElementById('passInput').value;
  const user = users.find(u => u.email === email && u.password === pass);
  if (!user) {
    alert(getText('invalidCredentials', 'Invalid login details.'));
    return;
  }
  playClickSound();
  saveCurrentUser(user);
  closeSignInModal();
  navigateToStore(user);
}

function enterAsGuest() {
  playClickSound();
  saveCurrentUser(null);
  closeSignInModal();
  navigateToStore(null);
}

// --- Auth: Create Account Modal ---
function openCreateModal() {
  playClickSound();
  document.getElementById('createModal').classList.add('active');
}

function closeCreateModal() {
  playClickSound();
  document.getElementById('createModal').classList.remove('active');
}

function createAccountAndNavigate() {
  const first = document.getElementById('firstName').value.trim();
  const last = document.getElementById('lastName').value.trim();
  const email = document.getElementById('createEmail').value.trim();
  const pass = document.getElementById('createPass').value;
  if (!first || !last || !email || !pass) {
    alert(getText('fillAll', 'Please fill in all fields.'));
    return;
  }
  if (users.find(u => u.email === email)) {
    alert(getText('emailExists', 'This email is already registered.'));
    return;
  }
  playClickSound();
  const user = { firstName: first, lastName: last, email, password: pass, description: '', photo: 'https://via.placeholder.com/48x48?text=User' };
  users.push(user);
  saveUsers();
  saveCurrentUser(user);
  closeCreateModal();
  navigateToStore(user);
}

// --- Navigate to Store ---
function navigateToStore(user) {
  document.getElementById('authSection').classList.remove('active');
  document.getElementById('storeSection').classList.add('active');
  const name = user ? `${user.firstName} ${user.lastName}` : 'Guest';
  const photo = user && user.photo ? user.photo : 'https://via.placeholder.com/48x48?text=User';
  document.getElementById('userDisplayName').textContent = name;
  document.getElementById('userAvatar').src = photo;
  updatePurchaseCounter();
}

// --- Back to Auth ---
function backToAuth() {
  playClickSound();
  document.getElementById('storeSection').classList.remove('active');
  document.getElementById('authSection').classList.add('active');
}

// --- Open Products Grid (2x2) ---
function openCategoryProducts(categoryId) {
  playClickSound();
  document.getElementById('storeSection').classList.remove('active');
  document.getElementById('productsPage').classList.add('active');
  const list = PRODUCTS_BY_CATEGORY[categoryId] || [];
  const grid = document.getElementById('productsGrid');
  grid.innerHTML = '';
  list.forEach(p => {
    const div = document.createElement('div');
    div.className = 'product-item';
    div.onclick = () => {
      playClickSound();
      openProductDetail(p);
    };
    div.innerHTML = `
      <img src="${p.img}" alt="${escapeHtml(p.name)}">
      <div class="product-item-info">
        <h4>${escapeHtml(p.name)}</h4>
        <p class="product-item-price">${p.price} MAD</p>
      </div>
    `;
    grid.appendChild(div);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function backToStore() {
  playClickSound();
  document.getElementById('productsPage').classList.remove('active');
  document.getElementById('storeSection').classList.add('active');
  updatePurchaseCounter();
}

// --- Product Detail ---
function openProductDetail(product) {
  currentProduct = product;
  document.getElementById('productName').textContent = product.name;
  document.getElementById('productPrice').textContent = product.price + ' MAD';
  document.getElementById('productPercent').textContent = product.percent || '';
  document.getElementById('productCity').textContent = product.city || '';
  document.getElementById('productPhone').textContent = product.phone || '';
  document.getElementById('productDetailImg').src = product.img;
  document.getElementById('productDetailImg').alt = product.name;
  document.getElementById('productDetailOverlay').classList.add('active');
}

function closeProductDetail() {
  playClickSound();
  document.getElementById('productDetailOverlay').classList.remove('active');
  currentProduct = null;
}

// --- Place Order (Buy): mailto + toast + add to purchases ---
const ORDER_EMAIL = 'mondiraghbalou@gmail.com';

function placeOrder() {
  if (!currentProduct) return;
  playClickSound();
  const userName = document.getElementById('userDisplayName').textContent || 'Guest';
  const userPhone = currentProduct.phone || '+212 638-106874';
  const city = currentProduct.city || '';
  const subject = `Order: ${currentProduct.name}`;
  const body = `Order Request from AR Store

Product: ${currentProduct.name}
Price: ${currentProduct.price} MAD
Product Image: ${currentProduct.img}

Customer:
- Name: ${userName}
- Phone: ${userPhone}
- City: ${city}`;

  const mailto = `mailto:${ORDER_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = mailto;

  // Add to purchases
  purchases.push({
    name: currentProduct.name,
    img: currentProduct.img,
    price: currentProduct.price,
    date: new Date().toISOString()
  });
  savePurchases();
  updatePurchaseCounter();

  // Show confirmation toast
  playNotificationSound();
  const toast = document.getElementById('orderToast');
  document.getElementById('orderToastText').textContent = getText('orderConfirmed', 'Your order has been confirmed. Our site administrator will contact you.');
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 4000);

  closeProductDetail();
}

// --- Purchase counter ---
function updatePurchaseCounter() {
  const el = document.getElementById('purchaseCount');
  if (el) el.textContent = purchases.length;
}

// --- My Purchases ---
function openMyPurchases() {
  playClickSound();
  playNotificationSound();
  document.getElementById('purchasesTotal').textContent = purchases.length;
  const list = document.getElementById('purchasesList');
  list.innerHTML = '';
  if (purchases.length === 0) {
    list.innerHTML = `<p style="padding:20px;color:#888;text-align:center;">${getText('noPurchases', 'You have no purchases yet.')}</p>`;
  } else {
    purchases.forEach((p, i) => {
      const card = document.createElement('div');
      card.className = 'purchase-item-card';
      card.onclick = () => playClickSound();
      const name = typeof p === 'object' ? p.name : p;
      const img = typeof p === 'object' ? p.img : '';
      card.innerHTML = `
        <div class="purchase-info">
          ${img ? `<img src="${img}" alt="">` : ''}
          <span>${escapeHtml(name)}</span>
        </div>
      `;
      list.appendChild(card);
    });
  }
  document.getElementById('purchasesModal').classList.add('active');
}

function closeMyPurchases() {
  playClickSound();
  document.getElementById('purchasesModal').classList.remove('active');
}

// --- My Account ---
function openMyAccount() {
  playClickSound();
  const user = currentUser;
  document.getElementById('accountName').value = user ? `${user.firstName} ${user.lastName}` : '';
  document.getElementById('accountDesc').value = user && user.description ? user.description : '';
  document.getElementById('accountAvatar').src = user && user.photo ? user.photo : 'https://via.placeholder.com/100x100?text=User';
  document.getElementById('myAccountModal').classList.add('active');
}

function closeMyAccount() {
  playClickSound();
  document.getElementById('myAccountModal').classList.remove('active');
}

function handleAvatarChange(e) {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  document.getElementById('accountAvatar').src = url;
  if (currentUser) {
    currentUser.photo = url;
    saveCurrentUser(currentUser);
  }
}

function saveAccountAndClose() {
  playClickSound();
  const nameInput = document.getElementById('accountName').value.trim();
  const descInput = document.getElementById('accountDesc').value.trim();
  if (currentUser) {
    const parts = nameInput.split(/\s+/);
    currentUser.firstName = parts[0] || currentUser.firstName;
    currentUser.lastName = parts.slice(1).join(' ') || currentUser.lastName;
    currentUser.description = descInput;
    currentUser.photo = document.getElementById('accountAvatar').src;
    const idx = users.findIndex(u => u.email === currentUser.email);
    if (idx >= 0) users[idx] = currentUser;
    saveUsers();
    saveCurrentUser(currentUser);
    document.getElementById('userDisplayName').textContent = nameInput || 'Guest';
    document.getElementById('userAvatar').src = currentUser.photo;
  } else {
    document.getElementById('userDisplayName').textContent = nameInput || 'Guest';
    document.getElementById('userAvatar').src = document.getElementById('accountAvatar').src;
  }
  closeMyAccount();
}

// --- Help Modal ---
function openHelpModal() {
  playClickSound();
  playNotificationSound();
  document.getElementById('helpModal').classList.add('active');
}

function closeHelpModal() {
  playClickSound();
  document.getElementById('helpModal').classList.remove('active');
}

// --- Multi-language ---
let currentLang = localStorage.getItem('ar_store_lang') || 'en';

const TRANSLATIONS = {
  en: {
    welcomeTitle: 'Welcome to AR Store',
    authSubtitle: 'Mondir AR — Your trusted marketplace',
    signIn: 'Sign In',
    createAccount: 'Create Account',
    continue: 'Continue',
    guest: 'Continue as Guest',
    back: 'Back',
    myAccount: 'My Account',
    myPurchases: 'My Purchases',
    help: 'Help',
    invalidCredentials: 'Invalid login details.',
    fillAll: 'Please fill in all fields.',
    emailExists: 'This email is already registered.',
    backToStore: 'Back to Store',
    orderConfirmed: 'Your order has been confirmed. Our site administrator will contact you.',
    noPurchases: 'You have no purchases yet.',
    save: 'Save',
    close: 'Close',
    helpTitle: 'Help & Support',
    helpTagline: 'نحن دائما في خدمتكم',
    purchasesTitle: 'My Purchases',
    placeholderEmail: 'Email',
    placeholderPassword: 'Password',
    placeholderFirstName: 'First Name',
    placeholderLastName: 'Last Name',
    placeholderAbout: 'About you',
    orderBtnText: 'Order'
  },
  ar: {
    welcomeTitle: 'مرحباً بكم في متجر AR',
    authSubtitle: 'مندير AR — سوقكم الموثوق',
    signIn: 'تسجيل الدخول',
    createAccount: 'إنشاء حساب',
    continue: 'متابعة',
    guest: 'الدخول كضيف',
    back: 'رجوع',
    myAccount: 'حسابي',
    myPurchases: 'مشترياتي',
    help: 'مساعدة',
    invalidCredentials: 'بيانات غير صحيحة!',
    fillAll: 'يرجى ملء جميع الحقول',
    emailExists: 'البريد مسجل مسبقاً',
    backToStore: 'العودة للمتجر',
    orderConfirmed: 'تم تأكيد طلبك، سيتواصل معك مسؤول الموقع',
    noPurchases: 'لا توجد مشتريات بعد.',
    save: 'حفظ',
    close: 'إغلاق',
    helpTitle: 'المساعدة والدعم',
    helpTagline: 'نحن دائما في خدمتكم',
    purchasesTitle: 'مشترياتي',
    placeholderEmail: 'البريد الإلكتروني',
    placeholderPassword: 'كلمة المرور',
    placeholderFirstName: 'الاسم',
    placeholderLastName: 'اللقب',
    placeholderAbout: 'نبذة عنك',
    orderBtnText: 'طلب'
  },
  fr: {
    welcomeTitle: 'Bienvenue sur AR Store',
    authSubtitle: 'Mondir AR — Votre marketplace de confiance',
    signIn: 'Connexion',
    createAccount: 'Créer un compte',
    continue: 'Continuer',
    guest: 'Continuer en invité',
    back: 'Retour',
    myAccount: 'Mon compte',
    myPurchases: 'Mes achats',
    help: 'Aide',
    invalidCredentials: 'Identifiants incorrects !',
    fillAll: 'Veuillez remplir tous les champs',
    emailExists: 'Email déjà enregistré',
    backToStore: 'Retour au magasin',
    orderConfirmed: 'Votre produit est confirmé, l\'administrateur du site vous contactera',
    noPurchases: 'Aucun achat pour le moment.',
    save: 'Enregistrer',
    close: 'Fermer',
    helpTitle: 'Aide et support',
    helpTagline: 'نحن دائما في خدمتكم',
    purchasesTitle: 'Mes achats',
    placeholderEmail: 'Email',
    placeholderPassword: 'Mot de passe',
    placeholderFirstName: 'Prénom',
    placeholderLastName: 'Nom',
    placeholderAbout: 'À propos de vous',
    orderBtnText: 'Commander'
  }
};

function getText(key, fallback) {
  const t = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
  return t[key] != null ? t[key] : fallback;
}

function setLanguage(lang) {
  playClickSound();
  currentLang = lang;
  localStorage.setItem('ar_store_lang', lang);
  document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === lang));
  applyTranslations();
}

function applyTranslations() {
  const t = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
  const map = {
    welcomeTitle: 'welcomeTitle',
    authSubtitle: 'authSubtitle',
    loginBtnText: 'signIn',
    createAccountBtnText: 'createAccount',
    continueBtnText: 'continue',
    guestBtnText: 'guest',
    backBtnText: 'back',
    createSubmitText: 'createAccount',
    backCreateText: 'back',
    myAccountLink: 'myAccount',
    myPurchasesText: 'myPurchases',
    helpLink: 'help',
    backToAuth: 'back',
    backToStoreText: 'backToStore',
    closeDetailText: 'close',
    saveAccountText: 'save',
    closeAccountText: 'close',
    closeHelpText: 'close',
    purchasesTitle: 'purchasesTitle',
    closePurchasesText: 'close',
    orderBtnText: 'Order'
  };
  Object.keys(map).forEach(id => {
    const el = document.getElementById(id);
    const key = map[id];
    if (el && t[key]) el.textContent = t[key];
  });
  const signTitle = document.getElementById('signInTitle');
  if (signTitle) signTitle.textContent = t.signIn;
  const createTitle = document.getElementById('createTitle');
  if (createTitle) createTitle.textContent = t.createAccount;
  const helpTitle = document.getElementById('helpTitle');
  if (helpTitle) helpTitle.textContent = t.helpTitle;
  const helpTagline = document.getElementById('helpTagline');
  if (helpTagline) helpTagline.textContent = t.helpTagline;
  const placeholders = {
    emailInput: 'placeholderEmail',
    passInput: 'placeholderPassword',
    firstName: 'placeholderFirstName',
    lastName: 'placeholderLastName',
    createEmail: 'placeholderEmail',
    createPass: 'placeholderPassword',
    accountName: 'placeholderFirstName',
    accountDesc: 'placeholderAbout'
  };
  Object.keys(placeholders).forEach(id => {
    const el = document.getElementById(id);
    const key = placeholders[id];
    if (el && t[key]) el.placeholder = t[key];
  });
}

// --- Init ---
function init() {
  updatePurchaseCounter();
  setLanguage(currentLang);
  document.querySelectorAll('.lang-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.lang === currentLang);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
