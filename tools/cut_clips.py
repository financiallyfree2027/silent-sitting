#!/usr/bin/env python3
"""
Cut the instruction clips used by the app from the two source recordings.

Usage (from the repo folder):
    python3 tools/cut_clips.py              # sources in tools/source/
    python3 tools/cut_clips.py ~/Downloads  # or point at the folder with the MP3s

Needs ffmpeg and ffprobe (brew install ffmpeg).

For every clip in clips.json it:
  1. trims source.mp3 between 'from' and 'to' (to=null means "to the end"),
  2. adds a short fade in/out so cuts never click,
  3. encodes mono AAC at 64 kbps (.m4a plays everywhere, including iPhone),
  4. writes the real duration and file size back into clips.json.
"""
import json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(ROOT, "tools", "source")
CFG = os.path.join(ROOT, "clips.json")
FADE = 0.6  # seconds


def probe_duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path],
        capture_output=True, text=True, check=True).stdout.strip()
    return float(out)


def main():
    with open(CFG, encoding="utf-8") as f:
        cfg = json.load(f)

    for key, c in cfg["clips"].items():
        src = os.path.join(SRC_DIR, c["source"])
        if not os.path.exists(src):
            sys.exit(f"Missing {src}. Put {c['source']} in {SRC_DIR} or pass its folder as an argument.")
        start = float(c["from"])
        end = float(c["to"]) if c["to"] is not None else probe_duration(src)
        length = end - start
        if length <= 2 * FADE:
            sys.exit(f"{key}: 'from' and 'to' leave {length:.1f}s, which is too short.")

        out = os.path.join(ROOT, c["file"])
        os.makedirs(os.path.dirname(out), exist_ok=True)
        af = f"afade=t=in:st=0:d={FADE},afade=t=out:st={length - FADE:.3f}:d={FADE}"
        subprocess.run([
            "ffmpeg", "-y", "-v", "error",
            "-ss", f"{start:.3f}", "-t", f"{length:.3f}", "-i", src,
            "-af", af, "-ac", "1", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "64k",
            out,
        ], check=True)

        c["duration"] = round(probe_duration(out), 2)
        c["bytes"] = os.path.getsize(out)
        print(f"  {key:15s} {c['duration']:8.1f}s  {c['bytes'] / 1e6:5.2f} MB  -> {c['file']}")

    with open(CFG, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("Updated clips.json. Bump CACHE_VERSION in sw.js before you push new audio.")


if __name__ == "__main__":
    main()
