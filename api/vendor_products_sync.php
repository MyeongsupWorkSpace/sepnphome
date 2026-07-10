<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');

if (session_status() !== PHP_SESSION_ACTIVE) { @session_start(); }
require __DIR__ . '/db.php';
function require_master_vendor_sync(): void {
  $u = use_json_fallback() ? current_user_json() : current_user(get_db());
  $rank = strtolower((string)($u['rank'] ?? ''));
  if ($rank !== 'master') {
    http_response_code(403);
    echo json_encode(['ok'=>false,'error'=>'forbidden'], JSON_UNESCAPED_UNICODE);
    exit;
  }
}
require_master_vendor_sync();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['ok'=>false,'error'=>'method_not_allowed']);
  exit;
}

$base = dirname(__DIR__);
$imgRoot = $base . DIRECTORY_SEPARATOR . 'assets' . DIRECTORY_SEPARATOR . 'img';
if (!is_dir($imgRoot)) {
  json_out(['ok' => false, 'error' => 'not_found'], 404);
  exit;
}

$brandFolders = [
  '롯데' => ['slug' => 'lotte', 'name' => '롯데'],
  '농심' => ['slug' => 'nongshim', 'name' => '농심'],
  '크라운' => ['slug' => 'crown', 'name' => '크라운'],
  '네슬레' => ['slug' => 'nestle', 'name' => '네슬레'],
];
$allowedExt = ['jpg','jpeg','png','webp','gif','jfif'];

function safe_product_name(string $filename): string {
  $base = pathinfo($filename, PATHINFO_FILENAME);
  $base = str_replace('_', ' ', $base);
  return trim($base);
}

try {
  $pdo = get_db();
  $now = time();
  $added = 0;

  $stmtFindBrand = $pdo->prepare('SELECT `id` FROM `vendor_brands` WHERE `slug` = :slug LIMIT 1');
  $stmtInsertBrand = $pdo->prepare('INSERT INTO `vendor_brands`(`slug`,`name`,`sort_order`,`created_at`,`updated_at`) VALUES(:slug,:name,:sort,:created_at,:updated_at)');
  $stmtExisting = $pdo->prepare('SELECT `image_url` FROM `vendor_products` WHERE `brand_id` = :brand_id');
  $stmtDeleteAssets = $pdo->prepare('DELETE FROM `vendor_products` WHERE `brand_id` = :brand_id AND `image_url` LIKE :prefix');
  $stmtInsertProduct = $pdo->prepare('INSERT INTO `vendor_products`(`brand_id`,`name`,`description`,`image_url`,`sort_order`,`created_at`,`updated_at`) VALUES(:brand_id,:name,:description,:image_url,:sort_order,:created_at,:updated_at)');

  foreach ($brandFolders as $folderName => $meta) {
    $dirPath = $imgRoot . DIRECTORY_SEPARATOR . $folderName;
    if (!is_dir($dirPath)) continue;

    $stmtFindBrand->execute([':slug' => $meta['slug']]);
    $brandId = (int)($stmtFindBrand->fetchColumn() ?: 0);
    if ($brandId <= 0) {
      $stmtInsertBrand->execute([
        ':slug' => $meta['slug'],
        ':name' => $meta['name'],
        ':sort' => 0,
        ':created_at' => $now,
        ':updated_at' => $now,
      ]);
      $brandId = (int)$pdo->lastInsertId();
    }

    $stmtExisting->execute([':brand_id' => $brandId]);
    $existingUrls = $stmtExisting->fetchAll(PDO::FETCH_COLUMN) ?: [];

    $encodedFolder = rawurlencode($folderName);
    $assetPrefix = '/assets/img/' . $encodedFolder . '/';
    $stmtDeleteAssets->execute([':brand_id' => $brandId, ':prefix' => $assetPrefix . '%']);
    $sortOrder = 0;

    $files = scandir($dirPath) ?: [];
    foreach ($files as $file) {
      if ($file === '.' || $file === '..') continue;
      $full = $dirPath . DIRECTORY_SEPARATOR . $file;
      if (!is_file($full)) continue;
      $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
      if (!in_array($ext, $allowedExt, true)) continue;

      $url = $assetPrefix . rawurlencode($file);

      $name = safe_product_name($file);
      $sortOrder += 1;
      $stmtInsertProduct->execute([
        ':brand_id' => $brandId,
        ':name' => $name,
        ':description' => '',
        ':image_url' => $url,
        ':sort_order' => $sortOrder,
        ':created_at' => $now,
        ':updated_at' => $now,
      ]);
      $added += 1;
    }
  }

  json_out(['ok' => true, 'added' => $added]);
} catch (Throwable $e) {
  json_out(['ok' => false, 'error' => 'server_error'], 500);
}
