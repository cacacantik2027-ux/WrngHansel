// /settings — full button-driven admin panel.
//
// Every screen below is reached only through inline-keyboard buttons (no
// more memorizing /addtalent, /setbg, etc.) and every screen (except the
// root menu) always shows two navigation buttons:
//   ⬅️ Kembali  — go back one step
//   ❌ Batal    — cancel and jump straight back to the main menu
//
// Buttons use the "style" field added in Telegram Bot API 9.4 (Feb 9,
// 2026), which lets clients render inline buttons in blue ("primary"),
// green ("success") or red ("danger") instead of the plain default look.
// Telegraf 4.16 doesn't know about this field, but it just forwards
// whatever JSON we give it to Telegram, so we build the buttons by hand
// instead of going through Markup.button.*.

const { nanoid } = require("nanoid");
const { exportSnapshot, listBackups, restoreFromFile } = require("../../db/backup");
const { userCount } = require("../userProfile");

const PAGE_LABELS = {
  home: "🏠 Beranda",
  talent: "🧑‍🎤 Katalog Talent",
  info: "🖼️ Info & Promo",
  rules: "📋 Aturan",
};

const INFO_PAGE_LABELS = {
  ads: "📢 Promo & Ads",
  channel: "📡 Channel Kami",
  group: "👥 Grup Komunitas",
  sponsor: "🤝 Sponsor",
};

const PRESET_COLORS = [
  { label: "🟤 Terracotta", value: "#c25f3d" },
  { label: "🟢 Sage", value: "#7f9271" },
  { label: "🟡 Cream", value: "#f5f1e6" },
  { label: "⚫ Charcoal", value: "#2b2a25" },
  { label: "🔵 Navy", value: "#2c3e50" },
  { label: "⚪ Putih", value: "#ffffff" },
];

// ---- small helpers -------------------------------------------------

function isOwner(ctx, config) {
  return config.OWNER_ID && ctx.from && ctx.from.id === config.OWNER_ID;
}

function btn(text, data, style) {
  const b = { text, callback_data: data };
  if (style) b.style = style; // 'primary' | 'success' | 'danger'
  return b;
}

function navRow(hasBack) {
  const row = [];
  if (hasBack) row.push(btn("⬅️ Kembali", "st:back", "primary"));
  row.push(btn("❌ Batal", "st:cancel", "danger"));
  return row;
}

function fmtIDR(n) {
  return `Rp ${Number(n || 0).toLocaleString("id-ID")}`;
}

function parsePackages(raw) {
  return raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const [pname, price] = p.split(":").map((s) => (s || "").trim());
      return { name: pname, price: Number(price) || 0 };
    })
    .filter((p) => p.name);
}

function fmtPackages(packages) {
  if (!packages || packages.length === 0) return "Belum ada paket.";
  return packages.map((p) => `• ${p.name} — ${fmtIDR(p.price)}`).join("\n");
}

// ---- per-admin in-memory UI state ----------------------------------
// Not persisted to disk on purpose: this is just "where is the owner in
// the wizard right now", it doesn't need to survive a restart.

const uiState = new Map();

function getState(userId) {
  if (!uiState.has(userId)) {
    uiState.set(userId, {
      current: "main",
      history: [],
      draft: {},
      backupFiles: [],
      messageId: null,
      chatId: null,
    });
  }
  return uiState.get(userId);
}

function resetState(userId) {
  uiState.set(userId, {
    current: "main",
    history: [],
    draft: {},
    backupFiles: [],
    messageId: null,
    chatId: null,
  });
  return uiState.get(userId);
}

const TEXT_PREFIXES = ["ta:", "tef:", "ief:", "bc:"];
function isAwaitingText(key) {
  if (key === "re") return true;
  return TEXT_PREFIXES.some((p) => key.startsWith(p));
}

// ---- screen builder --------------------------------------------------
// Returns { text, rows } for a given screen key. Never mutates state.

