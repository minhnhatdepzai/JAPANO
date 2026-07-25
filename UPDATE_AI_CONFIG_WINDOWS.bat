@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo [JAPANO] Updating .env.server AI config...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p='.env.server'; if(!(Test-Path $p)){ New-Item -ItemType File -Path $p | Out-Null }; $raw=Get-Content $p -Raw -ErrorAction SilentlyContinue; function SetEnvValue([string]$name,[string]$value){ if($script:raw -match ('(?m)^' + [regex]::Escape($name) + '=')){ $script:raw=[regex]::Replace($script:raw, ('(?m)^' + [regex]::Escape($name) + '=.*$'), ($name + '=' + $value)) } else { if($script:raw -and -not $script:raw.EndsWith([Environment]::NewLine)){ $script:raw += [Environment]::NewLine }; $script:raw += ($name + '=' + $value + [Environment]::NewLine) } }; SetEnvValue 'GEMINI_API_KEY' 'AQ.Ab8RN6LMrpdg9b84HOgs0FQO8giJoFYAAjEhk-ZpQ9izgAmiEA'; SetEnvValue 'GEMINI_TEXT_MODEL' 'gemini-2.0-flash'; SetEnvValue 'GEMINI_TIMEOUT_MS' '9000'; SetEnvValue 'GEMINI_COOLDOWN_MS' '120000'; SetEnvValue 'OLLAMA_URL' 'http://localhost:11434'; SetEnvValue 'OLLAMA_MODEL' 'qwen2.5:7b'; SetEnvValue 'OLLAMA_TIMEOUT_MS' '10000'; SetEnvValue 'OLLAMA_COOLDOWN_MS' '90000'; SetEnvValue 'DEMO_MODE' '1'; SetEnvValue 'PYTHONIOENCODING' 'utf-8'; SetEnvValue 'PYTHONUTF8' '1'; Set-Content -Path $p -Value $raw -Encoding utf8"
echo [JAPANO] Done. Restart backend: npm run start-server
pause
