# Harmonics

[![CI](https://github.com/Allix05/harmonics/actions/workflows/ci.yml/badge.svg)](https://github.com/Allix05/harmonics/actions/workflows/ci.yml)
[![License: All Rights Reserved](https://img.shields.io/badge/License-All%20Rights%20Reserved-red.svg)](LICENSE)

Play chords in the air. Hold your hand up to your webcam and each finger you raise adds a note &mdash; **thumb = root, index = 3rd, middle = 5th, ring = 7th, pinky = octave** &mdash; so raising several fingers together plays a real chord, not just a single tone. Move your hand left/right to walk through a chord progression. Pick from six synthesized instruments.

**[Try it live](https://allix05.github.io/harmonics/)** &mdash; runs entirely in your browser. Your camera feed never leaves your device: there's no backend, nothing is uploaded anywhere.

<!-- SCREENSHOT_PLACEHOLDER -->

## How it works

```
Webcam ──▶ MediaPipe Hand Landmarker ──▶ 21 landmarks/hand
                                               │
                                               ▼
                                    finger-extension heuristic
                                       + debouncing (hand.js)
                                               │
                                               ▼
                              hand X position ──▶ chord-progression zone
                                               │
                                               ▼
                                  diatonic chord tones (music.js)
                                               │
                                               ▼
                                  Tone.js synth voices (audio.js)
                                               │
                                               ▼
                                          🔊 sound
```

1. **[`hand.js`](hand.js)** &mdash; [MediaPipe's Hand Landmarker](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker) (WebAssembly, runs client-side) tracks 21 points per hand from the webcam feed in real time. A finger counts as "extended" when its tip is proportionally farther from the wrist than its middle joint &mdash; a simple heuristic that's tolerant of hand rotation. Raw per-frame results are debounced (a finger must hold a state for a few consecutive frames) so landmark jitter doesn't retrigger notes.
2. **[`music.js`](music.js)** &mdash; pure music theory: given a key, a scale, and a hand's horizontal position, builds a diatonic chord (stacked thirds within the scale) for one of four zones that walk through a `I - V - vi - IV` progression &mdash; a common, pleasant-sounding chord sequence. Each of the 5 fingers maps to a chord tone: root, 3rd, 5th, 7th, octave.
3. **[`audio.js`](audio.js)** &mdash; six [Tone.js](https://tonejs.github.io/) synth presets (Warm Synth, Pluck, Bell, Pad, Marimba, Electric Guitar), all synthesized (no samples, no licensing concerns). A `VoiceManager` tracks exactly which (hand, finger) voices are currently held so notes release correctly even as the chord underneath a still-raised finger changes.
4. **[`app.js`](app.js)** &mdash; ties it together: camera capture, the per-frame detection loop, skeleton overlay drawing, and wiring finger state to note on/off events.

## Try it locally

No build step, no dependencies to install for the app itself &mdash; it's plain ES modules loaded straight from CDNs.

```bash
python -m http.server 8090
# open http://localhost:8090
```

### Run the tests

The core logic (finger-extension detection, debouncing, music theory) is pure and unit-tested with Node's built-in test runner &mdash; no camera or browser needed:

```bash
node --test
```

## Project structure

```
hand.js       finger-extension detection + debouncing (pure, camera-independent)
music.js      scales, diatonic chords, note/frequency math (pure)
audio.js      Tone.js instrument presets + voice management
app.js        camera capture, MediaPipe wiring, render loop, UI glue
index.html    page structure
style.css     styling
tests/        node:test unit tests for hand.js and music.js
```

## Why these design choices

- **Diatonic chord tones, not arbitrary notes** &mdash; mapping fingers to root/3rd/5th/7th/octave (rather than, say, chromatic notes) means *any* combination of raised fingers sounds musically coherent. There's no wrong way to play it.
- **Debounced finger state** &mdash; MediaPipe's landmarks jitter slightly frame to frame; without debouncing, fingers near the extend/curl threshold retrigger notes rapidly, sounding like static. A few frames of hysteresis fixes this without adding noticeable latency.
- **Logic separated from the camera loop** &mdash; `hand.js` and `music.js` take plain data in and return plain data out, so they're fully unit-testable without a webcam, a browser, or MediaPipe itself.

## License

All Rights Reserved &mdash; see [LICENSE](LICENSE). Source is public for portfolio/demonstration purposes; reuse requires permission.
