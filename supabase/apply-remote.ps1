param(
  [Parameter(Mandatory = $true)]
  [string]$AccessToken,

  [Parameter(Mandatory = $true)]
  [string]$DbPassword,

  [string]$ProjectRef = "tkbmzjlubpkmtlskjind"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$cli = Join-Path $root "tools\supabase-cli\supabase.exe"

if (-not (Test-Path $cli)) {
  throw "No se encontro la CLI en $cli"
}

Write-Host "Autenticando CLI..."
& $cli login --token $AccessToken

Write-Host "Enlazando proyecto remoto..."
& $cli link --project-ref $ProjectRef --password $DbPassword --workdir $root

Write-Host "Aplicando migraciones remotas..."
& $cli db push --linked --password $DbPassword --workdir $root --include-all

Write-Host "Supabase remoto actualizado."
