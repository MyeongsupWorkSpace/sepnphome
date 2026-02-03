<?php
session_start();

function db_config(): array {
  $cfg = [
    'host' => getenv('MYSQL_HOST') ?: 'localhost',
    'port' => getenv('MYSQL_PORT') ?: '3306',
    'db' => getenv('MYSQL_DB') ?: '',
    'user' => getenv('MYSQL_USER') ?: '',
    'pass' => getenv('MYSQL_PASS') ?: '',
    'charset' => getenv('MYSQL_CHARSET') ?: 'utf8mb4',
  ];
  $file = __DIR__ . '/db_config.php';
  if (is_file($file)) {
    $fileCfg = require $file;
    if (is_array($fileCfg)) {
      $cfg = array_merge($cfg, $fileCfg);
    }
  }
  return $cfg;
}

function use_json_fallback_config(): bool {
  // 환경변수로 폴백 강제
  $force = getenv('APP_USE_JSON');
  if ($force === '1' || $force === 'true') { return true; }
  // MySQL PDO 확장/드라이버 확인
  $hasExt = extension_loaded('pdo_mysql');
  $drivers = class_exists('PDO') ? PDO::getAvailableDrivers() : [];
  $hasDriver = in_array('mysql', $drivers, true);
  if (!$hasExt || !$hasDriver) return true;
  // DB 설정 누락 시 폴백
  $cfg = db_config();
  if (($cfg['db'] ?? '') === '' || ($cfg['user'] ?? '') === '' || ($cfg['pass'] ?? '') === '') {
    return true;
  }
  return false;
}

function use_json_fallback(): bool {
  if (use_json_fallback_config()) return true;
  $pdo = get_db();
  return !($pdo instanceof PDO);
}

function db_path(): string {
  $base = dirname(__DIR__);
  $dataDir = $base . DIRECTORY_SEPARATOR . 'data';
  if (!is_dir($dataDir)) { @mkdir($dataDir, 0777, true); }
  return $dataDir . DIRECTORY_SEPARATOR . 'app.db';
}

