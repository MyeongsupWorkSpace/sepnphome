<?php
define('SEPNP_NO_SESSION', true);
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');
if (session_status() === PHP_SESSION_ACTIVE) { @session_write_close(); }

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$raw = file_get_contents('php://input');
$in = $raw ? json_decode($raw, true) : $_REQUEST;
if (!is_array($in)) { $in = []; }
$key = trim((string)($_GET['key'] ?? $in['key'] ?? ''));
if ($key === '') { json_out(['ok'=>false,'error'=>'missing_key'], 400); return; }

$pdo = get_db();
try {
  if ($method === 'GET') {
    $stmt = $pdo->prepare('SELECT `data_json` FROM `portal_kv` WHERE `kv_key` = :k LIMIT 1');
    $stmt->execute([':k' => $key]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) { json_out(['ok'=>true,'data'=>null]); return; }
    $data = json_decode((string)$row['data_json'], true);
    json_out(['ok'=>true,'data'=>$data]);
    return;
  }
  if ($method === 'POST') {
    $now = time();
    $json = json_encode($in['data'] ?? null, JSON_UNESCAPED_UNICODE);
    $stmt = $pdo->prepare('INSERT INTO `portal_kv`(`kv_key`,`data_json`,`updated_at`) VALUES(:k,:j,:ts) ON DUPLICATE KEY UPDATE `data_json`=VALUES(`data_json`), `updated_at`=VALUES(`updated_at`)');
    $stmt->execute([':k'=>$key, ':j'=>$json, ':ts'=>$now]);
    json_out(['ok'=>true]);
    return;
  }
} catch (Throwable $e) {
  json_out(['ok'=>false,'error'=>'server_error'], 500);
}
