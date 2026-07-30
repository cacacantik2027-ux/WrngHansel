const express = require("express");
const { nanoid } = require("nanoid");
const { thinking, sendRich } = require("../../bot/rich");

function bookingRoutes(store, bot, config) {
  const router = express.Router();

  router.post("/", async (req, res) => {
    const { brand, productType, shootDate, budget, needs, talentId, talentName } =
      req.body || {};

    if (!brand || !productType || !needs) {
      return res.status(400).json({ error: "Field brand, productType, dan needs wajib diisi." });
    }

    const telegramUser = req.telegramUser || {};

    const booking = {
      id: nanoid(8),
      brand: String(brand).slice(0, 200),
      productType: String(productType).slice(0, 200),
      shootDate: shootDate ? String(shootDate).slice(0, 50) : "-",
      budget: budget ? String(budget).slice(0, 100) : "-",
      needs: String(needs).slice(0, 2000),
      talentId: talentId || null,
      talentName: talentName || null,
      userId: telegramUser.id || null,
      username: telegramUser.username || null,
      createdAt: new Date().toISOString(),
      status: "new",
    };

    store.data.bookings.push(booking);
    await store.save();

    if (config.ADMIN_GROUP_ID && bot) {
      const text = [
        "# 📋 Order Baru Masuk",
        "",
        `- Brand: ${booking.brand}`,
        `- Jenis produk: ${booking.productType}`,
        `- Talent diminati: ${booking.talentName || "belum ditentukan"}`,
        `- Tanggal shoot: ${booking.shootDate}`,
        `- Budget: ${booking.budget}`,
        `- Kebutuhan: ${booking.needs}`,
        `- Kontak: ${booking.username ? `@${booking.username}` : "(tanpa username)"}`,
        `- Ref: #${booking.id}`,
      ].join("\n");
      try {
        await thinking(bot.telegram, config.ADMIN_GROUP_ID);
        await sendRich(bot.telegram, config.ADMIN_GROUP_ID, text);
      } catch (err) {
        console.error("[booking] failed to notify admin group:", err);
      }
    }

    res.json({ ok: true, id: booking.id });
  });

  return router;
}

module.exports = { bookingRoutes };
