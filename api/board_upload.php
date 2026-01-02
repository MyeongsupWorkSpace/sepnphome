<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');

$base = dirname(__DIR__);
$uploadDir = $base . DIRECTORY_SEPARATOR . 'uploads';
if (!is_dir($uploadDir)) { @mkdir($uploadDir, 0777, true); }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['ok'=>false,'error'=>'method_not_allowed']);
  exit;
}

if (!isset($_FILES) || !is_array($_FILES) || !count($_FILES)) {
  echo json_encode(['ok'=>true,'files'=>[]]);
  exit;
}

function sanitize_name(string $name): string {
  $name = preg_replace('/[^A-Za-z0-9._-]/', '_', $name);
  return $name ?: ('file_' . uniqid());
}

$results = [];
foreach ($_FILES as $key => $file) {
  if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) continue;
  $orig = (string)($file['name'] ?? '');
  $size = (int)($file['size'] ?? 0);
  $type = (string)($file['type'] ?? '');
  $tmp  = (string)($file['tmp_name'] ?? '');
  if (!is_uploaded_file($tmp)) continue;
  $safe = sanitize_name($orig);
  $target = $uploadDir . DIRECTORY_SEPARATOR . (uniqid('att_') . '_' . $safe);
  if (@move_uploaded_file($tmp, $target)) {
    $rel = 'uploads/' . basename($target);
    $results[] = [ 'name' => $orig, 'path' => $target, 'url' => $rel, 'size' => $size, 'type' => $type ];
  }
}

echo json_encode(['ok'=>true,'files'=>$results], JSON_UNESCAPED_UNICODE);
