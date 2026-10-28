# Sound Effects Board

For the browser soundboard and the current server deployment, **read [BROWSER-SOUNDBOARD-HANDOFF.md](BROWSER-SOUNDBOARD-HANDOFF.md) first**. It records the latest confirmed state and what the next chat should do. Hosted setup details are in [browser/hosted/README.md](browser/hosted/README.md); local preview instructions are in [browser/README.md](browser/README.md). The desktop application documented below is preserved.

An offline soundboard for a radio play. Click a pad (a picture and/or name) and its sound effect plays. It runs as a normal Mac app and needs no internet connection.

## Using the app

- **Play:** click a pad, or press its keyboard shortcut. Clicking a playing pad restarts it. Different pads can play at the same time.
- **Loop pads** (🔁) start on the first click and stop on the second click.
- **Stop everything:** the red **Stop All** button, or the **Esc** key.
- **Edit Mode:** click **Edit Mode** to change things. Turn it off again before the show so nothing is changed by accident.
  - Click a pad to rename it, replace its sound, add or change its picture, set the volume, turn looping on or off, or set a keyboard shortcut.
  - **+ Add Sound** adds a new pad. Drag pads to reorder them.
  - **Volume** goes up to 300%. Quiet recordings can be boosted past 100%, and a limiter stops loud peaks from distorting.
  - **File > Import Sound Pack…** adds a whole folder of sounds at once. Choose a folder that contains a `pack.json` file (see below). Sounds already on the board with the same name are skipped, so importing twice does no harm.
  - **File > Export Board as Sound Pack…** saves every pad (sounds, pictures, volume, loop, key) into a new folder. Use it to back up your board or move it to another Mac, then import that folder there.
  - **● Record** (next to *Choose…*) records a new sound from the microphone. Click it to start, click **■ Stop** to finish, then use **▶ Test** to hear it and **Save**. Recordings are saved as WAV files and can be up to 2 minutes.
  - **Microphone permission on a Mac:** the first time you press Record, macOS asks to allow the microphone. Click **OK**. If you clicked "Don't Allow" by mistake, use **Help > Open Microphone Privacy Settings** in the app, or System Settings > Privacy & Security > Microphone, and turn on Sound Effects Board.
  - Supported sounds: mp3, wav, m4a, aac, ogg, flac, aiff. Supported pictures: png, jpg, gif, webp.
- Your sounds and pictures are **copied into the app's own data folder**, so you can move or delete the originals. Open the folder from **Help > Show Saved Sounds Folder**. Back that folder up to keep your board safe.

The app starts with four generated placeholder sounds (doorbell, knock, beep, wind) so you can try it right away. Delete them in Edit Mode when you add your own.

## Script view

Use **Script** in the top toolbar to read the bundled Christmas Carol dialogue with clickable sound directions. **Pads** returns to the full board. Both views share playback, shortcuts, and **Stop All**.

- First import your sound pack or add your recordings using the pads.
- Turn on **Edit Mode**, switch to **Script**, and click a sound direction. Add one or more actions and choose an existing sound for each: **Play once**, **Start loop**, **Stop**, or **Fade out (2s)**. Save, then turn Edit Mode off before performing.
- Clicking a cue runs its assigned actions together. For example, assign **Play once: Door Closes** and **Stop: Wind** to a door-closing cue. Repeated start actions restart the sound; they do not toggle it off.
- For sequences requiring pauses or timing with actors, use the individual **Play/Loop**, **Stop**, and **Fade** controls beside the script. **Page sounds** shows sounds assigned on the current page; **Now playing** includes sounds started from either view.
- Unassigned cues and cues with deleted sounds say **needs assignment** and do not play any part of the cue. Reassign them in Edit Mode. Replacing a pad's recording keeps its cue links.
- The page selector uses both PDF and printed page numbers. **Previous cue** and **Next cue** move through the script without playing. Text size, selected page, and view are remembered.
- This production includes prepared assignments for all 95 cues using the 60-sound project pack. When the full pack is on your board, first use backs up earlier trial assignments and installs the prepared set. Subsequent edits are preserved. Missing sounds keep a cue unavailable until you import the pack.
- Edit cue **Delay (s)** to schedule an action after clicking. **Times** repeats a Play action after each recording finishes, useful for counted clock strikes. **Continue / start loop** keeps an existing loop going without restarting it. **Stop All**, individual stops, and retriggering a cue cancel pending actions for the affected sounds. Loop actions ignore Times.
- Rehearsal notes appear below cues where recordings are substitutes, an actor supplies a voice, or timing needs adjustment. The prepared pauses are starting points; rehearse their timing and levels. **Use prepared actions** restores that cue's prepared actions in the editor; Save applies them.
- Assignments are stored as `script-cues.json` in the app's saved-data folder, alongside `pads.json`. Back up the whole folder to preserve cue links; sound-pack exports currently contain sounds and pad settings only.

