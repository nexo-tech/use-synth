export abstract class SynthNode {
  abstract get id(): string;
  abstract observe(event: SynthEvent): void;
  abstract get(): AudioNode | null;
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
