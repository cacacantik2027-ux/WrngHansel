const { Telegraf } = require("telegraf");
const { registerStart } = require("./handlers/start");
const { registerRelay } = require("./handlers/relay");
const { registerOwnerCommands } = require("./handlers/ownerCommands");

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
        "/stats — ringkasan data\n" +
        "/exportdb — unduh database\n" +
        "/importdb — impor database (reply ke file .json)\n" +
        "/restoredb — pulihkan dari backup\n" +
        "/addtalent Nama | Deskripsi | URL Foto | Paket:Harga, Paket2:Harga2\n" +
        "/listtalents — daftar talent\n" +
        "/deltalent <id>\n" +
        "/toggletalent <id>\n" +
        "/setrules <teks>\n" +
        "/setinfo <ads|channel|group|sponsor> Judul | Isi | URL\n" +
        "/bookings — booking terbaru\n" +
        "/groupid — chat ID grup ini"
      : "";
    await ctx.reply(commonHelp + ownerHelp);
  });

  registerStart(bot, store, config);
  registerOwnerCommands(bot, store, config);
  registerRelay(bot, store, config); // must be last: catches all plain messages

  return bot;
}

module.exports = { createBot };
