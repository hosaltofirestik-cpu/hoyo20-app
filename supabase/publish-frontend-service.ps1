param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectUrl,

  [Parameter(Mandatory = $true)]
  [string]$ServiceToken,

  [string]$Bucket = "frontend",
  [string]$Prefix = "app"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$include = @(
  "index.html",
  "styles.css",
  "app.js",
  "supabase-config.js",
  "supabase-service.js"
)

$includeDirs = @(
  "vendor",
  "modules"
)

$uploadHeaders = @{
  "Authorization" = "Bearer $ServiceToken"
  "x-upsert" = "true"
}

function Get-ContentType([string]$Path) {
  switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    ".html" { return "text/html; charset=utf-8" }
    ".css" { return "text/css; charset=utf-8" }
    ".js" { return "application/javascript; charset=utf-8" }
    ".json" { return "application/json; charset=utf-8" }
    ".svg" { return "image/svg+xml" }
    ".png" { return "image/png" }
    ".jpg" { return "image/jpeg" }
    ".jpeg" { return "image/jpeg" }
    default { return "application/octet-stream" }
  }
}

function Upload-File([string]$AbsolutePath, [string]$RelativePath) {
  $target = "$ProjectUrl/storage/v1/object/$Bucket/$Prefix/$RelativePath".Replace("\", "/")
  $bytes = [System.IO.File]::ReadAllBytes($AbsolutePath)
  $headersForFile = @{}
  foreach ($pair in $uploadHeaders.GetEnumerator()) {
    $headersForFile[$pair.Key] = $pair.Value
  }
  $headersForFile["Content-Type"] = Get-ContentType $AbsolutePath
  
  Invoke-RestMethod -Method Post -Uri $target -Headers $headersForFile -Body $bytes | Out-Null
  Write-Host "Subido: $RelativePath"
}

Write-Host "Publicando frontend a Storage..."
Write-Host ""

foreach ($file in $include) {
  $absolute = Join-Path $root $file
  if (Test-Path $absolute) {
    Upload-File $absolute $file
  }
}

foreach ($dir in $includeDirs) {
  $absoluteDir = Join-Path $root $dir
  if (-not (Test-Path $absoluteDir)) { continue }
  Get-ChildItem -Path $absoluteDir -Recurse -File | ForEach-Object {
    $relative = $_.FullName.Substring($root.Length).TrimStart("\")
    Upload-File $_.FullName $relative
  }
}

$publicUrl = "$ProjectUrl/storage/v1/object/public/$Bucket/$Prefix/index.html"
Write-Host ""
Write-Host "Frontend publicado en Storage"
Write-Host "URL: $publicUrl"
