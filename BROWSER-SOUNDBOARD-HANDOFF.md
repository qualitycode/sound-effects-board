# Browser soundboard: decisions and next-chat handoff

Updated: October 27, 2026

## Script highlighting update — October 27

Implemented and deployed October 27 through direct SSH using the existing `sudanese-larry` host alias. The earlier manual upload served old code; the agent rebuilt and uploaded the package to a unique remote filename, verified SHA-256, backed up server code, extracted, and restarted only PM2 `soundboard`. Loopback session returned `{"admin":false}` and the served index now includes `script-highlights.js`. Other PM2 processes retained their PIDs. No Nginx/runtime/password changes. Browser acceptance after this deployment remains to be confirmed.

Future updates: double-click `Update Soundboard Server.cmd` locally. It runs `browser/update-server.ps1`, which packages, uploads, checksum-verifies, backs up, applies and verifies the update. Connection and usage documentation: [SERVER-CONNECTION.md](SERVER-CONNECTION.md). SSH is already configured in `C:\Users\larry\.ssh\config`; use `ssh -o RemoteCommand=none sudanese-larry` to avoid the alias's existing tour-directory command. Do not read/share private key contents. Existing soundboard tabs must close and reopen for the new app cache to activate.

In Script Edit Mode, select words and press **1 yellow / 2 pink / 3 green**, or use the toolbar. Click or select a dashed blank line below any paragraph/SFX cue to save a colored stripe. **0 / Clear highlight** removes selected highlighting. Text selection no longer opens the passage editor; use **Edit passage**. SFX cue words also support selection without triggering the cue. Changed paragraph wording or a renamed cue clears that block's highlights and blank marker; notes/reader changes preserve them. Highlights persist in browser storage, exported backups, publishing and offline views. Old sound/cue shortcuts on 1–3 are cleared when loaded/imported, and those keys cannot trigger audio or be reassigned.

Verification: `browser/test-highlights.cjs` passes isolated Chrome checks for selections across paragraphs, overlap/recolor/clear, blank stripes, SFX selection, rehighlighting after edits, backup validation and reload persistence. Existing prototype and hosted suites also pass; hosted checks include publishing and offline rendering of text/blank highlights. Logs: ignored `browser/test-results/{highlights,integration,hosted}.log`. Preview: `browser/test-results/highlight-preview.png`. Existing desktop source/data and real browser projects were not changed. Mac and actual production rehearsal acceptance remain pending.

## Goal and status

Replace the awkward Mac/Windows executable and ZIP update workflow with a shared browser soundboard. Keep the play script with embedded cue buttons. Support downloading a complete performance version for offline use.

A local browser prototype is ready for local rehearsal testing. The hosted Node service is installed and verified on loopback, and Larry successfully tested and reloaded Nginx after adding the soundboard routing. Public browser access, the first real publication, and production offline playback have not yet been confirmed. Hosted admin/offline tests pass locally. Google Sheets/Drive integration is not implemented. Preserve the existing desktop application.

## Start here in the next chat — latest confirmed state, October 27

Larry requested a fresh-chat handoff at this point. This section supersedes historical pending steps below. Keep replies concise and give exact commands in small steps. Do not repeat installation or add a duplicate Nginx include.

### Installed and confirmed by Larry

