'use client';

import React, { useState } from 'react';
import Osc from '../components/Osc';


interface EngineNode {
    type: string;
    id: string;
}

interface AudioEngineNode extends EngineNode {
    setOutput(node: EngineNode): void;
    handleInputAudio(audioNode: AudioNode): void;
}

export interface OscillatorConfig {
    type: "sine" | "square" | "sawtooth" | "triangle"
    frequency?: number;
    detune?: number;
    phase?: number;
    level?: number;
    unison?: { voices: number; spread: number; stereo?: number };
    customWave?: Float32Array;
    envelope?: string;  // ID of the envelope to use
}

class OscillatorEngineNodeInstance {
    osc: OscillatorNode;
    adsrGain: GainNode;
    masterGain: GainNode;
    isOscStartedPlaying: boolean = false;

    constructor(context: AudioContext) {
        console.log('[OscInstance] Creating new oscillator instance');
        this.osc = context.createOscillator();
        this.adsrGain = context.createGain();
        this.masterGain = context.createGain();
        this.adsrGain.connect(this.masterGain);
        this.osc.connect(this.adsrGain);
        console.log('[OscInstance] Created and connected nodes:', {
            osc: this.osc,
            adsrGain: this.adsrGain,
            masterGain: this.masterGain
        });
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

    handleInputAudio(audioNode: AudioNode) {
        // Envelopes don't directly handle audio input
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
        node.gain.setValueAtTime(0, now); // reset

        // Attack phase
        node.gain.linearRampToValueAtTime(1.0, now + this.config.attack);
        console.log(`[ADSR ${this.id}] Attack phase to 1.0 at ${now + this.config.attack}`);

        // Decay phase
        node.gain.linearRampToValueAtTime(this.config.sustain, now + this.config.attack + this.config.decay);
        console.log(`[ADSR ${this.id}] Decay phase to ${this.config.sustain} at ${now + this.config.attack + this.config.decay}`);
    }
    handleStopNode(gainNode: GainNode) {
        const now = this.engine.context.currentTime;
        console.log(`[ADSR ${this.id}] Stopping envelope at time ${now}`, {
            currentGain: gainNode.gain.value,
            releaseTime: this.config.release
        });

        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        gainNode.gain.linearRampToValueAtTime(0, now + this.config.release);
    }
}



export interface FilterConfig {
    type: BiquadFilterType
    frequency?: number;
    Q?: number;
    gain?: number;
    keytrack?: number;
    envAmount?: number;
}

class MasterGain implements AudioEngineNode {
    type = 'master';
    engine: Engine2
    id: string;
    gain: GainNode;
    setOutput(_: AudioEngineNode) {
    }
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
    engine: Engine2
    id: string;
    config: FilterConfig;
    outputs: AudioEngineNode[] = [];
    filter: BiquadFilterNode;
    setOutput(node: AudioEngineNode) {
        this.outputs.push(node);
    }

    handleInputAudio(audioNode: AudioNode) {
        this.filter.type = this.config.type;
        this.filter.frequency.value = this.config.frequency || 1000;
        this.filter.Q.value = this.config.Q || 1;
        this.filter.gain.value = this.config.gain || 1;
        this.filter.connect(audioNode);
        this.outputs.forEach(node => {
            node.handleInputAudio(audioNode);
        });
    }
    constructor(engine: Engine2, config: FilterConfig, id?: string) {
        this.engine = engine;
        this.id = id || this.type.substring(0, 3) + FilterEngineNode.nextID++;
        this.config = config;
        this.filter = this.engine.context.createBiquadFilter();
    }
}


class OscillatorEngineNode implements AudioEngineNode {
    type = 'oscillator';
    engine: Engine2
    id: string;
    envelope: ADSREnvelope | null = null;
    instances: Map<number, OscillatorEngineNodeInstance> = new Map();
    config: OscillatorConfig;
    outputs: AudioEngineNode[] = [];

    setOutput(node: AudioEngineNode) {
        this.outputs.push(node);
    }

