abstract class SynthNode {
  abstract get id(): string;
  abstract connect(node: SynthNode): void;
  abstract disconnect(): void;
  abstract observe(event: SynthEvent): void;
}

abstract class SynthEvent {}

class SynthEngine {
  nodes: Map<string, SynthNode> = new Map();

  sendEvent(event: SynthEvent) {
    console.log(event);
  }
}
