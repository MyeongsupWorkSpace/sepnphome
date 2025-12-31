<?php
header('Content-Type: application/json; charset=utf-8');
require __DIR__ . '/db.php';
$u = current_user_json();
echo json_encode(['ok' => !!$u, 'user' => $u], JSON_UNESCAPED_UNICODE);
