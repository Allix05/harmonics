import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
import * as Tone from "https://cdn.jsdelivr.net/npm/tone@14.8.49/+esm";

import { fingerExtension, thumbSplayRatio, FingerDebouncer, FINGER_NAMES, handXPosition } from "./hand.js";
import { chordForHand, PROGRESSION_DEGREES } from "./music.js";
import { createInstruments, VoiceManager } from "./audio.js";

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

const FINGER_COLORS = ["#ffcc4d", "#5b8cff", "#4dffb0", "#ff5b7f", "#c37bff"];

const video = document.getElementById("video");
const canvas = document.getElementById("overlay");
const ctx = canvas.getContext("2d");
const startOverlay = document.getElementById("startOverlay");
const startBtn = document.getElementById("startBtn");
const loadingOverlay = document.getElementById("loadingOverlay");
const loadingText = document.getElementById("loadingText");
const errorBanner = document.getElementById("errorBanner");
const instrumentSel = document.getElementById("instrument");
const keyRootSel = document.getElementById("keyRoot");
const scaleSel = document.getElementById("scale");
const chordNameEl = document.getElementById("chordName");
const chordZonesEl = document.getElementById("chordZones");
const thumbSensitivitySlider = document.getElementById("thumbSensitivity");
const thumbThresholdValueEl = document.getElementById("thumbThresholdValue");
const thumbRatioValueEl = document.getElementById("thumbRatioValue");

thumbThresholdValueEl.textContent = Number(thumbSensitivitySlider.value).toFixed(2);
thumbSensitivitySlider.addEventListener("input", () => {
  thumbThresholdValueEl.textContent = Number(thumbSensitivitySlider.value).toFixed(2);
});

for (let i = 0; i < PROGRESSION_DEGREES.length; i++) {
  const zone = document.createElement("div");
  zone.className = "zone";
  chordZonesEl.appendChild(zone);
}

function showError(message) {
  errorBanner.textContent = message;
  errorBanner.classList.remove("hidden");
}

let handLandmarker = null;
let instruments = null;
let voiceManager = null;
let running = false;

const debouncers = [new FingerDebouncer(3), new FingerDebouncer(3)];
const handPresent = [false, false];

async function init() {
  try {
    startOverlay.classList.add("hidden");
    loadingOverlay.classList.remove("hidden");

    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
    video.srcObject = stream;
    await video.play();

    await Tone.start();
    instruments = createInstruments(Tone);
    voiceManager = new VoiceManager(instruments[instrumentSel.value]);

    loadingText.textContent = "Loading hand-tracking model...";
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: 2,
    });

    loadingOverlay.classList.add("hidden");
    running = true;
    requestAnimationFrame(loop);
  } catch (err) {
    loadingOverlay.classList.add("hidden");
    showError("Couldn't start: " + err.message + ". Camera + microphone-free audio permissions are required.");
  }
}

function resizeCanvasToVideo() {
  const rect = video.getBoundingClientRect();
  if (canvas.width !== rect.width || canvas.height !== rect.height) {
    canvas.width = rect.width;
    canvas.height = rect.height;
  }
}

function drawHand(landmarks, activeFingers) {
  const w = canvas.width, h = canvas.height;
  ctx.strokeStyle = "rgba(139, 156, 209, 0.6)";
  ctx.lineWidth = 2;
  for (const [a, b] of HAND_CONNECTIONS) {
    ctx.beginPath();
    ctx.moveTo(landmarks[a].x * w, landmarks[a].y * h);
    ctx.lineTo(landmarks[b].x * w, landmarks[b].y * h);
    ctx.stroke();
  }
  const tipIndices = [4, 8, 12, 16, 20];
  for (let i = 0; i < 5; i++) {
    const tip = landmarks[tipIndices[i]];
    ctx.beginPath();
    ctx.arc(tip.x * w, tip.y * h, activeFingers[i] ? 9 : 5, 0, Math.PI * 2);
    ctx.fillStyle = activeFingers[i] ? FINGER_COLORS[i] : "rgba(139, 156, 209, 0.6)";
    ctx.fill();
  }
}

function updateChordDisplay(chord) {
  chordNameEl.textContent = `${chord.chordRootName} ${chord.quality}`;
  [...chordZonesEl.children].forEach((zone, i) => {
    zone.classList.toggle("active", i === chord.zone);
  });
}

function loop() {
  if (!running) return;
  resizeCanvasToVideo();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const nowMs = performance.now();
  const result = handLandmarker.detectForVideo(video, nowMs);
  const hands = result.landmarks || [];

  let displayedChord = null;

  for (let handIdx = 0; handIdx < 2; handIdx++) {
    const landmarks = hands[handIdx];
    if (!landmarks) {
      if (handPresent[handIdx]) {
        for (let f = 0; f < 5; f++) voiceManager.noteOff(`${handIdx}:${f}`);
        handPresent[handIdx] = false;
      }
      if (handIdx === 0) thumbRatioValueEl.textContent = "—";
      continue;
    }
    handPresent[handIdx] = true;

    if (handIdx === 0) {
      thumbRatioValueEl.textContent = thumbSplayRatio(landmarks).toFixed(2);
    }

    const thumbThreshold = Number(thumbSensitivitySlider.value);
    const raw = fingerExtension(landmarks, 1.2, thumbThreshold);
    const active = debouncers[handIdx].update(raw);
    drawHand(landmarks, active);

    const x = handXPosition(landmarks);
    const chord = chordForHand(keyRootSel.value, 4, scaleSel.value, x);
    if (handIdx === 0) displayedChord = chord;

    for (let f = 0; f < 5; f++) {
      const voiceKey = `${handIdx}:${f}`;
      if (active[f]) voiceManager.noteOn(voiceKey, chord.frequencies[f]);
      else voiceManager.noteOff(voiceKey);
    }
  }

  if (displayedChord) updateChordDisplay(displayedChord);

  requestAnimationFrame(loop);
}

instrumentSel.addEventListener("change", () => {
  if (voiceManager && instruments) voiceManager.setSynth(instruments[instrumentSel.value]);
});

startBtn.addEventListener("click", init);
