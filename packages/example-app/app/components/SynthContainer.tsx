import React, { useCallback, useEffect, useState } from "react";
import { useSynth, UseSynthConfig, UseSynthReturn, OscillatorConfig, FilterConfig, LFOConfig, EnvelopeConfig } from "use-synth";
import { Osc } from "./Osc";
import { LFO } from "./LFO";
import { Envelope } from "./Envelope";
import { Filter } from "./Filter";

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

// --- Initial config ---
const INITIAL_CONFIG: UseSynthConfig = {
  components: {
    oscillators: {
      main: {
        type: "sawtooth",
        detune: -7,
        level: 0.5,
        unison: { voices: 5, spread: 25, stereo: 50 },
      },
    },
    filters: {
      lpf: {
        type: "lowpass",
        frequency: 400,
        Q: 0.9,
        envAmount: 1,
      },
    },
    effects: {},
    lfos: {
      vibrato: { type: "sine", rate: 5, sync: false },
    },
    envelopes: {
      amp: { attack: 0.05, decay: 0.2, sustain: 1.0, release: 0.4 },
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

export const SynthContainer: React.FC = () => {
  const [synthConfig, setSynthConfig] = useState<UseSynthConfig>(INITIAL_CONFIG);
  const synth = useSynth(synthConfig);

  // Update synth config when controls change
  const updateSynthConfig = (newConfig: Partial<UseSynthConfig>) => {
    setSynthConfig(prev => ({
      ...prev,
      components: {
        ...prev.components,
        ...newConfig.components
      }
    }));
  };

  // Handlers for each component
  const handleOscChange = (config: OscillatorConfig) => {
    const oscConfig = {
      type: config.type || "sine",
      detune: config.detune ?? 0,
      level: config.level ?? 0.5,
      unison: config.unison ? {
        voices: config.unison.voices ?? 2,
        spread: config.unison.spread ?? 0.5,
        stereo: config.unison.stereo ?? 0.5
      } : undefined
    };
    updateSynthConfig({
      components: {
        ...synthConfig.components,
        oscillators: {
          main: oscConfig
        }
      }
    });
  };

  const handleFilterChange = (config: FilterConfig) => {
    const filterConfig = {
      type: config.type || "lowpass",
      frequency: config.frequency ?? 1000,
      Q: config.Q ?? 1,
      gain: config.gain ?? 0,
      keytrack: config.keytrack ?? 0,
      envAmount: config.envAmount ?? 0
    };
    updateSynthConfig({
      components: {
        ...synthConfig.components,
        filters: {
          lpf: filterConfig
        }
      }
    });
  };

  const handleLFOChange = (config: LFOConfig) => {
    const lfoConfig = {
      type: config.type || "sine",
      rate: config.rate ?? 1,
      sync: config.sync ?? false,
      shape: config.shape ?? 0,
      phase: config.phase ?? 0,
      delay: config.delay ?? 0,
      fade: config.fade ?? 0
    };
    updateSynthConfig({
      components: {
        ...synthConfig.components,
        lfos: {
          vibrato: lfoConfig
        }
      }
    });
  };

  const handleEnvelopeChange = (config: EnvelopeConfig) => {
    const envConfig = {
      attack: config.attack ?? 0.01,
      decay: config.decay ?? 0.1,
      sustain: config.sustain ?? 0.5,
      release: config.release ?? 0.1,
      curvature: config.curvature ?? 0
    };
    updateSynthConfig({
      components: {
        ...synthConfig.components,
        envelopes: {
          amp: envConfig
        }
      }
    });
  };

  /* ------------------------------------------------------
   * Computer keyboard handling
   * ----------------------------------------------------*/
  const handleDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.repeat) return;
      const map = synthConfig.input.keyboard!.mapping[e.code];
      if (map) {
        synth.triggerNote(map.note, 1);
      }
    },
    [synth, synthConfig]
  );

  const handleUp = useCallback(
    (e: KeyboardEvent) => {
      const map = synthConfig.input.keyboard!.mapping[e.code];
      if (map) synth.releaseNote(map.note);
    },
    [synth, synthConfig]
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
      <h2 className="text-xl font-semibold">Synth Editor</h2>
      
      <div className="grid grid-cols-2 gap-4 w-full max-w-4xl">
        <div className="col-span-2">
          <Osc
            // @ts-ignore
            config={synthConfig.components.oscillators.main}
            onConfigChange={handleOscChange}
          />
        </div>
        
        <div>
          <Filter
          // @ts-ignore
            config={synthConfig.components.filters.lpf}
            onConfigChange={handleFilterChange}
          />
        </div>
        
        <div>
          <LFO
            config={synthConfig.components.lfos.vibrato}
            onConfigChange={handleLFOChange}
          />
        </div>
        
        <div className="col-span-2">
          <Envelope
            config={synthConfig.components.envelopes.amp}
            onConfigChange={handleEnvelopeChange}
          />
        </div>
      </div>

      <div className="mt-4">
        <div className="flex">{renderKeys()}</div>
        <p className="text-xs opacity-70 mt-2">
          Play with A‑K keys or click the buttons.
        </p>
      </div>
    </div>
  );
};
