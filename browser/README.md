# Local browser prototype

The Node/Nginx hosted version for `/sb/` is prepared separately in [hosted/README.md](hosted/README.md). It adds admin publishing, explicit performance updates, and offline app reopening. It has not been deployed. The instructions below still launch the unchanged local-preview workflow.

From the project folder, double-click **Open Browser Preview.cmd**. Python 3 is required on this development computer. Keep the console window open and use the printed address, normally http://127.0.0.1:8765. Close other preview tabs while editing.

This is a local prototype, not the final hosted app. No DigitalOcean, DNS, Google account, or production deployment is changed. The existing desktop app and its saved files are untouched.

## Try it

- **Pads**: play individual sounds; looping pads toggle on/off. Keyboard shortcuts work; Escape and Stop All cancel playback, repeats, and delayed actions.
- **Script**: read the play and trigger assigned cues. Page controls and previous/next cue navigate without playing.
- **Cues**: large named cue buttons, sharing their names and assignments with the script buttons.
- **Edit Mode**: click a sound to rename it, replace/upload audio or a picture, set its shortcut, and assign its operator. Click a cue to edit its name, person, shortcut, recorded actions, levels, or rehearsal note. Existing action levels initially use the imported sound's level. Overall cue volume multiplies each action's level. Continuing an already-running loop retains its current level.
- **People & colors**: add/rename people and choose their colors; assign them in sound, cue, and script-passage editors. Readers' names and color markers appear on assigned passages.
- In Script Edit Mode, select script words (including SFX cue text) and press **1 = yellow**, **2 = pink**, or **3 = green**. Click or drag across a dashed blank line below a passage/cue to mark empty space. Use **0** or **Clear highlight** to remove selected highlighting; toolbar color buttons also work. Selections may span paragraphs. Highlights remain visible during performance and survive reloads, backups, and hosted publishing.
- Use **Edit passage** to change wording, assign a reader, or add a note. Changing wording clears that passage's text highlights and blank-line color; reselect the corrected words to highlight again. Notes and reader assignments preserve highlights. Renaming a cue clears its highlights. Paragraph IDs remain stable.
- Keys **1, 2, and 3** are reserved for highlighting and never trigger audio. Old sound/cue assignments to those keys are cleared when projects or backups load; choose other keys if needed.
- A **live performer cue** displays an instruction and selects it without playing recorded audio.
- **Export backup** saves a JSON file containing the entire edited project and recordings. **Import backup** verifies media hashes and atomically replaces this browser's copy, with confirmation. Retain a backup before clearing browser storage.

Edits persist in this browser's IndexedDB, for this exact address/profile. A different browser, port, hostname, or private window has separate storage. This prototype does not enforce a super-user identity; authentication comes with the hosted implementation.

## Source snapshot

On first start, `prepare_project.py` reads `%APPDATA%/Sound Effects Board` and copies only referenced recordings/images, the script, and actual saved cue IDs into `dist/local-project/`. It reads the saved script when present, otherwise the project's private bundled script. It does not reset prepared assignments or modify the desktop board.

An existing disk snapshot is left alone. Browser edits take precedence after the initial import; refreshing or restarting does not reset them. To import a different desktop board, prepare a snapshot in a separate prototype checkout or export/import a browser backup; replacing the disk snapshot alone will not replace existing browser edits.

Optional: `python browser/serve.py --board-folder "path/to/saved-board"` selects a source when no snapshot exists. `--no-open` suppresses opening a browser.

Private snapshots, audio, script, and backups must not be committed or publicly served. The development server binds only to 127.0.0.1 and has no write endpoints. Program source is in `dist/` because this prototype uses buildless HTML/CSS/JavaScript.

## Current limits

- Internet is unnecessary for the local preview once prepared, but the Python server must be running. Reopening a hosted version offline, verified performance downloads, storage persistence requests, and published-version recovery are later milestones; this prototype does not claim Ready offline.
- Google Sheets/Drive integration, server-enforced permissions, publishing, and update distribution are not implemented.
- Script editing is paragraph-based; adding/removing pages or importing an arbitrary new PDF is not yet supported.
- Renaming/replacing sounds preserves existing assignments. Prepared-action reset still matches original labels; use it deliberately.
- The imported original sound levels remain available in the sound editor; performance views have no volume sliders. Cue editing adds individual action and overall cue levels.

## Verification

The Windows Chrome integration suite passes using a throwaway profile: imported IDs/assignments, browser playback/repeats/delays, cue gain, loop continuation, fades, Stop All, script/cue notes and people, shortcut collision checks, recording replacement, persistence, backup recovery, and damaged-backup rejection. Pads, Cues, and Script screenshots were reviewed. Desktop JSON/media hashes remained unchanged. Headless playback checks do not replace a listening rehearsal; Mac/browser coverage is still pending.

To rerun, start the preview server, then run this PowerShell command from the project folder (installed Chrome required):

```powershell
$env:ELECTRON_RUN_AS_NODE = '1'
$test = Start-Process -FilePath '.\node_modules\electron\dist\electron.exe' -ArgumentList 'browser/test-prototype.cjs' -WindowStyle Hidden -Wait -PassThru
Get-Content browser/test-results/integration.log
```

The final log line must be `ALL CHECKS PASSED`; `$test.ExitCode` must be zero. In a restricted agent sandbox, Chrome may need execution permission outside the sandbox. The test never uses your regular browser profile. Results and the test backup contain private project material and are ignored by git.
