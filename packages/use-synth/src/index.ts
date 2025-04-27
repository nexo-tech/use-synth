/*
 * useSynth.ts
 * A browser-based subtractive synthesizer hook and engine built from the provided specification.
 * Framework-agnostic core (SynthEngine) with a thin React wrapper (useSynth).
 * Single-file TypeScript implementation – drop into any project.
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
  params: Record<string, unknown>; // effect-specific – keep generic
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
  keyboard?: {
    mapping: Record<string, KeyMapping>;
    octave?: number;
    velocity?: number | "dynamic";
  };
  mouse?: { quantize?: boolean; glide?: number };
}

/* OPTIONS */
export interface SynthOptions {
  polyphony?: number; // default 32
  sampleRate?: number; // inferred from AudioContext
  /** Enable verbose debug logging – defaults to false */
  debug?: boolean;
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

const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

function noteToMidi(note: number | string): number {
  if (typeof note === "number") return Math.max(0, Math.min(127, note));
  const match = /^([A-G])(#|b)?(\d)$/.exec(note.toUpperCase());
  if (!match) throw new Error(`Invalid note string: ${note}`);
  let [_, n, accidental, octave] = match;
  let index = NOTE_NAMES.indexOf(
    accidental === "b"
      ? (
          {
            C: "B",
            D: "C#",
            E: "D#",
            F: "E",
            G: "F#",
            A: "G#",
            B: "A#",
          } as Record<string, string>
        )[n]
      : `${n}${accidental ?? ""}`
  );
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
 * 3. Core Synth Engine (framework-agnostic)
 * -------------------------------------------------------------------------*/

class SynthEngine {
  readonly context: AudioContext;
  readonly destination: GainNode;
  readonly config: UseSynthConfig;
  readonly state: SynthState;

  private oscillators = new Map<string, OscillatorConfig>();
  private filters = new Map<string, FilterConfig>();
  private effects = new Map<string, EffectConfig>();
  private lfos = new Map<string, LFOConfig>();
  private envelopes = new Map<string, EnvelopeConfig>();

  private nodes = new Map<string, AudioNode>();
  private modMatrix: ModulationEntry[] = [];

  private polyphony: number;
  private debugEnabled: boolean;

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
    this.debugEnabled = !!config.options?.debug;

    this.log("SynthEngine init", {
      polyphony: this.polyphony,
      sampleRate: this.context.sampleRate,
    });

    this.loadPreset(config);
  }

  // Ensure AudioContext is resumed on user gesture
  private ensureContextResumed(): Promise<void> {
    if (this.context.state === "suspended") {
      return this.context.resume().then(() => {
        this.log("AudioContext resumed");
      });
    }
    return Promise.resolve();
  }

  private log(message: string, ...optional: unknown[]) {
    if (this.debugEnabled) {
      console.debug(`[Synth] ${message}`, ...optional);
    }
  }

  loadPreset(preset: UseSynthConfig) {
    this.log("Loading preset");

    this.config.components = preset.components;
    this.config.routing = preset.routing;
    this.config.modulation = preset.modulation;
    this.config.input = preset.input;

    this.modMatrix = [...preset.modulation];

    this.buildComponents();
    this.buildRouting();
  }

  private buildComponents() {
    this.nodes.forEach((n) => {
      try {
        n.disconnect();
      } catch {}
    });
    this.nodes.clear();

    Object.entries(this.config.components.oscillators).forEach(([id, conf]) => {
      const osc = this.context.createOscillator();
      osc.type = conf.type as OscillatorType;
      osc.frequency.value = conf.frequency ?? 440;
      if (conf.detune) osc.detune.value = conf.detune;
      osc.start();
      this.nodes.set(id, osc);
      this.oscillators.set(id, conf);
    });

    Object.entries(this.config.components.filters).forEach(([id, conf]) => {
      const filt = this.context.createBiquadFilter();
      filt.type = conf.type as BiquadFilterType;
      if (conf.frequency) filt.frequency.value = conf.frequency;
      if (conf.Q) filt.Q.value = conf.Q;
      this.nodes.set(id, filt);
      this.filters.set(id, conf);
    });

    const outGain = this.context.createGain();
    outGain.connect(this.destination);
    this.nodes.set("output", outGain);
  }

  private buildRouting() {
    this.log("(Re)building routing");
    this.nodes.forEach((n) => n.disconnect());
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

  private stealVoice() {
    if (this.state.activeNotes.size < this.polyphony) return;
    const [oldest] =
      [...this.state.activeNotes.entries()].sort(
        (a, b) => a[1].startTime - b[1].startTime
      )[0] ?? [];
    if (oldest != null) this.releaseNote(oldest);
  }
  // --- replace your existing triggerNote() with this:
  triggerNote(note: number | string, velocity = 1) {
    const midi = noteToMidi(note);
    this.ensureContextResumed().then(() => {
      this.stealVoice();
      const time = this.context.currentTime;

      // 1) make a fresh Oscillator for this voice
      const oscConf = Object.values(this.config.components.oscillators)[0];
      const osc = this.context.createOscillator();
      osc.type = oscConf.type as OscillatorType;
      osc.frequency.value = midiToFreq(midi);
      if (oscConf.detune) osc.detune.value = oscConf.detune;

      // 2) make a per-voice gain envelope
      const voiceGain = this.context.createGain();
      voiceGain.gain.setValueAtTime(0, time);
      voiceGain.gain.linearRampToValueAtTime(velocity, time + 0.01);

      // 3) wire it up: osc → gain → master output
      osc.connect(voiceGain).connect(this.destination);

      // 4) start it and save it for release()
      osc.start(time);
      this.state.activeNotes.set(midi, {
        frequency: midiToFreq(midi),
        velocity,
        startTime: time,
        voiceNodes: [osc, voiceGain],
      });

      this.log("triggerNote", { note, midi, velocity });
    });
  }

  // --- and replace your releaseNote() with this:
  releaseNote(note: number | string) {
    const midi = noteToMidi(note);
    const data = this.state.activeNotes.get(midi);
    if (!data) return;

    const time = this.context.currentTime;
    data.voiceNodes.forEach((n) => {
      if (n instanceof OscillatorNode) {
        // schedule it to stop after a short release
        n.stop(time + 0.1);
      }
      if (n instanceof GainNode) {
        n.gain.cancelScheduledValues(time);
        n.gain.linearRampToValueAtTime(0, time + 0.1);
        // disconnect after the tail has died out
        setTimeout(() => n.disconnect(), 200);
      }
    });

    data.endTime = time;
    this.state.activeNotes.delete(midi);
    this.log("releaseNote", { note, midi });
  }

  setParam(path: string, value: number) {
    setByPath(this.config.components, path, value);
    this.state.paramCache.set(path, value);
    this.log("setParam", { path, value });
  }

  addModulation(entry: ModulationEntry) {
    this.modMatrix.push(entry);
    this.log("addModulation", entry);
  }
  clearModulation(sourceId?: string) {
    this.modMatrix = sourceId
      ? this.modMatrix.filter((e) =>
          "id" in e.source ? e.source.id !== sourceId : true
        )
      : [];
    this.log("clearModulation", { sourceId });
  }
  connect(from: string, to: string) {
    this.nodes.get(from)?.connect(this.nodes.get(to)!);
    this.log("connect", { from, to });
  }
  disconnect(from: string, to?: string) {
    const src = this.nodes.get(from);
    if (!src) return;
    to ? src.disconnect(this.nodes.get(to)!) : src.disconnect();
    this.log("disconnect", { from, to });
  }
  getState() {
    return this.state;
  }
  dispose() {
    this.log("dispose");
    this.context.close();
  }
}

/* ---------------------------------------------------------------------------
 * 4. React Hook Wrapper
 * -------------------------------------------------------------------------*/

import { useRef, useEffect, useCallback, useState } from "react";

export function useSynth(config: UseSynthConfig): UseSynthReturn {
  const engineRef = useRef<SynthEngine>();
  const configRef = useRef(config);

  if (!engineRef.current) engineRef.current = new SynthEngine(config);

  useEffect(() => {
    if (configRef.current !== config) {
      configRef.current = config;
      engineRef.current?.loadPreset(config);
    }
  }, [config]);

  const [midiIO, setMidiIO] = useState<{
    inputs: MIDIInput[];
    outputs: MIDIOutput[];
  }>(() => ({ inputs: [], outputs: [] }));

  useEffect(() => {
    if (!navigator.requestMIDIAccess) return;
    navigator
      .requestMIDIAccess()
      .then((access) => {
        const update = () =>
          setMidiIO({
            inputs: Array.from(access.inputs.values()),
            outputs: Array.from(access.outputs.values()),
          });
        access.onstatechange = update;
        update();
      })
      .catch((err) => {
        console.warn("MIDI access failed", err);
      });
  }, []);

  const triggerNote = useCallback(
    (note: number | string, vel?: number) =>
      engineRef.current!.triggerNote(note, vel),
    []
  );
  const releaseNote = useCallback(
    (note: number | string) => engineRef.current!.releaseNote(note),
    []
  );
  const setParam = useCallback(
    (p: string, v: number) => engineRef.current!.setParam(p, v),
    []
  );
  const addModulation = useCallback(
    (e: ModulationEntry) => engineRef.current!.addModulation(e),
    []
  );
  const clearModulation = useCallback(
    (id?: string) => engineRef.current!.clearModulation(id),
    []
  );
  const connect = useCallback(
    (f: string, t: string, o?: ConnectionOptions) =>
      engineRef.current!.connect(f, t),
    []
  );
  const disconnect = useCallback(
    (f: string, t?: string) => engineRef.current!.disconnect(f, t),
    []
  );
  const getState = useCallback(() => engineRef.current!.getState(), []);
  const loadPreset = useCallback(
    (preset: UseSynthConfig) => engineRef.current!.loadPreset(preset),
    []
  );

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
  };
}

/* ---------------------------------------------------------------------------
 * EOF
 * -------------------------------------------------------------------------*/
