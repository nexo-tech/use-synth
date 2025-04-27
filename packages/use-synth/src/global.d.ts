declare namespace WebMidi {
  interface MIDIAccess extends EventTarget {
    inputs: Map<string, MIDIInput>;
    outputs: Map<string, MIDIOutput>;
    sysexEnabled: boolean;
    onstatechange: ((this: MIDIAccess, ev: MIDIConnectionEvent) => any) | null;
  }
  
  interface MIDIConnectionEvent extends Event {
    port: MIDIPort;
  }
  
  interface MIDIPort extends EventTarget {
    id: string;
    manufacturer?: string;
    name?: string;
    type: 'input' | 'output';
    version?: string;
    state: 'connected' | 'disconnected';
    connection: 'open' | 'closed' | 'pending';
    onstatechange: ((this: MIDIPort, ev: MIDIConnectionEvent) => any) | null;
  }
  
  interface MIDIInput extends MIDIPort {
    type: 'input';
    onmidimessage: ((this: MIDIInput, ev: MIDIMessageEvent) => any) | null;
  }
  
  interface MIDIOutput extends MIDIPort {
    type: 'output';
    send(data: Uint8Array | number[], timestamp?: number): void;
    clear(): void;
  }
  
  interface MIDIMessageEvent extends Event {
    data: Uint8Array;
  }
}

interface Navigator {
  requestMIDIAccess(options?: { sysex: boolean }): Promise<WebMidi.MIDIAccess>;
} 