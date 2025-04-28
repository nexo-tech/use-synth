import React from 'react';
import { UseSynthConfig, RoutingConnection } from '../page';

interface RoutingProps {
  config: UseSynthConfig;
  onConfigChange: (newConfig: UseSynthConfig) => void;
}

// Helper function to calculate bezier curve path
const getBezierPath = (start: { x: number; y: number }, end: { x: number; y: number }) => {
  const midX = (start.x + end.x) / 2;
  const controlPoint1 = { x: midX, y: start.y };
  const controlPoint2 = { x: midX, y: end.y };
  
  return `M ${start.x} ${start.y} C ${controlPoint1.x} ${controlPoint1.y}, ${controlPoint2.x} ${controlPoint2.y}, ${end.x} ${end.y}`;
};

// Helper function to check if two lines intersect
const doLinesIntersect = (line1: { start: { x: number; y: number }, end: { x: number; y: number } },
                         line2: { start: { x: number; y: number }, end: { x: number; y: number } }) => {
  const denominator = ((line2.end.y - line2.start.y) * (line1.end.x - line1.start.x)) - 
                     ((line2.end.x - line2.start.x) * (line1.end.y - line1.start.y));
  
  if (denominator === 0) return false;
  
  const ua = (((line2.end.x - line2.start.x) * (line1.start.y - line2.start.y)) - 
             ((line2.end.y - line2.start.y) * (line1.start.x - line2.start.x))) / denominator;
  const ub = (((line1.end.x - line1.start.x) * (line1.start.y - line2.start.y)) - 
             ((line1.end.y - line1.start.y) * (line1.start.x - line2.start.x))) / denominator;
  
  return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
};

