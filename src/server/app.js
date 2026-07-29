const express = require("express");
const cors = require("cors");
const path = require("path");

const { telegramAuth } = require("./middleware/telegramAuth");
const { talentRoutes } = require("./routes/talent");
const { infoRoutes } = require("./routes/info");
const { bookingRoutes } = require("./routes/booking");

function createApp(store, bot, config) {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(telegramAuth(config));

  app.use("/api/talent", talentRoutes(store));
  app.use("/api/info", infoRoutes(store));
  app.use("/api/booking", bookingRoutes(store, bot, config));

  app.get("/healthz", (req, res) => res.json({ ok: true }));

  app.get("/api/config", (req, res) => {
    res.json({ botUsername: store.data.settings.botUsername || null });
  });

  // Serve the Mini App static files.
  const webappDir = path.join(__dirname, "..", "..", "webapp");
  app.use(express.static(webappDir));
  app.get("*", (req, res) => {
    res.sendFile(path.join(webappDir, "index.html"));
  });

  return app;
}

module.exports = { createApp };
