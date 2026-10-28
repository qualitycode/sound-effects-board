# Hosted soundboard preparation

Target: **https://slidetrip.com/sb/**, Windows/Mac browsers. Public playback;
one admin password controls publishing. Existing desktop and Python preview
remain separate. October 27: Larry installed the Node service and verified it on
loopback, then successfully tested and reloaded Nginx after adding the routing.
Public browser access, first publication and production offline playback are not
yet confirmed. See [the latest handoff](../../BROWSER-SOUNDBOARD-HANDOFF.md) before
following installation steps below; do not repeat completed installation steps.

## Behavior

The first online visit downloads the published performance and checks the
complete backup hash plus every recording/image hash before committing the
project and media in one IndexedDB transaction. A service worker saves the
application under `/sb/`. Only a verified project plus complete app cache shows
**Ready offline**. Reopen the same bookmark in the same browser/profile to play
without internet. No Python console is needed for the hosted version.

**Download latest** explicitly replaces the local version. A failed or corrupt
download retains the complete previous version. Updates never download on a
routine revisit. Stop playback and close editors before accepting an update.
App code updates wait for existing tabs to close; do not deploy application code
during a show. Private windows or clearing site data lose downloaded content.
Persistent storage is requested, but browsers can refuse it; keep exports.

Admin: log in while online, import the exported prototype backup, edit locally,
then **Publish performance**. Publishing verifies and stores a complete immutable
version on the server before switching the current-version pointer. Visitors
choose when to download it. Draft edits persist in that admin browser; export a
backup for draft recovery or switching computers. Publishing and editing require
a live admin session; server publishing is authenticated. Session cookies expire
after eight hours or server restart. Playback remains available offline without
login. This is not a private download portal: published script/media are public.

## Server requirements

- Node.js 22 or newer. No npm dependencies or Electron install required.
- Existing Nginx HTTPS server for slidetrip.com.
- An available loopback port, proposed `127.0.0.1:8787`.
- A persistent private data directory outside the public web root.
- Confirm existing Nginx configuration and process manager before deploying.

## Deployment recipe (review against the real server first)

Reviewed October 27: the live HTTPS block is in
`/etc/nginx/sites-enabled/slidetrip.com`, serves `slidetrip.com` and
`www.slidetrip.com`, and uses `/var/www/slidetrip.com/html/tour-prod/dist`.
Production and development tour backends use ports 3000 and 3001; leave those
processes and routes intact. HTTP already redirects to HTTPS. Insert the supplied
soundboard locations before `/shared/` in that HTTPS block. The snippet sends
`www` soundboard visits to the canonical `slidetrip.com` hostname.

The server runs Node 18.20.6 and PM2 as `larry`. Install a supported Node runtime
in a separate application directory and configure only the new `soundboard` PM2
process with its absolute interpreter path. Do not change the system Node,
shell default, or existing PM2 processes. Proposed code location:
`/home/larry/apps/soundboard`; proposed private data location:
`/home/larry/.local/share/soundboard`. Confirmed October 27: Linux x86_64,
glibc 2.31; port 8787 has no listener.

## First installation using WinSCP and the existing SSH terminal

The source-only bundle is created locally with `python browser/package-server.py`:
`handoffs/soundboard-server.zip`. It contains 15 allowlisted program/configuration
files and no recordings, script data, credentials, desktop app, or node_modules.
Upload it using WinSCP to `/home/larry/soundboard-server.zip`.

In an interactive SSH terminal as `larry`, paste this block. It stops at the first
error and refuses to overwrite an existing application directory. When prompted,
type a new admin password (12 or more characters; input is hidden).

```sh
(
set -e
mkdir -p "$HOME/apps"
mkdir "$HOME/apps/soundboard"
python3 -m zipfile -e "$HOME/soundboard-server.zip" "$HOME/apps/soundboard"
cd "$HOME/apps/soundboard"
bash browser/hosted/install-runtime.sh
runtime/bin/node browser/hosted/password.cjs --save
pm2 start browser/hosted/ecosystem.config.js --only soundboard
curl --retry 10 --retry-connrefused --retry-delay 1 --silent --show-error --fail http://127.0.0.1:8787/sb/api/session
pm2 save
pm2 status soundboard
)
```

The installer downloads official Node **v22.23.4 Linux x64**, verifies its pinned
SHA-256 checksum, and extracts it into this app's `runtime/` directory. Checksum
source: https://nodejs.org/download/release/latest-v22.x/SHASUMS256.txt (verified
October 27, 2026). The system Node 18 and existing PM2 apps are unchanged.
PM2's dedicated ecosystem file uses the absolute new interpreter path. The
password tool's `--save` writes only a salted hash to
`~/.config/soundboard/admin.json`, mode 0600; `start.cjs` reads it on each startup.
Do not send that file, your password, or the hash to chat/Git.

