"use client"

import { SynthADSR } from "./adsr";
import { Connection, ConnectionEvent, NodeCreateEvent, NoteStartEvent, NoteStopEvent } from "./base";
import { SynthEngine } from "./engine";
import { useEffect, useRef, useState } from "react";

function Oscilloscope({ engine }: { engine: SynthEngine }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyser = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    if (!canvasRef.current) {
      console.log("no canvas");
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.log("no ctx");
      return;
    }

    // Create analyser node
    analyser.current = engine.ctx.createAnalyser();
    analyser.current.fftSize = 2048;
    const bufferLength = analyser.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // Connect analyser to destination
    const adsr = engine.nodes.get("adsr1") as SynthADSR | null;
    // let note = engine.nodes.get("osc1") // works
    let note = adsr?.getNoteADSR(60) // doesn't work!
    console.log("ADSR", note?.get())
    note?.get()?.connect(analyser.current);

    // Animation loop
    function draw() {
      if (!analyser.current || !ctx) {
        console.log("no analyser or ctx");
        return;
      }

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
  const [engineRef, setEngineRef] = useState<SynthEngine | null>(null);
  useEffect(() => {
    setEngineRef(new SynthEngine());

  }, []);
  const [render, setRender] = useState(0);
  return <div>
    <button onClick={() => {
      (async () => {
        await engineRef!.ctx.resume();
        const engine = engineRef!;

        engine.sendEvent(new NodeCreateEvent("osc1", "oscillator", {
          type: "sawtooth",
          detune: -7,
          level: 0.5,
          unisonVoices: 5,
          unisonSpread: 25,
          unisonStereo: 50,
        }));

        engine.sendEvent(new NodeCreateEvent("adsr1", "adsr", {
          attack: 0.1,
          decay: 0.4,
          sustain: 0.5,
          release: 1,
        }));

        engine.sendEvent(new ConnectionEvent(new Connection("adsr1", "osc1")));
        engine.sendEvent(new ConnectionEvent(new Connection("osc1", "output")));
        engine.sendEvent(new NoteStartEvent(60, 127));
        setTimeout(() => {
          setRender(render + 1);
        }, 500);

        setTimeout(() => {
          engine.sendEvent(new NoteStopEvent(60));
        }, 1000);
      })();
    }}>Play</button>

    <div className="w-[100px] h-[100px] bg-black">
      {render && <Oscilloscope engine={engineRef!} />}
    </div>
  </div>
}