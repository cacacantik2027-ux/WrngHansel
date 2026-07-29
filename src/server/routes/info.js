const express = require("express");

function infoRoutes(store) {
  const router = express.Router();

  router.get("/", (req, res) => {
    res.json(store.data.settings.infoPages);
  });

  router.get("/rules", (req, res) => {
    res.json({ rules: store.data.settings.rules });
  });

  return router;
}

module.exports = { infoRoutes };