export default function Routing({ config, onConfigChange }: RoutingProps) {
  const [connecting, setConnecting] = React.useState<{ from: string; type: string } | null>(null);
  const [tempConnection, setTempConnection] = React.useState<{ x: number; y: number } | null>(null);
  const [hoveredConnection, setHoveredConnection] = React.useState<{ from: string; to: string } | null>(null);
  const [hoveredComponent, setHoveredComponent] = React.useState<string | null>(null);
  const [showNewComponentModal, setShowNewComponentModal] = React.useState(false);
  const [newComponentType, setNewComponentType] = React.useState<'oscillator' | 'filter'>('oscillator');

  const handleMouseMove = (e: React.MouseEvent) => {
    if (connecting) {
      const rect = e.currentTarget.getBoundingClientRect();
      setTempConnection({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };

  const handleMouseUp = () => {
    if (connecting && hoveredComponent) {
      handleConnect(connecting.from, hoveredComponent);
    }
    setConnecting(null);
    setTempConnection(null);
    setHoveredComponent(null);
  };

  const handleConnect = (from: string, to: string) => {
    const newRouting = [...config.routing];
    const existingConnection = newRouting.find(
      conn => conn.from === from && conn.to === to
    );

    if (!existingConnection) {
      newRouting.push({
        from,
        to,
        mix: 1,
        gain: 1,
        pan: 0
      });
    }

    onConfigChange({
      ...config,
      routing: newRouting
    });
  };

  const handleDeleteConnection = (from: string, to: string) => {
    const newRouting = config.routing.filter(
      conn => !(conn.from === from && conn.to === to)
    );
    onConfigChange({
      ...config,
      routing: newRouting
    });
  };

  const handleAddComponent = (type: 'oscillator' | 'filter') => {
    const newConfig = { ...config };
    const prefix = type === 'oscillator' ? 'osc' : 'fil';
    let index = 1;
    let newId = `${prefix}${index}`;

    // Find the next available ID
    while (
      (type === 'oscillator' && newConfig.components.oscillators[newId]) ||
      (type === 'filter' && newConfig.components.filters[newId])
    ) {
      index++;
      newId = `${prefix}${index}`;
    }

    if (type === 'oscillator') {
      newConfig.components.oscillators[newId] = {
        type: 'sine',
        level: 0.5
      };
    } else {
      newConfig.components.filters[newId] = {
        type: 'lowpass',
        frequency: 1000,
        Q: 1
      };
    }

    onConfigChange(newConfig);
  };

  const handleDeleteComponent = (id: string) => {
    const newConfig = { ...config };
    
    // Remove the component from its respective section
    if (id.startsWith('osc')) {
      delete newConfig.components.oscillators[id];
    } else if (id.startsWith('fil')) {
      delete newConfig.components.filters[id];
    }

    // Remove any connections involving this component
    newConfig.routing = newConfig.routing.filter(
      conn => conn.from !== id && conn.to !== id
    );

    onConfigChange(newConfig);
  };

  const getComponentColor = (type: string) => {
    switch (type) {
      case 'oscillator':
        return 'bg-blue-500';
      case 'filter':
        return 'bg-green-500';
      case 'output':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Calculate positions for the graph layout
  const calculatePositions = () => {
    const positions: Record<string, { x: number; y: number }> = {};
    let y = 0;

    // Position oscillators
    Object.keys(config.components.oscillators).forEach(id => {
      positions[id] = { x: 0, y: y };
      y += 50; // Reduced spacing
    });

    // Position filters
    y = 0;
    Object.keys(config.components.filters).forEach(id => {
      positions[id] = { x: 150, y: y }; // Reduced horizontal spacing
      y += 50;
    });

    // Position output
    positions['output'] = { x: 300, y: Math.max(y - 50, 0) }; // Reduced horizontal spacing

    return positions;
  };

  const positions = calculatePositions();

  // Calculate connection paths with bezier curves
  const getConnectionPaths = () => {
    const paths: { path: string; from: string; to: string }[] = [];
    const lines: { start: { x: number; y: number }, end: { x: number; y: number } }[] = [];

    config.routing.forEach((conn, index) => {
      const fromPos = positions[conn.from];
      const toPos = positions[conn.to];
      if (!fromPos || !toPos) return;

      const start = { x: fromPos.x + 50, y: fromPos.y + 25 };
      const end = { x: toPos.x, y: toPos.y + 25 };

      // Check for intersections with existing lines
      const newLine = { start, end };
      const hasIntersection = lines.some(line => doLinesIntersect(line, newLine));

      if (!hasIntersection) {
        lines.push(newLine);
        paths.push({
          path: getBezierPath(start, end),
          from: conn.from,
          to: conn.to
        });
      }
    });

    return paths;
  };

  const connectionPaths = getConnectionPaths();

  return (
    <div className="p-2">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-bold">Routing</h2>
        <div className="flex gap-1">
          <button
            onClick={() => handleAddComponent('oscillator')}
            className="px-2 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            + Osc
          </button>
          <button
            onClick={() => handleAddComponent('filter')}
            className="px-2 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
          >
            + Filter
          </button>
        </div>
      </div>

      {/* Graph Layout */}
      <div 
        className="relative h-[200px] border border-gray-700 rounded-lg bg-gray-800/50"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* SVG for connections */}
        <svg className="absolute w-full h-full" style={{ pointerEvents: 'all' }}>
          {config.routing.map((conn, index) => {
            const fromPos = positions[conn.from];
            const toPos = positions[conn.to];
            if (!fromPos || !toPos) return null;

            const start = { x: fromPos.x + 40, y: fromPos.y + 20 };
            const end = { x: toPos.x, y: toPos.y + 20 };
            const path = getBezierPath(start, end);

            return (
              <g key={index} style={{ pointerEvents: 'all' }}>
                <path
                  d={path}
                  stroke={hoveredConnection?.from === conn.from && hoveredConnection?.to === conn.to ? "#6B7280" : "#4B5563"}
                  strokeWidth="4"
                  fill="none"
                  onMouseEnter={() => setHoveredConnection({ from: conn.from, to: conn.to })}
                  onMouseLeave={() => setHoveredConnection(null)}
                  onClick={() => handleDeleteConnection(conn.from, conn.to)}
                  style={{ cursor: 'pointer' }}
                />
                <circle
                  cx={toPos.x}
                  cy={toPos.y + 20}
                  r="4"
                  fill="#4B5563"
                />
              </g>
            );
          })}
          {tempConnection && connecting && (
            <path
              d={getBezierPath(
                { x: positions[connecting.from].x + 40, y: positions[connecting.from].y + 20 },
                hoveredComponent ? 
                  { x: positions[hoveredComponent].x, y: positions[hoveredComponent].y + 20 } : 
                  tempConnection
              )}
              stroke="#6B7280"
              strokeWidth="2"
              fill="none"
              strokeDasharray="4"
            />
          )}
        </svg>

        {/* Components */}
        {Object.entries(positions).map(([id, pos]) => (
          <div
            key={id}
            onClick={() => {
              if (!connecting && id !== 'output') {
                setConnecting({ from: id, type: id.startsWith('osc') ? 'oscillator' : 'filter' });
              }
            }}
            onMouseEnter={() => {
              if (connecting && id !== connecting.from) {
                setHoveredComponent(id);
              }
            }}
            onMouseLeave={() => {
              if (connecting) {
                setHoveredComponent(null);
              }
            }}
            className={`group absolute w-[80px] h-[40px] rounded-lg cursor-pointer ${
              id === 'output' ? getComponentColor('output') : 
              id.startsWith('osc') ? getComponentColor('oscillator') : 
              getComponentColor('filter')
            } ${hoveredComponent === id ? 'ring-2 ring-white' : ''}`}
            style={{
              left: pos.x,
              top: pos.y,
            }}
          >
            <div className="relative p-1 text-center text-xs font-quantico">
              {id}
              {id !== 'output' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteComponent(id);
                  }}
                  className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] hover:bg-red-600"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 