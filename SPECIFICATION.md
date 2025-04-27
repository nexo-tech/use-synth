# `useSynth` React Hook Specification

**Browser-Based Subtractive Synthesizer with Advanced Modulation**

---

## **1. Core Architecture**

### **1.1 Signal Flow**

```
[Oscillators] → [Filters] → [Effects]
       ↑           ↑           ↑
 [LFOs/Envelopes → Modulation Matrix]
```

### **1.2 Component Types**

```typescript
type ComponentType = "oscillator" | "filter" | "effect" | "lfo" | "envelope";
```

---

## **2. Configuration Schema**

### **2.1 Base Configuration**

```typescript
type UseSynthConfig = {
  components: {
    oscillators: Record<string, OscillatorConfig>;
    filters: Record<string, FilterConfig>;
    effects: Record<string, EffectConfig>;
    lfos: Record<string, LFOConfig>;
    envelopes: Record<string, EnvelopeConfig>;
  };
  routing: RoutingConnection[];
  modulation: ModulationEntry[];
  input: InputConfig;
  options?: SynthOptions;
};
```

### **2.2 Component Specifications**

**Oscillators**

```typescript
type OscillatorConfig = {
  type: "sine" | "square" | "sawtooth" | "triangle" | "noise" | "custom";
  frequency?: number; // Base frequency when unmodulated
  detune?: number; // Cents (±1200 = ±1 octave)
  phase?: number; // 0-360 degrees
  level?: number; // 0-100%
  unison?: {
    voices: number; // 2-8
    spread: number; // 0-100% detune spread
    stereo?: number; // 0-100% stereo pan spread
  };
  customWave?: Float32Array; // 512-sample waveform
};
```

**Filters**

```typescript
type FilterConfig = {
  type: BiquadFilterType | "moogladder";
  frequency?: number; // 20-20000 Hz
  Q?: number; // 0-10
  gain?: number; // -40 to +40 dB
  keytrack?: number; // 0-100% (Hz/V)
  envAmount?: number; // -100% to +100%
};
```

**Effects**

```typescript
type EffectConfig = {
  type: "delay" | "reverb" | "distortion" | "chorus";
  params: {
    // Effect-specific parameters
    delay?: { time: number; feedback: number };
    reverb?: { decay: number; wet: number };
    // ...
  };
};
```

**LFOs**

```typescript
type LFOConfig = {
  type: "sine" | "square" | "triangle" | "samplehold";
  rate: number; // 0.1-50 Hz or BPM (if sync)
  sync?: boolean; // Tempo sync
  shape?: number; // 0-1 wave shaping
  phase?: number; // 0-360 degrees
  delay?: number; // 0-5000ms before starting
  fade?: number; // 0-5000ms fade-in time
};
```

**Envelopes**

```typescript
type EnvelopeConfig = {
  attack: number; // 0-5000ms
  decay: number; // 0-5000ms
  sustain: number; // 0-100%
  release: number; // 50-10000ms
  curvature?: number; // -1 to +1 (ADSR shape)
};
```

---

## **3. Routing System**

### **3.1 Connection Definition**

```typescript
type RoutingConnection = {
  from: string; // Component ID or 'input'
  to: string; // Component ID or 'output'
  mix?: number; // 0-100% (dry/wet for parallel)
  gain?: number; // -60 to +20 dB
  pan?: number; // -100 (L) to +100 (R)
};
```

### **3.2 Routing Rules**

1. Multiple inputs allowed per destination
2. Feedback loops automatically detected and prevented
3. Implicit output bus if no final routing specified

---

## **4. Modulation Matrix**

### **4.1 Modulation Sources**

```typescript
type ModulationSource =
  | { type: "envelope"; id: string }
  | { type: "lfo"; id: string }
  | { type: "velocity" }
  | { type: "pitchbend" }
  | { type: "aftertouch" }
  | { type: "midicc"; number: number };
```

### **4.2 Modulation Targets**

```typescript
type ModulationTarget = {
  path: string; // e.g. 'oscillators.lead.detune'
  min?: number; // Normalization floor
  max?: number; // Normalization ceiling
  bipolar?: boolean; // Treat modulation as ±scale
};
```

### **4.3 Modulation Entry**

```typescript
type ModulationEntry = {
  source: ModulationSource;
  target: ModulationTarget;
  amount: number; // -100% to +100%
  via?: string; // Optional through-VCA
};
```

---

## **5. Input Handling**

### **5.1 Input Configuration**