- Target URL: `https://slidetrip.com/sb/`. HTTP already redirects to HTTPS. Public playback; only the admin edits/publishes. Intended clients: Windows and Mac computers.
- Server: `larry@sudanese-ubuntu-20`, Linux x86_64, glibc 2.31. System Node remains v18.20.6 for existing applications.
- Soundboard code: `/home/larry/apps/soundboard`, uploaded from the source-only `handoffs/soundboard-server.zip` via WinSCP. Dedicated interpreter: `/home/larry/apps/soundboard/runtime/bin/node`, verified v22.23.4. Installer verified the official download's pinned SHA-256.
- PM2 process `soundboard`, id 16, online with zero restarts when checked; `pm2 save` succeeded. Loopback `http://127.0.0.1:8787/sb/api/session` returned `{"admin":false}`. Initial curl connection refusals were successful startup retries, not an unresolved failure.
- Admin password was chosen on the server and saved as a salted hash in `/home/larry/.config/soundboard/admin.json` (0600). Never ask Larry to paste the password, hash, or this file. The password for `sudo` is his server-account password, which may differ from the soundboard admin password.
- Published data defaults to `/home/larry/.local/share/soundboard`, outside the web root and code bundle. No real publication has been confirmed yet.
- Existing PM2 processes `slidetrip`, `slidetrip-dev`, `afr-writingtest-api`, `afr-writingtest-dev-api`, and `afr-writingtest-dev-web` were preserved. Production tour backend is on port 3000; dev is on 3001. Never restart all PM2 processes or upgrade system Node for this task.
- Production Nginx file: `/etc/nginx/sites-enabled/slidetrip.com` (may be a symlink). Root remains `/var/www/slidetrip.com/html/tour-prod/dist`. Soundboard snippet installed at `/etc/nginx/snippets/soundboard.conf`; Larry was guided to insert `include /etc/nginx/snippets/soundboard.conf;` immediately before the existing `/shared/` location in the HTTPS block. It proxies `/sb/` to 8787 and canonicalizes soundboard www visits to `slidetrip.com`.
- Confirmed backup: `/etc/nginx/slidetrip-before-soundboard-20261027-162624.conf`, 2455 bytes. Its April 9 modification date is expected: `cp -p` preserved the original timestamp; the filename records the October 27 backup time.
- Larry ran `sudo nginx -t && sudo systemctl reload nginx`; output confirmed syntax OK and configuration test successful, then returned to the prompt without reload errors. Do not ask him to repeat the edit/reload unless verification exposes a problem.

### Next steps — not yet confirmed

1. Open `https://slidetrip.com/sb/` and confirm it loads. No independent public HTTPS/browser verification has been recorded since the reload. If it fails, diagnose the specific response before changing configuration.
2. Click Admin login and use the password already created. An empty/unpublished project before first import is expected; the empty-site login/import flow passed automated tests.
3. Import the real exported backup from `C:\projects\misc\soundEffects\backup\Soundboard-backup-2026-10-26.json`. It was validated locally: 64 sounds, 41 script pages, 64 media files. Do not import the synthetic/edited `browser/test-results/test-backup.json`.
4. Publish performance, then Download latest and accept replacement of that browser's draft. Wait for Ready offline. This should be the first public real performance; do not claim it already exists.
5. Disconnect the internet, close the tab, reopen the exact same HTTPS address in the same browser/profile, and play cues. Confirm script, notes, people/colors, media and playback work. Windows and Mac production listening/rehearsal acceptance remains pending.
6. Export a fresh backup after important edits. Local preview storage (`127.0.0.1:8765`) is separate from hosted HTTPS storage; edits do not transfer automatically. Draft edits stay in the admin browser until published or exported.

### Workspace and verification

- Local VS Code checkout: `C:\projects\misc\soundEffects`, remote `https://github.com/qualitycode/sound-effects-board.git`. Server was installed from a ZIP, not from a confirmed GitHub push. At handoff, browser work includes modified tracked files and untracked `browser/hosted/`, `browser/package-server.py`, and `browser/test-hosted.cjs`; no commit or push was performed in this session. Preserve existing changes. A fresh clone may not contain the hosted work until it is committed/pushed.
- Source-only package builder: `python browser/package-server.py`. It now allowlists 16 program/config files and excludes script/media, passwords, desktop app and node_modules. The uploaded ZIP predates the highlighting feature; future local source changes require a deliberate server update. Rebuilding a ZIP alone does not update the server.
- Private `backup/`, `handoffs/`, `browser/dist/local-project/`, `browser/test-results/`, and `browser/server-data/` remain ignored. Do not commit or publicly expose these directories. Published performance snapshots are intentionally downloadable from the hosted app.
- Last passing checks: full local prototype regression; hosted auth/publishing, hash verification, failed-update recovery, explicit update acceptance, offline navigation/audio, logout, offline edit lock; empty-site admin login/import/first publication. Tests used disposable Chrome profiles and an isolated local server, not production. Logs are under ignored `browser/test-results/`. Linux runtime and loopback startup are now confirmed by Larry; public production/offline acceptance remains outstanding.
- Desktop files and saved board were preserved. Local cue buttons use each person's full color with automatic readable text; playing indicators retain that fill. Selected script words and blank-line markers now support yellow/pink/green highlighting; see the update above.

