'use client';

import React from 'react';
import Osc from './components/Osc';
import Filter from './components/Filter';
import Oscilloscope from './components/Oscilloscope';
import Routing from './components/Routing';

interface EngineNode {
  type: string;
  id: string;
}

interface AudioEngineNode extends EngineNode {
  setOutput(node: EngineNode): void;
  handleInputAudio(audioNode: AudioNode): void;
}

export interface OscillatorConfig {
  type: 'sine' | 'square' | 'sawtooth' | 'triangle';
  frequency?: number;
  detune?: number;
  pitch?: number;
  phase?: number;
  level?: number;
  // unison?: { voices: number; spread: number; detune?: number; stereo?: number };
  unisonVoices?: number;
  unisonSpread?: number;
  unisonDetune?: number;
  unisonStereo?: number;
  customWave?: Float32Array;
  envelope?: string; // ID of the envelope to use
}

class OscillatorEngineNodeInstance {
  private context: AudioContext;
  private config: OscillatorConfig;
  voices: {
    osc: OscillatorNode;
    panner: StereoPannerNode;
    gain: GainNode;
    delay: DelayNode;
    phase: number;
  }[] = [];
  adsrGain: GainNode;
  masterGain: GainNode;
  velocity: number;
  baseFrequency: number;

  constructor(context: AudioContext, config: OscillatorConfig, velocity: number) {
    console.log('[OscInstance] Creating new oscillator instance with config:', config);
    this.context = context;
    this.config = config;
    this.velocity = velocity;
    this.baseFrequency = 0; // Will be set when note is played
    // Create ADSR and master gain nodes
    this.adsrGain = context.createGain();
    this.masterGain = context.createGain();
    this.adsrGain.connect(this.masterGain);

    // Create unison voices if configured
    const voices = config.unisonVoices || 1;
    const spread = config.unisonSpread || 0;
    const detune = config.detune || 0;
    const stereo = config.unisonStereo || 0;
    const phase = config.phase ?? 0;

    console.log(`[OscInstance] Creating ${voices} unison voices`, {
      spread,
      detune,
      stereo,
      phase
    });

    for (let i = 0; i < voices; i++) {
      // Calculate voice position in the spread
      const position = voices == 1 ? 0 : (i / (voices - 1)) * 2 - 1; // -1 to 1
      const voiceDetune = position * spread + detune;
      const pan = position * stereo;

      // Calculate random phase offset for this voice
      const voicePhase = phase !== 0
        ? phase + (Math.random() * 0.1) // Add small random variation to specified phase
        : Math.random() * 2 * Math.PI; // Completely random phase

      // Create voice nodes
      const osc = context.createOscillator();
      const panner = context.createStereoPanner();
      const gain = context.createGain();
      const delay = context.createDelay();

      // Configure voice
      osc.type = config.type;
      osc.detune.value = voiceDetune;

      // Connect with phase delay
      osc.connect(delay);
      delay.delayTime.value = voicePhase / (2 * Math.PI * osc.frequency.value);
      delay.connect(panner);
      panner.pan.value = pan;
      panner.connect(gain);
      gain.connect(this.adsrGain);

      // Store voice with its phase
      this.voices.push({ osc, panner, gain, delay, phase: voicePhase });
    }
  }

  setFrequency(freq: number) {
    console.log(`[OscInstance] Setting frequency to ${freq}Hz for all voices`);
    this.baseFrequency = freq;
    this.updateFrequency();
  }

  updateFrequency() {
    const pitchOffset = this.config.pitch ?? 0;
    const pitchMultiplier = Math.pow(2, pitchOffset / 12);
    const finalFrequency = this.baseFrequency * pitchMultiplier;

    this.voices.forEach(voice => {
      voice.osc.frequency.value = finalFrequency;
      // Update delay time to maintain phase relationship
      voice.delay.delayTime.value = voice.phase / (2 * Math.PI * finalFrequency);
    });
  }

  start() {
    console.log('[OscInstance] Starting all voices');
    this.voices.forEach(voice => {
      voice.osc.start();
    });
  }

  stop() {
    console.log('[OscInstance] Stopping all voices');
    this.voices.forEach(voice => {
      voice.osc.stop();
    });
  }

