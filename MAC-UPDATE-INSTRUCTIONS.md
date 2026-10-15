# Updating Sound Effects Board on the Mac

These steps build a new Mac app from the Windows project, install it on the Mac, and transfer the private play script and sounds. The finished Mac app works offline and does not need Node.js installed.

## 1. Send the app changes to GitHub from Windows

Open PowerShell in `C:\projects\misc\soundEffects` (or use the project's IDE terminal) and run:

```powershell
cd C:\projects\misc\soundEffects
git add main.js cue-presets.js preload.js package.json src scripts README.md PROJECT-NOTES.md MAC-UPDATE-INSTRUCTIONS.md
git commit -m "Add script view and prepared sound cues"
git push origin main
```

Run each command separately and check for errors before continuing. If Git says there is nothing to commit, the changes may already be committed; run the push command.

The play script and downloaded sound pack are deliberately excluded from GitHub. Transfer them separately in step 4.

## 2. Download the new Mac build

1. Open [the project's GitHub Actions page](https://github.com/qualitycode/sound-effects-board/actions).
2. Open the latest **Build Mac app** run for your push and wait for it to finish successfully.
3. Download **SoundEffectsBoard-mac** under **Artifacts**. You may need to sign in to GitHub.
4. Transfer the downloaded ZIP to the Mac and unzip it.
5. Choose the appropriate `.dmg`:
   - **arm64**: Macs with an Apple Silicon chip, such as M1, M2, M3, or M4.
   - **x64**: Intel Macs.

To check, open **Apple menu > About This Mac**. An Apple M-series chip means arm64; an Intel processor means x64.

If no new build started, open **Build Mac app** on the Actions page and use **Run workflow** with branch `main`.

## 3. Replace the app on the Mac

1. Quit the old **Sound Effects Board** app.
2. Double-click the downloaded `.dmg`.
3. Drag **Sound Effects Board** into **Applications** and choose **Replace** when prompted.
4. Open the app from **Applications**. If macOS asks for confirmation, right-click the app and choose **Open**.

The sounds and board settings are stored separately from the application, in:

```text
~/Library/Application Support/Sound Effects Board
```

Back up that entire folder before updating if you want a recovery copy of the board, recordings, script, and cue assignments. You can locate it from **Help > Show Saved Sounds Folder** in the app.

For first-launch troubleshooting, see [Installing on the Mac in the README](README.md#installing-on-the-mac).

## 4. Transfer the private script and sound pack

From the Windows computer, copy these files to the Mac using a USB drive or your usual file-transfer method:

```text
C:\projects\misc\soundEffects\assets\playScript\script.json
C:\projects\misc\soundEffects\SoundPack.zip
```

The script file contains the dialogue, all 95 prepared cues, action delays, repeat counts, and rehearsal notes. It is not included in the GitHub-built app.

On the Mac:

1. If the full sound pack is not already on the board, unzip **SoundPack.zip**. Choose **File > Import Sound Pack** and select the folder containing `pack.json`. Importing skips sounds with names already on the board.
2. Choose **File > Import Play Script** and select the transferred **script.json** file.
3. Click **Script** in the top toolbar.

Importing a script replaces the loaded script and resets its cue assignments. The app backs up previous saved script and assignment files in its data folder. Once all required sounds are available, the prepared set populates automatically. First use of the prepared set backs up prior trial assignments; later cue edits are preserved.

For future updates that only change the app, you do not need to reimport an unchanged script or sound pack.

## 5. Check the updated app before rehearsal

- Confirm that both **Pads** and **Script** views appear.
- Open PDF page 12 in Script view and check the clock and door/wind cues.
- Confirm that cues have their sounds assigned. **Needs assignment** indicates a missing or cleared sound assignment.
- Test **Stop All** and the individual **Stop** and **Fade** controls.
- Use **Edit Mode** to adjust cue actions, delays, repeat counts, or sound levels. Turn it off before performing.
- Read the rehearsal notes beside cues. Prepared timing and substitute recordings need to be checked against the actors.

Windows integration checks have passed. The Mac build still needs to be installed and tested on the actual Mac.
