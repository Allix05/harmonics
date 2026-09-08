import { test } from "node:test";
import assert from "node:assert/strict";
import {
  noteNameToMidi,
  midiToFrequency,
  diatonicChordSemitones,
  zoneForX,
  chordForHand,
  SCALES,
} from "../music.js";

test("noteNameToMidi: C4 is MIDI 60 (standard convention)", () => {
  assert.equal(noteNameToMidi("C", 4), 60);
});

test("midiToFrequency: A4 (MIDI 69) is 440 Hz", () => {
  assert.ok(Math.abs(midiToFrequency(69) - 440) < 1e-9);
});

test("midiToFrequency: one octave up doubles the frequency", () => {
  const f1 = midiToFrequency(60);
  const f2 = midiToFrequency(72);
  assert.ok(Math.abs(f2 - f1 * 2) < 1e-9);
});

test("diatonicChordSemitones: I chord in major is a root position major triad (0,4,7)", () => {
  const [root, third, fifth] = diatonicChordSemitones(SCALES.major, 0);
  assert.deepEqual([root, third, fifth], [0, 4, 7]);
});

test("diatonicChordSemitones: vi chord in major is a minor triad (9,12,16 -> relative 9,0,4 next octave)", () => {
  // vi = A in C major: A, C, E -> semitones from C: 9, 12, 16
  const [root, third, fifth] = diatonicChordSemitones(SCALES.major, 5);
  assert.deepEqual([root, third, fifth], [9, 12, 16]);
});

test("diatonicChordSemitones: pinky (5th element) is always root + octave", () => {
  const chord = diatonicChordSemitones(SCALES.major, 3);
  assert.equal(chord[4], chord[0] + 12);
});

test("zoneForX clamps to valid range", () => {
  assert.equal(zoneForX(-0.1, 4), 0);
  assert.equal(zoneForX(0, 4), 0);
  assert.equal(zoneForX(0.99, 4), 3);
  assert.equal(zoneForX(1.5, 4), 3);
});

test("zoneForX divides [0,1) evenly", () => {
  assert.equal(zoneForX(0.1, 4), 0);
  assert.equal(zoneForX(0.3, 4), 1);
  assert.equal(zoneForX(0.6, 4), 2);
  assert.equal(zoneForX(0.9, 4), 3);
});

test("chordForHand returns 5 ascending-ish frequencies with root < octave", () => {
  const { frequencies } = chordForHand("C", 4, "major", 0.1);
  assert.equal(frequencies.length, 5);
  assert.ok(frequencies[4] > frequencies[0], "octave (pinky) should be higher than root (thumb)");
  assert.ok(Math.abs(frequencies[4] - frequencies[0] * 2) < 1e-6, "pinky is exactly one octave above thumb");
});

test("chordForHand moving hand across zones changes the chord root", () => {
  const left = chordForHand("C", 4, "major", 0.1);
  const right = chordForHand("C", 4, "major", 0.9);
  assert.notEqual(left.degree, right.degree);
});
