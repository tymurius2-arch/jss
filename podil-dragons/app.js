/* PODIL DRAGONS — логіка сайту: сторінки, оголошення, фільтри, форма, налаштування. */
(function () {
  "use strict";

  /* Усі контакти та дані студії — у config.js */
  const C = window.PD_CONFIG || {};
  const SOC = C.social || {};

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  };

  /* ---------- Налаштування ---------- */
  const DEFAULTS = { lang: "uk", currency: "USD", rateUah: C.rateUah || 41.5, rateEur: C.rateEur || 1.08, theme: "auto", motion: "on" };
  const settings = Object.assign({}, DEFAULTS, store.get("pd.settings", {}));
  if (!store.get("pd.settings", null) && matchMedia("(prefers-reduced-motion: reduce)").matches) settings.motion = "off";
  const saveSettings = () => store.set("pd.settings", settings);

  let favs = new Set(store.get("pd.favs", []));
  const saveFavs = () => store.set("pd.favs", [...favs]);

  /* ---------- Переклад ---------- */
  const dict = () => window.PD_I18N[settings.lang] || window.PD_I18N.uk;
  function t(key, vars) {
    let s = dict()[key] ?? window.PD_I18N.uk[key] ?? key;
    if (vars) for (const k in vars) s = s.replace("{" + k + "}", vars[k]);
    return s;
  }
  const L = (v) => (v && typeof v === "object" ? v[settings.lang] || v.uk || "" : v || "");
  const districtName = (id) => { const d = window.PD_DISTRICTS.find((x) => x[0] === id); return d ? (settings.lang === "en" ? d[2] : d[1]) : ""; };

  function applyI18n() {
    const html = document.documentElement;
    html.lang = settings.lang;
    document.title = t("meta.title");
    $$("[data-i18n]").forEach((n) => { n.textContent = t(n.dataset.i18n); });
    $$("[data-i18n-ph]").forEach((n) => { n.placeholder = t(n.dataset.i18nPh); });
    $$("[data-i18n-title]").forEach((n) => { n.title = t(n.dataset.i18nTitle); n.setAttribute("aria-label", t(n.dataset.i18nTitle)); });
    $("#langQuick").textContent = settings.lang === "uk" ? "EN" : "UA";
    fillDistricts();
    renderTypeTabs();
    renderContacts();
    renderAbout();
    renderFooter();
    moveNavInk();
  }

  /* ---------- Ціни ---------- */
  function money(usd) {
    let v = usd, cur = settings.currency;
    if (cur === "UAH") v = usd * (+settings.rateUah || DEFAULTS.rateUah);
    if (cur === "EUR") v = usd / (+settings.rateEur || DEFAULTS.rateEur);
    try {
      return new Intl.NumberFormat(settings.lang === "en" ? "en-US" : "uk-UA", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(v);
    } catch (e) { return Math.round(v) + " " + cur; }
  }

  /* ---------- Оголошення ---------- */
  const LISTINGS = (window.PD_LISTINGS || [])
    .filter((x) => x && x.id && x.type && x.price && x.area && (C.showExamples !== false || !x.example))
    .map((x) => Object.assign({}, x, { created: typeof x.created === "string" ? Date.parse(x.created) || 0 : x.created || 0 }));
  const all = () => LISTINGS.slice();
  const byId = (id) => all().find((x) => x.id === id);

  // Ілюстрація замість фото: силует будівлі у стилі витинанки.
  function illustration(item) {
    let seed = 0; for (const c of item.id) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const sunX = 70 + rnd() * 260, sunY = 60 + rnd() * 40;
    let b = "";
    if (item.type === "house") {
      b += `<path class="ill-b" d="M80 250V160h240v90z"/><path class="ill-b" d="M50 168 Q120 150 200 92 Q280 150 350 168 Q330 158 320 150 L200 78 L80 150 Q70 158 50 168z"/>`;
      b += `<path class="ill-b" d="M150 115 Q200 70 250 115 L200 60z"/>`;
      for (let i = 0; i < 4; i++) b += `<rect class="ill-w" x="${100 + i * 56}" y="180" width="26" height="34" rx="13"/>`;
      b += `<rect class="ill-w" x="186" y="220" width="28" height="30" rx="3"/>`;
    } else if (item.type === "commercial") {
      b += `<rect class="ill-b" x="40" y="120" width="320" height="130"/><rect class="ill-b" x="30" y="108" width="340" height="16"/>`;
      for (let i = 0; i < 5; i++) b += `<path class="ill-w" d="M${60 + i * 60} 250v-56a20 20 0 0 1 40 0v56z"/>`;
      for (let i = 0; i < 8; i++) b += `<rect class="ill-w" x="${56 + i * 38}" y="134" width="20" height="24" rx="2"/>`;
      b += `<path class="ill-b" d="M40 108 Q200 70 360 108z"/>`;
    } else {
      const h1 = 150 + Math.floor(rnd() * 50), h2 = 90 + Math.floor(rnd() * 40);
      b += `<rect class="ill-b" x="70" y="${250 - h1}" width="150" height="${h1}"/><rect class="ill-b" x="230" y="${250 - h2}" width="110" height="${h2}"/>`;
      b += `<path class="ill-b" d="M60 ${250 - h1} Q145 ${238 - h1} 230 ${250 - h1} L145 ${226 - h1}z"/>`;
      for (let r = 0; r < Math.floor((h1 - 30) / 30); r++) for (let c = 0; c < 4; c++)
        b += `<rect class="ill-w" x="${84 + c * 34}" y="${264 - h1 + r * 30}" width="18" height="18" rx="2" opacity="${rnd() > .3 ? 1 : .55}"/>`;
      for (let r = 0; r < Math.floor((h2 - 26) / 28); r++) for (let c = 0; c < 3; c++)
        b += `<rect class="ill-w" x="${244 + c * 32}" y="${262 - h2 + r * 28}" width="16" height="16" rx="2"/>`;
    }
    return `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(t("type." + item.type))}">
      <rect class="ill-bg" width="400" height="300"/>
      <circle class="ill-sun" cx="${sunX.toFixed(0)}" cy="${sunY.toFixed(0)}" r="26"/>
      <path class="ill-cloud" d="M${(sunX + 60) % 340} 70 h70 m-60 0 a12 12 0 1 1 18 -10 a12 12 0 1 1 22 4 a10 10 0 1 1 14 6"/>
      ${b}<rect class="ill-b" y="250" width="400" height="50"/>
      <path class="ill-w" opacity=".25" d="M0 268 h400 v2 h-400z M0 282 h400 v2 h-400z"/></svg>`;
  }
  const media = (item, i = 0) => (item.photos && item.photos[i] ? `<img src="${item.photos[i]}" alt="" loading="lazy">` : illustration(item));

  const PIN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s-7-7-7-12a7 7 0 0 1 14 0c0 5-7 12-7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>`;
  const HEART = `<svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.5 8 3.6 4.5 7.1 4.5c2 0 3.6 1.1 4.9 2.8 1.3-1.7 2.9-2.8 4.9-2.8 3.5 0 5.6 3.5 4.4 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/></svg>`;

  function specs(it) {
    const s = [`<span>${t("card.area", { n: it.area })}</span>`];
    if (it.rooms) s.push(`<span>${t("card.rooms", { n: it.rooms })}</span>`);
    if (it.floor && it.floors) s.push(`<span>${t("card.floor", { a: it.floor, b: it.floors })}</span>`);
    else if (it.floors) s.push(`<span>${t("card.floors", { n: it.floors })}</span>`);
    return s.join("");
  }

  function card(it, i) {
    const fav = favs.has(it.id);
    const loc = [districtName(it.district), L(it.address)].filter(Boolean).join(" · ");
    return `<article class="card" data-id="${esc(it.id)}" style="--d:${Math.min(i, 8) * 0.07}s" tabindex="0" aria-label="${esc(L(it.title))}">
      <div class="card-media">${media(it)}
        <div class="card-tags"><span class="tag">${esc(t("type." + it.type))}</span>
          ${it.example ? `<span class="tag light">${esc(t("card.demo"))}</span>` : ""}</div>
        <button class="fav-btn${fav ? " on" : ""}" type="button" data-fav="${esc(it.id)}" aria-pressed="${fav}" aria-label="${esc(t(fav ? "card.unfav" : "card.fav"))}">${HEART}</button>
      </div>
      <div class="card-body">
        <div class="price">${esc(money(it.price))}<small>${esc(t("card.perM2", { p: money(it.price / it.area) }))}</small></div>
        <h3>${esc(L(it.title))}</h3>
        <div class="card-loc">${PIN}<span>${esc(loc)}</span></div>
        <div class="specs">${specs(it)}</div>
      </div>
    </article>`;
  }

  /* ---------- Фільтри ---------- */
  let typeFilter = "";
  function fillDistricts() {
    const opts = window.PD_DISTRICTS.map((d) => `<option value="${d[0]}">${esc(settings.lang === "en" ? d[2] : d[1])}</option>`).join("");
    const f = $("#fDistrict"), v = f.value;
    f.innerHTML = `<option value="">${esc(t("f.any"))}</option>` + opts; f.value = v;
    const g = $("#formDistrict"), w = g.value;
    g.innerHTML = `<option value="" disabled>—</option>` + opts; g.value = w || "podilskyi";
  }
  function renderTypeTabs() {
    const types = [["", t("f.any"), ""], ["apartment", t("type.apartment.pl"), "#ic-apartment"], ["house", t("type.house.pl"), "#ic-house"], ["commercial", t("type.commercial.pl"), "#ic-commercial"]];
    $("#typeTabs").innerHTML = types.map(([v, label, ic]) =>
      `<button type="button" role="tab" class="type-tab${typeFilter === v ? " on" : ""}" data-type="${v}" aria-selected="${typeFilter === v}">${ic ? `<svg viewBox="0 0 48 48"><use href="${ic}"/></svg>` : ""}${esc(label)}</button>`).join("");
  }

  function renderListings() {
    const f = new FormData($("#filters"));
    const q = (f.get("q") || "").toString().trim().toLowerCase();
    const district = f.get("district"), rooms = +f.get("rooms") || 0;
    const pmin = +f.get("pmin") || 0, pmax = +f.get("pmax") || 0, amin = +f.get("amin") || 0, onlyFav = !!f.get("fav");
    const toUsd = (v) => settings.currency === "UAH" ? v / settings.rateUah : settings.currency === "EUR" ? v * settings.rateEur : v;
    let list = all().filter((it) => {
      if (typeFilter && it.type !== typeFilter) return false;
      if (district && it.district !== district) return false;
      if (pmin && it.price < toUsd(pmin)) return false;
      if (pmax && it.price > toUsd(pmax)) return false;
      if (amin && it.area < amin) return false;
      if (rooms && (rooms === 4 ? (it.rooms || 0) < 4 : it.rooms !== rooms)) return false;
      if (onlyFav && !favs.has(it.id)) return false;
      if (q) {
        const hay = [L(it.title), L(it.address), L(it.desc), districtName(it.district), t("type." + it.type)].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const sort = f.get("sort");
    list.sort((a, b) => sort === "pa" ? a.price - b.price : sort === "pd" ? b.price - a.price : sort === "area" ? b.area - a.area : (b.created || 0) - (a.created || 0));
    $("#listings").innerHTML = list.map(card).join("");
    $("#found").textContent = t("sale.found", { n: list.length });
    $("#empty").hidden = list.length > 0;
  }
  function renderFeatured() {
    const list = all().sort((a, b) => (b.created || 0) - (a.created || 0)).slice(0, 3);
    $("#featured").innerHTML = list.map(card).join("");
    $("#featured").closest(".section").hidden = list.length === 0;
  }
  function renderAll() { renderListings(); renderFeatured(); updateFavCount(); }
  function updateFavCount() {
    const ids = new Set(all().map((x) => x.id));
    const n = [...favs].filter((id) => ids.has(id)).length;
    const b = $("#favCount"); b.hidden = !n; b.textContent = n;
  }

  /* ---------- Детальна картка ---------- */
  function openDetail(id) {
    const it = byId(id); if (!it) return;
    const photos = it.photos && it.photos.length ? it.photos : null;
    const facts = [
      ["d.type", t("type." + it.type)], ["d.district", districtName(it.district)], ["d.address", L(it.address)],
      ["d.area", t("card.area", { n: it.area })], ["d.rooms", it.rooms], ["d.floor", it.floor && it.floors ? `${it.floor} / ${it.floors}` : it.floors ? t("card.floors", { n: it.floors }) : ""],
      ["d.year", it.year],
    ].filter((x) => x[1]);
    const phone = C.phone || "";
    $("#detailBody").innerHTML = `
      <div class="gallery">
        <div class="gallery-main" id="gMain">${media(it)}</div>
        ${photos && photos.length > 1 ? `<div class="gallery-thumbs">${photos.map((p, i) => `<button type="button" class="${i ? "" : "on"}" data-g="${i}"><img src="${p}" alt=""></button>`).join("")}</div>` : ""}
      </div>
      <div class="detail-info">
        <div class="card-tags" style="position:static">${`<span class="tag">${esc(t("type." + it.type))}</span>`}${it.example ? `<span class="tag light" style="border:1px solid var(--line)">${esc(t("card.demo"))}</span>` : ""}</div>
        <h2 id="dTitle">${esc(L(it.title))}</h2>
        <div class="price">${esc(money(it.price))}<small>${esc(t("card.perM2", { p: money(it.price / it.area) }))}</small></div>
        <dl class="facts">${facts.map(([k, v]) => `<div><dt>${esc(t(k))}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
        ${L(it.desc) ? `<p class="detail-desc">${esc(L(it.desc))}</p>` : ""}
        <div class="advice"><b>${esc(t("d.architect"))}</b><p>${esc(t("d.architectText"))}</p></div>
        <div class="detail-actions">
          ${phone ? `<a class="btn btn-red" href="tel:${esc(phone.replace(/[^\d+]/g, ""))}">${esc(t("d.call"))}</a>` : ""}
          <a class="btn btn-ghost" href="#/contacts" data-ask="${esc(it.id)}">${esc(t("d.ask"))}</a>
          <button class="btn btn-ghost btn-sm" type="button" data-share="${esc(it.id)}">${esc(t("d.share"))}</button>
          <button class="fav-btn${favs.has(it.id) ? " on" : ""}" style="position:static;border:1.5px solid var(--line)" type="button" data-fav="${esc(it.id)}" aria-label="${esc(t("card.fav"))}">${HEART}</button>
        </div>
      </div>`;
    openModal("#detail");
    if (photos) $$("#detailBody [data-g]").forEach((b) => b.addEventListener("click", () => {
      $$("#detailBody [data-g]").forEach((x) => x.classList.toggle("on", x === b));
      $("#gMain").innerHTML = `<img src="${photos[+b.dataset.g]}" alt="">`;
    }));
  }

  /* ---------- Модальні вікна ---------- */
  let lastFocus = null;
  function openModal(sel) {
    const m = $(sel); lastFocus = document.activeElement;
    m.hidden = false; m.classList.remove("closing"); document.body.classList.add("locked");
    m.querySelector(".modal-card").scrollTop = 0;
    setTimeout(() => { const f = m.querySelector("input:not([type=radio]):not([type=file]), .modal-x"); f && f.focus({ preventScroll: true }); }, 60);
  }
  function closeModal(m) {
    if (!m || m.hidden || m.classList.contains("closing")) return;
    m.classList.add("closing");
    const done = () => { m.hidden = true; m.classList.remove("closing"); if (!$$(".modal").some((x) => !x.hidden)) document.body.classList.remove("locked"); };
    settings.motion === "off" ? done() : setTimeout(done, 280);
    if (m.id === "detail" && /[?&]id=/.test(location.hash)) history.replaceState(null, "", location.hash.replace(/[?&]id=[^&]*/, ""));
    lastFocus && lastFocus.focus && lastFocus.focus({ preventScroll: true });
  }
  document.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeModal(e.target.closest(".modal")); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { $$(".modal").filter((m) => !m.hidden).forEach(closeModal); toggleNav(false); }
  });

  /* ---------- Тост ---------- */
  let toastT = 0;
  function toast(msg) {
    const el = $("#toast"); el.textContent = msg; el.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), 2600);
  }

  /* ---------- Надсилання форм ----------
     З ключем Web3Forms лист іде напряму на пошту власника.
     Без ключа — відкривається поштова програма відвідувача. */
  async function sendForm(subject, lines, btn) {
    const text = lines.filter((l) => l[1] !== undefined && l[1] !== null && l[1] !== "").map(([k, v]) => `${k}: ${v}`).join("\n");
    if (C.web3formsKey) {
      const old = btn && btn.textContent;
      if (btn) { btn.disabled = true; btn.textContent = t("form.sending"); }
      try {
        const r = await fetch("https://api.web3forms.com/submit", {
          method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ access_key: C.web3formsKey, subject, from_name: "PODIL DRAGONS", message: text }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || j.success === false) throw new Error(j.message || r.status);
        return true;
      } catch (e) {
        toast(t("form.sendErr"));
        return false;
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = old; }
      }
    }
    if (!C.email) { toast(t("form.sendErr")); return false; }
    location.href = `mailto:${C.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    return true;
  }
  function invalidFields(form) {
    $$(".invalid", form).forEach((n) => n.classList.remove("invalid"));
    const bad = $$("[required]", form).filter((n) => !n.closest("[hidden]") && (n.type === "checkbox" ? !n.checked : !n.value.trim() || (n.type === "number" && +n.value <= 0)));
    bad.forEach((n) => { void n.offsetWidth; n.classList.add("invalid"); });
    if (bad.length) bad[0].focus();
    return bad.length;
  }

  /* ---------- Заявка на продаж ---------- */
  function syncFormType() {
    const type = new FormData($("#listForm")).get("type");
    $(".rooms-field").hidden = type === "commercial";
    $(".floor-field").hidden = type === "house";
  }
  function openForm() {
    $("#formErr").textContent = "";
    $$("#listForm .invalid").forEach((n) => n.classList.remove("invalid"));
    syncFormType();
    openModal("#formModal");
  }
  $("#listForm").addEventListener("change", (e) => { if (e.target.name === "type") syncFormType(); });
  $("#listForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target, f = new FormData(form);
    if (form.website.value) return; // пастка для ботів
    if (invalidFields(form)) { $("#formErr").textContent = t("form.err"); return; }
    $("#formErr").textContent = "";
    const type = f.get("type"), uk = window.PD_I18N.uk;
    const dn = (window.PD_DISTRICTS.find((d) => d[0] === f.get("district")) || [])[1] || "";
    const ok = await sendForm(`Заявка на продаж: ${f.get("title")}`, [
      ["Тип", uk["type." + type]], ["Назва", f.get("title")], ["Район", dn], ["Адреса", f.get("address")],
      ["Ціна, $", f.get("price")], ["Площа, м²", f.get("area")],
      ["Кімнат", type === "commercial" ? "" : f.get("rooms")], ["Поверх", type === "house" ? "" : f.get("floor")],
      ["Поверхів", f.get("floors")], ["Рік побудови", f.get("year")], ["Опис", f.get("desc")],
      ["Ім'я", f.get("contact")], ["Телефон", f.get("phone")], ["Мова сайту", settings.lang],
    ], $("#listForm [type=submit]"));
    if (!ok) return;
    form.reset(); fillDistricts();
    closeModal($("#formModal"));
    toast(t("form.saved"));
  });

  /* ---------- Обране, клік по картках ---------- */
  function toggleFav(id) {
    if (favs.has(id)) { favs.delete(id); toast(t("toast.favRemove")); } else { favs.add(id); toast(t("toast.favAdd")); }
    saveFavs();
    $$(`[data-fav="${CSS.escape(id)}"]`).forEach((b) => { const on = favs.has(id); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
    updateFavCount();
    if ($("#filters").fav.checked) renderListings();
  }
  document.addEventListener("click", (e) => {
    const fav = e.target.closest("[data-fav]");
    if (fav) { e.stopPropagation(); toggleFav(fav.dataset.fav); return; }
    if (e.target.closest("[data-action='open-form']")) { toggleNav(false); openForm(); return; }
    const share = e.target.closest("[data-share]");
    if (share) {
      const url = location.href.split("#")[0] + "#/sale?id=" + encodeURIComponent(share.dataset.share);
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => toast(t("d.copied")), () => prompt("URL", url));
      return;
    }
    const ask = e.target.closest("[data-ask]");
    if (ask) {
      const it = byId(ask.dataset.ask);
      closeModal($("#detail"));
      setTimeout(() => { const m = $("#contactForm").msg; m.value = `${L(it.title)} (${money(it.price)})\n`; $("#contactForm").topic.selectedIndex = 0; }, 50);
      return;
    }
    const c = e.target.closest(".card");
    if (c) openDetail(c.dataset.id);
  });
  document.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("card")) { e.preventDefault(); openDetail(e.target.dataset.id); }
  });

  $("#filters").addEventListener("input", renderListings);
  $("#filters").addEventListener("reset", () => { typeFilter = ""; setTimeout(() => { renderTypeTabs(); renderListings(); }); });
  $("#filters").addEventListener("submit", (e) => e.preventDefault());
  $("#typeTabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-type]"); if (!b) return;
    typeFilter = b.dataset.type; renderTypeTabs(); renderListings();
  });

  /* ---------- Контакти, «Про нас», підвал ---------- */
  const SOC_ICONS = {
    telegram: '<path d="M21 4L3 11l6 2 2 6 3-4 5 4z M9 13l9-7"/>',
    viber: '<path d="M12 3c5 0 8 2.5 8 7.5S17 18 12 18l-4 3v-3.6C5.6 16.3 4 14 4 10.5 4 5.5 7 3 12 3z M9 8c0 3 2 6 6 6l1-1.5-2-1-1 .8c-1-.4-2-1.4-2.4-2.4l.8-1-1-2z"/>',
    whatsapp: '<path d="M4 20l1.3-4A8 8 0 1 1 8 18.8z M9 8c0 3.5 3 7 7 7l1-1.6-2.2-1-1 .9c-1.4-.5-2.5-1.6-3-3l.9-1-1-2.2z"/>',
    instagram: '<rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.6"/><circle cx="17" cy="7" r=".8"/>',
    facebook: '<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z"/>',
  };
  const socialLinks = () => Object.keys(SOC_ICONS).filter((k) => SOC[k]).map((k) =>
    `<a class="soc" href="${esc(SOC[k])}" target="_blank" rel="noopener" aria-label="${k}" title="${k[0].toUpperCase() + k.slice(1)}"><svg viewBox="0 0 24 24">${SOC_ICONS[k]}</svg></a>`).join("");
  function renderContacts() {
    const p = $("#cPhone"), m = $("#cEmail");
    p.hidden = !C.phoneDisplay; p.href = "tel:" + (C.phone || "").replace(/[^\d+]/g, ""); $("b", p).textContent = C.phoneDisplay || "";
    m.hidden = !C.email; m.href = "mailto:" + C.email; $("b", m).textContent = C.email || "";
    $("#cAddress").textContent = L(C.address) || t("contacts.addressV");
    $("#cHours").textContent = L(C.hours) || t("contacts.hoursV");
    $("#cSocial").innerHTML = socialLinks(); $("#cSocialWrap").hidden = !$("#cSocial").innerHTML;
    const map = $("#cMap");
    if (C.mapQuery && !map.dataset.q) {
      map.dataset.q = C.mapQuery;
      map.innerHTML = `<iframe title="Map" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=${encodeURIComponent(C.mapQuery)}&output=embed"></iframe>`;
    }
    map.hidden = !C.mapQuery;
  }
  function renderAbout() {
    const ph = $("#portraitPhoto");
    if (C.portrait) { ph.innerHTML = `<img src="${esc(C.portrait)}" alt="${esc(t("about.name"))}">`; ph.hidden = false; $(".portrait-seal").hidden = true; }
    const pr = (C.projects || []).filter((x) => x && x.title);
    $("#projects").innerHTML = pr.map((x) => `<article class="project">
      ${x.image ? `<img src="${esc(x.image)}" alt="" loading="lazy">` : `<svg viewBox="0 0 120 80" aria-hidden="true"><use href="#ic-tower"/></svg>`}
      <div><h3>${esc(L(x.title))}</h3>${L(x.text) ? `<p>${esc(L(x.text))}</p>` : ""}</div></article>`).join("");
    $("#projectsTitle").hidden = !pr.length;
  }
  function renderFooter() {
    $("#fSocial").innerHTML = socialLinks();
    const co = C.company || {};
    $("#fCompany").textContent = [co.name, co.code ? (settings.lang === "en" ? "ID " : "ЄДРПОУ/ІПН ") + co.code : ""].filter(Boolean).join(" · ");
    const owner = co.name || "PODIL DRAGONS";
    $$("[data-privacy]").forEach((n) => { n.textContent = t(n.dataset.privacy, { owner, email: C.email || "", phone: C.phoneDisplay || "" }); });
  }
  $("#contactForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target, f = new FormData(form);
    if (form.website.value) return;
    if (invalidFields(form)) return;
    const ok = await sendForm(`PODIL DRAGONS — ${f.get("topic")}`, [
      ["Ім'я", f.get("name")], ["Контакт", f.get("reach")], ["Тема", f.get("topic")], ["Повідомлення", f.get("msg")],
    ], $("#contactForm [type=submit]"));
    if (ok) { toast(t("contacts.sent")); if (C.web3formsKey) form.reset(); }
  });

  /* ---------- Налаштування ---------- */
  function placeSegInk(seg) {
    let ink = $(".seg-ink", seg);
    if (!ink) { ink = document.createElement("span"); ink.className = "seg-ink"; seg.prepend(ink); }
    const on = $("button.on", seg); if (!on || !on.offsetWidth) return;
    ink.style.left = on.offsetLeft + "px"; ink.style.width = on.offsetWidth + "px";
    ink.style.top = on.offsetTop + "px"; ink.style.height = on.offsetHeight + "px"; ink.style.bottom = "auto";
  }
  function syncSettingsUI() {
    $$(".seg").forEach((seg) => {
      const v = settings[seg.dataset.setting];
      $$("button", seg).forEach((b) => { b.classList.toggle("on", b.dataset.value === v); b.setAttribute("aria-pressed", b.dataset.value === v); });
      placeSegInk(seg);
    });
    $("#rateUah").value = settings.rateUah; $("#rateEur").value = settings.rateEur;
  }
  function applyTheme() {
    const d = document.documentElement;
    if (settings.theme === "auto") delete d.dataset.theme; else d.dataset.theme = settings.theme;
    d.dataset.motion = settings.motion;
  }
  function setLang(lang, animate) {
    if (lang === settings.lang) return;
    const go = () => { settings.lang = lang; saveSettings(); applyI18n(); renderAll(); syncSettingsUI(); };
    if (animate && settings.motion === "on") {
      const c = $(".page-curtain"); c.classList.remove("run"); void c.offsetWidth; c.classList.add("run");
      setTimeout(go, 400); setTimeout(() => toast(t("toast.lang")), 700);
    } else { go(); toast(t("toast.lang")); }
  }
  $$(".seg").forEach((seg) => seg.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-value]"); if (!b) return;
    const key = seg.dataset.setting, v = b.dataset.value;
    if (key === "lang") { setLang(v, true); return; }
    settings[key] = v; saveSettings(); applyTheme(); syncSettingsUI();
    if (key === "currency") renderAll();
    if (key === "motion") { dragon && dragon.refresh(); $$(".reveal").forEach((n) => n.classList.add("in")); }
  }));
  $("#rateUah").addEventListener("change", (e) => { const v = +e.target.value; if (v > 0) { settings.rateUah = v; saveSettings(); renderAll(); } });
  $("#rateEur").addEventListener("change", (e) => { const v = +e.target.value; if (v > 0) { settings.rateEur = v; saveSettings(); renderAll(); } });
  $("#clearFav").addEventListener("click", () => { favs.clear(); saveFavs(); renderAll(); toast(t("set.cleared")); });
  $("#langQuick").addEventListener("click", () => setLang(settings.lang === "uk" ? "en" : "uk", true));
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => {});

  /* ---------- Навігація ---------- */
  const nav = $("#nav"), burger = $("#burger");
  function toggleNav(open) {
    nav.classList.toggle("open", open); burger.setAttribute("aria-expanded", open);
  }
  burger.addEventListener("click", (e) => { e.stopPropagation(); toggleNav(!nav.classList.contains("open")); });
  document.addEventListener("click", (e) => { if (nav.classList.contains("open") && !e.target.closest("#nav")) toggleNav(false); });
  function moveNavInk() {
    const a = $(".nav a.active"), ink = $("#navInk");
    if (!a || !a.offsetWidth) { ink.style.opacity = 0; return; }
    ink.style.opacity = 1; ink.style.left = a.offsetLeft + 12 + "px"; ink.style.width = a.offsetWidth - 24 + "px";
  }
  addEventListener("resize", () => { moveNavInk(); $$(".seg").forEach(placeSegInk); });

  /* ---------- Поява елементів при прокрутці ---------- */
  const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => {
    es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }) : null;
  function observeReveals(root) {
    const groups = new Map();
    $$(".reveal:not(.in)", root).forEach((n) => {
      const i = groups.get(n.parentNode) || 0; groups.set(n.parentNode, i + 1);
      n.style.setProperty("--d", Math.min(i, 6) * 0.09 + "s");
      if (io && settings.motion === "on") io.observe(n); else n.classList.add("in");
    });
  }

  /* ---------- Маршрути ---------- */
  const PAGES = ["home", "sale", "reconstruction", "about", "contacts", "settings", "privacy"];
  let current = null;
  function parseHash() {
    const h = location.hash.replace(/^#\/?/, "");
    const [path, qs] = h.split("?");
    return { page: PAGES.includes(path) ? path : "home", params: new URLSearchParams(qs || "") };
  }
  function route() {
    const { page, params } = parseHash();
    toggleNav(false);
    if (page !== current) {
      const prev = current && $(`.page[data-page="${current}"]`);
      const next = $(`.page[data-page="${page}"]`);
      const show = () => {
        $$(".page").forEach((p) => { p.hidden = p !== next; p.classList.remove("leaving"); });
        window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
        observeReveals(next);
        if (page === "settings") requestAnimationFrame(syncSettingsUI);
      };
      if (prev && settings.motion === "on") { prev.classList.add("leaving"); setTimeout(show, 260); } else show();
      current = page;
      $$(".nav a").forEach((a) => a.classList.toggle("active", a.dataset.route === page));
      requestAnimationFrame(moveNavInk);
    }
    if (page === "sale") {
      if (params.get("fav")) { $("#filters").fav.checked = true; renderListings(); }
      if (params.get("id")) setTimeout(() => openDetail(params.get("id")), 300);
    }
  }
  addEventListener("hashchange", route);

  /* ---------- Шапка і паралакс ---------- */
  const topbar = $("#topbar"), dragonSvg = $("#dragon"), heroHead = $(".hero-head");
  let ticking = false;
  addEventListener("scroll", () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const y = scrollY;
      topbar.classList.toggle("scrolled", y > 8);
      if (current === "home" && settings.motion === "on" && y < innerHeight * 1.2) {
        dragonSvg.style.transform = `translateY(${y * 0.12}px)`;
        heroHead.style.transform = `translateY(${y * 0.25}px)`; heroHead.style.opacity = Math.max(0, 1 - y / (innerHeight * 0.7));
      }
    });
  }, { passive: true });
  $("#toTop").addEventListener("click", () => window.scrollTo({ top: 0, behavior: settings.motion === "on" ? "smooth" : "auto" }));
  $("#year").textContent = new Date().getFullYear();

  /* ---------- Дані для пошукових систем ---------- */
  (function seo() {
    const url = "https://" + (C.domain || location.host) + "/";
    const ld = {
      "@context": "https://schema.org", "@type": "RealEstateAgent", name: "PODIL DRAGONS", url,
      image: url + "img/og-image.png", logo: url + "img/icon-512.png",
      description: window.PD_I18N.uk["hero.sub"], areaServed: { "@type": "City", name: "Kyiv" },
      address: { "@type": "PostalAddress", addressLocality: "Київ", addressCountry: "UA", streetAddress: L(C.address) || undefined },
      telephone: C.phone || undefined, email: C.email || undefined,
      founder: { "@type": "Person", name: "Микола Вихарєв", jobTitle: "Архітектор" },
      sameAs: Object.values(SOC).filter((v) => /^https?:/.test(v || "")),
    };
    const sc = document.createElement("script"); sc.type = "application/ld+json"; sc.textContent = JSON.stringify(ld);
    document.head.appendChild(sc);
  })();

  /* ---------- Старт ---------- */
  applyTheme();
  const dragon = window.PDDragon ? window.PDDragon.mount(dragonSvg) : null;
  applyI18n();
  renderAll();
  route();
  if (document.fonts) document.fonts.ready.then(() => { moveNavInk(); $$(".seg").forEach(placeSegInk); });
})();