### Suggested next-chat prompt

> Read BROWSER-SOUNDBOARD-HANDOFF.md, especially "Start here in the next chat". The soundboard service is installed and Nginx has passed its test and reloaded. Continue from public browser verification, admin backup import, first publication, and offline playback testing. Do not reinstall or duplicate Nginx routing. Preserve existing sites, PM2 processes, desktop app, and private assets. Keep replies concise and give exact steps.

## Hosted implementation history — October 26–27, 2026

The following records progress in order. Earlier "pending" statements are historical; use the Start here section above for current status.

- Larry requested `https://slidetrip.com/sb/` with offline use after loading, simple admin login, and Windows/Mac computer support. Repository confirmed as `https://github.com/qualitycode/sound-effects-board` (this checkout). Existing server uses Nginx; process manager and actual Nginx site configuration remain unknown. PM2 is a possibility, not confirmed.
- Prepared `browser/hosted/server.cjs` (Node 22+, no dependencies, loopback port 8787), salted password-hash tool, service worker, hosted controls, backup validation, Nginx location snippet and deployment instructions. No remote server, DNS, GitHub push, or production configuration changes made.
- Hosted playback is public. Admin sessions are checked on the server for publishing; same-origin request checks, HttpOnly/Secure production cookies, login throttling and salted scrypt hashes protect the admin routes. Hosted edits require an online admin session. Drafts stay in that admin browser; publishing uploads a complete verified immutable snapshot to private server storage and atomically switches the current-version pointer. This milestone uses Node file storage rather than Google integrations.
- First online visit downloads and verifies the complete published performance. `/sb/` service worker caches the app; the app shows Ready offline only with complete app cache and verified media stored in IndexedDB. New performance versions require Download latest; failed/corrupt downloads retain the previous complete performance. App code updates wait for existing tabs to close. Existing desktop/local-preview browser data is separate and preserved.
- Found Larry's real export at `backup/Soundboard-backup-2026-10-26.json`: 64 sounds, 41 pages, 64 media files; server schema/reference/hash validation passes. Do not use `browser/test-results/test-backup.json` as the first real publication. `backup/`, `browser/server-data/`, and `browser/.env` are ignored to protect media/credentials.
- `browser/test-hosted.cjs` passes in disposable Windows Chrome: no-login publishing rejection, origin checks, wrong-password rejection, session/logout, private-path denial, corrupt-publication rejection, initial complete download, hidden/nonfunctional anonymous editing, browser audio, offline navigation/reopening and audio, no auto-update, corrupt-download recovery, deliberate update, admin editing/publishing, and offline draft retention with editing locked. Full `browser/test-prototype.cjs` regression suite also passes, without console errors. Mac and production HTTPS acceptance remain pending.
- October 27 server details received: Node 18.20.6, PM2 running as `larry`, with production `slidetrip`, development `slidetrip-dev`, and three AFR processes. Nginx config validates. Production HTTPS block: `/etc/nginx/sites-enabled/slidetrip.com`, names `slidetrip.com www.slidetrip.com`, root `/var/www/slidetrip.com/html/tour-prod/dist`, API/backend port 3000. Dev tour backend uses 3001. HTTP already redirects to HTTPS. Preserve existing routes and processes. Updated soundboard snippet to canonicalize www visits to avoid separate offline storage and failed admin Origin checks.
- October 27 platform checks received: x86_64, glibc 2.31, no listener on port 8787. Prepared a separate interpreter installer for official Node v22.23.4 Linux x64, pinned to the SHA-256 verified against Node's release checksums. It installs only to the app's `runtime/` folder; it does not change PATH/system Node. Shell syntax and the dedicated single-process PM2 configuration were checked.
- Packaged `handoffs/soundboard-server.zip` using `browser/package-server.py`: 15 allowlisted source/config files, no media, credentials, desktop app, or node_modules. Larry should upload it with WinSCP to `/home/larry/soundboard-server.zip`, then follow the installation block in `browser/hosted/README.md` (also supplied in chat). It extracts to `/home/larry/apps/soundboard`, saves a salted admin hash at `~/.config/soundboard/admin.json` with mode 0600 using the interactive `password.cjs --save`, and starts only PM2 `soundboard` using its private interpreter and `start.cjs`. Data defaults to `/home/larry/.local/share/soundboard`. No password/hash should be pasted into chat.
- Hosted tests pass with the private-config launcher, including a new first-installation test: initially no publication, admin login/reload, import backup, then first Publish. Existing auth/offline/update tests continue to pass. Node runtime download/execution on the actual Linux server and Nginx routing remain pending. Ask Larry to paste the install block's final loopback session response (`{"admin":false}` expected) and `pm2 status soundboard` before giving the routing/reload phase. No server changes made by the agent.
- Installation result received October 27: dedicated Node v22.23.4 runs, admin password hash saved privately, PM2 process `soundboard` id 16 is online with zero restarts, port 8787 returns `{"admin":false}`, and `pm2 save` succeeded. Two initial curl connection refusals were followed by a successful automatic retry. Existing production/dev/AFR processes remain online with the same PIDs. Next: copy the bundled Nginx snippet to `/etc/nginx/snippets/soundboard.conf`, back up the production site configuration outside sites-enabled, insert exactly one include before the production `/shared/` location using nano, test Nginx and reload only on success. Then verify HTTPS `/sb/`, admin login, import Larry's real backup, Publish, Download latest, and offline playback. No production script/media has been published yet.

