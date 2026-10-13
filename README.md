# Sound Effects Board

An offline soundboard for a radio play. Click a pad (a picture and/or name) and its sound effect plays. It runs as a normal Mac app and needs no internet connection.

## Using the app

- **Play:** click a pad, or press its keyboard shortcut. Clicking a playing pad restarts it. Different pads can play at the same time.
- **Loop pads** (🔁) start on the first click and stop on the second click.
- **Stop everything:** the red **Stop All** button, or the **Esc** key.
- **Edit Mode:** click **Edit Mode** to change things. Turn it off again before the show so nothing is changed by accident.
  - Click a pad to rename it, replace its sound, add or change its picture, set the volume, turn looping on or off, or set a keyboard shortcut.
  - **+ Add Sound** adds a new pad. Drag pads to reorder them.
  - **● Record** (next to *Choose…*) records a new sound from the microphone. Click it to start, click **■ Stop** to finish, then use **▶ Test** to hear it and **Save**. Recordings are saved as WAV files and can be up to 2 minutes.
  - **Microphone permission on a Mac:** the first time you press Record, macOS asks to allow the microphone. Click **OK**. If you clicked "Don't Allow" by mistake, use **Help > Open Microphone Privacy Settings** in the app, or System Settings > Privacy & Security > Microphone, and turn on Sound Effects Board.
  - Supported sounds: mp3, wav, m4a, aac, ogg, flac, aiff. Supported pictures: png, jpg, gif, webp.
- Your sounds and pictures are **copied into the app's own data folder**, so you can move or delete the originals. Open the folder from **Help > Show Saved Sounds Folder**. Back that folder up to keep your board safe.

The app starts with four generated placeholder sounds (doorbell, knock, beep, wind) so you can try it right away. Delete them in Edit Mode when you add your own.

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
