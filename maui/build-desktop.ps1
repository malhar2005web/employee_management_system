# PowerShell script to automate Windows MSIX packaging for EMS.Desktop
# Execution: .\build-desktop.ps1

$ErrorActionPreference = "Stop"

$rootPath = Resolve-Path ".."
$publishPath = Join-Path $rootPath "publish"
$desktopPublishPath = Join-Path $publishPath "Desktop"
$projectPath = Join-Path $rootPath "maui\EMS.Desktop\EMS.Desktop.csproj"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "STARTING WINDOWS MSIX COMPILATION PIPELINE" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# 1. Clean Publish Directory
if (Test-Path $desktopPublishPath) {
    Write-Host "[1/4] Cleaning existing Desktop publish folder..." -ForegroundColor Green
    Remove-Item $desktopPublishPath -Recurse -Force
}
New-Item -ItemType Directory -Path $desktopPublishPath -Force | Out-Null

# 2. Restore and Build with Release profile
Write-Host "[2/4] Restoring & compiling solution in Release Configuration..." -ForegroundColor Green
dotnet clean $projectPath -c Release
dotnet restore $projectPath

# 3. Publish MSIX Sideloading App Package
Write-Host "[3/4] Running MSBuild publishing and Appx Packaging..." -ForegroundColor Green
dotnet publish $projectPath -c Release -f net10.0-windows10.0.19041.0 /p:GenerateAppxPackageOnBuild=true /p:AppxPackageSigningEnabled=false /p:WindowsPackageType=MSIX

# 4. Extract generated MSIX to publish/Desktop/
Write-Host "[4/4] Extracting final MSIX packages..." -ForegroundColor Green
$packageDir = Join-Path $rootPath "maui\EMS.Desktop\bin\Release\net10.0-windows10.0.19041.0\win-x64\AppPackages"
if (Test-Path $packageDir) {
    $msixFiles = Get-ChildItem -Path $packageDir -Filter "*.msix" -Recurse
    foreach ($file in $msixFiles) {
        $dest = Join-Path $desktopPublishPath $file.Name
        Copy-Item -Path $file.FullName -Destination $dest -Force
        Write-Host "Exported: $dest" -ForegroundColor Cyan
    }
} else {
    Write-Host "Warning: MSIX AppPackages directory not found at $packageDir" -ForegroundColor Yellow
}

# 5. Append to ReleaseNotes
$releaseNotesPath = Join-Path $publishPath "ReleaseNotes.txt"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"[Windows Build Success] - $timestamp - Version 1.0.0" | Out-File -FilePath $releaseNotesPath -Append

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "WINDOWS MSIX COMPILATION COMPLETE!" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
