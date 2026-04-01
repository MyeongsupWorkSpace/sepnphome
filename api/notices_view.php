<?php
declare(strict_types=1);
define('SEPNP_NO_SESSION', true);
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

$id = 0;
$noView = false;
if (isset($_GET['id'])) { $id = (int)$_GET['id']; }
if (isset($_GET['no_view'])) { $noView = ((string)$_GET['no_view'] === '1'); }
if ($id <= 0) {
  $raw = file_get_contents('php://input');
  $in = json_decode($raw ?: '[]', true);
  $id = (int)($in['id'] ?? 0);
  if (isset($in['no_view'])) { $noView = !!$in['no_view']; }
}
if ($id <= 0) { http_response_code(400); echo json_encode(['ok'=>false,'error'=>'bad_request']); exit; }

$path = __DIR__ . '/../data/notices.json';
if (!file_exists($path)) { @file_put_contents($path, '[]'); }

if (use_json_fallback()) {
  $items = json_decode(file_get_contents($path) ?: '[]', true);
  if (!is_array($items)) { $items = []; }
  $foundIndex = -1;
  foreach ($items as $idx => $it) {
    if ((int)($it['id'] ?? 0) === $id) { $foundIndex = $idx; break; }
  }
  if ($foundIndex < 0) { http_response_code(404); echo json_encode(['ok'=>false,'error'=>'not_found']); exit; }
  if (!$noView) {
    $items[$foundIndex]['views'] = (int)($items[$foundIndex]['views'] ?? 0) + 1;
    file_put_contents($path, json_encode($items, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
  }
  $it = $items[$foundIndex];
  $out = [
    'id' => (int)($it['id'] ?? 0),
    'category' => (string)($it['category'] ?? 'notice'),
    'title' => (string)($it['title'] ?? ''),
    'summary' => (string)($it['summary'] ?? ''),
    'content' => (string)($it['content'] ?? ''),
    'date' => (string)($it['notice_date'] ?? ''),
    'is_pinned' => (int)($it['is_pinned'] ?? 0) === 1,
    'views' => (int)($it['views'] ?? 0),
    'attachments' => isset($it['attachments']) && is_array($it['attachments']) ? $it['attachments'] : [],
  ];
  echo json_encode(['ok'=>true,'item'=>$out], JSON_UNESCAPED_UNICODE);
  exit;
}

$pdo = get_db();
$stmt = $pdo->prepare('SELECT * FROM `notices` WHERE `id` = :id LIMIT 1');
$stmt->execute([':id' => $id]);
$item = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$item) { http_response_code(404); echo json_encode(['ok'=>false,'error'=>'not_found']); exit; }
$views = (int)($item['views'] ?? 0);
if (!$noView) {
  $pdo->prepare('UPDATE `notices` SET `views` = `views` + 1 WHERE `id` = :id')->execute([':id' => $id]);
  $views += 1;
}
$atts = [];
if (!empty($item['attachments_json'])) {
  $atts = json_decode((string)$item['attachments_json'], true);
  if (!is_array($atts)) { $atts = []; }
}

$out = [
  'id' => (int)($item['id'] ?? 0),
  'category' => (string)($item['category'] ?? 'notice'),
  'title' => (string)($item['title'] ?? ''),
  'summary' => (string)($item['summary'] ?? ''),
  'content' => (string)($item['content'] ?? ''),
  'date' => (string)($item['notice_date'] ?? ''),
  'is_pinned' => (int)($item['is_pinned'] ?? 0) === 1,
  'views' => $views,
  'attachments' => $atts,
];

echo json_encode(['ok'=>true,'item'=>$out], JSON_UNESCAPED_UNICODE);
