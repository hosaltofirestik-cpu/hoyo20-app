$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$functionDir = Join-Path $PSScriptRoot "functions\\portal"
$outputFile = Join-Path $functionDir "_generated-assets.ts"

New-Item -ItemType Directory -Force -Path $functionDir | Out-Null

$indexHtml = Get-Content -LiteralPath (Join-Path $root "index.html") -Raw

$assets = @(
  @{
    Route = "/"
    Source = $indexHtml
    ContentType = "text/html; charset=utf-8"
    CacheControl = "no-store"
    Kind = "inline"
  },
  @{
    Route = "/index.html"
    Source = $indexHtml
    ContentType = "text/html; charset=utf-8"
    CacheControl = "no-store"
    Kind = "inline"
  },

  @{
    Route = "/styles.css"
    File = Join-Path $root "styles.css"
    ContentType = "text/css; charset=utf-8"
    CacheControl = "public, max-age=300"
    Kind = "file"
  },
  @{
    Route = "/app.js"
    File = Join-Path $root "app.js"
    ContentType = "application/javascript; charset=utf-8"
    CacheControl = "public, max-age=300"
    Kind = "file"
  },
  @{
    Route = "/supabase-config.js"
    File = Join-Path $root "supabase-config.js"
    ContentType = "application/javascript; charset=utf-8"
    CacheControl = "public, max-age=300"
    Kind = "file"
  },
  @{
    Route = "/supabase-service.js"
    File = Join-Path $root "supabase-service.js"
    ContentType = "application/javascript; charset=utf-8"
    CacheControl = "public, max-age=300"
    Kind = "file"
  },
  @{
    Route = "/vendor/xlsx.full.min.js"
    File = Join-Path $root "vendor\\xlsx.full.min.js"
    ContentType = "application/javascript; charset=utf-8"
    CacheControl = "public, max-age=300"
    Kind = "file"
  },
  @{
    Route = "/modules/invoices/invoice-module.js"
    File = Join-Path $root "modules\\invoices\\invoice-module.js"
    ContentType = "application/javascript; charset=utf-8"
    CacheControl = "public, max-age=300"
    Kind = "file"
  },
  @{
    Route = "/modules/invoices/invoice-module.css"
    File = Join-Path $root "modules\\invoices\\invoice-module.css"
    ContentType = "text/css; charset=utf-8"
    CacheControl = "public, max-age=300"
    Kind = "file"
  },
  @{
    Route = "/assets/hoyo20-mark.svg"
    File = Join-Path $root "assets\\hoyo20-mark.svg"
    ContentType = "image/svg+xml"
    CacheControl = "public, max-age=86400"
    Kind = "file"
  }
)

$entries = foreach ($asset in $assets) {
  if ($asset.Kind -eq "inline") {
    $body = [System.Text.Encoding]::UTF8.GetBytes($asset.Source)
  } else {
    $body = [System.IO.File]::ReadAllBytes($asset.File)
  }

  $base64 = [System.Convert]::ToBase64String($body)
  @"
  "$($asset.Route)": {
    contentType: "$($asset.ContentType)",
    cacheControl: "$($asset.CacheControl)",
    bodyBase64: "$base64",
  }
"@
}

$output = @"
export type AssetRecord = {
  contentType: string;
  cacheControl: string;
  bodyBase64: string;
};

export const APP_ASSETS: Record<string, AssetRecord> = {
$($entries -join ",`n")
};
"@

Set-Content -LiteralPath $outputFile -Value $output -Encoding UTF8
Write-Output "Generated $outputFile"
