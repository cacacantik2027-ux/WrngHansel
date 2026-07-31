const { Markup } = require("telegraf");

// `style` is the button-color field added in Telegram Bot API 9.4
// (Feb 9, 2026): 'primary' (blue), 'success' (green), 'danger' (red).
// Older Telegram clients just ignore it and show the default look.

function openMiniAppKeyboard(publicUrl) {
  const button = Markup.button.webApp("Buka Katalog Talent", publicUrl || "https://t.me");
  return Markup.inlineKeyboard([{ ...button, style: "success" }]);
}

function endSessionKeyboard(userId) {
  const button = Markup.button.callback("🔴 Akhiri Sesi", `end_session:${userId}`);
  return Markup.inlineKeyboard([{ ...button, style: "danger" }]);
}

function sessionClosedNotice() {
  return Markup.inlineKeyboard([]);
}

module.exports = { openMiniAppKeyboard, endSessionKeyboard, sessionClosedNotice };
