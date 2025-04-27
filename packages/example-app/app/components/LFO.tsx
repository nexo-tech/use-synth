import React from 'react';
import { Knob } from './Knob';

interface WaveformSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const WaveformSelector: React.FC<WaveformSelectorProps> = ({ value, onChange }) => {
  const waveforms = [
    { id: 'sine', label: 'Sine' },
    { id: 'square', label: 'Square' },
    { id: 'triangle', label: 'Tri' },
    { id: 'samplehold', label: 'S&H' }
  ];

  return (
    <div className="flex flex-col items-center mb-1">
      <div className="flex space-x-0.5 bg-gray-800 p-0.5 rounded">
        {waveforms.map((waveform) => (
          <button
            key={waveform.id}
            className={`px-1.5 py-0.5 rounded text-[10px] font-quantico transition-colors relative ${value === waveform.id
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
            }`}
            onClick={() => onChange(waveform.id)}
          >
            {waveform.label}
            {value === waveform.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400 rounded-b" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

interface LFOProps {
  config: {
    type: string;
    rate: number;
    sync?: boolean;
    shape?: number;
    phase?: number;
    delay?: number;
    fade?: number;
  };
  onConfigChange: (config: any) => void;
}

export const LFO: React.FC<LFOProps> = ({ config, onConfigChange }) => {
  const handleWaveformChange = (type: string) => {
    onConfigChange({ ...config, type });
  };

  const handleRateChange = (rate: number) => {
    onConfigChange({ ...config, rate });
  };

  const handleShapeChange = (shape: number) => {
    onConfigChange({ ...config, shape });
  };

  const handlePhaseChange = (phase: number) => {
    onConfigChange({ ...config, phase });
  };

  return (
    <div className="bg-gray-900 p-2 rounded-lg shadow-xl border border-gray-800">
      <div className="flex flex-col items-center">
        <WaveformSelector value={config.type} onChange={handleWaveformChange} />
        
        <div className="flex justify-center gap-3 mt-2">
          <Knob
            label="Rate"
            value={config.rate}
            min={0.1}
            max={20}
            step={0.1}
            size="sm"
            onChange={handleRateChange}
          />
          
          <Knob
            label="Shape"
            value={config.shape || 0}
            min={0}
            max={1}
            step={0.01}
            size="sm"
            onChange={handleShapeChange}
          />
          
          <Knob
            label="Phase"
            value={config.phase || 0}
            min={0}
            max={360}
            size="sm"
            onChange={handlePhaseChange}
          />
        </div>
      </div>
    </div>
  );
};

export default LFO; 