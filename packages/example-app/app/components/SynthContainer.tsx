'use client';

import React, { useState, useEffect } from 'react';
import { useSynth, SynthConfig, EnvelopeConfig, FilterConfig, OscillatorConfig } from 'use-synth';

// Basic synth configuration
const initialConfig: SynthConfig = {
  oscillators: [
    { type: 'sine', gain: 0.5, detune: 0 },
    { type: 'sawtooth', gain: 0.5, detune: 0 },
  ],
  filters: [
    { type: 'lowpass', frequency: 1000, Q: 1, gain: 1 }
  ],
  effects: [
    { type: 'delay', delayTime: 0.5, feedback: 0.5, mix: 0.5 },
    { type: 'reverb', roomSize: 0.8, dampening: 3000, mix: 0.5 }
  ],
  lfos: [
    { type: 'sine', frequency: 5, amplitude: 1 }
  ],
  envelopes: [
    { attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.5 }
  ],
  routing: {
    oscillatorsToFilter: true,
    filterToEffects: true,
  },
  modulation: {
    lfo1ToFilterFrequency: 0.5,
    envelope1ToOscillatorGain: 0.8,
  },
  input: {
    midiEnabled: true,
    audioEnabled: false,
  }
};

export const SynthContainer: React.FC = () => {
  const [filterFrequency, setFilterFrequency] = useState<number>(1000);
  const [oscillatorMix, setOscillatorMix] = useState<number>(0.5);
  
  const { synth, updateConfig, noteOn, noteOff } = useSynth(initialConfig);
  
  useEffect(() => {
    if (synth) {
      updateConfig({
        filters: [
          { ...initialConfig.filters[0], frequency: filterFrequency }
        ]
      });
    }
  }, [filterFrequency, synth, updateConfig]);
  
  useEffect(() => {
    if (synth) {
      updateConfig({
        oscillators: [
          { ...initialConfig.oscillators[0], gain: 1 - oscillatorMix },
          { ...initialConfig.oscillators[1], gain: oscillatorMix }
        ]
      });
    }
  }, [oscillatorMix, synth, updateConfig]);
  
  return (
    <div className="synth-container">
      <h2>Web Synthesizer</h2>
      
      <div className="controls">
        <div className="control-group">
          <label htmlFor="filter-frequency">Filter Frequency: {filterFrequency}Hz</label>
          <input
            id="filter-frequency"
            type="range"
            min="20"
            max="20000"
            value={filterFrequency}
            onChange={(e) => setFilterFrequency(parseInt(e.target.value, 10))}
          />
        </div>
        
        <div className="control-group">
          <label htmlFor="oscillator-mix">Oscillator Mix: {oscillatorMix}</label>
          <input
            id="oscillator-mix"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={oscillatorMix}
            onChange={(e) => setOscillatorMix(parseFloat(e.target.value))}
          />
        </div>
      </div>
      
      <div className="modulation-matrix">
        <h3>Modulation Matrix</h3>
        {/* Modulation matrix controls would go here */}
      </div>
      
      <div className="keyboard">
        {/* Virtual keyboard would go here */}
        {/* When a key is pressed: noteOn(note, velocity) */}
        {/* When a key is released: noteOff(note) */}
      </div>
    </div>
  );
};

export default SynthContainer; 