"use client"

import { Connection, ConnectionEvent, NodeCreateEvent, NoteStartEvent, NoteStopEvent } from "./base";
import { SynthEngine } from "./engine";
import { useEffect, useRef } from "react";

function Oscilloscope({ engine }: { engine: SynthEngine }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyser = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Create analyser node
    analyser.current = engine.ctx.createAnalyser();
    analyser.current.fftSize = 2048;
    const bufferLength = analyser.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // Connect analyser to destination
    engine.ctx.destination.connect(analyser.current);

    // Animation loop
    function draw() {
      if (!analyser.current || !ctx) return;

      const WIDTH = canvas.width;
      const HEIGHT = canvas.height;

      analyser.current.getByteTimeDomainData(dataArray);

      ctx.fillStyle = 'rgb(0, 0, 0)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgb(0, 255, 0)';
      ctx.beginPath();

      const sliceWidth = WIDTH * 1.0 / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * HEIGHT / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(WIDTH, HEIGHT / 2);
      ctx.stroke();

      requestAnimationFrame(draw);
    }

    draw();

    return () => {
      if (analyser.current) {
        analyser.current.disconnect();
      }
    };
  }, [engine]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={200}
      style={{ border: '1px solid #ccc' }}
    />
  );
}

export default function OscillatorPage() {
  const engineRef = useRef<SynthEngine | null>(null);

  return <div>
    <button onClick={() => {
      (async () => {
        if (!engineRef.current) {
          engineRef.current = new SynthEngine();
          await engineRef.current.ctx.resume();
        }
        const engine = engineRef.current;

        engine.sendEvent(new NodeCreateEvent("osc1", "oscillator", {
          type: "sawtooth",
          detune: -7,
          level: 0.5,
          unisonVoices: 5,
          unisonSpread: 25,
          unisonStereo: 50,
        }));

        engine.sendEvent(new NodeCreateEvent("adsr1", "adsr", {
          attack: 0.5,
          decay: 0.2,
          sustain: 0.5,
          release: 0.3,
        }));

        engine.sendEvent(new ConnectionEvent(new Connection("adsr1", "osc1")));
        engine.sendEvent(new ConnectionEvent(new Connection("osc1", "output")));
        engine.sendEvent(new NoteStartEvent(60, 127));
        setTimeout(() => {
          console.log("note off");
          engine.sendEvent(new NoteStopEvent(60));
        }, 1000);
      })();
    }}>Play</button>

    <div className="w-[100px] h-[100px] bg-black">
      {engineRef.current && <Oscilloscope engine={engineRef.current} />}
    </div>
  </div>
}