# 🎬 MY VIDEO EDITOR (localhost)

Browser-based video editor — no install needed, everything runs locally.

## Run

```bash
cd Video-Editor
python server.py
```

Then open in your browser: **http://localhost:8000**

> You can also double-click `index.html` directly, but localhost is recommended (for export + file access).

## Features

**Phase 1 — Basic**
- [x] Video upload (multiple + drag-drop)
- [x] Video preview (canvas WYSIWYG)
- [x] Play/Pause + seek bar
- [x] Timeline (VIDEO / AUDIO / TEXT / IMAGE tracks)
- [x] Start/End trim
- [x] Volume control (clip + bg music)
- [x] Duration / time display

**Phase 2 — Editing**
- [x] Cut/Split at playhead (✂ button)
- [x] Multiple clips (sequential playback)
- [x] Delete clip
- [x] Reorder clips (◀ ▶)
- [x] Speed 0.25x–2x
- [x] Rotate 0/90/180/270
- [x] Resize (canvas size 720p/1080p/SD/Reel/Square)

**Phase 3 — Creative**
- [x] Text overlay (drag on preview, color/size/timing)
- [x] Image overlay (drag, opacity, timing)
- [x] Background music (MP3 etc.)
- [x] Filters (grayscale, sepia, invert, vivid, cinematic, blur, vintage)
- [x] Brightness / Contrast
- [x] Fade in/out (per clip, sec)

**Phase 4 — Export**
- [x] MP4 export (real MP4 in Chrome/Edge, otherwise WebM)
- [x] Resolution selection
- [x] FPS selection (24/30/60)
- [x] Download edited video (text/image/fades burned-in)

**Phase 5 — Animations & Finishing**
- [x] 90+ transitions: IN at clip start + OUT to next clip (between-clips joints)
- [x] 20+ clip effects (slow zoom, drift, wiggle, hue cycle, glitch loop, film flicker…)
- [x] 25+ text/image animations (entries + loops), burned into export
- [x] Timeline duration handles (drag ◀ ▶ edges on video/audio/text/image)
- [x] Text pencil (✏️) quick-edit on preview, overlay list, and timeline
- [x] Preview layout controls (align left/center/right + left offset + width)

## Layout

```
IMPORT | VIDEO PREVIEW | SETTINGS
-------------------------------
TIMELINE (video/audio/text/image)
▶ Play  ✂ Cut  ⏱ Trim  ↩ Undo  📤 Export
🎨 Filter  ✨ Effect  🌟 Sticker  😀 Emoji  🔀 Transition  🔗 Between
```

## Notes
- All processing happens in the browser — videos are never uploaded to a server (private).
- Export is real-time: 1 min of video takes about 1 min to export. Keep the tab visible during export.
- Best browser: **Chrome / Edge**.
