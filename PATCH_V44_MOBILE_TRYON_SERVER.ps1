$ErrorActionPreference = "Stop"
$root = Get-Location
$server = Join-Path $root "server\index.mjs"
$blockFile = Join-Path $root "japano_mobile_v44\server_routes_v44_mobile_tryon_block.mjs"

if (!(Test-Path $server)) { throw "Khong tim thay server\index.mjs tai $server" }
if (!(Test-Path $blockFile)) { throw "Khong tim thay $blockFile" }

$content = Get-Content $server -Raw -Encoding UTF8
if ($content -match "JAPANO V44 MOBILE TRYON ROUTES START") {
  Write-Host "[OK] V44 mobile tryon routes da ton tai."
  exit 0
}

$backup = "$server.bak-v44-$(Get-Date -Format yyyyMMdd-HHmmss)"
Copy-Item $server $backup -Force

$block = Get-Content $blockFile -Raw -Encoding UTF8
$needle = "function getLanApiUrls()"
if ($content.Contains($needle)) {
  $content = $content.Replace($needle, $block + "`n`n" + $needle)
} else {
  $content = $content + "`n`n" + $block
}

Set-Content $server $content -Encoding UTF8
Write-Host "[OK] Da patch V44 mobile tryon routes."
Write-Host "Backup: $backup"
