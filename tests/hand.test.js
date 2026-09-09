import { test } from "node:test";
import assert from "node:assert/strict";
import { fingerExtension, thumbSplayRatio, FingerDebouncer, LM } from "../hand.js";

// Builds a 21-point landmark array with everything bunched at the wrist,
// then overrides specific joints for the finger(s) under test.
function baseLandmarks() {
  return Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
}

test("a fully curled hand reports no extended fingers", () => {
  const lm = baseLandmarks();
  const result = fingerExtension(lm);
  assert.deepEqual(result, [false, false, false, false, false]);
});

test("an extended index finger (tip far from wrist) is detected", () => {
  const lm = baseLandmarks();
  lm[LM.WRIST] = { x: 0.5, y: 0.9, z: 0 };
  lm[LM.INDEX_PIP] = { x: 0.5, y: 0.6, z: 0 };
  lm[LM.INDEX_TIP] = { x: 0.5, y: 0.1, z: 0 }; // far from wrist
  const result = fingerExtension(lm);
  assert.equal(result[1], true, "index should be extended");
  assert.equal(result[2], false, "middle should stay curled");
});

test("all five fingers extended", () => {
  const lm = baseLandmarks();
  lm[LM.WRIST] = { x: 0.5, y: 0.9, z: 0 };
  const pips = [LM.THUMB_MCP, LM.INDEX_PIP, LM.MIDDLE_PIP, LM.RING_PIP, LM.PINKY_PIP];
  const tips = [LM.THUMB_TIP, LM.INDEX_TIP, LM.MIDDLE_TIP, LM.RING_TIP, LM.PINKY_TIP];
  for (const idx of pips) lm[idx] = { x: 0.5, y: 0.6, z: 0 };
  for (const idx of tips) lm[idx] = { x: 0.5, y: 0.1, z: 0 };
  assert.deepEqual(fingerExtension(lm), [true, true, true, true, true]);
});

test("thumb tucked near the palm (curled) is not detected as extended", () => {
  const lm = baseLandmarks();
  lm[LM.WRIST] = { x: 0.5, y: 0.9, z: 0 };
  lm[LM.INDEX_MCP] = { x: 0.55, y: 0.55, z: 0 };
  lm[LM.THUMB_MCP] = { x: 0.42, y: 0.75, z: 0 };
  lm[LM.THUMB_TIP] = { x: 0.53, y: 0.58, z: 0 }; // curled in, close to index base
  const result = fingerExtension(lm);
  assert.equal(result[0], false, "thumb tucked against the palm should not read as extended");
});

test("thumb splayed far away from the palm is detected as extended (default threshold)", () => {
  const lm = baseLandmarks();
  lm[LM.WRIST] = { x: 0.5, y: 0.9, z: 0 };
  lm[LM.INDEX_MCP] = { x: 0.55, y: 0.55, z: 0 };
  lm[LM.THUMB_MCP] = { x: 0.42, y: 0.75, z: 0 };
  lm[LM.THUMB_TIP] = { x: 0.05, y: 0.80, z: 0 }; // splayed well out to the side
  const result = fingerExtension(lm);
  assert.equal(result[0], true, "thumb splayed far out should read as extended");
});

test("thumbSplayRatio exposes the raw ratio for calibration, and a custom threshold can use it", () => {
  const lm = baseLandmarks();
  lm[LM.INDEX_MCP] = { x: 0.55, y: 0.55, z: 0 };
  lm[LM.THUMB_MCP] = { x: 0.42, y: 0.75, z: 0 };
  lm[LM.THUMB_TIP] = { x: 0.15, y: 0.75, z: 0 }; // moderately splayed
  const ratio = thumbSplayRatio(lm);
  assert.ok(ratio > 1, "moderately splayed thumb should have ratio > 1");

  // A lower, more permissive threshold should pick this pose up as extended
  // even though the default (higher) threshold might not.
  const permissive = fingerExtension(lm, 1.2, ratio - 0.1);
  const strict = fingerExtension(lm, 1.2, ratio + 0.1);
  assert.equal(permissive[0], true);
  assert.equal(strict[0], false);
});

test("FingerDebouncer ignores single-frame flicker", () => {
  const debouncer = new FingerDebouncer(3);
  debouncer.update([false, false, false, false, false]);
  const afterFlicker = debouncer.update([true, false, false, false, false]);
  assert.equal(afterFlicker[0], false, "one noisy frame should not toggle state yet");
});

test("FingerDebouncer commits after enough stable frames", () => {
  const debouncer = new FingerDebouncer(3);
  debouncer.update([true, false, false, false, false]);
  debouncer.update([true, false, false, false, false]);
  const result = debouncer.update([true, false, false, false, false]);
  assert.equal(result[0], true, "three stable frames should commit the new state");
});

test("FingerDebouncer resets the stability counter on a flip-flop", () => {
  const debouncer = new FingerDebouncer(3);
  debouncer.update([true, false, false, false, false]);
  debouncer.update([true, false, false, false, false]);
  debouncer.update([false, false, false, false, false]); // interrupts the streak
  const result = debouncer.update([true, false, false, false, false]);
  assert.equal(result[0], false, "streak should have been reset by the interruption");
});
