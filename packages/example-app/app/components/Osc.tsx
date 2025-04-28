import React, { useState, useEffect } from 'react';
import { Knob } from './Knob';
import { OscillatorConfig } from '../page';
interface WaveformSelectorProps {
    value: 'sine' | 'square' | 'sawtooth' | 'triangle';
    onChange: (value: 'sine' | 'square' | 'sawtooth' | 'triangle') => void;
}

const WaveformSelector: React.FC<WaveformSelectorProps> = ({ value, onChange }) => {
    const waveforms = [
        { id: 'sine', label: 'Sine' },
        { id: 'square', label: 'Square' },
        { id: 'sawtooth', label: 'Saw' },
        { id: 'triangle', label: 'Tri' },
        { id: 'noise', label: 'Noise' }
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
                        onClick={() => onChange(waveform.id as 'sine' | 'square' | 'sawtooth' | 'triangle')}
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

interface OscProps {
    config: OscillatorConfig
    onConfigChange: (config: Partial<OscillatorConfig>) => void;
}

export const Osc: React.FC<OscProps> = ({ config, onConfigChange }) => {
    const handleWaveformChange = (type: 'sine' | 'square' | 'sawtooth' | 'triangle') => {
        onConfigChange({ type });
    };

    const handleDetuneChange = (detune: number) => {
        onConfigChange({ detune });
    };

    const handleLevelChange = (level: number) => {
        onConfigChange({ level });
    };

    const handleUnisonVoicesChange = (voices: number) => {
        onConfigChange({ unisonVoices: voices });
    };

    const handleUnisonSpreadChange = (spread: number) => {
        onConfigChange({ unisonSpread: spread });
    };

    const handleUnisonStereoChange = (stereo: number) => {
        onConfigChange({ unisonStereo: stereo });
    };

    return (
        <div className="bg-gray-900 p-2 rounded-lg shadow-xl border border-gray-800">
            <div className="flex flex-col items-center">
                <WaveformSelector value={config.type} onChange={handleWaveformChange} />

                <div className="flex justify-center gap-3 mt-2">
                    <Knob
                        label="Level"
                        value={config.level ?? 0}
                        min={0}
                        max={1}
                        step={0.01}
                        size="sm"
                        onChange={handleLevelChange}
                    />

                    <Knob
                        label="Detune"
                        value={config.detune ?? 0}
                        min={-100}
                        max={100}
                        size="sm"
                        onChange={handleDetuneChange}
                    />
                </div>

                {config.unisonVoices !== undefined && (
                    <div className="mt-2">
                        <div className="flex justify-center gap-2">
                            <Knob
                                label="Voices"
                                value={config.unisonVoices}
                                min={1}
                                max={16}
                                size="sm"
                                onChange={handleUnisonVoicesChange}
                            />

                            <Knob
                                label="Spread"
                                value={config.unisonSpread ?? 0}
                                min={0}
                                max={100}
                                size="sm"
                                onChange={handleUnisonSpreadChange}
                            />

                            <Knob
                                label="Stereo"
                                value={config.unisonStereo ?? 0}
                                min={0}
                                max={100}
                                size="sm"
                                onChange={handleUnisonStereoChange}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Osc;
