# Browser soundboard: decisions and next-chat handoff

Updated: October 25, 2026

## Goal and status

Replace the awkward Mac/Windows executable and ZIP update workflow with a shared browser soundboard. Keep the play script with embedded cue buttons. Support downloading a complete performance version for offline use.

A local browser prototype is ready for local rehearsal testing following Larry's approval. Browser integration checks pass. No Google Sheet, Drive integration, authentication, hosted site, or offline browser download has been created. The exact hosting and storage architecture still needs selection. Preserve the existing desktop application.

## Completed local prototype verification — October 25, 2026

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

## Suggested next-chat request

Read BROWSER-SOUNDBOARD-HANDOFF.md, especially the current implementation handoff. Continue the approved local browser prototype: fix the known incomplete cue rendering, finish browser verification, and give me simple launch instructions. Preserve the desktop app and private assets. Do not deploy or change DNS. Keep replies concise and update the handoff when milestones pass.

## Working efficiently

- Treat this file as the compact source of agreed decisions; update it when decisions change.
- Read relevant files and targeted sections instead of printing entire directories or logs.
- Work in bounded milestones; report changed behavior, verification, and blockers briefly.
- Do not repeat settled questions or run broad checks unrelated to a change.
- Verify external technical details only when needed; summarize findings with short links.