## Completed local prototype verification — October 25, 2026

- October 26 cue-color fix: assigned people's colors now fill cue buttons in Script and Cues views, with automatic black/white text contrast. Playing cues retain the person's fill and use a border/ring indicator. Checked both views, light/dark contrast, and playing styling in disposable Chrome; no saved user edits or desktop files changed.
- Follow-up launch fix: the user-launched server could not read the snapshot because Python 3.13 `mkdtemp` created an owner-only Windows ACL that survived the staging-directory rename. Enabled normal parent-permission inheritance on the existing private snapshot and replaced `mkdtemp` staging with a UUID-named ordinary directory. Verified the running user-launched server serves project JSON and all 64 media files with matching hashes, and the normal Windows account can read the snapshot. Reloading the existing browser tab retries initial import; no desktop or browser edits were reset.
- Fixed script cue rendering: saved cue names, shortcuts, responsible people/colors, live status, and highlighted cue notes now appear beside the script. Corrected Cues view hints and placeholder punctuation.
- Both sound and cue editors reject shortcuts already assigned to the other type.
- Installed Chrome runs the integration harness with a disposable profile outside the restricted execution sandbox. No installed Electron files, permissions, desktop source, production site, or DNS were changed. The CDP driver now reports startup failures and bounds endpoint polling; the harness scopes repeated backup input setup correctly.
- Integration checks pass: 64 imported sounds, 95 cues, 41 pages, actual saved cue actions, real browser audio playback, Stop All, people/readers, passage editing and highlighted notes, uploads, cue metadata/notes, shortcut conflicts, per-action × overall gain, exactly three natural repeats, repeat/delay cancellation, shortcut playback, continuing a loop at its existing level, fade completion, replacement audio preserving IDs/cue links, live instructions without audio, reload persistence, full backup download, damaged-backup rejection, and verified backup recovery. No browser console errors.
- Reviewed screenshots of Pads, Cues, and Script. Logs, screenshots, and the media-containing test backup remain ignored under `browser/test-results/`.
- Desktop JSON/media file hashes were unchanged across verification (67 files). Git confirms no changes to `src/`, `main.js`, `preload.js`, or desktop package/build configuration. Browser sources are visible to git; private snapshot and test artifacts are ignored.
- Launch: double-click `Open Browser Preview.cmd`, keep its console open, and use `http://127.0.0.1:8765`. Python 3 is required. Edits stay in that browser/profile/address; export a backup to retain a separate copy.
- This completes the approved local prototype milestone. Human listening/rehearsal and Mac/browser coverage remain useful before a performance. Hosted offline launch, publishing, authentication, and Google integration remain separate future work; do not label this prototype Ready offline.

