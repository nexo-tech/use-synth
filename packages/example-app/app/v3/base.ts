import { SynthEngine } from "./engine";

export type NodeOutput = AudioNode | null | Map<number, AudioNode>;
export interface Modulation {
  fromID: string;
  toID: string;
  parameter: string;
  amount: number; // -1 to 1
}

export const availableModulationTargets = [
  {
    componentType: "osc",
    parameter: "level",
    name: "Level",
  },
];

export function connectNodeOutputs(fromNode: SynthNode, toNode: SynthNode) {
  const from = fromNode.getNodeOutput();
  const to = toNode.getNodeInput();

  // If either input is null, no connection is possible
  if (from === null || to === null) {
    return;
  }

  // Case 1: Both are AudioNodes
  if (from instanceof AudioNode && to instanceof AudioNode) {
    from.connect(to);
    return;
  }

  // Case 2: From is AudioNode, To is Map
  if (from instanceof AudioNode && to instanceof Map) {
    // Connect the single node to all nodes in the map
    for (const node of to.values()) {
      from.connect(node);
    }
    return;
  }

  // Case 3: From is Map, To is AudioNode
  if (from instanceof Map && to instanceof AudioNode) {
    // Connect all nodes in the map to the single node
    for (const node of from.values()) {
      node.connect(to);
    }
    return;
  }

  // Case 4: Both are Maps
  if (from instanceof Map && to instanceof Map) {
    toNode.prepareNotes(Array.from(from.keys()));

    // Connect each node from the source map to its corresponding node in the target map
    for (const [key, sourceNode] of from.entries()) {
      const targetNode = to.get(key);
      if (targetNode) {
        sourceNode.connect(targetNode);
      }
    }
    return;
  }
}

export function disconnectNodeOutput(nodeOutput: NodeOutput) {
  if (nodeOutput instanceof AudioNode) {
    nodeOutput.disconnect();
  } else if (nodeOutput instanceof Map) {
    nodeOutput.forEach((output) => disconnectNodeOutput(output));
  }
}

export function getReleaseValue(engine: SynthEngine, id: string): number {
  const items = engine.connections.getConnectionsTo(id);
  const releaseValues = items
    .map((item) => {
      const node = engine.nodes.get(item.fromID);
      if (node) {
        return node.getReleaseValue();
      }
      return 0;
    })
    .reduce((a, b) => Math.max(a, b), 0);
  return releaseValues;
}

export abstract class SynthNode {
  abstract get id(): string;
  abstract observe(event: SynthEvent): void;
  abstract getNodeOutput(): NodeOutput;
  getNodeInput(): NodeOutput {
    return this.getNodeOutput();
  }
  abstract getReleaseValue(): number;
  prepareNotes(notes: number[]) {}
}

export class Connection {
  fromID: string;
  toID: string;
  constructor(fromID: string, toID: string) {
    this.fromID = fromID;
    this.toID = toID;
  }
}

export abstract class SynthEvent {}

export class ConnectionEvent extends SynthEvent {
  connection: Connection;
  constructor(connection: Connection) {
    super();
    this.connection = connection;
  }
}

export class DisconnectionEvent extends SynthEvent {
  connection: Connection;
  constructor(connection: Connection) {
    super();
    this.connection = connection;
  }
}

export class NoteStartEvent extends SynthEvent {
  note: number;
  velocity: number;
  constructor(note: number, velocity: number) {
    super();
    this.note = note;
    this.velocity = velocity;
  }
}

export class NoteStopEvent extends SynthEvent {
  note: number;
  constructor(note: number) {
    super();
    this.note = note;
  }
}

export class NodeCreateEvent<T> extends SynthEvent {
  type: "oscillator" | "filter" | "adsr" | "lfo";
  config: T;
  id: string;
  constructor(
    id: string,
    type: "oscillator" | "filter" | "adsr" | "lfo",
    config: T
  ) {
    super();
    this.id = id;
    this.type = type;
    this.config = config;
  }
}

export class NodeDeleteEvent extends SynthEvent {
  id: string;
  constructor(id: string) {
    super();
    this.id = id;
  }
}

export class ParameterChangeEvent<T> implements SynthEvent {
  constructor(
    public readonly id: string,
    public readonly parameter: string,
    public readonly value: T
  ) {}
}

export class ParameterUpdatedEvent<T> implements SynthEvent {
  constructor(
    public readonly id: string,
    public readonly parameter: string,
    public readonly value: T,
    public readonly oldValue: T
  ) {}
}

export class ModulationEvent implements SynthEvent {
  constructor(
    public readonly fromID: string,
    public readonly toID: string,
    public readonly parameter: string,
    public readonly amount: number
  ) {}
}

export class ModulationUpdatedEvent implements SynthEvent {
  constructor(
    public readonly fromID: string,
    public readonly toID: string,
    public readonly parameter: string,
    public readonly amount: number,
    public readonly oldAmount: number
  ) {}
}
