"use client";

import { Envelope } from "../components/Envelope";
import Osc from "../components/Osc";
import Filter from "../components/Filter";
import LFO from "../components/LFO";
import { EnvelopeConfig } from "../page";
import { ParameterChangeEvent } from "./base";
import { useEngine } from "./hooks/use-engine";
import { useKeyboardNotes } from "./hooks/use-keyboard-notes";
import Oscilloscope from "../components/Oscilloscope";
import { useEffect, useState } from "react";

export default function OscillatorPage() {
  const engine = useEngine();
  const { octave } = useKeyboardNotes(engine);

  const oscillators = engine.current
    ?.getOscillators()
    .map((x) => [x.id, x.getConfig()] as const);
  const envelopes = engine.current
    ?.getEnvelopes()
    .map((x) => [x.id, x.getConfig()] as const);
  const filters = engine.current
    ?.getFilters()
    .map((x) => [x.id, x.getConfig()] as const);
  const lfos = engine.current
    ?.getLFOs()
    .map((x) => [x.id, x.getConfig()] as const);
  const lfo = (() => {
    try {
      // @ts-ignore
      if (window.modg) {
        // @ts-ignore
        return window.modg;
      }
      const x = engine.current?.getLFOs()?.[0]?.getNodeOutput();
      console.log({ x });
      if (x instanceof Map) {
        return Array.from(x.values())[0];
      } else if (x instanceof AudioNode) {
        return x;
      }
      return null;
    } catch {
      return null;
    }
  })();
  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-gray-950 text-white">
      <div className="flex flex-col gap-2">
        {oscillators?.map((x) => (
          <div key={x[0]}>
            <Osc
              config={x[1]}
              onConfigChange={(c) => {
                for (let k in c) {
                  const v = (c as Record<string, any>)[k];
                  const ev = new ParameterChangeEvent<any>(x[0], k, v);
                  engine.current?.sendEvent(ev);
                }
              }}
            />
          </div>
        ))}

        {filters?.map((x) => (
          <div key={x[0]}>
            <Filter
              config={x[1]}
              onConfigChange={(c) => {
                for (let k in c) {
                  const v = (c as Record<string, any>)[k];
                  const ev = new ParameterChangeEvent<any>(x[0], k, v);
                  console.log("sending event", ev);
                  engine.current?.sendEvent(ev);
                }
              }}
            />
          </div>
        ))}

        {envelopes?.map((x) => (
          <div key={x[0]}>
            <Envelope
              config={x[1]}
              onConfigChange={function (c: Partial<EnvelopeConfig>): void {
                for (let k in c) {
                  const v = (c as Record<string, any>)[k];
                  const ev = new ParameterChangeEvent<any>(x[0], k, v);
                  engine.current?.sendEvent(ev);
                }
              }}
            />
          </div>
        ))}

        {lfos?.map((x) => (
          <div key={x[0]}>
            <LFO
              config={x[1]}
              onConfigChange={(c) => {
                for (let k in c) {
                  const v = (c as Record<string, any>)[k];
                  const ev = new ParameterChangeEvent<any>(x[0], k, v);
                  engine.current?.sendEvent(ev);
                }
              }}
            />
          </div>
        ))}
        {lfo && <Oscilloscope audioNode={lfo} width={400} height={200} />}

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
