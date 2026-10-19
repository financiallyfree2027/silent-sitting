# Silent Sitting

A small web app for timed Anapana and Vipassana sittings. Pick the technique and the length. The opening instructions play at the start, the closing ends exactly on time, and everything in between is silence. After a one-time download it works with no internet.

It is plain HTML, CSS and JavaScript with no build step, so it runs on GitHub Pages as it is.

## What's in the folder

| Path | What it is |
|---|---|
| `index.html`, `styles.css`, `app.js` | The app |
| `sw.js` | Service worker. Keeps the app openable offline |
| `manifest.webmanifest`, `icons/` | Lets people add it to their home screen as an app |
| `clips.json` | The cut list: which part of which recording becomes each clip |
| `audio/` | The cut clips (`.mp3`). Created by the script below |
| `tools/cut_clips.py` | Cuts the clips from the two source MP3s with ffmpeg |
| `learn.html` | The Vipassana concept sections (Concept, Vipassana, History, Gurus, Timetable, Fees & centres), opened from the menu |
| `tools/concept-source.html`, `tools/make_learn.py` | Your concept page and the script that turns it into `learn.html` |
| `vendor/gsap.min.js` | The animation library the concept page uses, kept here so it works offline |
| `fonts/` | Figtree, Bricolage Grotesque, Caveat, Tiro Devanagari Hindi, JetBrains Mono (SIL Open Font License) |

## 1. Cut the audio clips

You need `ffmpeg` (`brew install ffmpeg`) and the two MP3s you downloaded earlier.

```bash
mkdir -p tools/source
mv ~/anapana.mp3 ~/group.mp3 tools/source/
python3 tools/cut_clips.py
```

This writes five files into `audio/` and fills in each clip's real length and size in `clips.json`.

| Clip | From | Cut |
|---|---|---|
| Opening chanting (optional) | group.mp3 | 0:00 – 2:19 |
| Anapana instructions | anapana.mp3 | 0:00 – 4:22 |
| Anapana closing | anapana.mp3 | 9:20 – end |
| Vipassana instructions | group.mp3 | 11:21 – 15:52 |
| Closing chanting & metta | group.mp3 | 52:02 – 59:15 |

These points come from silence detection and Whisper timestamps, so they are close but not exact. Listen to the start and end of each clip. If a word is cut off, change `from` or `to` in `clips.json` and run the script again.

The Anapana recording also has two short spoken reminders, around 5:05 and 7:33. The app skips them. Add them as clips if you want them back.

## 2. Try it on your computer

The service worker only runs from a web server, not by double-clicking the file. From the repo folder:

```bash
bash start.sh
```

It cuts the clips the first time (if `audio/` is empty), starts a local server and opens http://localhost:8000. Pick 15 minutes to hear the whole flow, and use **Next** to jump straight to the closing.

## 3. Put it on GitHub Pages

```bash
git init && git add . && git commit -m "Silent Sitting"
git branch -M main
git remote add origin https://github.com/<you>/silent-sitting.git
git push -u origin main
```

Then on GitHub: **Settings → Pages → Source: Deploy from a branch → main / (root)**. The app will be live at `https://<you>.github.io/silent-sitting/`.

When you change any app file later, bump `CACHE_VERSION` at the top of `sw.js` so phones pick up the new version.

## Updating the concept sections

Export the new concept page, then:

```bash
python3 tools/make_learn.py ~/Downloads/Vipassana_Concept.html
```

It writes `learn.html`, switching the animation library and fonts to the local copies and adding the phone layout. Bump `CACHE_VERSION` in `sw.js` before pushing.

## How it works

- **Menu.** The button at the top left opens a list: the sitting timer, then the six concept sections. A section opens full screen over the timer, so a sitting keeps playing underneath; a small timer in the corner shows the time left and taps back. The phone's back button closes the section.

- **Timing.** When a sitting starts, every clip is scheduled on the Web Audio clock. The closing clip is placed so it ends exactly at the chosen length. Because the audio clock drives playback rather than a JavaScript timer, the sitting stays on time with the screen locked or the app in the background.
- **Offline.** On the first visit with internet, the service worker saves the app itself and the app saves the recordings in the background, with progress in the badge on the player. From then on, the same address in the same browser works with no internet. If a save is interrupted, tapping the badge tries again.
- **iPhone note.** Safari can clear a website's saved data if the site isn't opened for a few weeks. Adding the app to the home screen keeps it saved.
- **Seeking.** The slider under the controls jumps to any point, before starting or during a sitting.
- **Ending.** After the last recording a bell rings three times, each softer. It is generated in the browser, so it needs no audio file.
- **Changing settings mid-sitting.** Technique, length, switch point and chanting can all be changed during a sitting. The app keeps your current position and rebuilds the rest of the timeline around it.
- **Phones.** It keeps the screen awake during a sitting, shows pause and stop on the lock screen, and on iPhone sets the audio session to playback so the silent switch doesn't mute it.

Test once on a real iPhone and Android phone with the screen locked for a whole sitting before sharing it.

## About the recordings

The instructions are S. N. Goenka's recordings, © Vipassana Research Institute. They are not in this repository (`audio/*.mp3` is in `.gitignore`), so the public site has no audio and its badge reads "Audio not on site".

When the seven clips made by `tools/cut_clips.py` are present in `audio/` on the site, the app saves them automatically on the first online visit and then works fully offline. Get permission from VRI (questions@vridhamma.org) before putting them on a public site. The code is MIT-licensed; the recordings are not covered by that license.
