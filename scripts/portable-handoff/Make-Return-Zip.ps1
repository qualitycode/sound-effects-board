param([string]$OutputName = ('Soundboard-from-Dallin-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff')))
$ErrorActionPreference = 'Stop'
if (Get-Process -Name 'Sound Effects Board' -ErrorAction SilentlyContinue) { throw 'Close Sound Effects Board before making the ZIP.' }
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'Board/pads.json'))) { throw 'Board missing. Extract the entire ZIP first.' }
$zip = Join-Path (Split-Path $PSScriptRoot -Parent) "$OutputName.zip"
if (Test-Path -LiteralPath $zip) { throw "ZIP already exists: $zip" }
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::Open($zip, [IO.Compression.ZipArchiveMode]::Create)
try {
    $prefix = Split-Path $PSScriptRoot -Leaf
    $files = @(Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'App') -Recurse -File)
    $files += @(Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'Board/media') -Recurse -File)
    $files += @(Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'Board') -File | Where-Object { $_.Extension -eq '.json' })
    $files += @(Get-ChildItem -LiteralPath $PSScriptRoot -File)
    foreach ($file in $files) {
        $relative = $file.FullName.Substring($PSScriptRoot.Length + 1).Replace('\', '/')
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, "$prefix/$relative", [IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
} finally { $archive.Dispose() }
Write-Host "ZIP ready: $zip"
