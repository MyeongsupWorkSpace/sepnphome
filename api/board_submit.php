<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
$path = __DIR__ . '/../data/board.json';
if (!file_exists($path)) { file_put_contents($path, '[]'); }
$input = file_get_contents('php://input');
$data = json_decode($input ?: '[]', true);
$title = trim((string)($data['title'] ?? ''));
$content = trim((string)($data['content'] ?? ''));
$secret = !!($data['secret'] ?? false);
$category = trim((string)($data['category'] ?? '기타문의'));
$status = trim((string)($data['status'] ?? '문의중'));
$author = trim((string)($data['author'] ?? ''));
$author_username = trim((string)($data['author_username'] ?? ''));
// extra fields (optional)
$name = trim((string)($data['name'] ?? $author));
$phone = trim((string)($data['phone'] ?? ''));
$order = trim((string)($data['order_no'] ?? ''));
$password = (string)($data['password'] ?? '');
$password_hash = $password !== '' ? password_hash($password, PASSWORD_DEFAULT) : '';
if ($title === '' || $content === '' || $author_username === '') {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'invalid_input'], JSON_UNESCAPED_UNICODE);
  exit;
}
$items = json_decode(file_get_contents($path) ?: '[]', true);
if (!is_array($items)) { $items = []; }
$id = 1;
foreach ($items as $it) { $id = max($id, (int)($it['id'] ?? 0) + 1); }
$now = (int)(microtime(true) * 1000);
$items[] = [
  'id' => $id,
  'category' => $category,
  'title' => $title,
  'content' => $content,
  'secret' => $secret,
  'author' => $author !== '' ? $author : $author_username,
  'name' => $name,
  'phone' => $phone,
  'order_no' => $order,
  'author_username' => $author_username,
  'status' => $status,
  'password' => $password_hash,
  'timestamp' => $now,
];
file_put_contents($path, json_encode($items, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
echo json_encode(['ok' => true, 'id' => $id], JSON_UNESCAPED_UNICODE);
