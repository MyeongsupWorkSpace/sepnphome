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
$seedDefaults = function(PDO $pdo): void {
  $defaults = [
    [
      'category' => 'notice',
      'title' => '4월 공장 견학 일정 안내',
      'summary' => '현장 견학은 매주 목요일에 진행되며 사전 예약이 필요합니다.',
      'content' => '현장 견학은 매주 목요일에 진행되며 사전 예약이 필요합니다.',
      'notice_date' => '2026-04-01',
    ],
    [
      'category' => 'company',
      'title' => '신규 자동 재단 설비 도입',
      'summary' => '고난이도 패키지의 정밀도를 높이는 최신 장비를 가동했습니다.',
      'content' => '고난이도 패키지의 정밀도를 높이는 최신 장비를 가동했습니다.',
      'notice_date' => '2026-03-30',
    ],
    [
      'category' => 'notice',
      'title' => '친환경 포장재 라인업 확대',
      'summary' => '친환경 인증 소재와 저탄소 공정을 기본 옵션으로 제공합니다.',
      'content' => '친환경 인증 소재와 저탄소 공정을 기본 옵션으로 제공합니다.',
      'notice_date' => '2026-03-26',
    ],
    [
      'category' => 'company',
      'title' => '브랜드 컨설팅 케이스북 공개',
      'summary' => '패키지 개선으로 매출이 상승한 사례를 담은 자료를 공유합니다.',
      'content' => '패키지 개선으로 매출이 상승한 사례를 담은 자료를 공유합니다.',
      'notice_date' => '2026-03-22',
    ],
  ];
  $stmt = $pdo->prepare('INSERT INTO `notices`(`category`,`title`,`summary`,`content`,`notice_date`,`is_pinned`,`attachments_json`,`views`,`created_at`,`updated_at`) VALUES(:category,:title,:summary,:content,:notice_date,0,:attachments_json,0,:created_at,:updated_at)');
  $now = time();
  foreach ($defaults as $row) {
    $stmt->execute([
      ':category' => $row['category'],
      ':title' => $row['title'],
      ':summary' => $row['summary'],
      ':content' => $row['content'],
      ':notice_date' => $row['notice_date'],
      ':attachments_json' => '[]',
      ':created_at' => $now,
      ':updated_at' => $now,
    ]);
  }
};

$totalCount = 0;
try {
  $totalCount = (int)$pdo->query('SELECT COUNT(*) FROM `notices`')->fetchColumn();
} catch (Throwable $e) {
  $totalCount = 0;
}
if ($totalCount === 0) {
  try { $seedDefaults($pdo); } catch (Throwable $e) { /* ignore */ }
}

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