function buildScreen(store, state, key) {
  const settings = store.data.settings;
  const parts = key.split(":");
  const head = parts[0];

  // ---------------- MAIN ----------------
  if (key === "main") {
    return {
      text: "⚙️ Panel Pengaturan\n\nSemua pengeditan sekarang lewat tombol di bawah — pilih menu:",
      rows: [
        [btn("🧑‍🎤 Kelola Talent", "st:tl", "primary")],
        [btn("🖼️ Info & Promo", "st:il", "primary")],
        [btn("📋 Aturan Booking", "st:rl", "primary")],
        [btn("🎨 Latar Belakang Halaman", "st:bl", "primary")],
        [btn("🗄️ Database", "st:dm", "primary")],
        [btn("📊 Statistik", "st:st", "primary")],
        [btn("❌ Tutup", "st:close", "danger")],
      ],
    };
  }

  // ---------------- TALENT LIST ----------------
  if (head === "tl") {
    const talents = store.data.talents;
    const rows = talents.map((t) => [
      btn(`${t.active ? "🟢" : "⚪"} ${t.name}`, `st:tv:${t.id}`, "primary"),
    ]);
    rows.push([btn("➕ Tambah Talent", "st:ta", "success")]);
    rows.push(navRow(true));
    return {
      text:
        talents.length === 0
          ? "🧑‍🎤 Kelola Talent\n\nBelum ada talent. Tambahkan yang pertama:"
          : `🧑‍🎤 Kelola Talent\n\nTotal: ${talents.length} talent. Pilih untuk lihat/edit:`,
      rows,
    };
  }

  // ---------------- ADD TALENT WIZARD ----------------
  if (head === "ta") {
    const step = parts[1];
    const d = state.draft;
    if (step === "name") {
      return {
        text: "➕ Tambah Talent (1/4)\n\nKirim nama talent:",
        rows: [navRow(true)],
      };
    }
    if (step === "desc") {
      return {
        text: `➕ Tambah Talent (2/4)\nNama: ${d.name}\n\nKirim deskripsi singkat:`,
        rows: [navRow(true)],
      };
    }
    if (step === "photo") {
      return {
        text: `➕ Tambah Talent (3/4)\nNama: ${d.name}\n\nKirim URL foto (https://...):`,
        rows: [navRow(true)],
      };
    }
    if (step === "packages") {
      return {
        text:
          `➕ Tambah Talent (4/4)\nNama: ${d.name}\n\n` +
          "Kirim daftar paket, format:\nPaket A:150000, Paket B:300000",
        rows: [navRow(true)],
      };
    }
  }

  // ---------------- TALENT VIEW / EDIT MENU ----------------
  if (head === "tv") {
    const id = parts[1];
    const t = store.data.talents.find((x) => x.id === id);
    if (!t) return { text: "Talent tidak ditemukan.", rows: [navRow(true)] };
    const text =
      `🧑‍🎤 ${t.name} ${t.active ? "🟢 Aktif" : "⚪ Nonaktif"}\n\n` +
      `Deskripsi: ${t.description || "-"}\n` +
      `Foto: ${t.photo || "belum diatur"}\n\n` +
      `Paket:\n${fmtPackages(t.packages)}`;
    return {
      text,
      rows: [
        [btn("✏️ Nama", `st:tef:${id}:name`, "primary"), btn("✏️ Deskripsi", `st:tef:${id}:desc`, "primary")],
        [btn("🖼️ Foto", `st:tef:${id}:photo`, "primary"), btn("💰 Paket", `st:tef:${id}:packages`, "primary")],
        [
          t.active
            ? btn("⚪ Nonaktifkan", `st:tt:${id}`, "danger")
            : btn("🟢 Aktifkan", `st:tt:${id}`, "success"),
        ],
        [btn("🗑️ Hapus Talent", `st:td:${id}`, "danger")],
        navRow(true),
      ],
    };
  }

  // ---------------- TALENT EDIT FIELD PROMPT ----------------
  if (head === "tef") {
    const [, id, field] = parts;
    const t = store.data.talents.find((x) => x.id === id);
    if (!t) return { text: "Talent tidak ditemukan.", rows: [navRow(true)] };
    const labels = {
      name: "nama",
      desc: "deskripsi",
      photo: "URL foto",
      packages: "daftar paket (format: Nama:Harga, Nama2:Harga2)",
    };
    return {
      text: `✏️ Edit ${labels[field]} untuk "${t.name}"\n\nKirim nilai baru:`,
      rows: [navRow(true)],
    };
  }

  // ---------------- TALENT DELETE CONFIRM ----------------
  if (head === "td") {
    const id = parts[1];
    const t = store.data.talents.find((x) => x.id === id);
    if (!t) return { text: "Talent tidak ditemukan.", rows: [navRow(true)] };
    return {
      text: `🗑️ Hapus "${t.name}"?\n\nTindakan ini tidak bisa dibatalkan.`,
      rows: [[btn("✅ Ya, Hapus", `st:tdy:${id}`, "danger")], navRow(true)],
    };
  }

  // ---------------- INFO PAGES LIST ----------------
  if (head === "il") {
    const rows = Object.entries(INFO_PAGE_LABELS).map(([k, label]) => [
      btn(label, `st:iv:${k}`, "primary"),
    ]);
    rows.push(navRow(true));
    return { text: "🖼️ Info & Promo\n\nPilih halaman untuk diedit:", rows };
  }

  // ---------------- INFO PAGE VIEW / EDIT ----------------
  if (head === "iv") {
    const page = parts[1];
    const p = settings.infoPages[page];
    if (!p) return { text: "Halaman tidak ditemukan.", rows: [navRow(true)] };
    const text =
      `${INFO_PAGE_LABELS[page]}\n\n` +
      `Judul: ${p.title || "-"}\n` +
      `Isi: ${p.body || "-"}\n` +
      `URL: ${p.url || "-"}`;
    return {
      text,
      rows: [
        [btn("✏️ Judul", `st:ief:${page}:title`, "primary")],
        [btn("✏️ Isi", `st:ief:${page}:body`, "primary")],
        [btn("🔗 URL", `st:ief:${page}:url`, "primary")],
        navRow(true),
      ],
    };
  }

  // ---------------- INFO PAGE EDIT FIELD PROMPT ----------------
  if (head === "ief") {
    const [, page, field] = parts;
    const labels = { title: "judul", body: "isi teks", url: "URL (boleh dikosongkan dengan '-')" };
    return {
      text: `✏️ Edit ${labels[field]} — ${INFO_PAGE_LABELS[page]}\n\nKirim nilai baru:`,
      rows: [navRow(true)],
    };
  }

  // ---------------- RULES ----------------
  if (key === "rl") {
    return {
      text: `📋 Aturan Booking\n\n${settings.rules || "Belum ada aturan."}`,
      rows: [[btn("✏️ Edit Aturan", "st:re", "primary")], navRow(true)],
    };
  }
  if (key === "re") {
    return { text: "✏️ Kirim teks aturan booking yang baru:", rows: [navRow(true)] };
  }

  // ---------------- BACKGROUNDS LIST ----------------
  if (head === "bl") {
    const rows = Object.entries(PAGE_LABELS).map(([k, label]) => [
      btn(label, `st:bv:${k}`, "primary"),
    ]);
    rows.push(navRow(true));
    return { text: "🎨 Latar Belakang Halaman\n\nPilih halaman:", rows };
  }

  // ---------------- BACKGROUND VIEW / EDIT ----------------
  if (head === "bv") {
    const page = parts[1];
    const bg = settings.pageBackgrounds[page] || { type: "color", value: "#f5f1e6" };
    const text =
      `${PAGE_LABELS[page]}\n\n` +
      `Saat ini: ${bg.type === "image" ? "gambar" : "warna"} — ${bg.value}\n\n` +
      "Pilih warna cepat, atau atur kustom:";
    const styles = ["primary", "success", "danger"];
    const presetButtons = PRESET_COLORS.map((c, i) =>
      btn(c.label, `st:bp:${page}:${i}`, styles[i % styles.length])
    );
    const rows = [];
    for (let i = 0; i < presetButtons.length; i += 2) {
      rows.push(presetButtons.slice(i, i + 2));
    }
    rows.push([btn("🎨 Warna/Gambar Kustom", `st:bc:${page}`, "primary")]);
    rows.push([btn("↩️ Reset ke Default", `st:br:${page}`, "danger")]);
    rows.push(navRow(true));
    return { text, rows };
  }

  // ---------------- BACKGROUND CUSTOM PROMPT ----------------
  if (head === "bc") {
    const page = parts[1];
    return {
      text:
        `🎨 Latar kustom — ${PAGE_LABELS[page]}\n\n` +
        "Kirim kode warna hex (#rrggbb) atau URL gambar (https://...):",
      rows: [navRow(true)],
    };
  }

  // ---------------- DATABASE MENU ----------------
  if (key === "dm") {
    return {
      text:
        "🗄️ Database\n\n" +
        "Export mengunduh salinan database.\nImport: reply file .json dengan /importdb (belum bisa lewat tombol karena Telegram tidak mendukung upload file lewat inline button).",
      rows: [
        [btn("⬇️ Export Database", "st:de", "success")],
        [btn("♻️ Restore dari Backup", "st:dr", "primary")],
        navRow(true),
      ],
    };
  }

  // ---------------- DB RESTORE LIST ----------------
  if (key === "dr") {
    const backups = state.backupFiles;
    if (backups.length === 0) {
      return { text: "Belum ada backup tersimpan.", rows: [navRow(true)] };
    }
    const rows = backups.map((b, i) => [btn(b.file, `st:drp:${i}`, "primary")]);
    rows.push(navRow(true));
    return { text: "♻️ Pilih backup untuk dipulihkan:", rows };
  }

  // ---------------- STATS ----------------
  if (key === "st") {
    const sessions = Object.values(store.data.sessions);
    const open = sessions.filter((s) => s.status === "open").length;
    const text = [
      "📊 Statistik",
      "",
      `👥 Pengguna: ${userCount(store)}`,
      `💬 Sesi aktif: ${open} / ${sessions.length} total`,
      `🧑‍🎤 Talent: ${store.data.talents.length}`,
      `📋 Booking masuk: ${store.data.bookings.length}`,
      `🗄️ Backup terakhir: ${store.data.meta.lastBackupAt || "belum pernah"}`,
    ].join("\n");
    return { text, rows: [navRow(true)] };
  }

  return { text: "Menu tidak dikenal.", rows: [navRow(true)] };
}

