declare module 'use-synth' {
  export interface OscillatorConfig {
    id: string;
    type: string;
    frequency: number;
    detune: number;
    gain: number;
  }

  export interface FilterConfig {
    id: string;
    type: string;
    frequency: number;
    Q: number;
    gain: number;
  }

  export interface EffectConfig {
    id: string;
    type: string;
    [key: string]: any;
  }

  export interface EnvelopeConfig {
    id: string;
    attack: number;
    decay: number;
    sustain: number;
    release: number;
  }

  export interface LFOConfig {
    id: string;
    type: string;
    frequency: number;
    amplitude: number;
  }

  export interface ModulationConfig {
    source: string;
    destination: string;
    amount: number;
  }

  export interface RoutingConfig {
    from: string;
    to: string;
  }

  export interface InputConfig {
    midiEnabled: boolean;
    audioEnabled: boolean;
  }

  export interface SynthConfig {
    oscillators: OscillatorConfig[];
    filters: FilterConfig[];
    effects: EffectConfig[];
    lfos: LFOConfig[];
    envelopes: EnvelopeConfig[];
    routing: RoutingConfig[];
    modulation: ModulationConfig[];
    input: InputConfig;
  }

  export function useSynth(config: SynthConfig): {
    updateConfig: (config: Partial<SynthConfig>) => void;
    isPlaying: boolean;
    play: (note: number, velocity?: number) => void;
    stop: (note: number) => void;
    stopAll: () => void;
  };
} 