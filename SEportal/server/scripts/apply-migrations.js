const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// dev에서만 루트 .env.local 로드
const envPath = path.resolve(__dirname, '..', '.env.local');
if (process.env.NODE_ENV !== 'production' && fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

function parseUrl(url) {
  try {
    const u = new URL(url);
    return { host: u.hostname, port: +u.port, user: u.username, password: u.password, database: u.pathname.slice(1) };
  } catch { return null; }
}

(async () => {
  const urlCfg = parseUrl(process.env.RAILWAY_DATABASE_URL || process.env.MYSQL_PUBLIC_URL || process.env.DATABASE_URL || '');
  const cfg = {
    host: urlCfg?.host || process.env.MYSQLHOST || process.env.DB_HOST,
    port: +(urlCfg?.port || process.env.MYSQLPORT || process.env.DB_PORT || 3306),
    user: urlCfg?.user || process.env.MYSQLUSER || process.env.DB_USER || 'root',
    password: urlCfg?.password || process.env.MYSQLPASSWORD || process.env.DB_PASSWORD,
    database: urlCfg?.database || process.env.MYSQLDATABASE || process.env.DB_NAME || 'railway',
    multipleStatements: true,
    ssl: (process.env.MYSQLSSL === '1' || process.env.DB_SSL === '1') ? { rejectUnauthorized: false } : undefined
  };
  console.log('[MIGRATE CFG]', { ...cfg, password: cfg.password ? '***' : null, sslEnabled: !!cfg.ssl });

  if (!cfg.password || !cfg.host) throw new Error('Missing DB config (host/password)');

  const conn = await mysql.createConnection(cfg);
  const dir = path.join(__dirname, '..', 'db', 'migrations');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  for (const f of files) {
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    await conn.query(sql);
    console.log('Applied:', f);
  }
  await conn.end();
  console.log('Migrations complete.');
})().catch(e => {
  console.error('Migration failed:', e.message);
  process.exit(1);
});