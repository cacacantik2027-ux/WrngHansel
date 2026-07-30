const {
  exportSnapshot,
  listBackups,
  restoreFromFile,
  importFromBuffer,
} = require("../../db/backup");
const { userCount } = require("../userProfile");
const { thinking, sendRich } = require("../rich");

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
    await thinking(ctx.telegram, ctx.chat.id);
    await sendRich(
      ctx.telegram,
      ctx.chat.id,
      [
        "# 📊 Statistik",
        "",
        `- 👥 Pengguna: ${userCount(store)}`,
        `- 💬 Sesi aktif: ${open} / ${sessions.length} total`,
        `- 🧑‍🎤 Talent: ${store.data.talents.length}`,
        `- 📋 Order masuk: ${store.data.bookings.length}`,
        `- 🗄️ Backup terakhir: ${store.data.meta.lastBackupAt || "belum pernah"}`,
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

  // Talent management, rules, info pages, and page backgrounds all moved
  // to the button-driven /settings panel (see handlers/settings.js).
  // /restoredb is kept as a quick text-command shortcut; the same flow is
  // also available via /settings → 🗄️ Database → ♻️ Restore dari Backup.

  bot.command("restoredb", guard, async (ctx) => {
    const backups = listBackups(store).slice(0, 10);
    if (backups.length === 0) {
      await ctx.reply("Belum ada backup tersimpan.");
      return;
    }
    const buttons = backups.map((b) => ({
      text: b.file,
      callback_data: `restore:${encodeURIComponent(b.file)}`,
      style: "primary",
    }));
    await ctx.reply("Pilih backup yang ingin dipulihkan:", {
      reply_markup: { inline_keyboard: buttons.map((b) => [b]) },
    });
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

  // ---- Orders ----

  bot.command("orders", guard, async (ctx) => {
    const recent = store.data.bookings.slice(-10).reverse();
    if (recent.length === 0) {
      await ctx.reply("Belum ada order masuk.");
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