  disconnect() {
    console.log('[OscInstance] Disconnecting all nodes');
    this.voices.forEach(voice => {
      voice.osc.disconnect();
      voice.delay.disconnect();
      voice.panner.disconnect();
      voice.gain.disconnect();
    });
    this.adsrGain.disconnect();
    this.masterGain.disconnect();
  }

  updateDetune(detune: number) {
    console.log(`[OscInstance] Updating detune to ${detune} cents`);
    this.voices.forEach(voice => {
      // Cancel any scheduled changes
      voice.osc.detune.cancelScheduledValues(this.context.currentTime);
      // Set the new detune value immediately
      voice.osc.detune.value = detune;
    });
  }

  updateLevel(level: number) {
    this.masterGain.gain.value = level * this.velocity / 127;
  }

  updateUnison(unison: OscillatorConfig) {
    console.log('[OscInstance] Updating unison parameters:', unison);

    const currentVoices = this.voices.length;
    const targetVoices = unison.unisonVoices ?? 1;
    const spread = unison.unisonSpread ?? 0;
    const detune = unison.detune ?? 0;
    const stereo = unison.unisonStereo ?? 0;

    // Update spread and stereo for existing voices
    this.voices.forEach((voice, i) => {
      const position = targetVoices == 1 ? 0 : (i / (targetVoices - 1)) * 2 - 1; // -1 to 1
      const voiceDetune = position * spread + detune;
      const pan = position * stereo;

      voice.osc.detune.value = voiceDetune;
      voice.panner.pan.value = pan;
    });

    // Add new voices if needed
    if (targetVoices > currentVoices) {
      for (let i = currentVoices; i < targetVoices; i++) {
        const position = (i / (targetVoices - 1)) * 2 - 1;
        const voiceDetune = position * spread + detune;
        const pan = position * stereo;

        // Create new voice nodes
        const osc = this.context.createOscillator();
        const panner = this.context.createStereoPanner();
        const gain = this.context.createGain();
        const delay = this.context.createDelay();

        // Configure voice
        osc.type = this.config.type;
        osc.detune.value = voiceDetune;
        panner.pan.value = pan;

        // Set frequency to match existing voices
        if (this.voices.length > 0) {
          osc.frequency.value = this.voices[0].osc.frequency.value;
        }

        // Connect nodes
        osc.connect(delay);
        delay.connect(panner);
        panner.connect(gain);
        gain.connect(this.adsrGain);

        // Start the oscillator
        osc.start();

        // Store voice with its phase
        this.voices.push({
          osc,
          panner,
          gain,
          delay,
          phase: Math.random() * 2 * Math.PI
        });
      }
    }
    // Remove voices if needed
    else if (targetVoices < currentVoices) {
      for (let i = currentVoices - 1; i >= targetVoices; i--) {
        const voice = this.voices[i];
        voice.osc.stop();
        voice.osc.disconnect();
        voice.delay.disconnect();
        voice.panner.disconnect();
        voice.gain.disconnect();
        this.voices.pop();
      }
    }
  }

  updateConfig() {
    const newConfig = this.config
    console.log(`[OscInstance] Updating config:`, newConfig);

    if (newConfig.detune !== undefined) {
      this.updateDetune(newConfig.detune);
    }
    if (newConfig.level !== undefined) {
      this.updateLevel(newConfig.level);
    }
    if (newConfig.pitch !== undefined) {
      this.updateFrequency();
    }
    if (newConfig.unisonVoices !== undefined) {
      // Store current frequency before updating unison
      const currentFreq = this.voices[0]?.osc.frequency.value;
      this.updateUnison(newConfig);
      // Restore frequency after unison update
      if (currentFreq) {
        this.setFrequency(currentFreq);
      }
    }
  }
}

function midiToFreq(note: number, tuning = 440): number {
  return tuning * Math.pow(2, (note - 69) / 12);
}

export interface EnvelopeConfig {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  curvature?: number;
}

class ADSREnvelope implements AudioEngineNode {
  static nextID = 0;
  type = 'adsr';
  id: string;
  config: EnvelopeConfig;
  engine: Engine2;
  outputs: AudioEngineNode[] = [];

