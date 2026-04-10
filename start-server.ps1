param(
  [int]$Port = 3000
)

$root = Get-Location

$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".svg"  = "image/svg+xml"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".gif"  = "image/gif"
  ".woff" = "font/woff"
  ".woff2"= "font/woff2"
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()

Write-Host "Server running on http://localhost:$Port"
Write-Host "Press Ctrl+C to stop"

while ($listener.IsListening) {
  $context = $listener.GetContext()
  $request = $context.Request
  $response = $context.Response
  
  $path = $request.Url.LocalPath
  if ($path -eq "/") { $path = "/index.html" }
  
  $filePath = Join-Path $root $path.TrimStart("/")
  $filePath = $filePath.Replace("/", "\")
  
  if (Test-Path $filePath -PathType Leaf) {
    $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
    $contentType = $mime[$ext]
    if (-not $contentType) { $contentType = "application/octet-stream" }
    
    $bytes = [System.IO.File]::ReadAllBytes($filePath)
    $response.ContentType = $contentType
    $response.ContentLength64 = $bytes.Length
    $response.OutputStream.Write($bytes, 0, $bytes.Length)
  } else {
    $response.StatusCode = 404
    $bytes = [System.Text.Encoding]::UTF8.GetBytes("Not found")
    $response.OutputStream.Write($bytes, 0, $bytes.Length)
  }
  
  $response.OutputStream.Close()
}
