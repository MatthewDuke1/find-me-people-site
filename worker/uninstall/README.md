# Uninstall-survey collector (Cloudflare Worker + D1)

Receives the anonymous POST from `uninstall.html` and stores it in a D1
(SQLite) table. No personal data: reason, comment, version and timestamp only.

It runs on its own `workers.dev` address, not on `trysula.com`. That keeps the
domain's DNS on Route 53, where the Zoho mail records live, and the static site
on GitHub Pages. The Worker only accepts POSTs whose `Origin` is `trysula.com`.

```
worker/uninstall/
  src/index.js     the Worker
  schema.sql       D1 table
  wrangler.toml    config (name, D1 binding, workers_dev)
```

## Deploy (about 10 minutes, free tier)

Run from `worker/uninstall/` with a free Cloudflare account.

```sh
npx wrangler@latest login                       # authorize in the browser
npx wrangler@latest d1 create fmp-uninstalls    # prints a database_id
#   paste that database_id into wrangler.toml (replace REPLACE_WITH_D1_DATABASE_ID)
npx wrangler@latest d1 execute fmp-uninstalls --remote --file=./schema.sql
npx wrangler@latest deploy                      # prints https://fmp-uninstall-survey.<subdomain>.workers.dev
```

The first deploy asks you to pick a `workers.dev` subdomain if you don't have one.

### Smoke test

```sh
curl -i -X POST https://fmp-uninstall-survey.<subdomain>.workers.dev \
  -H "Origin: https://trysula.com" -H "Content-Type: application/json" \
  -d '{"reason":"bug","reasonLabel":"Something was broken","comment":"smoke test","version":"test"}'
# expect: HTTP/1.1 204

npx wrangler@latest d1 execute fmp-uninstalls --remote \
  --command "SELECT * FROM uninstalls ORDER BY id DESC LIMIT 5"
# expect: your test row
```

## Turn collection on

Set the endpoint in `../../uninstall.js` to the deployed URL:

```js
var ENDPOINT = "https://fmp-uninstall-survey.<subdomain>.workers.dev";
```

`uninstall.html` has no Content-Security-Policy, so no CSP change is needed.

## Reading the data

```sh
npx wrangler@latest d1 execute fmp-uninstalls --remote --command \
  "SELECT reason, COUNT(*) c FROM uninstalls GROUP BY reason ORDER BY c DESC"

npx wrangler@latest d1 execute fmp-uninstalls --remote --command \
  "SELECT submitted_at, reason, comment FROM uninstalls WHERE comment != '' ORDER BY id DESC LIMIT 50"
```

## Cost

Free tier: 100k Worker requests and 100k D1 writes a day. One uninstall is one
write.

## Notes

- `database_id` isn't a secret (D1 access still needs your Cloudflare login),
  so committing it is fine.
- The Origin check turns away casual cross-site noise but a script can forge
  it. For a hard limit, add a Cloudflare rate-limit rule on the Worker.
