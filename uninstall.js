// Sula post-uninstall survey — client.
//
// Sends an anonymous row to the same-origin collector Worker at
// /api/uninstall (see worker/uninstall/). Anonymous by design: reason,
// optional comment, and the extension version from ?v= — no identifiers.
//
// Flow: tap a reason -> it's recorded immediately (so a one-tap answer counts
// even if the person leaves), and a comment box appears for anything more.
// Sending the comment updates the same submission. Fully external (no inline
// script) so it works under a strict script-src 'self' CSP.

(function () {
  "use strict";

  var ENDPOINT = "/api/uninstall";
  var version = "unknown";
  try {
    var v = new URLSearchParams(location.search).get("v");
    if (v) version = v.slice(0, 20);
  } catch (_e) { /* no query params — leave "unknown" */ }

  var reasons = document.getElementById("reasons");
  var commentWrap = document.getElementById("commentWrap");
  var commentEl = document.getElementById("comment");
  var sendBtn = document.getElementById("send");
  var thanks = document.getElementById("thanks");

  var chosen = null; // { reason, label }

  function post(payload) {
    // Fire-and-forget; keepalive so it still sends if the tab is closing.
    try {
      return fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(function () { /* offline / blocked — nothing we can do */ });
    } catch (_e) {
      return Promise.resolve();
    }
  }

  function selectReason(btn) {
    chosen = { reason: btn.getAttribute("data-reason"), label: btn.getAttribute("data-label") };
    Array.prototype.forEach.call(reasons.querySelectorAll("button"), function (b) {
      b.classList.toggle("selected", b === btn);
    });
    // Record the bare reason right away — a one-tap answer should count even
    // if they never write a comment or hit send.
    post({ reason: chosen.reason, reasonLabel: chosen.label, comment: "", version: version });
    commentWrap.hidden = false;
    commentEl.focus();
  }

  Array.prototype.forEach.call(reasons.querySelectorAll("button"), function (btn) {
    btn.addEventListener("click", function () { selectReason(btn); });
  });

  sendBtn.addEventListener("click", function () {
    if (!chosen) return;
    var comment = (commentEl.value || "").slice(0, 1000);
    sendBtn.disabled = true;
    post({ reason: chosen.reason, reasonLabel: chosen.label, comment: comment, version: version })
      .then(function () {
        reasons.hidden = true;
        commentWrap.hidden = true;
        thanks.hidden = false;
      });
  });
})();
