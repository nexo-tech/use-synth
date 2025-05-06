"use client";

import Osc from "../components/Osc";
import { ParameterChangeEvent } from "./base";
import { useEngine } from "./hooks/use-engine";
import { useKeyboardNotes } from "./hooks/use-keyboard-notes";

export default function OscillatorPage() {
  const engine = useEngine();
  const { octave } = useKeyboardNotes(engine);

  const oscillators = engine.current
    ?.getOscillators()
    .map((x) => [x.id, x.getConfig()] as const);

  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-gray-950 text-white">
      <div>
        {oscillators?.map((x) => (
          <div key={x[0]}>
            <Osc
              config={x[1]}
              onConfigChange={(c) => {
                for (let k in c) {
                  const v = (c as Record<string, any>)[k];
                  engine.current?.sendEvent(
                    new ParameterChangeEvent<any>(x[0], k, v)
                  );
                }
              }}
            />
          </div>
        ))}
        <div className="mb-4">
          <p>Current octave: {octave}</p>
          <p>White keys: A-S-D-F-G-H-J-K</p>
          <p>Black keys: W-E-R-T-Y-U</p>
          <p>Use Z/X to change octave</p>
        </div>
      </div>
    </main>
  );
}
