"use client"

import Osc from "../components/Osc";
import { ParameterChangeEvent, Connection, ConnectionEvent, NodeCreateEvent, NoteStartEvent, NoteStopEvent } from "./base";
import { SynthEngine } from "./engine";
import { useEffect, useRef, useState } from "react";

const keyToNote: Record<string, number> = {
  'a': 60, // C4
  'w': 61, // C#4
  's': 62, // D4
  'e': 63, // D#4
  'd': 64, // E4
  'f': 65, // F4
  't': 66, // F#4
  'g': 67, // G4
  'y': 68, // G#4
  'h': 69, // A4
  'u': 70, // A#4
  'j': 71, // B4
  'k': 72, // C5
};

export default function OscillatorPage() {
  const engine = useRef<SynthEngine | null>(null);
  const [octave, setOctave] = useState(4);
  const activeNotes = useRef(new Set<string>());
  const oscillators = engine.current?.getOscillators().map(x => [x.id, x.getConfig()] as const);
  const [, bumpUI] = useState(0);
  console.log(engine.current, oscillators)

  useEffect(() => {
    engine.current = new SynthEngine();
    engine.current.observe("ParameterUpdatedEvent", (e) => {
      bumpUI(prev => prev + 1);
    });

    engine.current.sendEvent(new NodeCreateEvent("osc1", "oscillator", {
      type: "sawtooth",
      detune: -7,
      level: 0.5,
      unisonVoices: 5,
      unisonSpread: 25,
      unisonStereo: 50,
    }));

    engine.current.sendEvent(new NodeCreateEvent("adsr1", "adsr", {
      attack: 0.1,
      decay: 0.4,
      sustain: 0.5,
      release: 0.2,
    }));

    engine.current.sendEvent(new ConnectionEvent(new Connection("adsr1", "osc1")));
    engine.current.sendEvent(new ConnectionEvent(new Connection("osc1", "output")));

    // Initialize audio context
    engine.current.ctx.resume();
    bumpUI(prev => prev + 1);

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (!engine.current) {
        return;
      }
      if (e.repeat) {
        return;
      }

      const key = e.key.toLowerCase();

      // Handle octave changes
      if (key === 'z' && octave > 0) {
        setOctave(prev => prev - 1);
        return;
      }
      if (key === 'x' && octave < 8) {
        setOctave(prev => prev + 1);
        return;
      }

      // Handle note playing
      const baseNote = keyToNote[key];
      if (baseNote !== undefined && !activeNotes.current.has(key)) {
        const note = baseNote + (octave - 4) * 12;
        activeNotes.current.add(key);
        try {
          console.log("playing note", note);
          await engine.current.ctx.resume();
          engine.current.sendEvent(new NoteStartEvent(note, 127));
        } catch (error) {
          console.error('Error playing note:', error);
        }
      }
    };

    const handleKeyUp = async (e: KeyboardEvent) => {
      if (!engine.current) return;

      const key = e.key.toLowerCase();
      const baseNote = keyToNote[key];
      if (baseNote !== undefined && activeNotes.current.has(key)) {
        const note = baseNote + (octave - 4) * 12;
        activeNotes.current.delete(key);
        try {
          engine.current.sendEvent(new NoteStopEvent(note));
        } catch (error) {
          console.error('Error stopping note:', error);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [octave]);

  return (
    <div>
      {oscillators?.map(x => <div key={x[0]}>
        <Osc config={x[1]} onConfigChange={(c) => {
          for (let k in c) {
            const v = (c as Record<string, any>)[k];
            engine.current?.sendEvent(new ParameterChangeEvent<any>(x[0], k, v));
          }
        }} />
      </div>)}
      <div className="mb-4">
        <p>Current octave: {octave}</p>
        <p>White keys: A-S-D-F-G-H-J-K</p>
        <p>Black keys: W-E-R-T-Y-U</p>
        <p>Use Z/X to change octave</p>
      </div>
    </div>
  );
}