    static nextID = 0;
    constructor(engine: Engine2, config: OscillatorConfig, id?: string) {
        this.engine = engine;
        this.id = id || this.type.substring(0, 3) + OscillatorEngineNode.nextID++;
        this.config = config;
    }

    handleInputAudio(_: AudioNode): void {
        this.outputs.forEach(node => {
            for (const instances of this.instances.values()) {
                node.handleInputAudio(instances.masterGain);
            }
        });
    }

    handleStartNode(note: number, velocity: number) {
        console.log(`[Osc ${this.id}] Starting note ${note} with velocity ${velocity}`);
        const instance = new OscillatorEngineNodeInstance(this.engine.context);
        instance.osc.type = this.config.type;
        instance.osc.detune.value = this.config.detune || 0;

        const freq = midiToFreq(note);
        instance.osc.frequency.value = freq;
        console.log(`[Osc ${this.id}] Set frequency to ${freq}Hz for note ${note}`);

        if (instance.isOscStartedPlaying) {
            console.log(`[Osc ${this.id}] Oscillator was already playing, stopping it`);
            instance.osc.stop(this.engine.context.currentTime + 1);
            instance.isOscStartedPlaying = false;
        }

        if (this.envelope) {
            console.log(`[Osc ${this.id}] Applying envelope ${this.envelope.id}`);
            this.envelope.handleStartNode(instance.adsrGain);
        }

        instance.masterGain.gain.value = velocity / 127;
        console.log(`[Osc ${this.id}] Set gain to ${velocity / 127}`);

        instance.osc.start();
        instance.isOscStartedPlaying = true;
        console.log(`[Osc ${this.id}] Started oscillator`);

        this.instances.set(note, instance);
    }

    handleStopNode(note: number) {
        console.log(`[Osc ${this.id}] Stopping note ${note}`);
        const instance = this.instances.get(note);
        if (instance) {
            if (this.envelope) {
                console.log(`[Osc ${this.id}] Applying envelope release`);
                this.envelope.handleStopNode(instance.adsrGain);
            }
            this.instances.delete(note);
            if (this.envelope) {
                if (this.envelope.config.release === 0) {
                    console.log(`[Osc ${this.id}] Immediate release`);
                    this.envelope.handleStopNode(instance.adsrGain);
                    instance.osc.disconnect();
                    instance.osc.stop();
                    instance.adsrGain.disconnect();
                    instance.masterGain.disconnect();
                } else {
                    console.log(`[Osc ${this.id}] Scheduling release after ${this.envelope.config.release}s`);
                    setTimeout(() => {
                        this.envelope?.handleStopNode(instance.adsrGain);
                        instance.osc.disconnect();
                        instance.osc.stop();
                        instance.adsrGain.disconnect();
                        instance.masterGain.disconnect();
                    }, this.envelope.config.release * 1000);
                }
            }
        } else {
            console.log(`[Osc ${this.id}] No instance found for note ${note}`);
        }
    }
}

class NoteStartEvent {
    note: number;
    velocity: number;
    time: number;
    constructor(note: number, velocity: number, time: number) {
        this.note = note;
        this.velocity = velocity;
        this.time = time;
    }
}

class NoteStopEvent {
    note: number;
    time: number;
    constructor(note: number, time: number) {
        this.note = note;
        this.time = time;
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
    type: "sine" | "square" | "triangle" | "samplehold";
    rate: number;
    sync?: boolean;
    shape?: number;
    phase?: number;
    delay?: number;
    fade?: number;
}

export interface EffectConfig {
    type: "delay" | "reverb" | "distortion" | "chorus";
    params: Record<string, any>;
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
}

class Engine2 {
    _context: AudioContext;
    private components: Map<string, AudioEngineNode> = new Map();
    private masterGain: MasterGain;

    constructor() {
        this._context = new AudioContext();
        this.masterGain = new MasterGain(this, "output");
        this.components.set("output", this.masterGain);
    }

    get context() {
        return this._context;
    }

