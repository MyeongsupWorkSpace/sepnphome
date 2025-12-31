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
echo json_encode($items, JSON_UNESCAPED_UNICODE);
