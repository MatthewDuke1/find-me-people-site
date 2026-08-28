// Sula support form — submits to Web3Forms via fetch so the user stays on the
// page and gets an inline success message (no redirect). External script so it
// works under the page's strict script-src 'self' CSP.
//
// SETUP: put your free Web3Forms access key in support.html's hidden
// access_key input (replace YOUR_WEB3FORMS_ACCESS_KEY). Until then the form
// won't deliver and the config banner stays visible.

(function () {
  "use strict";

  var form = document.getElementById("supportForm");
  var status = document.getElementById("formStatus");
  var btn = document.getElementById("submitBtn");
  var configWarn = document.getElementById("configWarn");
  if (!form) return;

  var keyEl = form.querySelector('input[name="access_key"]');
  var keySet = keyEl && keyEl.value && keyEl.value !== "YOUR_WEB3FORMS_ACCESS_KEY";

  // Hide the "setup needed" banner once a real key is present.
  if (keySet && configWarn) configWarn.hidden = true;

  function show(msg, ok) {
    status.hidden = false;
    status.textContent = msg;
    status.className = "form-status " + (ok ? "ok" : "err");
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    if (!keySet) {
      show("This form isn't connected yet — email matthewduke0@gmail.com instead.", false);
      return;
    }

    btn.disabled = true;
    var prev = btn.textContent;
    btn.textContent = "Sending…";

    var data = new FormData(form);
    fetch("https://api.web3forms.com/submit", {
      method: "POST",
      body: data,
      headers: { Accept: "application/json" },
    })
      .then(function (r) { return r.json(); })
      .then(function (json) {
        if (json && json.success) {
          form.reset();
          show("Thanks — your message is in. We read every one and will reply if you left an email.", true);
          btn.textContent = "Sent ✓";
        } else {
          show("Something went wrong sending that. Please email matthewduke0@gmail.com.", false);
          btn.disabled = false;
          btn.textContent = prev;
        }
      })
      .catch(function () {
        show("Couldn't reach the server. Please email matthewduke0@gmail.com.", false);
        btn.disabled = false;
        btn.textContent = prev;
      });
  });
})();
