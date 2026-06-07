# Security headers

`find-me-people.com` ships a defense-in-depth security-header posture in two tiers. This document is the operational runbook for both.

## Tier 1 — set via `<meta>` tags (already shipped)

These live in `<head>` on both `index.html` and `privacy.html`. They cover the directives the browser honors when delivered via meta.

| Header | Value | What it does |
|---|---|---|
| `Content-Security-Policy` | `default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; script-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'none'; object-src 'none'; upgrade-insecure-requests` | Locks down where the page can load resources, post forms, or be rebased. `'unsafe-inline'` is required for the inline `<style>` block; moving styles to an external file is the only way to drop it. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | When users click out to GitHub / Chrome Web Store / Product Hunt / etc., we leak only the origin (`https://find-me-people.com`), not the path. |
| `Permissions-Policy` | `geolocation=(), camera=(), microphone=(), payment=(), usb=(), interest-cohort=()` | Refuses these capabilities for every embed and script. `interest-cohort=()` opts out of Google's Topics / FLoC. |

### Tier 1 limitations

Some directives **cannot be set via `<meta>`**:

- `frame-ancestors` (clickjacking protection) — must come from an HTTP response header.
- `report-uri` / `report-to` (CSP violation reporting) — same.
- `sandbox` (full document sandbox) — same.

The browser silently ignores these if you try to use them via `<meta>`. They're listed under Tier 2 below.

## Tier 2 — set via HTTP response (not yet shipped)

These require the hosting layer. **GitHub Pages does not allow setting custom response headers.** The fix is to route the domain through a CDN that does.

| Header | Recommended value | Why GH Pages can't set it |
|---|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Cannot be set via meta tag. HTTP-response-only by spec. |
| `X-Frame-Options` | `DENY` | Same. (Modern browsers prefer CSP `frame-ancestors`; both should be set for compatibility.) |
| `X-Content-Type-Options` | `nosniff` | Same. |
| `Content-Security-Policy: frame-ancestors 'none'` | `'none'` | Meta-tag CSP cannot include this directive. |

### Migration plan: route through Cloudflare (free tier)

This is the standard path. Roughly 30 minutes one-time.

1. Sign up at https://dash.cloudflare.com (free).
2. Add `find-me-people.com` as a site. Cloudflare scans existing DNS records.
3. Cloudflare gives you 2 nameservers (e.g. `nick.ns.cloudflare.com` + `tara.ns.cloudflare.com`).
4. At your registrar, replace the existing nameservers with the Cloudflare pair.
5. Wait for DNS propagation (~15 min – 2 hr).
6. In Cloudflare's dashboard:
   - **SSL/TLS** → set mode to **Full**. Cloudflare to GH Pages now does HTTPS end-to-end.
   - **SSL/TLS → Edge Certificates** → enable **Always Use HTTPS** and **Automatic HTTPS Rewrites**.
   - **SSL/TLS → Edge Certificates → HSTS** → enable, max-age 12 months, includeSubDomains, preload.
   - **Rules → Transform Rules → Modify Response Header** → add:

     | Header | Value |
     |---|---|
     | `X-Content-Type-Options` | `nosniff` |
     | `X-Frame-Options` | `DENY` |
     | `Permissions-Policy` | `geolocation=(), camera=(), microphone=(), payment=(), usb=(), interest-cohort=()` |
     | `Referrer-Policy` | `strict-origin-when-cross-origin` |

   - **(Optional) Upgrade the CSP** — add a new Transform Rule setting `Content-Security-Policy` to the same value as the meta tag PLUS `frame-ancestors 'none'`. Once verified, the in-HTML `<meta>` CSP can be removed (HTTP-response CSP supersedes meta).

7. Verify at https://securityheaders.com/?q=find-me-people.com — should show grade **A** (up from F).
8. Verify at https://hstspreload.org/?domain=find-me-people.com if you want to submit for HSTS preload (12-month commitment).

### Why Cloudflare vs. Netlify / Vercel / Cloudflare Pages

| Option | Migration cost | Headers control | Notes |
|---|---|---|---|
| **Cloudflare in front of GH Pages** (recommended) | Lowest — DNS only | Full | Static site stays on GH Pages, Cloudflare is just a CDN layer adding the response headers. |
| **Cloudflare Pages** (migrate hosting) | Medium — DNS + new deploy pipeline | Full + `_headers` file in repo | Adds GH Pages → Cloudflare Pages migration. Worth it long-term but more change. |
| **Netlify** | Medium — same | `_headers` file in repo | Same trade-off as Cloudflare Pages. |
| **Vercel** | Medium — same | `vercel.json` headers | Same. |

The first option keeps the repository unchanged and is reversible.

## Expected SEO score impact

| State | securityheaders.com grade | Audit "Security" subscore | Overall site SEO |
|---|---|---:|---:|
| Before Tier 1 | F | 62 | 84 |
| After Tier 1 (this PR) | C-ish (partial credit) | 75 | ~86 |
| After Tier 2 (Cloudflare) | A | 92 | ~88 |

Tier 1 by itself is a meaningful improvement — most automated SEO/security crawlers credit meta-tag CSP and Referrer-Policy. Tier 2 closes the rest.

## Operational notes

- **CSP violation reports.** Not configured (would require `report-to` which is HTTP-only). If a CSP regression breaks the page silently, you'll only catch it via manual testing. Recommend a 5-minute `securityheaders.com` check after any HTML edit that adds a new external resource.
- **Adding a new external origin.** Update the CSP directive in both `index.html` and `privacy.html`. If `unsafe-inline` is ever dropped from `style-src` (e.g. external CSS), drop it everywhere consistently — partial enforcement is worse than none.
- **Google Fonts swap.** If you move off Google Fonts (e.g. self-host Inter via `@font-face`), drop both `fonts.googleapis.com` and `fonts.gstatic.com` from the CSP. The `font-src 'self'` fallback already covers the local case.
