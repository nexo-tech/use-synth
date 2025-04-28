"use client"

import { SynthEngine, UseSynthConfig } from "./engine";


const baseConfig: UseSynthConfig = {
  polyphony: 8,
  maxVoices: 5,
  components: {
    oscillators: {
      osc1: {
        type: 'sawtooth',
        detune: -7,
        level: 0.5,
        unisonVoices: 5,
        unisonSpread: 25,
        unisonStereo: 50,
      },
      osc2: {
        type: 'sawtooth',
        detune: -7,
        level: 0.5,
        pitch: 12,
        unisonVoices: 5,
        unisonSpread: 25,
        unisonStereo: 50,
      },
    },
    filters: {
      fil1: {
        type: 'lowpass',
        frequency: 1000,
        Q: 1,
        gain: 1,
      },
    },
    effects: {},
    lfos: {},
    envelopes: {
      env1: { attack: 0.05, decay: 0.2, sustain: 1.0, release: 0.4 },
    },
  },
  routing: [
    { from: 'env1', to: 'osc1' },
    { from: 'env1', to: 'osc2' },
    { from: 'fil1', to: 'output' },
    { from: 'osc1', to: 'fil1' },
    { from: 'osc2', to: 'fil1' }
  ],
  modulation: [
    { sourceId: 'env1', targetId: 'fil1.frequency', amount: 500 },
  ],
};

export default function OscillatorPage() {
  return <div>
    <button onClick={() => {
      (async () => {
        const engine = new SynthEngine(baseConfig);
        await engine.ctx.resume();
        engine.noteOn(60);
        setTimeout(() => {
          console.log("note off");
          engine.noteOff(60)
        }, 1000);
      })();
    }}>Play</button>
  </div>
}