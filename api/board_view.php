<?php
declare(strict_types=1);
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

$path = __DIR__ . '/../data/board.json';
if (!file_exists($path)) { echo json_encode(['ok'=>false,'error'=>'not_found']); exit; }

$raw = file_get_contents('php://input');
$in = json_decode($raw ?: '[]', true);
$id = (int)($in['id'] ?? 0);
$password = (string)($in['password'] ?? '');
if ($id <= 0) { http_response_code(400); echo json_encode(['ok'=>false,'error'=>'bad_request']); exit; }

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
  $needsPw = !!($item['secret'] ?? false) && !current_user_json();
  echo json_encode(['ok'=>false,'error'=> $password === '' ? 'password_required' : 'invalid_password'], JSON_UNESCAPED_UNICODE);
  exit;
}

// 조회수 증가 및 저장
$items[$foundIndex]['views'] = isset($items[$foundIndex]['views']) && is_numeric($items[$foundIndex]['views'])
  ? (int)$items[$foundIndex]['views'] + 1
  : 1;
file_put_contents($path, json_encode($items, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

// 민감 필드 제거 후 상세 반환 (비밀번호 해시 제거)
unset($item['password']);
echo json_encode(['ok'=>true, 'item'=>$item], JSON_UNESCAPED_UNICODE);
