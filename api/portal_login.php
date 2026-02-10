<?php
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

$raw = file_get_contents('php://input');
$in = $raw ? json_decode($raw, true) : $_POST;
if (!is_array($in)) { $in = []; }
$loginId = trim((string)($in['loginId'] ?? $in['username'] ?? ''));
$password = (string)($in['password'] ?? '');
if ($loginId === '' || $password === '') { json_out(['ok'=>false,'msg'=>'ID와 비밀번호를 입력하세요.'], 400); return; }

if (use_json_fallback()) {
  $rows = json_portal_all('employees');
  // seed admin if missing
  $hasAdmin = false;
  foreach ($rows as $r) { if (($r['username'] ?? '') === 'sepnp') { $hasAdmin = true; break; } }
  if (!$hasAdmin) {
    $rows[] = [
      'id' => json_portal_next_id($rows),
      'empNo' => 'ADMIN',
      'username' => 'sepnp',
      'password_hash' => password_hash('0536', PASSWORD_DEFAULT),
      'name' => '관리자',
      'dept' => '관리부',
      'position' => '관리자',
      'phone' => '',
      'email' => '',
      'joinDate' => date('Y-m-d'),
      'status' => 'active',
      'role' => 'admin',
      'perms' => ['*'],
      'created_at' => time(),
    ];
    json_portal_save('employees', $rows);
  }
  $emp = null;
  foreach ($rows as $r) {
    if (($r['username'] ?? '') === $loginId || ($r['empNo'] ?? '') === $loginId) { $emp = $r; break; }
  }
  if (!$emp) { json_out(['ok'=>false,'msg'=>'계정을 찾을 수 없습니다.'], 401); return; }
  if (($emp['status'] ?? '') !== 'active') { json_out(['ok'=>false,'msg'=>'활성화되지 않은 계정입니다.'], 403); return; }
  if (!password_verify($password, (string)($emp['password_hash'] ?? ''))) {
    json_out(['ok'=>false,'msg'=>'비밀번호가 일치하지 않습니다.'], 401); return;
  }
  $perms = $emp['perms'] ?? [];
  json_out(['ok'=>true,'emp'=>[
    'empNo' => $emp['empNo'] ?? '',
    'name' => $emp['name'] ?? '',
    'role' => $emp['role'] ?? 'viewer',
    'username' => $emp['username'] ?? '',
    'dept' => $emp['dept'] ?? '',
    'position' => $emp['position'] ?? '',
    'perms' => $perms,
  ]]);
  return;
}

$pdo = get_db();
try {
  $stmt = $pdo->prepare('SELECT * FROM `portal_employees` WHERE (`username` = :u OR `emp_no` = :u) LIMIT 1');
  $stmt->execute([':u' => $loginId]);
  $emp = $stmt->fetch(PDO::FETCH_ASSOC);
  if (!$emp) { json_out(['ok'=>false,'msg'=>'계정을 찾을 수 없습니다.'], 401); return; }
  if (($emp['status'] ?? '') !== 'active') { json_out(['ok'=>false,'msg'=>'활성화되지 않은 계정입니다.'], 403); return; }
  if (!password_verify($password, (string)$emp['password_hash'])) {
    json_out(['ok'=>false,'msg'=>'비밀번호가 일치하지 않습니다.'], 401); return;
  }
  $perms = [];
  if (!empty($emp['perms_json'])) {
    $decoded = json_decode($emp['perms_json'], true);
    $perms = is_array($decoded) ? $decoded : [];
  }
  json_out(['ok'=>true,'emp'=>[
    'empNo' => $emp['emp_no'] ?? '',
    'name' => $emp['name'] ?? '',
    'role' => $emp['role'] ?? 'viewer',
    'username' => $emp['username'] ?? '',
    'dept' => $emp['dept'] ?? '',
    'position' => $emp['position'] ?? '',
    'perms' => $perms,
  ]]);
} catch (Throwable $e) {
  json_out(['ok'=>false,'msg'=>'서버 오류'], 500);
}
