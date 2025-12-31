<?php
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

// 로컬 개발에서만 허용
if (($_SERVER['REMOTE_ADDR'] ?? '') !== '127.0.0.1') {
  json_out(['ok'=>false,'error'=>'forbidden'], 403);
  exit;
}

if (use_json_fallback()) {
  $u = json_user_find('sepnp');
  if (!$u) {
    $u = json_user_add('sepnp', password_hash('0536', PASSWORD_DEFAULT), '관리자', 'Master', 'admin', '승인완료');
  }
  $_SESSION['user_name'] = 'sepnp';
  json_out(['ok'=>true,'user'=>$u]);
} else {
  $pdo = get_db();
  $stmt = $pdo->prepare('SELECT id, username, nickname, rank, role, status FROM users WHERE username = :u LIMIT 1');
  $stmt->execute([':u' => 'sepnp']);
  $u = $stmt->fetch(PDO::FETCH_ASSOC);
  if (!$u) {
    json_out(['ok'=>false,'error'=>'admin_missing'], 500);
    exit;
  }
  $_SESSION['user_id'] = (int)$u['id'];
  json_out(['ok'=>true,'user'=>$u]);
}
