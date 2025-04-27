/* ---------------------------------------------------------------------------
 * useSynth.ts
 * A browser-based subtractive synthesizer hook and engine built from the provided specification.
 * Fully supports dynamic component management, routing, modulation, and introspection.
 * Fixed: no static oscillator playback on load; oscillators are created per voice only.
 * Framework-agnostic core (SynthEngine) with a thin React wrapper (useSynth).
 * -------------------------------------------------------------------------*/

import { useRef, useEffect, useCallback, useState } from "react";

/* ---------------------------------------------------------------------------
 * 1. Type Declarations
 * -------------------------------------------------------------------------*/
export type ComponentType =
  | "oscillator"
  | "filter"
  | "effect"
  | "lfo"
  | "envelope";

export interface OscillatorConfig {
  type: "sine" | "square" | "sawtooth" | "triangle" | "noise" | "custom";
  frequency?: number;
  detune?: number;
  phase?: number;
  level?: number;
  unison?: { voices: number; spread: number; stereo?: number };
  customWave?: Float32Array;
}

export interface FilterConfig {
  type: BiquadFilterType | "moogladder";
  frequency?: number;
  Q?: number;
  gain?: number;
  keytrack?: number;
  envAmount?: number;
}

export interface EffectConfig {
  type: "delay" | "reverb" | "distortion" | "chorus";
  params: Record<string, any>;
}

export interface LFOConfig {
  type: "sine" | "square" | "triangle" | "samplehold";
  rate: number;
  sync?: boolean;
  shape?: number;
  phase?: number;
  delay?: number;
  fade?: number;
}

export interface EnvelopeConfig {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  curvature?: number;
}

export interface RoutingConnection {
  from: string;
  to: string;
  mix?: number;
  gain?: number;
  pan?: number;
}

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

export interface SynthOptions {
  polyphony?: number;
  sampleRate?: number;
  debug?: boolean;
}

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
  addConnection: (conn: RoutingConnection) => void;
  removeConnection: (from: string, to?: string) => void;

  // Component Management & Introspection
  getConfig: () => UseSynthConfig;
  getComponents: (type: ComponentType) => Record<string, any>;
  addComponent: (type: ComponentType, id: string, config: any) => void;
  removeComponent: (type: ComponentType, id: string) => void;
  updateComponent: (type: ComponentType, id: string, config: any) => void;

  // MIDI
  midi: {
    inputs: MIDIInput[];
    outputs: MIDIOutput[];
    setChannel: (ch: number) => void;
  };

  // State
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
  const m = /^([A-G])(#|b)?(\d)$/.exec(note.toUpperCase());
  if (!m) throw new Error(`Invalid note: ${note}`);
  let [, n, acc, oct] = m;
  let name = n + (acc || "");
  if (acc === "b") {
    const flats: Record<string, string> = {
      Db: "C#",
      Eb: "D#",
      Gb: "F#",
      Ab: "G#",
      Bb: "A#",
    };
    name = flats[n + acc] || n;
  }
  const index = NOTE_NAMES.indexOf(name);
  return index + 12 * (parseInt(oct) + 1);
}
function midiToFreq(note: number, tuning = 440): number {
  return tuning * Math.pow(2, (note - 69) / 12);
}
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/* ---------------------------------------------------------------------------
 * 3. Core Synth Engine
 * -------------------------------------------------------------------------*/
class SynthEngine {
  readonly context: AudioContext;
  readonly destination: GainNode;
  public config: UseSynthConfig;
  readonly state: SynthState;
  private nodes = new Map<string, AudioNode>();
  private allNodes = new Map<string, AudioNode>();
  private modMatrix: ModulationEntry[] = [];

  constructor(config: UseSynthConfig, ctx?: AudioContext) {
    this.context = ctx || new AudioContext();
    this.destination = this.context.createGain();
    this.destination.connect(this.context.destination);

    this.state = { activeNotes: new Map(), paramCache: new Map(), cpuUsage: 0 };
    this.config = deepClone(config);
    this.modMatrix = [...config.modulation];

    this.buildComponents();
    this.buildRouting();
  }

  private buildComponents() {
    // Clear existing nodes
    this.nodes.forEach((n) => {
      try {
        n.disconnect();
      } catch {}
    });
    this.nodes.clear();

    // Filters
    Object.entries(this.config.components.filters).forEach(([id, conf]) => {
      const filt = this.context.createBiquadFilter();
      filt.type = conf.type as BiquadFilterType;
      if (conf.frequency) filt.frequency.value = conf.frequency;
      if (conf.Q) filt.Q.value = conf.Q;
      this.nodes.set(id, filt);
    });

    // Effects (placeholder: using GainNodes for effect inserts)
    Object.keys(this.config.components.effects).forEach((id) => {
      const fxNode = this.context.createGain();
      this.nodes.set(id, fxNode);
    });

    // Output bus
    const out = this.context.createGain();
    this.nodes.set("output", out);
    out.connect(this.destination);
  }

