import {
  SynthNode,
  SynthEvent,
  NoteStartEvent,
  NoteStopEvent,
  ConnectionEvent,
  ParameterChangeEvent,
  ParameterUpdatedEvent,
  NodeOutput,
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
    // this.cv.offset.cancelScheduledValues(now);
    // this.cv.offset.setValueAtTime(this.cv.offset.value, now);
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
  private config: ADSRConfig;
  private noteADSRs: Map<number, NoteADSR> = new Map();

  getConfig(): ADSRConfig {
    return this.config;
  }

  constructor(
    public readonly id: string,
    private engine: SynthEngine,
    config: ADSRConfig
  ) {
    this.config = config;
  }

  get(): NodeOutput {
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
      case "ParameterChangeEvent": {
        const ev = event as ParameterChangeEvent<any>;
        if (ev.id !== this.id) {
          return;
        }

        if (ev.parameter === "attack") {
          // Clamp attack between 0 and 10 seconds
          const newAttack = Math.max(0, Math.min(10, ev.value));
          const oldValue = this.config.attack;
          this.config.attack = newAttack;

          // Emit parameter updated event
          this.engine.sendEvent(
            new ParameterUpdatedEvent(this.id, "attack", newAttack, oldValue)
          );
        } else if (ev.parameter === "decay") {
          // Clamp decay between 0 and 10 seconds
          const newDecay = Math.max(0, Math.min(10, ev.value));
          const oldValue = this.config.decay;
          this.config.decay = newDecay;

          // Emit parameter updated event
          this.engine.sendEvent(
            new ParameterUpdatedEvent(this.id, "decay", newDecay, oldValue)
          );
        } else if (ev.parameter === "sustain") {
          // Clamp sustain between 0 and 1
          const newSustain = Math.max(0, Math.min(1, ev.value));
          const oldValue = this.config.sustain;
          this.config.sustain = newSustain;

          // Emit parameter updated event
          this.engine.sendEvent(
            new ParameterUpdatedEvent(this.id, "sustain", newSustain, oldValue)
          );
        } else if (ev.parameter === "release") {
          // Clamp release between 0 and 10 seconds
          const newRelease = Math.max(0, Math.min(10, ev.value));
          const oldValue = this.config.release;
          this.config.release = newRelease;

          // Emit parameter updated event
          this.engine.sendEvent(
            new ParameterUpdatedEvent(this.id, "release", newRelease, oldValue)
          );
        }
        break;
      }
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
