$ErrorActionPreference = "Stop"
$root = "C:\jp\v37"
$server = Join-Path $root "server\index.mjs"
$blockFile = Join-Path $root "japano_web_v43\server_routes_v43_web_block.mjs"

if (!(Test-Path $server)) {
  throw "Khong tim thay server\index.mjs tai $server"
}
if (!(Test-Path $blockFile)) {
  throw "Khong tim thay block route V43 tai $blockFile"
}

$content = Get-Content $server -Raw -Encoding UTF8
if ($content -match "JAPANO V43 WEB FULL ROUTES START") {
  Write-Host "[OK] V43 web routes da ton tai trong server/index.mjs"
  exit 0
}

$backup = "$server.bak-v43-web-$(Get-Date -Format yyyyMMdd-HHmmss)"
Copy-Item $server $backup -Force

$block = Get-Content $blockFile -Raw -Encoding UTF8
$needle = "function getLanApiUrls()"
if ($content.Contains($needle)) {
  $content = $content.Replace($needle, $block + "`n`n" + $needle)
} else {
  $content = $content + "`n`n" + $block
}

Set-Content $server $content -Encoding UTF8
Write-Host "[OK] Da patch V43 web routes vao server/index.mjs"
Write-Host "Backup: $backup"
