'use client';

import React, { useState } from 'react';
import Osc from '../components/Osc';


function randomID() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

interface EngineNode {
    type: string;
    id: string;
}

class OscillatorEngineNode implements EngineNode {
    type = 'oscillator';
    context: AudioContext;
    osc: OscillatorNode;
    id: string;

    static nextID = 0;
    constructor(context: AudioContext) {
        this.context = context;
        this.osc = this.context.createOscillator();
        this.id = this.type.substring(0, 3) + OscillatorEngineNode.nextID++;
    }
    playNote() {
    }
}

class Engine2 {
    context: AudioContext;
    constructor() {
        this.context = new AudioContext();
    }
    playNote() {
        // create osc and play note
        const osc = this.context.createOscillator();
        osc.frequency.value = 440;
        osc.connect(this.context.destination);
        osc.start();
        // create gain and connect osc to it
        const gain = this.context.createGain();
        osc.connect(gain);
        // connect gain to destination
        gain.connect(this.context.destination);
        // create envelope and connect to gain
    }
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