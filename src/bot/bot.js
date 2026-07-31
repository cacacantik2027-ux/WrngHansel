const { Telegraf } = require("telegraf");
const { registerStart } = require("./handlers/start");
const { registerRelay } = require("./handlers/relay");
const { registerOwnerCommands } = require("./handlers/ownerCommands");
const { registerSettings } = require("./handlers/settings");

function createBot(store, config) {
  const bot = new Telegraf(config.BOT_TOKEN);

  bot.catch((err, ctx) => {
    console.error(`[bot] error for update ${ctx.updateType}:`, err);
  });

  bot.command("help", async (ctx) => {
    const isOwner = config.OWNER_ID && ctx.from.id === config.OWNER_ID;
    const commonHelp =
      "/start — buka menu utama\n" +
      "Kirim pesan apa saja untuk memulai live chat dengan admin.";
    const ownerHelp = isOwner
      ? "\n\nPerintah owner:\n" +
        "/settings — panel pengaturan lewat tombol (kelola talent, info, aturan, latar, database)\n" +
        "/stats — ringkasan data\n" +
        "/exportdb — unduh database\n" +
        "/importdb — impor database (reply ke file .json)\n" +
        "/orders — order terbaru\n" +
        "/groupid — chat ID grup ini"
      : "";
    await ctx.reply(commonHelp + ownerHelp);
  });

  registerStart(bot, store, config);
  registerOwnerCommands(bot, store, config);
  registerSettings(bot, store, config); // must come before relay: captures owner's wizard replies
  registerRelay(bot, store, config); // must be last: catches all plain messages

  return bot;
}

module.exports = { createBot };
