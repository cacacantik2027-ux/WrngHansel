// Minimal JSON-file database with atomic writes.
// Chosen over a binary DB engine so the whole database is always a single
// human-readable file that's trivial to export, import, and restore.

const fs = require("fs");
const path = require("path");

function defaultData() {
  return {
    meta: {
      version: 1,
      createdAt: new Date().toISOString(),
      lastBackupAt: null,
    },
    settings: {
      ownerId: null,
      adminGroupId: null,
      botUsername: null,
      infoPages: {
        ads: { title: "Promo & Ads", body: "Belum ada konten." },
        channel: { title: "Channel Kami", body: "Belum ada konten.", url: "" },
        group: { title: "Grup Komunitas", body: "Belum ada konten.", url: "" },
        sponsor: { title: "Sponsor", body: "Belum ada konten." },
      },
      rules: "Aturan belum diatur oleh owner.",
      home: {
        eyebrow: "Talent Hansel",
        title: "Talent produk, siap untuk brand-mu.",
        subtitle:
          "Jelajahi katalog talent kami, pilih paket yang sesuai, dan ajukan order langsung ke tim kami.",
        tag: "Order terstruktur, respons cepat",
        sectionTitle: "Jelajahi",
        links: {
          talent: { label: "Katalog Talent", sub: "Foto, deskripsi, dan paket harga" },
          info: { label: "Info & Promo", sub: "Channel, grup, sponsor" },
          rules: { label: "Aturan Order", sub: "Ketentuan yang perlu kamu tahu" },
        },
      },
      pageBackgrounds: {
        home: { type: "color", value: "#f5f1e6" },
        talent: { type: "color", value: "#f5f1e6" },
        info: { type: "color", value: "#f5f1e6" },
        rules: { type: "color", value: "#f5f1e6" },
      },
    },
    talents: [],
    packages: [], // shared package/category price list, referenced by talents
    users: {}, // userId -> profile
    sessions: {}, // userId -> live chat session state
    groupMessageIndex: {}, // groupMessageId -> userId (for routing admin replies)
    bookings: [],
  };
}

class Store {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.file = path.join(dataDir, "db.json");
    this.backupsDir = path.join(dataDir, "backups");
    this._data = null;
    this._writeQueue = Promise.resolve();
  }

  init() {
    fs.mkdirSync(this.dataDir, { recursive: true });
    fs.mkdirSync(this.backupsDir, { recursive: true });
    if (!fs.existsSync(this.file)) {
      this._data = defaultData();
      this._writeSync();
    } else {
      this._data = JSON.parse(fs.readFileSync(this.file, "utf8"));
      this._migrate();
    }
    return this;
  }

  _migrate() {
    const def = defaultData();
    // Shallow-fill any missing top-level keys introduced in later versions.
    for (const key of Object.keys(def)) {
      if (!(key in this._data)) this._data[key] = def[key];
    }
    for (const key of Object.keys(def.settings)) {
      if (!(key in this._data.settings)) this._data.settings[key] = def.settings[key];
    }
  }

  get data() {
    return this._data;
  }

  _writeSync() {
    const tmp = this.file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(this._data, null, 2));
    fs.renameSync(tmp, this.file);
  }

  // Queue writes so concurrent saves never interleave/corrupt the file.
  save() {
    this._writeQueue = this._writeQueue.then(() => {
      this._writeSync();
    });
    return this._writeQueue;
  }

  replaceAll(newData) {
    this._data = newData;
    this._migrate();
    return this.save();
  }
}

module.exports = { Store, defaultData };
