// Sula Desk — Pro license check for the web app.
//
// Same LemonSqueezy license-key API and the same rules as the extension's
// license.js: activate once, trust the cached result for a day, re-validate
// after that, and never lock out a paying user because the network failed.
// The key lives in this browser's localStorage only.
//
// window.SulaWebLicense

(() => {
  "use strict";

  const LS_API = "https://api.lemonsqueezy.com/v1/licenses";
  const KEY = "sula_desk_license";
  const VALIDATE_EVERY_MS = 24 * 60 * 60 * 1000;
  const CHECKOUT = {
    monthly: "https://sula.lemonsqueezy.com/checkout/buy/47598c36-6163-4f4e-93de-9266450ebfaa",
    annual: "https://sula.lemonsqueezy.com/checkout/buy/ac76da47-0b68-4431-8728-a2b8d6ad5ecf",
  };

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (_) { return null; }
  }
  function write(v) {
    try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); return true; }
    catch (_) { return false; }
  }

  function form(params) {
    return {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params),
    };
  }

  function friendly(err) {
    const e = String(err || "").toLowerCase();
    if (e.includes("activation limit")) return "This key is already active on its maximum number of devices. Deactivate it somewhere else first.";
    if (e.includes("expired")) return "This license has expired.";
    if (e.includes("disabled")) return "This license has been disabled.";
    if (e.includes("not found") || e.includes("invalid")) return "That key wasn't recognised. Check it against your purchase email.";
    return "The key couldn't be activated. Check it and try again.";
  }

  async function activate(rawKey) {
    const license_key = String(rawKey || "").trim();
    if (!license_key) return { ok: false, error: "Enter your license key." };
    try {
      const r = await fetch(`${LS_API}/activate`, form({ license_key, instance_name: "Sula Desk (web)" })).then((x) => x.json());
      if (r && r.activated) {
        write({ key: license_key, instanceId: r.instance && r.instance.id, pro: true, checked: Date.now() });
        return { ok: true };
      }
      return { ok: false, error: friendly(r && r.error) };
    } catch (_) {
      return { ok: false, error: "Network error. Try again." };
    }
  }

  async function isPro() {
    const lic = read();
    if (!lic || !lic.pro) return false;
    if (Date.now() - (lic.checked || 0) < VALIDATE_EVERY_MS) return true;
    try {
      const r = await fetch(`${LS_API}/validate`, form({ license_key: lic.key, instance_id: lic.instanceId })).then((x) => x.json());
      const ok = !!(r && r.valid && r.license_key && r.license_key.status === "active");
      write({ ...lic, pro: ok, checked: Date.now() });
      return ok;
    } catch (_) {
      return true; // offline: don't punish a paying user
    }
  }

  async function deactivate() {
    const lic = read();
    if (lic && lic.key && lic.instanceId) {
      try { await fetch(`${LS_API}/deactivate`, form({ license_key: lic.key, instance_id: lic.instanceId })); } catch (_) { /* release locally anyway */ }
    }
    write(null);
    return { ok: true };
  }

  function maskedKey() {
    const lic = read();
    return lic && lic.key ? "…" + lic.key.slice(-6) : "";
  }

  window.SulaWebLicense = { activate, isPro, deactivate, maskedKey, CHECKOUT };
})();
