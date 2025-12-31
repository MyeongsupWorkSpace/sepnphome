<?php
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

$raw = file_get_contents('php://input');
$in = $raw ? json_decode($raw, true) : $_POST;
if (!is_array($in)) { $in = []; }
$u = trim((string)($in['username'] ?? ''));
$p = (string)($in['password'] ?? '');

$pdo = use_json_fallback() ? null : get_db();
if (use_json_fallback()) {
  $user = json_user_find($u);
  if (!$user) { json_out(['ok'=>false,'error'=>'invalid_login'], 401); exit; }
  if (!password_verify($p, (string)($user['password_hash'] ?? ''))) { json_out(['ok'=>false,'error'=>'invalid_login'], 401); exit; }
  // sepnp는 항상 관리자/Master/승인완료로 강제
  if (strtolower((string)$user['username']) === 'sepnp') {
    $user['role'] = 'admin';
    $user['rank'] = 'Master';
    $user['nickname'] = $user['nickname'] ?: '관리자';
    $user['status'] = '승인완료';
  }
  if (($user['status'] ?? '') !== '승인완료' && ($user['role'] ?? '') !== 'admin') {
    json_out(['ok'=>false,'error'=>'pending_approval'], 403); exit;
  }
  $_SESSION['user_name'] = (string)$user['username'];
  json_out(['ok'=>true,'user'=>$user]);
} else {
  $stmt = $pdo->prepare('SELECT id, username, password_hash, nickname, rank, role, status FROM users WHERE username = :u LIMIT 1');
  $stmt->execute([':u' => $u]);
  $user = $stmt->fetch(PDO::FETCH_ASSOC);
  if (!$user) { json_out(['ok'=>false,'error'=>'invalid_login'], 401); exit; }
  if (!password_verify($p, (string)$user['password_hash'])) { json_out(['ok'=>false,'error'=>'invalid_login'], 401); exit; }
  if (strtolower((string)$user['username']) === 'sepnp') {
    $user['role'] = 'admin';
    $user['rank'] = 'Master';
    $user['nickname'] = $user['nickname'] ?: '관리자';
    $user['status'] = '승인완료';
  }
  if ($user['status'] !== '승인완료' && $user['role'] !== 'admin') {
    json_out(['ok'=>false,'error'=>'pending_approval'], 403); exit;
  }
  $_SESSION['user_id'] = (int)$user['id'];
  json_out(['ok'=>true,'user'=>[
    'id' => (int)$user['id'],
    'username' => $user['username'],
    'nickname' => $user['nickname'],
    'rank' => $user['rank'],
    'role' => $user['role'],
    'status' => $user['status'],
  ]]);
}