  setOutput(node: AudioEngineNode) {
    this.outputs.push(node);
  }

  handleInputAudio(_: AudioNode) {
    // no-op
  }

  constructor(engine: Engine2, config: EnvelopeConfig, id?: string) {
    this.id = id || this.type.substring(0, 3) + ADSREnvelope.nextID++;
    this.config = config;
    this.engine = engine;
  }

  handleStartNode(node: GainNode) {
    const now = this.engine.context.currentTime;
    console.log(`[ADSR ${this.id}] Starting envelope at time ${now}`, this.config);

    node.gain.cancelScheduledValues(now);
    node.gain.setValueAtTime(0, now);
    node.gain.linearRampToValueAtTime(1.0, now + this.config.attack);
    node.gain.linearRampToValueAtTime(
      this.config.sustain,
      now + this.config.attack + this.config.decay
    );
  }

  handleStopNode(gainNode: GainNode) {
    const now = this.engine.context.currentTime;
    console.log(`[ADSR ${this.id}] Stopping envelope at time ${now}`, {
      currentGain: gainNode.gain.value,
      releaseTime: this.config.release,
    });

    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(0, now + this.config.release);
  }
}

export interface FilterConfig {
  type: BiquadFilterType;
  frequency?: number;
  Q?: number;
  gain?: number;
  keytrack?: number;
  envAmount?: number;
}

class MasterGain implements AudioEngineNode {
  type = 'master';
  engine: Engine2;
  id: string;
  gain: GainNode;

  setOutput(_: AudioEngineNode) { }

  handleInputAudio(audioNode: AudioNode) {
    this.gain.gain.value = 1;
    audioNode.connect(this.gain);
    this.gain.connect(this.engine.context.destination);
  }

  constructor(engine: Engine2, id?: string) {
    this.engine = engine;
    this.gain = this.engine.context.createGain();
    this.id = id || this.type.substring(0, 3) + MasterGain.nextID++;
  }

  static nextID = 0;
}

class FilterEngineNode implements AudioEngineNode {
  static nextID = 0;
  type = 'filter';
  engine: Engine2;
  id: string;
  config: FilterConfig;
  outputs: AudioEngineNode[] = [];
  filter: BiquadFilterNode;

  setOutput(node: AudioEngineNode) {
    this.outputs.push(node);
  }

  handleInputAudio(audioNode: AudioNode) {
    this.filter.type = this.config.type;
    this.filter.frequency.value = this.config.frequency ?? 1000;
    this.filter.Q.value = this.config.Q ?? 1;
    this.filter.gain.value = this.config.gain ?? 1;
    audioNode.connect(this.filter);
    this.outputs.forEach((node) => node.handleInputAudio(this.filter));
  }

  constructor(engine: Engine2, config: FilterConfig, id?: string) {
    this.engine = engine;
    this.id = id || this.type.substring(0, 3) + FilterEngineNode.nextID++;
    this.config = config;
    this.filter = this.engine.context.createBiquadFilter();
  }

  updateConfig() {
    const newConfig = this.config
    console.log(`[Filter ${this.id}] Updating config:`, newConfig);

    // Update the filter instance directly
    this.filter.type = newConfig.type;
    this.filter.frequency.value = newConfig.frequency ?? 1000;
    this.filter.Q.value = newConfig.Q ?? 1;
    this.filter.gain.value = newConfig.gain ?? 1;
  }
}

class OscillatorEngineNode implements AudioEngineNode {
  type = 'oscillator';
  engine: Engine2;
  id: string;
  envelope: ADSREnvelope | null = null;
  instances: Map<string, OscillatorEngineNodeInstance> = new Map();
  config: OscillatorConfig;
  outputs: AudioEngineNode[] = [];
  private nextInstanceId = 0;

  static nextID = 0;

  setOutput(node: AudioEngineNode) {
    this.outputs.push(node);
  }

  handleInputAudio(_: AudioNode) {
    this.outputs.forEach((node) => {
      this.instances.forEach((inst) => {
        node.handleInputAudio(inst.masterGain);
      });
    });
  }

  constructor(engine: Engine2, config: OscillatorConfig, id?: string) {
    this.engine = engine;
    this.id = id || this.type.substring(0, 3) + OscillatorEngineNode.nextID++;
    this.config = config;
  }

