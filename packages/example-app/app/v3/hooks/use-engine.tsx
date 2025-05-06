import { useEffect, useRef, useState } from "react";
import { SynthEngine } from "../engine";
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
      new ConnectionEvent(new Connection("adsr1", "osc1"))
    );
    engine.current.sendEvent(
      new ConnectionEvent(new Connection("osc1", "output"))
    );

    // Initialize audio context
    engine.current.ctx.resume();
    bumpUI((prev) => prev + 1);
  }, []);

  return engine;
}
