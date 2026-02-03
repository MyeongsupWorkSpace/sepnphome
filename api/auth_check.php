<?php
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

$raw = file_get_contents('php://input');
$in = $raw ? json_decode($raw, true) : $_REQUEST;
if (!is_array($in)) { $in = []; }

$u = trim((string)($in['username'] ?? ''));
$n = trim((string)($in['nickname'] ?? ''));
if ($u === '' && $n === '') { json_out(['ok'=>false,'error'=>'missing_fields'], 400); return; }

$out = ['ok' => true];

try {
  if (use_json_fallback()) {
    if ($u !== '') {
      $out['usernameAvailable'] = json_user_find($u) ? false : true;
    }
    if ($n !== '') {
      $out['nicknameAvailable'] = json_user_find_by_nickname($n) ? false : true;
    }
  } else {
    $pdo = get_db();
    if ($u !== '') {
      $stmt = $pdo->prepare('SELECT `id` FROM `users` WHERE `username` = :u LIMIT 1');
      $stmt->execute([':u' => $u]);
      $out['usernameAvailable'] = $stmt->fetchColumn() ? false : true;
    }
    if ($n !== '') {
      $stmt = $pdo->prepare('SELECT `id` FROM `users` WHERE `nickname` = :n LIMIT 1');
      $stmt->execute([':n' => $n]);
      $out['nicknameAvailable'] = $stmt->fetchColumn() ? false : true;
    }
  }
} catch (Throwable $e) {
  json_out(['ok'=>false,'error'=>'server_error'], 500);
  return;
}

json_out($out);
