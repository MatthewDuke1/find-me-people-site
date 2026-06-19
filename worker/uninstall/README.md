# Uninstall-survey collector (Cloudflare Worker + D1)

Same-origin backend for the post-uninstall survey. Receives the anonymous POST
from `uninstall.html` at `https://find-me-people.com/api/uninstall` and stores it
in a D1 (SQLite) table. No PII — reason, comment, version, timestamp only.

```
worker/uninstall/
  src/index.js     the Worker
  schema.sql       D1 table
  wrangler.toml    config (name, route, D1 binding)
```

## Prerequisites
- Node.js (already installed).
- A free Cloudflare account.

---

## Part A — Put `find-me-people.com` on Cloudflare (one-time, ~30 min)

The domain is currently on **Route 53 DNS → GitHub Pages**. The Worker can only
answer `find-me-people.com/api/...` if Cloudflare fronts the zone. This is the
same migration as `SECURITY-HEADERS.md` (it also gets you the A-grade headers).

1. https://dash.cloudflare.com → **Add a site** → `find-me-people.com` → Free plan.
2. Cloudflare imports DNS. Confirm the GitHub Pages **A records** are present and
   set them **Proxied** (orange cloud):
   `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   (plus the `www` CNAME → `matthewduke1.github.io`, proxied).
3. Cloudflare shows two nameservers (e.g. `xxx.ns.cloudflare.com`). At your
   **registrar** (where the domain is registered — currently using AWS NS),
   replace the nameservers with the Cloudflare pair. Wait for propagation
   (~15 min–2 hr).
4. **SSL/TLS → Overview → Full**; **Edge Certificates → Always Use HTTPS → On**.
5. (Bonus, while you're here) add the response-header Transform Rules from
   `SECURITY-HEADERS.md` to take the security grade F → A.

> Verify GitHub Pages still serves: `https://find-me-people.com/` should load
> normally through Cloudflare before continuing.

---

## Part B — Deploy the Worker

Run from `worker/uninstall/`.

```sh
npm install -g wrangler        # or use: npx wrangler@latest <cmd>
wrangler login                 # opens a browser to authorize your account

# 1) Create the D1 database, then paste the printed database_id into wrangler.toml
wrangler d1 create fmp-uninstalls

# 2) Create the table (--remote = the real D1, not a local dev copy)
wrangler d1 execute fmp-uninstalls --remote --file=./schema.sql

# 3) Deploy (also binds the find-me-people.com/api/uninstall route)
wrangler deploy
```

### Smoke test
```sh
curl -i -X POST https://find-me-people.com/api/uninstall \
  -H "Content-Type: application/json" \
  -d '{"reason":"bug","reasonLabel":"Something was broken","comment":"smoke test","version":"test"}'
# expect: HTTP/1.1 204

wrangler d1 execute fmp-uninstalls --remote \
  --command "SELECT * FROM uninstalls ORDER BY id DESC LIMIT 5"
# expect: your test row
```

---

## Part C — Turn collection on in the site

One line in `../../uninstall.js`:

```js
const COLLECT_ENDPOINT = "/api/uninstall";
```

Commit + merge. No CSP change is needed — the endpoint is same-origin, so the
existing `connect-src 'self'` already allows it.

---

## Reading the data later

```sh
# Reason breakdown
wrangler d1 execute fmp-uninstalls --remote --command \
  "SELECT reason, COUNT(*) c FROM uninstalls GROUP BY reason ORDER BY c DESC"

# Recent comments (the actionable bit)
wrangler d1 execute fmp-uninstalls --remote --command \
  "SELECT submitted_at, reason, comment FROM uninstalls WHERE comment != '' ORDER BY id DESC LIMIT 50"
```

## Cost / scale
Free tier: Workers 100k req/day, **D1 100k writes/day**. One uninstall = one
write. Comfortably covers any realistic FMP volume; Workers Paid ($5/mo) is 10M+
if it ever became a hit.

## Notes
- The page works with collection **off** (`COLLECT_ENDPOINT = ""`) — deploying
  this is what turns storage on. The static site never depends on the Worker.
- `database_id` in `wrangler.toml` is **not** a secret (access still requires
  your authenticated account), so committing it is fine.
- Soft anti-spam: the Worker rejects POSTs whose `Origin` isn't
  `find-me-people.com`. For a hard guarantee, add a Cloudflare WAF rate-limit
  rule on the `/api/uninstall` path.
