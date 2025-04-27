/*
 * useSynth.ts
 * A browser‑based subtractive synthesizer hook and engine built from the provided specification.
 * Framework‑agnostic core (SynthEngine) with a thin React wrapper (useSynth).
 * Single‑file TypeScript implementation – drop into any project.
 */

/* ---------------------------------------------------------------------------
 * 1. Type Declarations (mirrored from spec – trimmed where obvious)
 * -------------------------------------------------------------------------*/

export type ComponentType =
  | "oscillator"
  | "filter"
  | "effect"
  | "lfo"
  | "envelope";

/* OSCILLATORS */
export interface OscillatorConfig {
  type: "sine" | "square" | "sawtooth" | "triangle" | "noise" | "custom";
  frequency?: number;
  detune?: number;
  phase?: number;
  level?: number;
  unison?: { voices: number; spread: number; stereo?: number };
  customWave?: Float32Array;
}

/* FILTERS */
export interface FilterConfig {
  type: BiquadFilterType | "moogladder";
  frequency?: number;
  Q?: number;
  gain?: number;
  keytrack?: number;
  envAmount?: number;
}

/* EFFECTS */
export interface EffectConfig {
  type: "delay" | "reverb" | "distortion" | "chorus";
  params: Record<string, unknown>; // effect‑specific – keep generic
}

/* LFOS */
export interface LFOConfig {
  type: "sine" | "square" | "triangle" | "samplehold";
  rate: number;
  sync?: boolean;
  shape?: number;
  phase?: number;
  delay?: number;
  fade?: number;
}

/* ENVELOPES */
export interface EnvelopeConfig {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  curvature?: number;
}

/* ROUTING */
export interface RoutingConnection {
  from: string;
  to: string;
  mix?: number;
  gain?: number;
  pan?: number;
}

/* MODULATION */
export type ModulationSource =
  | { type: "envelope"; id: string }
  | { type: "lfo"; id: string }
  | { type: "velocity" }
  | { type: "pitchbend" }
  | { type: "aftertouch" }
  | { type: "midicc"; number: number };

export interface ModulationTarget {
  path: string;
  min?: number;
  max?: number;
  bipolar?: boolean;
}

export interface ModulationEntry {
  source: ModulationSource;
  target: ModulationTarget;
  amount: number;
  via?: string;
}

/* INPUT */
export interface KeyMapping {
  note: number;
  channel?: number;
  bendRange?: number;
}

export interface InputConfig {
  midi?: { channel?: number; throttle?: number };
  keyboard?: { mapping: Record<string, KeyMapping>; octave?: number; velocity?: number | "dynamic" };
  mouse?: { quantize?: boolean; glide?: number };
}

/* OPTIONS */
export interface SynthOptions {
  polyphony?: number; // default 32
  sampleRate?: number; // inferred from AudioContext
}

/* COMPLETE CONFIG */
export interface UseSynthConfig {
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
}

/* STATE & ENGINE TYPES */
export interface ConnectionOptions {
  gain?: number;
  pan?: number;
  type?: "audio" | "control";
}

export interface NoteData {
  frequency: number;
  velocity: number;
  startTime: number;
  endTime?: number;
  voiceNodes: AudioNode[];
}

export interface SynthState {
  activeNotes: Map<number, NoteData>;
  paramCache: Map<string, number>;
  cpuUsage: number;
}

export interface UseSynthReturn {
  triggerNote: (note: number | string, velocity?: number) => void;
  releaseNote: (note: number | string) => void;
  setParam: (path: string, value: number) => void;
  addModulation: (entry: ModulationEntry) => void;
  clearModulation: (sourceId?: string) => void;
  connect: (from: string, to: string, options?: ConnectionOptions) => void;
  disconnect: (from: string, to?: string) => void;
  midi: {
    inputs: MIDIInput[];
    outputs: MIDIOutput[];
    setChannel: (ch: number) => void;
  };
  getState: () => SynthState;
  loadPreset: (preset: UseSynthConfig) => void;
}

