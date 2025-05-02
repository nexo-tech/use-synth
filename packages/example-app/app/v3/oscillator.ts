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
} from "./base";
import { SynthADSR } from "./adsr";

export interface OscillatorConfig {
  type: "sine" | "square" | "sawtooth" | "triangle";
  detune?: number;
  pitch?: number;
  level?: number;
  unisonVoices?: number;
  unisonSpread?: number;
  unisonStereo?: number;
}

class OscillatorVoice {
  constructor(
    public osc: OscillatorNode,
    public panner: StereoPannerNode,
    public gain: GainNode,
    public delay: DelayNode,
    public phase: number
  ) {}
}

class OscillatorNote {
  private voices: OscillatorVoice[] = [];
  private levelGain: GainNode;
  private adsrGain: GainNode;

  constructor(
    private engine: SynthEngine,
    private config: OscillatorConfig,
    private note: number,
    private inputADSR: SynthADSR | null
  ) {
    this.levelGain = engine.ctx.createGain();
    this.adsrGain = engine.ctx.createGain();
    this.levelGain.connect(this.adsrGain);
    this.createVoices();
  }

  private createVoices() {
    const targetVoices = this.config.unisonVoices ?? 1;
    const spread = this.config.unisonSpread ?? 0;
    const detune = this.config.detune ?? 0;
    const stereo = this.config.unisonStereo ?? 0;
    const phase = 0;
    const context = this.engine.ctx;

    for (let i = 0; i < targetVoices; i++) {
      const position = targetVoices == 1 ? 0 : (i / (targetVoices - 1)) * 2 - 1;
      const voiceDetune = position * spread + detune;
      const pan = position * stereo;
      const voicePhase =
        phase !== 0 ? phase + Math.random() * 0.1 : Math.random() * 2 * Math.PI;

      const osc = context.createOscillator();
      const panner = context.createStereoPanner();
      const gain = context.createGain();
      const delay = context.createDelay();

      osc.type = this.config.type;
      osc.detune.value = voiceDetune;
      const baseFrequency = 440 * Math.pow(2, (this.note - 69) / 12);
      const pitch = this.config.pitch ?? 0;
      osc.frequency.value = baseFrequency * Math.pow(2, pitch / 12);

      osc.connect(delay);
      delay.delayTime.value = voicePhase / (2 * Math.PI * osc.frequency.value);
      delay.connect(panner);
      panner.pan.value = pan;
      panner.connect(gain);
      gain.connect(this.levelGain);

      this.voices.push(
        new OscillatorVoice(osc, panner, gain, delay, voicePhase)
      );
    }

    // Set level
    this.levelGain.gain.value = this.config.level ?? 1.0;

    // Connect ADSR if available
    if (this.inputADSR) {
      const adsrSignal = this.inputADSR.getNoteADSR(this.note).get();
      this.adsrGain.gain.value = 0;
      adsrSignal.connect(this.adsrGain.gain);
    }
  }

  start() {
    this.voices.forEach((voice) => voice.osc.start());
  }

  stop(immediate: boolean = false) {
    this.voices.forEach((voice) => {
      if (this.inputADSR && !immediate) {
        const releaseTime = this.inputADSR.config.release * 1000;
        setTimeout(() => {
          voice.osc.stop();
          voice.osc.disconnect();
        }, releaseTime);
      } else {
        voice.osc.stop();
        voice.osc.disconnect();
      }
    });
  }

  disconnect() {
    this.voices.forEach((voice) => voice.osc.disconnect());
    this.levelGain.disconnect();
    this.adsrGain.disconnect();
  }

  getOutput(): AudioNode {
    return this.adsrGain;
  }

  updateLevel(level: number) {
    this.levelGain.gain.value = level;
  }

  updatePitch(pitch: number) {
    // Update frequency based on pitch offset
    const baseFrequency = 440 * Math.pow(2, (this.note - 69) / 12);
    const newFrequency = baseFrequency * Math.pow(2, pitch / 12);
    this.voices.forEach((voice) => {
      voice.osc.frequency.value = newFrequency;
    });
  }

