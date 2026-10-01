'use strict';
/* Slide Studio Live Server — rooms, polls, quizzes, leaderboard.
   Env: PORT, PUBLIC_URL (e.g. https://live.example.com), STUDIO_PASSWORD (protects the editor + host connections) */
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = +process.env.PORT || 3000;
const PUBLIC = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');
const PASS = process.env.STUDIO_PASSWORD || '';
const MAX_AUD = +process.env.MAX_AUDIENCE || 5000;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const lanIp = () => { for (const l of Object.values(os.networkInterfaces())) for (const i of l || []) if (i.family === 'IPv4' && !i.internal) return i.address; return 'localhost'; };
// Accepts http(s) or ws(s) by mistake and always returns a browser-openable http(s) URL —
// the join link must never carry a ws:// / wss:// scheme (that's only for the Live Server
// *connection*, not for the page people open on their phones).
const toHttp = u => u.replace(/^wss:\/\//i, 'https://').replace(/^ws:\/\//i, 'http://');
function baseOf(req) {
  if (PUBLIC) return toHttp(PUBLIC.replace(/\/+$/, ''));
  const proto = (req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
  let host = (req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  if (/^(localhost|127\.|\[::1\])/.test(host)) host = lanIp() + ':' + PORT;   // audience phones cannot reach "localhost"
  return toHttp(proto + '://' + host);
}
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const file = n => fs.readFileSync(path.join(__dirname, 'public', n), 'utf8');

/* ---------- HTTP ---------- */
const server = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  const send = (code, type, body, extra) => { res.writeHead(code, Object.assign({ 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' }, extra || {})); res.end(body); };
  if (u === '/health') return send(200, 'application/json', JSON.stringify({ ok: true, rooms: rooms.size }));
  if (u === '/join' || /^\/j\/[A-Za-z0-9]{4,8}$/.test(u)) return send(200, 'text/html; charset=utf-8', file('join.html'), { 'Cache-Control': 'no-store' });
  if (u === '/' || u === '/index.html') {
    if (PASS) {
      const m = /^Basic (.+)$/.exec(req.headers.authorization || ''), pw = m ? Buffer.from(m[1], 'base64').toString().split(':').slice(1).join(':') : '';
      if (!safeEq(pw, PASS)) return send(401, 'text/plain', 'Password required', { 'WWW-Authenticate': 'Basic realm="Slide Studio"' });
    }
    const inject = '<script>window.__LIVE__=' + JSON.stringify({ join: baseOf(req) + '/join', token: PASS || '' }) + '</script>';
    return send(200, 'text/html; charset=utf-8', file('index.html').replace('<!--LIVE-->', inject), { 'Cache-Control': 'no-store' });
  }
  send(404, 'text/plain', 'Not found');
});

/* ---------- ROOMS ---------- */
const rooms = new Map();
const newCode = () => { let c; do { c = Array.from(crypto.randomBytes(6), b => CODE_CHARS[b % CODE_CHARS.length]).join(''); } while (rooms.has(c)); return c; };
const J = o => JSON.stringify(o);
const tx = (ws, o) => { if (ws && ws.readyState === 1) ws.send(J(o)); };
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);

function leaderboard(r, n) { return [...r.scores.values()].sort((a, b) => b.score - a.score).slice(0, n).map(x => [x.name, x.score]); }
function rankOf(r, pid) { const l = [...r.scores.entries()].sort((a, b) => b[1].score - a[1].score); return l.findIndex(x => x[0] === pid) + 1; }

function onHost(ws, m, req) {
  if (PASS && !safeEq(m.token || '', PASS)) { tx(ws, { t: 'err', msg: 'Wrong studio password' }); return ws.close(); }
  let r = m.room && rooms.get(String(m.room).toUpperCase());
  if (r && safeEq(r.key, m.key || '')) { if (r.host && r.host !== ws) try { r.host.close(); } catch (e) {} }
  else { r = { code: newCode(), key: crypto.randomBytes(12).toString('hex'), host: null, auds: new Set(), cur: null, scores: new Map(), seen: Date.now() }; rooms.set(r.code, r); }
  r.host = ws; ws.room = r; ws.role = 'host';
  tx(ws, { t: 'room', code: r.code, key: r.key, url: baseOf(req) + '/j/' + r.code, n: r.auds.size });
  if (r.cur && r.cur.open) tx(ws, { t: 'note', msg: 'A question is still open' });
}
function onAud(ws, m) {
  const r = rooms.get(String(m.room || '').toUpperCase());
  if (!r) return tx(ws, { t: 'err', msg: 'Room not found. Check the code.' });
  if (r.auds.size >= MAX_AUD) return tx(ws, { t: 'err', msg: 'Room is full' });
  const pid = /^[a-z0-9]{6,24}$/i.test(m.pid || '') ? m.pid : crypto.randomBytes(6).toString('hex');
  ws.role = 'aud'; ws.room = r; ws.pid = pid; ws.name = clean(m.name, 24) || 'Guest';
  for (const o of r.auds) if (o.pid === pid && o !== ws) { r.auds.delete(o); try { o.close(); } catch (e) {} }
  r.auds.add(ws);
  const sc = r.scores.get(pid); if (sc) sc.name = ws.name;
  tx(ws, { t: 'hi', pid, name: ws.name, score: sc ? sc.score : 0 });
  if (r.cur && r.cur.open) { const c = r.cur; tx(ws, { t: 'open', id: c.id, q: c.q, o: c.o, kind: c.kind, tm: c.tm, left: Math.max(0, c.tm - Math.round((Date.now() - c.at) / 1000)), voted: c.votes.has(pid) ? c.votes.get(pid).c : null }); }
  tx(r.host, { t: 'count', n: r.auds.size });
}
function hostMsg(ws, m) {
  const r = ws.room;
  if (m.t === 'open') {
    const o = (Array.isArray(m.o) ? m.o : []).slice(0, 12).map(x => clean(x, 120));
    r.cur = { id: clean(m.id, 24), q: clean(m.q, 300), o, kind: m.kind === 'quiz' ? 'quiz' : 'poll', tm: Math.min(600, Math.max(5, +m.tm || 20)), at: Date.now(), open: true, votes: new Map() };
    const c = r.cur; for (const a of r.auds) tx(a, { t: 'open', id: c.id, q: c.q, o: c.o, kind: c.kind, tm: c.tm, left: c.tm, voted: null });
  } else if (m.t === 'close' && r.cur && r.cur.open) {
    const c = r.cur; c.open = false; const ok = c.kind === 'quiz' ? +m.ok : -1, counts = new Array(c.o.length).fill(0);
    for (const v of c.votes.values()) counts[v.c]++;
    if (c.kind === 'quiz') for (const [pid, v] of c.votes) {
      if (v.c !== ok) continue; const el = v.ts - c.at, bonus = Math.max(0, Math.round((1 - el / (c.tm * 1000)) * 100));
      const s = r.scores.get(pid) || { name: v.name, score: 0 }; s.name = v.name; s.score += 100 + bonus; v.pts = 100 + bonus; r.scores.set(pid, s);
    }
    for (const a of r.auds) { const v = c.votes.get(a.pid), sc = r.scores.get(a.pid); tx(a, { t: 'result', id: c.id, kind: c.kind, ok, counts, choice: v ? v.c : null, correct: !!v && v.c === ok, points: v && v.pts || 0, score: sc ? sc.score : 0, rank: sc ? rankOf(r, a.pid) : 0, total: r.scores.size }); }
    tx(ws, { t: 'board', rows: leaderboard(r, 10) });
  } else if (m.t === 'reset') { r.scores.clear(); tx(ws, { t: 'board', rows: [] }); for (const a of r.auds) tx(a, { t: 'hi', pid: a.pid, name: a.name, score: 0 }); }
}
function audMsg(ws, m) {
  const r = ws.room, c = r.cur;
  if (m.t === 'name') { ws.name = clean(m.name, 24) || ws.name; return; }
  if (m.t !== 'vote' || !c || !c.open || m.id !== c.id || c.votes.has(ws.pid)) return;
  const ch = m.choice; if (!Number.isInteger(ch) || ch < 0 || ch >= c.o.length) return;
  c.votes.set(ws.pid, { c: ch, ts: Date.now(), name: ws.name });
  tx(ws, { t: 'ack', id: c.id, choice: ch }); tx(r.host, { t: 'vote', pid: ws.pid, name: ws.name, choice: ch });
}

/* ---------- WEBSOCKET ---------- */
const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
server.on('upgrade', (req, sock, head) => {
  if (req.url.split('?')[0] !== '/ws') return sock.destroy();
  wss.handleUpgrade(req, sock, head, ws => { ws.req = req; wss.emit('connection', ws, req); });
});
wss.on('connection', (ws, req) => {
  ws.alive = true; ws.n = 0; ws.on('pong', () => ws.alive = true);
  const rl = setInterval(() => ws.n = 0, 10000);
  ws.on('message', raw => {
    if (++ws.n > 80) return;                                   // rate limit: 80 msgs / 10 s per connection
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m !== 'object') return;
    if (m.t === 'hello') { if (ws.role) return; return m.role === 'host' ? onHost(ws, m, req) : onAud(ws, m); }
    if (!ws.room) return;
    ws.room.seen = Date.now();
    if (ws.role === 'host') hostMsg(ws, m); else audMsg(ws, m);
  });
  ws.on('close', () => {
    clearInterval(rl); const r = ws.room; if (!r) return;
    if (ws.role === 'host' && r.host === ws) { r.host = null; r.seen = Date.now(); }
    if (ws.role === 'aud') { r.auds.delete(ws); tx(r.host, { t: 'count', n: r.auds.size }); }
  });
  ws.on('error', () => {});
});
setInterval(() => { for (const ws of wss.clients) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; try { ws.ping(); } catch (e) {} } }, 25000);
setInterval(() => { const now = Date.now(); for (const [c, r] of rooms) if (!r.host && now - r.seen > 12 * 3600e3) rooms.delete(c); }, 10 * 60e3);

if (require.main === module) server.listen(PORT, () => {
  const b = PUBLIC || 'http://' + lanIp() + ':' + PORT;
  console.log('\n  Slide Studio Live Server\n  ─────────────────────────\n  Presenter (open on this PC): http://localhost:' + PORT + '\n  Audience join page          : ' + b + '/join\n' + (PASS ? '  Studio password is ON\n' : '  Tip: set STUDIO_PASSWORD to protect the editor when online\n'));
});
module.exports = { server, rooms };
