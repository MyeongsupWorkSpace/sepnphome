<?php
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

$raw = file_get_contents('php://input');
$in = $raw ? json_decode($raw, true) : $_POST;
if (!is_array($in)) { $in = []; }

$u = trim((string)($in['username'] ?? ''));
$p = (string)($in['password'] ?? '');
$n = trim((string)($in['nickname'] ?? ''));
if ($u === '' || $p === '') { json_out(['ok'=>false,'error'=>'missing_fields'], 400); }

try {
  $pdo = use_json_fallback() ? null : get_db();
  $hash = password_hash($p, PASSWORD_DEFAULT);
  $stmt = $pdo->prepare('INSERT INTO users(username,password_hash,nickname,rank,role,status,created_at) VALUES(:u,:ph,:n,:r,:role,:s,:ts)');
  $stmt->execute([
    ':u' => $u,
    ':ph' => $hash,
    ':n' => $n ?: $u,
    ':r' => 'Normal',
    ':role' => 'user',
    ':s' => '승인완료',
    ':ts' => time(),
  ]);
    if (use_json_fallback()) {
      if (json_user_find($u)) { json_out(['ok'=>false,'error'=>'username_taken'], 409); return; }
      $hash = password_hash($p, PASSWORD_DEFAULT);
      json_user_add($u, $hash, $n ?: $u, 'Normal', 'user', '승인완료');
      json_out(['ok'=>true]);
    } else {
      $pdo = get_db();
      $hash = password_hash($p, PASSWORD_DEFAULT);
      $stmt = $pdo->prepare('INSERT INTO users(username,password_hash,nickname,rank,role,status,created_at) VALUES(:u,:ph,:n,:r,:role,:s,:ts)');
      $stmt->execute([
        ':u' => $u,
        ':ph' => $hash,
        ':n' => $n ?: $u,
        ':r' => 'Normal',
        ':role' => 'user',
        ':s' => '승인완료',
        ':ts' => time(),
      ]);
      json_out(['ok'=>true]);
    }
} catch (Throwable $e) {
  json_out(['ok'=>false,'error'=>'username_taken'], 409);
}
