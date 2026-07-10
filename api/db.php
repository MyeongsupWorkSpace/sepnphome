<?php
// Fail fast to avoid socket pile-ups on slow or stuck requests.
@ini_set('default_socket_timeout', '5');
@ini_set('max_execution_time', '10');
@set_time_limit(10);

if (!defined('SEPNP_NO_SESSION') || SEPNP_NO_SESSION !== true) {
  session_start();
  // Release session lock ASAP to prevent request queueing.
  register_shutdown_function(function () {
    if (session_status() === PHP_SESSION_ACTIVE) {
      @session_write_close();
    }
  });
}

// Allow local dev frontends (e.g., 127.0.0.1:5501) to call PHP APIs.
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
  http_response_code(204);
  exit;
}

function sepnp_log_access(): void {
  if (php_sapi_name() === 'cli') {
    return;
  }
  $base = dirname(__DIR__);
  $logDir = $base . DIRECTORY_SEPARATOR . 'logs';
  if (!is_dir($logDir)) {
    @mkdir($logDir, 0777, true);
  }

  $dateKey = date('Y-m-d');
  $logFile = $logDir . DIRECTORY_SEPARATOR . 'access-' . $dateKey . '.log';
  $ip = $_SERVER['REMOTE_ADDR'] ?? '';
  $method = $_SERVER['REQUEST_METHOD'] ?? '';
  $uri = $_SERVER['REQUEST_URI'] ?? '';
  $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
  $line = date('c') . "\t" . $ip . "\t" . $method . "\t" . $uri . "\t" . $ua . "\n";
  @file_put_contents($logFile, $line, FILE_APPEND | LOCK_EX);

  static $lastCleanup = '';
  if ($lastCleanup !== $dateKey) {
    $lastCleanup = $dateKey;
    $cutoff = strtotime('-30 days');
    foreach (glob($logDir . DIRECTORY_SEPARATOR . 'access-*.log') as $file) {
      if (!preg_match('/access-(\d{4}-\d{2}-\d{2})\.log$/', $file, $m)) {
        continue;
      }
      $ts = strtotime($m[1]);
      if ($ts !== false && $ts < $cutoff) {
        @unlink($file);
      }
    }
  }
}

if (!defined('SEPNP_ACCESS_LOGGED')) {
  define('SEPNP_ACCESS_LOGGED', true);
  sepnp_log_access();
}

function db_config(): array {
  $cfg = [
    'host' => 'localhost',
    'port' => '3306',
    'db' => '',
    'user' => '',
    'pass' => '',
    'charset' => getenv('MYSQL_CHARSET') ?: 'utf8mb4',
  ];
  $file = __DIR__ . '/db_config.php';
  if (is_file($file)) {
    $fileCfg = require $file;
    if (is_array($fileCfg)) {
      $cfg = array_merge($cfg, $fileCfg);
    }
  }

  // Environment variables override file config for deployment/runtime flexibility.
  $envHost = getenv('MYSQL_HOST') ?: getenv('MYSQLHOST');
  $envPort = getenv('MYSQL_PORT') ?: getenv('MYSQLPORT');
  $envDb = getenv('MYSQL_DB') ?: getenv('MYSQLDATABASE');
  $envUser = getenv('MYSQL_USER') ?: getenv('MYSQLUSER');
  $envPass = getenv('MYSQL_PASS') ?: getenv('MYSQLPASSWORD');
  $envCharset = getenv('MYSQL_CHARSET');

  if ($envHost !== false && $envHost !== '') $cfg['host'] = $envHost;
  if ($envPort !== false && $envPort !== '') $cfg['port'] = $envPort;
  if ($envDb !== false && $envDb !== '') $cfg['db'] = $envDb;
  if ($envUser !== false && $envUser !== '') $cfg['user'] = $envUser;
  if ($envPass !== false && $envPass !== '') $cfg['pass'] = $envPass;
  if ($envCharset !== false && $envCharset !== '') $cfg['charset'] = $envCharset;

  return $cfg;
}

function use_json_fallback_config(): bool {
  $v = getenv('APP_USE_JSON');
  if ($v === false) return false;
  $v = strtolower(trim((string)$v));
  return in_array($v, ['1', 'true', 'yes', 'on'], true);
}

function has_pdo_mysql_driver(): bool {
  if (!class_exists('PDO')) return false;
  try {
    $drivers = PDO::getAvailableDrivers();
    return is_array($drivers) && in_array('mysql', $drivers, true);
  } catch (Throwable $e) {
    return false;
  }
}

function use_json_fallback(): bool {
  if (use_json_fallback_config()) return true;
  return !has_pdo_mysql_driver();
}

function db_path(): string {
  $base = dirname(__DIR__);
  $dataDir = $base . DIRECTORY_SEPARATOR . 'data';
  if (!is_dir($dataDir)) { @mkdir($dataDir, 0777, true); }
  return $dataDir . DIRECTORY_SEPARATOR . 'app.db';
}

