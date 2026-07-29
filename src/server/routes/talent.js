const express = require("express");

function talentRoutes(store) {
  const router = express.Router();

  router.get("/", (req, res) => {
    const activeOnly = store.data.talents.filter((t) => t.active);
    res.json(
      activeOnly.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        photo: t.photo,
        packages: t.packages,
      }))
    );
  });

  return router;
}

module.exports = { talentRoutes };
