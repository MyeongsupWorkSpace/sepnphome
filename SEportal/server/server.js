const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const mysql = require('mysql2/promise');
const dns = require('dns');

const app = express();
app.use(express.json());
app.use(cors({ origin: true }));
app.use(morgan('tiny'));

// dev에서만 루트 .env.local 로드
const envPath = path.resolve(__dirname, '..', '.env.local');
if (process.env.NODE_ENV !== 'production' && fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
  console.log('[ENV] .env.local loaded');
}

function parseUrl(url) {
  try {
    const u = new URL(url);
    return { host: u.hostname, port: +u.port, user: u.username, password: u.password, database: u.pathname.slice(1) };
  } catch { return null; }
}

// URL 우선 → 없으면 MYSQL_* → 없으면 DB_* (로컬 호환)
const urlCfg = parseUrl(process.env.RAILWAY_DATABASE_URL || process.env.MYSQL_PUBLIC_URL || process.env.DATABASE_URL || '');
const dbCfg = {
  host: urlCfg?.host || process.env.MYSQLHOST || process.env.DB_HOST,
  port: +(urlCfg?.port || process.env.MYSQLPORT || process.env.DB_PORT || 3306),
  user: urlCfg?.user || process.env.MYSQLUSER || process.env.DB_USER || 'root',
  password: urlCfg?.password || process.env.MYSQLPASSWORD || process.env.DB_PASSWORD,
  database: urlCfg?.database || process.env.MYSQLDATABASE || process.env.DB_NAME || 'railway',
  ssl: (process.env.MYSQLSSL === '1' || process.env.DB_SSL === '1') ? { rejectUnauthorized: false } : undefined,
  source: urlCfg ? 'url' : (process.env.MYSQLHOST || process.env.DB_HOST) ? 'env' : 'none'
};

const missing = [];
['host','port','user','password','database'].forEach(k => { if (!dbCfg[k]) missing.push(k); });

console.log('[DB CONFIG]', {
  host: dbCfg.host, port: dbCfg.port, user: dbCfg.user, database: dbCfg.database,
  passwordSet: !!dbCfg.password, sslEnabled: !!dbCfg.ssl, source: dbCfg.source
});

async function dnsResolve(host) {
  return new Promise(r => {
    if (!host) return r({ error: 'NO_HOST' });
    dns.lookup(host, (err, addr) => r(err ? { error: err.code || err.message } : { address: addr }));
  });
}

let pool;
(async () => {
  console.log('[DNS RESOLVE]', await dnsResolve(dbCfg.host));
  if (missing.length) {
    console.error('✗ 누락된 DB 설정:', missing);
    return;
  }
  for (let i = 1; i <= 6; i++) {
    try {
      pool = mysql.createPool({
        host: dbCfg.host, port: dbCfg.port, user: dbCfg.user, password: dbCfg.password, database: dbCfg.database,
        ssl: dbCfg.ssl, waitForConnections: true, connectionLimit: 5, connectTimeout: 15000
      });
      await pool.query('SELECT 1');
      console.log('[DB] 연결 성공 attempt', i);
      break;
    } catch (e) {
      console.error('[DB] 연결 실패 attempt', i, e.code || e.message);
      if (i === 6) console.error('[DB] 최종 실패');
      else await new Promise(r => setTimeout(r, i * 1200));
    }
  }
})();

// 진단
app.get('/api/dbinfo', async (_req, res) => {
  res.json({
    ready: !!pool && !missing.length,
    missing,
    cfg: { host: dbCfg.host, port: dbCfg.port, user: dbCfg.user, database: dbCfg.database, ssl: !!dbCfg.ssl, password: dbCfg.password ? '***' : null },
    dns: await dnsResolve(dbCfg.host)
  });
});

// 간단 저장 API
app.post('/api/suppliers', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'DB not ready' });
  const name = (req.body?.name || '').trim();
  if (!name) return res.status(400).json({ message: 'name required' });
  await pool.execute('INSERT INTO suppliers(name) VALUES(?)', [name]);
  res.status(201).json({ name });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log('Server listening', PORT));