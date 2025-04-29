import {
  SynthNode,
  SynthEvent,
  NoteStartEvent,
  NoteStopEvent,
  ConnectionEvent,
} from "./base";
import { SynthEngine } from "./engine";

export interface ADSRConfig {
  attack: number; // in seconds
  decay: number; // in seconds
  sustain: number; // 0 to 1
  release: number; // in seconds
}

class NoteADSR {
  private gainNode: GainNode;
  private cv: ConstantSourceNode;
  private isPlaying: boolean = false;

  constructor(
    private engine: SynthEngine,
    private config: ADSRConfig,
    private note: number
  ) {
    this.gainNode = engine.ctx.createGain();
    this.gainNode.gain.value = 0;
    this.cv = engine.ctx.createConstantSource();
    this.cv.offset.value = 0;
    this.cv.connect(this.gainNode);
  }

  get(): AudioNode {
    return this.cv;
  }

  noteOn() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    console.log("noteOn", this.gainNode);
    this.cv.start();

    const now = this.engine.ctx.currentTime;
    this.cv.offset.cancelScheduledValues(now);
    this.cv.offset.setValueAtTime(0, now);
    this.cv.offset.linearRampToValueAtTime(1, now + this.config.attack);
    this.cv.offset.linearRampToValueAtTime(
      this.config.sustain,
      now + this.config.attack + this.config.decay
    );
  }

  noteOff() {
    if (!this.isPlaying) return;
    this.isPlaying = false;

    const now = this.engine.ctx.currentTime;
    this.cv.offset.cancelScheduledValues(now);
    this.cv.offset.setValueAtTime(this.cv.offset.value, now);
    this.cv.offset.linearRampToValueAtTime(0, now + this.config.release);
    setTimeout(() => {
      this.cv.stop();
      this.disconnect();
    }, this.config.release * 1000);
  }

  disconnect() {
    this.cv.disconnect();
    this.gainNode.disconnect();
  }
}

export class SynthADSR implements SynthNode {
  config: ADSRConfig;
  private noteADSRs: Map<number, NoteADSR> = new Map();

  constructor(
    public readonly id: string,
    private engine: SynthEngine,
    config: ADSRConfig
  ) {
    this.config = config;
  }

  get(): AudioNode | null {
    // We don't return a single node since each note has its own ADSR
    return null;
  }

  getNoteADSR(note: number): NoteADSR {
    let adsr = this.noteADSRs.get(note);
    if (!adsr) {
      adsr = new NoteADSR(this.engine, this.config, note);
      this.noteADSRs.set(note, adsr);
    }
    return adsr;
  }

  observe(event: SynthEvent): void {
    switch (event.constructor.name) {
      case "NoteStartEvent": {
        const ev = event as NoteStartEvent;
        const adsr = this.getNoteADSR(ev.note);
        adsr.noteOn();
        break;
      }
      case "NoteStopEvent": {
        const ev = event as NoteStopEvent;
        const adsr = this.noteADSRs.get(ev.note);
        if (adsr) {
          adsr.noteOff();
          this.noteADSRs.delete(ev.note);
        }
        break;
      }
    }
  }
}
