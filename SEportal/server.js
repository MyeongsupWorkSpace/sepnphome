const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const isProd = process.env.RAILWAY_ENVIRONMENT === 'production' || process.env.NODE_ENV === 'production';
if (!isProd && fs.existsSync(path.join(__dirname, '.env.local'))) {
  require('dotenv').config({ path: path.join(__dirname, '.env.local') });
  console.log('ℹ️ 로컬 .env.local loaded');
} else {
  console.log('ℹ️ 프로덕션 모드: .env.local skip');
}

const app = express();
const PORT = process.env.PORT || 3000;

const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}
const LOG_RETENTION_DAYS = 30;
let currentLogDate = '';
let currentLogStream = null;

function pad2(n) {
  return String(n).padStart(2, '0');
}

function getLocalDateKey(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function openLogStream(dateKey) {
  if (currentLogStream) {
    currentLogStream.end();
  }
  currentLogDate = dateKey;
  const filePath = path.join(logDir, `access-${dateKey}.log`);
  currentLogStream = fs.createWriteStream(filePath, { flags: 'a' });
}

function cleanupOldLogs() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - LOG_RETENTION_DAYS);
  const files = fs.readdirSync(logDir);
  files.forEach((file) => {
    const match = /^access-(\d{4})-(\d{2})-(\d{2})\.log$/.exec(file);
    if (!match) return;
    const logDate = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00`);
    if (Number.isNaN(logDate.getTime())) return;
    if (logDate < cutoff) {
      try {
        fs.unlinkSync(path.join(logDir, file));
      } catch (e) {
        console.warn('⚠️ 로그 삭제 실패:', file, e.message);
      }
    }
  });
}

const accessLogStream = {
  write: (message) => {
    const dateKey = getLocalDateKey();
    if (!currentLogStream || dateKey !== currentLogDate) {
      openLogStream(dateKey);
      cleanupOldLogs();
    }
    currentLogStream.write(message);
  }
};

// CORS: 외부 PC에서 API 호출 허용 (필요시 origin 제한)
app.use(cors());
app.use(morgan('combined', { stream: accessLogStream }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 구버전 경로 호환 (/sepmp-website/public/* -> /*)
app.use('/sepmp-website/public', (req, res) => {
  const target = req.originalUrl.replace(/^\/sepmp-website\/public/, '') || '/';
  return res.redirect(301, target);
});

// 정적 파일 (public/index.html 복원)
app.use(express.static(path.join(__dirname, 'public')));

// 헬스체크
app.get('/health', (req, res) => res.status(200).send('OK'));

// DB 및 라우트 로드 (DB 연결 실패해도 서버는 기동)
let db;
try {
  db = require('./db');
  console.log('ℹ️ db 모듈 로드됨');
} catch (e) {
  console.warn('⚠️ db 모듈 로드 실패:', e.message);
}

// 디버그 라우트 (DB 확인용)
try {
  app.use('/api/debug', require('./routes/debug'));
} catch (e) {
  console.warn('⚠️ debug route 없음:', e.message);
}

// 기존 API 라우트
try { app.use('/api/auth', require('./routes/auth')); } catch {}
try { app.use('/api/assignments', require('./routes/assignments')); } catch {}
try { app.use('/api/products', require('./routes/products')); } catch {}
try { app.use('/api/customers', require('./routes/customers')); } catch {}
try { app.use('/api/orders', require('./routes/orders')); } catch {}
try { app.use('/api/suppliers', require('./routes/suppliers')); } catch {}
try { app.use('/api/papers', require('./routes/papers')); } catch {}
try { app.use('/api/materials', require('./routes/materials')); } catch {}
try { app.use('/api/users', require('./routes/users')); } catch {}

// 루트: index.html 반환 (SPA)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404
app.use((req, res) => res.status(404).json({ error: 'Not Found', path: req.path }));

// 에러 핸들러
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ 서버 시작: http://0.0.0.0:${PORT}`);
  console.log(`📦 ENV: ${process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV || 'local'}`);
});