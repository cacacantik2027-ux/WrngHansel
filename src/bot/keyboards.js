const { Markup } = require("telegraf");

function openMiniAppKeyboard(publicUrl) {
  return Markup.inlineKeyboard([
    Markup.button.webApp("Buka Katalog Talent", publicUrl || "https://t.me"),
  ]);
}

function endSessionKeyboard(userId) {
  return Markup.inlineKeyboard([
    Markup.button.callback("🔴 Akhiri Sesi", `end_session:${userId}`),
  ]);
}

function sessionClosedNotice() {
  return Markup.inlineKeyboard([]);
}

module.exports = { openMiniAppKeyboard, endSessionKeyboard, sessionClosedNotice };
