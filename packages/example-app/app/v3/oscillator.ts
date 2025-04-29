import { SynthEngine } from "./engine";
import {
  ConnectionEvent,
  DisconnectionEvent,
  NoteStartEvent,
  NoteStopEvent,
  SynthEvent,
  SynthNode,
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

export class SynthOscillator extends SynthNode {
  masterGain: GainNode;
  voices: OscillatorVoice[] = [];
  constructor(
    private _id: string,
    private engine: SynthEngine,
    private config: OscillatorConfig
  ) {
    super();
    // Create master gain node to which voices connect
    this.masterGain = this.engine.ctx.createGain();
  }

  get id(): string {
    return this._id;
  }

  get(): AudioNode | null {
    return this.masterGain;
  }

  inputADSR: SynthADSR | null = null;

  observe(event: SynthEvent): void {
    switch (event.constructor.name) {
      case "DisconnectionEvent": {
        const ev = event as DisconnectionEvent;
        if (
          ev.connection.toID === this.id &&
          ev.connection.fromID === this.inputADSR?.id
        ) {
          this.inputADSR = null;
        }
        const upstream = this.engine.nodes.get(
          ev.connection.fromID
        ) as SynthADSR | null;
        if (upstream) {
          this.voices.forEach((voice) => {
            upstream.get()?.disconnect(voice.gain.gain);
          });
        }
        break;
      }
      case "ConnectionEvent": {
        const ev = event as ConnectionEvent;
        const upstream = this.engine.nodes.get(ev.connection.fromID);
        if (upstream instanceof SynthADSR) {
          this.inputADSR = upstream;
          this.voices.forEach((voice) => {
            upstream.get()?.connect(voice.gain.gain);
          });
        } else {
          this.engine.sendEvent(new DisconnectionEvent(ev.connection));
        }
        break;
      }
      case "NoteStartEvent":
        // based on unisonVoices, create that many voices
        const targetVoices = this.config.unisonVoices ?? 1;
        const spread = this.config.unisonSpread ?? 0;
        const detune = this.config.detune ?? 0;
        const stereo = this.config.unisonStereo ?? 0;
        const phase = 0;
        const context = this.engine.ctx;

        for (let i = 0; i < targetVoices; i++) {
          // Calculate voice position in the spread
          const position =
            targetVoices == 1 ? 0 : (i / (targetVoices - 1)) * 2 - 1; // -1 to 1
          const voiceDetune = position * spread + detune;
          const pan = position * stereo;

          // Calculate random phase offset for this voice
          const voicePhase =
            phase !== 0
              ? phase + Math.random() * 0.1 // Add small random variation to specified phase
              : Math.random() * 2 * Math.PI; // Completely random phase

          // Create voice nodes
          const osc = context.createOscillator();
          const panner = context.createStereoPanner();
          const gain = context.createGain();
          const delay = context.createDelay();

          // Configure voice
          osc.type = this.config.type;
          osc.detune.value = voiceDetune;

          // Connect with phase delay
          osc.connect(delay);
          delay.delayTime.value =
            voicePhase / (2 * Math.PI * osc.frequency.value);
          delay.connect(panner);
          panner.pan.value = pan;
          panner.connect(gain);
          gain.connect(this.masterGain);

          if (this.inputADSR) {
            const adsrSignal = this.inputADSR
              .getNoteADSR((event as NoteStartEvent).note)
              .get();

            adsrSignal.connect(gain.gain);
          }

          // Store voice with its phase
          this.voices.push(
            new OscillatorVoice(osc, panner, gain, delay, voicePhase)
          );
        }
        this.voices.forEach((voice) => {
          voice.osc.start();
        });
        break;
      case "NoteStopEvent":
        this.voices.forEach((voice) => {
          if (this.inputADSR) {
            // use release time to schedule a disconnect
            const releaseTime = this.inputADSR.config.release * 1000;
            setTimeout(() => {
              voice.osc.stop();
            }, releaseTime);
          } else {
            voice.osc.stop();
          }
        });
        break;
    }
  }
}
