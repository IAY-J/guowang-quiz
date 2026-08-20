const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'userdata');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function hashPass(pass) {
  return crypto.createHash('sha256').update(String(pass)).digest('hex');
}
function validUser(u) {
  return typeof u === 'string' && u.trim().length >= 1 && u.trim().length <= 30;
}
function validPass(p) {
  return /^\d{6}$/.test(String(p || ''));
}
function userFile(u) {
  return path.join(DATA_DIR, u + '.json');
}
function loadUser(u) {
  try { return JSON.parse(fs.readFileSync(userFile(u), 'utf8')); } catch (e) { return null; }
}
function sendJson(res, code, obj) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', (c) => { buf += c; if (buf.length > 20 * 1024 * 1024) { req.destroy(); } });
    req.on('end', () => {
      try { resolve(JSON.parse(buf || '{}')); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}
function auth(body) {
  const user = String((body && body.user) || '').trim();
  const pass = body && body.pass;
  const rec = loadUser(user);
  if (!rec || rec.passHash !== hashPass(pass)) return null;
  return rec;
}
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.zip': 'application/zip'
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { sendJson(res, 200, {}); return; }
  const url = (req.url || '/').split('?')[0];
  if (req.method === 'GET' && url === '/api/gh-config') {
    const cfgPath = path.join(ROOT, 'local-config.json');
    if (fs.existsSync(cfgPath)) return sendJson(res, 200, JSON.parse(fs.readFileSync(cfgPath, 'utf8')));
    return sendJson(res, 404, { error: 'no config' });
  }
  try {
    if (req.method === 'POST') {
      const body = await readBody(req);
      if (url === '/api/register') {
        const user = String((body && body.user) || '').trim();
        if (!validUser(user)) return sendJson(res, 400, { error: '用户名不能为空且不超过30个字符' });
        if (!validPass(body && body.pass)) return sendJson(res, 400, { error: '密码必须是6位数字' });
        if (loadUser(user)) return sendJson(res, 400, { error: '该用户名已注册' });
        fs.writeFileSync(userFile(user), JSON.stringify({ user: user, passHash: hashPass(body.pass), data: {} }), 'utf8');
        return sendJson(res, 200, { ok: true });
      }
      if (url === '/api/login' || url === '/api/load') {
        const rec = auth(body);
        if (!rec) return sendJson(res, 401, { error: '用户名或密码错误' });
        return sendJson(res, 200, { ok: true, data: rec.data || {} });
      }
      if (url === '/api/gh-config') {
        const cfgPath = path.join(ROOT, 'local-config.json');
        if (fs.existsSync(cfgPath)) return sendJson(res, 200, JSON.parse(fs.readFileSync(cfgPath, 'utf8')));
        return sendJson(res, 404, { error: 'no config' });
      }
      if (url === '/api/save') {
        const rec = auth(body);
        if (!rec) return sendJson(res, 401, { error: '用户名或密码错误' });
        rec.data = (body && body.data) || {};
        fs.writeFileSync(userFile(rec.user), JSON.stringify(rec), 'utf8');
        return sendJson(res, 200, { ok: true });
      }
      return sendJson(res, 404, { error: 'not found' });
    }
    // static
    let rel = url === '/' || url === '' ? 'index.html' : url.replace(/^\/+/, '');
    const p = path.resolve(ROOT, rel);
    if (p !== ROOT && !p.startsWith(ROOT + path.sep)) return sendJson(res, 403, { error: 'forbidden' });
    const data = fs.readFileSync(p);
    const ext = path.extname(p).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  } catch (e) {
    sendJson(res, 500, { error: String(e && e.message || e) });
  }
});

const PORT = Number(process.env.PORT || 8124);
server.listen(PORT, '0.0.0.0', () => {
  console.log('Account sync server running at http://0.0.0.0:' + PORT);
});
