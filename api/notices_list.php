<?php
declare(strict_types=1);
define('SEPNP_NO_SESSION', true);
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

$category = strtolower(trim((string)($_GET['category'] ?? '')));
$include = strtolower(trim((string)($_GET['include'] ?? '')));
$includeContent = ($include === 'content');
$limit = (int)($_GET['limit'] ?? 0);
if ($limit <= 0 || $limit > 50) { $limit = 50; }

$path = __DIR__ . '/../data/notices.json';
$dir = dirname($path);
if (!is_dir($dir)) { @mkdir($dir, 0777, true); }
if (!file_exists($path)) { @file_put_contents($path, '[]'); }

$filterCategory = in_array($category, ['notice', 'company'], true) ? $category : '';

if (use_json_fallback()) {
  $items = json_decode(file_get_contents($path) ?: '[]', true);
  if (!is_array($items)) { $items = []; }
  if ($filterCategory) {
    $items = array_values(array_filter($items, function($it) use ($filterCategory) {
      return ($it['category'] ?? 'notice') === $filterCategory;
    }));
  }
  usort($items, function($a, $b) {
    $pin = (int)($b['is_pinned'] ?? 0) <=> (int)($a['is_pinned'] ?? 0);
    if ($pin !== 0) return $pin;
    $dateCmp = strcmp((string)($b['notice_date'] ?? ''), (string)($a['notice_date'] ?? ''));
    if ($dateCmp !== 0) return $dateCmp;
    return (int)($b['id'] ?? 0) <=> (int)($a['id'] ?? 0);
  });
  $items = array_slice($items, 0, $limit);
  $out = array_map(function($it) use ($includeContent){
    return [
      'id' => (int)($it['id'] ?? 0),
      'category' => (string)($it['category'] ?? 'notice'),
      'title' => (string)($it['title'] ?? ''),
      'summary' => (string)($it['summary'] ?? ''),
      'content' => $includeContent ? (string)($it['content'] ?? '') : null,
      'date' => (string)($it['notice_date'] ?? ''),
      'is_pinned' => (int)($it['is_pinned'] ?? 0) === 1,
      'views' => (int)($it['views'] ?? 0),
    ];
  }, $items);
  echo json_encode($out, JSON_UNESCAPED_UNICODE);
  exit;
}

$pdo = get_db();
$params = [];
$sql = 'SELECT `id`,`category`,`title`,`summary`,`notice_date`,`is_pinned`,`views`';
if ($includeContent) { $sql .= ',`content`'; }
$sql .= ' FROM `notices`';
if ($filterCategory) {
  $sql .= ' WHERE `category` = :category';
  $params[':category'] = $filterCategory;
}
$sql .= ' ORDER BY `is_pinned` DESC, `notice_date` DESC, `id` DESC LIMIT :limit';
$stmt = $pdo->prepare($sql);
foreach ($params as $k => $v) { $stmt->bindValue($k, $v); }
$stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
$stmt->execute();
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
$out = array_map(function($it) use ($includeContent){
  return [
    'id' => (int)($it['id'] ?? 0),
    'category' => (string)($it['category'] ?? 'notice'),
    'title' => (string)($it['title'] ?? ''),
    'summary' => (string)($it['summary'] ?? ''),
    'content' => $includeContent ? (string)($it['content'] ?? '') : null,
    'date' => (string)($it['notice_date'] ?? ''),
    'is_pinned' => (int)($it['is_pinned'] ?? 0) === 1,
    'views' => (int)($it['views'] ?? 0),
  ];
}, $rows);

echo json_encode($out, JSON_UNESCAPED_UNICODE);
