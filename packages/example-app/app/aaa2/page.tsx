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
}

class OscillatorEngineNodeInstance {
    osc: OscillatorNode;
    adsrGain: GainNode;
    masterGain: GainNode;

    constructor(context: AudioContext) {
        this.osc = context.createOscillator();
        this.adsrGain = context.createGain();
        this.masterGain = context.createGain();
        this.adsrGain.connect(this.masterGain);
        this.osc.connect(this.adsrGain);
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


class ADSREnvelope implements EngineNode {
    static nextID = 0;
    type = 'adsr';
    id: string;
    config: EnvelopeConfig;
    engine: Engine2
    constructor(engine: Engine2, config: EnvelopeConfig, id?: string) {
        this.id = id || this.type.substring(0, 3) + ADSREnvelope.nextID++;
        this.config = config;
        this.engine = engine;
    }
    handleStartNode(node: GainNode) {
        const now = this.engine.context.currentTime;


        node.gain.cancelScheduledValues(now);
        node.gain.setValueAtTime(0, now); // reset

        // Attack phase
        node.gain.linearRampToValueAtTime(1.0, now + this.config.attack);

        // Decay phase
        node.gain.linearRampToValueAtTime(this.config.sustain, now + this.config.attack + this.config.decay);
    }
    handleStopNode(gainNode: GainNode) {
        const now = this.engine.context.currentTime;

        gainNode.gain.cancelScheduledValues(now);

        // Release phase
        gainNode.gain.setValueAtTime(gainNode.gain.value, now); // set current value
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
        const instance = new OscillatorEngineNodeInstance(this.engine.context);
        instance.osc.type = this.config.type;
        instance.osc.detune.value = this.config.detune || 0;

        instance.osc.frequency.value = midiToFreq(note);
        instance.osc.stop(this.engine.context.currentTime + 1);
        if (this.envelope) {
            this.envelope.handleStartNode(instance.adsrGain);
        }
        // apply velocity to gain
        instance.masterGain.gain.value = velocity / 127;
        instance.osc.start();

        this.instances.set(note, instance);
    }

    handleStopNode(note: number) {
        const instance = this.instances.get(note);
        if (instance) {
            if (this.envelope) {
                this.envelope.handleStopNode(instance.adsrGain);
            }
            this.instances.delete(note);
            if (this.envelope) {
                // based on release time, schedule stop
                // if release is 0, stop immediately
                if (this.envelope.config.release === 0) {
                    this.envelope.handleStopNode(instance.adsrGain);
                    instance.osc.disconnect();
                    instance.osc.stop();

                    instance.adsrGain.disconnect();
                    instance.masterGain.disconnect();
                } else {
                    setTimeout(() => {
                        this.envelope?.handleStopNode(instance.adsrGain);
                        instance.osc.disconnect();
                        instance.osc.stop();

                        instance.adsrGain.disconnect();
                        instance.masterGain.disconnect();
                    }, this.envelope.config.release * 1000);
                }
            }
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

    constructor() {
        this._context = new AudioContext();
    }

    handleEvent(event: NoteStartEvent | NoteStopEvent) {
    }

    get context() {
        return this._context;
    }

}

const baseConfig = {
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
                const synth = new Engine2();
                synth.playNote();
            }}>Play C4</button>
        </main>
    );
} 