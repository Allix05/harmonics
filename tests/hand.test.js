import { test } from "node:test";
import assert from "node:assert/strict";
import { fingerExtension, FingerDebouncer, LM } from "../hand.js";

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
