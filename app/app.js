// Sula Desk — the big-screen half of Sula.
//
// Cases, letters, deadlines, the purchase ledger and subscriptions, built on
// the same pure modules the extension ships (app/lib, copied by sync-lib.sh).
// Local-first: one JSON document in localStorage, no account, no server.
// Sula drafts and routes; the user sends. Nothing here sends anything.
//
// Every node is built with textContent. Backups and statements are
// user-supplied files and letters contain user text, so nothing is ever
// assigned to innerHTML.

(() => {
  "use strict";

  const STORE_KEY = "sula_desk_v1";
  const BACKUP_FORMAT = "sula-desk-backup";
  const DAY = 24 * 60 * 60 * 1000;

  const T = window.SulaRefundTemplates;
  const A = window.SulaAdvocacyLetters;
  const D = window.SulaRefundDeadlines;
  const G = window.SulaChargebackGuide;
  const R = window.SulaEscalationRegistry;
  const L = window.SulaLedger;
  const P = window.SulaStatementParser;
  const LIC = window.SulaWebLicense;

  // ── storage ───────────────────────────────────────────────────────────
  function emptyStore() {
    return { v: 1, profile: { name: "", email: "" }, cases: [], ledger: [], recurring: null };
  }
  let storageOk = true;
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (s && s.v === 1) return { ...emptyStore(), ...s };
    } catch (_) { storageOk = false; }
    return emptyStore();
  }
  let store = load();
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); storageOk = true; }
    catch (_) { storageOk = false; }
  }

  // ── tiny DOM helper ───────────────────────────────────────────────────
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "value") el.value = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) {
      if (kid === null || kid === undefined || kid === false) continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }
  const $ = (sel) => document.querySelector(sel);
  const fmtMoney = (n) => (typeof n === "number" ? "$" + n.toFixed(2) : "");
  const isoDay = (ms) => (typeof ms === "number" && isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : "");
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  function toast(text, kind) {
    document.querySelectorAll(".toast").forEach((x) => x.remove());
    const t = h("div", { class: "toast " + (kind || ""), role: "status" }, text);
    document.body.append(t);
    setTimeout(() => t.remove(), 3200);
  }

  function field(label, input, hint) {
    return h("label", { class: "field" }, h("span", {}, label), input, hint ? h("small", {}, hint) : null);
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast("Copied.", "ok"); }
    catch (_) { toast("Couldn't copy. Select the text and copy it yourself.", "err"); }
  }

  function download(name, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = h("a", { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  function pickFile(accept, maxBytes, onText) {
    const input = h("input", { type: "file", accept, class: "visually-hidden" });
    input.addEventListener("change", async () => {
      const f = input.files && input.files[0];
      input.remove();
      if (!f) return;
      if (f.size > maxBytes) { toast("That file is too large.", "err"); return; }
      onText(await f.text(), f.name);
    });
    document.body.append(input);
    input.click();
  }

  // ── Pro ───────────────────────────────────────────────────────────────
  let pro = false;
  function proGate(what, why) {
    return h("div", { class: "card gate" },
      h("h3", {}, `${what} is part of Sula Pro`),
      h("p", {}, why),
      h("div", { class: "row" },
        h("a", { class: "btn primary", href: LIC.CHECKOUT.annual, target: "_blank", rel: "noopener" }, "Get Pro (annual)"),
        h("a", { class: "btn", href: LIC.CHECKOUT.monthly, target: "_blank", rel: "noopener" }, "Monthly"),
        h("button", { class: "btn ghost", onclick: () => showTab("settings") }, "I have a license key")));
  }

  // ── tabs ──────────────────────────────────────────────────────────────
  let currentTab = "cases";
  let openCaseId = null;
  function showTab(name) {
    currentTab = name;
    document.querySelectorAll(".tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === name)));
    document.querySelectorAll(".tab").forEach((s) => { s.hidden = s.id !== "tab-" + name; });
    render();
  }
  document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));

  function render() {
    const fn = { cases: renderCases, purchases: renderPurchases, subscriptions: renderSubscriptions, settings: renderSettings }[currentTab];
    const host = $("#tab-" + currentTab);
    host.replaceChildren(...[].concat(fn()).filter(Boolean));
    if (!storageOk) host.prepend(h("div", { class: "card warn" }, "This browser isn't letting Sula Desk save (private window or blocked site data). Anything you enter will be lost when you close the tab."));
  }

  // ── cases ─────────────────────────────────────────────────────────────
  const STATUS = {
    drafting: "Drafting",
    sent: "Request sent, waiting",
    replied_no: "Merchant said no",
    resolved: "Resolved",
  };

  function newCase(facts) {
    const f = facts || {};
    const c = {
      id: uid(), createdAt: Date.now(), updatedAt: Date.now(),
      company: f.company || "", email: f.email || "", amount: f.amount || "", date: f.date || "",
      orderId: f.orderId || f.orderRef || "", paymentType: f.paymentType || "credit",
      scenario: f.scenario || "defective_product", issuer: "generic", returnWindowDays: "",
      status: "drafting", sentAt: null, recovered: "", events: [{ at: Date.now(), text: "Case opened" }],
    };
    store.cases.unshift(c);
    save();
    return c;
  }

  function touch(c, eventText) {
    c.updatedAt = Date.now();
    if (eventText) c.events.push({ at: Date.now(), text: eventText });
    save();
  }

  function caseDeadlines(c) {
    if (!c.date) return null;
    const overrides = {};
    const w = parseInt(c.returnWindowDays, 10);
    if (w > 0 && w < 1000) overrides.merchant_return = w;
    const r = D.computeDeadlines(c.date + "T12:00:00", { paymentType: c.paymentType, overrides });
    return r.ok ? r : null;
  }

  function renderCases() {
    const open = openCaseId && store.cases.find((c) => c.id === openCaseId);
    if (open) return renderCase(open);

    const list = store.cases;
    const head = h("div", { class: "head" },
      h("div", {}, h("h1", {}, "Cases"),
        h("p", { class: "muted" }, "One case per charge you're fighting: the facts, the letter, every deadline, and what to do if they say no.")),
      h("button", { class: "btn primary", onclick: () => { openCaseId = newCase().id; render(); } }, "New case"));

    if (!list.length) {
      return [head, h("div", { class: "card empty" },
        h("h3", {}, "No cases yet"),
        h("p", {}, "Start one by hand, or import your purchases from the Sula extension and open a case from any of them."),
        h("div", { class: "row" },
          h("button", { class: "btn primary", onclick: () => { openCaseId = newCase().id; render(); } }, "New case"),
          h("button", { class: "btn", onclick: () => showTab("purchases") }, "Import purchases")))];
    }

    const rows = list.map((c) => {
      const d = caseDeadlines(c);
      const s = d && d.soonest;
      return h("button", { class: "case-row", onclick: () => { openCaseId = c.id; render(); } },
        h("span", { class: "c-company" }, c.company || "Untitled case"),
        h("span", { class: "c-meta" }, [c.amount, c.date].filter(Boolean).join(" · ")),
        h("span", { class: "pill s-" + c.status }, STATUS[c.status] || c.status),
        s ? h("span", { class: "pill u-" + s.urgency }, `${s.label.replace(/ \(.*\)/, "")}: ${s.daysLeft}d left`)
          : h("span", { class: "pill u-none" }, c.date ? "All windows closed" : "Add the charge date"));
    });
    const recovered = list.reduce((sum, c) => sum + (parseFloat(String(c.recovered).replace(/[^\d.]/g, "")) || 0), 0);
    return [head,
      recovered > 0 ? h("p", { class: "muted" }, `You've recorded ${fmtMoney(recovered)} back across ${plural(list.filter((c) => c.status === "resolved").length, "resolved case", "resolved cases")}. All of it is yours: Sula takes no cut.`) : null,
      h("div", { class: "case-list" }, rows)];
  }

  function renderCase(c) {
    const set = (k) => (e) => { c[k] = e.target.value; touch(c); refreshCaseSide(c); };
    const input = (k, attrs) => h("input", { value: c[k] || "", oninput: set(k), ...(attrs || {}) });
    const select = (k, options) => h("select", { onchange: (e) => { c[k] = e.target.value; touch(c); render(); } },
      options.map(([v, label]) => { const o = h("option", { value: v }, label); if (c[k] === v) o.selected = true; return o; }));

    const facts = h("div", { class: "card" },
      h("h2", {}, "The facts"),
      h("div", { class: "grid2" },
        field("Company", input("company", { placeholder: "e.g. Wayfair" })),
        field("Their support email", input("email", { type: "email", placeholder: "Optional; used for Open in email" })),
        field("Amount charged", input("amount", { placeholder: "$215.42" })),
        field("Charge date", input("date", { type: "date" })),
        field("Order or reference number", input("orderId")),
        field("Paid with", select("paymentType", [["credit", "Credit card"], ["debit", "Debit card"], ["other", "Other (PayPal, bank transfer…)"]])),
        field("What happened", select("scenario", T.listScenarios().map((s) => [s.id, s.label]))),
        field("Their return window (days)", input("returnWindowDays", { inputmode: "numeric", placeholder: "30" }), "From their refund policy. Leave blank to assume 30.")));

    const side = h("div", { id: "case-side" });
    const wrap = [
      h("div", { class: "head" },
        h("div", {}, h("button", { class: "link", onclick: () => { openCaseId = null; render(); } }, "← All cases"),
          h("h1", {}, c.company || "New case")),
        h("div", { class: "row" },
          select("status", Object.entries(STATUS)),
          h("button", { class: "btn ghost danger", onclick: () => {
            if (!confirm("Delete this case? This can't be undone.")) return;
            store.cases = store.cases.filter((x) => x.id !== c.id); save(); openCaseId = null; render();
          } }, "Delete"))),
      h("div", { class: "case-grid" }, h("div", {}, facts, letterCard(c)), side),
    ];
    setTimeout(() => refreshCaseSide(c), 0);
    return wrap;
  }

  function letterFor(c) {
    const p = store.profile || {};
    const L1 = T.buildLetter(c.scenario, {
      company: c.company, orderId: c.orderId, amount: c.amount,
      date: c.date, name: p.name,
    });
    if (!L1) return null;
    const body = p.email ? L1.body.replace(/{{YOUR_EMAIL}}/g, p.email) : L1.body;
    return { subject: L1.subject, body };
  }

  function letterCard(c) {
    const card = h("div", { class: "card", id: "letter-card" });
    fillLetter(card, c);
    return card;
  }

  function fillLetter(card, c) {
    const letter = letterFor(c);
    if (!letter) { card.replaceChildren(h("p", {}, "Pick what happened to draft a letter.")); return; }
    const missing = (letter.subject + letter.body).match(/{{[A-Z_]+}}/g) || [];
    const subj = h("input", { value: letter.subject, "aria-label": "Subject" });
    const body = h("textarea", { rows: 16, "aria-label": "Letter" });
    body.value = letter.body;
    const mailto = () => {
      const href = `mailto:${encodeURIComponent(c.email || "")}?subject=${encodeURIComponent(subj.value)}&body=${encodeURIComponent(body.value)}`;
      if (href.length > 1900) { copy(body.value); toast("The letter is long, so it's been copied. Paste it into your email.", "ok"); window.location.href = `mailto:${encodeURIComponent(c.email || "")}?subject=${encodeURIComponent(subj.value)}`; return; }
      window.location.href = href;
    };
    card.replaceChildren(
      h("h2", {}, "Your letter"),
      h("p", { class: "muted" }, "Sula drafts it. You read it, change anything, and send it yourself."),
      missing.length ? h("div", { class: "note" }, `Fill in before sending: ${[...new Set(missing)].map((m) => m.replace(/[{}]/g, "").replace(/_/g, " ").toLowerCase()).join(", ")}. `,
        !store.profile.name || !store.profile.email ? h("button", { class: "link", onclick: () => showTab("settings") }, "Save your name and email once in Settings.") : null) : null,
      field("Subject", subj),
      field("Letter", body),
      h("div", { class: "row" },
        h("button", { class: "btn primary", onclick: mailto }, "Open in email"),
        h("button", { class: "btn", onclick: () => copy(`Subject: ${subj.value}\n\n${body.value}`) }, "Copy"),
        h("button", { class: "btn", onclick: () => printLetter(subj.value, body.value) }, "Print to mail"),
        c.status === "drafting" ? h("button", { class: "btn ghost", onclick: () => { c.status = "sent"; c.sentAt = Date.now(); touch(c, "Request sent"); render(); } }, "I've sent it") : null));
  }

  function printLetter(subject, body) {
    const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    $("#print-letter").replaceChildren(h("p", {}, today), h("p", { class: "p-subj" }, "Re: " + subject), h("pre", {}, body),
      h("p", { class: "p-note" }, "Keep a copy. If you need proof it arrived, ask the post office for certified mail or a Certificate of Mailing."));
    window.print();
  }

  function refreshCaseSide(c) {
    const side = document.getElementById("case-side");
    if (!side) return;
    const head = document.querySelector("#tab-cases h1");
    if (head) head.textContent = c.company || "New case";
    const card = document.getElementById("letter-card");
    if (card && document.activeElement && !card.contains(document.activeElement)) fillLetter(card, c);
    side.replaceChildren(deadlineCard(c), nextStepsCard(c), timelineCard(c));
  }

  function deadlineCard(c) {
    const d = caseDeadlines(c);
    if (!d) return h("div", { class: "card" }, h("h2", {}, "Deadlines"), h("p", { class: "muted" }, "Add the charge date to see every window that applies."));
    return h("div", { class: "card" },
      h("h2", {}, "Deadlines"),
      h("ul", { class: "deadlines" }, d.remedies.map((r) =>
        h("li", { class: "u-" + r.urgency },
          h("strong", {}, r.label),
          h("span", {}, r.expired ? `Closed ${-r.daysLeft} days ago (${r.deadline})` : `${r.daysLeft} days left · by ${r.deadline}`),
          h("small", {}, r.note)))),
      h("p", { class: "fine" }, "Typical windows, not legal advice. Your card issuer's terms and the merchant's own policy are what count."));
  }

  function nextStepsCard(c) {
    const ignored = c.sentAt ? Math.floor((Date.now() - c.sentAt) / DAY) : undefined;
    const ready = G.assessReadiness({
      contactedMerchant: c.status !== "drafting",
      merchantRespondedNo: c.status === "replied_no",
      merchantIgnoredDays: c.status === "sent" ? ignored : undefined,
    });
    const steps = G.issuerSteps(c.issuer);
    const issuerSel = h("select", { onchange: (e) => { c.issuer = e.target.value; touch(c); refreshCaseSide(c); } },
      G.listIssuers().map((i) => { const o = h("option", { value: i.id }, i.label); if (c.issuer === i.id) o.selected = true; return o; }));
    // suggestCategories puts keyword matches first, then the registry's own
    // order. With no match that order leads with banking, which is wrong for
    // most purchase disputes, so lead with retail, then the card issuer's
    // regulator, then the state AG.
    const defaultOrder = R.listCategories().map((x) => x.id);
    let ids = R.suggestCategories(c.company);
    if (ids[0] === defaultOrder[0] && !/bank|credit|loan|mortgage/i.test(c.company)) ids = ["general_retail", "banking", "other"];
    const cats = ids.slice(0, 3).map((id) => R.getCategoryEntry(id)).filter(Boolean);

    if (c.status === "resolved") {
      return h("div", { class: "card good" }, h("h2", {}, "Resolved"),
        field("What did you get back?", h("input", { value: c.recovered || "", placeholder: "$215.42", oninput: (e) => { c.recovered = e.target.value; touch(c); } }),
          "Optional. Stays in this browser. It's how you see what Sula has helped you recover."));
    }
    return h("div", { class: "card" },
      h("h2", {}, "If they don't fix it"),
      h("p", { class: ready.ready ? "ok" : "muted" }, ready.recommendation),
      ready.reasons.length ? h("ul", { class: "plain" }, ready.reasons.map((r) => h("li", {}, r))) : null,
      h("h3", {}, "Card dispute"),
      field("Your card", issuerSel),
      h("ol", { class: "steps" }, steps.steps.map((s) => h("li", {}, s))),
      h("p", { class: "fine" }, steps.note),
      h("h3", {}, "Regulators"),
      h("p", { class: "muted" }, "Suggestions only. Pick the one that fits; you file it yourself."),
      h("ul", { class: "agencies" }, cats.map((e) =>
        h("li", {}, h("a", { href: e.url, target: "_blank", rel: "noopener" }, e.agency), h("small", {}, e.filingTips)))),
      pro ? h("button", { class: "btn", onclick: () => draftAdvocacy(c, "regulatory") }, "Draft the complaint narrative")
          : h("p", { class: "fine" }, "Complaint narratives are a Pro feature."),
      h("button", { class: "btn ghost", onclick: () => draftAdvocacy(c, "executive_escalation") }, "Draft an executive escalation letter"));
  }

  function draftAdvocacy(c, type) {
    const ctx = {
      company: c.company, orderRef: c.orderId, senderName: store.profile.name,
      issue: `On ${c.date || "{{DATE}}"} I was charged ${c.amount || "{{AMOUNT}}"}. ${T.SCENARIOS[c.scenario] ? T.SCENARIOS[c.scenario].label + "." : ""}`,
      priorAttempts: c.status !== "drafting", priorContactDate: c.sentAt ? isoDay(c.sentAt) : "", priorChannel: "email",
      desired: "a full refund of the charge",
    };
    let out;
    try { out = A.buildLetter(type, ctx); } catch (_) { toast("That letter couldn't be drafted.", "err"); return; }
    const card = document.getElementById("letter-card");
    const subj = h("input", { value: out.subject });
    const body = h("textarea", { rows: 16 }); body.value = out.body;
    card.replaceChildren(h("h2", {}, type === "regulatory" ? "Complaint narrative" : "Executive escalation"),
      h("p", { class: "muted" }, "Paste this into the agency's form, or send it to the executive yourself."),
      field("Subject", subj), field("Text", body),
      h("div", { class: "row" },
        h("button", { class: "btn primary", onclick: () => copy(`Subject: ${subj.value}\n\n${body.value}`) }, "Copy"),
        h("button", { class: "btn", onclick: () => printLetter(subj.value, body.value) }, "Print"),
        h("button", { class: "btn ghost", onclick: () => fillLetter(card, c) }, "Back to the refund letter")));
    touch(c, type === "regulatory" ? "Drafted a complaint narrative" : "Drafted an executive escalation");
    card.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function timelineCard(c) {
    return h("div", { class: "card" }, h("h2", {}, "History"),
      h("ul", { class: "timeline" }, c.events.slice().reverse().map((e) =>
        h("li", {}, h("time", {}, new Date(e.at).toLocaleString()), " ", e.text))));
  }

  // ── purchases (ledger) ────────────────────────────────────────────────
  function importLedger() {
    pickFile(".json,application/json", 5 * 1024 * 1024, (text) => {
      const parsed = L.readBackup(text);
      if (parsed.error) { toast(parsed.error, "err"); return; }
      const r = L.mergeBackup(store.ledger, parsed.entries, Date.now());
      store.ledger = r.entries; save(); render();
      toast(r.added ? `Imported ${plural(r.added, "purchase", "purchases")}.` : "Nothing new to import.", "ok");
    });
  }

  function renderPurchases() {
    const head = h("div", { class: "head" },
      h("div", {}, h("h1", {}, "Purchases"),
        h("p", { class: "muted" }, "What the Sula extension remembered from your order and billing pages, with how long you have to act on each.")),
      h("button", { class: "btn primary", onclick: importLedger }, "Import from the extension"));
    const how = h("p", { class: "fine" }, "In the extension: Subs tab → Back up or restore purchases → Download backup. That saves a sula-purchases-backup file. Import it here. Importing twice never duplicates anything.");
    const entries = store.ledger.filter((e) => e && e.state !== L.STATE.CLOSED && e.kind === L.KIND.PURCHASE);
    if (!store.ledger.length) return [head, h("div", { class: "card empty" }, h("h3", {}, "No purchases yet"), how)];
    if (!pro) return [head, h("p", {}, `${plural(store.ledger.length, "purchase is", "purchases are")} saved here.`), proGate("The purchase list", "See every remembered purchase with its refund deadlines, and open a case from any of them with the facts already filled in.")];

    const rows = entries
      .map((e) => ({ e, pre: L.refundPrefill(e) }))
      .sort((a, b) => (b.e.occurredAt || b.e.capturedAt) - (a.e.occurredAt || a.e.capturedAt))
      .map(({ e, pre }) => {
        const d = pre.date ? D.computeDeadlines(pre.date + "T12:00:00", { paymentType: "credit" }) : null;
        const s = d && d.ok && d.soonest;
        return h("tr", {},
          h("td", {}, pre.company || "Unknown merchant", e.state === L.STATE.PENDING ? h("small", {}, " (checkout, not confirmed)") : null),
          h("td", {}, pre.amount), h("td", {}, pre.date), h("td", {}, pre.orderRef),
          h("td", {}, s ? h("span", { class: "pill u-" + s.urgency }, `${s.daysLeft}d · ${s.label.replace(/ \(.*\)/, "")}`) : "—"),
          h("td", {}, h("button", { class: "btn small", onclick: () => { const c = newCase({ ...pre, orderId: pre.orderRef }); c.events.push({ at: Date.now(), text: "Opened from a remembered purchase" }); save(); openCaseId = c.id; showTab("cases"); } }, "Open a case")));
      });
    return [head, how,
      h("div", { class: "table-wrap" }, h("table", {},
        h("thead", {}, h("tr", {}, ["Merchant", "Amount", "Date", "Order", "Soonest deadline", ""].map((x) => h("th", {}, x)))),
        h("tbody", {}, rows)))];
  }

  // ── subscriptions ─────────────────────────────────────────────────────
  function importStatement() {
    pickFile(".csv,.ofx,.qfx,text/csv", 8 * 1024 * 1024, (text, name) => {
      const parsed = P.parse(text, name);
      if (parsed.error || !parsed.transactions || !parsed.transactions.length) {
        toast("That file couldn't be read as a bank statement. Export CSV, OFX or QFX from your bank.", "err"); return;
      }
      const items = P.detectRecurring(parsed.transactions, Date.now());
      store.recurring = { importedAt: Date.now(), fileName: name, txCount: parsed.transactions.length, items };
      save(); render();
      toast(`Read ${plural(parsed.transactions.length, "transaction", "transactions")}, found ${plural(items.length, "recurring charge", "recurring charges")}.`, "ok");
    });
  }

  function renderSubscriptions() {
    const head = h("div", { class: "head" },
      h("div", {}, h("h1", {}, "Subscriptions"),
        h("p", { class: "muted" }, "Recurring charges from your own bank statement, read in this browser. Sula never connects to your bank.")),
      pro ? h("button", { class: "btn primary", onclick: importStatement }, "Import a statement") : null);
    if (!pro) return [head, proGate("Statement import", "Drop in a CSV, OFX or QFX export from your bank and see every recurring charge, what it costs a year, and which ones went up.")];

    const out = [head];
    const subs = store.ledger.filter((e) => e && e.kind === L.KIND.SUBSCRIPTION && e.state !== L.STATE.CLOSED);
    if (subs.length) {
      out.push(h("div", { class: "card" }, h("h2", {}, "From the extension"),
        h("ul", { class: "plain" }, subs.map((e) => {
          const next = L.nextRenewal(e, Date.now());
          const pre = L.refundPrefill(e);
          return h("li", {}, h("strong", {}, pre.company), " ", pre.amount, next ? ` · renews ${isoDay(next)}` : "");
        }))));
    }
    const rec = store.recurring;
    if (!rec) {
      out.push(h("div", { class: "card empty" }, h("h3", {}, "No statement yet"),
        h("p", {}, "Download a statement from your bank's website (CSV, OFX or QFX), then import it here. The file is read in this browser and never uploaded.")));
      return out;
    }
    const total = rec.items.reduce((s, i) => s + i.annualized, 0);
    out.push(h("div", { class: "card" },
      h("h2", {}, `${fmtMoney(total)} a year in recurring charges`),
      h("p", { class: "muted" }, `From ${rec.fileName}, ${plural(rec.txCount, "transaction", "transactions")}, imported ${isoDay(rec.importedAt)}.`),
      h("div", { class: "table-wrap" }, h("table", {},
        h("thead", {}, h("tr", {}, ["Merchant", "Every", "Charge", "Per year", "Last charged", ""].map((x) => h("th", {}, x)))),
        h("tbody", {}, rec.items.map((i) => h("tr", {},
          h("td", {}, i.merchant, i.priceChanged ? h("span", { class: "pill u-soon" }, "price changed") : null),
          h("td", {}, ({ weekly: "week", monthly: "month", quarterly: "quarter", annual: "year" })[i.cadence] || i.cadence),
          h("td", {}, fmtMoney(i.amount)), h("td", {}, fmtMoney(i.annualized)), h("td", {}, isoDay(i.lastChargeMs)),
          h("td", {}, h("button", { class: "btn small", onclick: () => { const c = newCase({ company: i.merchant, amount: fmtMoney(i.amount), date: isoDay(i.lastChargeMs), scenario: "cancelled_still_charged" }); openCaseId = c.id; showTab("cases"); } }, "Fight a charge")))))))));
    return out;
  }

  // ── settings ──────────────────────────────────────────────────────────
  function renderSettings() {
    const p = store.profile;
    const name = h("input", { value: p.name || "", autocomplete: "name", oninput: (e) => { p.name = e.target.value; save(); } });
    const email = h("input", { type: "email", value: p.email || "", autocomplete: "email", oninput: (e) => { p.email = e.target.value; save(); } });

    const keyInput = h("input", { placeholder: "Paste your license key", autocomplete: "off" });
    const status = h("p", { class: "muted" });
    const licenseCard = h("div", { class: "card" }, h("h2", {}, "Sula Pro"),
      pro ? [h("p", { class: "ok" }, `Pro is active on this browser (key ${LIC.maskedKey()}).`),
        h("button", { class: "btn ghost", onclick: async () => { await LIC.deactivate(); pro = false; render(); toast("License released from this browser.", "ok"); } }, "Deactivate on this browser")]
        : [h("p", {}, "Already bought Pro for the extension? The same key works here."),
          field("License key", keyInput),
          h("div", { class: "row" },
            h("button", { class: "btn primary", onclick: async () => {
              status.textContent = "Checking…";
              const r = await LIC.activate(keyInput.value);
              if (r.ok) { pro = true; render(); toast("Pro is active.", "ok"); } else status.textContent = r.error;
            } }, "Activate"),
            h("a", { class: "btn", href: LIC.CHECKOUT.annual, target: "_blank", rel: "noopener" }, "Buy Pro")),
          status,
          h("p", { class: "fine" }, "Installed Sula before pricing? Your extension keeps Pro, but the web app can't see that yet. Email sula.support@trysula.com and we'll send you a key.")]);

    return [
      h("div", { class: "head" }, h("h1", {}, "Settings")),
      h("div", { class: "card" }, h("h2", {}, "You"),
        h("p", { class: "muted" }, "Used to sign your letters. Stays in this browser."),
        h("div", { class: "grid2" }, field("Your name", name), field("Your email", email))),
      licenseCard,
      h("div", { class: "card" }, h("h2", {}, "Backup"),
        h("p", { class: "muted" }, "Sula Desk lives in this browser only. A new computer or cleared site data starts empty, so keep a backup."),
        h("div", { class: "row" },
          h("button", { class: "btn", onclick: () => download(`sula-desk-backup-${isoDay(Date.now())}.json`, { format: BACKUP_FORMAT, version: 1, exportedAt: new Date().toISOString(), store }) }, "Download a backup"),
          h("button", { class: "btn", onclick: restoreDesk }, "Restore a backup"),
          h("button", { class: "btn ghost danger", onclick: () => {
            if (!confirm("Erase every case, purchase and statement in Sula Desk on this browser?")) return;
            store = emptyStore(); save(); openCaseId = null; render(); toast("Erased.", "ok");
          } }, "Erase everything"))),
    ];
  }

  function restoreDesk() {
    pickFile(".json,application/json", 10 * 1024 * 1024, (text) => {
      let data;
      try { data = JSON.parse(text); } catch (_) { data = null; }
      if (!data || data.format !== BACKUP_FORMAT || !data.store || data.store.v !== 1) { toast("That isn't a Sula Desk backup.", "err"); return; }
      const incoming = data.store;
      const have = new Set(store.cases.map((c) => c.id));
      const cases = (Array.isArray(incoming.cases) ? incoming.cases : []).filter((c) => c && typeof c.id === "string" && !have.has(c.id));
      store.cases = store.cases.concat(cases);
      if (Array.isArray(incoming.ledger)) {
        const parsed = L.readBackup(JSON.stringify({ format: "sula-ledger-backup", version: 1, entries: incoming.ledger }));
        if (!parsed.error) store.ledger = L.mergeBackup(store.ledger, parsed.entries, Date.now()).entries;
      }
      if (!store.recurring && incoming.recurring) store.recurring = incoming.recurring;
      if (!store.profile.name && incoming.profile) store.profile = { ...store.profile, ...incoming.profile };
      save(); render();
      toast(`Restored ${plural(cases.length, "case", "cases")}.`, "ok");
    });
  }

  // ── boot ──────────────────────────────────────────────────────────────
  render();
  LIC.isPro().then((v) => { pro = v; render(); });
})();
