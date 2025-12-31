<?php
header('Content-Type: application/json; charset=utf-8');
echo json_encode([
  'pong' => true,
  'ts' => time(),
  'env_APP_USE_JSON' => getenv('APP_USE_JSON') ?: null,
], JSON_UNESCAPED_UNICODE);
