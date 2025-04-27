'use client';

import React from 'react';
import { SynthPath as SynthPad } from './components/SynthContainer';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-8">
      <div className="z-10 w-full max-w-5xl flex flex-col items-center">
        <h1 className="text-4xl font-bold mb-8 text-center">
          useSynth Example
        </h1>

        <SynthPad />

        <div className="mt-12 opacity-80 text-sm text-center">
          <p>
            Built with <a href="https://github.com/yourusername/useSynth" className="underline hover:text-blue-500">useSynth</a>
          </p>
        </div>
      </div>
    </main>
  );
} 