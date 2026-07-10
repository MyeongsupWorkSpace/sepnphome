<?php
declare(strict_types=1);
define('SEPNP_NO_SESSION', true);
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

try {
  $pdo = get_db();
  $stmt = $pdo->prepare('SELECT `company`,`phone`,`address`,`email`,`partner_email`,`delivery_address`,`hours`,`hours_note`,`kakao_link` FROM `site_settings` WHERE `id` = 1 LIMIT 1');
  $stmt->execute();
  $row = $stmt->fetch(PDO::FETCH_ASSOC);
  if (!$row) {
    json_out(['ok' => true, 'settings' => []]);
    exit;
  }
  $settings = [
    'company' => (string)($row['company'] ?? ''),
    'phone' => (string)($row['phone'] ?? ''),
    'address' => (string)($row['address'] ?? ''),
    'email' => (string)($row['email'] ?? ''),
    'partnerEmail' => (string)($row['partner_email'] ?? ''),
    'deliveryAddress' => (string)($row['delivery_address'] ?? ''),
    'hours' => (string)($row['hours'] ?? ''),
    'hoursNote' => (string)($row['hours_note'] ?? ''),
    'kakaoLink' => (string)($row['kakao_link'] ?? ''),
  ];
  json_out(['ok' => true, 'settings' => $settings]);
} catch (Throwable $e) {
  json_out(['ok' => false, 'error' => 'server_error'], 500);
}
