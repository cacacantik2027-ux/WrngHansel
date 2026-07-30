const tg = window.Telegram && window.Telegram.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

const state = {
  page: "home",
  talents: [],
  info: null,
  rules: "",
  botUsername: null,
  activeTalent: null,
  theme: {},
  home: {
    eyebrow: "Talent Hansel",
    title: "Talent produk, siap untuk brand-mu.",
    subtitle: "Jelajahi katalog talent kami, pilih paket yang sesuai, dan ajukan order langsung ke tim kami.",
    tag: "Order terstruktur, respons cepat",
    sectionTitle: "Jelajahi",
    links: {
      talent: { label: "Katalog Talent", sub: "Foto, deskripsi, dan paket harga" },
      info: { label: "Info & Promo", sub: "Channel, grup, sponsor" },
      rules: { label: "Aturan Order", sub: "Ketentuan yang perlu kamu tahu" },
    },
  },
};

const app = document.getElementById("app");

// ---- Typewriter effect --------------------------------------------
// Walks every real text node inside `root` and reveals it character by
// character, with a small stagger between elements (in DOM order) so a
// whole page/menu "types itself out" whenever it's opened, instead of
// every element typing fully in sequence (which would feel sluggish on
// longer pages like Info or Rules).
function typewriter(root, opts = {}) {
  if (!root) return;
  const speed = opts.speed || 16; // ms per character
  const stagger = opts.stagger || 28; // ms between each element starting

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      const el = node.parentElement;
      if (!el) return NodeFilter.FILTER_REJECT;
      if (el.closest("svg")) return NodeFilter.FILTER_REJECT; // skip icon paths
      if (el.tagName === "SCRIPT" || el.tagName === "STYLE") return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);

  nodes.forEach((node, idx) => {
    const full = node.nodeValue;
    node.nodeValue = "";
    let i = 0;
    setTimeout(function tick() {
      i++;
      node.nodeValue = full.slice(0, i);
      if (i < full.length) setTimeout(tick, speed);
    }, idx * stagger);
  });
}

async function api(path, opts = {}) {
  const headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
  if (tg && tg.initData) headers["X-Telegram-Init-Data"] = tg.initData;
  const res = await fetch(path, { ...opts, headers });
  if (!res.ok) throw new Error(`Request gagal (${res.status})`);
  return res.json();
}

function chatIcon() {
  return `<svg viewBox="0 0 24 24"><path d="M21.5 3.5 2.7 11c-.9.35-.9 1.6.05 1.9l4.7 1.5 1.8 5.6c.28.85 1.35 1.05 1.9.35l2.5-3.2 4.6 3.4c.75.55 1.85.15 2.05-.75l3.05-14.5c.2-.95-.75-1.7-1.85-1.25Zm-3.05 3.1-8.3 7.6-.3 3.2-1.4-4.3 10-6.5Z"/></svg>`;
}

function openSupportChat() {
  if (!state.botUsername) return;
  const url = `https://t.me/${state.botUsername}?start=support`;
  if (tg && tg.openTelegramLink) tg.openTelegramLink(url);
  else window.open(url, "_blank");
}

// Tapping "Ajukan Order" on a talent card sends the user straight into the
// bot's chat, deep-linked with the talent's id so the bot (and admin) know
// right away which talent the order is for.
function openOrderChat(talentId) {
  if (!state.botUsername) return;
  const url = `https://t.me/${state.botUsername}?start=order_${talentId}`;
  if (tg && tg.openTelegramLink) tg.openTelegramLink(url);
  else window.open(url, "_blank");
}

function topbar(eyebrow) {
  return `
    <div class="topbar">
      <span class="eyebrow">${eyebrow}</span>
      <button class="chat-fab" onclick="openSupportChat()" aria-label="Live chat admin">${chatIcon()}</button>
    </div>`;
}

function renderHome() {
  const h = state.home;
  const links = h.links || {};
  return `
    ${topbar(h.eyebrow)}
    <div class="page">
      <div class="hero">
        <h1>${h.title}</h1>
        <p>${h.subtitle}</p>
        <span class="tag">${h.tag}</span>
      </div>
      <div class="section-title">${h.sectionTitle || "Jelajahi"}</div>
      <div class="home-links">
        <div class="home-link" onclick="navigate('talent')">
          <span class="num">01</span>
          <div>
            <div class="label">${links.talent ? links.talent.label : "Katalog Talent"}</div>
            <div class="sub">${links.talent ? links.talent.sub : ""}</div>
          </div>
        </div>
        <div class="home-link" onclick="navigate('info')">
          <span class="num">02</span>
          <div>
            <div class="label">${links.info ? links.info.label : "Info & Promo"}</div>
            <div class="sub">${links.info ? links.info.sub : ""}</div>
          </div>
        </div>
        <div class="home-link" onclick="navigate('rules')">
          <span class="num">03</span>
          <div>
            <div class="label">${links.rules ? links.rules.label : "Aturan Order"}</div>
            <div class="sub">${links.rules ? links.rules.sub : ""}</div>
          </div>
        </div>
      </div>
    </div>`;
}

