$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$cli = Join-Path $projectRoot "tools\\supabase-cli\\supabase.exe"

if (-not (Test-Path -LiteralPath $cli)) {
  throw "Supabase CLI no encontrada en $cli"
}

powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "build-edge-assets.ps1")
& $cli functions deploy portal --no-verify-jwt --project-ref tkbmzjlubpkmtlskjind --workdir $projectRoot

Write-Output "Publicado en https://tkbmzjlubpkmtlskjind.functions.supabase.co/portal/"
