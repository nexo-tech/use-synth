import { ReactNode } from 'react';

// Component Types
export type ComponentType = "oscillator" | "filter" | "effect" | "lfo" | "envelope";

// Web Audio Types
export type BiquadFilterType = 
  | "lowpass" 
  | "highpass" 
  | "bandpass" 
  | "lowshelf" 
  | "highshelf" 
  | "peaking" 
  | "notch" 
  | "allpass";

// Oscillator Types
export type OscillatorConfig = {
  type: "sine" | "square" | "sawtooth" | "triangle" | "noise" | "custom";
  frequency?: number; // Base frequency when unmodulated
  detune?: number; // Cents (±1200 = ±1 octave)
  phase?: number; // 0-360 degrees
  level?: number; // 0-100%
  unison?: {
    voices: number; // 2-8
    spread: number; // 0-100% detune spread
    stereo?: number; // 0-100% stereo pan spread
  };
  customWave?: Float32Array; // 512-sample waveform
};

// Filter Types
export type FilterConfig = {
  type: BiquadFilterType | "moogladder";
  frequency?: number; // 20-20000 Hz
  Q?: number; // 0-10
  gain?: number; // -40 to +40 dB
  keytrack?: number; // 0-100% (Hz/V)
  envAmount?: number; // -100% to +100%
};

// Effect Types
export type EffectConfig = {
  type: "delay" | "reverb" | "distortion" | "chorus";
  params: {
    // Effect-specific parameters
    delay?: { time: number; feedback: number };
    reverb?: { decay: number; wet: number };
    distortion?: { amount: number; curve: number };
    chorus?: { rate: number; depth: number; feedback: number; mix: number };
  };
};

// LFO Types
export type LFOConfig = {
  type: "sine" | "square" | "triangle" | "samplehold";
  rate: number; // 0.1-50 Hz or BPM (if sync)
  sync?: boolean; // Tempo sync
  shape?: number; // 0-1 wave shaping
  phase?: number; // 0-360 degrees
  delay?: number; // 0-5000ms before starting
  fade?: number; // 0-5000ms fade-in time
};

// Envelope Types
export type EnvelopeConfig = {
  attack: number; // 0-5000ms
  decay: number; // 0-5000ms
  sustain: number; // 0-100%
  release: number; // 50-10000ms
  curvature?: number; // -1 to +1 (ADSR shape)
};

// Routing Types
export type RoutingConnection = {
  from: string; // Component ID or 'input'
  to: string; // Component ID or 'output'
  mix?: number; // 0-100% (dry/wet for parallel)
  gain?: number; // -60 to +20 dB
  pan?: number; // -100 (L) to +100 (R)
};

// Modulation Types
export type ModulationSource =
  | { type: "envelope"; id: string }
  | { type: "lfo"; id: string }
  | { type: "velocity" }
  | { type: "pitchbend" }
  | { type: "aftertouch" }
  | { type: "midicc"; number: number };

export type ModulationTarget = {
  path: string; // e.g. 'oscillators.lead.detune'
  min?: number; // Normalization floor
  max?: number; // Normalization ceiling
  bipolar?: boolean; // Treat modulation as ±scale
};

export type ModulationEntry = {
  source: ModulationSource;
  target: ModulationTarget;
  amount: number; // -100% to +100%
  via?: string; // Optional through-VCA
};

// Input Types
export type KeyMapping = {
  note: number; // MIDI note (0-127)
  channel?: number; // 1-16
  bendRange?: number; // Semitones for pitchbend
};

export type InputConfig = {
  midi?: {
    channel?: number; // 1-16, 0=omni
    throttle?: number; // ms between updates
  };
  keyboard?: {
    mapping: Record<string, KeyMapping>;
    octave?: number; // Base octave
    velocity?: number | 'dynamic'; // 0-127 or 'dynamic'
  };
  mouse?: {
    quantize?: boolean; // Snap to semitones
    glide?: number; // Portamento time
  };
};

// Main Configuration Type
export type UseSynthConfig = {
  components: {
    oscillators: Record<string, OscillatorConfig>;
    filters: Record<string, FilterConfig>;
    effects: Record<string, EffectConfig>;
    lfos: Record<string, LFOConfig>;
    envelopes: Record<string, EnvelopeConfig>;
  };
  routing: RoutingConnection[];
  modulation: ModulationEntry[];
  input: InputConfig;
  options?: SynthOptions;
};

// Return Type for the Hook
export type ConnectionOptions = {
  gain?: number;
  pan?: number;
  type?: "audio" | "control";
};

export type NoteData = {
  frequency: number;
  velocity: number;
  startTime: number;
  endTime?: number;
  voiceNodes: AudioNode[];
};

export type SynthState = {
  activeNotes: Map<number, NoteData>;
  paramCache: Map<string, number>;
  cpuUsage: number;
};

export interface VirtualKeyboardProps {
  octave?: number;
  glowOnActive?: boolean;
  pitchBendRange?: number;
  onNoteOn?: (note: number, velocity: number) => void;
  onNoteOff?: (note: number) => void;
  className?: string;
  children?: ReactNode;
}

export interface ModulationMatrixProps {
  sources?: ModulationSource[];
  targets?: ModulationTarget[];
  values?: Record<string, number>;
  onChange?: (matrix: ModulationEntry[]) => void;
  className?: string;
  children?: ReactNode;
}

export interface SynthOptions {
  polyphony?: number;
  sampleRate?: number;
  latency?: number;
  cpuLimit?: number;
}

export interface UseSynthReturn {
  // Core Controls
  triggerNote: (note: number | string, velocity?: number) => void;
  releaseNote: (note: number | string) => void;
  setParam: (path: string, value: number) => void;

  // Modulation
  addModulation: (entry: ModulationEntry) => void;
  clearModulation: (sourceId?: string) => void;

  // Routing
  connect: (from: string, to: string, options?: ConnectionOptions) => void;
  disconnect: (from: string, to?: string) => void;

  // MIDI
  midi: {
    inputs: WebMidi.MIDIInput[];
    outputs: WebMidi.MIDIOutput[];
    setChannel: (ch: number) => void;
  };

  // State
  getState: () => SynthState;
  loadPreset: (preset: UseSynthConfig) => void;

  // UI
  VirtualKeyboard: React.FC<VirtualKeyboardProps>;
  ModulationMatrix: React.FC<ModulationMatrixProps>;
} 