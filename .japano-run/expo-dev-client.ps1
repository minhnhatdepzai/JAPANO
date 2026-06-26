$ErrorActionPreference = 'Continue'
Set-Location -LiteralPath 'C:\jp\v37'
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = 'C:\Users\ADMIN\AppData\Local\Android\Sdk'
$env:ANDROID_SDK_ROOT = 'C:\Users\ADMIN\AppData\Local\Android\Sdk'
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:Path"
$env:EXPO_PUBLIC_API_URL = 'http://10.0.2.2:4000'
$env:EXPO_PUBLIC_AI_MODE = 'local-first-api-fallback'
$env:EXPO_PUBLIC_GPU_PROFILE = 'NVIDIA_5060TI_16GB'
Write-Host '[JAPANO] Expo dev client se ket noi API: ' $env:EXPO_PUBLIC_API_URL
npx expo start -c --dev-client
