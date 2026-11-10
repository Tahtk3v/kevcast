// User accounts (db.users), passwords hashed with scrypt, stateless signed session cookie.
// Roles: 'admin' (everything, including users and server settings) and 'editor' (content,
// playlists, schedules, displays and groups). Each user has a session version (sv): raising it
// (password change, role change, removal) signs that user out everywhere.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const COOKIE = 'kevcast_session';
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

function loadSecret(dataDir) {
  const f = path.join(dataDir, 'secret.key');
  if (!fs.existsSync(f)) fs.writeFileSync(f, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  return fs.readFileSync(f, 'utf8').trim();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, user) {
  if (!user) return false;
  const { hash } = hashPassword(password, user.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.hash, 'hex'));
}

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function createAuth(db, dataDir) {
  const secret = loadSecret(dataDir);
  const sign = (v) => crypto.createHmac('sha256', secret).update(v).digest('hex');

  function issue(res, user) {
    const payload = Buffer.from(JSON.stringify({ u: user.id, v: user.sv || 0, exp: Date.now() + MAX_AGE_MS })).toString('base64url');
    const token = `${payload}.${sign(payload)}`;
    res.setHeader('Set-Cookie', `${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${MAX_AGE_MS / 1000}`);
  }

  function clear(res) {
    res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
  }

  function currentUser(req) {
    const token = parseCookies(req.headers.cookie)[COOKIE];
    if (!token) return null;
    const [payload, sig] = token.split('.');
    if (!payload || !sig || sign(payload).length !== sig.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sign(payload)), Buffer.from(sig))) return null;
    try {
      const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
      if (data.exp < Date.now()) return null;
      const users = db.list('users');
      // Cookies from before multiple users (0.2.x) hold the username instead of the id.
      const user = users.find((x) => x.id === data.u) || users.find((x) => x.username === data.u);
      if (!user || (data.v || 0) !== (user.sv || 0)) return null;
      return user;
    } catch {
      return null;
    }
  }

  function requireUser(req, res, next) {
    const u = currentUser(req);
    if (!u) return res.status(401).json({ error: 'Not logged in' });
    req.user = u;
    next();
  }

  function requireAdministrator(req, res, next) {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Only administrators can do this' });
    next();
  }

  return { issue, clear, currentUser, requireUser, requireAdministrator, hashPassword, verifyPassword };
}

module.exports = { createAuth, hashPassword, verifyPassword };
