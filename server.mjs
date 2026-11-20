import http from 'node:http';
import {readFile, writeFile, mkdir, rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {readSheets, publicSnapshot, isValidSnapshot, SCHEMA_VERSION} from './sync.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || path.join(root, 'data');
const cache = path.join(dataDir, 'snapshot.json');
const interval = 12 * 60 * 60 * 1000;
const retryDelay = 5 * 60 * 1000;
const manualCooldown = 20 * 1000;

const configured = () => Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS);

let snapshot;
let lastError = null;
let inflight = null;
let lastAttempt = 0;
let lastManual = 0;

async function loadSeed() {
  const text = await readFile(path.join(root, 'web/rd-data.js'), 'utf8');
  const match = text.match(/^\s*const\s+rdSeed\s*=\s*([\s\S]*?);?\s*$/);
  const seed = JSON.parse(match ? match[1] : text.trim().slice(15, -1));
  if (!isValidSnapshot(seed)) throw new Error('Seed không đúng schema');
  return {...publicSnapshot(seed), seed: true};
}

try {
  const cached = JSON.parse(await readFile(cache, 'utf8'));
  if (isValidSnapshot(cached)) snapshot = cached;
  else console.warn('Ignoring cache with old/invalid schema');
} catch {
  // No usable cache; fall through to the checked-in seed.
}
const reportsCache = path.join(dataDir, 'reports.json');
let reportsData = {periods: {}};
try {
  const raw = JSON.parse(await readFile(reportsCache, 'utf8'));
  if (raw && typeof raw === 'object' && raw.periods) reportsData = raw;
} catch { /* no reports yet */ }
if (!snapshot) snapshot = await loadSeed();

function age() {
  return Date.now() - Date.parse(snapshot?.syncedAt || 0);
}

function meta() {
  return {
    syncedAt: snapshot.syncedAt || null,
    date: snapshot.date || null,
    seed: Boolean(snapshot.seed),
    stale: Boolean(configured()) && age() >= interval,
    lastError,
    intervalHours: 12,
    configured: configured(),
    schemaVersion: SCHEMA_VERSION,
    projectCount: snapshot.projects?.length ?? 0,
    nextRefreshAt: new Date(Date.parse(snapshot.syncedAt || Date.now()) + interval).toISOString(),
  };
}

async function sync() {
  if (inflight) return inflight;
  inflight = (async () => {
    if (!configured()) throw new Error('Chưa cấu hình Google service account');
    const dataset = await readSheets();
    const committed = {
      ...publicSnapshot(dataset),
      seed: false,
      cachedAt: new Date().toISOString(),
    };
    await mkdir(dataDir, {recursive: true});
    await writeFile(cache + '.tmp', JSON.stringify(committed));
    await rename(cache + '.tmp', cache);
    snapshot = committed;
    lastError = null;
    console.log('Sheet sync successful:', committed.projects.length, 'projects');
    return committed;
  })();
  try {
    return await inflight;
  } catch (error) {
    lastError = error?.message || 'Google Sheets sync failed';
    console.error('Google Sheets sync failed:', lastError);
    throw error;
  } finally {
    inflight = null;
  }
}

// Cold start: if the cache is older than the sync interval, refresh before
// serving so the first browser request cannot see stale data.
if (configured() && age() >= interval) {
  try {
    await sync();
  } catch {
    // Serve the previous snapshot, but /healthz and the UI expose the error.
  }
}

const files = {
  '/': ['index.html', 'text/html'],
  '/index.html': ['index.html', 'text/html'],
  '/app.js': ['app.js', 'text/javascript'],
  '/style.css': ['style.css', 'text/css'],
};

const json = value => JSON.stringify(value);

