// Pure, camera-independent hand/finger-state logic, so it can be unit
// tested with synthetic landmark data (see tests/hand.test.mjs) without a
// real webcam or MediaPipe running.
//
// Landmark indices follow the standard MediaPipe Hand Landmarker layout:
// https://developers.google.com/mediapipe/solutions/vision/hand_landmarker
export const LM = {
  WRIST: 0,
  THUMB_CMC: 1, THUMB_MCP: 2, THUMB_IP: 3, THUMB_TIP: 4,
  INDEX_MCP: 5, INDEX_PIP: 6, INDEX_DIP: 7, INDEX_TIP: 8,
  MIDDLE_MCP: 9, MIDDLE_PIP: 10, MIDDLE_DIP: 11, MIDDLE_TIP: 12,
  RING_MCP: 13, RING_PIP: 14, RING_DIP: 15, RING_TIP: 16,
  PINKY_MCP: 17, PINKY_PIP: 18, PINKY_DIP: 19, PINKY_TIP: 20,
};

export const FINGER_NAMES = ["thumb", "index", "middle", "ring", "pinky"];

// [tipIndex, referenceJointIndex] per non-thumb finger. A finger counts as
// extended when its tip is meaningfully farther from the wrist than its
// reference joint is -- a simple, rotation-tolerant heuristic (it does not
// require the hand to be upright) that works well for a hand held up
// facing the camera, which is this app's expected pose. This works for
// the four fingers because curling them draws the tip back in *toward*
// the wrist.
const FINGER_JOINTS = [
  [LM.INDEX_TIP, LM.INDEX_PIP],
  [LM.MIDDLE_TIP, LM.MIDDLE_PIP],
  [LM.RING_TIP, LM.RING_PIP],
  [LM.PINKY_TIP, LM.PINKY_PIP],
];

function dist2D(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// The thumb doesn't curl toward the wrist the way the other fingers do --
// it swings sideways across the palm -- so its tip stays roughly the same
// distance from the wrist whether curled or extended, and a wrist-based
// heuristic reads it as "extended" almost all the time. Instead, measure
// from the index finger's base joint (a stable point on the palm that
// doesn't move with thumb curl): a curled thumb tucks in close to it, a
// splayed thumb sits farther away.
//
// How "close" is curled and how "far" is splayed varies a fair amount
// between hands and resting poses (a loose fist often still holds the
// thumb somewhat away from the palm), so there's no single threshold that
// is right for everyone. `thumbSplayRatio` exposes the raw measurement so
// the UI can show it live and let each person calibrate their own
// threshold via the sensitivity slider, rather than guessing blindly.
export function thumbSplayRatio(landmarks) {
  const indexMcp = landmarks[LM.INDEX_MCP];
  const tipDist = dist2D(indexMcp, landmarks[LM.THUMB_TIP]);
  const refDist = dist2D(indexMcp, landmarks[LM.THUMB_MCP]);
  return refDist === 0 ? 0 : tipDist / refDist;
}

// Returns a length-5 boolean array [thumb, index, middle, ring, pinky].
// `extendThreshold` is how much farther (as a ratio) the tip must be from
// its reference point than the reference joint is, to count as "extended".
// `thumbThreshold` is the equivalent ratio for the thumb's own (different)
// heuristic; it typically needs to be higher and benefits from per-person
// calibration (see `thumbSplayRatio`).
export function fingerExtension(landmarks, extendThreshold = 1.2, thumbThreshold = 2.0) {
  const wrist = landmarks[LM.WRIST];
  const nonThumb = FINGER_JOINTS.map(([tipIdx, refIdx]) => {
    const tipDist = dist2D(wrist, landmarks[tipIdx]);
    const refDist = dist2D(wrist, landmarks[refIdx]);
    return tipDist > refDist * extendThreshold;
  });
  const thumb = thumbSplayRatio(landmarks) > thumbThreshold;
  return [thumb, ...nonThumb];
}

// Debounces raw per-frame finger-extension booleans so landmark jitter
// near the threshold doesn't retrigger notes rapidly: a finger must report
// the same state for `stableFrames` consecutive calls before the debounced
// output changes.
export class FingerDebouncer {
  constructor(stableFrames = 3) {
    this.stableFrames = stableFrames;
    this.current = [false, false, false, false, false];
    this.pending = [false, false, false, false, false];
    this.pendingCount = [0, 0, 0, 0, 0];
  }

  // raw: length-5 boolean array. Returns the debounced length-5 array
  // (a new array each call, safe to keep around).
  update(raw) {
    for (let i = 0; i < 5; i++) {
      if (raw[i] === this.pending[i]) {
        this.pendingCount[i]++;
      } else {
        this.pending[i] = raw[i];
        this.pendingCount[i] = 1;
      }
      if (this.pendingCount[i] >= this.stableFrames) {
        this.current[i] = this.pending[i];
      }
    }
    return this.current.slice();
  }
}

// Average X position (0..1, left..right in the mirrored preview) of the
// extended fingers' base joints, falling back to the wrist if none are
// extended. Used to pick which chord zone a hand is in.
export function handXPosition(landmarks) {
  return landmarks[LM.WRIST].x;
}
