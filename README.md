# use-synth 🎹

A modern, modular synthesizer framework built with TypeScript and Web Audio API.

> ⚠️ **UNDER HEAVY CONSTRUCTION** ⚠️
>
> This project is currently in active development. Features, APIs, and documentation are subject to change. We're working hard to create a stable and feature-rich synthesizer framework.

## Features

### Current Implementation

- **Modular Architecture**: Build your own synthesizer by connecting different modules
- **Oscillator Module**:
  - Multiple waveform types (sine, square, sawtooth, triangle)
  - Unison with configurable:
    - Number of voices (1-8)
    - Detune spread (0-100 cents)
    - Stereo spread (0-100%)
  - Real-time parameter modulation
  - Pitch control (-24 to +24 semitones)
  - Level control
- **ADSR Envelope**:
  - Attack, Decay, Sustain, Release controls
  - Per-note envelope instances
  - Smooth parameter changes

### In Development

- [ ] Filter module
- [ ] LFO module
- [ ] Effects (delay, reverb, etc.)
- [ ] MIDI input/output
- [ ] Preset system
- [ ] More oscillator types
- [ ] Modulation matrix
- [ ] Performance optimizations

## Getting Started

### Prerequisites

- Node.js 18+
- Package manager like bun

### Installation

```bash
git clone https://github.com/yourusername/useSynth.git
cd useSynth
bun install
```

### Basic Usage

```typescript
import { SynthEngine, SynthOscillator } from "useSynth";

// Create a new synth engine
const engine = new SynthEngine();

// Create an oscillator
const osc = new SynthOscillator(engine, {
  type: "sawtooth",
  unisonVoices: 3,
  unisonSpread: 20,
  unisonStereo: 50,
  pitch: 0,
  level: 1.0,
});

// Connect to audio output
osc.get()?.connect(engine.ctx.destination);

// Play a note
engine.sendEvent(new NoteStartEvent(60)); // Middle C
```

## Architecture

### Core Components

- **SynthEngine**: Central hub for audio processing and event handling
- **SynthNode**: Base class for all audio modules
- **Event System**: Handles note events and parameter changes
- **Audio Graph**: Manages connections between modules

### Module System

Each module in useSynth:

- Implements the SynthNode interface
- Handles its own audio processing
- Responds to parameter changes
- Manages its own state and resources

## Contributing

We welcome contributions! Here's how you can help:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

Please note that while we're in heavy development:

- APIs may change frequently
- Documentation might be incomplete
- Some features might be experimental

## Roadmap

### Short Term

- [ ] Complete basic module implementations
- [ ] Add comprehensive tests
- [ ] Improve documentation
- [ ] Add example projects

### Long Term

- [ ] WebAssembly optimizations
- [ ] Advanced modulation system
- [ ] Preset management
- [ ] DAW integration
- [ ] Web MIDI support

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Web Audio API team
- All contributors and supporters
- The open source community