const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (pathname === '/api/refresh') {
    if (req.method !== 'POST') {
      res.writeHead(405, {'Content-Type': 'application/json; charset=utf-8'});
      res.end(json({ok: false, message: 'Chỉ hỗ trợ POST'}));
      return;
    }
    if (Date.now() - lastManual < manualCooldown) {
      res.writeHead(429, {'Content-Type': 'application/json; charset=utf-8'});
      res.end(json({ok: false, message: 'Vui lòng chờ vài giây trước khi đồng bộ lại'}));
      return;
    }
    lastManual = Date.now();
    lastAttempt = Date.now();
    try {
      await sync();
      res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
      res.end(json({ok: true, sync: meta()}));
    } catch (error) {
      res.writeHead(configured() ? 502 : 503, {'Content-Type': 'application/json; charset=utf-8'});
      res.end(json({ok: false, message: error?.message || 'Đồng bộ thất bại', sync: meta()}));
    }
    return;
  }

  if (pathname === '/api/rd-reports') {
    if (req.method === 'GET') {
      res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
      res.end(json(reportsData));
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          const period = String(payload.period || '').trim();
          if (!/^\d{4}-\d{2}-\d{2}$/.test(period)) {
            res.writeHead(400, {'Content-Type': 'application/json; charset=utf-8'});
            res.end(json({ok: false, message: 'Kỳ báo cáo không hợp lệ'}));
            return;
          }
          if (!reportsData.periods) reportsData.periods = {};
          if (!reportsData.periods[period]) reportsData.periods[period] = {entries: {}};
          const incoming = payload.entries && typeof payload.entries === 'object' ? payload.entries : null;
          const projectId = payload.projectId ? String(payload.projectId) : null;
          const entry = payload.entry && typeof payload.entry === 'object' ? payload.entry : null;
          if (projectId && entry) {
            reportsData.periods[period].entries[projectId] = entry;
          } else if (incoming) {
            reportsData.periods[period].entries = {...(reportsData.periods[period].entries || {}), ...incoming};
          }
          reportsData.periods[period].updatedAt = new Date().toISOString();
          await mkdir(dataDir, {recursive: true});
          await writeFile(reportsCache + '.tmp', JSON.stringify(reportsData));
          await rename(reportsCache + '.tmp', reportsCache);
          res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
          res.end(json({ok: true}));
        } catch (error) {
          res.writeHead(400, {'Content-Type': 'application/json; charset=utf-8'});
          res.end(json({ok: false, message: error?.message || 'Lỗi lưu dữ liệu'}));
        }
      });
      return;
    }
    res.writeHead(405, {'Content-Type': 'application/json; charset=utf-8'});
    res.end(json({ok: false, message: 'Method not allowed'}));
    return;
  }

  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405);
    res.end();
    return;
  }

  let body;
  let type = 'application/json; charset=utf-8';
  if (pathname === '/healthz') {
    body = json({status: 'ok', sync: meta()});
  } else if (pathname === '/api/rd-snapshot') {
    body = json({...publicSnapshot(snapshot), sync: meta()});
  } else if (pathname === '/rd-data.js') {
    type = 'text/javascript; charset=utf-8';
    body = 'const rdSeed = ' + json(publicSnapshot(snapshot)) + ';';
  } else if (files[pathname]) {
    const [file, mime] = files[pathname];
    type = mime + '; charset=utf-8';
    body = await readFile(path.join(root, 'web', file));
  } else {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  res.setHeader('Content-Type', type);
  res.end(req.method === 'HEAD' ? undefined : body);
});

// Check once a minute; retry failures every five minutes. Successful reads are 12 hours apart.
function tick() {
  if (!configured()) return;
  if (age() >= interval && Date.now() - lastAttempt >= retryDelay) {
    lastAttempt = Date.now();
    void sync().catch(() => {});
  }
}

server.listen(Number(process.env.PORT) || 3000, '0.0.0.0', () => {
  console.log('QC Workbench listening');
  tick();
});
const timer = setInterval(tick, 60000);

process.on('SIGTERM', () => {
  clearInterval(timer);
  server.close();
});