function renderTalentGrid() {
  if (state.talents.length === 0) {
    return `${topbar("Katalog")}<div class="page"><div class="empty-state">Belum ada talent yang ditampilkan.</div></div>`;
  }
  const cards = state.talents
    .map((t, i) => {
      return `
        <div class="polaroid" onclick="openTalent('${t.id}')">
          <div class="tape"></div>
          <img src="${t.photo || ""}" alt="${t.name}" onerror="this.style.opacity=0.3" />
          <div class="name">${t.name}</div>
          <div class="desc">${t.description || ""}</div>
          ${t.pricelist ? `<div class="from-price">Lihat pricelist</div>` : ""}
        </div>`;
    })
    .join("");
  return `${topbar("Katalog")}<div class="page"><div class="talent-grid">${cards}</div></div>`;
}

function renderInfo() {
  if (!state.info) return `${topbar("Info")}<div class="page"><div class="empty-state">Memuat...</div></div>`;
  const pages = state.info;
  const card = (key, page) => `
    <div class="info-card">
      <h3>${page.title || key}</h3>
      <p>${page.body || ""}</p>
      ${page.url ? `<a href="${page.url}" target="_blank" rel="noopener">Buka tautan</a>` : ""}
    </div>`;
  return `
    ${topbar("Info & Promo")}
    <div class="page">
      ${Object.entries(pages).map(([k, v]) => card(k, v)).join("")}
    </div>`;
}

function renderRules() {
  return `
    ${topbar("Aturan")}
    <div class="page">
      <div class="rules-text">${state.rules || "Belum ada aturan."}</div>
    </div>`;
}

function tabIcon(name) {
  const icons = {
    home: '<path d="M12 3 3 10v11h6v-6h6v6h6V10Z"/>',
    talent: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a7 7 0 0 1 16 0v2Z"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 8v.01M11 11h1v6h1" stroke="currentColor" stroke-width="1.5" fill="none"/>',
    rules: '<path d="M6 3h9l3 3v15H6Z"/><path d="M8 9h8M8 13h8M8 17h5" stroke="#fffaf2" stroke-width="1.2"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="currentColor">${icons[name]}</svg>`;
}

function renderTabbar() {
  const tabs = [
    { key: "home", label: "Beranda" },
    { key: "talent", label: "Talent" },
    { key: "info", label: "Info" },
    { key: "rules", label: "Aturan" },
  ];
  return `
    <div class="tabbar">
      ${tabs
        .map(
          (t) => `
        <button class="tab ${state.page === t.key ? "active" : ""}" onclick="navigate('${t.key}')">
          ${tabIcon(t.key)}
          <span>${t.label}</span>
        </button>`
        )
        .join("")}
    </div>`;
}

function pageBackgroundStyle(pageKey) {
  const bg = state.theme[pageKey];
  if (!bg || !bg.value) return "";
  if (bg.type === "image") {
    return `background-image:url('${bg.value}');background-size:cover;background-position:center;`;
  }
  return `background-color:${bg.value};`;
}

function render() {
  let body = "";
  if (state.page === "home") body = renderHome();
  else if (state.page === "talent") body = renderTalentGrid();
  else if (state.page === "info") body = renderInfo();
  else if (state.page === "rules") body = renderRules();
  const style = pageBackgroundStyle(state.page);
  app.innerHTML = `<div class="page-wrapper" style="${style}">${body}</div>` + renderTabbar();
  typewriter(app);
}

window.navigate = function (page) {
  state.page = page;
  render();
};
window.openSupportChat = openSupportChat;
window.openOrderChat = openOrderChat;

window.openTalent = function (id) {
  const talent = state.talents.find((t) => t.id === id);
  if (!talent) return;
  state.activeTalent = talent;
  renderTalentSheet(talent);
};

function renderTalentSheet(t) {
  const overlay = document.createElement("div");
  overlay.className = "sheet-overlay";
  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };
  const pricelist = (t.pricelist || "").trim();

  overlay.innerHTML = `
    <div class="sheet">
      <div class="grabber"></div>
      <img class="sheet-photo" src="${t.photo || ""}" alt="${t.name}" />
      <h2>${t.name}</h2>
      <div class="desc">${t.description || ""}</div>
      <div class="section-title">Pricelist</div>
      <div class="pricelist-text">${pricelist || '<div class="empty-state">Belum ada pricelist.</div>'}</div>
      <button class="btn-primary" onclick="openOrderChat('${t.id}')">Ajukan Order</button>
    </div>`;
  document.body.appendChild(overlay);
  typewriter(overlay);
}

function showToast(text) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = text;
  document.body.appendChild(el);
  typewriter(el, { speed: 14, stagger: 0 });
  setTimeout(() => el.remove(), 2600);
}

async function bootstrap() {
  render(); // show shell immediately
  try {
    const [talents, info, rules, cfg, theme, home] = await Promise.all([
      api("/api/talent"),
      api("/api/info"),
      api("/api/info/rules"),
      api("/api/config"),
      api("/api/theme"),
      api("/api/home"),
    ]);
    state.talents = talents;
    state.info = info;
    state.rules = rules.rules;
    state.botUsername = cfg.botUsername;
    state.theme = theme;
    state.home = home;
  } catch (err) {
    console.error("Failed to load initial data", err);
  }
  render();
}

bootstrap();
