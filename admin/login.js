/**
 * Admin login — requires valid server JWT when server is online
 */
(function () {
  const SESSION_KEY = "arStoreAdminSession";
  const ATTEMPTS_KEY = "arStoreAdminLoginAttempts";
  const DEFAULT_USER = "Mondir AR";
  const DEFAULT_PASS = "ARSTORE";

  function adminEmail(username) {
    const u = String(username || "").trim();
    if (u.includes("@")) return u.toLowerCase();
    if (/^mondir\s*ar$/i.test(u) || u === "MondirAR") return "admin@arstore.local";
    return "admin@arstore.local";
  }

  function setFeedback(msg) {
    const fb = document.getElementById("loginFeedback");
    if (fb) fb.textContent = String(msg || "");
  }

  async function pingServer() {
    try {
      const res = await fetch("/api/health");
      return res.ok;
    } catch (_e) {
      return false;
    }
  }

  async function doLogin() {
    const btn = document.getElementById("loginSubmitBtn");
    const username = String(document.getElementById("loginUser")?.value || "").trim();
    const pass = String(document.getElementById("loginPass")?.value || "");

    if (!username || !pass) {
      setFeedback("Enter username and password.");
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = "Signing in…";
    }
    setFeedback("");

    try {
      if (window.ARStoreSync?.loginAdmin) {
        const data = await ARStoreSync.loginAdmin(username, pass);
        localStorage.setItem(
          SESSION_KEY,
          JSON.stringify({
            username: data.user?.fullName || username,
            token: "server",
            createdAt: Date.now()
          })
        );
        localStorage.removeItem(ATTEMPTS_KEY);
        window.location.reload();
        return;
      }

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmail(username), password: pass })
      });

      let data = {};
      try {
        data = await res.json();
      } catch (_e) {}

      if (res.ok && data.user?.role === "ADMIN" && data.token) {
        if (window.ARStoreSync?.setAdminToken) ARStoreSync.setAdminToken(data.token);
        else localStorage.setItem("arStoreAdminJwt", data.token);
        localStorage.setItem(
          SESSION_KEY,
          JSON.stringify({
            username: data.user.fullName || username,
            token: "server",
            createdAt: Date.now()
          })
        );
        localStorage.removeItem(ATTEMPTS_KEY);
        window.location.reload();
        return;
      }

      if (res.status === 401) {
        setFeedback("Invalid username or password.");
        return;
      }

      setFeedback(data.error || `Login failed (${res.status}). Check server is running.`);
    } catch (err) {
      console.error(err);
      const serverUp = await pingServer();
      const localOk =
        (username === DEFAULT_USER ||
          username === "MondirAR" ||
          username.toLowerCase() === "admin@arstore.local") &&
        pass === DEFAULT_PASS;

      if (serverUp) {
        setFeedback(
          err.message === "Not an admin account"
            ? "This account is not an admin."
            : "Login failed. Check your username and password."
        );
        return;
      }

      if (localOk) {
        if (window.ARStoreSync?.setAdminToken) ARStoreSync.setAdminToken("");
        else localStorage.removeItem("arStoreAdminJwt");
        localStorage.setItem(
          SESSION_KEY,
          JSON.stringify({ username: DEFAULT_USER, token: "offline", createdAt: Date.now() })
        );
        localStorage.removeItem(ATTEMPTS_KEY);
        window.location.reload();
        return;
      }

      setFeedback("Cannot reach server. Run START-SERVER.bat on the PC, then open /admin/ from the same address.");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Login";
      }
    }
  }

  function clearLock() {
    localStorage.removeItem(ATTEMPTS_KEY);
    setFeedback("Login lock cleared. Try again.");
  }

  window.submitAdminLogin = doLogin;
  window.clearLoginAttempts = clearLock;

  function bindForm() {
    const form = document.getElementById("loginForm");
    if (!form || form.dataset.loginBound === "1") return;
    form.dataset.loginBound = "1";
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      doLogin();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindForm);
  } else {
    bindForm();
  }
})();
