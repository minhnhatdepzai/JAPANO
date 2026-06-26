$ErrorActionPreference = "Stop"
$server = "server\index.mjs"
$blockFile = "japano_mobile_v45\server_routes_v45_shop_tryon_block.mjs"
if (!(Test-Path $server)) { throw "Khong thay server\index.mjs" }
if (!(Test-Path $blockFile)) { throw "Khong thay $blockFile" }
$content = Get-Content $server -Raw -Encoding UTF8
if ($content -match "JAPANO V45 SHOP TRYON ROUTES START") {
  Write-Host "[OK] V45 shop tryon routes da co."
  exit 0
}
$backup = "$server.bak-v45-shop-$(Get-Date -Format yyyyMMdd-HHmmss)"
Copy-Item $server $backup -Force
$block = Get-Content $blockFile -Raw -Encoding UTF8
$needle = "function getLanApiUrls()"
if ($content.Contains($needle)) {
  $content = $content.Replace($needle, $block + "`n`n" + $needle)
} else {
  $content = $content + "`n`n" + $block
}
Set-Content $server $content -Encoding UTF8
Write-Host "[OK] Da patch V45 shop tryon routes."
Write-Host "Backup: $backup"
