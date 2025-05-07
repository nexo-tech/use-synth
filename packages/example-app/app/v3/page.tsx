"use client";

import { Envelope } from "../components/Envelope";
import Osc from "../components/Osc";
import Filter from "../components/Filter";
import LFO from "../components/LFO";
import ModulationMatrix from "../components/ModulationMatrix";
import { EnvelopeConfig } from "../page";
import {
  availableModulationTargets,
  ParameterChangeEvent,
  NodeCreateEvent,
  NodeDeleteEvent,
} from "./base";
import { useEngine } from "./hooks/use-engine";
import { useKeyboardNotes } from "./hooks/use-keyboard-notes";
import Oscilloscope from "../components/Oscilloscope";
import { useCallback, useState } from "react";

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

  const [lastTouchedModulateableParam, setLastTouchedModulateableParam] =
    useState<{
      id: string;
      parameter: string;
    } | null>(null);

  const setLastTouchedModulateableParamChecked = useCallback(
    (param: { componentType: string; id: string; parameter: string }) => {
      for (const target of availableModulationTargets) {
        if (
          target.componentType === param.componentType &&
          target.parameter === param.parameter
        ) {
          setLastTouchedModulateableParam(param);
          return;
        }
      }
    },
    []
  );

  const handleCreateLFO = useCallback(() => {
    if (!engine.current) return;
    const id = `lfo${engine.current.getLFOs().length + 1}`;
    engine.current.sendEvent(
      new NodeCreateEvent(id, "lfo", {
        type: "sine",
        rate: 5,
        sync: false,
        shape: 0.5,
        phase: 0,
      })
    );
  }, [engine]);

  const handleCreateModEnv = useCallback(() => {
    if (!engine.current) return;
    const id = `env${engine.current.getEnvelopes().length + 1}`;
    engine.current.sendEvent(
      new NodeCreateEvent(id, "adsr", {
        attack: 0.1,
        decay: 0.1,
        sustain: 0.5,
        release: 0.1,
      })
    );
  }, [engine]);

  const handleRemoveSource = useCallback(
    (sourceId: string) => {
      if (!engine.current) return;
      engine.current.sendEvent(new NodeDeleteEvent(sourceId));
    },
    [engine]
  );

  const handleSourceClick = useCallback((sourceId: string) => {
    // You can implement source selection/editing here if needed
    console.log("Source clicked:", sourceId);
  }, []);

  // Create modulation sources from LFOs and envelopes
  const modulationSources = [
    ...(lfos?.map(([id, config]) => ({
      id,
      type: "lfo" as const,
      name: `LFO ${id}`,
    })) ?? []),
    ...(envelopes?.map(([id, config]) => ({
      id,
      type: "env" as const,
      name: `ENV ${id}`,
    })) ?? []),
  ];

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
                  setLastTouchedModulateableParamChecked({
                    componentType: "osc",
                    id: x[0],
                    parameter: k,
                  });
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
                  engine.current?.sendEvent(ev);
                  setLastTouchedModulateableParamChecked({
                    componentType: "filter",
                    id: x[0],
                    parameter: k,
                  });
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

        {engine.current && (
          <ModulationMatrix
            activeModulations={engine.current.modulations.getAllModulations()}
            modulationSources={modulationSources}
            lastTouchedParam={lastTouchedModulateableParam}
            onModulationChange={(ev) => {
              engine.current?.sendEvent(ev);
            }}
          />
        )}

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