/* ---------------------------------------------------------------------------
 * 2. Utility Helpers
 * -------------------------------------------------------------------------*/

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function noteToMidi(note: number | string): number {
  if (typeof note === "number") return Math.max(0, Math.min(127, note));
  const match = /^([A-G])(#|b)?(\d)$/.exec(note.toUpperCase());
  if (!match) throw new Error(`Invalid note string: ${note}`);
  let [_, n, accidental, octave] = match;
  let index = NOTE_NAMES.indexOf(accidental === "b" ?
    ({ C: "B", D: "C#", E: "D#", F: "E", G: "F#", A: "G#", B: "A#" } as Record<string, string>)[n] : `${n}${accidental ?? ""}`);
  return index + 12 * (parseInt(octave) + 1);
}

function midiToFreq(note: number, tuning: number = 440): number {
  return tuning * Math.pow(2, (note - 69) / 12);
}

function getByPath(obj: any, path: string): any {
  return path.split(".").reduce((o, k) => (o ? o[k] : undefined), obj);
}
function setByPath(obj: any, path: string, value: any): void {
  const parts = path.split(".");
  const last = parts.pop()!;
  const target = parts.reduce((o, k) => (o[k] ??= {}), obj);
  target[last] = value;
}

/* ---------------------------------------------------------------------------
 * 3. Core Synth Engine (framework‑agnostic)
 * -------------------------------------------------------------------------*/

class SynthEngine {
  readonly context: AudioContext;
  readonly destination: GainNode;
  readonly config: UseSynthConfig;
  readonly state: SynthState;

  /* Internal maps */
  private oscillators = new Map<string, OscillatorConfig>();
  private filters = new Map<string, FilterConfig>();
  private effects = new Map<string, EffectConfig>();
  private lfos = new Map<string, LFOConfig>();
  private envelopes = new Map<string, EnvelopeConfig>();

  private nodes = new Map<string, AudioNode>();
  private modMatrix: ModulationEntry[] = [];

  private polyphony: number;

  constructor(config: UseSynthConfig, ctx?: AudioContext) {
    this.context = ctx ?? new AudioContext();
    this.destination = this.context.createGain();
    this.destination.connect(this.context.destination);

    this.state = {
      activeNotes: new Map(),
      paramCache: new Map(),
      cpuUsage: 0,
    };

    this.config = config;
    this.polyphony = config.options?.polyphony ?? 32;

    this.loadPreset(config);
  }

  loadPreset(preset: UseSynthConfig) {
    this.config.components = preset.components;
    this.config.routing = preset.routing;
    this.config.modulation = preset.modulation;
    this.config.input = preset.input;

    this.modMatrix = [...preset.modulation];

    /* Build components – simple nodes for now */
    this.buildComponents();
    this.buildRouting();
  }

  /* Component construction (very lightweight – real DSP left for worklets) */
  private buildComponents() {
    const { components } = this.config;

    // Oscillators
    Object.entries(components.oscillators).forEach(([id, conf]) => {
      const osc = this.context.createOscillator();
      osc.type = conf.type as OscillatorType;
      osc.frequency.value = conf.frequency ?? 440;
      if (conf.detune) osc.detune.value = conf.detune;
      osc.start();
      this.nodes.set(id, osc);
      this.oscillators.set(id, conf);
    });

    // Filters
    Object.entries(components.filters).forEach(([id, conf]) => {
      const filt = this.context.createBiquadFilter();
      filt.type = conf.type as BiquadFilterType;
      if (conf.frequency) filt.frequency.value = conf.frequency;
      if (conf.Q) filt.Q.value = conf.Q;
      this.nodes.set(id, filt);
      this.filters.set(id, conf);
    });

    // Simple mono output node for effects chain root
    const outGain = this.context.createGain();
    outGain.connect(this.destination);
    this.nodes.set("output", outGain);
  }

  private buildRouting() {
    // Reset existing connections first
    this.nodes.forEach((node) => node.disconnect());

    // Re‑connect according to routing rules
    this.config.routing.forEach(({ from, to, gain }) => {
      const src = this.nodes.get(from);
      const dst = this.nodes.get(to);
      if (!src || !dst) return;
      if (gain != null) {
        const g = this.context.createGain();
        g.gain.value = Math.pow(10, (gain ?? 0) / 20);
        src.connect(g).connect(dst);
      } else {
        src.connect(dst);
      }
    });
  }

  /* --- Performance helpers --- */
  private stealVoice(): void {
    if (this.state.activeNotes.size < this.polyphony) return;
    // naive: stop the earliest note
    const [oldest] = [...this.state.activeNotes.entries()].sort((a, b) => a[1].startTime - b[1].startTime)[0] ?? [];
    if (oldest != null) this.releaseNote(oldest);
  }

  /* --- Public API methods --- */
  triggerNote(note: number | string, velocity: number = 1) {
    const midi = noteToMidi(note);
    const time = this.context.currentTime;
    this.stealVoice();

    // simple 1‑to‑1 voice map – connect osc nodes through output gain envelope
    const voiceGain = this.context.createGain();
    voiceGain.gain.setValueAtTime(0, time);
    voiceGain.gain.linearRampToValueAtTime(velocity, time + 0.01);
    voiceGain.connect(this.nodes.get("output")!);

    // Connect all oscillators to voiceGain
    this.config.routing
      .filter((r) => r.to === "output")
      .forEach((r) => {
        const osc = this.nodes.get(r.from);
        osc?.connect(voiceGain);
      });

    this.state.activeNotes.set(midi, {
      frequency: midiToFreq(midi),
      velocity,
      startTime: time,
      voiceNodes: [voiceGain],
    });
  }

  releaseNote(note: number | string) {
    const midi = noteToMidi(note);
    const data = this.state.activeNotes.get(midi);
    if (!data) return;
    const time = this.context.currentTime;
    data.voiceNodes.forEach((n) => {
      if (n instanceof GainNode) {
        n.gain.cancelScheduledValues(time);
        n.gain.linearRampToValueAtTime(0, time + 0.1);
        setTimeout(() => n.disconnect(), 200);
      }
    });
    data.endTime = time;
    this.state.activeNotes.delete(midi);
  }

  setParam(path: string, value: number) {
    setByPath(this.config.components, path, value);
    this.state.paramCache.set(path, value);
    // For brevity we skip live automation of nodes
  }

  addModulation(entry: ModulationEntry) {
    this.modMatrix.push(entry);
  }
  clearModulation(sourceId?: string) {
    if (!sourceId) this.modMatrix = [];
    else this.modMatrix = this.modMatrix.filter((e) => {
      const s = e.source;
      return "id" in s ? s.id !== sourceId : true;
    });
  }

  connect(from: string, to: string, options?: ConnectionOptions) {
    const src = this.nodes.get(from);
    const dst = this.nodes.get(to);
    src?.connect(dst!);
  }
  disconnect(from: string, to?: string) {
    const src = this.nodes.get(from);
    if (!src) return;
    to ? src.disconnect(this.nodes.get(to)!) : src.disconnect();
  }

  getState() {
    return this.state;
  }

  dispose() {
    this.context.close();
  }
}

import React from "react";
/* ---------------------------------------------------------------------------
 * 4. React Hook Wrapper
 * -------------------------------------------------------------------------*/

import { useRef, useEffect, useCallback } from "react";

export function useSynth(config: UseSynthConfig): UseSynthReturn {
  const engineRef = useRef<SynthEngine>();
  const configRef = useRef(config);

  if (!engineRef.current) {
    engineRef.current = new SynthEngine(config);
  }

  /* Keep engine in sync when config object changes */
  useEffect(() => {
    if (configRef.current !== config) {
      configRef.current = config;
      engineRef.current?.loadPreset(config);
    }
  }, [config]);

  /* MIDI hot‑plug (simple – full 2.0 impl omitted) */
  const [midiIO, setMidiIO] = ((): [{ inputs: MIDIInput[]; outputs: MIDIOutput[] }, React.Dispatch<any>] => {
    // eslint‑disable‑next‑line react-hooks/rules-of-hooks
    return React.useState({ inputs: [], outputs: [] });
  })();

  useEffect(() => {
    if (!navigator.requestMIDIAccess) return;
    navigator.requestMIDIAccess().then((access) => {
      const update = () => {
        setMidiIO({
          inputs: Array.from(access.inputs.values()),
          outputs: Array.from(access.outputs.values()),
        });
      };
      access.onstatechange = update;
      update();
    });
  }, []);

  /* Public wrapper methods */
  const triggerNote = useCallback<UseSynthReturn["triggerNote"]>((note, vel) => {
    engineRef.current!.triggerNote(note, vel);
  }, []);

  const releaseNote = useCallback<UseSynthReturn["releaseNote"]>((note) => {
    engineRef.current!.releaseNote(note);
  }, []);

  const setParam = useCallback<UseSynthReturn["setParam"]>((p, v) => {
    engineRef.current!.setParam(p, v);
  }, []);

  const addModulation = useCallback<UseSynthReturn["addModulation"]>((e) => {
    engineRef.current!.addModulation(e);
  }, []);

  const clearModulation = useCallback<UseSynthReturn["clearModulation"]>((id) => {
    engineRef.current!.clearModulation(id);
  }, []);

  const connect = useCallback<UseSynthReturn["connect"]>((f, t, o) => {
    engineRef.current!.connect(f, t, o);
  }, []);

  const disconnect = useCallback<UseSynthReturn["disconnect"]>((f, t) => {
    engineRef.current!.disconnect(f, t);
  }, []);

  const getState = useCallback(() => engineRef.current!.getState(), []);

  const loadPreset = useCallback((preset: UseSynthConfig) => engineRef.current!.loadPreset(preset), []);

  /* Cleanup on unmount */
  useEffect(() => () => engineRef.current?.dispose(), []);

  return {
    triggerNote,
    releaseNote,
    setParam,
    addModulation,
    clearModulation,
    connect,
    disconnect,
    midi: {
      ...midiIO,
      setChannel: (ch: number) => {
        config.input.midi = { ...(config.input.midi ?? {}), channel: ch };
      },
    },
    getState,
    loadPreset,
  } as UseSynthReturn;
}

/* ---------------------------------------------------------------------------
 * EOF
 * -------------------------------------------------------------------------*/