function get_db(): PDO {
  static $pdo = null;
  if ($pdo instanceof PDO) return $pdo;
  $cfg = db_config();
  $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=%s;connect_timeout=3', $cfg['host'], $cfg['port'], $cfg['db'], $cfg['charset']);
  try {
    @ini_set('mysql.connect_timeout', '3');
    $options = [
      PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
      PDO::ATTR_TIMEOUT => 3,
    ];
    if (defined('PDO::MYSQL_ATTR_INIT_COMMAND')) {
      $options[PDO::MYSQL_ATTR_INIT_COMMAND] = 'SET SESSION MAX_EXECUTION_TIME=3000';
    }
    $pdo = new PDO($dsn, $cfg['user'], $cfg['pass'], $options);
    try { $pdo->query('SET SESSION innodb_lock_wait_timeout=3'); } catch (Throwable $e) { /* ignore */ }
    bootstrap_db($pdo);
    return $pdo;
  } catch (Throwable $e) {
    log_db_error($e, $cfg, $dsn);
    throw $e;
  }
}

function bootstrap_db(PDO $pdo): void {
  $base = dirname(__DIR__);
  $dataDir = $base . DIRECTORY_SEPARATOR . 'data';
  if (!is_dir($dataDir)) { @mkdir($dataDir, 0777, true); }
  $flag = $dataDir . DIRECTORY_SEPARATOR . '.db_bootstrap';
  $lock = $flag . '.lock';
  $ttl = 300;
  $now = time();
  $mtime = is_file($flag) ? @filemtime($flag) : 0;
  if ($mtime && ($now - $mtime) < $ttl) return;

  $fp = @fopen($lock, 'c');
  if ($fp) {
    if (@flock($fp, LOCK_EX | LOCK_NB)) {
      @file_put_contents($flag, (string)$now);
      migrate($pdo);
      seed_coupons($pdo);
      seed_admin($pdo);
      @flock($fp, LOCK_UN);
    }
    @fclose($fp);
    return;
  }

  migrate($pdo);
  seed_coupons($pdo);
  seed_admin($pdo);
  @file_put_contents($flag, (string)$now);
}

function log_db_error(Throwable $e, array $cfg, string $dsn): void {
  try {
    $base = dirname(__DIR__);
    $logDir = $base . DIRECTORY_SEPARATOR . 'logs';
    if (!is_dir($logDir)) {
      @mkdir($logDir, 0777, true);
    }
    $logFile = $logDir . DIRECTORY_SEPARATOR . 'db-error.log';
    $line = implode(' | ', [
      date('c'),
      'db_connect_error',
      'host=' . ($cfg['host'] ?? ''),
      'port=' . ($cfg['port'] ?? ''),
      'db=' . ($cfg['db'] ?? ''),
      'user=' . ($cfg['user'] ?? ''),
      'dsn=' . $dsn,
      'msg=' . $e->getMessage(),
    ]) . "\n";
    @file_put_contents($logFile, $line, FILE_APPEND | LOCK_EX);
  } catch (Throwable $ignore) {
    // ignore logging failures
  }
}

