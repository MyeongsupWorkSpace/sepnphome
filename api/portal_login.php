<?php
define('SEPNP_NO_SESSION', true);
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');
if (session_status() === PHP_SESSION_ACTIVE) { @session_write_close(); }

$raw = file_get_contents('php://input');
$in = $raw ? json_decode($raw, true) : $_POST;
if (!is_array($in)) { $in = []; }
$loginId = trim((string)($in['loginId'] ?? $in['username'] ?? ''));
$password = (string)($in['password'] ?? '');
if ($loginId === '' || $password === '') { json_out(['ok'=>false,'msg'=>'ID와 비밀번호를 입력하세요.'], 400); return; }

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
