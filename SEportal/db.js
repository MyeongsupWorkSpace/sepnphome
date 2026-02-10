const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// 프로덕션에서는 Railway 환경변수만 사용
const isProd = process.env.RAILWAY_ENVIRONMENT === 'production';

if (!isProd) {
  // 로컬 개발: .env.local 로드
  require('dotenv').config({ path: '.env.local' });
  console.log('ℹ️ 로컬 개발 모드');
}

const cfg = {
  host: process.env.MYSQLHOST || 'mysql.railway.internal',
  port: parseInt(process.env.MYSQLPORT || '3306', 10),
  user: process.env.MYSQLUSER || 'root',
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE || 'railway'
};

console.log('[DB] 연결 설정:', {
  host: cfg.host,
  port: cfg.port,
  user: cfg.user,
  database: cfg.database,
  passwordSet: !!cfg.password
});

// 필수값 검증
const missing = ['host', 'user', 'password', 'database'].filter(k => !cfg[k]);
if (missing.length) {
  console.error('❌ [DB] 누락된 필수 항목:', missing);
  throw new Error(`Missing required DB config: ${missing.join(', ')}`);
}

const pool = mysql.createPool({
  ...cfg,
  waitForConnections: true,
  connectionLimit: 10,
  connectTimeout: 30000,
  queueLimit: 0
});

// 연결 테스트 (앱 시작을 막지 않음)
pool.getConnection()
  .then(conn => {
    console.log(`✅ [DB] 연결 성공: ${cfg.host}/${cfg.database}`);
    conn.release();
  })
  .catch(err => {
    console.error('❌ [DB] 연결 실패:', err.message);
  });

module.exports = pool;