<?php
declare(strict_types=1);
define('SEPNP_NO_SESSION', true);
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

$path = __DIR__ . '/../data/board.json';
if (!file_exists($path)) { @file_put_contents($path, '[]'); }

$raw = file_get_contents('php://input');
$in = json_decode($raw ?: '[]', true);
$id = (int)($in['id'] ?? 0);
$password = (string)($in['password'] ?? '');
if ($id <= 0) { http_response_code(400); echo json_encode(['ok'=>false,'error'=>'bad_request']); exit; }

if (use_json_fallback()) {
  $items = json_decode(file_get_contents($path) ?: '[]', true);
  if (!is_array($items)) { $items = []; }
  $foundIndex = -1;
  $item = null;
  foreach ($items as $idx => $it) {
    if ((int)($it['id'] ?? 0) === $id) { $foundIndex = $idx; $item = $it; break; }
  }
  if ($foundIndex < 0 || !$item) { http_response_code(404); echo json_encode(['ok'=>false,'error'=>'not_found']); exit; }
  // 접근 권한 확인
  $allowed = true;
  if (!!($item['secret'] ?? false)) {
    $allowed = false;
    if (session_status() !== PHP_SESSION_ACTIVE) { @session_start(); }
    $u = current_user_json();
    $isAdmin = !!($u && ($u['role'] ?? '') === 'admin');
    $isAuthor = !!($u && strcasecmp((string)($u['username'] ?? ''), (string)($item['author_username'] ?? '')) === 0);
    if ($isAdmin || $isAuthor) { $allowed = true; }
    else {
      $hash = (string)($item['password'] ?? '');
      if ($hash !== '' && $password !== '' && password_verify($password, $hash)) { $allowed = true; }
    }
  }
  if (!$allowed) {
    http_response_code(403);
    echo json_encode(['ok'=>false,'error'=> $password === '' ? 'password_required' : 'invalid_password'], JSON_UNESCAPED_UNICODE);
    exit;
  }
  // 조회수 증가 및 저장
  $items[$foundIndex]['views'] = isset($items[$foundIndex]['views']) && is_numeric($items[$foundIndex]['views'])
    ? (int)($items[$foundIndex]['views']) + 1
    : 1;
  file_put_contents($path, json_encode($items, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
  unset($item['password']);
  echo json_encode(['ok'=>true, 'item'=>$item], JSON_UNESCAPED_UNICODE);
} else {
  $pdo = get_db();
  $stmt = $pdo->prepare('SELECT * FROM `board_posts` WHERE `id` = :id LIMIT 1');
  $stmt->execute([':id' => $id]);
  $item = $stmt->fetch(PDO::FETCH_ASSOC);
  if (!$item) { http_response_code(404); echo json_encode(['ok'=>false,'error'=>'not_found']); exit; }
  $allowed = true;
  if ((int)($item['secret'] ?? 0) === 1) {
    $allowed = false;
    if (session_status() !== PHP_SESSION_ACTIVE) { @session_start(); }
    $u = current_user($pdo);
    $isAdmin = !!($u && ($u['role'] ?? '') === 'admin');
    $isAuthor = !!($u && strcasecmp((string)($u['username'] ?? ''), (string)($item['author_username'] ?? '')) === 0);
    if ($isAdmin || $isAuthor) { $allowed = true; }
    else {
      $hash = (string)($item['password_hash'] ?? '');
      if ($hash !== '' && $password !== '' && password_verify($password, $hash)) { $allowed = true; }
    }
  }
  if (!$allowed) {
    http_response_code(403);
    echo json_encode(['ok'=>false,'error'=> $password === '' ? 'password_required' : 'invalid_password'], JSON_UNESCAPED_UNICODE);
    exit;
  }
  // 조회수 증가
  $pdo->prepare('UPDATE `board_posts` SET `views` = `views` + 1 WHERE `id` = :id')->execute([':id' => $id]);
  $item['views'] = (int)($item['views'] ?? 0) + 1;
  $atts = [];
  if (!empty($item['attachments_json'])) {
    $atts = json_decode((string)$item['attachments_json'], true);
    if (!is_array($atts)) { $atts = []; }
  }
  $out = [
    'id' => (int)$item['id'],
    'category' => (string)($item['category'] ?? ''),
    'title' => (string)($item['title'] ?? ''),
    'content' => (string)($item['content'] ?? ''),
    'secret' => (int)($item['secret'] ?? 0) === 1,
    'author' => (string)($item['author'] ?? ''),
    'name' => (string)($item['name'] ?? ''),
    'phone' => (string)($item['phone'] ?? ''),
    'order_no' => (string)($item['order_no'] ?? ''),
    'author_username' => (string)($item['author_username'] ?? ''),
    'status' => (string)($item['status'] ?? ''),
    'attachments' => $atts,
    'views' => (int)($item['views'] ?? 0),
    'timestamp' => (int)($item['timestamp'] ?? 0),
  ];
  echo json_encode(['ok'=>true, 'item'=>$out], JSON_UNESCAPED_UNICODE);
}
