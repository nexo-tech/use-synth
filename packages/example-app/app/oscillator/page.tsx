'use client';

import React, { useState } from 'react';
import Osc from '../components/Osc';

export default function OscillatorPage() {
  const [oscConfig, setOscConfig] = useState({
    type: 'sawtooth',
    detune: -7,
    level: 0.5,
    unison: {
      voices: 5,
      spread: 25,
      stereo: 50,
    },
  });

  const handleConfigChange = (newConfig: any) => {
    setOscConfig(newConfig);
    console.log('Oscillator config updated:', newConfig);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-950 text-white">
      <h1 className="text-4xl font-quantico font-bold mb-8 text-center">
        Oscillator Controls
      </h1>
      
      <div className="max-w-md w-full">
        <Osc config={oscConfig} onConfigChange={handleConfigChange} />
      </div>
      
      <div className="mt-8 p-4 bg-gray-800 rounded-lg w-full max-w-md">
        <h3 className="text-lg font-quantico mb-2">Current Configuration:</h3>
        <pre className="text-xs overflow-auto p-2 bg-gray-900 rounded">
          {JSON.stringify(oscConfig, null, 2)}
        </pre>
      </div>
    </main>
  );
} 