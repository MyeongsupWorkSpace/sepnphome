<?php
declare(strict_types=1);
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

$pdo = use_json_fallback() ? null : get_db();
if (use_json_fallback()) { require_admin_json(); } else { require_admin($pdo); }

$path = __DIR__ . '/../data/board.json';
if (!file_exists($path)) { http_response_code(404); echo json_encode(['ok'=>false,'error'=>'not_found']); exit; }
$raw = file_get_contents('php://input');
$in = json_decode($raw ?: '[]', true);
$id = (int)($in['id'] ?? 0);
$status = (string)($in['status'] ?? '');
if ($id <= 0 || ($status !== '문의중' && $status !== '답변완료')) {
  http_response_code(400);
  echo json_encode(['ok'=>false,'error'=>'bad_request'], JSON_UNESCAPED_UNICODE);
  exit;
}
$items = json_decode(file_get_contents($path) ?: '[]', true);
if (!is_array($items)) { $items = []; }
$updated = false;
foreach ($items as &$it){
  if ((int)($it['id'] ?? 0) === $id){ $it['status'] = $status; $updated = true; break; }
}
unset($it);
if ($updated){ file_put_contents($path, json_encode($items, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)); }
json_out(['ok'=>true,'updated'=>$updated]);