## Earlier implementation handoff — historical, superseded by checks above

The following records the earlier incomplete state for context. Its outstanding local fixes and verification are completed above.

### New context and approval

- Larry has a DigitalOcean account and the domain `slidetrip.com`. A possible future subdomain is `soundboard.slidetrip.com`; nothing has been provisioned or changed. Inspect the existing hosting/DNS before proposing deployment changes.
- Larry approved building the LOCAL prototype first, preserving the desktop app. This is not authorization to change the existing production website or DNS.
- Prototype defaults proposed: paragraph-based script editing; display-only live musician cues; continuing an already-running loop retains its existing level; internet required for editing/publishing in the final product; deliberate update acceptance.

### Files created

- `Open Browser Preview.cmd`: runs `python browser/serve.py` and opens a local browser.
- `browser/prepare_project.py`: copies the Windows saved board into `browser/dist/local-project/`, preserving existing sound IDs and actual saved cue assignments. It leaves an existing snapshot alone. Ran successfully: 64 pads, 95 cues, 41 pages. No desktop data was changed.
- `browser/serve.py`: read-only static development server on `127.0.0.1:8765`; no network hosting or Google connection. Python 3 is needed on the development machine.
- `browser/dist/index.html`, `styles.css`, `renderer.js`, `script-view.js`: separate copies/adaptations of desktop UI code. Originals in `src/`, `main.js`, `preload.js`, and desktop build configuration were not edited.
- `browser/dist/browser-api.js`: browser IndexedDB adapter, verified first-import media copies, uploads/recordings, people/color editor, project backup export/import with media hashes, stable-ID passage/cue metadata.
- `browser/README.md`: run instructions, source-copy behavior, features and limits.
- `browser/test-prototype.cjs`: integration test using a throwaway browser profile; checks import, audio, repeat/delay cancellation, script notes, cue levels, persistence, and backup recovery. Not yet passing.
- `browser/chrome-test-driver.cjs`: experimental installed-Chrome CDP adapter for that test because Electron could not launch under current sandbox permissions. Also not yet verified.
- `.gitignore` includes explicit exceptions to track browser/dist source while excluding private `browser/dist/local-project/`, snapshot staging, Python cache, and `browser/test-results/`.

### Implemented intent (needs verification/fixes)

- Pads, Script, and a new Cues grid; loops, shortcuts and Stop All.
- Named cue settings, responsible person, shortcut, per-action level and overall cue volume; live performer instructions.
- People/colors and script paragraph wording, reader assignment and highlighted notes.
- Browser-local edits persist separately from desktop data; full JSON backup includes media.
- No service worker or hosted offline launch yet: local playback requires the Python server. Do NOT label this version Ready offline.
- No super-user authentication yet; all local prototype controls are editable.

### Verification status and immediate next work

