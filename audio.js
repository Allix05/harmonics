// Instrument presets built on Tone.js synths. All synthesized (no sample
// licensing to worry about), each with a distinct character.
export function createInstruments(Tone) {
  const make = (Voice, options) => new Tone.PolySynth(Voice, options).toDestination();

  // Electric guitar: a sawtooth voice pushed through overdrive-style
  // distortion and a lowpass filter to tame the harshness, plus a touch of
  // chorus for that shimmery clean-electric character.
  const guitarDistortion = new Tone.Distortion(0.35).toDestination();
  const guitarChorus = new Tone.Chorus(4, 2.5, 0.3).connect(guitarDistortion).start();
  const guitarFilter = new Tone.Filter(3200, "lowpass").connect(guitarChorus);
  const electricGuitar = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "sawtooth" },
    envelope: { attack: 0.005, decay: 0.3, sustain: 0.35, release: 0.4 },
  }).connect(guitarFilter);

  return {
    "Warm Synth": make(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.02, decay: 0.2, sustain: 0.6, release: 0.8 },
    }),
    Pluck: make(Tone.Synth, {
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.2 },
    }),
    Bell: make(Tone.FMSynth, {
      harmonicity: 3.01,
      modulationIndex: 12,
      envelope: { attack: 0.005, decay: 1.2, sustain: 0.1, release: 1.5 },
      modulationEnvelope: { attack: 0.01, decay: 0.5, sustain: 0.2, release: 0.5 },
    }),
    Pad: make(Tone.AMSynth, {
      oscillator: { type: "sine" },
      envelope: { attack: 0.6, decay: 0.4, sustain: 0.8, release: 2.0 },
      modulation: { type: "sine" },
    }),
    Marimba: make(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.3 },
    }),
    "Electric Guitar": electricGuitar,
  };
}

// Tracks which (hand, finger) voices are currently held so we can release
// exactly the right frequency later even if the chord shifts underneath a
// still-held finger.
export class VoiceManager {
  constructor(synth) {
    this.synth = synth;
    this.held = new Map(); // key: "handIdx:fingerIdx" -> frequency
  }

  setSynth(synth) {
    // Release everything on the old synth before switching instruments.
    for (const freq of this.held.values()) this.synth.triggerRelease(freq);
    this.held.clear();
    this.synth = synth;
  }

  noteOn(voiceKey, frequency) {
    if (this.held.has(voiceKey)) return;
    this.held.set(voiceKey, frequency);
    this.synth.triggerAttack(frequency);
  }

  noteOff(voiceKey) {
    const freq = this.held.get(voiceKey);
    if (freq === undefined) return;
    this.held.delete(voiceKey);
    this.synth.triggerRelease(freq);
  }

  releaseAll() {
    for (const freq of this.held.values()) this.synth.triggerRelease(freq);
    this.held.clear();
  }
}
