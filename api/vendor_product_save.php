<?php
declare(strict_types=1);
define('SEPNP_NO_SESSION', true);
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

if (session_status() !== PHP_SESSION_ACTIVE) { @session_start(); }
function require_master_vendor_product(): void {
  $u = use_json_fallback() ? current_user_json() : current_user(get_db());
  $rank = strtolower((string)($u['rank'] ?? ''));
  if ($rank !== 'master') {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'forbidden'], JSON_UNESCAPED_UNICODE);
    exit;
  }
}
require_master_vendor_product();

$raw = file_get_contents('php://input');
$data = $raw ? json_decode($raw, true) : $_REQUEST;
if (!is_array($data)) { $data = []; }

$id = (int)($data['id'] ?? 0);
$brandId = (int)($data['brandId'] ?? 0);
$name = trim((string)($data['name'] ?? ''));
$description = trim((string)($data['description'] ?? ''));
$imageUrl = trim((string)($data['imageUrl'] ?? ''));
$sortOrder = (int)($data['sortOrder'] ?? 0);

if ($brandId <= 0 || $name === '') {
  json_out(['ok' => false, 'error' => 'invalid_input'], 400);
  exit;
}

try {
  $pdo = get_db();
  $check = $pdo->prepare('SELECT `id` FROM `vendor_brands` WHERE `id` = :id');
  $check->execute([':id' => $brandId]);
  if (!$check->fetchColumn()) {
    json_out(['ok' => false, 'error' => 'brand_not_found'], 404);
    exit;
  }

  $now = time();
  if ($id > 0) {
    $stmt = $pdo->prepare('UPDATE `vendor_products` SET `brand_id`=:brand_id, `name`=:name, `description`=:description, `image_url`=:image_url, `sort_order`=:sort_order, `updated_at`=:updated_at WHERE `id`=:id');
    $stmt->execute([
      ':brand_id' => $brandId,
      ':name' => $name,
      ':description' => $description,
      ':image_url' => $imageUrl,
      ':sort_order' => $sortOrder,
      ':updated_at' => $now,
      ':id' => $id,
    ]);
  } else {
    $stmt = $pdo->prepare('INSERT INTO `vendor_products`(`brand_id`,`name`,`description`,`image_url`,`sort_order`,`created_at`,`updated_at`) VALUES(:brand_id,:name,:description,:image_url,:sort_order,:created_at,:updated_at)');
    $stmt->execute([
      ':brand_id' => $brandId,
      ':name' => $name,
      ':description' => $description,
      ':image_url' => $imageUrl,
      ':sort_order' => $sortOrder,
      ':created_at' => $now,
      ':updated_at' => $now,
    ]);
    $id = (int)$pdo->lastInsertId();
  }

  json_out(['ok' => true, 'product' => [
    'id' => $id,
    'brandId' => $brandId,
    'name' => $name,
    'description' => $description,
    'imageUrl' => $imageUrl,
    'sortOrder' => $sortOrder,
  ]]);
} catch (Throwable $e) {
  json_out(['ok' => false, 'error' => 'server_error'], 500);
}
