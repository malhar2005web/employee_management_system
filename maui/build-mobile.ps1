# PowerShell script to automate Android APK & AAB packaging for EMS.Mobile
# Execution: .\build-mobile.ps1 -KeystorePath "path/to/keystore" -KeystorePassword "pass" -KeyAlias "alias" -KeyPassword "pass"

param (
    [string]$KeystorePath = "",
    [string]$KeystorePassword = "",
    [string]$KeyAlias = "",
    [string]$KeyPassword = ""
)

$ErrorActionPreference = "Stop"

$scriptDir = $PSScriptRoot
if (-not $scriptDir) { $scriptDir = (Get-Location).Path }
if ((Split-Path $scriptDir -Leaf) -eq "maui") {
    $rootPath = (Get-Item (Join-Path $scriptDir "..")).FullName
} elseif (Test-Path (Join-Path $scriptDir "maui\EMS.Mobile\EMS.Mobile.csproj")) {
    $rootPath = (Get-Item $scriptDir).FullName
} else {
    $rootPath = "D:\Desktop\New folder (103A)"
}

$publishPath = Join-Path $rootPath "publish"
$androidPublishPath = Join-Path $publishPath "Android"
$projectPath = Join-Path $rootPath "maui\EMS.Mobile\EMS.Mobile.csproj"

# Ensure JAVA_HOME and ANDROID_HOME are set
if (-not $env:JAVA_HOME -or -not (Test-Path $env:JAVA_HOME)) {
    if (Test-Path "D:\Desktop1\jbr") {
        $env:JAVA_HOME = "D:\Desktop1\jbr"
        $env:PATH = "D:\Desktop1\jbr\bin;" + $env:PATH
        Write-Host "Set JAVA_HOME to D:\Desktop1\jbr" -ForegroundColor DarkCyan
    }
}
if (-not $env:ANDROID_HOME -or -not (Test-Path $env:ANDROID_HOME)) {
    $defaultSdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
    if (Test-Path $defaultSdk) {
        $env:ANDROID_HOME = $defaultSdk
        Write-Host "Set ANDROID_HOME to $defaultSdk" -ForegroundColor DarkCyan
    } elseif (Test-Path "C:\Program Files (x86)\Android\android-sdk") {
        $env:ANDROID_HOME = "C:\Program Files (x86)\Android\android-sdk"
        Write-Host "Set ANDROID_HOME to C:\Program Files (x86)\Android\android-sdk" -ForegroundColor DarkCyan
    }
}

$defaultDebugKeystore = Join-Path $env:USERPROFILE ".android\debug.keystore"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "STARTING ANDROID APK & AAB COMPILATION PIPELINE" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# 1. Clean Publish Directory
if (Test-Path $androidPublishPath) {
    Write-Host "[1/4] Cleaning existing Android publish folder..." -ForegroundColor Green
    Remove-Item $androidPublishPath -Recurse -Force
}
New-Item -ItemType Directory -Path $androidPublishPath -Force | Out-Null

# 2. Restore and Build with Release profile
Write-Host "[2/4] Restoring & compiling solution in Release Configuration..." -ForegroundColor Green
dotnet clean $projectPath -c Release
dotnet restore $projectPath