  handleStartNode(note: number, velocity: number): string {
    console.log(`[Osc ${this.id}] Starting note ${note} with velocity ${velocity}`);
    const instanceId = `${this.id}_${this.nextInstanceId++}`;
    const instance = new OscillatorEngineNodeInstance(this.engine.context, this.config, velocity);

    const freq = midiToFreq(note);
    instance.setFrequency(freq);
    console.log(`[Osc ${this.id}] Set frequency to ${freq}Hz for note ${note}`);

    // instance.masterGain.gain.value = velocity / 127;
    instance.updateLevel(this.config.level ?? 1);

    if (this.envelope) {
      console.log(`[Osc ${this.id}] Applying envelope ${this.envelope.id}`);
      this.envelope.handleStartNode(instance.adsrGain);
    }

    instance.start();
    this.instances.set(instanceId, instance);

    // hook this voice into the master output
    this.outputs.forEach((node) => {
      node.handleInputAudio(instance.masterGain);
    });

    return instanceId;
  }

  handleStopNode(instanceId: string) {
    console.log(`[Osc ${this.id}] Stopping instance ${instanceId}`);
    const instance = this.instances.get(instanceId);
    if (!instance) {
      console.log(`[Osc ${this.id}] No instance found for ID ${instanceId}`);
      return;
    }

    const now = this.engine.context.currentTime;
    const releaseTime = this.envelope?.config.release ?? 0;

    if (this.envelope) {
      console.log(`[Osc ${this.id}] Applying envelope release`);
      this.envelope.handleStopNode(instance.adsrGain);
    }

    // Schedule the cleanup after the release time
    const cleanupTime = now + releaseTime + 0.01; // Add small buffer for safety
    instance.adsrGain.gain.setValueAtTime(instance.adsrGain.gain.value, now);
    instance.adsrGain.gain.linearRampToValueAtTime(0, cleanupTime);

    // Schedule the cleanup
    setTimeout(() => {
      if (this.instances.has(instanceId)) { // Double check the instance is still there
        instance.stop();
        instance.disconnect();
        this.instances.delete(instanceId);
      }
    }, (releaseTime + 0.01) * 1000); // Convert to milliseconds
  }

  updateConfig() {
    const newConfig = this.config
    console.log(`[Osc ${this.id}] Updating config1:`, newConfig);

    // Update all active instances
    this.instances.forEach((instance, instanceId) => {
      if (newConfig.detune !== undefined) {
        instance.updateDetune(newConfig.detune);
      }
      if (newConfig.level !== undefined) {
        instance.updateLevel(newConfig.level);
      }
      if (newConfig.pitch !== undefined) {
        instance.updateFrequency();
      }

      if (newConfig.unisonVoices !== undefined) {
        instance.updateUnison(newConfig);
      }
    });
  }
}

export interface RoutingConnection {
  from: string;
  to: string;
  mix?: number;
  gain?: number;
  pan?: number;
}
export interface LFOConfig {
  type: 'sine' | 'square' | 'triangle' | 'samplehold';
  rate: number;
  sync?: boolean;
  shape?: number;
  phase?: number;
  delay?: number;
  fade?: number;
}

export interface EffectConfig {
  type: 'delay' | 'reverb' | 'distortion' | 'chorus';
  params: Record<string, any>;
}

export interface UseSynthConfig {
  polyphony: number; // Maximum number of simultaneous notes
  maxVoices: number; // Maximum number of voices per oscillator
  components: {
    oscillators: Record<string, OscillatorConfig>;
    filters: Record<string, FilterConfig>;
    effects: Record<string, EffectConfig>;
    lfos: Record<string, LFOConfig>;
    envelopes: Record<string, EnvelopeConfig>;
  };
  routing: RoutingConnection[];
}

class Engine2 {
  _context: AudioContext;
  components: Map<string, AudioEngineNode> = new Map();
  private masterGain: MasterGain;
  private isResuming: boolean = false;
  private currentConfig: UseSynthConfig;
  private activeNotes: Map<string, { note: number; oscId: string; instanceId: string }> = new Map();
  private keyToInstanceIds: Map<string, Set<string>> = new Map(); // Maps keyboard key to set of instance IDs

