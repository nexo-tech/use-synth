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

interface Modulation {
  fromID: string;
  toID: string;
  parameter: string;
  amount: number; // -1 to 1
}

class Modulations {
  private modulations: Set<Modulation> = new Set();
  private fromTo: Map<string, Map<string, Set<Modulation>>> = new Map();
  private toFrom: Map<string, Map<string, Set<Modulation>>> = new Map();

  addModulation(modulation: Modulation): boolean {
    const { fromID, toID, parameter, amount } = modulation;

    // Clamp amount between -1 and 1
    modulation.amount = Math.max(-1, Math.min(1, amount));

    // Initialize maps if they don't exist
    if (!this.fromTo.has(fromID)) {
      this.fromTo.set(fromID, new Map());
    }
    if (!this.toFrom.has(toID)) {
      this.toFrom.set(toID, new Map());
    }

    // Initialize parameter sets if they don't exist
    if (!this.fromTo.get(fromID)!.has(toID)) {
      this.fromTo.get(fromID)!.set(toID, new Set());
    }
    if (!this.toFrom.get(toID)!.has(fromID)) {
      this.toFrom.get(toID)!.set(fromID, new Set());
    }

    // Check if modulation already exists
    const existingModulations = this.fromTo.get(fromID)!.get(toID)!;
    for (const mod of existingModulations) {
      if (mod.parameter === parameter) {
        return false;
      }
    }

    // Add modulation to both maps
    this.fromTo.get(fromID)!.get(toID)!.add(modulation);
    this.toFrom.get(toID)!.get(fromID)!.add(modulation);
    this.modulations.add(modulation);
    return true;
  }

  removeModulation(modulation: Modulation): boolean {
    const { fromID, toID, parameter } = modulation;
    
    // Remove modulation from both maps
    const fromModulations = this.fromTo.get(fromID)?.get(toID);
    const toModulations = this.toFrom.get(toID)?.get(fromID);
    
    if (fromModulations && toModulations) {
      for (const mod of fromModulations) {
        if (mod.parameter === parameter) {
          fromModulations.delete(mod);
          toModulations.delete(mod);
          return this.modulations.delete(mod);
        }
      }
    }
    return false;
  }

  getModulationsFrom(fromID: string): Modulation[] {
    const result: Modulation[] = [];
    const toMap = this.fromTo.get(fromID);
    if (toMap) {
      for (const modulations of toMap.values()) {
        result.push(...modulations);
      }
    }
    return result;
  }

  getModulationsTo(toID: string): Modulation[] {
    const result: Modulation[] = [];
    const fromMap = this.toFrom.get(toID);
    if (fromMap) {
      for (const modulations of fromMap.values()) {
        result.push(...modulations);
      }
    }
    return result;
  }

  getModulationsBetween(fromID: string, toID: string): Modulation[] {
    return Array.from(this.fromTo.get(fromID)?.get(toID) ?? []);
  }

  hasModulation(fromID: string, toID: string, parameter: string): boolean {
    const modulations = this.fromTo.get(fromID)?.get(toID);
    if (!modulations) return false;
    
    for (const mod of modulations) {
      if (mod.parameter === parameter) {
        return true;
      }
    }
    return false;
  }

  getAllModulations(): Modulation[] {
    return Array.from(this.modulations);
  }
}

export class SynthEngine {
  nodes: Map<string, SynthNode> = new Map();
  ctx: AudioContext;
  connections: Connections = new Connections();
  modulations: Modulations = new Modulations();
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
        // Find all modulations that connect to this node
        const modulations = this.modulations.getModulationsFrom(ev.id);
        for (const modulation of modulations) {
          this.modulations.removeModulation(modulation);
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