1. JavaScript syntax checks passed using Electron in Node mode. Snapshot creation succeeded. No successful end-to-end browser test or reviewed screenshot yet.
2. The installed Electron GUI fails with an AppContainer/ALL APPLICATION PACKAGES ACL error. `--no-sandbox` did not resolve it. A disposable Electron runtime copy was made under `%TEMP%/soundboard-browser-electron`; adding read/execute permission to that TEMP copy did not resolve it either. Do not alter the project's installed Electron ACL or desktop app to solve testing.
3. A Chrome CDP test was attempted using the installed Chrome, a throwaway profile, and localhost debugging port 19327. Its log was still empty at handoff. Diagnose the driver/browser startup first. The harness uses the Electron binary in Node mode because `node` is not on PATH.
4. Known incomplete source transformation: `browser/dist/script-view.js` function `refresh()` still sets script cue button text from the original `cue.cue`. It must use saved cue name, shortcut and person metadata, and populate the `[data-note-for]` note element. The Cues grid already reads metadata. This likely happened because an exact source-string replacement did not match existing Unicode/encoding. Fix explicitly rather than rerunning the original copy step, which would overwrite browser work.
5. Check other source transformations, UI runtime errors, keyboard conflicts, and persistence before claiming completion. In particular, the test's three-pulse cue, overall gain calculation, backup round trip, and saved notes need actual execution.
6. Validate that prototype edits do not modify the desktop board; private media/script must stay ignored. Ensure all intended browser source files are visible to git.
7. Update this document with the final passing checks and provide Larry simple launch instructions only once the local prototype is ready.

Existing development processes may still need cleanup: only stop processes identified by `browser/serve.py --no-open`, this prototype's `test-prototype.cjs`, or its temporary Chrome profile. Do not terminate unrelated Chrome or desktop soundboard processes. Check whether port 8765 is already occupied before starting another preview.

Project: `C:\projects\misc\soundEffects`. Read this document first; consult `README.md` and relevant source files as needed.

## Agreed operating model

- Only ONE super-user edits and publishes everything: script, notes, casting, colors, sounds, cues, shortcuts, and levels.
- Other users have playback/read access and download published updates.
- Only ONE computer runs the actual performance.
- No synchronized screens, shared playback commands, simultaneous editing, or edit conflict resolution is required.
- Mac and Windows should use the same browser application.
- Performer colors remain useful for people reading or performing from the single screen; a cue may represent a live musician rather than a recording.

## Required features

1. Script view with embedded sound/cue buttons, like the existing application.
2. User-added notes attached to script passages, with selectable highlight colors.
3. Color-coded cue buttons identifying the responsible person, including live performers such as a piano player. Include names as well as colors.
4. Dialogue lines colored according to the assigned reader. Keep casting assignments editable.
5. Large playback buttons, loops, playing indicators, and Stop All. Do not put volume controls on the main performance board.
6. Named cues and shortcuts that match the buttons referenced in the script. A cue can contain multiple actions. Preserve existing action capabilities: play once, start loop, continue/start loop, stop, fade, delay, and repeat count. The cue editor should define each sound action's volume plus an overall cue volume.
7. Initial online setup followed by complete offline playback: save the app, script, notes, assignments, settings, and all needed sounds to the local computer.
8. Upload/add new recordings and replace existing recordings without breaking cue links.

## Proposed publishing workflow

1. Super-user edits a draft through the browser app.
2. Publish creates a numbered, consistent performance version.
3. Other users see an available update while online and explicitly choose Download latest version.
4. Download every required resource and verify completeness before showing Version N — Ready offline.
5. A failed download retains the previous complete working version.
6. Performance uses the downloaded version. Never apply updates automatically during playback or a show.
7. Keep a downloadable backup/export in addition to browser storage, which can be cleared.

Playback needs no network after a successful download. Editing/publishing and update downloads can require internet; offline editing is not a requirement under the simplified operating model.

