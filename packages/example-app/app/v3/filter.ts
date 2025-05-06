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
} from "./base";

export interface FilterConfig {
  type: BiquadFilterType;
  frequency: number;
  q: number;
}

export class SynthFilter extends SynthNode {
  private filter: BiquadFilterNode;
  private config: FilterConfig;

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
    this.filter = engine.ctx.createBiquadFilter();
    this.updateFilter();
  }

  private updateFilter() {
    this.filter.type = this.config.type;
    this.filter.frequency.value = this.config.frequency;
    this.filter.Q.value = this.config.q;
  }

  get(): NodeOutput {
    return this.filter;
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
          this.filter.type = ev.value;

          // Emit parameter updated event
          this.engine.sendEvent(
            new ParameterUpdatedEvent(this.id, "type", ev.value, oldValue)
          );
        } else if (ev.parameter === "frequency") {
          // Clamp frequency between 20Hz and 20kHz
          const newFreq = Math.max(20, Math.min(20000, ev.value));
          const oldValue = this.config.frequency;
          this.config.frequency = newFreq;
          this.filter.frequency.value = newFreq;

          // Emit parameter updated event
          this.engine.sendEvent(
            new ParameterUpdatedEvent(this.id, "frequency", newFreq, oldValue)
          );
        } else if (ev.parameter === "q") {
          // Clamp Q between 0.0001 and 1000
          const newQ = Math.max(0.0001, Math.min(1000, ev.value));
          const oldValue = this.config.q;
          this.config.q = newQ;
          this.filter.Q.value = newQ;

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
            const upstreamNode = upstream.get();
            if (upstreamNode) {
              connectNodeOutputs(upstreamNode, this.filter);
            }
          }
        }
        break;
      }
      case "DisconnectionEvent": {
        const ev = event as DisconnectionEvent;
        if (ev.connection.toID === this.id) {
          this.filter.disconnect();
        }
        break;
      }
    }
  }
}
