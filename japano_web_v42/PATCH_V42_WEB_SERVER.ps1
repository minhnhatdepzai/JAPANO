$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$server = Join-Path $root 'server\index.mjs'
$snippetPath = Join-Path $root 'japano_web_v42\server_routes_v42_web.mjs'

if (!(Test-Path $server)) { throw "Khong thay server/index.mjs tai $server" }
if (!(Test-Path $snippetPath)) { throw "Khong thay $snippetPath" }

$text = Get-Content $server -Raw
if ($text -match 'JAPANO_WEB_V42_ROUTES_BEGIN') {
  Write-Host '[OK] V42 web routes da co trong server/index.mjs'
  exit 0
}

$snippet = Get-Content $snippetPath -Raw
$anchor = "`nfunction getLanApiUrls()"
if ($text.Contains($anchor)) {
  $text = $text.Replace($anchor, "`n$snippet`nfunction getLanApiUrls()")
} elseif ($text -match "app\.listen\(") {
  $text = $text -replace "(?s)app\.listen\(", "$snippet`napp.listen("
} else {
  throw 'Khong tim thay vi tri chen route trong server/index.mjs'
}

$backup = "$server.bak-v42-web-$(Get-Date -Format yyyyMMdd-HHmmss)"
Copy-Item $server $backup -Force
Set-Content $server $text -Encoding UTF8
Write-Host "[OK] Da patch V42 web routes vao server/index.mjs"
Write-Host "Backup: $backup"
