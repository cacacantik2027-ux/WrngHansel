// "Thinking" animation + Rich Messages
// ------------------------------------
// - `thinking()` uses the "typing" chat action (Bot API, stable for years)
//   to show Telegram's native "Bot is typing..." indicator for a moment
//   before the bot's next reply — a simple, always-safe stand-in for a
//   "thinking" animation on a bot that doesn't stream AI output.
// - `sendRich()` / `editRich()` use Rich Messages (Bot API 10.1, June 11
//   2026), which let a bot send headings, lists and other structured
//   Markdown instead of a wall of plain text.
//
// Telegraf 4.16 predates both `sendRichMessage` and the `rich_message`
// parameter of `editMessageText`, so we call them through the generic
// `telegram.callApi()` escape hatch instead of a typed helper. This is a
// brand-new API surface (weeks old at the time of writing), so every call
// falls back to an ordinary plain-text message if the rich call fails —
// e.g. because the bot is running against an older local Bot API server.

async function thinking(telegram, chatId, ms = 700) {
  try {
    await telegram.sendChatAction(chatId, "typing");
  } catch (_) {
    // Not fatal — the reply below just won't have the "typing..." lead-in.
  }
  if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendRich(telegram, chatId, markdown, extra = {}) {
  try {
    return await telegram.callApi("sendRichMessage", {
      chat_id: chatId,
      rich_message: { markdown },
      ...extra,
    });
  } catch (err) {
    // Fall back to a plain message (no parse_mode, to guarantee it always
    // sends without a formatting-related error) if Rich Messages aren't
    // available yet on this bot/server.
    return telegram.sendMessage(chatId, markdown, extra);
  }
}

async function editRich(telegram, chatId, messageId, markdown, extra = {}) {
  try {
    return await telegram.callApi("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text: markdown,
      rich_message: { markdown },
      ...extra,
    });
  } catch (err) {
    return telegram.editMessageText(chatId, messageId, undefined, markdown, extra);
  }
}

module.exports = { thinking, sendRich, editRich };
