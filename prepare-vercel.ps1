param(
  [string]$OutputFile = "vercel-deploy.zip"
)

$ErrorActionPreference = "Stop"
$root = Get-Location

Write-Host "Preparando archivos para Vercel..."

# Files to include
$filesToInclude = @(
  "index.html",
  "styles.css",
  "app.js",
  "supabase-config.js",
  "supabase-service.js",
  "vercel.json"
)

$foldersToInclude = @(
  "vendor",
  "modules",
  "assets"
)

# Create temp folder
$tempFolder = Join-Path $env:TEMP "vercel-deploy-temp"
if (Test-Path $tempFolder) { Remove-Item $tempFolder -Recurse -Force }
New-Item $tempFolder -ItemType Directory | Out-Null

# Copy files
foreach ($file in $filesToInclude) {
  $src = Join-Path $root $file
  if (Test-Path $src) {
    Copy-Item $src (Join-Path $tempFolder $file)
    Write-Host "✓ $file"
  }
}

# Copy folders
foreach ($folder in $foldersToInclude) {
  $src = Join-Path $root $folder
  if (Test-Path $src) {
    Copy-Item $src (Join-Path $tempFolder $folder) -Recurse
    Write-Host "✓ $folder/"
  }
}

# Create zip
if (Test-Path $OutputFile) { Remove-Item $OutputFile -Force }
Compress-Archive -Path $tempFolder\* -DestinationPath $OutputFile
Remove-Item $tempFolder -Recurse -Force

Write-Host ""
Write-Host "Archivo creado: $OutputFile"
Write-Host ""
Write-Host "Pasos para desplegar en Vercel:"
Write-Host "1. Ve a https://vercel.com/new"
Write-Host "2. Haz clic en 'Deploy from directory'"
Write-Host "3. Selecciona la carpeta y detiene el build (no hay build requerido)"
Write-Host "4. ¡Listo!"
