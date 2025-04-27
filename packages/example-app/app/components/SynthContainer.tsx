import React, { useCallback, useEffect } from "react";
import { useSynth, UseSynthConfig } from "use-synth";

/*
 * A minimal demo component that wires the `useSynth` hook to a simple
 * on‑screen keyboard and basic computer‑keyboard mapping.
 * Feel free to style / expand – this is just a quick starting point.
 */

// --- Helper: build a very small keyboard map (ASDF row) ---
const KEYBOARD_MAP: Record<string, { note: number }> = {
  KeyA: { note: 60 }, // C4
  KeyW: { note: 61 }, // C#4
  KeyS: { note: 62 }, // D4
  KeyE: { note: 63 }, // D#4
  KeyD: { note: 64 }, // E4
  KeyF: { note: 65 }, // F4
  KeyT: { note: 66 },
  KeyG: { note: 67 },
  KeyY: { note: 68 },
  KeyH: { note: 69 },
  KeyU: { note: 70 },
  KeyJ: { note: 71 },
  KeyK: { note: 72 }, // C5
};

// --- Static preset config (saw pad) ---
const PRESET: UseSynthConfig = {
  options: {
    debug: true,
  },
  components: {
    oscillators: {
      main: {
        type: "sawtooth",
        detune: -7,
        unison: { voices: 5, spread: 25, stereo: 50 },
      },
    },
    filters: {
      lpf: {
        type: "lowpass",
        frequency: 1600,
        Q: 0.9,
        envAmount: 0.4,
      },
    },
    effects: {},
    lfos: {
      vibrato: { type: "sine", rate: 5, sync: false },
    },
    envelopes: {
      amp: { attack: 0.05, decay: 0.2, sustain: 0.8, release: 0.4 },
    },
  },
  routing: [
    { from: "main", to: "lpf" },
    { from: "lpf", to: "output" },
  ],
  modulation: [
    {
      source: { type: "lfo", id: "vibrato" },
      target: { path: "oscillators.main.detune" },
      amount: 20,
    },
  ],
  input: {
    keyboard: {
      mapping: KEYBOARD_MAP,
      velocity: "dynamic",
    },
  },
};

export const SynthPath: React.FC = () => {
  const synth = useSynth(PRESET);

  /* ------------------------------------------------------
   * Computer keyboard handling
   * ----------------------------------------------------*/
  const handleDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.repeat) return;
      const map = PRESET.input.keyboard!.mapping[e.code];
      if (map) {
        synth.triggerNote(map.note, 1);
      }
    },
    [synth]
  );

  const handleUp = useCallback(
    (e: KeyboardEvent) => {
      const map = PRESET.input.keyboard!.mapping[e.code];
      if (map) synth.releaseNote(map.note);
    },
    [synth]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleDown);
    window.addEventListener("keyup", handleUp);
    return () => {
      window.removeEventListener("keydown", handleDown);
      window.removeEventListener("keyup", handleUp);
    };
  }, [handleDown, handleUp]);

  /* ------------------------------------------------------
   * Simple on‑screen button keyboard (click / touch)
   * ----------------------------------------------------*/
  const renderKeys = () =>
    Object.entries(KEYBOARD_MAP).map(([code, { note }]) => (
      <button
        key={code}
        className="m-1 w-8 h-24 rounded-lg shadow active:scale-95 transition"
        onMouseDown={() => synth.triggerNote(note, 1)}
        onMouseUp={() => synth.releaseNote(note)}
        onMouseLeave={() => synth.releaseNote(note)}
      >
        {code.replace("Key", "")}
      </button>
    ));

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <h2 className="text-xl font-semibold">SynthPath Demo</h2>
      <div className="flex">{renderKeys()}</div>
      <p className="text-xs opacity-70">
        Play with A‑K keys or click the buttons.
      </p>
    </div>
  );
};
