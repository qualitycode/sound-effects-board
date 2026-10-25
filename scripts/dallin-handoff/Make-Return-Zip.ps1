$ErrorActionPreference = 'Stop'
$audio = @(Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'Finished') -File | Where-Object { $_.Name -in @('Clock Single Strike.wav', 'Clock Single Strike.mp3') })
if ($audio.Count -ne 1 -or $audio[0].Length -eq 0) { throw 'Save exactly one nonempty Clock Single Strike.wav or .mp3 in Finished first.' }
$zip = Join-Path (Split-Path $PSScriptRoot -Parent) ('Dallin-Clock-Update-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff') + '.zip')
Compress-Archive -LiteralPath (Join-Path $PSScriptRoot 'Finished'), (Join-Path $PSScriptRoot 'Changes.txt'), (Join-Path $PSScriptRoot 'READ-ME.txt') -DestinationPath $zip
Write-Host "Send this ZIP to Larry: $zip"
