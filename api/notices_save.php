<?php
declare(strict_types=1);
define('SEPNP_NO_SESSION', true);
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

if (session_status() !== PHP_SESSION_ACTIVE) { @session_start(); }
function require_master_notice(): void {
  $u = use_json_fallback() ? current_user_json() : current_user(get_db());
  $rank = strtolower((string)($u['rank'] ?? ''));
  if ($rank !== 'master') {
    http_response_code(403);
    echo json_encode(['ok'=>false,'error'=>'forbidden'], JSON_UNESCAPED_UNICODE);
    exit;
  }
}
require_master_notice();

$path = __DIR__ . '/../data/notices.json';
$dir = dirname($path);
if (!is_dir($dir)) { @mkdir($dir, 0777, true); }
if (!file_exists($path)) { @file_put_contents($path, '[]'); }

$raw = file_get_contents('php://input');
$data = json_decode($raw ?: '[]', true);
$id = (int)($data['id'] ?? 0);
$title = trim((string)($data['title'] ?? ''));
$summary = trim((string)($data['summary'] ?? ''));
$content = trim((string)($data['content'] ?? ''));
$date = trim((string)($data['date'] ?? ''));
$category = strtolower(trim((string)($data['category'] ?? 'notice')));
$isPinned = !empty($data['is_pinned']) ? 1 : 0;
// attachments (optional)
$attachments = [];
if (isset($data['attachments']) && is_array($data['attachments'])) {
  foreach ($data['attachments'] as $att) {
    if (!is_array($att)) continue;
    $attachments[] = [
      'name' => (string)($att['name'] ?? ''),
      'url' => (string)($att['url'] ?? ''),
      'size' => (int)($att['size'] ?? 0),
      'type' => (string)($att['type'] ?? ''),
    ];
  }
}
if (!in_array($category, ['notice', 'company'], true)) { $category = 'notice'; }
if ($title === '' || $date === '') {
  http_response_code(400);
  echo json_encode(['ok'=>false,'error'=>'invalid_input'], JSON_UNESCAPED_UNICODE);
  exit;
}
$now = time();

function sanitize_notice_html(string $html): string {
  $allowed = '<b><strong><i><em><u><ul><ol><li><p><br><a>';
  $clean = strip_tags($html, $allowed);
  $clean = preg_replace('/\son\w+\s*=\s*"[^"]*"/i', '', $clean);
  $clean = preg_replace('/\son\w+\s*=\s*\'[^\']*\'/i', '', $clean);
  $clean = preg_replace('/\son\w+\s*=\s*[^\s>]+/i', '', $clean);
  $clean = preg_replace_callback('/<a\s+[^>]*href\s*=\s*(["\']?)([^"\'>\s]+)\1[^>]*>/i', function($m){
    $href = $m[2] ?? '';
    if (!preg_match('/^(https?:\/\/|mailto:)/i', $href)) {
      return '<a>';
    }
    $safe = htmlspecialchars($href, ENT_QUOTES, 'UTF-8');
    return '<a href="' . $safe . '" target="_blank" rel="noopener">';
  }, $clean);
  return $clean;
}

$content = sanitize_notice_html($content);

if (use_json_fallback()) {
  $items = json_decode(file_get_contents($path) ?: '[]', true);
  if (!is_array($items)) { $items = []; }
  if ($id > 0) {
    $found = false;
    foreach ($items as $idx => $it) {
      if ((int)($it['id'] ?? 0) === $id) {
        $items[$idx] = array_merge($it, [
          'category' => $category,
          'title' => $title,
          'summary' => $summary,
          'content' => $content,
          'notice_date' => $date,
          'is_pinned' => $isPinned,
          'attachments' => $attachments,
          'updated_at' => $now,
        ]);
        $found = true;
        break;
      }
    }
    if (!$found) { http_response_code(404); echo json_encode(['ok'=>false,'error'=>'not_found']); exit; }
  } else {
    $nextId = 1;
    foreach ($items as $it) { $nextId = max($nextId, (int)($it['id'] ?? 0) + 1); }
    $id = $nextId;
    $items[] = [
      'id' => $id,
      'category' => $category,
      'title' => $title,
      'summary' => $summary,
      'content' => $content,
      'notice_date' => $date,
      'is_pinned' => $isPinned,
      'attachments' => $attachments,
      'views' => 0,
      'created_at' => $now,
      'updated_at' => $now,
    ];
  }
  file_put_contents($path, json_encode($items, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
  echo json_encode(['ok'=>true,'id'=>$id], JSON_UNESCAPED_UNICODE);
  exit;
}

$pdo = get_db();
if ($id > 0) {
  $stmt = $pdo->prepare('UPDATE `notices` SET `category`=:category,`title`=:title,`summary`=:summary,`content`=:content,`notice_date`=:notice_date,`is_pinned`=:is_pinned,`attachments_json`=:attachments_json,`updated_at`=:updated_at WHERE `id`=:id');
  $stmt->execute([
    ':category' => $category,
    ':title' => $title,
    ':summary' => $summary,
    ':content' => $content,
    ':notice_date' => $date,
    ':is_pinned' => $isPinned,
    ':attachments_json' => json_encode($attachments, JSON_UNESCAPED_UNICODE),
    ':updated_at' => $now,
    ':id' => $id,
  ]);
  if ($stmt->rowCount() === 0) {
    $check = $pdo->prepare('SELECT `id` FROM `notices` WHERE `id`=:id');
    $check->execute([':id'=>$id]);
    if (!$check->fetch()) { http_response_code(404); echo json_encode(['ok'=>false,'error'=>'not_found']); exit; }
  }
} else {
  $stmt = $pdo->prepare('INSERT INTO `notices`(`category`,`title`,`summary`,`content`,`notice_date`,`is_pinned`,`attachments_json`,`views`,`created_at`,`updated_at`) VALUES(:category,:title,:summary,:content,:notice_date,:is_pinned,:attachments_json,:views,:created_at,:updated_at)');
  $stmt->execute([
    ':category' => $category,
    ':title' => $title,
    ':summary' => $summary,
    ':content' => $content,
    ':notice_date' => $date,
    ':is_pinned' => $isPinned,
    ':attachments_json' => json_encode($attachments, JSON_UNESCAPED_UNICODE),
    ':views' => 0,
    ':created_at' => $now,
    ':updated_at' => $now,
  ]);
  $id = (int)$pdo->lastInsertId();
}

echo json_encode(['ok'=>true,'id'=>$id], JSON_UNESCAPED_UNICODE);
