import React from 'react';
import { Knob } from './Knob';

interface EnvelopeProps {
  config: {
    attack: number;
    decay: number;
    sustain: number;
    release: number;
    curvature?: number;
  };
  onConfigChange: (config: any) => void;
}

export const Envelope: React.FC<EnvelopeProps> = ({ config, onConfigChange }) => {
  const handleAttackChange = (attack: number) => {
    onConfigChange({ ...config, attack });
  };

  const handleDecayChange = (decay: number) => {
    onConfigChange({ ...config, decay });
  };

  const handleSustainChange = (sustain: number) => {
    onConfigChange({ ...config, sustain });
  };

  const handleReleaseChange = (release: number) => {
    onConfigChange({ ...config, release });
  };

  const handleCurvatureChange = (curvature: number) => {
    onConfigChange({ ...config, curvature });
  };

  return (
    <div className="bg-gray-900 p-2 rounded-lg shadow-xl border border-gray-800">
      <div className="flex flex-col items-center">
        <div className="flex justify-center gap-3">
          <Knob
            label="Attack"
            value={config.attack}
            min={0.001}
            max={2}
            step={0.001}
            size="sm"
            onChange={handleAttackChange}
          />
          
          <Knob
            label="Decay"
            value={config.decay}
            min={0.001}
            max={2}
            step={0.001}
            size="sm"
            onChange={handleDecayChange}
          />
          
          <Knob
            label="Sustain"
            value={config.sustain}
            min={0}
            max={1}
            step={0.01}
            size="sm"
            onChange={handleSustainChange}
          />
        </div>

        <div className="flex justify-center gap-3 mt-2">
          <Knob
            label="Release"
            value={config.release}
            min={0.001}
            max={2}
            step={0.001}
            size="sm"
            onChange={handleReleaseChange}
          />
          
          <Knob
            label="Curve"
            value={config.curvature || 0}
            min={-1}
            max={1}
            step={0.01}
            size="sm"
            onChange={handleCurvatureChange}
          />
        </div>
      </div>
    </div>
  );
};

export default Envelope; 