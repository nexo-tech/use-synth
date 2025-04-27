import React, { useState, useEffect, useCallback } from 'react';
import type { VirtualKeyboardProps } from '../types';

/**
 * A virtual piano keyboard component for triggering synthesizer notes
 */
export const VirtualKeyboard: React.FC<VirtualKeyboardProps> = ({
  octave = 4,
  glowOnActive = true,
//   pitchBendRange = 2,
  onNoteOn,
  onNoteOff,
  className = '',
  children
}) => {
  const [activeNotes, setActiveNotes] = useState<number[]>([]);
  const [mouseDrag, setMouseDrag] = useState(false);
  
  // Keyboard key mapping to MIDI notes
  const keyboardMap: Record<string, number> = {
    KeyA: 60, // C4
    KeyW: 61, // C#4
    KeyS: 62, // D4
    KeyE: 63, // D#4
    KeyD: 64, // E4
    KeyF: 65, // F4
    KeyT: 66, // F#4
    KeyG: 67, // G4
    KeyY: 68, // G#4
    KeyH: 69, // A4
    KeyU: 70, // A#4
    KeyJ: 71, // B4
    KeyK: 72, // C5
  };
  
  // Handle keyboard key down
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.repeat) return; // Prevent key repeat
    
    const note = keyboardMap[e.code as keyof typeof keyboardMap];
    if (note && !activeNotes.includes(note)) {
      setActiveNotes(prev => [...prev, note]);
      onNoteOn?.(note, 100);
    }
  }, [activeNotes, onNoteOn, keyboardMap]);
  
  // Handle keyboard key up
  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    const note = keyboardMap[e.code as keyof typeof keyboardMap];
    if (note) {
      setActiveNotes(prev => prev.filter(n => n !== note));
      onNoteOff?.(note);
    }
  }, [onNoteOff, keyboardMap]);
  
  // Set up keyboard event listeners
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);
  
  // Handle mouse interaction for piano keys
  const startNote = (note: number) => {
    if (!activeNotes.includes(note)) {
      setActiveNotes(prev => [...prev, note]);
      onNoteOn?.(note, 100);
    }
  };
  
  const stopNote = (note: number) => {
    setActiveNotes(prev => prev.filter(n => n !== note));
    onNoteOff?.(note);
  };
  
  // Render the piano keys
  const renderKeys = () => {
    const keys = [];
    const baseNote = octave * 12;
    
    // White keys
    const whiteKeyNotes = [0, 2, 4, 5, 7, 9, 11]; // C, D, E, F, G, A, B
    for (let i = 0; i < 7; i++) {
      const note = baseNote + whiteKeyNotes[i];
      keys.push(
        <div
          key={`white-${note}`}
          className={`synth-key white-key ${activeNotes.includes(note) ? 'active' : ''}`}
          onMouseDown={() => { 
            setMouseDrag(true);
            startNote(note);
          }}
          onMouseUp={() => {
            setMouseDrag(false);
            stopNote(note);
          }}
          onMouseEnter={() => mouseDrag && startNote(note)}
          onMouseLeave={() => mouseDrag && stopNote(note)}
          data-note={note}
        />
      );
    }
    
    // Black keys
    const blackKeyNotes = [1, 3, 6, 8, 10]; // C#, D#, F#, G#, A#
    const blackKeyPositions = [0, 1, 3, 4, 5]; // Positions between white keys
    
    for (let i = 0; i < 5; i++) {
      const note = baseNote + blackKeyNotes[i];
      keys.push(
        <div
          key={`black-${note}`}
          className={`synth-key black-key pos-${blackKeyPositions[i]} ${activeNotes.includes(note) ? 'active' : ''}`}
          onMouseDown={() => { 
            setMouseDrag(true);
            startNote(note);
          }}
          onMouseUp={() => {
            setMouseDrag(false);
            stopNote(note);
          }}
          onMouseEnter={() => mouseDrag && startNote(note)}
          onMouseLeave={() => mouseDrag && stopNote(note)}
          data-note={note}
        />
      );
    }
    
    return keys;
  };
  
  return (
    <div 
      className={`synth-keyboard ${className} ${glowOnActive ? 'glow-active' : ''}`}
      onMouseUp={() => setMouseDrag(false)}
      onMouseLeave={() => setMouseDrag(false)}
    >
      <div className="synth-keyboard-container">
        {renderKeys()}
      </div>
      {children}
    </div>
  );
}; 