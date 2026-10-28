$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

function Assert-Success([string]$Step) {
    if ($LASTEXITCODE -ne 0) { throw "$Step failed (exit $LASTEXITCODE)." }
}

try {
    python browser/package-server.py
    Assert-Success 'Packaging'
    $archivePath = Join-Path (Get-Location) 'handoffs/soundboard-server.zip'
    $expectedHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
    $remoteArchive = '/home/larry/soundboard-upload-' + [guid]::NewGuid().ToString('N') + '.zip'
    Write-Host 'Uploading through the existing sudanese-larry SSH connection...'
    scp -o BatchMode=yes -o ConnectTimeout=15 -o RemoteCommand=none $archivePath "sudanese-larry:$remoteArchive"
    Assert-Success 'Upload'
    $remoteHashOutput = ssh -T -o BatchMode=yes -o ConnectTimeout=15 -o RemoteCommand=none sudanese-larry "sha256sum '$remoteArchive'"
    Assert-Success 'Remote checksum'
    if (($remoteHashOutput -split '\s+')[0] -ne $expectedHash) { throw 'Upload checksum mismatch. Server update was not started.' }
    Write-Host 'Checksum verified. Backing up code and restarting only soundboard...'
    $deployCommand = @'
set -eu
cd /home/larry/apps/soundboard
tar -czf "/home/larry/soundboard-code-before-update-$(date +%Y%m%d-%H%M%S).tar.gz" browser
python3 -m zipfile -e '__ARCHIVE__' .
test -f browser/dist/script-highlights.js
grep -q script-highlights browser/dist/index.html
pm2 restart soundboard
curl --retry 10 --retry-connrefused --retry-delay 1 --silent --show-error --fail http://127.0.0.1:8787/sb/api/session
printf '\n'
curl --silent --show-error --fail http://127.0.0.1:8787/sb/index.html | grep script-highlights
pm2 status soundboard
'@
    $deployCommand = $deployCommand.Replace('__ARCHIVE__', $remoteArchive).Replace("`r", '')
    $deployCommand | ssh -T -o BatchMode=yes -o ConnectTimeout=15 -o RemoteCommand=none sudanese-larry 'bash -s'
    Assert-Success 'Server update'
    Write-Host 'Update complete. Close all soundboard tabs/windows, then reopen https://slidetrip.com/sb/.'
} catch {
    Write-Error $_
    exit 1
}
