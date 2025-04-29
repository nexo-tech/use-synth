import { SynthADSR } from "./adsr";
import {
  Connection,
  ConnectionEvent,
  DisconnectionEvent,
  NodeCreateEvent,
  NodeDeleteEvent,
  NoteStartEvent,
  NoteStopEvent,
  SynthEvent,
  SynthNode,
} from "./base";
import { SynthOscillator } from "./oscillator";

class DestinationNode implements SynthNode {
  constructor(private engine: SynthEngine) {}

  get(): AudioNode | null {
    return this.engine.ctx.destination;
  }

  get id(): string {
    return "output";
  }

  observe(event: SynthEvent): void {
    switch (event.constructor.name) {
      case "ConnectionEvent":
        if ((event as ConnectionEvent).connection.toID === this.id) {
          const ev = event as ConnectionEvent;
          this.engine.nodes
            .get(ev.connection.fromID)!
            .get()
            ?.connect(this.get()!);
        }
        break;
      case "DisconnectionEvent":
        if ((event as DisconnectionEvent).connection.toID === this.id) {
          this.get()?.disconnect();
        }
        break;
    }
  }
}

export class SynthEngine {
  nodes: Map<string, SynthNode> = new Map();
  ctx: AudioContext;

  connections: Set<Connection> = new Set();
  fromTo: Map<string, Map<string, Connection>> = new Map();
  toFrom: Map<string, Map<string, Connection>> = new Map();

  constructor() {
    // Create web audio context
    this.ctx = new AudioContext();
    const output = new DestinationNode(this);
    this.nodes.set(output.id, output);
  }

  notes: Map<number, boolean> = new Map();

  sendEvent(event: SynthEvent) {
    switch (event.constructor.name) {
      case "NoteStartEvent": {
        const ev = event as NoteStartEvent;
        if (this.notes.get(ev.note)) {
          return;
        }
        this.notes.set(ev.note, true);
        break;
      }
      case "NoteStopEvent": {
        const ev = event as NoteStopEvent;
        if (!this.notes.get(ev.note)) {
          return;
        }
        this.notes.set(ev.note, false);
        break;
      }
      case "ConnectionEvent": {
        // check if such connection already exists

        const ev = event as ConnectionEvent;
        this.connections.add(ev.connection);
        this.fromTo.set(ev.connection.fromID, [
          ...(this.fromTo.get(ev.connection.fromID) || []),
          ev.connection,
        ]);
        this.toFrom.set(ev.connection.toID, [
          ...(this.toFrom.get(ev.connection.toID) || []),
          ev.connection,
        ]);
        break;
      }
      case "DisconnectionEvent": {
        const ev = event as DisconnectionEvent;
        this.connections.delete(ev.connection);
        this.fromTo.set(
          ev.connection.fromID,
          this.fromTo
            .get(ev.connection.fromID)
            ?.filter((c) => c !== ev.connection) ?? []
        );
        this.toFrom.set(
          ev.connection.toID,
          this.toFrom
            .get(ev.connection.toID)
            ?.filter((c) => c !== ev.connection) ?? []
        );
        break;
      }
      case "NodeCreateEvent": {
        const ev = event as NodeCreateEvent<any>;
        const id = ev.id;
        if (this.nodes.has(id)) {
          return;
        }
        switch (ev.type) {
          case "oscillator":
            const oscillator = new SynthOscillator(id, this, ev.config);
            this.nodes.set(oscillator.id, oscillator);
            break;
          case "adsr":
            const adsr = new SynthADSR(ev.id, this, ev.config);
            this.nodes.set(adsr.id, adsr);
            break;
        }
        break;
      }
      case "NodeDeleteEvent": {
        const ev = event as NodeDeleteEvent;
        if (!this.nodes.has(ev.id)) {
          return;
        }
        // Find all connections that connect to this node
        const connections = this.fromTo.get(ev.id) || [];
        for (const c of connections) {
          this.sendEvent(new DisconnectionEvent(c));
        }
        this.nodes.delete(ev.id);
        break;
      }
    }

    for (const node of this.nodes
      .values()
      .filter((n) => n instanceof SynthADSR)) {
      node.observe(event);
    }

    for (const node of this.nodes
      .values()
      .filter((n) => !(n instanceof SynthADSR))) {
      node.observe(event);
    }
  }

  getNode(id: string): SynthNode | null {
    console.log("getNode", id, this.nodes);
    return this.nodes.get(id) ?? null;
  }
}
