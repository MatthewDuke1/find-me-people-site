// Cloudflare Worker — post-uninstall survey collector for Find Me People.
//
// Serves https://find-me-people.com/api/uninstall, same-origin with the static
// site on GitHub Pages (once the zone is on Cloudflare — see ../README.md).
// The uninstall.html page POSTs an anonymous survey row here; we store it in
// D1. No PII is accepted or stored: reason, comment, version, timestamp only.

// Only the values uninstall.js can send. Anything else is normalized away so a
// junk client can't write arbitrary categories.
const ALLOWED_REASONS = new Set([
  "not_using", "no_results", "performance", "found_alternative",
  "privacy", "one_time", "confusing", "bug", "other", "unspecified",
]);

// Soft anti-spam: the real survey is served from our own origin, so a genuine
// browser POST carries one of these Origin values. Not bulletproof (a non-
// browser client can forge Origin), but it turns away casual cross-site noise.
const ALLOWED_ORIGINS = new Set([
  "https://find-me-people.com",
  "https://www.find-me-people.com",
]);

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const origin = request.headers.get("Origin");
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return new Response("Forbidden", { status: 403 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response("Bad Request", { status: 400 });
    }

    // Sanitize + clamp everything. Whitelist the reason; cap free text.
    const reason = ALLOWED_REASONS.has(body && body.reason) ? body.reason : "unspecified";
    const reasonLabel = String((body && body.reasonLabel) || "").slice(0, 80);
    const comment = String((body && body.comment) || "").slice(0, 1000);
    const version = String((body && body.version) || "unknown").slice(0, 20);
    const submittedAt = new Date().toISOString(); // server clock — don't trust client time

    try {
      await env.DB.prepare(
        "INSERT INTO uninstalls (reason, reason_label, comment, version, submitted_at) " +
        "VALUES (?, ?, ?, ?, ?)"
      ).bind(reason, reasonLabel, comment, version, submittedAt).run();
    } catch (_) {
      // The page ignores our response body anyway; don't leak internals.
      return new Response(null, { status: 500 });
    }

    return new Response(null, { status: 204 });
  },
};