# 3. Publish Android Package (both APK and AAB)
Write-Host "[3/4] Running MSBuild publishing for Android APK..." -ForegroundColor Green
if ($KeystorePath -ne "") {
    Write-Host "Compiling Signed Production Android APK..." -ForegroundColor Yellow
    dotnet publish $projectPath -c Release -f net10.0-android `
        /p:AndroidPackageFormat=apk `
        /p:AndroidKeyStore=true `
        /p:AndroidSigningKeyStore=$KeystorePath `
        /p:AndroidSigningStorePass=$KeystorePassword `
        /p:AndroidSigningKeyAlias=$KeyAlias `
        /p:AndroidSigningKeyPass=$KeyPassword
} elseif (Test-Path $defaultDebugKeystore) {
    Write-Host "Compiling Signed Device-Installable Android APK (using debug keystore)..." -ForegroundColor Yellow
    dotnet publish $projectPath -c Release -f net10.0-android `
        /p:AndroidPackageFormat=apk `
        /p:AndroidKeyStore=true `
        /p:AndroidSigningKeyStore=$defaultDebugKeystore `
        /p:AndroidSigningStorePass=android `
        /p:AndroidSigningKeyAlias=androiddebugkey `
        /p:AndroidSigningKeyPass=android
} else {
    Write-Host "Compiling Android Package..." -ForegroundColor Yellow
    dotnet publish $projectPath -c Release -f net10.0-android /p:AndroidPackageFormat=apk
}

# 4. Extract generated APK & AAB to publish/Android/
Write-Host "[4/4] Extracting final APK and AAB packages..." -ForegroundColor Green
$packageDir = Join-Path $rootPath "maui\EMS.Mobile\bin\Release\net10.0-android"
if (Test-Path $packageDir) {
    # Copy AAB
    $aabFiles = Get-ChildItem -Path $packageDir -Filter "*.aab" -Recurse
    foreach ($file in $aabFiles) {
        $dest = Join-Path $androidPublishPath $file.Name
        Copy-Item -Path $file.FullName -Destination $dest -Force
        Write-Host "Exported AAB: $dest" -ForegroundColor Cyan
    }

    # Copy APK
    $apkFiles = Get-ChildItem -Path $packageDir -Filter "*.apk" -Recurse
    foreach ($file in $apkFiles) {
        $dest = Join-Path $androidPublishPath $file.Name
        Copy-Item -Path $file.FullName -Destination $dest -Force
        Write-Host "Exported APK: $dest" -ForegroundColor Cyan

        # Also copy directly into root directory for easy access
        $rootDest = Join-Path $rootPath $file.Name
        Copy-Item -Path $file.FullName -Destination $rootDest -Force
        Write-Host "Exported APK to Main Root Folder: $rootDest" -ForegroundColor Green
    }

    # Create cleanly named EMS_Mobile_App.apk in main root folder
    $signedApk = Get-ChildItem -Path $packageDir -Filter "*Signed.apk" -Recurse | Select-Object -First 1
    if (-not $signedApk) {
        $signedApk = Get-ChildItem -Path $packageDir -Filter "*.apk" -Recurse | Select-Object -First 1
    }
    if ($signedApk) {
        $cleanApkDest = Join-Path $rootPath "EMS_Mobile_App.apk"
        Copy-Item -Path $signedApk.FullName -Destination $cleanApkDest -Force
        Write-Host ">>> Instant Access APK placed in root folder: $cleanApkDest <<<" -ForegroundColor Yellow

        # Copy to Desktop for direct accessibility
        if (Test-Path "D:\Desktop") {
            Copy-Item -Path $signedApk.FullName -Destination "D:\Desktop\EMS_Mobile_App.apk" -Force
            Write-Host ">>> Instant Access APK copied to D:\Desktop\EMS_Mobile_App.apk <<<" -ForegroundColor Yellow
        }
        if (Test-Path "$env:USERPROFILE\Desktop") {
            Copy-Item -Path $signedApk.FullName -Destination "$env:USERPROFILE\Desktop\EMS_Mobile_App.apk" -Force
            Write-Host ">>> Instant Access APK copied to Desktop: $env:USERPROFILE\Desktop\EMS_Mobile_App.apk <<<" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "Warning: Output directory not found at $packageDir" -ForegroundColor Yellow
}

# 5. Append to ReleaseNotes
$releaseNotesPath = Join-Path $publishPath "ReleaseNotes.txt"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"[Android Build Success] - $timestamp - Version 1.0.0" | Out-File -FilePath $releaseNotesPath -Append

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "ANDROID COMPILATION COMPLETE!" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
