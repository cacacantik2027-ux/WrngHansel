const crypto = require("crypto");

// Validates the `initData` string Telegram Mini Apps send with requests,
// per https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
function verifyInitData(initData, botToken) {
  if (!initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (computedHash !== hash) return null;

  const userRaw = params.get("user");
  return userRaw ? JSON.parse(userRaw) : {};
}

function telegramAuth(config) {
  return (req, res, next) => {
    const initData = req.header("X-Telegram-Init-Data") || req.body?.initData;
    const user = verifyInitData(initData, config.BOT_TOKEN);
    if (!user) {
      // In local development without a real Telegram context, allow
      // requests through but mark them unauthenticated so routes can decide.
      req.telegramUser = null;
      req.telegramVerified = false;
      return next();
    }
    req.telegramUser = user;
    req.telegramVerified = true;
    next();
  };
}

module.exports = { telegramAuth, verifyInitData };
