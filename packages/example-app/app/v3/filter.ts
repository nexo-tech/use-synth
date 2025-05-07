import { SynthEngine } from "./engine";
import {
  ConnectionEvent,
  DisconnectionEvent,
  NoteStartEvent,
  NoteStopEvent,
  SynthEvent,
  SynthNode,
  ParameterChangeEvent,
  ParameterUpdatedEvent,
  NodeOutput,
  connectNodeOutputs,
  getReleaseValue,
  ModulationEvent,
} from "./base";
import { ModulationSignal } from "./modulation-signal";
import { SynthLFO } from "./lfo";

export interface FilterConfig {
  type: BiquadFilterType;
  frequency: number;
  q: number;
}

class FilterVoice {
  private filter: BiquadFilterNode;
  private gain: GainNode;
  private frequencyModulationGainInput: ModulationSignal;
  private qModulationGainInput: ModulationSignal;

  constructor(
    private engine: SynthEngine,
    private config: FilterConfig,
    private note: number
  ) {
    this.filter = engine.ctx.createBiquadFilter();
    this.gain = engine.ctx.createGain();
    this.frequencyModulationGainInput = new ModulationSignal(
      engine,
      this.note,
      12000
    );
    this.qModulationGainInput = new ModulationSignal(engine, this.note);
    this.filter.connect(this.gain);
    this.updateFilter();
  }

  private updateFilter() {
    this.filter.type = this.config.type;
    this.filter.frequency.value = this.config.frequency;
    this.filter.Q.value = this.config.q;
  }

  getNote(): number {
    return this.note;
  }

  getInput(): AudioNode {
    return this.filter;
  }

  getOutput(): AudioNode {
    return this.gain;
  }

  updateType(type: BiquadFilterType) {
    this.filter.type = type;
  }

  updateFrequency(frequency: number) {
    this.filter.frequency.value = frequency;
  }

  updateQ(q: number) {
    this.filter.Q.value = q;
  }

  connectModulation(
    parameter: "frequency" | "q",
    modulationSource: SynthNode,
    amount: number
  ) {
    switch (parameter) {
      case "frequency":
        this.frequencyModulationGainInput.setAmount(modulationSource, amount);
        console.log(this.filter.frequency);
        this.frequencyModulationGainInput
          .getOutput()
          .connect(this.filter.frequency);
        break;
      case "q":
        this.qModulationGainInput.setAmount(modulationSource, amount);
        this.qModulationGainInput.getOutput().connect(this.filter.Q);
        break;
      default:
        throw new Error(`Unsupported parameter: ${parameter}`);
    }
  }

  disconnectModulation() {
    this.frequencyModulationGainInput.disconnect();
    this.qModulationGainInput.disconnect();
  }

  disconnect() {
    this.filter.disconnect();
    this.gain.disconnect();
    this.disconnectModulation();
  }
}

export class SynthFilter extends SynthNode {
  getReleaseValue(): number {
    return getReleaseValue(this.engine, this.id);
  }
  private voices: Map<number, FilterVoice> = new Map();
  private config: FilterConfig;
  prepareNotes(notes: number[]): void {
    notes.forEach((note) => {
      this.getVoice(note);
    });
  }

  getConfig(): FilterConfig {
    return this.config;
  }

  constructor(
    public readonly id: string,
    private engine: SynthEngine,
    config: FilterConfig
  ) {
    super();
    this.config = config;
  }

  getNodeInput(): NodeOutput {
    return new Map(
      Array.from(this.voices.values()).map((x) => [x.getNote(), x.getInput()])
    );
  }

  getNodeOutput(): NodeOutput {
    return new Map(
      Array.from(this.voices.values()).map((x) => [x.getNote(), x.getOutput()])
    );
  }

  private getVoice(note: number): FilterVoice {
    let voice = this.voices.get(note);
    if (!voice) {
      voice = new FilterVoice(this.engine, this.config, note);
      this.voices.set(note, voice);
      this.reconnect();
    }
    return voice;
  }

  reconnect() {
    const connections = this.engine.connections.getConnectionsFrom(this.id);
    connections.forEach((connection) => {
      const node = this.engine.nodes.get(connection.toID);
      if (node) {
        connectNodeOutputs(this, node);
      }
    });
  }

