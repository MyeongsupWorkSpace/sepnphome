param(
  [switch]$JsonFallback,
  [string]$ListenHost = "127.0.0.1",
  [int]$Port = 8000,
  [switch]$UseRouter
)

Push-Location "${PSScriptRoot}\.."  # project root
try {
  Write-Host "Stopping any running php dev servers..."
  Get-Process php -ErrorAction SilentlyContinue | Stop-Process -Force
} catch {}

if ($JsonFallback) {
  Write-Host "Enabling JSON fallback mode (APP_USE_JSON=1)"
  $env:APP_USE_JSON = '1'
} else {
  $env:APP_USE_JSON = $null
}

$php = "php"
$docroot = (Get-Location).Path
# Host 자동변수와 충돌을 피하기 위해 사용자 입력은 $ListenHost로 사용합니다.
$bind = "${ListenHost}:$Port"

# Prefer -n to ignore system ini causing extension load errors
if ($UseRouter) {
  $router = Join-Path $docroot "router.php"
  if (!(Test-Path $router)) { Write-Warning "router.php not found; falling back to -t ."; $UseRouter = $false }
}

Write-Host "Starting PHP dev server at http://$bind ..."
if ($UseRouter) {
  & $php -n -S $bind $router
} else {
  & $php -n -S $bind -t $docroot
}

Pop-Location
