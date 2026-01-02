<?php
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

$raw = file_get_contents('php://input');
$data = $raw ? json_decode($raw, true) : $_POST;
$id = isset($data['id']) ? (int)$data['id'] : 0;
$status = trim((string)($data['status'] ?? ''));
if ($id <= 0 || $status === '') { json_out(['ok'=>false,'error'=>'bad_request'], 400); exit; }

if (use_json_fallback()) {
  // 관리자 권한 확인(JSON 세션)
  require_admin_json();
  $path = json_quotes_path();
  $rows = json_load($path);
  $updated = false;
  foreach ($rows as &$r) {
    if ((int)($r['id'] ?? 0) === $id) { $r['status'] = $status; $updated = true; break; }
  }
  unset($r);
  if ($updated) json_save($path, $rows);
  json_out(['ok'=>$updated]);
} else {
  $pdo = get_db();
  require_admin($pdo);
  $stmt = $pdo->prepare('UPDATE quotes SET status = :s WHERE id = :id');
  $ok = false;
  try {
    $ok = $stmt->execute([':s'=>$status, ':id'=>$id]);
  } catch (Throwable $e) { $ok = false; }
  json_out(['ok'=>$ok]);
}