    createFromConfig(config: UseSynthConfig) {
        console.log('[Engine] Creating synth from config:', config);
        
        // Create oscillators
        Object.entries(config.components.oscillators).forEach(([id, oscConfig]) => {
            console.log(`[Engine] Creating oscillator ${id}:`, oscConfig);
            const osc = new OscillatorEngineNode(this, oscConfig, id);
            this.components.set(id, osc);
        });

        // Create filters
        Object.entries(config.components.filters).forEach(([id, filterConfig]) => {
            console.log(`[Engine] Creating filter ${id}:`, filterConfig);
            const filter = new FilterEngineNode(this, filterConfig, id);
            this.components.set(id, filter);
        });

        // Create envelopes
        Object.entries(config.components.envelopes).forEach(([id, envConfig]) => {
            console.log(`[Engine] Creating envelope ${id}:`, envConfig);
            const env = new ADSREnvelope(this, envConfig, id);
            this.components.set(id, env);
        });

        // Connect components according to routing
        console.log('[Engine] Connecting components:');
        config.routing.forEach(connection => {
            console.log(`[Engine] Connecting ${connection.from} -> ${connection.to}`);
            const fromNode = this.components.get(connection.from);
            const toNode = this.components.get(connection.to);
            
            if (fromNode && toNode) {
                fromNode.setOutput(toNode);
                console.log(`[Engine] Successfully connected ${connection.from} -> ${connection.to}`);
            } else {
                console.error(`[Engine] Failed to connect ${connection.from} -> ${connection.to}:`, {
                    fromNodeExists: !!fromNode,
                    toNodeExists: !!toNode
                });
            }
        });

        // Connect oscillators to their envelopes
        Object.entries(config.components.oscillators).forEach(([id, oscConfig]) => {
            const osc = this.components.get(id) as OscillatorEngineNode;
            if (oscConfig.envelope) {
                console.log(`[Engine] Connecting envelope ${oscConfig.envelope} to oscillator ${id}`);
                const env = this.components.get(oscConfig.envelope);
                if (env && env.type === 'adsr') {
                    osc.envelope = env as ADSREnvelope;
                    console.log(`[Engine] Successfully connected envelope ${oscConfig.envelope} to oscillator ${id}`);
                } else {
                    console.error(`[Engine] Failed to connect envelope ${oscConfig.envelope} to oscillator ${id}:`, {
                        envExists: !!env,
                        envType: env?.type
                    });
                }
            }
        });
    }

    playNote(note: number = 60, velocity: number = 127) {
        console.log('[Engine] Playing note:', { note, velocity });
        this.components.forEach(component => {
            if (component.type === 'oscillator') {
                console.log(`[Engine] Triggering oscillator ${component.id}`);
                const osc = component as OscillatorEngineNode;
                osc.handleStartNode(note, velocity);
            }
        });
    }

    stopNote(note: number = 60) {
        console.log('[Engine] Stopping note:', note);
        this.components.forEach(component => {
            if (component.type === 'oscillator') {
                console.log(`[Engine] Stopping oscillator ${component.id}`);
                const osc = component as OscillatorEngineNode;
                osc.handleStopNode(note);
            }
        });
    }
}

const baseConfig: UseSynthConfig = {
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
        { from: "main", to: "output" },
        // { from: "lpf", to: "output" },
    ],
    // modulation: [
    //     {
    //         source: { type: "lfo", id: "vibrato" },
    //         target: { path: "oscillator.main.detune" },
    //         amount: 20,
    //     },
    // ],
    // input: {
    //     keyboard: {
    //         mapping: KEYBOARD_MAP,
    //         velocity: "dynamic",
    //     },
    // },
}

export default function OscillatorPage() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-950 text-white">
            <button onClick={() => {
                console.log('[UI] Button clicked, creating synth');
                const synth = new Engine2();
                synth.createFromConfig(baseConfig);
                console.log('[UI] Playing note');
                synth.playNote();
            }}>Play C4</button>
        </main>
    );
} 