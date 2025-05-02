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

class Connections {
  private connections: Set<Connection> = new Set();
  private fromTo: Map<string, Map<string, Connection>> = new Map();
  private toFrom: Map<string, Map<string, Connection>> = new Map();

  addConnection(connection: Connection): boolean {
    const { fromID, toID } = connection;

    // Initialize maps if they don't exist
    if (!this.fromTo.has(fromID)) {
      this.fromTo.set(fromID, new Map());
    }
    if (!this.toFrom.has(toID)) {
      this.toFrom.set(toID, new Map());
    }

    // Check if connection already exists
    if (this.fromTo.get(fromID)?.has(toID)) {
      return false;
    }

    // Add connection to both maps
    this.fromTo.get(fromID)!.set(toID, connection);
    this.toFrom.get(toID)!.set(fromID, connection);
    this.connections.add(connection);
    return true;
  }

  removeConnection(connection: Connection): boolean {
    const { fromID, toID } = connection;
    
    // Remove connection from both maps
    this.fromTo.get(fromID)?.delete(toID);
    this.toFrom.get(toID)?.delete(fromID);
    return this.connections.delete(connection);
  }

  getConnectionsFrom(fromID: string): Connection[] {
    return Array.from(this.fromTo.get(fromID)?.values() ?? []);
  }

  getConnectionsTo(toID: string): Connection[] {
    return Array.from(this.toFrom.get(toID)?.values() ?? []);
  }

  hasConnection(fromID: string, toID: string): boolean {
    return this.fromTo.get(fromID)?.has(toID) ?? false;
  }

  getAllConnections(): Connection[] {
    return Array.from(this.connections);
  }
}

export class SynthEngine {
  nodes: Map<string, SynthNode> = new Map();
  ctx: AudioContext;
  connections: Connections = new Connections();
  notes: Map<number, boolean> = new Map();

  constructor() {
    // Create web audio context
    this.ctx = new AudioContext();
    const output = new DestinationNode(this);
    this.nodes.set(output.id, output);
  }

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
        const ev = event as ConnectionEvent;
        this.connections.addConnection(ev.connection);
        break;
      }
      case "DisconnectionEvent": {
        const ev = event as DisconnectionEvent;
        this.connections.removeConnection(ev.connection);
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
            const adsr = new SynthADSR(id, this, ev.config);
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
        const connections = this.connections.getConnectionsFrom(ev.id);
        for (const connection of connections) {
          this.sendEvent(new DisconnectionEvent(connection));
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
    return this.nodes.get(id) ?? null;
  }
}