```typescript
type InputConfig = {
  midi?: {
    channel?: number; // 1-16, 0=omni
    throttle?: number; // ms between updates
  };
  keyboard?: {
    mapping: Record<string, KeyMapping>;
    octave?: number; // Base octave
    velocity?: number; // 0-127 or 'dynamic'
  };
  mouse?: {
    quantize?: boolean; // Snap to semitones
    glide?: number; // Portamento time
  };
};

type KeyMapping = {
  note: number; // MIDI note (0-127)
  channel?: number; // 1-16
  bendRange?: number; // Semitones for pitchbend
};
```

---

## **6. Hook API**

### **6.1 Return Object**

```typescript
interface UseSynthReturn {
  // Core Controls
  triggerNote: (note: number | string, velocity?: number) => void;
  releaseNote: (note: number | string) => void;
  setParam: (path: string, value: number) => void;

  // Modulation
  addModulation: (entry: ModulationEntry) => void;
  clearModulation: (sourceId?: string) => void;

  // Routing
  connect: (from: string, to: string, options?: ConnectionOptions) => void;
  disconnect: (from: string, to?: string) => void;

  // MIDI
  midi: {
    inputs: MIDIInput[];
    outputs: MIDIOutput[];
    setChannel: (ch: number) => void;
  };

  // State
  getState: () => SynthState;
  loadPreset: (preset: UseSynthConfig) => void;
}
```

### **6.2 Advanced Methods**

```typescript
type ConnectionOptions = {
  gain?: number;
  pan?: number;
  type?: "audio" | "control";
};

type SynthState = {
  activeNotes: Map<number, NoteData>;
  paramCache: Map<string, number>;
  cpuUsage: number;
};

type NoteData = {
  frequency: number;
  velocity: number;
  startTime: number;
  endTime?: number;
  voiceNodes: AudioNode[];
};
```

---

## **7. Implementation Details**

### **7.1 Audio Engine**

1. **Voice Allocation**: 32-voice polyphony with steal algorithm
2. **Signal Chain**:  
   `Osc → Filter → Effects → Output`
   - Sidechain modulation bus
3. **Optimizations**:
   - WebAudio Worklets for DSP
   - WASM filters for CPU-intensive operations
   - Parameter smoothing on all controls

### **7.2 Modulation Engine**

1. **Resolution**: 128-sample block processing
2. **Normalization**: Auto-range detection with manual override
3. **Matrix Processing**:
   ```js
   value = baseValue + Σ(modulationAmount * (sourceValue * targetRange));
   ```

### **7.3 MIDI Implementation**

- Full MIDI 2.0 support with MPE capabilities
- NRPN and RPN parameter mapping
- SysEx preset loading support

---

## **8. Complete Example**

```jsx
const SynthPad = () => {
  const { triggerNote } = useSynth({
    components: {
      oscillators: {
        main: {
          type: "saw",
          detune: -7,
          unison: { voices: 4, spread: 25 },
        },
      },
      filters: {
        lpf: {
          type: "lowpass",
          frequency: 2000,
          Q: 0.7,
          envAmount: 0.5,
        },
      },
      lfos: {
        vibrato: {
          type: "sine",
          rate: 5,
          sync: true,
        },
      },
      envelopes: {
        mainEnv: {
          attack: 0.1,
          decay: 0.3,
          sustain: 0.8,
          release: 0.5,
        },
      },
    },
    routing: [
      { from: "main", to: "lpf" },
      { from: "lpf", to: "output" },
    ],
    modulation: [
      {
        source: { type: "lfo", id: "vibrato" },
        target: { path: "oscillators.main.detune" },
        amount: +35,
      },
      {
        source: { type: "envelope", id: "mainEnv" },
        target: {
          path: "filters.lpf.frequency",
          min: 500,
          max: 5000,
        },
        amount: -60,
      },
    ],
    input: {
      keyboard: {
        mapping: {
          KeyA: { note: 60 },
          KeyW: { note: 61 },
          // Full piano layout
        },
        velocity: "dynamic",
      },
    },
  });

  return (
    <div className="synth-interface">
      <VirtualKeyboard octave={4} glowOnActive pitchBendRange={2} />
      <ModulationMatrixEditor />
    </div>
  );
};
```

---

## **9. Constraints & Browser Support**

### **9.1 Requirements**

- Web Audio API
- React 18+
- Optional: Web MIDI API for hardware integration

### **9.2 Limits**

1. **Polyphony**: Configurable (default 32 voices)
2. **CPU Budget**: Auto-voice reduction when exceeding 85% CPU
3. **Latency**: Fixed 128 samples (~3ms at 44.1kHz)

### **9.3 Browser Notes**

- Safari: Requires user gesture for audio initiation
- Firefox: WebMIDI behind flag
- Mobile: Limited to 6-voice polyphony
