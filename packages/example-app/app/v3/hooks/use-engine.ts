import { useEffect, useRef, useState } from "react";
import { SynthEngine } from "../engine";
import {
  Connection,
  ConnectionEvent,
  ModulationEvent,
  NodeCreateEvent,
} from "../base";

export function useEngine() {
  const engine = useRef<SynthEngine | null>(null);

  const [, bumpUI] = useState(0);
  useEffect(() => {
    engine.current = new SynthEngine();
    engine.current.observe("ParameterUpdatedEvent", (e) => {
      bumpUI((prev) => prev + 1);
    });
    engine.current.observe("ModulationUpdatedEvent", (e) => {
      bumpUI((prev) => prev + 1);
    });

    engine.current.sendEvent(
      new NodeCreateEvent("osc1", "oscillator", {
        type: "sawtooth",
        detune: -7,
        level: 0.5,
        unisonVoices: 5,
        unisonSpread: 25,
        unisonStereo: 50,
      })
    );

    engine.current.sendEvent(
      new NodeCreateEvent("adsr1", "adsr", {
        attack: 0.1,
        decay: 0.4,
        sustain: 0.5,
        release: 0.2,
      })
    );

    // Create a second ADSR for filter modulation
    engine.current.sendEvent(
      new NodeCreateEvent("adsr2", "adsr", {
        attack: 0.2,
        decay: 0.3,
        sustain: 0.2,
        release: 0.4,
      })
    );

    engine.current.sendEvent(
      new NodeCreateEvent("fil1", "filter", {
        type: "lowpass",
        frequency: 1000,
        q: 1,
      })
    );
    // Create a lfo
    engine.current.sendEvent(
      new NodeCreateEvent("lfo1", "lfo", {
        type: "square",
        rate: 5,
        shape: 0.5,
        phase: 0,
        delay: 0,
        fade: 0,
      })
    );

    engine.current.sendEvent(new ModulationEvent("lfo1", "osc1", "pitch", 1));
    // Connect ADSR2 to modulate filter frequency
    engine.current.sendEvent(
      new ModulationEvent("adsr2", "fil1", "frequency", 1)
    );

    engine.current.sendEvent(
      new ConnectionEvent(new Connection("adsr1", "osc1"))
    );
    engine.current.sendEvent(
      new ConnectionEvent(new Connection("osc1", "fil1"))
    );

    engine.current.sendEvent(
      new ConnectionEvent(new Connection("fil1", "output"))
    );

    engine.current.ctx.resume();
    bumpUI((prev) => prev + 1);
  }, []);

  return engine;
}
