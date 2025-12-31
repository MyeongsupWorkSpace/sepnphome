<?php
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

session_destroy();
json_out(['ok'=>true]);