  updateDetune(detune: number) {
    // Update detune in cents (100 cents = 1 semitone)
    const targetVoices = this.config.unisonVoices ?? 1;
    const spread = this.config.unisonSpread ?? 0;

    this.voices.forEach((voice, i) => {
      const position = targetVoices == 1 ? 0 : (i / (targetVoices - 1)) * 2 - 1;
      const voiceDetune = position * spread + detune;
      voice.osc.detune.value = voiceDetune;
    });
  }

  updateStereo(stereo: number) {
    // Update stereo spread
    const targetVoices = this.config.unisonVoices ?? 1;
    const spread = this.config.unisonSpread ?? 0;

    this.voices.forEach((voice, i) => {
      const position = targetVoices == 1 ? 0 : (i / (targetVoices - 1)) * 2 - 1;
      // Convert stereo from 0-100 range to -1 to 1 range
      const voiceStereo = position * (stereo / 100);
      const panner = voice.panner;
      panner.pan.value = voiceStereo;
    });
  }

  updateType(type: OscillatorConfig["type"]) {
    // Update wave type for all voices
    this.voices.forEach((voice) => {
      voice.osc.type = type;
    });
  }
}

export class SynthOscillator extends SynthNode {
  private masterGain: GainNode;
  private notes: Map<number, OscillatorNote> = new Map();
  private inputADSR: SynthADSR | null = null;

  getConfig(): OscillatorConfig {
    return this.config;
  }

  constructor(
    public readonly id: string,
    private engine: SynthEngine,
    private config: OscillatorConfig
  ) {
    super();
    this.masterGain = engine.ctx.createGain();
  }

  get(): AudioNode | null {
    return this.masterGain;
  }

  private getNote(note: number): OscillatorNote {
    let oscNote = this.notes.get(note);
    if (!oscNote) {
      oscNote = new OscillatorNote(
        this.engine,
        this.config,
        note,
        this.inputADSR
      );
      this.notes.set(note, oscNote);
      oscNote.getOutput().connect(this.masterGain);
    }
    return oscNote;
  }

