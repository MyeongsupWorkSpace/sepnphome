<?php
// PHP built-in server router for reliable local dev
$docroot = __DIR__;
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/';
$path = realpath($docroot . $uri);

// Serve existing files directly
if ($path && strpos($path, $docroot) === 0 && is_file($path)) {
  return false;
}

// Map /api/*.php to actual scripts
if (preg_match('#^/api/(.+\.php)$#', $uri, $m)) {
  $api = $docroot . '/api/' . $m[1];
  if (is_file($api)) { require $api; return true; }
}

// Default: serve index or the requested page
$target = $docroot . $uri;
if (is_dir($target)) { $target .= '/index.html'; }
if (is_file($target)) {
  $ext = pathinfo($target, PATHINFO_EXTENSION);
  if ($ext === 'php') { require $target; } else { readfile($target); }
  return true;
}

// Fallback to site index
require $docroot . '/index.html';
