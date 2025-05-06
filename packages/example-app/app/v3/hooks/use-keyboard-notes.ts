import { RefObject, useState, useRef, useEffect } from "react";
import { NoteStartEvent, NoteStopEvent } from "../base";
import { SynthEngine } from "../engine";

const keyToNote: Record<string, number> = {
  a: 60, // C4
  w: 61, // C#4
  s: 62, // D4
  e: 63, // D#4
  d: 64, // E4
  f: 65, // F4
  t: 66, // F#4
  g: 67, // G4
  y: 68, // G#4
  h: 69, // A4
  u: 70, // A#4
  j: 71, // B4
  k: 72, // C5
};

export function useKeyboardNotes(engine: RefObject<SynthEngine | null>) {
  const [octave, setOctave] = useState(4);
  const activeNotes = useRef(new Set<string>());
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (!engine.current) {
        return;
      }
      if (e.repeat) {
        return;
      }

      const key = e.key.toLowerCase();

      // Handle octave changes
      if (key === "z" && octave > 0) {
        setOctave((prev) => prev - 1);
        return;
      }
      if (key === "x" && octave < 8) {
        setOctave((prev) => prev + 1);
        return;
      }

      // Handle note playing
      const baseNote = keyToNote[key];
      if (baseNote !== undefined && !activeNotes.current.has(key)) {
        const note = baseNote + (octave - 4) * 12;
        activeNotes.current.add(key);
        try {
          await engine.current.ctx.resume();
          engine.current.sendEvent(new NoteStartEvent(note, 127));
        } catch (error) {
          console.error("Error playing note:", error);
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
          console.error("Error stopping note:", error);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [octave]);
  return { octave };
}