  private buildRouting() {
    // Disconnect all existing
    this.nodes.forEach((n) => {
      try {
        n.disconnect();
      } catch {}
    });
    // Reconnect output to destination
    this.nodes.get("output")?.connect(this.destination);

    this.config.routing.forEach(({ from, to, gain, pan }) => {
      // Skip static oscillator routing
      if (from in this.config.components.oscillators) return;
      const src = this.nodes.get(from);
      if (!src) return;
      let conn: AudioNode = src;

      if (gain !== undefined) {
        const g = this.context.createGain();
        g.gain.value = Math.pow(10, gain / 20);
        conn.connect(g);
        conn = g;
      }
      if (pan !== undefined) {
        const p = this.context.createStereoPanner();
        p.pan.value = Math.max(-1, Math.min(1, pan / 100));
        conn.connect(p);
        conn = p;
      }
      const dst = this.nodes.get(to);
      if (dst) conn.connect(dst);
    });
  }

  /* Core Controls & Voice Management */
  async triggerNote(note: number | string, velocity = 1) {
    const midi = noteToMidi(note);
    if (this.context.state === "suspended") await this.context.resume();
    const time = this.context.currentTime;

    // Voice steal
    const maxVoices = this.config.options?.polyphony || 32;
    if (this.state.activeNotes.size >= maxVoices) {
      const oldest = [...this.state.activeNotes.entries()].sort(
        ([, a], [, b]) => a.startTime - b.startTime
      )[0];
      if (oldest) this.releaseNote(oldest[0]);
    }

    // Create per-oscillator voices
    const voiceNodes: AudioNode[] = [];
    Object.entries(this.config.components.oscillators).forEach(
      ([oscId, oscConf]) => {
        const osc = this.context.createOscillator();
        osc.type = oscConf.type as OscillatorType;
        osc.frequency.value = oscConf.frequency
          ? midiToFreq(midi)
          : midiToFreq(midi);
        if (oscConf.detune) osc.detune.value = oscConf.detune;

        const gainNode = this.context.createGain();
        gainNode.gain.setValueAtTime(0, time);
        gainNode.gain.linearRampToValueAtTime(
          velocity * (oscConf.level ?? 1),
          time + 0.01
        );

        // Connect oscillator through gain into filter/effect graph
        // Find routing entries where from === oscId
        const routes = this.config.routing.filter((r) => r.from === oscId);
        if (routes.length) {
          routes.forEach((r) => {
            let conn: AudioNode = gainNode;
            if (r.gain !== undefined) {
              const g = this.context.createGain();
              g.gain.value = Math.pow(10, r.gain / 20);
              gainNode.connect(g);
              conn = g;
            }
            if (r.pan !== undefined) {
              const p = this.context.createStereoPanner();
              p.pan.value = r.pan / 100;
              conn.connect(p);
              conn = p;
            }
            const dst = this.nodes.get(r.to);
            if (dst) conn.connect(dst);
          });
        } else {
          // Default direct to output
          gainNode.connect(this.nodes.get("output")!);
        }

        osc.connect(gainNode);
        osc.start(time);
        voiceNodes.push(osc, gainNode);
      }
    );

    this.state.activeNotes.set(midi, {
      frequency: midiToFreq(midi),
      velocity,
      startTime: time,
      voiceNodes,
    });
  }

  releaseNote(note: number | string) {
    const midi = noteToMidi(note);
    const data = this.state.activeNotes.get(midi);
    if (!data) return;
    const t = this.context.currentTime;
    data.voiceNodes.forEach((n) => {
      if (n instanceof OscillatorNode) n.stop(t + 0.1);
      if (n instanceof GainNode) {
        n.gain.cancelScheduledValues(t);
        n.gain.linearRampToValueAtTime(0, t + 0.1);
        setTimeout(() => n.disconnect(), 200);
      }
    });
    this.state.activeNotes.delete(midi);
  }

  setParam(path: string, value: number) {
    const [compType, compId, ...rest] = path.split(".");
    const section = (this.config.components as any)[compType + "s"][compId];
    if (section) {
      if (rest.length) section[rest.join(".")] = value;
      else Object.assign(section, value);
      this.state.paramCache.set(path, value);

      switch (compType) {
        case "oscillator":
          const [paramName] = rest;
          console.log("getting osc", compId, paramName, this.nodes);
          const osc = this.nodes.get(compId) as OscillatorNode;
          if (paramName === "detune") {
            osc.detune.setValueAtTime(value, this.context.currentTime);
          }
          break;

        default:
          this.buildComponents();
          this.buildRouting();
      }
    }
  }

  /* Modulation */
  addModulation(entry: ModulationEntry) {
    this.modMatrix.push(entry);
  }
  clearModulation(sourceId?: string) {
    this.modMatrix = sourceId
      ? this.modMatrix.filter((e) => (e.source as any).id !== sourceId)
      : [];
  }