The local Windows build includes extracted dialogue (41 pages and 95 SFX directions), so it needs no PDF reader or network. The play script remains git-ignored because it is not ours to republish. For a build made on GitHub, transfer `assets/playScript/script.json` privately to the Mac and choose **File > Import Play Script…**. Importing replaces the script, resets assignments, and backs up the previous saved script and assignments in the data folder. To regenerate the text after changing the source PDF, run `python scripts/extract-script.py` with PyMuPDF installed. Electron integration checks are in `scripts/test-script-view.cjs` and use temporary data rather than your board.

## Sound packs

A sound pack is a folder with the sound files (and optional pictures) and a `pack.json` file listing the pads:

```json
{
  "pads": [
    { "label": "Door Opens", "file": "mixkit-195.mp3", "volume": 0.8, "loop": false, "key": "Q" },
    { "label": "Fireplace", "file": "fire.mp3", "image": "fire.png", "volume": 3, "loop": true, "key": "P" }
  ]
}
```

`label` and `file` are required. `image`, `volume` (0 to 3, where 1 is normal), `loop` and `key` are optional. Files must sit directly in the pack folder. To use a pack on the Mac: double-click the pack's zip file to unpack it, open the app, then choose **File > Import Sound Pack…** and pick the unpacked folder.

Downloaded sounds usually come with license rules, so keep packs out of the git repository (the `soundpack/` folder is ignored on purpose).

## Getting the Mac app (no Mac development needed)

The Mac app is built automatically by GitHub, so you never need to install developer tools on the Mac.

1. Put this project on GitHub (see "Backing up with git" below).
2. On GitHub open the repository, then the **Actions** tab, then **Build Mac app**, then **Run workflow** (it also runs on every push to `main`).
3. When the run finishes (about 5 minutes), open it and download **SoundEffectsBoard-mac** under *Artifacts*. Unzip it.
4. Choose the right file:
   - `...-arm64.dmg` for newer Macs with an Apple chip (M1, M2, M3, M4).
   - `...-x64.dmg` for older Intel Macs.
   - Not sure? Apple menu > **About This Mac**. "Chip: Apple M..." means arm64; "Processor: Intel" means x64.

## Installing on the Mac

For updating an existing installation, including transferring the private script and prepared cues, follow [Mac update instructions](MAC-UPDATE-INSTRUCTIONS.md).

1. Double-click the `.dmg`, then drag **Sound Effects Board** onto the **Applications** folder.
2. Open **Applications**. The first time, **right-click the app > Open > Open**. The app is not signed with a paid Apple developer certificate, so macOS asks for this confirmation once.
3. If macOS says the app is "damaged" or "can't be opened", open the **Terminal** app and run:

   ```
   xattr -cr "/Applications/Sound Effects Board.app"
   ```

   Then open the app again with right-click > Open.
4. Optional: to keep it in the Dock, right-click its Dock icon while it is running > **Options > Keep in Dock**.

## Developing (optional)

Needs [Node.js](https://nodejs.org) (LTS).

```
npm install
npm start            # run the app
npm run dist:mac     # build the Mac app (must be run on a Mac)
npm run samples      # regenerate the placeholder sounds
npm run icon         # regenerate build/icon.png
```

Project layout: `main.js` (app window, saving files, sound/picture storage), `preload.js` (safe bridge), `src/index.html`, `src/styles.css`, `src/renderer.js` (the page).

## Backing up with git

```
git remote add origin https://github.com/YOUR-NAME/sound-effects-board.git
git push -u origin main
```

Create the empty repository on github.com first (no README). Pushing also starts the Mac build described above. The sounds you add through the app are stored in the app's data folder, not in this repository.
