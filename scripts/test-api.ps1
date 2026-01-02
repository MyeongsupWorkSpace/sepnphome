param(
  [string]$BaseUrl = "http://127.0.0.1:8000"
)

Write-Host "Ping..."
try {
  $pong = Invoke-RestMethod -Uri "$BaseUrl/api/ping.php" -TimeoutSec 5
  $pong | ConvertTo-Json -Compress | Write-Output
} catch { Write-Warning ("Ping failed: {0}" -f $_.Exception.Message) }

Write-Host "Submit sample quote..."
# Use ASCII-only JSON to avoid codepage parser issues
$body = @'
{
  "name": "Test",
  "email": "test@example.com",
  "phone": "010-0000-0000",
  "product": "Sample product",
  "qty": 1000,
  "length": 120,
  "width": 80,
  "height": 40,
  "finishing": ["coating","foil"],
  "coating": ["matteCR","glossLami"],
  "foil_w": 20,
  "foil_h": 10,
  "finishing_detail": "coating: matteCR, glossLami | foil: 20x10mm",
  "message": "Test request"
}
'@
try {
  $res = Invoke-RestMethod -Uri "$BaseUrl/api/submit_quote.php" -Method Post -ContentType "application/json" -Body $body -TimeoutSec 10
  $res | ConvertTo-Json -Compress | Write-Output
} catch { Write-Warning ("Submit failed: {0}" -f $_.Exception.Message) }
