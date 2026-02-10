const db = require('./db'); // mysql2/promise pool
const bcrypt = require('bcrypt');

async function initDb() {
  console.log('🔧 DB Init start');

  // 기본 테이블: 권한/사용자
  await db.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(50) NOT NULL UNIQUE,
      description VARCHAR(255)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role_id INT DEFAULT NULL,
      display_name VARCHAR(200),
      email VARCHAR(200),
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 거래처 / 고객
  await db.query(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      contact VARCHAR(200),
      phone VARCHAR(50),
      email VARCHAR(200),
      address TEXT,
      meta JSON DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY ux_suppliers_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      contact VARCHAR(200),
      phone VARCHAR(50),
      email VARCHAR(200),
      address TEXT,
      meta JSON DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY ux_customers_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 용지 / 합지 / 자재
  await db.query(`
    CREATE TABLE IF NOT EXISTS papers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) NOT NULL,       -- ex: "SC", "SC 240"
      type VARCHAR(100) DEFAULT NULL,   -- ex: "SC"
      size VARCHAR(100) DEFAULT NULL,   -- ex: "240"
      weight VARCHAR(100) DEFAULT NULL,
      description TEXT,
      meta JSON DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY ux_papers_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS materials (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      type VARCHAR(100),
      unit VARCHAR(50),
      note TEXT,
      meta JSON DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY ux_materials_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 제품 및 구성
  await db.query(`
    CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(100),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      price DECIMAL(13,2) DEFAULT 0,
      supplier_id INT,
      paper_id INT,
      created_by INT,
      meta JSON DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
      FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS product_materials (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_id INT NOT NULL,
      material_id INT NOT NULL,
      quantity DECIMAL(13,3) DEFAULT 0,
      unit VARCHAR(50),
      note TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE RESTRICT,
      UNIQUE KEY ux_product_material (product_id, material_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 재고 / 입출고 기록
  await db.query(`
    CREATE TABLE IF NOT EXISTS inventory (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_id INT,
      quantity DECIMAL(13,3) DEFAULT 0,
      unit VARCHAR(50),
      location VARCHAR(200),
      meta JSON DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS stock_movements (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_id INT,
      change DECIMAL(13,3),
      before_qty DECIMAL(13,3),
      after_qty DECIMAL(13,3),
      type VARCHAR(50), -- in/out/adjust/production
      reference VARCHAR(200),
      actor_id INT,
      note TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
      FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 공정별 이벤트(생산/불량 등)
  await db.query(`
    CREATE TABLE IF NOT EXISTS process_events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_id INT,
      order_id INT DEFAULT NULL,
      process_code VARCHAR(100), -- ex: 'cutting','printing'
      process_name VARCHAR(200),
      produced INT DEFAULT 0,
      defective INT DEFAULT 0,
      good_qty INT GENERATED ALWAYS AS (produced - defective) VIRTUAL,
      actor_id INT,
      actor_name VARCHAR(200),
      notes TEXT,
      meta JSON DEFAULT NULL,
      occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
      FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 주문 / 출하 (기본)
  await db.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customer_id INT,
      code VARCHAR(100),
      status VARCHAR(50),
      total DECIMAL(13,2) DEFAULT 0,
      meta JSON DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      product_id INT NOT NULL,
      qty INT DEFAULT 0,
      unit_price DECIMAL(13,2) DEFAULT 0,
      meta JSON DEFAULT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 감사 / 로그
  await db.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      actor_id INT,
      actor_name VARCHAR(200),
      action VARCHAR(100),
      entity VARCHAR(100),
      entity_id INT,
      payload JSON,
      ip VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 파일 첨부 메타
  await db.query(`
    CREATE TABLE IF NOT EXISTS attachments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      filename VARCHAR(255),
      path VARCHAR(1024),
      size INT,
      mime VARCHAR(100),
      meta JSON DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 권한 매핑(선택적)
  await db.query(`
    CREATE TABLE IF NOT EXISTS permissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) NOT NULL UNIQUE,
      description VARCHAR(255)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id INT NOT NULL,
      permission_id INT NOT NULL,
      PRIMARY KEY (role_id, permission_id),
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
      FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 기본 데이터 시드
  await db.query(`INSERT IGNORE INTO roles (id, name, description) VALUES (1,'admin','관리자'),(2,'user','일반 사용자')`);

  // 관리자 계정 자동 생성 (환경변수 사용 권장)
  const adminUser = process.env.ADMIN_USERNAME || null;
  const adminPass = process.env.ADMIN_PASSWORD || null;
  if(adminUser && adminPass) {
    const hash = await bcrypt.hash(adminPass, 12);
    const [exists] = await db.query('SELECT id FROM users WHERE username = ? LIMIT 1', [adminUser]);
    if(!exists || exists.length === 0) {
      const [r] = await db.query('INSERT INTO users (username, password_hash, role_id, display_name) VALUES (?, ?, ?, ?)', [adminUser, hash, 1, 'Administrator']);
      console.log('🛡️ Admin created id=', r.insertId);
    } else {
      console.log('🛡️ Admin already exists');
    }
  } else {
    console.log('ℹ️ ADMIN_USERNAME/ADMIN_PASSWORD not set — skip admin creation');
  }

  console.log('✅ DB Init complete');
}

if (require.main === module) {
  initDb().then(()=>process.exit(0)).catch(err=>{
    console.error('DB init failed', err);
    process.exit(1);
  });
}

module.exports = initDb;