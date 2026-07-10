<?php
declare(strict_types=1);
define('SEPNP_NO_SESSION', true);
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

if (session_status() !== PHP_SESSION_ACTIVE) { @session_start(); }
function require_master_settings(): void {
  $u = use_json_fallback() ? current_user_json() : current_user(get_db());
  $rank = strtolower((string)($u['rank'] ?? ''));
  if ($rank !== 'master') {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'forbidden'], JSON_UNESCAPED_UNICODE);
    exit;
  }
}
require_master_settings();

$raw = file_get_contents('php://input');
$data = $raw ? json_decode($raw, true) : $_REQUEST;
if (!is_array($data)) { $data = []; }

$company = trim((string)($data['company'] ?? ''));
$phone = trim((string)($data['phone'] ?? ''));
$address = trim((string)($data['address'] ?? ''));
$email = trim((string)($data['email'] ?? ''));
$partnerEmail = trim((string)($data['partnerEmail'] ?? ''));
$deliveryAddress = trim((string)($data['deliveryAddress'] ?? ''));
$hours = trim((string)($data['hours'] ?? ''));
$hoursNote = trim((string)($data['hoursNote'] ?? ''));
$kakaoLink = trim((string)($data['kakaoLink'] ?? ''));
$now = time();

try {
  $pdo = get_db();
  $stmt = $pdo->prepare(
    'INSERT INTO `site_settings` (`id`,`company`,`phone`,`address`,`email`,`partner_email`,`delivery_address`,`hours`,`hours_note`,`kakao_link`,`updated_at`)
     VALUES (1,:company,:phone,:address,:email,:partner_email,:delivery_address,:hours,:hours_note,:kakao_link,:updated_at)
     ON DUPLICATE KEY UPDATE
       `company`=VALUES(`company`),
       `phone`=VALUES(`phone`),
       `address`=VALUES(`address`),
       `email`=VALUES(`email`),
       `partner_email`=VALUES(`partner_email`),
       `delivery_address`=VALUES(`delivery_address`),
       `hours`=VALUES(`hours`),
       `hours_note`=VALUES(`hours_note`),
       `kakao_link`=VALUES(`kakao_link`),
       `updated_at`=VALUES(`updated_at`)'
  );
  $stmt->execute([
    ':company' => $company,
    ':phone' => $phone,
    ':address' => $address,
    ':email' => $email,
    ':partner_email' => $partnerEmail,
    ':delivery_address' => $deliveryAddress,
    ':hours' => $hours,
    ':hours_note' => $hoursNote,
    ':kakao_link' => $kakaoLink,
    ':updated_at' => $now,
  ]);
  json_out([
    'ok' => true,
    'settings' => [
      'company' => $company,
      'phone' => $phone,
      'address' => $address,
      'email' => $email,
      'partnerEmail' => $partnerEmail,
      'deliveryAddress' => $deliveryAddress,
      'hours' => $hours,
      'hoursNote' => $hoursNote,
      'kakaoLink' => $kakaoLink,
    ]
  ]);
} catch (Throwable $e) {
  json_out(['ok' => false, 'error' => 'server_error'], 500);
}
