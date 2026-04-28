# find-me-people-site

Marketing site for the [Find Me People](https://github.com/MatthewDuke1/find-me-people) browser extension.

A single static page (no framework, no build step) deployed via GitHub Pages.

## Local preview

```bash
python -m http.server 8000
# open http://localhost:8000
```

Or just open `index.html` directly in a browser.

## Deploy

GitHub repo Settings → Pages → Source: **Deploy from a branch** → `master` / `/ (root)`. Site lands at `https://matthewduke1.github.io/find-me-people-site/` within ~60 seconds.

For a custom domain, add a `CNAME` file with the bare domain (e.g. `findmepeople.com`) and set DNS A/CNAME records per [GitHub Pages docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site).

## Structure

```
find-me-people-site/
├── index.html          # The whole site -- HTML + inline CSS
├── favicon.png         # Tab icon (copy of extension icon128)
└── screenshots/        # Hero + feature shots from the extension
    ├── 01-hero.png
    ├── 02-autoscan.png
    ├── 03-scoring.png
    ├── 04-copy.png
    └── 05-support.png
```

## Editing

Live store URLs:

- Chrome: `https://chromewebstore.google.com/detail/find-me-people/ngfklhkcicocfchdmepiajdmboialikf`
- Firefox: `https://addons.mozilla.org/addon/find-me-people/`

Palette mirrors the extension's marquee promo: `#0a0a0a` background, `#4ade80` green accent, `#a78bfa` secondary, Inter font.
