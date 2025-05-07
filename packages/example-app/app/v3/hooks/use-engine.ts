import { useEffect, useRef, useState } from "react";
import { ModulationEvent, SynthEngine } from "../engine";
import { Connection, ConnectionEvent, NodeCreateEvent } from "../base";

export function useEngine() {
  const engine = useRef<SynthEngine | null>(null);

  const [, bumpUI] = useState(0);
  useEffect(() => {
    engine.current = new SynthEngine();
    engine.current.observe("ParameterUpdatedEvent", (e) => {
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
        type: "sine",
        rate: 1,
        shape: 0.5,
        phase: 0,
        delay: 0,
        fade: 0,
      })
    );

    engine.current.sendEvent(new ModulationEvent("lfo1", "osc1", "level", 0.5));

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
