param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectUrl,

  [Parameter(Mandatory = $true)]
  [string]$AnonKey,

  [Parameter(Mandatory = $true)]
  [string]$Email,

  [Parameter(Mandatory = $true)]
  [string]$Password,

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

$headers = @{
  apikey = $AnonKey
  Authorization = "Bearer $AnonKey"
  "Content-Type" = "application/json"
}

$body = @{
  email = $Email
  password = $Password
} | ConvertTo-Json -Compress

Write-Host "Obteniendo sesion autenticada..."
$auth = Invoke-RestMethod -Method Post -Uri "$ProjectUrl/auth/v1/token?grant_type=password" -Headers $headers -Body $body
$accessToken = $auth.access_token

if (-not $accessToken) {
  throw "No se pudo obtener un access token para publicar el frontend."
}

$uploadHeaders = @{
  apikey = $AnonKey
  Authorization = "Bearer $accessToken"
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
Write-Host "Frontend publicado."
Write-Host "URL:" $publicUrl
