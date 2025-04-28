import React from 'react';
import { EnvelopeConfig } from '../page';
import { Knob } from './Knob';

interface EnvelopeProps {
  config: EnvelopeConfig;
  onConfigChange: (newConfig: Partial<EnvelopeConfig>) => void;
}

export function Envelope({ config, onConfigChange }: EnvelopeProps) {
  const handleAttackChange = (attack: number) => {
    onConfigChange({ attack });
  };

  const handleDecayChange = (decay: number) => {
    onConfigChange({ decay });
  };

  const handleSustainChange = (sustain: number) => {
    onConfigChange({ sustain });
  };

  const handleReleaseChange = (release: number) => {
    onConfigChange({ release });
  };

  return (
    <div className="bg-gray-900 p-2 rounded-lg shadow-xl border border-gray-800">
      <div className="flex flex-row justify-center gap-3">
        <Knob
          label="Attack"
          value={config.attack}
          min={0.001}
          max={2}
          step={0.001}
          size="sm"
          onChange={handleAttackChange}
          formatLabel={(value) => value.toFixed(2) + 's'}
        />
        
        <Knob
          label="Decay"
          value={config.decay}
          min={0.001}
          max={2}
          step={0.001}
          size="sm"
          onChange={handleDecayChange}
          formatLabel={(value) => value.toFixed(2) + 's'}
        />
        
        <Knob
          label="Sustain"
          value={config.sustain}
          min={0}
          max={1}
          step={0.01}
          size="sm"
          onChange={handleSustainChange}
          formatLabel={(value) => value.toFixed(2)}
        />
        
        <Knob
          label="Release"
          value={config.release}
          min={0.001}
          max={2}
          step={0.001}
          size="sm"
          onChange={handleReleaseChange}
          formatLabel={(value) => value.toFixed(2) + 's'}
        />
      </div>
    </div>
  );
} 