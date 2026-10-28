# Direct SSH and soundboard updates

The existing Windows SSH configuration is `C:\Users\larry\.ssh\config`.
Use host **sudanese-larry** (user `larry`), not the separate root alias.
The existing key works; do not copy or share its contents.

Open a server terminal from local PowerShell:

```powershell
ssh -o RemoteCommand=none sudanese-larry
```

Then open the soundboard directory:

```bash
cd /home/larry/apps/soundboard
```

The `RemoteCommand=none` option overrides the existing alias's command that
opens the tour project. In VS Code, use **Remote-SSH: Connect to Host**, choose
`sudanese-larry`, then **File > Open Folder** and select
`/home/larry/apps/soundboard`.

## Update from this Windows checkout

Double-click **Update Soundboard Server.cmd**, or run from local PowerShell:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\browser\update-server.ps1
```

This rebuilds the allowlisted source package, uploads to a unique filename via
SCP, compares local/server SHA-256 checksums, backs up the current `browser`
code, extracts the update, and restarts only PM2 `soundboard`. It checks the
session endpoint and new highlighting script reference afterward. Incomplete
uploads stop before deployment. Node runtime, passwords, published performance
data, Nginx, and other PM2 applications are preserved. No WinSCP is needed.

Requires local Python, OpenSSH, network access, and the existing SSH key.
After a successful update, open the online soundboard once, wait for the new
offline app to download, close all soundboard tabs/windows, and reopen it.

## Confirmed October 27, 2026

Direct SSH authentication and checksum-verified upload succeeded. Highlighting
code was deployed to the existing app and PM2 `soundboard` restarted successfully.
The loopback session returned `{"admin":false}` and served index.html contained
`script-highlights.js`. Real projects and other services were preserved.
