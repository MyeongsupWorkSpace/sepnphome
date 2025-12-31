<?php
session_start();

function use_json_fallback(): bool {
  // 환경변수로 폴백 강제
  $force = getenv('APP_USE_JSON');
  if ($force === '1' || $force === 'true') { return true; }
  // pdo_sqlite 확장 미로드 또는 드라이버 미존재 시 폴백
  $hasExt = extension_loaded('pdo_sqlite');
  $drivers = class_exists('PDO') ? PDO::getAvailableDrivers() : [];
  $hasDriver = in_array('sqlite', $drivers, true);
  return !$hasExt || !$hasDriver;
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
  $path = db_path();
  // 드라이버가 없으면 즉시 폴백 경로 사용
  if (use_json_fallback()) {
    return $pdo; // null 반환
  }
  try {
    $pdo = new PDO('sqlite:' . $path);
  } catch (Throwable $e) {
    // JSON 폴백 사용
    return $pdo; // null 유지로 호출부에서 폴백 경로로 처리
  }
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  migrate($pdo);
  seed_admin($pdo);
  return $pdo;
}

function migrate(PDO $pdo): void {
  $pdo->exec('CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    nickname TEXT,
    rank TEXT DEFAULT "Bronze",
    role TEXT DEFAULT "user",
    status TEXT DEFAULT "승인대기",
    created_at INTEGER
  )');
  $pdo->exec('CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    product TEXT,
    message TEXT,
    email TEXT,
    phone TEXT,
    status TEXT DEFAULT "문의중",
    timestamp INTEGER
  )');
}

function seed_admin(PDO $pdo): void {
  $stmt = $pdo->prepare('SELECT id FROM users WHERE username = :u LIMIT 1');
  $stmt->execute([':u' => 'sepnp']);
  $exists = $stmt->fetchColumn();
  if (!$exists) {
    $hash = password_hash('0536', PASSWORD_DEFAULT);
    $pdo->prepare('INSERT INTO users(username, password_hash, nickname, rank, role, status, created_at) VALUES(:u, :p, :n, :r, :role, :s, :ts)')
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

function json_user_find(string $username): ?array {
  $users = json_users_all();
  foreach ($users as $u) { if (($u['username'] ?? '') === $username) return $u; }
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
  $stmt = $pdo->prepare('SELECT id, username, nickname, rank, role, status FROM users WHERE id = :id');
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
