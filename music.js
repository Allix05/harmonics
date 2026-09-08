// Pure music theory: scales, diatonic chords, and note math. No audio
// library dependency here, so it's unit-testable on its own.

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  majorPentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
};

// A pleasant, common 4-chord diatonic progression: I - V - vi - IV
// (scale-degree indices, 0-based). Moving your hand across the screen's
// four horizontal zones walks through these chords.
export const PROGRESSION_DEGREES = [0, 4, 5, 3];

export function noteNameToMidi(name, octave) {
  const idx = NOTE_NAMES.indexOf(name);
  if (idx === -1) throw new Error(`Unknown note name: ${name}`);
  return (octave + 1) * 12 + idx;
}

export function midiToFrequency(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Scale degree -> semitone offset from the scale's own root, wrapping
// across octaves as needed (degree can be any integer, including >7 or
// negative).
function scaleDegreeToSemitone(scale, degree) {
  const len = scale.length;
  const octaveShift = Math.floor(degree / len);
  const idx = ((degree % len) + len) % len;
  return scale[idx] + 12 * octaveShift;
}

// Builds a diatonic chord (stacked thirds within the scale) rooted at
// `rootDegree` (a scale-degree index into `scale`, e.g. 0 = I, 4 = V).
// Returns semitone offsets from the *key's* root note for: [root, 3rd, 5th,
// 7th, octave]. These correspond to [thumb, index, middle, ring, pinky].
export function diatonicChordSemitones(scale, rootDegree) {
  const rootSemitone = scaleDegreeToSemitone(scale, rootDegree);
  const third = scaleDegreeToSemitone(scale, rootDegree + 2);
  const fifth = scaleDegreeToSemitone(scale, rootDegree + 4);
  const seventh = scaleDegreeToSemitone(scale, rootDegree + 6);
  return [rootSemitone, third, fifth, seventh, rootSemitone + 12];
}

// Given a hand's normalized X position (0..1) and a number of zones,
// returns the zone index (clamped to valid range).
export function zoneForX(x, numZones) {
  const zone = Math.floor(x * numZones);
  return Math.max(0, Math.min(numZones - 1, zone));
}

// Full convenience helper: given key root note name/octave, scale name,
// and a hand X position, returns the 5 note frequencies (Hz) for
// [thumb, index, middle, ring, pinky] plus which progression zone/chord
// degree was used.
export function chordForHand(keyRoot, keyOctave, scaleName, handX) {
  const scale = SCALES[scaleName] ?? SCALES.major;
  const zone = zoneForX(handX, PROGRESSION_DEGREES.length);
  const degree = PROGRESSION_DEGREES[zone];
  const rootMidi = noteNameToMidi(keyRoot, keyOctave);
  const semitones = diatonicChordSemitones(scale, degree);
  const frequencies = semitones.map((s) => midiToFrequency(rootMidi + s));
  const thirdInterval = semitones[1] - semitones[0];
  const quality = thirdInterval === 4 ? "major" : thirdInterval === 3 ? "minor" : "chord";
  const chordRootName = NOTE_NAMES[(rootMidi + semitones[0]) % 12];
  return { zone, degree, frequencies, quality, chordRootName };
}
