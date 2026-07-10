<?php
declare(strict_types=1);
define('SEPNP_NO_SESSION', true);
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

try {
  $pdo = get_db();

  $syncVendorImages = function(PDO $pdo): void {
    $base = dirname(__DIR__);
    $imgRoot = $base . DIRECTORY_SEPARATOR . 'assets' . DIRECTORY_SEPARATOR . 'img';
    if (!is_dir($imgRoot)) return;

    $brandFolders = [
      '롯데' => ['slug' => 'lotte', 'name' => '롯데'],
      '농심' => ['slug' => 'nongshim', 'name' => '농심'],
      '크라운' => ['slug' => 'crown', 'name' => '크라운'],
      '네슬레' => ['slug' => 'nestle', 'name' => '네슬레'],
    ];
    $allowedExt = ['jpg','jpeg','png','webp','gif','jfif'];

    $stmtFindBrand = $pdo->prepare('SELECT `id` FROM `vendor_brands` WHERE `slug` = :slug LIMIT 1');
    $stmtInsertBrand = $pdo->prepare('INSERT INTO `vendor_brands`(`slug`,`name`,`sort_order`,`created_at`,`updated_at`) VALUES(:slug,:name,:sort,:created_at,:updated_at)');
    $stmtExisting = $pdo->prepare('SELECT `image_url` FROM `vendor_products` WHERE `brand_id` = :brand_id');
    $stmtDeleteAssets = $pdo->prepare('DELETE FROM `vendor_products` WHERE `brand_id` = :brand_id AND `image_url` LIKE :prefix');
    $stmtInsertProduct = $pdo->prepare('INSERT INTO `vendor_products`(`brand_id`,`name`,`description`,`image_url`,`sort_order`,`created_at`,`updated_at`) VALUES(:brand_id,:name,:description,:image_url,:sort_order,:created_at,:updated_at)');
    $now = time();

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
      $assetUrls = [];

      $files = scandir($dirPath) ?: [];
      foreach ($files as $file) {
        if ($file === '.' || $file === '..') continue;
        $full = $dirPath . DIRECTORY_SEPARATOR . $file;
        if (!is_file($full)) continue;
        $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
        if (!in_array($ext, $allowedExt, true)) continue;

        $url = $assetPrefix . rawurlencode($file);
        $assetUrls[] = $url;
      }

      $stmtDeleteAssets->execute([':brand_id' => $brandId, ':prefix' => $assetPrefix . '%']);
      $sortOrder = 0;
      foreach ($assetUrls as $url) {
        $baseName = pathinfo(urldecode($url), PATHINFO_FILENAME);
        $name = trim(str_replace('_', ' ', $baseName));
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
      }
    }
  };

  $syncVendorImages($pdo);

  $brands = $pdo->query('SELECT `id`,`slug`,`name`,`sort_order` FROM `vendor_brands` ORDER BY `sort_order` ASC, `name` ASC')->fetchAll(PDO::FETCH_ASSOC);
  $products = $pdo->query('SELECT `id`,`brand_id`,`name`,`description`,`image_url`,`sort_order` FROM `vendor_products` ORDER BY `sort_order` ASC, `id` ASC')->fetchAll(PDO::FETCH_ASSOC);

  $grouped = [];
  foreach ($brands as $b) {
    $grouped[(int)$b['id']] = [
      'id' => (int)$b['id'],
      'slug' => (string)$b['slug'],
      'name' => (string)$b['name'],
      'sortOrder' => (int)($b['sort_order'] ?? 0),
      'products' => [],
    ];
  }
  foreach ($products as $p) {
    $bid = (int)($p['brand_id'] ?? 0);
    if (!isset($grouped[$bid])) continue;
    $grouped[$bid]['products'][] = [
      'id' => (int)($p['id'] ?? 0),
      'name' => (string)($p['name'] ?? ''),
      'description' => (string)($p['description'] ?? ''),
      'imageUrl' => (string)($p['image_url'] ?? ''),
      'sortOrder' => (int)($p['sort_order'] ?? 0),
    ];
  }

  $out = array_values($grouped);
  json_out(['ok' => true, 'brands' => $out]);
} catch (Throwable $e) {
  json_out(['ok' => false, 'error' => 'server_error'], 500);
}
