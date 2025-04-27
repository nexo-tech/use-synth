/**
 * Convert a MIDI note number to its frequency in Hz
 * @param note MIDI note number (0-127)
 * @returns Frequency in Hz
 */
export const noteToFrequency = (note: number): number => {
  // A4 (MIDI note 69) = 440Hz
  return 440 * Math.pow(2, (note - 69) / 12);
};

/**
 * Parse a note input (either a number or string like "C4") to a MIDI note number
 * @param input Note input
 * @returns MIDI note number
 */
export const parseNoteInput = (input: string | number): number => {
  if (typeof input === 'number') {
    return Math.min(127, Math.max(0, Math.round(input)));
  }
  
  // Handle note names like "C4", "F#5", etc.
  const noteRegex = /^([A-G][#b]?)(\d+)$/i;
  const match = input.match(noteRegex);
  
  if (!match) {
    throw new Error(`Invalid note format: ${input}`);
  }
  
  const [, note, octave] = match;
  const noteIndex = getNoteIndex(note);
  const octaveNum = parseInt(octave);
  
  // MIDI note 0 is C-1, so C4 (middle C) is MIDI note 60
  return noteIndex + (octaveNum + 1) * 12;
};

/**
 * Get the semitone index for a note name
 * @param note Note name (e.g., "C", "C#", "Db")
 * @returns Semitone index (0-11, where C=0)
 */
const getNoteIndex = (note: string): number => {
  const noteMap: Record<string, number> = {
    'C': 0,
    'C#': 1, 'Db': 1,
    'D': 2,
    'D#': 3, 'Eb': 3,
    'E': 4,
    'F': 5,
    'F#': 6, 'Gb': 6,
    'G': 7,
    'G#': 8, 'Ab': 8,
    'A': 9,
    'A#': 10, 'Bb': 10,
    'B': 11
  };
  
  return noteMap[note.toUpperCase()] ?? 0;
};

/**
 * Convert a MIDI note number to a note name with octave
 * @param note MIDI note number
 * @returns Note name (e.g., "C4", "F#5")
 */
export const noteNumberToName = (note: number): string => {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(note / 12) - 1;
  const semitone = note % 12;
  
  return `${noteNames[semitone]}${octave}`;
}; 