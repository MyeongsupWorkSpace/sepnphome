<?php
require __DIR__ . '/db.php';
// Server-Sent Events providing the quotes list. Supports JSON fallback or DB.
// Cloudflare/Nginx 친화적 헤더 (프록시 버퍼링/변환 방지)
header('Content-Type: text/event-stream');
header('Cache-Control: no-cache, no-transform');
header('Connection: keep-alive');
header('X-Accel-Buffering: no');

$useJson = use_json_fallback();
set_time_limit(0);

if ($useJson) {
  $file = __DIR__ . '/../data/quotes.json';
  if (!file_exists($file)) {
    @mkdir(__DIR__ . '/../data', 0777, true);
    file_put_contents($file, json_encode([]));
  }
  // 초기 상태 전송
  $init = file_get_contents($file);
  echo "data: $init\n\n";
  @ob_flush(); @flush();
  $last = @filemtime($file) ?: time();
  while (true) {
    clearstatcache();
    $cur = @filemtime($file) ?: time();
    if ($cur !== $last) {
      $last = $cur;
      $data = file_get_contents($file);
      echo "data: $data\n\n";
      @ob_flush(); @flush();
    } else {
      echo ": keepalive\n\n";
      @ob_flush(); @flush();
    }
    sleep(3);
  }
} else {
  // DB 모드: 주기적으로 목록을 조회하고 변경 시 전송
  $pdo = get_db();
  $lastHash = '';
  $encode = function(array $rows): string {
    return json_encode($rows, JSON_UNESCAPED_UNICODE);
  };
  $fetchRows = function(PDO $pdo): array {
    try {
      $stmt = $pdo->query('SELECT id, name, product, message, email, phone, qty, length, width, height, finishing, finishing_detail, status, timestamp FROM quotes ORDER BY timestamp DESC');
      $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
      return is_array($rows) ? $rows : [];
    } catch (Throwable $e) { return []; }
  };
  // 초기 상태 전송
  $initRows = $pdo instanceof PDO ? $fetchRows($pdo) : [];
  $init = $encode($initRows);
  echo "data: $init\n\n";
  @ob_flush(); @flush();
  $lastHash = md5($init);
  while (true) {
    $rows = $pdo instanceof PDO ? $fetchRows($pdo) : [];
    $json = $encode($rows);
    $hash = md5($json);
    if ($hash !== $lastHash) {
      $lastHash = $hash;
      echo "data: $json\n\n";
      @ob_flush(); @flush();
    } else {
      echo ": keepalive\n\n";
      @ob_flush(); @flush();
    }
    sleep(3);
  }
}
