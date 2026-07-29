const { openMiniAppKeyboard } = require("../keyboards");
const { touchUser } = require("../userProfile");
const { beginSession } = require("../session");

function registerStart(bot, store, config) {
  bot.start(async (ctx) => {
    touchUser(store, ctx.from);
    const payload = ctx.startPayload; // text after /start<space>

    if (payload === "support") {
      beginSession(store, ctx.from);
      await ctx.reply(
        "Halo! Ceritakan pertanyaan atau kebutuhanmu, nanti admin kami akan membalas langsung di sini.\n\nKetik pesanmu kapan saja."
      );
      return;
    }

    await ctx.reply(
      `Halo ${ctx.from.first_name || ""}! 👋\n\nSelamat datang di bot resmi agensi kami.\n\nBuka menu di bawah untuk melihat katalog talent, info, dan aturan booking. Kalau butuh bantuan langsung, gunakan tombol live chat admin di dalam mini app.`,
      openMiniAppKeyboard(config.PUBLIC_URL)
    );
  });
}

module.exports = { registerStart };
