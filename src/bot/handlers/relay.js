const { touchUser } = require("../userProfile");
const {
  isSessionOpen,
  beginSession,
  closeSession,
  indexGroupMessage,
  resolveUserFromGroupMessage,
  getSession,
} = require("../session");
const { endSessionKeyboard } = require("../keyboards");
const { thinking } = require("../rich");

function userHeader(from, session) {
  const uname = from.username ? `@${from.username}` : "(tanpa username)";
  const base = `👤 ${from.first_name || ""} ${uname} — ID: ${from.id}`;
  if (session && session.talentName) {
    return `${base}\n🧑‍🎤 Order untuk: ${session.talentName}`;
  }
  return base;
}

function registerRelay(bot, store, config) {
  // Any private message from a user (that isn't a command) is relayed to
  // the admin group, opening a session automatically if none exists yet.
  bot.on("message", async (ctx, next) => {
    const isPrivate = ctx.chat.type === "private";
    if (!isPrivate) return next();
    if (ctx.message.text && ctx.message.text.startsWith("/")) return next();
    if (!config.ADMIN_GROUP_ID) {
      await ctx.reply("Live chat admin belum dikonfigurasi. Coba lagi nanti.");
      return;
    }

    touchUser(store, ctx.from);

    const isNewSession = !isSessionOpen(store, ctx.from.id);
    if (isNewSession) {
      await beginSession(store, ctx.from);
      await thinking(ctx.telegram, ctx.chat.id);
      await ctx.reply("Sesi live chat dimulai. Admin akan segera membalas pesanmu di sini.");
    }

    // Forward a header first (so admins have context), then copy the
    // actual message content beneath it. The "Akhiri Sesi" button only
    // needs to appear once, on the header that opens the session — every
    // header after that would just clutter the group with duplicate
    // buttons for the same open session.
    const session = getSession(store, ctx.from.id);
    const header = await ctx.telegram.sendMessage(
      config.ADMIN_GROUP_ID,
      userHeader(ctx.from, session),
      isNewSession ? endSessionKeyboard(ctx.from.id) : undefined
    );
    await indexGroupMessage(store, header.message_id, ctx.from.id);

    const copied = await ctx.telegram.copyMessage(
      config.ADMIN_GROUP_ID,
      ctx.chat.id,
      ctx.message.message_id,
      { reply_parameters: { message_id: header.message_id } }
    );
    await indexGroupMessage(store, copied.message_id, ctx.from.id);
  });

  // Admin replies inside the group: any message that replies to a message
  // we've indexed gets copied back to the corresponding user.
  bot.on("message", async (ctx, next) => {
    const isGroup = ctx.chat.id === config.ADMIN_GROUP_ID;
    if (!isGroup) return next();
    const replyTo = ctx.message.reply_to_message;
    if (!replyTo) return next();

    const userId = resolveUserFromGroupMessage(store, replyTo.message_id);
    if (!userId) return next();

    const session = getSession(store, userId);
    if (!session || session.status !== "open") {
      await ctx.reply("Sesi pengguna ini sudah berakhir.");
      return;
    }

    try {
      await thinking(ctx.telegram, userId, 500);
      const sent = await ctx.telegram.copyMessage(
        userId,
        ctx.chat.id,
        ctx.message.message_id
      );
      // Index the outgoing message too, in case the user replies and we
      // later want richer threading (kept simple for now).
      await indexGroupMessage(store, ctx.message.message_id, userId);
      void sent;
    } catch (err) {
      await ctx.reply(`Gagal mengirim ke pengguna: ${err.message}`);
    }
  });

  // "Akhiri Sesi" button pressed by an admin in the group.
  bot.action(/end_session:(\d+)/, async (ctx) => {
    const userId = Number(ctx.match[1]);
    await closeSession(store, userId);
    await ctx.answerCbQuery("Sesi diakhiri.");
    await ctx.editMessageReplyMarkup(undefined).catch(() => {});
    try {
      await ctx.telegram.sendMessage(
        userId,
        "Sesi live chat telah diakhiri oleh admin. Kirim pesan baru kapan saja untuk memulai sesi baru."
      );
    } catch (_) {
      // user may have blocked the bot; ignore
    }
    await ctx.telegram.sendMessage(
      config.ADMIN_GROUP_ID,
      `✅ Sesi dengan pengguna ID ${userId} telah diakhiri.`
    );
  });
}

module.exports = { registerRelay };
