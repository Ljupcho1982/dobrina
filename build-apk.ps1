# Ја гради Добрина Android debug APK. Се извршува од папката dobrina/.
$ErrorActionPreference = 'Stop'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"

# JDK-от не се тврди со тврда патека — машините се менуваат, а gradle молчи
# и излегува со 0 кога JAVA_HOME е погрешен. Се бара, па се проверува.
$jdkCandidates = @(
  $env:JAVA_HOME,
  (Get-ChildItem "$env:USERPROFILE\.jdks" -Directory -EA SilentlyContinue |
     Where-Object { $_.Name -match '21' } | Select-Object -First 1 -Exp FullName),
  (Get-ChildItem 'C:\Program Files\Eclipse Adoptium' -Directory -EA SilentlyContinue |
     Where-Object { $_.Name -match 'jdk-21' } | Select-Object -First 1 -Exp FullName),
  'C:\Program Files\Android\Android Studio\jbr'
) | Where-Object { $_ }

$jdk = $jdkCandidates | Where-Object { Test-Path (Join-Path $_ 'bin\java.exe') } | Select-Object -First 1
if (-not $jdk) { throw "Не најдов JDK 21. Инсталирај го, или постави JAVA_HOME." }
$env:JAVA_HOME = $jdk.TrimEnd('\')
Write-Host "==> JDK: $env:JAVA_HOME" -ForegroundColor Cyan

# Стар service-worker кеш ги држи корисниците на старата верзија,
# затоа името на кешот се движи со верзијата од package.json.
$pkgVersion = (Get-Content package.json -Raw | ConvertFrom-Json).version
$sw = Get-Content www\sw.js -Raw
if ($sw -notmatch "dobrina-v$([regex]::Escape($pkgVersion))") {
  Write-Host "==> stamping cache version: $pkgVersion" -ForegroundColor Cyan
  $sw = $sw -replace 'const CACHE = "dobrina-v[^"]*"', "const CACHE = `"dobrina-v$pkgVersion`""
  Set-Content www\sw.js $sw -NoNewline
}

if (-not (Test-Path android)) {
  Write-Host "==> adding android platform" -ForegroundColor Cyan
  npx cap add android
}

Write-Host "==> syncing web assets" -ForegroundColor Cyan
npx cap sync android

# Снимањето глас е целата поента на апликацијата — без оваа дозвола
# getUserMedia молчи и корисникот мисли дека апликацијата е расипана.
$manifestPath = 'android\app\src\main\AndroidManifest.xml'
$manifest = Get-Content $manifestPath -Raw
if ($manifest -notmatch 'android.permission.RECORD_AUDIO') {
  Write-Host "==> adding RECORD_AUDIO permission" -ForegroundColor Cyan
  $manifest = $manifest -replace '(<uses-permission android:name="android.permission.INTERNET" />)',
    "`$1`n    <uses-permission android:name=`"android.permission.RECORD_AUDIO`" />`n    <uses-permission android:name=`"android.permission.MODIFY_AUDIO_SETTINGS`" />"
  Set-Content $manifestPath $manifest -NoNewline
}

Write-Host "==> gradle assembleDebug" -ForegroundColor Cyan
Set-Location android
.\gradlew.bat assembleDebug
$gradleExit = $LASTEXITCODE
Set-Location ..
if ($gradleExit -ne 0) { throw "gradle assembleDebug падна со код $gradleExit" }

Copy-Item android\app\build\outputs\apk\debug\app-debug.apk .\Dobrina-debug.apk -Force
Write-Host "==> done: Dobrina-debug.apk" -ForegroundColor Green
Get-Item .\Dobrina-debug.apk | Select-Object Name, Length, LastWriteTime