  observe(event: SynthEvent): void {
    switch (event.constructor.name) {
      case "ParameterChangeEvent": {
        const ev = event as ParameterChangeEvent<any>;
        if (ev.id !== this.id) return;

        if (ev.parameter === "level") {
          const oldValue = this.config.level ?? 1.0;
          this.config.level = ev.value;

          // Update all notes with new level
          this.notes.forEach((note) => {
            note.updateLevel(ev.value);
          });

          // Emit parameter updated event
          this.engine.sendEvent(
            new ParameterUpdatedEvent(this.id, "level", ev.value, oldValue)
          );
        } else if (ev.parameter === "pitch") {
          // Clamp pitch between -24 and +24 semitones
          const newPitch = Math.max(-24, Math.min(24, ev.value));
          const oldValue = this.config.pitch ?? 0;
          this.config.pitch = newPitch;

          // Update all notes with new pitch
          this.notes.forEach((note) => {
            note.updatePitch(newPitch);
          });

          // Emit parameter updated event
          this.engine.sendEvent(
            new ParameterUpdatedEvent(this.id, "pitch", newPitch, oldValue)
          );
        } else if (ev.parameter === "detune") {
          // Clamp detune between -100 and +100 cents
          const newDetune = Math.max(-100, Math.min(100, ev.value));
          const oldValue = this.config.detune ?? 0;
          this.config.detune = newDetune;

          // Update all notes with new detune
          this.notes.forEach((note) => {
            note.updateDetune(newDetune);
          });

          // Emit parameter updated event
          this.engine.sendEvent(
            new ParameterUpdatedEvent(this.id, "detune", newDetune, oldValue)
          );
        } else if (ev.parameter === "unisonVoices") {
          // Clamp voices between 1 and 8
          const newVoices = Math.max(1, Math.min(8, Math.round(ev.value)));
          const oldValue = this.config.unisonVoices ?? 1;
          this.config.unisonVoices = newVoices;

          // Recreate all notes with new voice count
          this.notes.forEach((note, noteNumber) => {
            note.stop(true);
            const newNote = new OscillatorNote(
              this.engine,
              this.config,
              noteNumber,
              this.inputADSR
            );
            this.notes.set(noteNumber, newNote);
            newNote.getOutput().connect(this.masterGain);
            if (this.notes.has(noteNumber)) {
              newNote.start();
            }
          });

          // Emit parameter updated event
          this.engine.sendEvent(
            new ParameterUpdatedEvent(
              this.id,
              "unisonVoices",
              newVoices,
              oldValue
            )
          );
        } else if (ev.parameter === "unisonSpread") {
          // Clamp spread between 0 and 100 cents
          const newSpread = Math.max(0, Math.min(100, ev.value));
          const oldValue = this.config.unisonSpread ?? 0;
          this.config.unisonSpread = newSpread;

          // Update all notes with new spread
          this.notes.forEach((note) => {
            note.updateDetune(this.config.detune ?? 0);
          });

          // Emit parameter updated event
          this.engine.sendEvent(
            new ParameterUpdatedEvent(
              this.id,
              "unisonSpread",
              newSpread,
              oldValue
            )
          );
        } else if (ev.parameter === "unisonStereo") {
          // Clamp stereo between 0 and 100
          const newStereo = Math.max(0, Math.min(100, ev.value));
          const oldValue = this.config.unisonStereo ?? 0;
          this.config.unisonStereo = newStereo;

          // Update all notes with new stereo spread
          this.notes.forEach((note) => {
            note.updateStereo(newStereo);
          });

          // Emit parameter updated event
          this.engine.sendEvent(
            new ParameterUpdatedEvent(
              this.id,
              "unisonStereo",
              newStereo,
              oldValue
            )
          );
        } else if (ev.parameter === "type") {
          const oldValue = this.config.type;
          this.config.type = ev.value;

          // Update all notes with new wave type
          this.notes.forEach((note) => {
            note.updateType(this.config.type);
          });

          // Emit parameter updated event
          this.engine.sendEvent(
            new ParameterUpdatedEvent(this.id, "type", ev.value, oldValue)
          );
        }
        break;
      }
      case "ConnectionEvent": {
        const ev = event as ConnectionEvent;
        const upstream = this.engine.nodes.get(ev.connection.fromID);
        if (upstream instanceof SynthADSR) {
          this.inputADSR = upstream;
          // Recreate all notes with new ADSR
          this.notes.forEach((note, noteNumber) => {
            note.stop();
            const newNote = new OscillatorNote(
              this.engine,
              this.config,
              noteNumber,
              this.inputADSR
            );
            this.notes.set(noteNumber, newNote);
            newNote.getOutput().connect(this.masterGain);
            if (this.notes.has(noteNumber)) {
              newNote.start();
            }
          });
        } else {
          this.engine.sendEvent(new DisconnectionEvent(ev.connection));
        }
        break;
      }
      case "DisconnectionEvent": {
        const ev = event as DisconnectionEvent;
        if (
          ev.connection.toID === this.id &&
          ev.connection.fromID === this.inputADSR?.id
        ) {
          this.inputADSR = null;
          // Recreate all notes without ADSR
          this.notes.forEach((note, noteNumber) => {
            note.stop();
            const newNote = new OscillatorNote(
              this.engine,
              this.config,
              noteNumber,
              null
            );
            this.notes.set(noteNumber, newNote);
            newNote.getOutput().connect(this.masterGain);
            if (this.notes.has(noteNumber)) {
              newNote.start();
            }
          });
        }
        break;
      }
      case "NoteStartEvent": {
        const ev = event as NoteStartEvent;
        const note = this.getNote(ev.note);
        note.start();
        break;
      }
      case "NoteStopEvent": {
        const ev = event as NoteStopEvent;
        const note = this.notes.get(ev.note);
        if (note) {
          this.notes.delete(ev.note);
          note.stop();
        }
        break;
      }
    }
  }
}
