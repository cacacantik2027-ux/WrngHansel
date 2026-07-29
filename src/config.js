require("dotenv").config();

function required(name) {
  const v = process.env[name];
  if (!v) {
    console.warn(`[config] Warning: ${name} is not set. Set it in your .env or Railway variables.`);
  }
  return v;
}

module.exports = {
  BOT_TOKEN: required("BOT_TOKEN"),
  OWNER_ID: Number(process.env.OWNER_ID || 0),
  ADMIN_GROUP_ID: Number(process.env.ADMIN_GROUP_ID || 0),
  PUBLIC_URL: process.env.PUBLIC_URL || "",
  PORT: Number(process.env.PORT || 3000),
  DATA_DIR: process.env.DATA_DIR || "./data",
  AUTO_BACKUP_INTERVAL_MIN: Number(process.env.AUTO_BACKUP_INTERVAL_MIN ?? 60),
  AUTO_BACKUP_KEEP: Number(process.env.AUTO_BACKUP_KEEP ?? 48),
};