function get_db(): PDO {
  static $pdo = null;
  static $failed = false;
  if ($pdo instanceof PDO) return $pdo;
  if ($failed) return $pdo;
  // 드라이버가 없으면 즉시 폴백 경로 사용
  if (use_json_fallback_config()) {
    return $pdo; // null 반환
  }
  $cfg = db_config();
  try {
    $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=%s', $cfg['host'], $cfg['port'], $cfg['db'], $cfg['charset']);
    $pdo = new PDO($dsn, $cfg['user'], $cfg['pass'], [
      PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
      PDO::ATTR_TIMEOUT => 3,
    ]);
  } catch (Throwable $e) {
    // JSON 폴백 사용
    $failed = true;
    return $pdo; // null 유지로 호출부에서 폴백 경로로 처리
  }
  migrate($pdo);
  seed_coupons($pdo);
  seed_admin($pdo);
  seed_sample_data($pdo);
  return $pdo;
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

  $pdo->exec('CREATE TABLE IF NOT EXISTS `board_posts` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `category` VARCHAR(64) NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `secret` TINYINT(1) DEFAULT 0,
    `author` VARCHAR(191) NULL,
    `name` VARCHAR(191) NULL,
    `phone` VARCHAR(64) NULL,
    `order_no` VARCHAR(64) NULL,
    `author_username` VARCHAR(191) NOT NULL,
    `status` VARCHAR(32) DEFAULT "문의중",
    `password_hash` VARCHAR(255) NULL,
    `attachments_json` TEXT NULL,
    `views` INT DEFAULT 0,
    `timestamp` BIGINT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

  $pdo->exec('CREATE TABLE IF NOT EXISTS `coupons` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `code` VARCHAR(64) NOT NULL UNIQUE,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(255) NULL,
    `created_at` INT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

  $pdo->exec('CREATE TABLE IF NOT EXISTS `user_coupons` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNSIGNED NOT NULL,
    `coupon_id` INT UNSIGNED NOT NULL,
    `qty` INT NOT NULL DEFAULT 0,
    `created_at` INT,
    `updated_at` INT,
    UNIQUE KEY `uniq_user_coupon` (`user_id`, `coupon_id`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

  // 기존 테이블에 새 컬럼 추가
  try {
    $cols = [];
    $stmt = $pdo->query('SHOW COLUMNS FROM `quotes`');
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) { $cols[] = $r['Field']; }
    $need = [
      'qty INT', 'length VARCHAR(32)', 'width VARCHAR(32)', 'height VARCHAR(32)', 'finishing TEXT', 'finishing_detail TEXT'
    ];
    foreach ($need as $def) {
      $name = explode(' ', $def)[0];
      if (!in_array($name, $cols, true)) {
        $pdo->exec('ALTER TABLE `quotes` ADD COLUMN ' . $def);
      }
    }
  } catch (Throwable $e) { /* ignore */ }
}

function seed_coupons(PDO $pdo): void {
  try {
    $count = (int)$pdo->query('SELECT COUNT(*) FROM `coupons`')->fetchColumn();
  } catch (Throwable $e) {
    return;
  }
  if ($count > 0) return;
  $now = time();
  $stmt = $pdo->prepare('INSERT INTO `coupons`(`code`,`title`,`description`,`created_at`) VALUES(:code,:title,:desc,:ts)');
  $defaults = [
    ['code' => 'DIEFREE', 'title' => '목형비 면제 쿠폰', 'desc' => '목형비 1회 면제'],
    ['code' => 'FREESAMPLE', 'title' => '무료 샘플링 쿠폰', 'desc' => '샘플 제작 1회 무료'],
  ];
  foreach ($defaults as $c) {
    $stmt->execute([
      ':code' => $c['code'],
      ':title' => $c['title'],
      ':desc' => $c['desc'],
      ':ts' => $now,
    ]);
  }
}

function grant_default_coupons(PDO $pdo, int $userId): void {
  try {
    $codes = ['DIEFREE', 'FREESAMPLE'];
    $stmt = $pdo->prepare('SELECT `id`, `code` FROM `coupons` WHERE `code` IN ("DIEFREE","FREESAMPLE")');
    $stmt->execute();
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $map = [];
    foreach ($rows as $r) { $map[$r['code']] = (int)$r['id']; }
    $now = time();
    $ins = $pdo->prepare('INSERT INTO `user_coupons`(`user_id`,`coupon_id`,`qty`,`created_at`,`updated_at`) VALUES(:uid,:cid,:qty,:ts,:ts) ON DUPLICATE KEY UPDATE `qty` = `qty` + VALUES(`qty`), `updated_at` = VALUES(`updated_at`)');
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
  if (!$exists) {
    $hash = password_hash('0536', PASSWORD_DEFAULT);
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
  }
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
      $sql = "SELECT id FROM user_coupons WHERE user_id=? AND coupon_id=? AND qty > 0";
      $stmt = $pdo->prepare($sql);
      $stmt->execute([$user_id, $coupon_id]);
      if ($stmt->fetch()) {
          return ["error" => "already granted"];
      }
      $now = time();
      $sql = "INSERT INTO user_coupons (user_id, coupon_id, qty, created_at, updated_at) VALUES (?, ?, 1, ?, ?) ON DUPLICATE KEY UPDATE qty = qty + 1, updated_at = VALUES(updated_at)";
      $stmt = $pdo->prepare($sql);
      $stmt->execute([$user_id, $coupon_id, $now, $now]);
      return ["success" => true];
  }

  function revokeUserCoupon($user_coupon_id) {
      $pdo = get_db();
      if (!($pdo instanceof PDO)) return ["error" => "DB unavailable"];
      $sql = "UPDATE user_coupons SET qty = qty - 1, updated_at = ? WHERE id = ? AND qty > 0";
      $stmt = $pdo->prepare($sql);
      $stmt->execute([time(), $user_coupon_id]);
      if ($stmt->rowCount() > 0) {
          return ["success" => true];
      }
      return ["error" => "not found or already revoked"];
  }

  function getUserCoupons($user_id) {
      $pdo = get_db();
      if (!($pdo instanceof PDO)) return [];
      $sql = "SELECT uc.id as user_coupon_id, c.id as coupon_id, c.code as coupon_code, c.title as coupon_name, uc.qty, uc.created_at, uc.updated_at FROM user_coupons uc JOIN coupons c ON uc.coupon_id = c.id WHERE uc.user_id=? ORDER BY uc.created_at DESC";
      $stmt = $pdo->prepare($sql);
      $stmt->execute([$user_id]);
      return $stmt->fetchAll(PDO::FETCH_ASSOC);
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
    ['code' => 'DIEFREE', 'title' => '목형비 면제 쿠폰', 'description' => '목형비 1회 면제'],
    ['code' => 'FREESAMPLE', 'title' => '무료 샘플링 쿠폰', 'description' => '샘플 제작 1회 무료'],
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
      $updated = true;
      break;
    }
  }
  unset($r);
  if (!$updated) {
    $rows[] = ['username' => $username, 'coupon_code' => $couponCode, 'qty' => $qty];
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
  foreach ($rows as $r) {
    if (($r['username'] ?? '') !== $username) continue;
    $code = (string)($r['coupon_code'] ?? '');
    $def = $map[$code] ?? ['code'=>$code,'title'=>$code,'description'=>''];
    $out[] = [
      'code' => $def['code'] ?? $code,
      'title' => $def['title'] ?? $code,
      'description' => $def['description'] ?? '',
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
  return $u ?: null;
}

function current_user_json(): ?array {
  $name = $_SESSION['user_name'] ?? null;
  if (!$name) return null;
  return json_user_find((string)$name);
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

?>
