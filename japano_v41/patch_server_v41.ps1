param(
  [Parameter(Mandatory=$true)][string]$ProjectRoot,
  [string]$GatewayPort = '8001'
)
$server = Join-Path $ProjectRoot 'server\index.mjs'
if (-not (Test-Path $server)) {
  Write-Host "[WARN] Khong thay server\index.mjs, bo qua patch backend." -ForegroundColor Yellow
  exit 0
}
$text = Get-Content $server -Raw
if ($text.Contains('JAPANO_V41_AI_ROUTES_BEGIN')) {
  Write-Host "[OK] Backend da co route V41."
  exit 0
}
$routes = Get-Content (Join-Path $PSScriptRoot 'server_routes_v41_snippet.mjs') -Raw
$routes = $routes.Replace('__GATEWAY_PORT__', $GatewayPort)
$marker = 'app.listen(PORT,'
$idx = $text.IndexOf($marker)
if ($idx -lt 0) {
  Write-Host "[WARN] Khong tim thay app.listen de chen route. Bo qua patch." -ForegroundColor Yellow
  exit 0
}
$backup = "$server.bak-v41-$(Get-Date -Format yyyyMMdd-HHmmss)"
Copy-Item $server $backup
$newText = $text.Insert($idx, "`n`n$routes`n`n")
Set-Content -Path $server -Value $newText -Encoding UTF8
Write-Host "[OK] Da patch V41 routes vao server/index.mjs"
Write-Host "Backup: $backup"
