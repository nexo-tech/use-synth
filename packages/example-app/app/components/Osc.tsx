import React, { useState, useEffect } from 'react';
import { Knob } from './Knob';
interface WaveformSelectorProps {
    value: string;
    onChange: (value: string) => void;
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
        <div className="bg-gray-900 p-2 rounded-lg shadow-xl border border-gray-800">
            <div className="flex flex-col items-center">
                <WaveformSelector value={config.type} onChange={handleWaveformChange} />

                <div className="flex justify-center gap-3 mt-2">
                    <Knob
                        label="Level"
                        value={config.level}
                        min={0}
                        max={1}
                        step={0.01}
                        size="sm"
                        onChange={handleLevelChange}
                    />

                    <Knob
                        label="Detune"
                        value={config.detune}
                        min={-100}
                        max={100}
                        size="sm"
                        onChange={handleDetuneChange}
                    />
                </div>

                {config.unison && (
                    <div className="mt-2">
                        <div className="flex justify-center gap-2">
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
        </div>
    );
};

export default Osc;
