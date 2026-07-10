<?php
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

$raw = file_get_contents('php://input');
$in = $raw ? json_decode($raw, true) : $_POST;
$id = (int)($in['id'] ?? 0);
$code = trim((string)($in['code'] ?? ''));
$title = trim((string)($in['title'] ?? ''));
$description = trim((string)($in['description'] ?? ''));
$expiresInput = trim((string)($in['expires_at'] ?? ''));

if ($code === '' || $title === '') {
  json_out(['ok' => false, 'error' => 'code_title_required'], 400);
}

$expiresAt = null;
if ($expiresInput !== '') {
  $ts = strtotime($expiresInput . ' 23:59:59');
  if ($ts === false) {
    json_out(['ok' => false, 'error' => 'invalid_expires_at'], 400);
  }
  $expiresAt = $ts;
}

$pdo = get_db();
require_admin($pdo);

if ($id > 0) {
  $stmt = $pdo->prepare('UPDATE `coupons` SET `code` = :code, `title` = :title, `description` = :desc, `expires_at` = :exp WHERE `id` = :id');
  $stmt->execute([
    ':code' => $code,
    ':title' => $title,
    ':desc' => $description,
    ':exp' => $expiresAt,
    ':id' => $id,
  ]);
  json_out(['ok' => true]);
} else {
  $stmt = $pdo->prepare('INSERT INTO `coupons`(`code`,`title`,`description`,`expires_at`,`created_at`) VALUES(:code,:title,:desc,:exp,:ts)');
  $stmt->execute([
    ':code' => $code,
    ':title' => $title,
    ':desc' => $description,
    ':exp' => $expiresAt,
    ':ts' => time(),
  ]);
  json_out(['ok' => true]);
}
