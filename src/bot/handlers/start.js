const { openMiniAppKeyboard } = require("../keyboards");
const { touchUser } = require("../userProfile");
const { beginSession } = require("../session");
const { thinking, sendRich } = require("../rich");

function registerStart(bot, store, config) {
  bot.start(async (ctx) => {
    touchUser(store, ctx.from);
    const payload = ctx.startPayload; // text after /start<space>

    if (payload === "support") {
      beginSession(store, ctx.from);
      await thinking(ctx.telegram, ctx.chat.id);
      await ctx.reply(
        "Halo! Ceritakan pertanyaan atau kebutuhanmu, nanti admin kami akan membalas langsung di sini.\n\nKetik pesanmu kapan saja."
      );
      return;
    }

    // Deep link from a talent card's "Ajukan Order" button: `?start=order_<talentId>`.
    // Opens the same live-chat session as support, but pre-announces which
    // talent the user is interested in so admins have context immediately.
    if (payload && payload.startsWith("order_")) {
      const talentId = payload.slice("order_".length);
      const talent = (store.data.talents || []).find((t) => t.id === talentId);

      beginSession(store, ctx.from, {
        talentId,
        talentName: talent ? talent.name : null,
      });
      await thinking(ctx.telegram, ctx.chat.id);
      await ctx.reply(
        talent
          ? `Halo! Kamu tertarik order untuk talent ${talent.name}.\n\nCeritakan kebutuhanmu (brand, jenis produk, tanggal shoot, budget, dll), nanti admin kami akan membalas langsung di sini.`
          : "Halo! Ceritakan kebutuhan order-mu, nanti admin kami akan membalas langsung di sini."
      );
      return;
    }

    await thinking(ctx.telegram, ctx.chat.id);
    const name = ctx.from.first_name || "";
    const text =
      `# 👋 Halo ${name}!\n\n` +
      "Selamat datang di bot resmi agensi kami.\n\n" +
      "- 🧑‍🎤 Lihat katalog talent & paket harga\n" +
      "- 🖼️ Cek info, channel, dan promo\n" +
      "- 📋 Baca aturan order\n" +
      "- 💬 Live chat langsung dengan admin\n\n" +
      "Buka menu di bawah untuk mulai.";
    await sendRich(ctx.telegram, ctx.chat.id, text, openMiniAppKeyboard(config.PUBLIC_URL));
  });
}

module.exports = { registerStart };