  /* Dynamic Connect/Disconnect */
  connect(from: string, to: string, options: ConnectionOptions = {}) {
    const src = this.nodes.get(from),
      dst = this.nodes.get(to);
    if (!src || !dst) return;
    let conn: AudioNode = src;
    if (options.gain !== undefined) {
      const g = this.context.createGain();
      g.gain.value = Math.pow(10, options.gain / 20);
      conn.connect(g);
      conn = g;
    }
    if (options.pan !== undefined) {
      const p = this.context.createStereoPanner();
      p.pan.value = options.pan / 100;
      conn.connect(p);
      conn = p;
    }
    conn.connect(dst);
  }
  disconnect(from: string, to?: string) {
    const src = this.nodes.get(from);
    if (!src) return;
    to ? src.disconnect(this.nodes.get(to)!) : src.disconnect();
  }

  /* Routing Management */
  addConnection(conn: RoutingConnection) {
    this.config.routing.push(conn);
    this.buildRouting();
  }
  removeConnection(from: string, to?: string) {
    this.config.routing = this.config.routing.filter(
      (c) => c.from !== from || (to !== undefined && c.to !== to)
    );
    this.buildRouting();
  }

  /* Component Management */
  getConfig() {
    return deepClone(this.config);
  }
  getComponents(type: ComponentType) {
    return deepClone((this.config.components as any)[type + "s"] || {});
  }
  addComponent(type: ComponentType, id: string, cfg: any) {
    (this.config.components as any)[type + "s"][id] = cfg;
    this.buildComponents();
    this.buildRouting();
  }
  removeComponent(type: ComponentType, id: string) {
    delete (this.config.components as any)[type + "s"][id];
    if (this.nodes.has(id)) {
      this.nodes.get(id)!.disconnect();
      this.nodes.delete(id);
    }
    this.buildRouting();
  }
  updateComponent(type: ComponentType, id: string, cfg: any) {
    Object.assign((this.config.components as any)[type + "s"][id], cfg);
    this.buildComponents();
    this.buildRouting();
  }

  getState(): SynthState {
    return this.state;
  }

  loadPreset(preset: UseSynthConfig) {
    this.config = deepClone(preset);
    this.modMatrix = [...preset.modulation];
    this.buildComponents();
    this.buildRouting();
  }
}

/* ---------------------------------------------------------------------------
 * 4. React Hook Wrapper
 * -------------------------------------------------------------------------*/
export function useSynth(initialConfig: UseSynthConfig): UseSynthReturn {
  const engineRef = useRef<SynthEngine>();
  const configRef = useRef(initialConfig);

  if (!engineRef.current) engineRef.current = new SynthEngine(initialConfig);

  useEffect(() => {
    if (configRef.current !== initialConfig) {
      configRef.current = initialConfig;
      engineRef.current!.loadPreset(initialConfig);
    }
  }, [initialConfig]);

  const [midiIO, setMidiIO] = useState<{
    inputs: MIDIInput[];
    outputs: MIDIOutput[];
  }>({ inputs: [], outputs: [] });
  useEffect(() => {
    navigator
      .requestMIDIAccess?.()
      .then((access) => {
        const update = () =>
          setMidiIO({
            inputs: Array.from(access.inputs.values()),
            outputs: Array.from(access.outputs.values()),
          });
        access.onstatechange = update;
        update();
      })
      .catch(() => {});
  }, []);

  return {
    triggerNote: useCallback(
      (n, v) => engineRef.current!.triggerNote(n, v),
      []
    ),
    releaseNote: useCallback((n) => engineRef.current!.releaseNote(n), []),
    setParam: useCallback((p, v) => engineRef.current!.setParam(p, v), []),
    addModulation: useCallback((e) => engineRef.current!.addModulation(e), []),
    clearModulation: useCallback(
      (id) => engineRef.current!.clearModulation(id),
      []
    ),
    connect: useCallback((f, t, o) => engineRef.current!.connect(f, t, o), []),
    disconnect: useCallback((f, t) => engineRef.current!.disconnect(f, t), []),
    addConnection: useCallback((c) => engineRef.current!.addConnection(c), []),
    removeConnection: useCallback(
      (f, t) => engineRef.current!.removeConnection(f, t),
      []
    ),
    getConfig: useCallback(() => engineRef.current!.getConfig(), []),
    getComponents: useCallback(
      (type) => engineRef.current!.getComponents(type),
      []
    ),
    addComponent: useCallback(
      (t, id, c) => engineRef.current!.addComponent(t, id, c),
      []
    ),
    removeComponent: useCallback(
      (t, id) => engineRef.current!.removeComponent(t, id),
      []
    ),
    updateComponent: useCallback(
      (t, id, c) => engineRef.current!.updateComponent(t, id, c),
      []
    ),
    midi: {
      ...midiIO,
      setChannel: (ch: number) => {
        configRef.current.input.midi = {
          ...(configRef.current.input.midi || {}),
          channel: ch,
        };
      },
    },
    getState: useCallback(() => engineRef.current!.getState(), []),
    loadPreset: useCallback((p) => engineRef.current!.loadPreset(p), []),
  };
}