  get modulationSources(): {
    parameter: "frequency" | "q";
    source: SynthNode;
    amount: number;
  }[] {
    return this.engine.modulations.getModulationsTo(this.id).map((mod) => ({
      parameter: mod.parameter as "frequency" | "q",
      source: this.engine.nodes.get(mod.fromID) as SynthNode,
      amount: mod.amount,
    }));
  }

  observe(event: SynthEvent): void {
    switch (event.constructor.name) {
      case "ParameterChangeEvent": {
        const ev = event as ParameterChangeEvent<any>;
        if (ev.id !== this.id) {
          return;
        }

        if (ev.parameter === "type") {
          const oldValue = this.config.type;
          this.config.type = ev.value;

          // Update all voices with new type
          this.voices.forEach((voice) => {
            voice.updateType(ev.value);
          });

          // Emit parameter updated event
          this.engine.sendEvent(
            new ParameterUpdatedEvent(this.id, "type", ev.value, oldValue)
          );
        } else if (ev.parameter === "frequency") {
          // Clamp frequency between 20Hz and 20kHz
          const newFreq = Math.max(20, Math.min(20000, ev.value));
          const oldValue = this.config.frequency;
          this.config.frequency = newFreq;

          // Update all voices with new frequency
          this.voices.forEach((voice) => {
            voice.updateFrequency(newFreq);
          });

          // Emit parameter updated event
          this.engine.sendEvent(
            new ParameterUpdatedEvent(this.id, "frequency", newFreq, oldValue)
          );
        } else if (ev.parameter === "q") {
          // Clamp Q between 0.0001 and 1000
          const newQ = Math.max(0.0001, Math.min(1000, ev.value));
          const oldValue = this.config.q;
          this.config.q = newQ;

          // Update all voices with new Q
          this.voices.forEach((voice) => {
            voice.updateQ(newQ);
          });

          // Emit parameter updated event
          this.engine.sendEvent(
            new ParameterUpdatedEvent(this.id, "q", newQ, oldValue)
          );
        }
        break;
      }
      case "ConnectionEvent": {
        const ev = event as ConnectionEvent;
        if (ev.connection.toID === this.id) {
          const upstream = this.engine.nodes.get(ev.connection.fromID);
          if (upstream) {
            const upstreamNode = upstream.getNodeOutput();
            if (upstreamNode) {
              connectNodeOutputs(upstream, this);
            }
          }
        }
        break;
      }
      case "DisconnectionEvent": {
        const ev = event as DisconnectionEvent;
        if (ev.connection.toID === this.id) {
          // Disconnect all voices
          this.voices.forEach((voice) => {
            voice.disconnect();
          });
        }
        break;
      }
      case "ModulationEvent": {
        const ev = event as ModulationEvent;
        if (ev.toID !== this.id) return;

        const modulationSource = this.engine.nodes.get(ev.fromID);
        if (!modulationSource || !(modulationSource instanceof SynthLFO))
          return;

        // Apply modulation to all active voices
        this.voices.forEach((voice, noteNumber) => {
          voice.connectModulation(
            ev.parameter as "frequency" | "q",
            modulationSource,
            ev.amount
          );
        });
        break;
      }
      case "NoteStartEvent": {
        const ev = event as NoteStartEvent;
        const voice = this.getVoice(ev.note);
        this.reconnect();

        // Connect any active modulations to the new voice
        this.modulationSources.forEach(({ parameter, source, amount }) => {
          source.prepareNotes([ev.note]);
          voice.connectModulation(parameter, source, amount);
        });
        break;
      }
      case "NoteStopEvent": {
        const ev = event as NoteStopEvent;
        const voice = this.voices.get(ev.note);
        if (voice) {
          this.voices.delete(ev.note);
          const releaseValue = this.getReleaseValue();
          if (releaseValue > 0) {
            setTimeout(() => {
              voice.disconnect();
            }, releaseValue * 1000);
          } else {
            voice.disconnect();
          }
        }
        break;
      }
    }
  }
}
