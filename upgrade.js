// Sula upgrade page — value calculator + LemonSqueezy overlay checkout.
  (function () {
    // ---- Calculator: defaults land on $2,200 (50 hrs × $30 + $700) ----
    const hours = document.getElementById('hours');
    const wage = document.getElementById('wage');
    const refund = document.getElementById('refund');
    const privacy = document.getElementById('privacy');
    const hoursVal = document.getElementById('hoursVal');
    const wageVal = document.getElementById('wageVal');
    const refundVal = document.getElementById('refundVal');
    const privacyVal = document.getElementById('privacyVal');
    const totalEl = document.getElementById('total');
    const captionEl = document.getElementById('caption');

    const fmt = (n) => '$' + Math.round(n).toLocaleString('en-US');
    // The measured A/B anchor is time + refunds only ($2,200). The privacy
    // line defaults to $0 so the headline stays on that honest number; a user
    // who pays for a service like Cloaked/DeleteMe can add its value in.
    const DEFAULT_TOTAL = 50 * 30 + 700; // 2200

    function recalc() {
      const h = +hours.value, w = +wage.value, r = +refund.value, pv = +privacy.value;
      hoursVal.textContent = h;
      wageVal.textContent = w;
      refundVal.textContent = r.toLocaleString('en-US');
      privacyVal.textContent = pv;
      const total = h * w + r + pv;
      totalEl.innerHTML = fmt(total) + '<span class="yr"> /yr</span>';
      if (total === DEFAULT_TOTAL) {
        captionEl.textContent = 'Based on our A/B testing: the average Sula user saves about this much.';
      } else {
        let parts = fmt(h * w) + ' in time back, plus ' + fmt(r) + ' recovered';
        if (pv > 0) parts += ', plus ' + fmt(pv) + ' in privacy protection';
        captionEl.textContent = 'Your numbers — ' + parts + '.';
      }
    }
    [hours, wage, refund, privacy].forEach((el) => el.addEventListener('input', recalc));
    recalc();

    // ---- Subscribe → LemonSqueezy overlay ----
    // ?embed=1 tells lemon.js to open this as an on-page overlay, not a redirect.
    const CHECKOUT_BASE = 'https://sula.lemonsqueezy.com/checkout/buy/47598c36-6163-4f4e-93de-9266450ebfaa';
    // Mutable: regional pricing (below) may pre-apply a discount code.
    let CHECKOUT_URL = CHECKOUT_BASE + '?embed=1';
    function openCheckout() {
      if (window.LemonSqueezy && window.LemonSqueezy.Url) {
        window.LemonSqueezy.Url.Open(CHECKOUT_URL);
      } else {
        // lemon.js not ready yet — fall back to a normal new-tab checkout so
        // a click is never lost. (Drops the overlay, keeps the sale.)
        window.open(CHECKOUT_URL.replace('?embed=1', ''), '_blank', 'noopener');
      }
    }
    ['subscribeBtn', 'subscribeBtn2'].forEach((id) => {
      const b = document.getElementById(id);
      if (b) b.addEventListener('click', openCheckout);
    });

    // ---- Regional / purchasing-power pricing (DIY, no paid tool) ----
    // For visitors in lower-income markets, $6 USD is a much bigger ask. We
    // detect the country by IP and, if it's on the list below, show a friendly
    // banner and pre-apply a LemonSqueezy discount code to checkout.
    //
    // SETUP (yours): create each discount code in your LemonSqueezy dashboard
    //   (Store → Discounts), then map country code → { code, off } here.
    //   The percentages below are just placeholders; set them to codes you made.
    //
    // Fails safe on every path: if the geo lookup errors, times out, or the
    // country isn't listed, nothing shows and full price stands. The discount
    // is validated server-side by LemonSqueezy, so a wrong/expired code is
    // simply ignored — checkout can never break because of this.
    const PPP = {
      // --- Purchasing-power markets: $6 USD is disproportionately expensive
      //     here, so the discount corrects for that. countryCode : { code, off, label }
      TR: { code: 'GLOBAL60', off: 60, label: 'Türkiye' },
      IN: { code: 'GLOBAL60', off: 60, label: 'India' },
      BR: { code: 'GLOBAL50', off: 50, label: 'Brazil' },
      ID: { code: 'GLOBAL60', off: 60, label: 'Indonesia' },
      PH: { code: 'GLOBAL60', off: 60, label: 'the Philippines' },
      NG: { code: 'GLOBAL60', off: 60, label: 'Nigeria' },
      PK: { code: 'GLOBAL60', off: 60, label: 'Pakistan' },
      EG: { code: 'GLOBAL60', off: 60, label: 'Egypt' },
      MX: { code: 'GLOBAL40', off: 40, label: 'Mexico' },
      AR: { code: 'GLOBAL50', off: 50, label: 'Argentina' },
      VN: { code: 'GLOBAL60', off: 60, label: 'Vietnam' },
      UA: { code: 'GLOBAL60', off: 60, label: 'Ukraine' },

      // --- Launch-promo markets (NOT purchasing-power): a high-income market
      //     given a deliberate, smaller adoption discount to seed early users.
      //     Spain can afford full price — this trades a little margin for reach.
      ES: { code: 'SPAIN25', off: 25, label: 'Spain' },
    };

    function applyRegional(deal) {
      // Add the discount code to the checkout URL (both overlay + fallback).
      const sep = CHECKOUT_BASE.indexOf('?') === -1 ? '?' : '&';
      CHECKOUT_URL = CHECKOUT_BASE + '?embed=1&checkout[discount_code]=' + encodeURIComponent(deal.code);
      // Show the banner if the page has a slot for it.
      const banner = document.getElementById('pppBanner');
      if (banner) {
        banner.innerHTML = 'We noticed you’re in <b>' + deal.label + '</b> — ' +
          '<b>' + deal.off + '% off</b> is applied automatically at checkout.';
        banner.hidden = false;
      }
    }

    (function detectRegion() {
      // Guard everything: no fetch, no page. Timeout so a slow API can't hang.
      if (!('fetch' in window)) return;
      const ctrl = ('AbortController' in window) ? new AbortController() : null;
      const t = ctrl ? setTimeout(function () { ctrl.abort(); }, 3500) : null;
      fetch('https://freeipapi.com/api/json', ctrl ? { signal: ctrl.signal } : undefined)
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (t) clearTimeout(t);
          const cc = j && (j.countryCode || j.country_code);
          if (cc && PPP[cc]) applyRegional(PPP[cc]);
        })
        .catch(function () { if (t) clearTimeout(t); /* fail safe: full price */ });
    })();

    // ---- Scroll reveals ----
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
      document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
      window.addEventListener('load', () => setTimeout(() => {
        document.querySelectorAll('.reveal').forEach((el) => {
          if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add('in');
        });
      }, 100));
    } else {
      document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'));
    }
  })();
