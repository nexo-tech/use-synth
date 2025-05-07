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

export interface LFOConfig {
  type: string;
  rate: number;
  sync?: boolean;
  shape?: number;
  phase?: number;
}

class NoteLFO {
  private oscillator: OscillatorNode;
  private gainNode: GainNode;
  private isPlaying: boolean = false;

  constructor(
    private engine: SynthEngine,
    private config: LFOConfig,
    private note: number
  ) {
    this.oscillator = engine.ctx.createOscillator();
    this.gainNode = engine.ctx.createGain();

    // Set initial values
    this.oscillator.type = this.config.type as OscillatorType;
    this.oscillator.frequency.value = this.config.rate;
    this.gainNode.gain.value = 1;

    // Connect nodes
    this.oscillator.connect(this.gainNode);
  }

  get(): AudioNode {
    return this.gainNode;
  }

  getNote(): number {
    return this.note;
  }

  noteOn() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.oscillator.start();
  }

  noteOff() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this.oscillator.stop();
    this.disconnect();
  }

  disconnect() {
    this.oscillator.disconnect();
    this.gainNode.disconnect();
  }

  updateConfig(newConfig: LFOConfig) {
    this.config = newConfig;
    this.oscillator.type = this.config.type as OscillatorType;
    this.oscillator.frequency.value = this.config.rate;
    // Note: Web Audio API doesn't support phase setting directly
    // We'll handle phase through other means if needed
  }
}

export class SynthLFO extends SynthNode {
  private config: LFOConfig;
  private noteLFOs: Map<number, NoteLFO> = new Map();

  constructor(
    public readonly id: string,
    private engine: SynthEngine,
    config: LFOConfig
  ) {
    super();
    this.config = config;
  }

  prepareNotes(notes: number[]) {
    notes.forEach((note) => {
      this.getNoteLFO(note);
    });
  }

  getNodeOutput(): NodeOutput {
    // We don't return a single node since each note has its own LFO
    return new Map(
      Array.from(this.noteLFOs.values()).map((x) => [x.getNote(), x.get()])
    );
  }

  getNoteLFO(note: number): NoteLFO {
    let lfo = this.noteLFOs.get(note);
    if (!lfo) {
      lfo = new NoteLFO(this.engine, this.config, note);
      this.noteLFOs.set(note, lfo);
    }
    return lfo;
  }

  getConfig(): LFOConfig {
    return this.config;
  }

  getReleaseValue(): number {
    const modulations = this.engine.modulations.getModulationsFrom(this.id);
    return modulations.reduce((acc, conn) => {
      const node = this.engine.nodes.get(conn.toID);
      return Math.max(acc, node?.getReleaseValue() ?? 0);
    }, 0);
  }

  observe(event: SynthEvent): void {
    switch (event.constructor.name) {
      case "ParameterChangeEvent": {
        const ev = event as ParameterChangeEvent<any>;
        if (ev.id !== this.id) {
          return;
        }

        let oldValue: number | string | boolean | undefined;
        let newValue: number | string | boolean | undefined;

        // Type-safe parameter updates
        switch (ev.parameter) {
          case "type": {
            if (typeof ev.value !== "string") return;
            if (
              !["sine", "square", "sawtooth", "triangle"].includes(ev.value)
            ) {
              return;
            }
            oldValue = this.config.type;
            newValue = ev.value;
            this.config.type = ev.value;
            break;
          }
          case "rate": {
            if (typeof ev.value !== "number") return;
            newValue = Math.max(0.1, Math.min(20, ev.value));
            oldValue = this.config.rate;
            this.config.rate = newValue;
            break;
          }
          case "shape": {
            if (typeof ev.value !== "number") return;
            newValue = Math.max(0, Math.min(1, ev.value));
            oldValue = this.config.shape;
            this.config.shape = newValue;
            break;
          }
          case "phase": {
            if (typeof ev.value !== "number") return;
            newValue = Math.max(0, Math.min(360, ev.value));
            oldValue = this.config.phase;
            this.config.phase = newValue;
            break;
          }
          case "sync": {
            if (typeof ev.value !== "boolean") return;
            oldValue = this.config.sync;
            newValue = ev.value;
            this.config.sync = ev.value;
            break;
          }
          default:
            return;
        }

        // Update all active LFOs with new config
        this.noteLFOs.forEach((lfo) => lfo.updateConfig(this.config));

        // Emit parameter updated event
        this.engine.sendEvent(
          new ParameterUpdatedEvent(this.id, ev.parameter, newValue, oldValue)
        );
        break;
      }
      case "NoteStartEvent": {
        const ev = event as NoteStartEvent;
        const lfo = this.getNoteLFO(ev.note);
        lfo.noteOn();
        break;
      }
      case "NoteStopEvent": {
        const ev = event as NoteStopEvent;
        const lfo = this.noteLFOs.get(ev.note);
        if (lfo) {
          const releaseValue = this.getReleaseValue();
          if (releaseValue > 0) {
            setTimeout(() => {
              lfo.noteOff();
            }, releaseValue * 1000);
          } else {
            lfo.noteOff();
          }
          this.noteLFOs.delete(ev.note);
        }
        break;
      }
    }
  }
}
