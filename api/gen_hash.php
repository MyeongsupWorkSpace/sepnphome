<?php
header('Content-Type: application/json; charset=utf-8');
$pw = '0536';
$hash = password_hash($pw, PASSWORD_DEFAULT);
echo json_encode(['password' => $pw, 'hash' => $hash], JSON_UNESCAPED_UNICODE);
