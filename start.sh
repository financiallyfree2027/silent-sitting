#!/bin/bash
# Run the app on your computer: cuts the clips the first time, then opens it at http://localhost:8000
cd "$(dirname "$0")"
if [ ! -f audio/anapana-open.mp3 ]; then
  if [ ! -f tools/source/anapana.mp3 ] || [ ! -f tools/source/group.mp3 ]; then
    echo "Put anapana.mp3 and group.mp3 in tools/source/ first, then run this again."
    exit 1
  fi
  echo "Cutting the audio clips…"
  python3 tools/cut_clips.py || exit 1
fi
echo "Open http://localhost:8000  (press Ctrl+C here to stop)"
( sleep 1; open http://localhost:8000 2>/dev/null ) &
python3 -m http.server 8000
