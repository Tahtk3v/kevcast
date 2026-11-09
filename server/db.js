// Tiny JSON-file database. Narrowcasting setups have hundreds of records, not
// millions, so a single JSON file keeps installation dependency-free
// (no native modules, no database server) on Windows, macOS and Linux.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const EMPTY = () => ({
  settings: { orgName: 'KevCast', adminUser: null },
  media: [],
  playlists: [],
  displays: [],
  schedules: [],
});

class Database {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, 'db.json');
    fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(this.file)) {
      this.data = Object.assign(EMPTY(), JSON.parse(fs.readFileSync(this.file, 'utf8')));
    } else {
      this.data = EMPTY();
      this.saveNow();
    }
    this._timer = null;
    this.listeners = new Set();
  }

  static id() {
    return crypto.randomBytes(8).toString('hex');
  }

  onChange(fn) {
    this.listeners.add(fn);
  }

  /** Persist soon (debounced) and notify listeners (e.g. players). */
  save(what = 'all') {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.saveNow(), 100);
    for (const fn of this.listeners) fn(what);
  }

  saveNow() {
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }

  // Generic helpers ---------------------------------------------------------
  list(col) {
    return this.data[col];
  }
  get(col, id) {
    return this.data[col].find((x) => x.id === id);
  }
  insert(col, obj) {
    const rec = { id: Database.id(), createdAt: new Date().toISOString(), ...obj };
    this.data[col].push(rec);
    this.save(col);
    return rec;
  }
  update(col, id, patch) {
    const rec = this.get(col, id);
    if (!rec) return null;
    Object.assign(rec, patch, { updatedAt: new Date().toISOString() });
    this.save(col);
    return rec;
  }
  remove(col, id) {
    const i = this.data[col].findIndex((x) => x.id === id);
    if (i === -1) return false;
    this.data[col].splice(i, 1);
    this.save(col);
    return true;
  }
}

module.exports = Database;
