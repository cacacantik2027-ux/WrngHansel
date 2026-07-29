const { nanoid } = require("nanoid");
const {
  exportSnapshot,
  listBackups,
  restoreFromFile,
  importFromBuffer,
} = require("../../db/backup");
const { userCount } = require("../userProfile");
const { Markup } = require("telegraf");

function isOwner(ctx, config) {
  return config.OWNER_ID && ctx.from && ctx.from.id === config.OWNER_ID;
}

function ownerOnly(config) {
  return async (ctx, next) => {
    if (!isOwner(ctx, config)) return; // silently ignore for non-owners
    return next();
  };
}

function registerOwnerCommands(bot, store, config) {
  const guard = ownerOnly(config);

  bot.command("stats", guard, async (ctx) => {
    const sessions = Object.values(store.data.sessions);
    const open = sessions.filter((s) => s.status === "open").length;
    await ctx.reply(
      [
        `👥 Pengguna: ${userCount(store)}`,
        `💬 Sesi aktif: ${open} / ${sessions.length} total`,
        `🧑‍🎤 Talent: ${store.data.talents.length}`,
        `📋 Booking masuk: ${store.data.bookings.length}`,
        `🗄️ Backup terakhir: ${store.data.meta.lastBackupAt || "belum pernah"}`,
      ].join("\n")
    );
  });

  // ---- Database export / import / restore ----

  bot.command("exportdb", guard, async (ctx) => {
    const file = exportSnapshot(store, "manual");
    await ctx.replyWithDocument({ source: file });
  });

  bot.command("importdb", guard, async (ctx) => {
    const reply = ctx.message.reply_to_message;
    const doc = reply && reply.document;
    if (!doc) {
      await ctx.reply(
        "Kirim file .json database sebagai balasan (reply) ke pesan itu dengan caption /importdb, atau reply pesan berisi file dengan perintah ini."
      );
      return;
    }
    try {
      const link = await ctx.telegram.getFileLink(doc.file_id);
      const res = await fetch(link.href);
      const buffer = Buffer.from(await res.arrayBuffer());
      // Safety snapshot before overwriting, in case the import is bad.
      exportSnapshot(store, "pre-import");
      await importFromBuffer(store, buffer);
      await ctx.reply("✅ Database berhasil diimpor dan menggantikan data sebelumnya.");
    } catch (err) {
      await ctx.reply(`❌ Gagal mengimpor: ${err.message}`);
    }
  });

  bot.command("restoredb", guard, async (ctx) => {
    const backups = listBackups(store).slice(0, 10);
    if (backups.length === 0) {
      await ctx.reply("Belum ada backup tersimpan.");
      return;
    }
    const buttons = backups.map((b) =>
      Markup.button.callback(b.file, `restore:${encodeURIComponent(b.file)}`)
    );
    await ctx.reply(
      "Pilih backup yang ingin dipulihkan:",
      Markup.inlineKeyboard(buttons.map((b) => [b]))
    );
  });

  bot.action(/restore:(.+)/, async (ctx) => {
    if (!isOwner(ctx, config)) return ctx.answerCbQuery();
    const fileName = decodeURIComponent(ctx.match[1]);
    const backups = listBackups(store);
    const target = backups.find((b) => b.file === fileName);
    if (!target) {
      await ctx.answerCbQuery("File tidak ditemukan.");
      return;
    }
    exportSnapshot(store, "pre-restore");
    await restoreFromFile(store, target.full);
    await ctx.answerCbQuery("Dipulihkan.");
    await ctx.editMessageText(`✅ Database dipulihkan dari ${fileName}`);
  });

  // ---- Talent management ----
  // Format: /addtalent Nama | Deskripsi | URL Foto | Paket A:150000, Paket B:300000

  bot.command("addtalent", guard, async (ctx) => {
    const raw = ctx.message.text.split(" ").slice(1).join(" ");
    const parts = raw.split("|").map((s) => s.trim());
    if (parts.length < 4) {
      await ctx.reply(
        "Format: /addtalent Nama | Deskripsi | URL Foto | Paket A:150000, Paket B:300000"
      );
      return;
    }
    const [name, description, photo, packagesRaw] = parts;
    const packages = packagesRaw
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => {
        const [pname, price] = p.split(":").map((s) => s.trim());
        return { name: pname, price: Number(price) || 0 };
      });

    const talent = {
      id: nanoid(8),
      name,
      description,
      photo,
      packages,
      active: true,
      createdAt: new Date().toISOString(),
    };
    store.data.talents.push(talent);
    await store.save();
    await ctx.reply(`✅ Talent ditambahkan dengan ID: ${talent.id}`);
  });

  bot.command("listtalents", guard, async (ctx) => {
    if (store.data.talents.length === 0) {
      await ctx.reply("Belum ada talent.");
      return;
    }
    const lines = store.data.talents.map(
      (t) =>
        `${t.active ? "🟢" : "⚪"} [${t.id}] ${t.name} — ${t.packages.length} paket`
    );
    await ctx.reply(lines.join("\n"));
  });

  bot.command("deltalent", guard, async (ctx) => {
    const id = ctx.message.text.split(" ")[1];
    const before = store.data.talents.length;
    store.data.talents = store.data.talents.filter((t) => t.id !== id);
    await store.save();
    const changed = before !== store.data.talents.length;
    await ctx.reply(changed ? `✅ Talent ${id} dihapus.` : `Talent ${id} tidak ditemukan.`);
  });

  bot.command("toggletalent", guard, async (ctx) => {
    const id = ctx.message.text.split(" ")[1];
    const talent = store.data.talents.find((t) => t.id === id);
    if (!talent) {
      await ctx.reply(`Talent ${id} tidak ditemukan.`);
      return;
    }
    talent.active = !talent.active;
    await store.save();
    await ctx.reply(`Talent ${talent.name} sekarang ${talent.active ? "aktif" : "nonaktif"}.`);
  });

  // ---- Rules & info pages ----

  bot.command("setrules", guard, async (ctx) => {
    const text = ctx.message.text.split(" ").slice(1).join(" ");
    if (!text) {
      await ctx.reply("Format: /setrules <isi aturan>");
      return;
    }
    store.data.settings.rules = text;
    await store.save();
    await ctx.reply("✅ Aturan diperbarui.");
  });

  bot.command("setinfo", guard, async (ctx) => {
    // Format: /setinfo ads Judul | Isi teks | https://url-opsional
    const raw = ctx.message.text.split(" ").slice(1).join(" ");
    const firstSpace = raw.indexOf(" ");
    if (firstSpace === -1) {
      await ctx.reply(
        "Format: /setinfo <ads|channel|group|sponsor> Judul | Isi teks | URL (opsional)"
      );
      return;
    }
    const page = raw.slice(0, firstSpace).trim();
    const rest = raw.slice(firstSpace + 1);
    const [title, body, url] = rest.split("|").map((s) => (s ? s.trim() : ""));
    if (!store.data.settings.infoPages[page]) {
      await ctx.reply("Halaman tidak dikenal. Gunakan: ads, channel, group, sponsor");
      return;
    }
    store.data.settings.infoPages[page] = { title, body, url: url || "" };
    await store.save();
    await ctx.reply(`✅ Halaman ${page} diperbarui.`);
  });

  // ---- Bookings ----

  bot.command("bookings", guard, async (ctx) => {
    const recent = store.data.bookings.slice(-10).reverse();
    if (recent.length === 0) {
      await ctx.reply("Belum ada booking masuk.");
      return;
    }
    const lines = recent.map(
      (b) =>
        `#${b.id} — ${b.brand} (${b.talentName || "umum"})\n${b.productType}, budget ${b.budget}, shoot ${b.shootDate}`
    );
    await ctx.reply(lines.join("\n\n"));
  });

  bot.command("groupid", async (ctx) => {
    // Any admin can run this inside the group to learn the chat ID
    // needed for the ADMIN_GROUP_ID environment variable.
    await ctx.reply(`Chat ID: ${ctx.chat.id}`);
  });
}

module.exports = { registerOwnerCommands };
