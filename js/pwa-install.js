(function initPwaInstall() {
  let deferredPrompt = null;
  const banner = document.getElementById("pwaInstallBanner");
  const bannerInstall = document.getElementById("pwaBannerInstall");
  const bannerClose = document.getElementById("pwaBannerClose");
  const installBtn = document.getElementById("pwaInstallBtn");
  const iosHint = document.getElementById("pwaInstallIos");
  const panel = document.getElementById("installAppPanel");

  function t(key) {
    const lang = localStorage.getItem("arStoreLang") || "en";
    const tr = window.TRANSLATIONS || {};
    return (tr[lang] && tr[lang][key]) || (tr.en && tr.en[key]) || key;
  }

  function isStandalone() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  }

  function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }

  function updateInstallUI() {
    const standalone = isStandalone();
    if (panel) panel.style.display = standalone ? "none" : "";
    if (installBtn) {
      installBtn.disabled = standalone;
      installBtn.textContent = standalone ? t("installAppDone") : t("installAppBtn");
    }
    if (iosHint) iosHint.style.display = !standalone && isIos() ? "block" : "none";
    if (banner && (standalone || localStorage.getItem("pwaBannerDismissed") === "1")) {
      banner.style.display = "none";
    }
  }

  async function promptInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      deferredPrompt = null;
      if (banner) banner.style.display = "none";
      if (outcome === "accepted") localStorage.setItem("pwaBannerDismissed", "1");
      updateInstallUI();
      return;
    }
    if (isIos()) {
      if (typeof window.showToast === "function") {
        window.showToast(t("installAppIosShort"));
      }
      return;
    }
    if (typeof window.showToast === "function") {
      window.showToast(t("installAppChromeHint"));
    }
  }

  window.promptPwaInstall = promptInstall;
  window.updatePwaInstallUI = updateInstallUI;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    updateInstallUI();
    if (banner && !isStandalone() && localStorage.getItem("pwaBannerDismissed") !== "1") {
      banner.style.display = "flex";
    }
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    localStorage.setItem("pwaBannerDismissed", "1");
    if (banner) banner.style.display = "none";
    updateInstallUI();
    if (typeof window.showToast === "function") window.showToast(t("installAppSuccess"));
  });

  if (installBtn) installBtn.addEventListener("click", (e) => { e.preventDefault(); promptInstall(); });
  if (bannerInstall) bannerInstall.addEventListener("click", () => promptInstall());
  if (bannerClose) {
    bannerClose.addEventListener("click", () => {
      localStorage.setItem("pwaBannerDismissed", "1");
      if (banner) banner.style.display = "none";
    });
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }

  document.addEventListener("DOMContentLoaded", updateInstallUI);
  updateInstallUI();
})();
