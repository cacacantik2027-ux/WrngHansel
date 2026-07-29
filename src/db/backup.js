const fs = require("fs");
const path = require("path");

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

/**
 * Writes a snapshot of the current DB into the backups folder.
 * Returns the absolute path of the file written.
 */
function exportSnapshot(store, label = "manual") {
  const file = path.join(store.backupsDir, `backup-${timestamp()}-${label}.json`);
  fs.writeFileSync(file, JSON.stringify(store.data, null, 2));
  return file;
}

/** Lists backup files, most recent first. */
function listBackups(store) {
  return fs
    .readdirSync(store.backupsDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const full = path.join(store.backupsDir, f);
      const stat = fs.statSync(full);
      return { file: f, full, mtime: stat.mtimeMs, size: stat.size };
    })
    .sort((a, b) => b.mtime - a.mtime);
}

/** Deletes oldest backups beyond `keep` count. */
function pruneBackups(store, keep) {
  const backups = listBackups(store);
  const toDelete = backups.slice(keep);
  for (const b of toDelete) fs.unlinkSync(b.full);
  return toDelete.length;
}

/** Restores the DB in-memory + on-disk from a given backup file path. */
function restoreFromFile(store, filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  return store.replaceAll(parsed);
}

/** Imports an arbitrary JSON buffer (e.g. an uploaded Telegram document). */
function importFromBuffer(store, buffer) {
  const parsed = JSON.parse(buffer.toString("utf8"));
  return store.replaceAll(parsed);
}

function startAutoBackup(store, { intervalMinutes, keep }) {
  if (!intervalMinutes || intervalMinutes <= 0) return null;
  const ms = intervalMinutes * 60 * 1000;
  const timer = setInterval(() => {
    try {
      exportSnapshot(store, "auto");
      pruneBackups(store, keep);
      store.data.meta.lastBackupAt = new Date().toISOString();
      store.save();
    } catch (err) {
      console.error("[auto-backup] failed:", err);
    }
  }, ms);
  timer.unref();
  return timer;
}

module.exports = {
  exportSnapshot,
  listBackups,
  pruneBackups,
  restoreFromFile,
  importFromBuffer,
  startAutoBackup,
};
