import { useState, useEffect, useRef } from 'react';
import { UseSynthConfig, UseSynthReturn, SynthState, ModulationEntry, ConnectionOptions } from './types';
import { VirtualKeyboard } from './components/VirtualKeyboard';
import { ModulationMatrix } from './components/ModulationMatrix';
import { noteToFrequency, parseNoteInput } from './utils/notes';
// @ts-ignore
export const useSynth = (config: UseSynthConfig): UseSynthReturn => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeNotesRef = useRef<Map<number, any>>(new Map());
  const paramCacheRef = useRef<Map<string, number>>(new Map());
  const moduleNodesRef = useRef<Map<string, AudioNode>>(new Map());
  const midiAccessRef = useRef<WebMidi.MIDIAccess | null>(null);
  const midiInputsRef = useRef<WebMidi.MIDIInput[]>([]);
  const midiOutputsRef = useRef<WebMidi.MIDIOutput[]>([]);
  const [initialized, setInitialized] = useState(false);
  // @ts-ignore
  const [cpuUsage, setCpuUsage] = useState(0);
  
  // Initialize AudioContext and Web Audio nodes
  useEffect(() => {
    const initAudio = async () => {
      try {
        // Create AudioContext
        const ctx = new AudioContext();
        audioContextRef.current = ctx;
        
        // Initialize Audio nodes (placeholder implementation)
        const masterGain = ctx.createGain();
        masterGain.connect(ctx.destination);
        moduleNodesRef.current.set('output', masterGain);
        
        // Try to initialize MIDI
        if (navigator.requestMIDIAccess) {
          try {
            const midiAccess = await navigator.requestMIDIAccess({ sysex: false });
            midiAccessRef.current = midiAccess;
            
            const inputs = Array.from(midiAccess.inputs.values());
            const outputs = Array.from(midiAccess.outputs.values());
            
            midiInputsRef.current = inputs;
            midiOutputsRef.current = outputs;
            
            console.log('MIDI initialized with', inputs.length, 'inputs and', outputs.length, 'outputs');
          } catch (err) {
            console.warn('MIDI access denied', err);
          }
        }
        
        setInitialized(true);
      } catch (err) {
        console.error('Failed to initialize audio', err);
      }
    };
    
    initAudio();
    
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);
  
  // Trigger a note
  const triggerNote = (note: number | string, velocity = 100): void => {
    if (!audioContextRef.current || !initialized) return;
    
    const noteNumber = typeof note === 'string' ? parseNoteInput(note) : note;
    const frequency = noteToFrequency(noteNumber);
    
    // Simple implementation - just create an oscillator and gain node
    const osc = audioContextRef.current.createOscillator();
    const gain = audioContextRef.current.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.value = frequency;
    
    gain.gain.value = velocity / 127;
    
    osc.connect(gain);
    gain.connect(moduleNodesRef.current.get('output')!);
    
    osc.start();
    
    // Store the note data
    activeNotesRef.current.set(noteNumber, {
      frequency,
      velocity,
      startTime: audioContextRef.current.currentTime,
      voiceNodes: [osc, gain]
    });
    
    console.log(`Note On: ${noteNumber} (${frequency.toFixed(2)}Hz) velocity: ${velocity}`);
  };
  
  // Release a note
  const releaseNote = (note: number | string): void => {
    if (!audioContextRef.current) return;
    
    const noteNumber = typeof note === 'string' ? parseNoteInput(note) : note;
    
    const noteData = activeNotesRef.current.get(noteNumber);
    if (noteData) {
      const now = audioContextRef.current.currentTime;
      const releaseTime = 0.1; // 100ms release
      
      // Find gain node to apply release envelope
      const gainNode = noteData.voiceNodes.find(
        (node: any) => node instanceof GainNode
      ) as GainNode;
      
      if (gainNode) {
        // Apply release envelope
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + releaseTime);
        
        // Stop all nodes after release time
        noteData.voiceNodes.forEach((node: any) => {
          if (node instanceof OscillatorNode) {
            node.stop(now + releaseTime);
          }
        });
        
        // Mark note as released
        noteData.endTime = now;
        
        // Remove note from active notes after release
        setTimeout(() => {
          activeNotesRef.current.delete(noteNumber);
        }, releaseTime * 1000);
      }
      
      console.log(`Note Off: ${noteNumber}`);
    }
  };
  
  // Set a parameter value
  const setParam = (path: string, value: number): void => {
    paramCacheRef.current.set(path, value);
    console.log(`Parameter set: ${path} = ${value}`);
    
    // A real implementation would update the actual Web Audio node parameters
  };
  
  // Add a modulation routing
  const addModulation = (entry: ModulationEntry): void => {
    console.log('Added modulation', entry);
  };
  
  // Clear modulation routings
  const clearModulation = (sourceId?: string): void => {
    if (sourceId) {
      console.log(`Cleared modulation from source: ${sourceId}`);
    } else {
      console.log('Cleared all modulation routings');
    }
  };
  
  // Connect audio nodes
  const connect = (from: string, to: string, options?: ConnectionOptions): void => {
    console.log(`Connected ${from} to ${to}`, options);
  };
  
  // Disconnect audio nodes
  const disconnect = (from: string, to?: string): void => {
    if (to) {
      console.log(`Disconnected ${from} from ${to}`);
    } else {
      console.log(`Disconnected all from ${from}`);
    }
  };
  
  // Get current synth state
  const getState = (): SynthState => {
    return {
      activeNotes: activeNotesRef.current as Map<number, any>,
      paramCache: paramCacheRef.current,
      cpuUsage
    };
  };
  
  // Load a preset
  const loadPreset = (preset: UseSynthConfig): void => {
    console.log('Loaded preset', preset);
  };
  
  // Set MIDI channel
  const setMidiChannel = (ch: number): void => {
    console.log(`Set MIDI channel to ${ch}`);
  };
  
  // Return the API
  return {
    triggerNote,
    releaseNote,
    setParam,
    addModulation,
    clearModulation,
    connect,
    disconnect,
    midi: {
      inputs: midiInputsRef.current,
      outputs: midiOutputsRef.current,
      setChannel: setMidiChannel
    },
    getState,
    loadPreset,
    VirtualKeyboard,
    ModulationMatrix
  };
}; 