Success means `{"admin":false}` from the local session endpoint and a single
new `soundboard` PM2 process marked `online`. This phase does not touch Nginx
or make the application public. Review that output before the routing phase.
After Nginx is configured, log in at HTTPS `/sb/`, import your actual local backup,
and Publish performance; no media needs to be included in the source bundle.

### Routing phase after the loopback check passes

Larry's installation check passed: runtime v22.23.4, PM2 id 16 `soundboard`
online, loopback session response `{"admin":false}`, process list saved. On the
server, back up the current production site and install the bundled snippet:

```sh
sudo cp -Lp /etc/nginx/sites-enabled/slidetrip.com /etc/nginx/slidetrip-before-soundboard-$(date +%Y%m%d-%H%M%S).conf
sudo install -m 644 /home/larry/apps/soundboard/browser/hosted/nginx-location.conf /etc/nginx/snippets/soundboard.conf
sudo nano /etc/nginx/sites-enabled/slidetrip.com
```

Inside the HTTPS block, immediately before `location ^~ /shared/ {`, add exactly
one line (leave all existing lines in place):

```nginx
include /etc/nginx/snippets/soundboard.conf;
```

Save in nano with Ctrl+O, Enter, then exit with Ctrl+X. Test and reload only if
the test succeeds:

```sh
sudo nginx -t && sudo systemctl reload nginx
```

If the test fails, do not reload; share the error. The existing running
configuration remains active. After successful reload, visit HTTPS `/sb/`, log
in as admin, import the original backup from the Windows `backup/` folder,
and Publish performance. Choose Download latest to install the published
version on that browser, wait for Ready offline, then disconnect and reopen the
same bookmark to check playback. Retain the backup independently.

## Manual alternative / later Git-based deployment

Clone/update the GitHub repository in the chosen server application folder.
Do not run the desktop root package's `npm install` or `npm start` on the server.
The executable is `node browser/hosted/server.cjs`.

Generate the password hash on the server's interactive terminal:

```sh
node browser/hosted/password.cjs
```

Store the returned `SB_ADMIN_HASH` in the process manager's private environment.
Set these additional variables there:

```text
SB_ORIGIN=https://slidetrip.com
SB_DATA_DIR=/absolute/private/path/to/soundboard-data
PORT=8787
```

Keep credentials out of Git. The password tool hides typed input. Restrict the
process manager's environment/configuration to the server account. Nginx handles
HTTPS; the Node process listens only on loopback. `SB_ORIGIN` is checked on every
login/logout/publish request, and production cookies are Secure and HttpOnly.

Optional first seed: transfer your **own exported backup**, not integration-test
artifacts, to a private server path and set `SB_INITIAL_BACKUP` to that file.
It seeds only if nothing has been published yet. Alternatively log in and import
the backup in the hosted browser, then publish. Existing publications are never
silently overwritten by a restart.

Start the service using the server's existing process manager. If PM2 is already
used, the reviewed command will have this form after its environment is set:

```sh
pm2 start browser/hosted/server.cjs --name soundboard
pm2 save
```

Merge `nginx-location.conf` into the existing HTTPS server block, preserving all
other routes. Port 8787 and the actual configuration file still need confirmation.
Run `sudo nginx -t` before reloading Nginx. Configure the existing HTTP site to
redirect `/sb` and `/sb/…` to HTTPS if it does not already redirect all HTTP.

Back up `SB_DATA_DIR` independently of Git/deployments. It contains all published
script/media snapshots, with the current pointer in `current.json`. Retaining
previous versions permits recovery; pruning/version deletion is not implemented.

## Required acceptance check

Visit HTTPS `/sb/` in Chrome/Edge on Windows and Chrome/Safari on Mac. Wait for
**Ready offline**, then disconnect the network, close/reopen the tab, and play
cues. Check admin login/logout, reject publishing without a login, import the
latest backup, publish, deliberately accept an update from a second profile,
and confirm that an interrupted download retains the old performance. Test a
full listening rehearsal on the computer used for the show.

Automated local checks are in `../test-hosted.cjs`; they run an isolated server,
disposable Chrome profile, and copied publication data. They never publish to
slidetrip.com or use your regular browser's storage.

From the repository root on this Windows development computer:

```powershell
$env:ELECTRON_RUN_AS_NODE = '1'
Start-Process -FilePath '.\node_modules\electron\dist\electron.exe' -ArgumentList 'browser/test-hosted.cjs' -WindowStyle Hidden -Wait
Get-Content browser/test-results/hosted.log
```

The final line must be `ALL CHECKS PASSED`. The suite uses local port 18787 and
Chrome debugging port 19327. Windows Chrome checks pass, including offline
reopening/playback, authorization, update verification/recovery, and admin
publishing. Full local-prototype regression checks also pass. Mac acceptance and
production HTTPS/Nginx checks remain pending.