function migrate(PDO $pdo): void {
  $pdo->exec('CREATE TABLE IF NOT EXISTS `users` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(191) NOT NULL UNIQUE,
    `password_hash` VARCHAR(255) NOT NULL,
    `nickname` VARCHAR(191) NULL,
    `rank` VARCHAR(32) DEFAULT "Bronze",
    `role` VARCHAR(32) DEFAULT "user",
    `status` VARCHAR(32) DEFAULT "승인대기",
    `created_at` INT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

  $pdo->exec('CREATE TABLE IF NOT EXISTS `quotes` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(191) NULL,
    `company` VARCHAR(191) NULL,
    `position` VARCHAR(191) NULL,
    `product` VARCHAR(191) NULL,
    `message` TEXT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(64) NULL,
    `qty` INT NULL,
    `length` VARCHAR(32) NULL,
    `width` VARCHAR(32) NULL,
    `height` VARCHAR(32) NULL,
    `finishing` TEXT NULL,
    `finishing_detail` TEXT NULL,
    `status` VARCHAR(32) DEFAULT "문의중",
    `timestamp` INT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

  $pdo->exec('CREATE TABLE IF NOT EXISTS `notices` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `category` VARCHAR(64) NULL,
    `title` VARCHAR(191) NOT NULL,
    `summary` VARCHAR(255) NULL,
    `content` MEDIUMTEXT NULL,
    `notice_date` VARCHAR(32) NULL,
    `is_pinned` TINYINT(1) DEFAULT 0,
    `attachments_json` TEXT NULL,
    `views` INT DEFAULT 0,
    `created_at` INT,
    `updated_at` INT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

  $pdo->exec('CREATE TABLE IF NOT EXISTS `site_settings` (
    `id` TINYINT UNSIGNED NOT NULL PRIMARY KEY,
    `company` VARCHAR(191) NULL,
    `phone` VARCHAR(64) NULL,
    `address` TEXT NULL,
    `email` VARCHAR(191) NULL,
    `partner_email` VARCHAR(191) NULL,
    `delivery_address` TEXT NULL,
    `hours` VARCHAR(255) NULL,
    `hours_note` VARCHAR(255) NULL,
    `kakao_link` VARCHAR(255) NULL,
    `updated_at` INT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

  $pdo->exec('CREATE TABLE IF NOT EXISTS `main_ad_settings` (
    `id` TINYINT UNSIGNED NOT NULL PRIMARY KEY,
    `enabled` TINYINT(1) DEFAULT 1,
    `title` VARCHAR(191) NULL,
    `message` TEXT NULL,
    `updated_at` INT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

  $pdo->exec('CREATE TABLE IF NOT EXISTS `vendor_brands` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `slug` VARCHAR(64) NOT NULL UNIQUE,
    `name` VARCHAR(191) NOT NULL,
    `sort_order` INT DEFAULT 0,
    `created_at` INT NULL,
    `updated_at` INT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

  $pdo->exec('CREATE TABLE IF NOT EXISTS `vendor_products` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `brand_id` INT UNSIGNED NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(255) NULL,
    `image_url` VARCHAR(255) NULL,
    `sort_order` INT DEFAULT 0,
    `created_at` INT NULL,
    `updated_at` INT NULL,
    INDEX (`brand_id`),
    CONSTRAINT `fk_vendor_products_brand` FOREIGN KEY (`brand_id`) REFERENCES `vendor_brands`(`id`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

  $pdo->exec('CREATE TABLE IF NOT EXISTS `coupons` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `code` VARCHAR(64) NOT NULL UNIQUE,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(255) NULL,
    `expires_at` INT NULL,
    `created_at` INT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

  $pdo->exec('CREATE TABLE IF NOT EXISTS `user_coupons` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNSIGNED NOT NULL,
    `coupon_id` INT UNSIGNED NOT NULL,
    `qty` INT NOT NULL DEFAULT 0,
    `granted_at` INT NULL,
    `revoked_at` INT NULL,
    `created_at` INT,
    `updated_at` INT,
    UNIQUE KEY `uniq_user_coupon` (`user_id`, `coupon_id`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

  // ===== ERP state tables =====
  $pdo->exec('CREATE TABLE IF NOT EXISTS `portal_kv` (
    `kv_key` VARCHAR(191) NOT NULL PRIMARY KEY,
    `data_json` MEDIUMTEXT NULL,
    `updated_at` BIGINT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

  $pdo->exec('CREATE TABLE IF NOT EXISTS `portal_erp_rows` (
    `section_key` VARCHAR(191) NOT NULL,
    `row_no` INT UNSIGNED NOT NULL,
    `data_json` MEDIUMTEXT NULL,
    `created_at` BIGINT NULL,
    `updated_at` BIGINT NULL,
    PRIMARY KEY (`section_key`, `row_no`),
    INDEX (`updated_at`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

  $pdo->exec('CREATE TABLE IF NOT EXISTS `production_state_store` (
    `id` TINYINT UNSIGNED NOT NULL PRIMARY KEY,
    `state_json` MEDIUMTEXT NULL,
    `updated_by_user_id` INT UNSIGNED NULL,
    `created_at` BIGINT NULL,
    `updated_at` BIGINT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

  // 기존 테이블에 새 컬럼 추가
  try {
    $cols = [];
    $stmt = $pdo->query('SHOW COLUMNS FROM `quotes`');
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) { $cols[] = $r['Field']; }
    $need = [
      'company VARCHAR(191)',
      'position VARCHAR(191)',
      'qty INT',
      'length VARCHAR(32)',
      'width VARCHAR(32)',
      'height VARCHAR(32)',
      'finishing TEXT',
      'finishing_detail TEXT'
    ];
    foreach ($need as $def) {
      $name = explode(' ', $def)[0];
      if (!in_array($name, $cols, true)) {
        $pdo->exec('ALTER TABLE `quotes` ADD COLUMN ' . $def);
      }
    }
  } catch (Throwable $e) { /* ignore */ }

  try { $pdo->exec('ALTER TABLE `notices` ADD COLUMN `attachments_json` TEXT NULL'); } catch (Throwable $e) { /* ignore */ }
  try { $pdo->exec('ALTER TABLE `coupons` ADD COLUMN `expires_at` INT NULL'); } catch (Throwable $e) { /* ignore */ }
  try { $pdo->exec('ALTER TABLE `user_coupons` ADD COLUMN `granted_at` INT NULL'); } catch (Throwable $e) { /* ignore */ }
  try { $pdo->exec('ALTER TABLE `user_coupons` ADD COLUMN `revoked_at` INT NULL'); } catch (Throwable $e) { /* ignore */ }
}

function seed_coupons(PDO $pdo): void {
  try {
    $count = (int)$pdo->query('SELECT COUNT(*) FROM `coupons`')->fetchColumn();
  } catch (Throwable $e) {
    return;
  }
  if ($count > 0) return;
  $now = time();
  $stmt = $pdo->prepare('INSERT INTO `coupons`(`code`,`title`,`description`,`expires_at`,`created_at`) VALUES(:code,:title,:desc,:exp,:ts)');
  $defaults = [
    ['code' => 'DIEFREE', 'title' => '목형비 면제 쿠폰', 'desc' => '목형비 1회 면제'],
    ['code' => 'FREESAMPLE', 'title' => '무료 샘플링 쿠폰', 'desc' => '샘플 제작 1회 무료'],
  ];
  foreach ($defaults as $c) {
    $stmt->execute([
      ':code' => $c['code'],
      ':title' => $c['title'],
      ':desc' => $c['desc'],
      ':exp' => null,
      ':ts' => $now,
    ]);
  }
}

function grant_default_coupons(PDO $pdo, int $userId): void {
  try {
    $codes = ['DIEFREE', 'FREESAMPLE'];
    $stmt = $pdo->prepare('SELECT `id`, `code` FROM `coupons` WHERE `code` IN ("DIEFREE","FREESAMPLE") AND (`expires_at` IS NULL OR `expires_at` >= :now)');
    $stmt->execute([':now' => time()]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $map = [];
    foreach ($rows as $r) { $map[$r['code']] = (int)$r['id']; }
    $now = time();
    $ins = $pdo->prepare('INSERT INTO `user_coupons`(`user_id`,`coupon_id`,`qty`,`granted_at`,`created_at`,`updated_at`) VALUES(:uid,:cid,:qty,:ts,:ts,:ts) ON DUPLICATE KEY UPDATE `qty` = `qty` + VALUES(`qty`), `granted_at` = VALUES(`granted_at`), `updated_at` = VALUES(`updated_at`)');
    foreach ($codes as $code) {
      if (!isset($map[$code])) continue;
      $ins->execute([
        ':uid' => $userId,
        ':cid' => $map[$code],
        ':qty' => 1,
        ':ts' => $now,
      ]);
    }
  } catch (Throwable $e) {
    // ignore
  }
}

function seed_admin(PDO $pdo): void {
  $stmt = $pdo->prepare('SELECT `id` FROM `users` WHERE `username` = :u LIMIT 1');
  $stmt->execute([':u' => 'sepnp']);
  $exists = $stmt->fetchColumn();
  $hash = password_hash('0536', PASSWORD_DEFAULT);
  if (!$exists) {
    $pdo->prepare('INSERT INTO `users`(`username`, `password_hash`, `nickname`, `rank`, `role`, `status`, `created_at`) VALUES(:u, :p, :n, :r, :role, :s, :ts)')
      ->execute([
        ':u' => 'sepnp',
        ':p' => $hash,
        ':n' => '관리자',
        ':r' => 'Master',
        ':role' => 'admin',
        ':s' => '승인완료',
        ':ts' => time(),
      ]);
    return;
  }

  $pdo->prepare('UPDATE `users` SET `password_hash` = :p, `nickname` = :n, `rank` = :r, `role` = :role, `status` = :s WHERE `username` = :u')
    ->execute([
      ':u' => 'sepnp',
      ':p' => $hash,
      ':n' => '관리자',
      ':r' => 'Master',
      ':role' => 'admin',
      ':s' => '승인완료',
    ]);
}

function seed_sample_data(PDO $pdo): void {
  try {
    $userCount = (int)$pdo->query('SELECT COUNT(*) FROM `users`')->fetchColumn();
  } catch (Throwable $e) {
    return;
  }
  if ($userCount <= 1) {
    $users = [
      ['username' => 'user1', 'nickname' => '김서연', 'rank' => 'Silver', 'role' => 'user', 'status' => '승인완료'],
      ['username' => 'user2', 'nickname' => '박준호', 'rank' => 'Normal', 'role' => 'user', 'status' => '승인완료'],
      ['username' => 'user3', 'nickname' => '이하나', 'rank' => 'Bronze', 'role' => 'user', 'status' => '승인완료'],
    ];
    $stmt = $pdo->prepare('INSERT INTO `users`(`username`,`password_hash`,`nickname`,`rank`,`role`,`status`,`created_at`) VALUES(:u,:ph,:n,:r,:role,:s,:ts)');
    foreach ($users as $u) {
      $stmt->execute([
        ':u' => $u['username'],
        ':ph' => password_hash('password123', PASSWORD_DEFAULT),
        ':n' => $u['nickname'],
        ':r' => $u['rank'],
        ':role' => $u['role'],
        ':s' => $u['status'],
        ':ts' => time(),
      ]);
      $newId = (int)$pdo->lastInsertId();
      if ($newId > 0) {
        grant_default_coupons($pdo, $newId);
      }
    }
  }

  try {
    $quoteCount = (int)$pdo->query('SELECT COUNT(*) FROM `quotes`')->fetchColumn();
  } catch (Throwable $e) {
    return;
  }
  if ($quoteCount === 0) {
    $quotes = [
      [
        'name' => '임시 고객',
        'email' => 'temp@sepnp.com',
        'phone' => '010-1234-5678',
        'product' => '고급 패키지 박스',
        'message' => '리본 인쇄 및 코팅 포함 문의드립니다.',
        'qty' => 500,
        'length' => '180',
        'width' => '120',
        'height' => '60',
        'finishing' => '코팅,금박',
        'finishing_detail' => '코팅:무광CR | 금박:30x12mm',
      ],
      [
        'name' => '김민지',
        'email' => 'mj.kim@example.com',
        'phone' => '010-5555-1111',
        'product' => '단상자(쇼핑백 포함)',
        'message' => '샘플 제작 가능 여부와 납기 문의드립니다.',
        'qty' => 2000,
        'length' => '120',
        'width' => '80',
        'height' => '150',
        'finishing' => '코팅,형압',
        'finishing_detail' => '코팅:유광CR | 형압:20x20mm',
      ],
      [
        'name' => '박도현',
        'email' => 'dh.park@example.com',
        'phone' => '010-2222-3333',
        'product' => '골판지 박스',
        'message' => '대량 발주 견적 요청드립니다.',
        'qty' => 5000,
        'length' => '300',
        'width' => '200',
        'height' => '180',
        'finishing' => '없음',
        'finishing_detail' => '',
      ],
    ];
    $stmt = $pdo->prepare('INSERT INTO `quotes`(`name`,`email`,`phone`,`product`,`message`,`qty`,`length`,`width`,`height`,`finishing`,`finishing_detail`,`status`,`timestamp`) VALUES(:name,:email,:phone,:product,:message,:qty,:length,:width,:height,:finishing,:finishing_detail,:status,:ts)');
    foreach ($quotes as $q) {
      $stmt->execute([
        ':name' => $q['name'],
        ':email' => $q['email'],
        ':phone' => $q['phone'],
        ':product' => $q['product'],
        ':message' => $q['message'],
        ':qty' => $q['qty'],
        ':length' => $q['length'],
        ':width' => $q['width'],
        ':height' => $q['height'],
        ':finishing' => $q['finishing'],
        ':finishing_detail' => $q['finishing_detail'],
        ':status' => '문의중',
        ':ts' => time(),
      ]);
    }
  }

  try {
    $brandCount = (int)$pdo->query('SELECT COUNT(*) FROM `vendor_brands`')->fetchColumn();
  } catch (Throwable $e) {
    $brandCount = 0;
  }
  if ($brandCount === 0) {
    $now = time();
    $brands = [
      ['slug' => 'lotte', 'name' => '롯데', 'sort' => 1],
      ['slug' => 'nongshim', 'name' => '농심', 'sort' => 2],
      ['slug' => 'crown', 'name' => '크라운', 'sort' => 3],
      ['slug' => 'nestle', 'name' => '네슬레', 'sort' => 4],
    ];
    $stmtBrand = $pdo->prepare('INSERT INTO `vendor_brands`(`slug`,`name`,`sort_order`,`created_at`,`updated_at`) VALUES(:slug,:name,:sort,:created_at,:updated_at)');
    $brandIds = [];
    foreach ($brands as $b) {
      $stmtBrand->execute([
        ':slug' => $b['slug'],
        ':name' => $b['name'],
        ':sort' => $b['sort'],
        ':created_at' => $now,
        ':updated_at' => $now,
      ]);
      $brandIds[$b['slug']] = (int)$pdo->lastInsertId();
    }

    $products = [
      [
        'brand' => 'lotte',
        'name' => 'ABC초코쿠키 오리지널',
        'desc' => '',
        'img' => '/assets/img/%EB%A1%AF%EB%8D%B0/ABC%EC%B4%88%EC%BD%94%EC%BF%A0%ED%82%A4%20%EC%98%A4%EB%A6%AC%EC%A7%80%EB%84%90.png',
        'sort' => 1,
      ],
      [
        'brand' => 'lotte',
        'name' => '가나 마일드',
        'desc' => '',
        'img' => '/assets/img/%EB%A1%AF%EB%8D%B0/%EA%B0%80%EB%82%98%20%EB%A7%88%EC%9D%BC%EB%93%9C.png',
        'sort' => 2,
      ],
      [
        'brand' => 'nongshim',
        'name' => '카프리썬 오렌지',
        'desc' => '',
        'img' => '/assets/img/%EB%86%8D%EC%8B%AC/%EC%B9%B4%ED%94%84%EB%A6%AC%EC%8D%AC%20%EC%98%A4%EB%A0%8C%EC%A7%80.jpg',
        'sort' => 1,
      ],
      [
        'brand' => 'nongshim',
        'name' => '카프리썬 오렌지망고',
        'desc' => '',
        'img' => '/assets/img/%EB%86%8D%EC%8B%AC/%EC%B9%B4%ED%94%84%EB%A6%AC%EC%8D%AC%20%EC%98%A4%EB%A0%8C%EC%A7%80%EB%A7%9D%EA%B3%A0.jpg',
        'sort' => 2,
      ],
      [
        'brand' => 'crown',
        'name' => '빅파이 딸기',
        'desc' => '',
        'img' => '/assets/img/%ED%81%AC%EB%9D%BC%EC%9A%B4/%EB%B9%85%ED%8C%8C%EC%9D%B4%20%EB%94%B8%EA%B8%B0.jpg',
        'sort' => 1,
      ],
      [
        'brand' => 'crown',
        'name' => '참크래커',
        'desc' => '',
        'img' => '/assets/img/%ED%81%AC%EB%9D%BC%EC%9A%B4/%EC%B0%B8%ED%81%AC%EB%9E%98%EC%BB%A4.jpg',
        'sort' => 2,
      ],
      [
        'brand' => 'nestle',
        'name' => '스타벅스 미디엄로스트',
        'desc' => '',
        'img' => '/assets/img/%EB%84%A4%EC%8A%AC%EB%A0%88/%EC%8A%A4%ED%83%80%EB%B2%85%EC%8A%A4%20%EB%AF%B8%EB%94%94%EC%97%84%EB%A1%9C%EC%8A%A4%ED%8A%B8.webp',
        'sort' => 1,
      ],
      [
        'brand' => 'nestle',
        'name' => '네스카페 수프리모 아메리카노 블랙',
        'desc' => '',
        'img' => '/assets/img/%EB%84%A4%EC%8A%AC%EB%A0%88/%EB%84%A4%EC%8A%A4%EC%B9%B4%ED%8E%98%20%EC%88%98%ED%94%84%EB%A6%AC%EB%AA%A8%20%EC%95%84%EB%A9%94%EB%A6%AC%EC%B9%B4%EB%85%B8%20%EB%B8%94%EB%9E%99.webp',
        'sort' => 2,
      ],
    ];
    $stmtProduct = $pdo->prepare('INSERT INTO `vendor_products`(`brand_id`,`name`,`description`,`image_url`,`sort_order`,`created_at`,`updated_at`) VALUES(:brand_id,:name,:description,:image_url,:sort_order,:created_at,:updated_at)');
    foreach ($products as $p) {
      $bid = $brandIds[$p['brand']] ?? 0;
      if ($bid <= 0) continue;
      $stmtProduct->execute([
        ':brand_id' => $bid,
        ':name' => $p['name'],
        ':description' => $p['desc'],
        ':image_url' => $p['img'],
        ':sort_order' => $p['sort'],
        ':created_at' => $now,
        ':updated_at' => $now,
      ]);
    }
  }
}

function requireAdmin() {
  if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(["error" => "admin only"]);
    exit;
  }
}

function grantCouponToUser($user_id, $coupon_id) {
  $pdo = get_db();
  if (!($pdo instanceof PDO)) return ["error" => "DB unavailable"];
  $now = time();
  $sql = "INSERT INTO user_coupons (user_id, coupon_id, qty, granted_at, created_at, updated_at) VALUES (?, ?, 1, ?, ?, ?) ON DUPLICATE KEY UPDATE qty = qty + 1, granted_at = VALUES(granted_at), updated_at = VALUES(updated_at)";
  $stmt = $pdo->prepare($sql);
  $stmt->execute([$user_id, $coupon_id, $now, $now, $now]);
  return ["success" => true];
}

function revokeUserCoupon($user_coupon_id) {
  $pdo = get_db();
  if (!($pdo instanceof PDO)) return ["error" => "DB unavailable"];
  $sql = "UPDATE user_coupons SET qty = qty - 1, revoked_at = ?, updated_at = ? WHERE id = ? AND qty > 0";
  $stmt = $pdo->prepare($sql);
  $now = time();
  $stmt->execute([$now, $now, $user_coupon_id]);
  if ($stmt->rowCount() > 0) {
    return ["success" => true];
  }
  return ["error" => "not found or already revoked"];
}

function getUserCoupons($user_id) {
  $pdo = get_db();
  if (!($pdo instanceof PDO)) return [];
  $sql = "SELECT uc.id as user_coupon_id, c.id as coupon_id, c.code as coupon_code, c.title as coupon_name, c.expires_at, uc.qty, uc.granted_at, uc.revoked_at, uc.created_at, uc.updated_at FROM user_coupons uc JOIN coupons c ON uc.coupon_id = c.id WHERE uc.user_id=? ORDER BY uc.created_at DESC";
  $stmt = $pdo->prepare($sql);
  $stmt->execute([$user_id]);
  return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function json_out($data, int $code = 200): void {
  http_response_code($code);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
}

// --- JSON 폴백 스토리지 ---
function data_dir(): string {
  $base = dirname(__DIR__);
  $dataDir = $base . DIRECTORY_SEPARATOR . 'data';
  if (!is_dir($dataDir)) { @mkdir($dataDir, 0777, true); }
  return $dataDir;
}

function json_users_path(): string { return data_dir() . DIRECTORY_SEPARATOR . 'users.json'; }
function json_quotes_path(): string { return data_dir() . DIRECTORY_SEPARATOR . 'quotes.json'; }
function json_coupons_path(): string { return data_dir() . DIRECTORY_SEPARATOR . 'coupons.json'; }
function json_user_coupons_path(): string { return data_dir() . DIRECTORY_SEPARATOR . 'user_coupons.json'; }

function json_load(string $path): array {
  if (!is_file($path)) return [];
  $raw = @file_get_contents($path);
  $arr = $raw ? json_decode($raw, true) : [];
  return is_array($arr) ? $arr : [];
}

function json_save(string $path, array $data): void {
  @file_put_contents($path, json_encode($data, JSON_UNESCAPED_UNICODE));
}

function json_users_all(): array { return json_load(json_users_path()); }
function json_quotes_all(): array { return json_load(json_quotes_path()); }
function json_coupons_all(): array { return json_load(json_coupons_path()); }
function json_user_coupons_all(): array { return json_load(json_user_coupons_path()); }

function json_seed_coupons(): void {
  $rows = json_coupons_all();
  if ($rows && count($rows) > 0) return;
  $defaults = [
    ['code' => 'DIEFREE', 'title' => '목형비 면제 쿠폰', 'description' => '목형비 1회 면제', 'expires_at' => null],
    ['code' => 'FREESAMPLE', 'title' => '무료 샘플링 쿠폰', 'description' => '샘플 제작 1회 무료', 'expires_at' => null],
  ];
  json_save(json_coupons_path(), $defaults);
}

function json_user_coupon_add(string $username, string $couponCode, int $qty = 1): void {
  json_seed_coupons();
  $rows = json_user_coupons_all();
  $updated = false;
  foreach ($rows as &$r) {
    if (($r['username'] ?? '') === $username && ($r['coupon_code'] ?? '') === $couponCode) {
      $r['qty'] = (int)($r['qty'] ?? 0) + $qty;
      $r['granted_at'] = time();
      $updated = true;
      break;
    }
  }
  unset($r);
  if (!$updated) {
    $rows[] = ['username' => $username, 'coupon_code' => $couponCode, 'qty' => $qty, 'granted_at' => time(), 'revoked_at' => null];
  }
  json_save(json_user_coupons_path(), $rows);
}

function json_user_coupons(string $username): array {
  json_seed_coupons();
  $defs = json_coupons_all();
  $map = [];
  foreach ($defs as $d) { $map[$d['code']] = $d; }
  $rows = json_user_coupons_all();
  $out = [];
  $now = time();
  foreach ($rows as $r) {
    if (($r['username'] ?? '') !== $username) continue;
    $code = (string)($r['coupon_code'] ?? '');
    $def = $map[$code] ?? ['code'=>$code,'title'=>$code,'description'=>''];
    $expiresAt = $def['expires_at'] ?? null;
    if ($expiresAt && (int)$expiresAt < $now) continue;
    $out[] = [
      'code' => $def['code'] ?? $code,
      'title' => $def['title'] ?? $code,
      'description' => $def['description'] ?? '',
      'expires_at' => $expiresAt,
      'qty' => (int)($r['qty'] ?? 0),
    ];
  }
  return $out;
}

function json_user_find(string $username): ?array {
  $users = json_users_all();
  foreach ($users as $u) { if (($u['username'] ?? '') === $username) return $u; }
  return null;
}

function json_user_find_by_nickname(string $nickname): ?array {
  $nick = trim((string)$nickname);
  if ($nick === '') return null;
  $users = json_users_all();
  foreach ($users as $u) {
    if (($u['nickname'] ?? '') === $nick) return $u;
  }
  return null;
}

function json_user_add(string $username, string $password_hash, string $nickname, string $rank, string $role, string $status): array {
  $users = json_users_all();
  $id = 1;
  foreach ($users as $u) { $id = max($id, (int)($u['id'] ?? 0) + 1); }
  $entry = [
    'id' => $id,
    'username' => $username,
    'password_hash' => $password_hash,
    'nickname' => $nickname,
    'rank' => $rank,
    'role' => $role,
    'status' => $status,
    'created_at' => time(),
  ];
  // sepnp는 항상 관리자/Master/승인완료
  if (strtolower($username) === 'sepnp') {
    $entry['nickname'] = $nickname ?: '관리자';
    $entry['rank'] = 'Master';
    $entry['role'] = 'admin';
    $entry['status'] = '승인완료';
  }
  $users[] = $entry;
  json_save(json_users_path(), $users);
  return $entry;
}

function json_user_find_by_id(int $id): ?array {
  $users = json_users_all();
  foreach ($users as $u) { if ((int)($u['id'] ?? 0) === $id) return $u; }
  return null;
}

function json_user_update_status_all(string $status): int {
  $users = json_users_all();
  $cnt = 0;
  foreach ($users as &$u) { if (($u['status'] ?? '') !== $status) { $u['status'] = $status; $cnt++; } }
  unset($u);
  json_save(json_users_path(), $users);
  return $cnt;
}

function json_user_update_status_by_id(int $id, string $status): bool {
  $users = json_users_all();
  $updated = false;
  foreach ($users as &$u) {
    if ((int)($u['id'] ?? 0) === $id) { $u['status'] = $status; $updated = true; break; }
  }
  unset($u);
  if ($updated) json_save(json_users_path(), $users);
  return $updated;
}

function json_user_update_rank_by_id(int $id, string $rank): bool {
  $users = json_users_all();
  $updated = false;
  foreach ($users as &$u) {
    if ((int)($u['id'] ?? 0) === $id) { $u['rank'] = $rank; $updated = true; break; }
  }
  unset($u);
  if ($updated) json_save(json_users_path(), $users);
  return $updated;
}

function json_user_update_nickname_by_id(int $id, string $nickname): bool {
  $users = json_users_all();
  $updated = false;
  foreach ($users as &$u) {
    if ((int)($u['id'] ?? 0) === $id) { $u['nickname'] = $nickname; $updated = true; break; }
  }
  unset($u);
  if ($updated) json_save(json_users_path(), $users);
  return $updated;
}

function json_user_update_password_by_id(int $id, string $password_hash): bool {
  $users = json_users_all();
  $updated = false;
  foreach ($users as &$u) {
    if ((int)($u['id'] ?? 0) === $id) { $u['password_hash'] = $password_hash; $updated = true; break; }
  }
  unset($u);
  if ($updated) json_save(json_users_path(), $users);
  return $updated;
}

function json_user_delete_by_id(int $id): ?array {
  $users = json_users_all();
  $deleted = null;
  $out = [];
  foreach ($users as $u) {
    if ((int)($u['id'] ?? 0) === $id) {
      $deleted = $u;
      continue;
    }
    $out[] = $u;
  }
  if ($deleted) json_save(json_users_path(), $out);
  return $deleted;
}

function json_user_coupons_delete_by_username(string $username): void {
  $rows = json_user_coupons_all();
  $out = [];
  foreach ($rows as $r) {
    if (($r['username'] ?? '') === $username) continue;
    $out[] = $r;
  }
  json_save(json_user_coupons_path(), $out);
}

function json_quote_add(array $fields): array {
  $quotes = json_quotes_all();
  $id = 1;
  foreach ($quotes as $q) { $id = max($id, (int)($q['id'] ?? 0) + 1); }
  $entry = array_merge([
    'id' => $id,
    'status' => '문의중',
    'timestamp' => time(),
  ], $fields);
  $quotes[] = $entry;
  json_save(json_quotes_path(), $quotes);
  return $entry;
}

function current_user(PDO $pdo): ?array {
  if (!isset($_SESSION['user_id'])) return null;
  $stmt = $pdo->prepare('SELECT `id`, `username`, `nickname`, `rank`, `role`, `status` FROM `users` WHERE `id` = :id');
  $stmt->execute([':id' => $_SESSION['user_id']]);
  $u = $stmt->fetch(PDO::FETCH_ASSOC);
  if (session_status() === PHP_SESSION_ACTIVE) { @session_write_close(); }
  return $u ?: null;
}

function current_user_json(): ?array {
  $name = $_SESSION['user_name'] ?? null;
  if (!$name) return null;
  $u = json_user_find((string)$name);
  if (session_status() === PHP_SESSION_ACTIVE) { @session_write_close(); }
  return $u;
}

function require_admin(PDO $pdo): ?array {
  $u = current_user($pdo);
  if (!$u || $u['role'] !== 'admin') {
    json_out(['ok' => false, 'error' => 'forbidden'], 403);
    exit;
  }
  return $u;
}

function require_admin_json(): ?array {
  $u = current_user_json();
  if (!$u || ($u['role'] ?? '') !== 'admin') {
    json_out(['ok' => false, 'error' => 'forbidden'], 403);
    exit;
  }
  return $u;
}

function production_state_default(): array {
  return [
    'customers' => [],
    'products' => [],
    'dies' => [],
    'orders' => [],
    'workorders' => [],
    'shipments' => [],
    'counters' => [
      'customer' => 1,
      'product' => 1,
      'die' => 1,
      'order' => 1,
      'workorder' => 1,
      'shipment' => 1,
    ],
  ];
}

function normalize_production_state($state): array {
  $default = production_state_default();
  if (!is_array($state)) {
    return $default;
  }

  $normalized = [];
  foreach (['customers', 'products', 'dies', 'orders', 'workorders', 'shipments'] as $key) {
    $normalized[$key] = isset($state[$key]) && is_array($state[$key]) ? array_values($state[$key]) : [];
  }

  $counters = isset($state['counters']) && is_array($state['counters']) ? $state['counters'] : [];
  $normalized['counters'] = [];
  foreach ($default['counters'] as $key => $value) {
    $counterValue = (int)($counters[$key] ?? $value);
    $normalized['counters'][$key] = $counterValue > 0 ? $counterValue : $value;
  }

  return $normalized;
}

function production_state_get(PDO $pdo): array {
  try {
    $stmt = $pdo->query('SELECT `state_json` FROM `production_state_store` WHERE `id` = 1 LIMIT 1');
    $raw = $stmt->fetchColumn();
    if (!$raw) {
      return production_state_default();
    }
    $decoded = json_decode((string)$raw, true);
    return normalize_production_state($decoded);
  } catch (Throwable $e) {
    return production_state_default();
  }
}

function production_state_save(PDO $pdo, array $state, ?int $userId = null): array {
  $normalized = normalize_production_state($state);
  $now = time();
  $json = json_encode($normalized, JSON_UNESCAPED_UNICODE);
  $stmt = $pdo->prepare('INSERT INTO `production_state_store`(`id`,`state_json`,`updated_by_user_id`,`created_at`,`updated_at`) VALUES(1,:state,:uid,:ts,:ts) ON DUPLICATE KEY UPDATE `state_json` = VALUES(`state_json`), `updated_by_user_id` = VALUES(`updated_by_user_id`), `updated_at` = VALUES(`updated_at`)');
  $stmt->execute([
    ':state' => $json,
    ':uid' => $userId,
    ':ts' => $now,
  ]);
  return $normalized;
}

?>
