import React from 'react';
import { Knob } from './Knob';

interface FilterTypeSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const FilterTypeSelector: React.FC<FilterTypeSelectorProps> = ({ value, onChange }) => {
  const filterTypes = [
    { id: 'lowpass', label: 'LPF' },
    { id: 'highpass', label: 'HPF' },
    { id: 'bandpass', label: 'BPF' },
    { id: 'notch', label: 'Notch' },
    { id: 'moogladder', label: 'Moog' }
  ];

  return (
    <div className="flex flex-col items-center mb-1">
      <div className="flex space-x-0.5 bg-gray-800 p-0.5 rounded">
        {filterTypes.map((type) => (
          <button
            key={type.id}
            className={`px-1.5 py-0.5 rounded text-[10px] font-quantico transition-colors relative ${value === type.id
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
            }`}
            onClick={() => onChange(type.id)}
          >
            {type.label}
            {value === type.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400 rounded-b" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

interface FilterProps {
  config: {
    type: BiquadFilterType;
    frequency?: number;
    Q?: number;
    gain?: number;
    keytrack?: number;
    envAmount?: number;
  };
  onConfigChange: (config: any) => void;
}

export const Filter: React.FC<FilterProps> = ({ config, onConfigChange }) => {
  const handleTypeChange = (type: string) => {
    onConfigChange({ ...config, type });
  };

  // Convert linear value (0-1) to logarithmic frequency (20-20000)
  const linearToLog = (value: number) => {
    const minFreq = 20;
    const maxFreq = 20000;
    const minLog = Math.log10(minFreq);
    const maxLog = Math.log10(maxFreq);
    const logValue = minLog + (maxLog - minLog) * value;
    return Math.pow(10, logValue);
  };

  // Convert logarithmic frequency to linear value (0-1)
  const logToLinear = (freq: number) => {
    const minFreq = 20;
    const maxFreq = 20000;
    const minLog = Math.log10(minFreq);
    const maxLog = Math.log10(maxFreq);
    const logFreq = Math.log10(freq);
    return (logFreq - minLog) / (maxLog - minLog);
  };

  const handleFrequencyChange = (value: number) => {
    const freq = linearToLog(value);
    onConfigChange({ ...config, frequency: freq });
  };

  // Format frequency for display
  const formatFrequency = (freq: number) => {
    if (freq >= 1000) {
      return `${(freq / 1000).toFixed(1)}k`;
    }
    return Math.round(freq).toString();
  };

  const handleQChange = (Q: number) => {
    onConfigChange({ ...config, Q });
  };

  const handleGainChange = (gain: number) => {
    onConfigChange({ ...config, gain });
  };

  const handleKeytrackChange = (keytrack: number) => {
    onConfigChange({ ...config, keytrack });
  };

  const handleEnvAmountChange = (envAmount: number) => {
    onConfigChange({ ...config, envAmount });
  };

  return (
    <div className="bg-gray-900 p-2 rounded-lg shadow-xl border border-gray-800">
      <div className="flex flex-col items-center">
        <FilterTypeSelector value={config.type} onChange={handleTypeChange} />
        
        <div className="flex justify-center gap-3 mt-2">
          <Knob
            label="Freq"
            value={logToLinear(config.frequency ?? 1000)}
            min={0}
            max={1}
            step={0.001}
            size="sm"
            onChange={handleFrequencyChange}
            formatLabel={(value) => formatFrequency(linearToLog(value)) + 'Hz'}
          />
          
          <Knob
            label="Q"
            value={config.Q ?? 1}
            min={0.1}
            max={20}
            step={0.1}
            size="sm"
            onChange={handleQChange}
          />
          
          <Knob
            label="Gain"
            value={config.gain ?? 0}
            min={-40}
            max={40}
            step={0.1}
            size="sm"
            onChange={handleGainChange}
          />
        </div>

        <div className="flex justify-center gap-3 mt-2">
          <Knob
            label="KeyTrack"
            value={config.keytrack ?? 0}
            min={0}
            max={100}
            step={1}
            size="sm"
            onChange={handleKeytrackChange}
          />
          
          <Knob
            label="Env Amt"
            value={config.envAmount ?? 0}
            min={0}
            max={1}
            step={0.01}
            size="sm"
            onChange={handleEnvAmountChange}
          />
        </div>
      </div>
    </div>
  );
};

export default Filter; 