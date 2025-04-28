import React, { useEffect, useRef } from 'react';

interface OscilloscopeProps {
  audioNode: AudioNode;
  width?: number;
  height?: number;
  backgroundColor?: string;
  lineColor?: string;
}

export const Oscilloscope: React.FC<OscilloscopeProps> = ({
  audioNode,
  width = 400,
  height = 200,
  backgroundColor = '#1a1a1a',
  lineColor = '#00ff00',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    if (!audioNode) return;

    // Create analyser node
    const analyser = audioNode.context.createAnalyser();
    analyser.fftSize = 2048;
    analyserRef.current = analyser;

    // Connect audio node to analyser
    audioNode.connect(analyser);

    // Start animation loop
    const draw = () => {
      const canvas = canvasRef.current;
      const analyser = analyserRef.current;
      if (!canvas || !analyser) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Get waveform data
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteTimeDomainData(dataArray);

      // Clear canvas
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);

      // Draw waveform
      ctx.lineWidth = 2;
      ctx.strokeStyle = lineColor;
      ctx.beginPath();

      const sliceWidth = width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * height / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(width, height / 2);
      ctx.stroke();

      // Schedule next frame
      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (analyserRef.current) {
        analyserRef.current.disconnect();
      }
    };
  }, [audioNode, width, height, backgroundColor, lineColor]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="rounded-lg border border-gray-800"
    />
  );
};

export default Oscilloscope; 