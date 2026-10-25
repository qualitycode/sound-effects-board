param([string]$BoardFolder = (Join-Path $env:APPDATA 'Sound Effects Board'))
$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
if (Get-Process -Name 'Sound Effects Board' -ErrorAction SilentlyContinue) { throw 'Close Sound Effects Board first.' }
if (-not (Test-Path -LiteralPath (Join-Path $BoardFolder 'pads.json'))) { throw "No board found in $BoardFolder" }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$folder = Join-Path $project "handoffs/Soundboard-for-Dallin-$stamp"
New-Item -ItemType Directory -Path (Join-Path $folder 'Board') -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $project 'dist/win-unpacked') -Destination (Join-Path $folder 'App') -Recurse
Copy-Item -LiteralPath (Join-Path $BoardFolder 'media') -Destination (Join-Path $folder 'Board/media') -Recurse
Get-ChildItem -LiteralPath $BoardFolder -File | Where-Object { $_.Extension -eq '.json' } | Copy-Item -Destination (Join-Path $folder 'Board')
$script = Join-Path $folder 'Board/script.json'
if (-not (Test-Path -LiteralPath $script)) { Copy-Item -LiteralPath (Join-Path $project 'assets/playScript/script.json') -Destination $script }
Copy-Item -Path (Join-Path $PSScriptRoot 'portable-handoff/*') -Destination $folder
Copy-Item -LiteralPath (Join-Path $project 'soundpack/CREDITS.md') -Destination (Join-Path $folder 'SOUND-CREDITS.md')
& (Join-Path $folder 'Make-Return-Zip.ps1') -OutputName "Soundboard-for-Dallin-$stamp"
Write-Host 'Re-run after saving your corrected gong to include it.'
