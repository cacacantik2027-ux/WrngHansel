const config = require("./config");
const { Store } = require("./db/store");
const { startAutoBackup } = require("./db/backup");
const { createBot } = require("./bot/bot");
const { createApp } = require("./server/app");

async function main() {
  const store = new Store(config.DATA_DIR).init();

  // Keep settings in sync with env, in case they changed since last run.
  store.data.settings.ownerId = config.OWNER_ID || store.data.settings.ownerId;
  store.data.settings.adminGroupId = config.ADMIN_GROUP_ID || store.data.settings.adminGroupId;
  await store.save();

  const bot = createBot(store, config);

  try {
    const me = await bot.telegram.getMe();
    store.data.settings.botUsername = me.username;
    await store.save();
  } catch (err) {
    console.warn("[index] could not fetch bot username yet:", err.message);
  }

  startAutoBackup(store, {
    intervalMinutes: config.AUTO_BACKUP_INTERVAL_MIN,
    keep: config.AUTO_BACKUP_KEEP,
  });

  const app = createApp(store, bot, config);
  app.listen(config.PORT, () => {
    console.log(`[server] Mini app + API listening on port ${config.PORT}`);
  });

  await bot.launch();
  console.log("[bot] Telegram bot started.");

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

main().catch((err) => {
  console.error("[fatal] failed to start:", err);
  process.exit(1);
});
