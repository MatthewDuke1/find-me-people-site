# Post-uninstall survey

When someone removes the extension, Chrome opens
`https://find-me-people.com/uninstall.html?v=<version>` in a new tab — a short,
anonymous, optional "why did you leave?" survey. This is the standard
`chrome.runtime.setUninstallURL` mechanism (set in the extension's
`background.js`).

## Pieces

| Where | File | Role |
|---|---|---|
| Extension (`find-me-people`) | `background.js` | `chrome.runtime.setUninstallURL("https://find-me-people.com/uninstall.html?v=<version>")` at service-worker startup. No new permissions; the extension sends nothing. |
| Site (this repo) | `uninstall.html` | The branded survey page (curated reasons + optional comment). |
| Site (this repo) | `uninstall.js` | Survey logic. External because the site CSP is `script-src 'self'` (no inline JS). |

The reason list mirrors what mature Chrome extensions ask on uninstall (Grammarly,
Loom, Honey, etc.): *not using it, didn't find what I needed, performance, found
a better tool, privacy/permissions, one-time use, confusing, broken, other.*

## Data collection is OFF by default

The page is fully functional with **no backend** — it just thanks the user.
Nothing is sent anywhere until you set one constant. This keeps the privacy-first
posture intact: shipping the UI carries zero data-collection surface.

To turn collection on, set `COLLECT_ENDPOINT` near the top of `uninstall.js`.

The payload is deliberately minimal and anonymous:

```json
{
  "reason": "bug",
  "reasonLabel": "Something was broken",
  "comment": "the side panel didn't open on Gmail",
  "version": "1.6.0",
  "submittedAt": "2026-06-19T17:04:00.000Z"
}
```

No name, email, IP-on-purpose, user-agent, or browsing history.

## Option A — Cloudflare Worker (recommended, same-origin, no CSP change)

This is the natural fit once the domain is routed through Cloudflare (already the
plan in `SECURITY-HEADERS.md`). Because the endpoint is **same-origin**, it
satisfies the existing `connect-src 'self'` CSP with **no relaxation**.

1. In `uninstall.js`: `const COLLECT_ENDPOINT = "/api/uninstall";`
2. Add a Worker route `find-me-people.com/api/uninstall` that accepts the POST
   and appends to storage (KV, D1, a Google Sheet via API, a Discord/Slack
   webhook — your call). Minimal Worker:

   ```js
   export default {
     async fetch(req, env) {
       if (req.method !== "POST") return new Response("ok");
       const body = await req.json().catch(() => null);
       if (body) await env.UNINSTALLS.put(crypto.randomUUID(), JSON.stringify(body));
       return new Response(null, { status: 204 });
     }
   };
   ```
   (`UNINSTALLS` = a KV namespace binding.)

No HTML/CSP edits required.

## Option B — Third-party form host (Formspree / Tally), needs a CSP delta

If you'd rather not run a Worker, point `COLLECT_ENDPOINT` at a form host. Because
that's **cross-origin**, you must widen the CSP on `uninstall.html` (only that
page) so the `fetch` is allowed:

1. In `uninstall.js`: `const COLLECT_ENDPOINT = "https://formspree.io/f/<id>";`
2. In `uninstall.html`'s CSP `<meta>`, change `connect-src 'self'` to
   `connect-src 'self' https://formspree.io` (swap the host for your provider).
   Leave the other pages' CSP untouched.

Trade-off: a third-party origin now receives the (anonymous) survey POST. Option A
keeps everything first-party, which is why it's the default recommendation for a
privacy-positioned product.

## Testing the full loop

1. Load the extension unpacked → `chrome://extensions` → **Remove**.
2. A tab opens to `find-me-people.com/uninstall.html?v=1.6.0`.
3. Pick a reason → **Send feedback** → the thank-you state appears (and, if
   `COLLECT_ENDPOINT` is set, the POST lands in your store).
4. The "Something was broken" reason swaps in bug-specific thank-you copy + an
   email CTA.

To preview locally without uninstalling, just open
`http://localhost:8000/uninstall.html?v=test`.
