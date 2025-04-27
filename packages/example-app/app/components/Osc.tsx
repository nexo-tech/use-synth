import React, { useState } from 'react';

interface KnobProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  label: string;
  onChange: (value: number) => void;
  size?: 'sm' | 'md' | 'lg';
}

const Knob: React.FC<KnobProps> = ({
  value,
  min,
  max,
  step = 1,
  label,
  onChange,
  size = 'md',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [startValue, setStartValue] = useState(value);

  // Calculate rotation angle based on value
  const range = max - min;
  const percentage = (value - min) / range;
  const degrees = percentage * 270 - 135; // -135 to +135 degrees

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartY(e.clientY);
    setStartValue(value);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    
    const deltaY = startY - e.clientY;
    const sensitivityFactor = 0.5;
    const newValue = Math.min(
      max,
      Math.max(min, startValue + deltaY * sensitivityFactor * (range / 100))
    );
    
    onChange(parseFloat(newValue.toFixed(step < 1 ? 2 : 0)));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  // Size classes
  const sizeClasses = {
    sm: 'w-12 h-12 text-xs',
    md: 'w-16 h-16 text-sm',
    lg: 'w-20 h-20 text-base',
  };

  return (
    <div className="flex flex-col items-center">
      <div 
        className={`relative ${sizeClasses[size]} rounded-full bg-gray-800 border-2 border-gray-700 shadow-lg cursor-pointer`}
        onMouseDown={handleMouseDown}
      >
        <div 
          className="absolute w-1 h-5 bg-white rounded-full top-2 left-1/2 transform -translate-x-1/2 origin-bottom"
          style={{ transform: `translateX(-50%) rotate(${degrees}deg)` }}
        />
        <div className="absolute inset-0 rounded-full border-4 border-transparent hover:border-blue-500 transition-colors" />
      </div>
      <div className="mt-2 text-center font-quantico">
        <div className="font-bold">{label}</div>
        <div className="text-gray-400">{value}</div>
      </div>
    </div>
  );
};

interface WaveformSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const WaveformSelector: React.FC<WaveformSelectorProps> = ({ value, onChange }) => {
  const waveforms = [
    { id: 'sine', label: 'Sine' },
    { id: 'square', label: 'Square' },
    { id: 'sawtooth', label: 'Saw' },
    { id: 'triangle', label: 'Triangle' },
    { id: 'noise', label: 'Noise' }
  ];

  return (
    <div className="flex flex-col items-center mb-4">
      <h3 className="text-lg font-quantico mb-2">Waveform</h3>
      <div className="flex space-x-1">
        {waveforms.map((waveform) => (
          <button
            key={waveform.id}
            className={`px-3 py-2 rounded font-quantico text-sm transition-colors ${
              value === waveform.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
            }`}
            onClick={() => onChange(waveform.id)}
          >
            {waveform.label}
          </button>
        ))}
      </div>
    </div>
  );
};

interface OscProps {
  config: {
    type: string;
    detune: number;
    level: number;
    unison?: {
      voices: number;
      spread: number;
      stereo: number;
    };
  };
  onConfigChange: (config: any) => void;
}

export const Osc: React.FC<OscProps> = ({ config, onConfigChange }) => {
  const handleWaveformChange = (type: string) => {
    onConfigChange({ ...config, type });
  };

  const handleDetuneChange = (detune: number) => {
    onConfigChange({ ...config, detune });
  };

  const handleLevelChange = (level: number) => {
    onConfigChange({ ...config, level });
  };

  const handleUnisonVoicesChange = (voices: number) => {
    const newUnison = { ...config.unison, voices };
    onConfigChange({ ...config, unison: newUnison });
  };

  const handleUnisonSpreadChange = (spread: number) => {
    const newUnison = { ...config.unison, spread };
    onConfigChange({ ...config, unison: newUnison });
  };

  const handleUnisonStereoChange = (stereo: number) => {
    const newUnison = { ...config.unison, stereo };
    onConfigChange({ ...config, unison: newUnison });
  };

  return (
    <div className="bg-gray-900 p-6 rounded-xl shadow-xl border border-gray-800">
      <h2 className="text-2xl font-quantico font-bold mb-4 text-center text-blue-400">Oscillator</h2>
      
      <WaveformSelector value={config.type} onChange={handleWaveformChange} />
      
      <div className="flex flex-wrap justify-center gap-6 mt-6">
        <Knob
          label="Level"
          value={config.level}
          min={0}
          max={1}
          step={0.01}
          onChange={handleLevelChange}
        />
        
        <Knob
          label="Detune"
          value={config.detune}
          min={-100}
          max={100}
          onChange={handleDetuneChange}
        />
      </div>
      
      {config.unison && (
        <div>
          <h3 className="text-lg font-quantico mt-6 mb-3 text-center">Unison</h3>
          <div className="flex flex-wrap justify-center gap-4">
            <Knob
              label="Voices"
              value={config.unison.voices}
              min={1}
              max={16}
              size="sm"
              onChange={handleUnisonVoicesChange}
            />
            
            <Knob
              label="Spread"
              value={config.unison.spread}
              min={0}
              max={100}
              size="sm"
              onChange={handleUnisonSpreadChange}
            />
            
            <Knob
              label="Stereo"
              value={config.unison.stereo}
              min={0}
              max={100}
              size="sm"
              onChange={handleUnisonStereoChange}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Osc;
