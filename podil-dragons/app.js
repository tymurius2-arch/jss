/* PODIL DRAGONS — логіка сайту: сторінки, оголошення, фільтри, форма, налаштування. */
(function () {
  "use strict";

  /* Контакти студії — впишіть справжні. */
  const CONFIG = {
    phone: "+380 00 000 00 00",
    email: "info@podildragons.com.ua",
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  };

  /* ---------- Налаштування ---------- */
  const DEFAULTS = { lang: "uk", currency: "USD", rateUah: 41.5, rateEur: 1.08, theme: "auto", motion: "on", demo: "on" };
  const settings = Object.assign({}, DEFAULTS, store.get("pd.settings", {}));
  if (!store.get("pd.settings", null) && matchMedia("(prefers-reduced-motion: reduce)").matches) settings.motion = "off";
  const saveSettings = () => store.set("pd.settings", settings);

  let favs = new Set(store.get("pd.favs", []));
  let mine = store.get("pd.listings", []);
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
  function all() {
    const demo = settings.demo === "on" ? window.PD_DEMO.map((x) => Object.assign({ demo: true }, x)) : [];
    return mine.map((x) => Object.assign({ own: true }, x)).concat(demo);
  }
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
          ${it.demo ? `<span class="tag light">${esc(t("card.demo"))}</span>` : ""}${it.own ? `<span class="tag light">${esc(t("card.mine"))}</span>` : ""}</div>
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
    const phone = it.phone || CONFIG.phone;
    $("#detailBody").innerHTML = `
      <div class="gallery">
        <div class="gallery-main" id="gMain">${media(it)}</div>
        ${photos && photos.length > 1 ? `<div class="gallery-thumbs">${photos.map((p, i) => `<button type="button" class="${i ? "" : "on"}" data-g="${i}"><img src="${p}" alt=""></button>`).join("")}</div>` : ""}
      </div>
      <div class="detail-info">
        <div class="card-tags" style="position:static">${`<span class="tag">${esc(t("type." + it.type))}</span>`}${it.demo ? `<span class="tag light" style="border:1px solid var(--line)">${esc(t("card.demo"))}</span>` : ""}</div>
        <h2 id="dTitle">${esc(L(it.title))}</h2>
        <div class="price">${esc(money(it.price))}<small>${esc(t("card.perM2", { p: money(it.price / it.area) }))}</small></div>
        <dl class="facts">${facts.map(([k, v]) => `<div><dt>${esc(t(k))}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
        ${L(it.desc) ? `<p class="detail-desc">${esc(L(it.desc))}</p>` : ""}
        ${it.contact ? `<p class="contact-line">${esc(t("d.contact"))}: <b>${esc(it.contact)}</b> · ${esc(it.phone)}</p>` : ""}
        <div class="advice"><b>${esc(t("d.architect"))}</b><p>${esc(t("d.architectText"))}</p></div>
        <div class="detail-actions">
          <a class="btn btn-red" href="tel:${esc(phone.replace(/[^\d+]/g, ""))}">${esc(t("d.call"))}</a>
          <a class="btn btn-ghost" href="#/contacts" data-ask="${esc(it.id)}">${esc(t("d.ask"))}</a>
          <button class="btn btn-ghost btn-sm" type="button" data-share="${esc(it.id)}">${esc(t("d.share"))}</button>
          <button class="fav-btn${favs.has(it.id) ? " on" : ""}" style="position:static;border:1.5px solid var(--line)" type="button" data-fav="${esc(it.id)}" aria-label="${esc(t("card.fav"))}">${HEART}</button>
          ${it.own ? `<button class="btn btn-ghost btn-sm danger" type="button" data-del="${esc(it.id)}">${esc(t("d.delete"))}</button>` : ""}
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

  /* ---------- Форма оголошення ---------- */
  let photos = [];
  function compress(file) {
    return new Promise((res) => {
      const r = new FileReader();
      r.onload = () => {
        const img = new Image();
        img.onload = () => {
          const max = 1100, k = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          res(c.toDataURL("image/jpeg", 0.72));
        };
        img.onerror = () => res(null);
        img.src = r.result;
      };
      r.onerror = () => res(null);
      r.readAsDataURL(file);
    });
  }
  async function addPhotos(files) {
    for (const f of Array.from(files).filter((f) => f.type.startsWith("image/"))) {
      if (photos.length >= 6) break;
      const d = await compress(f); if (d) photos.push(d);
    }
    renderThumbs();
  }
  function renderThumbs() {
    $("#thumbs").innerHTML = photos.map((p, i) => `<div class="thumb"><img src="${p}" alt=""><button type="button" data-rm="${i}" aria-label="${esc(t("form.removePhoto"))}">✕</button></div>`).join("");
  }
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
  $("#photoInput").addEventListener("change", (e) => { addPhotos(e.target.files); e.target.value = ""; });
  const drop = $("#drop");
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => addPhotos(e.dataTransfer.files));
  $("#thumbs").addEventListener("click", (e) => { const b = e.target.closest("[data-rm]"); if (b) { photos.splice(+b.dataset.rm, 1); renderThumbs(); } });

  $("#listForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target, f = new FormData(form);
    $$(".invalid", form).forEach((n) => n.classList.remove("invalid"));
    const bad = $$("[required]", form).filter((n) => !n.closest("[hidden]") && (n.type === "checkbox" ? !n.checked : !n.value.trim() || (n.type === "number" && +n.value <= 0)));
    if (bad.length) {
      bad.forEach((n) => { n.classList.remove("invalid"); void n.offsetWidth; n.classList.add("invalid"); });
      $("#formErr").textContent = t("form.err");
      bad[0].focus();
      return;
    }
    const num = (k) => { const v = parseFloat(f.get(k)); return isFinite(v) && v > -10 ? v : undefined; };
    const type = f.get("type");
    const item = {
      id: "my-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      type, title: f.get("title").trim(), district: f.get("district"), address: f.get("address").trim(),
      price: num("price"), area: num("area"),
      rooms: type === "commercial" ? undefined : num("rooms"), floor: type === "house" ? undefined : num("floor"),
      floors: num("floors"), year: num("year"), desc: f.get("desc").trim(),
      contact: f.get("contact").trim(), phone: f.get("phone").trim(), photos: photos.slice(), created: Date.now(),
    };
    const next = [item].concat(mine);
    if (!store.set("pd.listings", next)) { $("#formErr").textContent = t("form.errStorage"); return; }
    mine = next; photos = []; renderThumbs(); form.reset(); fillDistricts();
    closeModal($("#formModal"));
    toast(t("form.saved"));
    renderAll();
    if (current !== "sale") location.hash = "#/sale"; else window.scrollTo({ top: $("#typeTabs").offsetTop - 90 });
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
    const del = e.target.closest("[data-del]");
    if (del) {
      if (!confirm(t("d.deleteConfirm"))) return;
      mine = mine.filter((x) => x.id !== del.dataset.del); store.set("pd.listings", mine);
      favs.delete(del.dataset.del); saveFavs();
      closeModal($("#detail")); renderAll(); return;
    }
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

  /* ---------- Контакти ---------- */
  function renderContacts() {
    const p = $("#cPhone"), m = $("#cEmail");
    p.href = "tel:" + CONFIG.phone.replace(/[^\d+]/g, ""); $("b", p).textContent = CONFIG.phone;
    m.href = "mailto:" + CONFIG.email; $("b", m).textContent = CONFIG.email;
  }
  $("#contactForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const subject = `PODIL DRAGONS — ${f.get("topic")}`;
    const body = `${f.get("msg")}\n\n${f.get("name")}\n${f.get("reach")}`;
    toast(t("contacts.sent"));
    location.href = `mailto:${CONFIG.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
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
    if (key === "currency" || key === "demo") renderAll();
    if (key === "motion") { dragon && dragon.refresh(); $$(".reveal").forEach((n) => n.classList.add("in")); }
  }));
  $("#rateUah").addEventListener("change", (e) => { const v = +e.target.value; if (v > 0) { settings.rateUah = v; saveSettings(); renderAll(); } });
  $("#rateEur").addEventListener("change", (e) => { const v = +e.target.value; if (v > 0) { settings.rateEur = v; saveSettings(); renderAll(); } });
  $("#clearFav").addEventListener("click", () => { favs.clear(); saveFavs(); renderAll(); toast(t("set.cleared")); });
  $("#clearMine").addEventListener("click", () => {
    if (!mine.length || !confirm(t("set.confirmMine"))) return;
    mine = []; store.set("pd.listings", mine); renderAll(); toast(t("set.cleared"));
  });
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
  const PAGES = ["home", "sale", "reconstruction", "about", "contacts", "settings"];
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

  /* ---------- Старт ---------- */
  applyTheme();
  const dragon = window.PDDragon ? window.PDDragon.mount(dragonSvg) : null;
  applyI18n();
  renderAll();
  route();
  if (document.fonts) document.fonts.ready.then(() => { moveNavInk(); $$(".seg").forEach(placeSegInk); });
})();