## Storage and technical direction

Larry favors Google Sheets plus a custom browser soundboard. Proposed roles: Sheets for structured project data; Drive for recordings; browser app for editing and performance. These roles are proposals, not a completed integration or final architecture choice.

Evaluate offline-capable hosting, Google authentication/file access, browser storage capacity/persistence, and reliable media downloads before committing to implementation. Do not assume Google Drive preview links are directly playable/downloadable audio URLs. A hosted browser app with service-worker support is the intended offline approach; a spreadsheet alone does not provide the performance UI.

Use stable IDs for sounds, script passages, people, cues, and actions. Renaming or replacing a recording must preserve its references. Treat a published version as a complete snapshot to prevent mixed script/audio versions.

## Existing project and reusable behavior

- Electron app: `main.js`, `preload.js`, `src/renderer.js`, `src/script-view.js`, `src/index.html`, styles, and `cue-presets.js`.
- Local script data: `assets/playScript/script.json`; supporting cue plan and notes are in that directory. Script/downloaded sounds are intentionally excluded from git; preserve their private handling and sound credits.
- Existing sound pack: `soundpack/pack.json`, audio files, and `CREDITS.md`.
- Existing script contains 41 extracted pages and 95 cues. README describes prepared assignments using the original 60-sound pack; Larry's saved board had 64 pads when checked October 17.
- Normal Windows saved board: `%APPDATA%\Sound Effects Board`, including `pads.json`, `media`, cue assignments and related JSON.
- App copies selected recordings into its own media directory. Editing an original audio file alone does not update that saved copy; replacing through the app does.
- Existing cue assignments reference pad IDs. Renaming/replacing a pad's audio preserves those assignments; deleting/recreating a pad does not. Prepared-action reset currently resolves by label and requires attention during migration.
- Sound-pack export includes recordings and pad settings but does not include script cue assignments.

## Earlier ZIP work (legacy workflow)

`Make-Dallin-Zip.cmd` and `scripts/make-dallin-zip.ps1` package the Windows app and saved board. Templates in `scripts/portable-handoff` provide Open Soundboard.cmd and Make-Return-Zip.cmd. The launcher sets SFX_DATA_DIR to a Board folder beside the App folder. `handoffs/` is ignored by git.

The older `scripts/dallin-handoff` templates are for an audio-only clock task and are superseded for whole-board handoffs. Do not mistake them for the browser redesign.

Larry already corrected `fr-458591.mp3` and replaced the sound through the running app. The October 17 ZIP was verified to include the corrected recording on the renamed Clock Strikes Once pad. Do not ask Larry to redo this or treat the gong correction as outstanding. Preserve actual saved cue assignments during migration; do not infer them from pad names.

## Remaining decisions

- For live musician cues: display-only instruction, or operator acknowledgement/started/finished state?
- Does a super-user need to edit script wording as well as annotations? Broad script editing is requested, but the exact editing/import interface is undecided.
- Exact Google Sheets schema, Drive storage strategy, hosting, super-user identity, and read-access rules.
- Supported browsers and how users install/open their offline copy.
- Define overall cue volume behavior when continuing a sound already running from a previous cue.

## Earlier local-prototype next-chat request (superseded)

Read BROWSER-SOUNDBOARD-HANDOFF.md, especially the current implementation handoff. Continue the approved local browser prototype: fix the known incomplete cue rendering, finish browser verification, and give me simple launch instructions. Preserve the desktop app and private assets. Do not deploy or change DNS. Keep replies concise and update the handoff when milestones pass.

## Working efficiently

- Treat this file as the compact source of agreed decisions; update it when decisions change.
- Read relevant files and targeted sections instead of printing entire directories or logs.
- Work in bounded milestones; report changed behavior, verification, and blockers briefly.
- Do not repeat settled questions or run broad checks unrelated to a change.
- Verify external technical details only when needed; summarize findings with short links.
