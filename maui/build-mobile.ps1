# PowerShell script to automate Android APK & AAB packaging for EMS.Mobile
# Execution: .\build-mobile.ps1 -KeystorePath "path/to/keystore" -KeystorePassword "pass" -KeyAlias "alias" -KeyPassword "pass"

param (
    [string]$KeystorePath = "",
    [string]$KeystorePassword = "",
    [string]$KeyAlias = "",
    [string]$KeyPassword = ""
)

$ErrorActionPreference = "Stop"

$rootPath = Resolve-Path ".."
$publishPath = Join-Path $rootPath "publish"
$androidPublishPath = Join-Path $publishPath "Android"
$projectPath = Join-Path $rootPath "maui\EMS.Mobile\EMS.Mobile.csproj"

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

# 3. Publish Android Package
Write-Host "[3/4] Running MSBuild publishing..." -ForegroundColor Green
if ($KeystorePath -ne "") {
    Write-Host "Compiling Signed Production Android App Bundle..." -ForegroundColor Yellow
    dotnet publish $projectPath -c Release -f net10.0-android `
        /p:AndroidKeyStore=true `
        /p:AndroidSigningKeyStore=$KeystorePath `
        /p:AndroidSigningStorePass=$KeystorePassword `
        /p:AndroidSigningKeyAlias=$KeyAlias `
        /p:AndroidSigningKeyPass=$KeyPassword
} else {
    Write-Host "Compiling Unsigned Internal Testing Android Packages..." -ForegroundColor Yellow
    dotnet publish $projectPath -c Release -f net10.0-android
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
