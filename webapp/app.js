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
};

const app = document.getElementById("app");

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

function topbar(eyebrow) {
  return `
    <div class="topbar">
      <span class="eyebrow">${eyebrow}</span>
      <button class="chat-fab" onclick="openSupportChat()" aria-label="Live chat admin">${chatIcon()}</button>
    </div>`;
}

function renderHome() {
  return `
    ${topbar("Agensi Talent")}
    <div class="page">
      <div class="hero">
        <h1>Talent produk, siap untuk brand-mu.</h1>
        <p>Jelajahi katalog talent kami, pilih paket yang sesuai, dan ajukan booking langsung ke tim kami.</p>
        <span class="tag">Booking terstruktur, respons cepat</span>
      </div>
      <div class="section-title">Jelajahi</div>
      <div class="home-links">
        <div class="home-link" onclick="navigate('talent')">
          <span class="num">01</span>
          <div>
            <div class="label">Katalog Talent</div>
            <div class="sub">Foto, deskripsi, dan paket harga</div>
          </div>
        </div>
        <div class="home-link" onclick="navigate('info')">
          <span class="num">02</span>
          <div>
            <div class="label">Info & Promo</div>
            <div class="sub">Channel, grup, sponsor</div>
          </div>
        </div>
        <div class="home-link" onclick="navigate('rules')">
          <span class="num">03</span>
          <div>
            <div class="label">Aturan Booking</div>
            <div class="sub">Ketentuan yang perlu kamu tahu</div>
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
      const fromPrice = t.packages && t.packages.length
        ? Math.min(...t.packages.map((p) => p.price))
        : null;
      return `
        <div class="polaroid" onclick="openTalent('${t.id}')">
          <div class="tape"></div>
          <img src="${t.photo || ""}" alt="${t.name}" onerror="this.style.opacity=0.3" />
          <div class="name">${t.name}</div>
          <div class="desc">${t.description || ""}</div>
          ${fromPrice ? `<div class="from-price">Mulai Rp ${fromPrice.toLocaleString("id-ID")}</div>` : ""}
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

function render() {
  let body = "";
  if (state.page === "home") body = renderHome();
  else if (state.page === "talent") body = renderTalentGrid();
  else if (state.page === "info") body = renderInfo();
  else if (state.page === "rules") body = renderRules();
  app.innerHTML = body + renderTabbar();
}

window.navigate = function (page) {
  state.page = page;
  render();
};
window.openSupportChat = openSupportChat;

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
  const packages = (t.packages || [])
    .map(
      (p) => `
      <div class="package-row">
        <span class="pname">${p.name}</span>
        <span class="pprice">Rp ${Number(p.price).toLocaleString("id-ID")}</span>
      </div>`
    )
    .join("");

  overlay.innerHTML = `
    <div class="sheet">
      <div class="grabber"></div>
      <img class="sheet-photo" src="${t.photo || ""}" alt="${t.name}" />
      <h2>${t.name}</h2>
      <div class="desc">${t.description || ""}</div>
      <div class="section-title">Paket</div>
      <div class="package-list">${packages || '<div class="empty-state">Belum ada paket.</div>'}</div>
      <button class="btn-primary" onclick="openBookingForm('${t.id}')">Ajukan Booking</button>
    </div>`;
  document.body.appendChild(overlay);
}

window.openBookingForm = function (talentId) {
  document.querySelectorAll(".sheet-overlay").forEach((el) => el.remove());
  const talent = state.talents.find((t) => t.id === talentId);
  const overlay = document.createElement("div");
  overlay.className = "sheet-overlay";
  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };
  overlay.innerHTML = `
    <div class="sheet">
      <div class="grabber"></div>
      <h2>Form Booking</h2>
      <div class="desc">${talent ? `Untuk talent: ${talent.name}` : "Booking umum"}</div>
      <form id="bookingForm">
        <div class="form-field">
          <label>Nama Brand</label>
          <input name="brand" required placeholder="cth. Kopi Senja" />
        </div>
        <div class="form-field">
          <label>Jenis Produk</label>
          <input name="productType" required placeholder="cth. Kemasan kopi sachet" />
        </div>
        <div class="form-field">
          <label>Tanggal Shoot (opsional)</label>
          <input name="shootDate" placeholder="cth. 10 Agustus 2026" />
        </div>
        <div class="form-field">
          <label>Budget (opsional)</label>
          <input name="budget" placeholder="cth. Rp 2.000.000" />
        </div>
        <div class="form-field">
          <label>Detail Kebutuhan</label>
          <textarea name="needs" required placeholder="Ceritakan kebutuhan foto/video-mu..."></textarea>
        </div>
        <button type="submit" class="btn-primary">Kirim Booking</button>
      </form>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById("bookingForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const payload = {
      brand: form.get("brand"),
      productType: form.get("productType"),
      shootDate: form.get("shootDate"),
      budget: form.get("budget"),
      needs: form.get("needs"),
      talentId: talent ? talent.id : null,
      talentName: talent ? talent.name : null,
    };
    try {
      await api("/api/booking", { method: "POST", body: JSON.stringify(payload) });
      overlay.remove();
      showToast("Booking terkirim! Admin akan segera menghubungi.");
    } catch (err) {
      showToast("Gagal mengirim booking. Coba lagi.");
    }
  });
};

function showToast(text) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

async function bootstrap() {
  render(); // show shell immediately
  try {
    const [talents, info, rules, cfg] = await Promise.all([
      api("/api/talent"),
      api("/api/info"),
      api("/api/info/rules"),
      api("/api/config"),
    ]);
    state.talents = talents;
    state.info = info;
    state.rules = rules.rules;
    state.botUsername = cfg.botUsername;
  } catch (err) {
    console.error("Failed to load initial data", err);
  }
  render();
}

bootstrap();
