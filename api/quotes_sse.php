<?php
// Simple Server-Sent Events providing the quotes list when the file changes.
// Cloudflare/Nginx 친화적 헤더 (프록시 버퍼링/변환 방지)
header('Content-Type: text/event-stream');
header('Cache-Control: no-cache, no-transform');
header('Connection: keep-alive');
header('X-Accel-Buffering: no');

$file = __DIR__ . '/../data/quotes.json';
if (!file_exists($file)) {
  @mkdir(__DIR__ . '/../data', 0777, true);
  file_put_contents($file, json_encode([]));
}

// send initial state
$init = file_get_contents($file);
echo "data: $init\n\n";
@ob_flush(); @flush();

$last = @filemtime($file) ?: time();
set_time_limit(0);

while (true) {
  clearstatcache();
  $cur = @filemtime($file) ?: time();
  if ($cur !== $last) {
    $last = $cur;
    $data = file_get_contents($file);
    echo "data: $data\n\n";
    @ob_flush(); @flush();
  } else {
    // keepalive comment to prevent proxies closing the connection
    echo ": keepalive\n\n";
    @ob_flush(); @flush();
  }
  sleep(3);
}
