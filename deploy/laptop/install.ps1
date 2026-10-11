$ErrorActionPreference = 'Stop'

$InstallDirectory = Join-Path $HOME 'twenty-crm'
$SourceUrl = 'https://raw.githubusercontent.com/dstenzinger/twenty/main/deploy/laptop'

New-Item -ItemType Directory -Force -Path $InstallDirectory | Out-Null

foreach ($fileName in @('crm.ps1', 'docker-compose.yml')) {
    Invoke-WebRequest -UseBasicParsing -Uri "$SourceUrl/$fileName" -OutFile (Join-Path $InstallDirectory $fileName)
}

Write-Host "Installed to $InstallDirectory"

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $InstallDirectory 'crm.ps1') setup
