$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$distPath = Join-Path $projectRoot "dist"
$outputZip = Join-Path (Split-Path -Parent $projectRoot) "dist-catalogo-web.zip"

if (-not (Test-Path -LiteralPath $distPath)) {
  throw "No existe la carpeta dist. Ejecuta primero el build."
}

if (Test-Path -LiteralPath $outputZip) {
  Remove-Item -LiteralPath $outputZip -Force
}

$tempDir = Join-Path $projectRoot ".deploy-temp"
if (Test-Path -LiteralPath $tempDir) {
  Remove-Item -LiteralPath $tempDir -Recurse -Force
}
New-Item -ItemType Directory -Path $tempDir | Out-Null

# Copy regular dist files/folders.
Copy-Item -Path (Join-Path $distPath "*") -Destination $tempDir -Recurse -Force

# Ensure hidden files like .htaccess are included.
$htaccessPath = Join-Path $distPath ".htaccess"
if (Test-Path -LiteralPath $htaccessPath) {
  Copy-Item -LiteralPath $htaccessPath -Destination (Join-Path $tempDir ".htaccess") -Force
}

$itemsToZip = Get-ChildItem -LiteralPath $tempDir -Force
if ($itemsToZip.Count -eq 0) {
  throw "No hay archivos para comprimir en deploy."
}

Compress-Archive -LiteralPath $itemsToZip.FullName -DestinationPath $outputZip -Force
Remove-Item -LiteralPath $tempDir -Recurse -Force

Write-Host "ZIP listo para desplegar en cPanel/LiteSpeed:"
Write-Host $outputZip