  constructor() {
    this._context = new AudioContext();
    this.masterGain = new MasterGain(this, 'output');
    this.components.set('output', this.masterGain);
    this.currentConfig = {
      ...baseConfig,
      polyphony: 8,
      maxVoices: 5
    };
  }

  get context() {
    return this._context;
  }

  getCurrentConfig(): UseSynthConfig {
    return this.currentConfig;
  }

  async ensureAudioContextActive(): Promise<boolean> {
    if (this._context.state === 'suspended') {
      if (this.isResuming) {
        console.log('[Engine] AudioContext is already resuming, waiting...');
        // Wait for the current resume operation to complete
        while (this._context.state === 'suspended') {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        return true;
      }

      this.isResuming = true;
      try {
        console.log('[Engine] Resuming AudioContext...');
        await this._context.resume();
        console.log('[Engine] AudioContext resumed successfully');
        return true;
      } catch (error) {
        console.error('[Engine] Failed to resume AudioContext:', error);
        return false;
      } finally {
        this.isResuming = false;
      }
    }
    return true;
  }

  async playNote(note = 60, velocity = 127, key: string): Promise<string | null> {
    const isActive = await this.ensureAudioContextActive();
    if (!isActive) {
      console.warn('[Engine] Cannot play note - AudioContext is not active');
      return null;
    }

    // Check polyphony limit
    if (this.activeNotes.size >= this.currentConfig.polyphony) {
      console.warn('[Engine] Polyphony limit reached, note ignored');
      return null;
    }

    console.log('[Engine] Playing note:', { note, velocity, key });
    const instanceIds = new Set<string>();

    // Find all oscillators that should play this note
    this.components.forEach((component) => {
      if (component.type === 'oscillator') {
        const osc = component as OscillatorEngineNode;
        // Check if this oscillator has reached its voice limit
        if (osc.instances.size < this.currentConfig.maxVoices) {
          const instanceId = osc.handleStartNode(note, velocity);
          if (instanceId) {
            this.activeNotes.set(instanceId, { note, oscId: osc.id, instanceId });
            instanceIds.add(instanceId);
          }
        }
      }
    });

    if (instanceIds.size > 0) {
      this.keyToInstanceIds.set(key, instanceIds);
      return Array.from(instanceIds)[0]; // Return first instance ID for backward compatibility
    }

    return null;
  }

  async stopNote(key: string) {
    const isActive = await this.ensureAudioContextActive();
    if (!isActive) {
      console.warn('[Engine] Cannot stop note - AudioContext is not active');
      return;
    }

    const instanceIds = this.keyToInstanceIds.get(key);
    if (!instanceIds) {
      console.warn('[Engine] No instances found for key:', key);
      return;
    }

    console.log('[Engine] Stopping note:', { key, instanceIds: Array.from(instanceIds) });

    // Stop each instance
    instanceIds.forEach(instanceId => {
      const noteInfo = this.activeNotes.get(instanceId);
      if (!noteInfo) {
        console.warn('[Engine] No note info found for instance:', instanceId);
        return;
      }

      const osc = this.components.get(noteInfo.oscId) as OscillatorEngineNode;
      if (osc) {
        osc.handleStopNode(instanceId);
        this.activeNotes.delete(instanceId);
      }
    });

    // Remove the key mapping
    this.keyToInstanceIds.delete(key);
  }

  createFromConfig(config: UseSynthConfig) {
    console.log('[Engine] Creating synth from config:', config);
    this.currentConfig = config;

    // Create oscillators
    for (const id in config.components.oscillators) {
      const oscConfig = config.components.oscillators[id];
      console.log(`[Engine] Creating oscillator ${id}:`, oscConfig);
      const osc = new OscillatorEngineNode(this, oscConfig, id);
      this.components.set(id, osc);
    }

    // Create filters
    for (const id in config.components.filters) {
      const filterConfig = config.components.filters[id];
      console.log(`[Engine] Creating filter ${id}:`, filterConfig);
      const filter = new FilterEngineNode(this, filterConfig, id);
      this.components.set(id, filter);
    }

    // Create envelopes
    for (const id in config.components.envelopes) {
      const envConfig = config.components.envelopes[id];
      console.log(`[Engine] Creating envelope ${id}:`, envConfig);
      const env = new ADSREnvelope(this, envConfig, id);
      this.components.set(id, env);
    }

    // Connect components according to routing
    console.log('[Engine] Connecting components:');
    for (const connection of config.routing) {
      console.log(`[Engine] Connecting ${connection.from} -> ${connection.to}`);
      const fromNode = this.components.get(connection.from);
      const toNode = this.components.get(connection.to);

      if (fromNode && toNode) {
        fromNode.setOutput(toNode);
        console.log(`[Engine] Successfully connected ${connection.from} -> ${connection.to}`);
      } else {
        console.error(`[Engine] Failed to connect ${connection.from} -> ${connection.to}`, {
          fromNode: !!fromNode,
          toNode: !!toNode,
        });
      }
    }

    // wire envelopes to oscillators
    for (const id in config.components.oscillators) {
      const oscConfig = config.components.oscillators[id];
      const osc = this.components.get(id) as OscillatorEngineNode;
      if (oscConfig.envelope) {
        const env = this.components.get(oscConfig.envelope);
        if (env && env.type === 'adsr') {
          osc.envelope = env as ADSREnvelope;
        }
      }
    }
  }
}

const baseConfig: UseSynthConfig = {
  polyphony: 8,
  maxVoices: 5,
  components: {
    oscillators: {
      main: {
        type: 'sawtooth',
        detune: -7,
        level: 0.5,
        unisonVoices: 5,
        unisonSpread: 25,
        unisonStereo: 50,
        envelope: 'amp',
      },
      b: {
        type: 'sawtooth',
        detune: -7,
        level: 0.5,
        pitch: 12,
        unisonVoices: 5,
        unisonSpread: 25,
        unisonStereo: 50,
        envelope: 'amp',
      },
    },
    filters: {
      lpf: {
        type: 'lowpass',
        frequency: 1000,
        Q: 1,
        gain: 1,
        keytrack: 0,
        envAmount: 0,
      },
    },
    effects: {},
    lfos: {
      vibrato: { type: 'sine', rate: 5, sync: false },
    },
    envelopes: {
      amp: { attack: 0.05, decay: 0.2, sustain: 1.0, release: 0.4 },
    },
  },
  routing: [
    { from: 'main', to: 'lpf' },
    { from: 'lpf', to: 'output' },
    { from: 'b', to: 'output' }
  ],
};

export default function OscillatorPage() {
  const synth = React.useRef<Engine2 | null>(null);
  const [currentOctave, setCurrentOctave] = React.useState(4);
  const [, updateUI] = React.useState(0);
  const masterGainRef = React.useRef<GainNode | null>(null);
  const [currentConfig, setCurrentConfig] = React.useState<UseSynthConfig>(baseConfig);

  const activeNotesRef = React.useRef<Set<string>>(new Set());
  const currentOctaveRef = React.useRef(4);
  // Map keyboard keys to MIDI notes
  const keyToNote: Record<string, number> = {
    'a': 60, // C4
    'w': 61, // C#4
    's': 62, // D4
    'e': 63, // D#4
    'd': 64, // E4
    'f': 65, // F4
    't': 66, // F#4
    'g': 67, // G4
    'y': 68, // G#4
    'h': 69, // A4
    'u': 70, // A#4
    'j': 71, // B4
    'k': 72, // C5
  };

  // Handle octave changes
  const handleOctaveChange = (delta: number) => {
    const newOctave = Math.max(0, Math.min(8, currentOctaveRef.current + delta));
    currentOctaveRef.current = newOctave;
    setCurrentOctave(newOctave);
  };

  // Handle note playing
  const handleKeyDown = async (e: KeyboardEvent) => {
    if (!synth.current) return;

    const key = e.key.toLowerCase();

    // Handle octave changes
    if (key === 'z') {
      handleOctaveChange(-1);
      return;
    }
    if (key === 'x') {
      handleOctaveChange(1);
      return;
    }

    // Handle note playing
    const baseNote = keyToNote[key];
    if (baseNote !== undefined && !activeNotesRef.current.has(key)) {
      const note = baseNote + (currentOctaveRef.current - 4) * 12;
      activeNotesRef.current.add(key);
      await synth.current?.playNote(note, 127, key);
    }
  };

  const handleKeyUp = async (e: KeyboardEvent) => {
    if (!synth.current) return;

    const key = e.key.toLowerCase();
    if (activeNotesRef.current.has(key)) {
      activeNotesRef.current.delete(key);
      await synth.current?.stopNote(key);
    }
  };

  React.useEffect(() => {
    // Initialize synth on component mount
    const newSynth = new Engine2();
    synth.current = newSynth;
    newSynth.createFromConfig(baseConfig);

    // Get the master gain node for the oscilloscope
    const master = newSynth.components.get('output') as MasterGain;
    if (master) {
      masterGainRef.current = master.gain;
    }

    updateUI(x => x + 1);

    // Add keyboard event listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      // Cleanup on unmount
      if (newSynth.context.state !== 'closed') {
        newSynth.context.close();
      }
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []); // Empty dependency array since we're using refs

  const handleOscConfigChange = (oscId: string, newConfig: Partial<OscillatorConfig>) => {
    if (!synth.current) return;

    const conf = synth.current.getCurrentConfig()
    // Update the config in place
    const oscConfig = conf.components.oscillators[oscId];
    for (let key in newConfig) {
      (oscConfig as any)[key] = (newConfig as any)[key];
    }
    // Update the oscillator instance directly
    const oscNode = synth.current?.components.get(oscId) as OscillatorEngineNode;
    if (oscNode) {
      oscNode.updateConfig();
      updateUI(x => x + 1)
    }
  };

  const handleFilterConfigChange = (filterId: string, newConfig: Partial<FilterConfig>) => {
    if (!synth.current) return;

    const conf = synth.current.getCurrentConfig()
    // Update the config in place
    const filterConfig = conf.components.filters[filterId];
    for (let key in newConfig) {
      (filterConfig as any)[key] = (newConfig as any)[key];
    }
    // Update the filter instance directly
    const filterNode = synth.current?.components.get(filterId) as FilterEngineNode;
    if (filterNode) {
      filterNode.updateConfig();
      updateUI(x => x + 1)
    }
  };

  const handleConfigChange = (newConfig: UseSynthConfig) => {
    setCurrentConfig(newConfig);
    if (synth.current) {
      synth.current.createFromConfig(newConfig);
      updateUI(x => x + 1);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-950 text-white">
      <div className="flex flex-col gap-4">
        {currentConfig?.components.oscillators && Object.entries(currentConfig.components.oscillators).map(([id, config]) => (
          <div key={id} className="flex flex-col items-center">
            <h3 className="text-sm font-quantico mb-2 text-gray-400">Oscillator {id}</h3>
            <Osc
              config={config}
              onConfigChange={(newConfig) => handleOscConfigChange(id, newConfig)}
            />
          </div>
        ))}

        {currentConfig?.components.filters && Object.entries(currentConfig.components.filters).map(([id, config]) => (
          <div key={id} className="flex flex-col items-center">
            <h3 className="text-sm font-quantico mb-2 text-gray-400">Filter {id}</h3>
            <Filter
              config={config}
              onConfigChange={(newConfig) => handleFilterConfigChange(id, newConfig)}
            />
          </div>
        ))}

        {masterGainRef.current && (
          <div className="mt-4">
            <Oscilloscope
              audioNode={masterGainRef.current}
              width={400}
              height={100}
              backgroundColor="#1a1a1a"
              lineColor="#00ff00"
            />
          </div>
        )}
      </div>

      <div className="mt-8 w-full max-w-4xl">
        <Routing config={currentConfig} onConfigChange={handleConfigChange} />
      </div>

      <div className="mt-8 flex flex-col items-center gap-4">
        <div className="text-sm font-quantico text-gray-400">
          Current Octave: {currentOctave}
        </div>
        <div className="text-sm font-quantico text-gray-400">
          Keyboard Controls:
          <br />
          Z/X: Octave Down/Up
          <br />
          A-K: Play Notes (W/E/T/Y/U for black keys)
        </div>
      </div>
    </main>
  );
}