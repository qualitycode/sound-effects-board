# Sound Effects Board: Project Notes and Next Steps

Backup of the planning chat from 2026-10-12. Read this first when resuming.

## Goal

An offline Mac app for a friend's radio play. Click a picture/text pad and a sound effect plays. The user can edit sounds and add new ones. No internet needed. The project is backed up with git/GitHub.

## Status (end of day 1)

- **Built and working on Windows:** Electron app in `c:\projects\misc\soundEffects`. End-to-end tests passed (15/15) and the packaged build ran.
- **Committed to local git** (branch `main`). Git identity for this repo: `qualitycode <larrym14@gmail.com>`.
- **Not done yet (needs the user):**
  1. Create the GitHub repo and push.
  2. Download the Mac `.dmg` built by GitHub Actions.
  3. Install and test on the Mac. The Mac build has never been run.

## Key decisions

- **Wrapper:** Electron (turns a web page into a stand-alone Mac `.app`/`.dmg`).
- **Node.js is only a build tool.** It is installed on the Windows PC at `C:\Users\larry\tools\node` (portable, not on PATH). The finished app contains everything it needs; the Mac needs no Node and no internet. Use `npm.cmd` rather than `npm` in PowerShell (script execution is disabled).
- **Mac build:** done in the cloud by GitHub Actions (`.github/workflows/build-mac.yml`), so no development happens on the Mac. It produces `arm64` (Apple chip) and `x64` (Intel) `.dmg` files. The app is ad-hoc signed (not notarized), so the first launch needs right-click > Open.
- **Data storage:** pads are saved in `pads.json`, and sounds and pictures are copied into a `media` folder in the app's data folder (Mac: `~/Library/Application Support/Sound Effects Board`). They are not stored in the git repo.
- The tour project at `C:\projects\tour` and slidetrip.com on DigitalOcean are unrelated and not used.

## How to use the app

Click a pad (or press its key) to play. Esc or **Stop All** stops everything. **Edit Mode** lets you rename pads, change sounds and pictures, set volume, loop and keys, add or delete pads, and drag pads to reorder them. See [README.md](./README.md) for full details.

## Next steps

### 1. Back up to GitHub

Create an empty repository on github.com (no README), then in `c:\projects\misc\soundEffects`:

```
git remote add origin https://github.com/YOUR-NAME/sound-effects-board.git
git push -u origin main
```

### 2. Get the Mac app

GitHub repo > **Actions** > **Build Mac app** (runs automatically on push, or use **Run workflow**). After about 5 minutes, download the **SoundEffectsBoard-mac** artifact.

- `...-arm64.dmg`: Macs with an Apple chip (M1 and later).
- `...-x64.dmg`: Intel Macs.
- Not sure which? Apple menu > About This Mac.

### 3. Install on the Mac

1. Open the `.dmg` and drag the app to **Applications**.
2. First launch: right-click the app > **Open** > **Open**.
3. If macOS says the app is "damaged", run this in Terminal, then open it again:
   ```
   xattr -cr "/Applications/Sound Effects Board.app"
   ```
4. Test: click pads, then try Edit Mode with a real sound, a picture and a key.

## Ideas if wanted later

- Fade-out on Stop All, per-pad fade in/out.
- Drag audio files onto the window to create pads.
- Export/import the whole board for backup or moving to another Mac.
- Proper Apple signing and notarization (needs a paid Apple Developer account) to remove the first-launch warning.
- A set of real sound effects (use only royalty-free or properly licensed sounds).

## Run it on Windows (for development)

```
$env:Path = "C:\Users\larry\tools\node;" + $env:Path
cd c:\projects\misc\soundEffects
npm.cmd start
```

## Prompt to continue in a new chat

```
I'm continuing the Sound Effects Board project in c:\projects\misc\soundEffects. Read PROJECT-NOTES.md and README.md first. The app is an Electron offline soundboard for a radio play, with a GitHub Actions workflow that builds the Mac .dmg. Node is installed portably at C:\Users\larry\tools\node. Today I want to: <describe: e.g. "report what happened when I installed it on the Mac" / "add feature X">.
```
