// Find Me People — post-uninstall survey
//
// Loaded by uninstall.html, which Chrome opens when someone removes the
// extension (chrome.runtime.setUninstallURL). This file is intentionally
// external: the site CSP is `script-src 'self'`, so inline scripts are blocked.
//
// Data collection is OFF by default. The page works fully without a backend —
// it just thanks the user. To actually record responses, set COLLECT_ENDPOINT
// to a SAME-ORIGIN path (CSP is `connect-src 'self'` / `form-action 'none'`,
// so cross-origin posts are blocked). The natural fit is the planned Cloudflare
// Worker (see SECURITY-HEADERS.md): point it at "/api/uninstall". For a quick
// third-party form host instead (Formspree/Tally), see UNINSTALL-SURVEY.md —
// that path requires a small, documented CSP relaxation.
const COLLECT_ENDPOINT = ""; // e.g. "/api/uninstall" once the Worker is live

// Human-readable labels, kept beside the machine values so a stored row is
// self-explanatory without needing this file as a legend.
const REASON_LABELS = {
  not_using: "Wasn't using it enough",
  no_results: "Didn't find the contacts I needed",
  performance: "Too slow / slowed the browser",
  found_alternative: "Found a better alternative",
  privacy: "Privacy or permissions concerns",
  one_time: "Only needed it once",
  confusing: "Confusing or hard to use",
  bug: "Something was broken",
  other: "Other",
};

(function () {
  "use strict";

  const form = document.getElementById("survey");
  const submitBtn = document.getElementById("submit");
  const comment = document.getElementById("comment");
  const thanks = document.getElementById("thanks");
  const thanksTitle = document.getElementById("thanks-title");
  const thanksBody = document.getElementById("thanks-body");
  if (!form || !submitBtn) return;

  // Extension version is passed as ?v=<version> by setUninstallURL.
  const version = new URLSearchParams(location.search).get("v") || "unknown";

  const selectedReason = () => {
    const el = form.querySelector('input[name="reason"]:checked');
    return el ? el.value : "";
  };

  // Enable submit once there's something to send (a reason or a comment).
  const refresh = () => {
    submitBtn.disabled = !selectedReason() && !comment.value.trim();
  };
  form.addEventListener("change", refresh);
  comment.addEventListener("input", refresh);
  refresh();

  // Tailor the thank-you copy for the "it was broken" path — that's the one
  // reason where a reply from us can actually fix the user's problem.
  function showThanks(reason) {
    if (reason === "bug") {
      thanksTitle.textContent = "Sorry it broke — thank you for flagging it.";
      thanksBody.textContent =
        "If you can spare one more line about what went wrong, email us and we'll dig in.";
    }
    form.classList.add("hide");
    thanks.classList.add("show");
    thanks.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function send(payload) {
    if (!COLLECT_ENDPOINT) return; // collection disabled — UI still completes
    try {
      await fetch(COLLECT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        // keepalive lets the POST finish even though we navigate/close right after.
        keepalive: true,
      });
    } catch (_) {
      // Never block the thank-you on a network hiccup; this is best-effort.
    }
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    const reason = selectedReason();

    // Deliberately minimal + anonymous: reason, free-text comment, version,
    // and a timestamp. No name, email, IP-on-purpose, UA, or page history.
    const payload = {
      reason: reason || "unspecified",
      reasonLabel: REASON_LABELS[reason] || "Unspecified",
      comment: comment.value.trim().slice(0, 1000),
      version: version,
      submittedAt: new Date().toISOString(),
    };

    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";
    send(payload).finally(() => showThanks(reason));
  });
})();