// ---- rendering ---------------------------------------------------

async function display(ctx, store, state, key) {
  const { text, rows } = buildScreen(store, state, key);
  state.current = key;
  const reply_markup = { inline_keyboard: rows };
  if (state.messageId && state.chatId) {
    try {
      await ctx.telegram.editMessageText(state.chatId, state.messageId, undefined, text, {
        reply_markup,
      });
      return;
    } catch (err) {
      // message may be gone / unmodified — fall through to sending a new one
    }
  }
  const sent = await ctx.reply(text, { reply_markup });
  state.messageId = sent.message_id;
  state.chatId = sent.chat.id;
}

function goto(state, key) {
  if (state.current) state.history.push(state.current);
  state.current = key;
}

function goBack(state) {
  state.current = state.history.length ? state.history.pop() : "main";
  return state.current;
}

function goCancel(state) {
  state.history = [];
  state.current = "main";
  return state.current;
}

// ---- registration --------------------------------------------------

function registerSettings(bot, store, config) {
  bot.command("settings", async (ctx) => {
    if (!isOwner(ctx, config)) return;
    const state = resetState(ctx.from.id);
    await display(ctx, store, state, "main");
  });

  bot.action(/^st:(.+)$/, async (ctx) => {
    if (!isOwner(ctx, config)) return ctx.answerCbQuery();
    const state = getState(ctx.from.id);
    const action = ctx.match[1];
    const [cmd, ...rest] = action.split(":");
    const arg1 = rest[0];
    const arg2 = rest[1];

    try {
      if (cmd === "back") {
        await ctx.answerCbQuery();
        await display(ctx, store, state, goBack(state));
        return;
      }
      if (cmd === "cancel") {
        await ctx.answerCbQuery();
        await display(ctx, store, state, goCancel(state));
        return;
      }
      if (cmd === "close") {
        await ctx.answerCbQuery("Ditutup.");
        try {
          await ctx.editMessageText("⚙️ Panel pengaturan ditutup. Ketik /settings untuk membuka lagi.");
        } catch (_) {}
        resetState(ctx.from.id);
        return;
      }

      if (cmd === "tl") {
        await ctx.answerCbQuery();
        goto(state, "tl");
        await display(ctx, store, state, "tl");
        return;
      }
      if (cmd === "ta") {
        await ctx.answerCbQuery();
        state.draft = {};
        goto(state, "ta:name");
        await display(ctx, store, state, "ta:name");
        return;
      }
      if (cmd === "tv") {
        await ctx.answerCbQuery();
        goto(state, `tv:${arg1}`);
        await display(ctx, store, state, `tv:${arg1}`);
        return;
      }
      if (cmd === "tef") {
        await ctx.answerCbQuery();
        goto(state, `tef:${arg1}:${arg2}`);
        await display(ctx, store, state, `tef:${arg1}:${arg2}`);
        return;
      }
      if (cmd === "tt") {
        const t = store.data.talents.find((x) => x.id === arg1);
        if (t) {
          t.active = !t.active;
          await store.save();
        }
        await ctx.answerCbQuery(t ? "✅ Diperbarui." : "Tidak ditemukan.");
        await display(ctx, store, state, `tv:${arg1}`);
        return;
      }
      if (cmd === "td") {
        await ctx.answerCbQuery();
        goto(state, `td:${arg1}`);
        await display(ctx, store, state, `td:${arg1}`);
        return;
      }
      if (cmd === "tdy") {
        store.data.talents = store.data.talents.filter((x) => x.id !== arg1);
        await store.save();
        await ctx.answerCbQuery("🗑️ Talent dihapus.");
        state.history = [];
        await display(ctx, store, state, "tl");
        return;
      }

      if (cmd === "il") {
        await ctx.answerCbQuery();
        goto(state, "il");
        await display(ctx, store, state, "il");
        return;
      }
      if (cmd === "iv") {
        await ctx.answerCbQuery();
        goto(state, `iv:${arg1}`);
        await display(ctx, store, state, `iv:${arg1}`);
        return;
      }
      if (cmd === "ief") {
        await ctx.answerCbQuery();
        goto(state, `ief:${arg1}:${arg2}`);
        await display(ctx, store, state, `ief:${arg1}:${arg2}`);
        return;
      }

      if (cmd === "rl") {
        await ctx.answerCbQuery();
        goto(state, "rl");
        await display(ctx, store, state, "rl");
        return;
      }
      if (cmd === "re") {
        await ctx.answerCbQuery();
        goto(state, "re");
        await display(ctx, store, state, "re");
        return;
      }

      if (cmd === "bl") {
        await ctx.answerCbQuery();
        goto(state, "bl");
        await display(ctx, store, state, "bl");
        return;
      }
      if (cmd === "bv") {
        await ctx.answerCbQuery();
        goto(state, `bv:${arg1}`);
        await display(ctx, store, state, `bv:${arg1}`);
        return;
      }
      if (cmd === "bp") {
        const page = arg1;
        const idx = Number(arg2);
        const preset = PRESET_COLORS[idx];
        if (preset) {
          store.data.settings.pageBackgrounds[page] = { type: "color", value: preset.value };
          await store.save();
        }
        await ctx.answerCbQuery(preset ? "✅ Warna diterapkan." : "Tidak dikenal.");
        await display(ctx, store, state, `bv:${page}`);
        return;
      }
      if (cmd === "bc") {
        await ctx.answerCbQuery();
        goto(state, `bc:${arg1}`);
        await display(ctx, store, state, `bc:${arg1}`);
        return;
      }
      if (cmd === "br") {
        store.data.settings.pageBackgrounds[arg1] = { type: "color", value: "#f5f1e6" };
        await store.save();
        await ctx.answerCbQuery("↩️ Direset.");
        await display(ctx, store, state, `bv:${arg1}`);
        return;
      }

      if (cmd === "dm") {
        await ctx.answerCbQuery();
        goto(state, "dm");
        await display(ctx, store, state, "dm");
        return;
      }
      if (cmd === "de") {
        await ctx.answerCbQuery("⬇️ Mengekspor...");
        const file = exportSnapshot(store, "manual");
        await ctx.replyWithDocument({ source: file });
        await display(ctx, store, state, "dm");
        return;
      }
      if (cmd === "dr") {
        state.backupFiles = listBackups(store).slice(0, 10);
        await ctx.answerCbQuery();
        goto(state, "dr");
        await display(ctx, store, state, "dr");
        return;
      }
      if (cmd === "drp") {
        const idx = Number(arg1);
        const target = state.backupFiles[idx];
        if (target) {
          exportSnapshot(store, "pre-restore");
          await restoreFromFile(store, target.full);
        }
        await ctx.answerCbQuery(target ? "✅ Dipulihkan." : "Tidak ditemukan.");
        state.history = [];
        await display(ctx, store, state, "dm");
        return;
      }

      if (cmd === "st") {
        await ctx.answerCbQuery();
        goto(state, "st");
        await display(ctx, store, state, "st");
        return;
      }

      await ctx.answerCbQuery();
    } catch (err) {
      console.error("[settings] action error:", err);
      try {
        await ctx.answerCbQuery("Terjadi kesalahan.");
      } catch (_) {}
    }
  });

  // Captures plain-text replies while the owner is mid-wizard. Must be
  // registered before the relay handler so these messages never get
  // forwarded to the admin group as a live-chat message.
  bot.on("message", async (ctx, next) => {
    if (!isOwner(ctx, config)) return next();
    if (ctx.chat.type !== "private") return next();
    if (!ctx.message.text || ctx.message.text.startsWith("/")) return next();

    const state = getState(ctx.from.id);
    if (!isAwaitingText(state.current)) return next();

    const text = ctx.message.text.trim();
    const key = state.current;
    const parts = key.split(":");
    const head = parts[0];

    try {
      // Delete the owner's plain-text reply to keep the chat tidy — the
      // panel message itself is what gets updated.
      ctx.deleteMessage().catch(() => {});

      if (head === "ta") {
        const step = parts[1];
        if (step === "name") {
          state.draft.name = text;
          goto(state, "ta:desc");
          await display(ctx, store, state, "ta:desc");
          return;
        }
        if (step === "desc") {
          state.draft.description = text;
          goto(state, "ta:photo");
          await display(ctx, store, state, "ta:photo");
          return;
        }
        if (step === "photo") {
          state.draft.photo = text;
          goto(state, "ta:packages");
          await display(ctx, store, state, "ta:packages");
          return;
        }
        if (step === "packages") {
          const talent = {
            id: nanoid(8),
            name: state.draft.name,
            description: state.draft.description,
            photo: state.draft.photo,
            packages: parsePackages(text),
            active: true,
            createdAt: new Date().toISOString(),
          };
          store.data.talents.push(talent);
          await store.save();
          state.draft = {};
          state.history = [];
          await display(ctx, store, state, "tl");
          return;
        }
      }

      if (head === "tef") {
        const [, id, field] = parts;
        const t = store.data.talents.find((x) => x.id === id);
        if (t) {
          if (field === "name") t.name = text;
          else if (field === "desc") t.description = text;
          else if (field === "photo") t.photo = text;
          else if (field === "packages") t.packages = parsePackages(text);
          await store.save();
        }
        await display(ctx, store, state, goBack(state));
        return;
      }

      if (head === "ief") {
        const [, page, field] = parts;
        const p = store.data.settings.infoPages[page];
        if (p) {
          p[field] = field === "url" && text === "-" ? "" : text;
          await store.save();
        }
        await display(ctx, store, state, goBack(state));
        return;
      }

      if (key === "re") {
        store.data.settings.rules = text;
        await store.save();
        await display(ctx, store, state, goBack(state));
        return;
      }

      if (head === "bc") {
        const page = parts[1];
        const isImage = /^https?:\/\//i.test(text);
        const isHex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(text);
        if (!isImage && !isHex) {
          state.current = `bc:${page}`; // stay on the same prompt
          const reply_markup = { inline_keyboard: [navRow(true)] };
          const errorText =
            "❌ Format tidak dikenali. Gunakan kode warna (#rrggbb) atau URL gambar (https://...).\n\nKirim lagi:";
          if (state.messageId && state.chatId) {
            try {
              await ctx.telegram.editMessageText(state.chatId, state.messageId, undefined, errorText, {
                reply_markup,
              });
              return;
            } catch (_) {}
          }
          const sent = await ctx.reply(errorText, { reply_markup });
          state.messageId = sent.message_id;
          state.chatId = sent.chat.id;
          return;
        }
        store.data.settings.pageBackgrounds[page] = {
          type: isImage ? "image" : "color",
          value: text,
        };
        await store.save();
        await display(ctx, store, state, goBack(state));
        return;
      }
    } catch (err) {
      console.error("[settings] text handler error:", err);
    }
  });
}

module.exports = { registerSettings };
