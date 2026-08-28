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
    const CHECKOUT_URL = 'https://sula.lemonsqueezy.com/checkout/buy/47598c36-6163-4f4e-93de-9266450ebfaa?embed=1';
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
