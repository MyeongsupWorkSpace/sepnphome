<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
$path = __DIR__ . '/../data/board.json';
if (!file_exists($path)) { echo json_encode([]); exit; }
$raw = file_get_contents($path);
$items = json_decode($raw ?: '[]', true);
if (!is_array($items)) { $items = []; }
// 최신순 정렬
usort($items, function($a, $b) { return ($b['timestamp'] ?? 0) <=> ($a['timestamp'] ?? 0); });
// 목록 응답에서는 민감/대용량 필드 제외 (content/password/연락처 등)
$sanitized = array_map(function($it){
	return [
		'id' => (int)($it['id'] ?? 0),
		'category' => (string)($it['category'] ?? ''),
		'title' => (string)($it['title'] ?? ''),
		'secret' => !!($it['secret'] ?? false),
		'author' => (string)($it['author'] ?? ''),
		'name' => (string)($it['name'] ?? ''),
		'author_username' => (string)($it['author_username'] ?? ''),
		'status' => (string)($it['status'] ?? ''),
		'views' => (int)($it['views'] ?? 0),
		'timestamp' => (int)($it['timestamp'] ?? 0),
	];
}, $items);
echo json_encode($sanitized, JSON_UNESCAPED_UNICODE);
