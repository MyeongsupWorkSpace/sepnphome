<?php
declare(strict_types=1);
define('SEPNP_NO_SESSION', true);
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

if (session_status() !== PHP_SESSION_ACTIVE) { @session_start(); }
function require_master_vendor(): void {
  $u = use_json_fallback() ? current_user_json() : current_user(get_db());
  $rank = strtolower((string)($u['rank'] ?? ''));
  if ($rank !== 'master') {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'forbidden'], JSON_UNESCAPED_UNICODE);
    exit;
  }
}
require_master_vendor();

$raw = file_get_contents('php://input');
$data = $raw ? json_decode($raw, true) : $_REQUEST;
if (!is_array($data)) { $data = []; }

$id = (int)($data['id'] ?? 0);
$name = trim((string)($data['name'] ?? ''));
$slug = trim((string)($data['slug'] ?? ''));
$sortOrder = (int)($data['sortOrder'] ?? 0);
if ($name === '') {
  json_out(['ok' => false, 'error' => 'invalid_name'], 400);
  exit;
}

function slugify_vendor(string $text): string {
  $text = strtolower($text);
  $text = preg_replace('/[^a-z0-9]+/', '-', $text);
  $text = trim($text, '-');
  return $text ?: ('brand-' . substr(md5($text . microtime(true)), 0, 6));
}

try {
  $pdo = get_db();
  if ($slug === '') $slug = slugify_vendor($name);

  $baseSlug = $slug;
  $suffix = 1;
  while (true) {
    $stmt = $pdo->prepare('SELECT `id` FROM `vendor_brands` WHERE `slug` = :slug LIMIT 1');
    $stmt->execute([':slug' => $slug]);
    $existingId = (int)($stmt->fetchColumn() ?: 0);
    if ($existingId === 0 || ($id > 0 && $existingId === $id)) break;
    $slug = $baseSlug . '-' . $suffix;
    $suffix += 1;
  }

  $now = time();
  if ($id > 0) {
    $stmt = $pdo->prepare('UPDATE `vendor_brands` SET `name`=:name, `slug`=:slug, `sort_order`=:sort_order, `updated_at`=:updated_at WHERE `id`=:id');
    $stmt->execute([
      ':name' => $name,
      ':slug' => $slug,
      ':sort_order' => $sortOrder,
      ':updated_at' => $now,
      ':id' => $id,
    ]);
  } else {
    $stmt = $pdo->prepare('INSERT INTO `vendor_brands`(`name`,`slug`,`sort_order`,`created_at`,`updated_at`) VALUES(:name,:slug,:sort_order,:created_at,:updated_at)');
    $stmt->execute([
      ':name' => $name,
      ':slug' => $slug,
      ':sort_order' => $sortOrder,
      ':created_at' => $now,
      ':updated_at' => $now,
    ]);
    $id = (int)$pdo->lastInsertId();
  }

  json_out(['ok' => true, 'brand' => ['id' => $id, 'name' => $name, 'slug' => $slug, 'sortOrder' => $sortOrder]]);
} catch (Throwable $e) {
  json_out(['ok' => false, 'error' => 'server_error'], 500);
}
