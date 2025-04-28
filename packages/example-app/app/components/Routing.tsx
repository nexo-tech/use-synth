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
  const [newComponentType, setNewComponentType] = React.useState<'oscillator' | 'filter' | 'envelope'>('oscillator');
  const [nodePositions, setNodePositions] = React.useState<Record<string, { x: number; y: number }>>({});
  const [draggingNode, setDraggingNode] = React.useState<string | null>(null);
  const [dragStart, setDragStart] = React.useState<{ x: number; y: number } | null>(null);

  // Initialize node positions on mount and when components change
  React.useEffect(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    let x = 50;
    let y = 50;

    // Position oscillators
    Object.keys(config.components.oscillators).forEach(id => {
      positions[id] = { x, y };
      y += 100;
    });

    // Position filters
    x = 200;
    y = 50;
    Object.keys(config.components.filters).forEach(id => {
      positions[id] = { x, y };
      y += 100;
    });

    // Position envelopes
    x = 350;
    y = 50;
    Object.keys(config.components.envelopes).forEach(id => {
      positions[id] = { x, y };
      y += 100;
    });

    // Position output
    positions['output'] = { x: 500, y: 100 };

    setNodePositions(positions);
  }, [config.components]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (connecting) {
      const rect = e.currentTarget.getBoundingClientRect();
      setTempConnection({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    } else if (draggingNode && dragStart) {
      const rect = e.currentTarget.getBoundingClientRect();
      const newX = e.clientX - rect.left - dragStart.x;
      const newY = e.clientY - rect.top - dragStart.y;
      
      setNodePositions(prev => ({
        ...prev,
        [draggingNode]: {
          x: newX,
          y: newY
        }
      }));
    }
  };

  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nodeRect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - nodeRect.left;
    const offsetY = e.clientY - nodeRect.top;
    
    setDraggingNode(id);
    setDragStart({
      x: offsetX,
      y: offsetY
    });
  };

  const handleMouseUp = () => {
    if (connecting && hoveredComponent) {
      handleConnect(connecting.from, hoveredComponent);
    }
    setConnecting(null);
    setTempConnection(null);
    setHoveredComponent(null);
    setDraggingNode(null);
    setDragStart(null);
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

  const handleAddComponent = (type: 'oscillator' | 'filter' | 'envelope') => {
    const newConfig = { ...config };
    const prefix = type === 'oscillator' ? 'osc' : type === 'filter' ? 'fil' : 'env';
    let index = 1;
    let newId = `${prefix}${index}`;

    // Find the next available ID
    while (
      (type === 'oscillator' && newConfig.components.oscillators[newId]) ||
      (type === 'filter' && newConfig.components.filters[newId]) ||
      (type === 'envelope' && newConfig.components.envelopes[newId])
    ) {
      index++;
      newId = `${prefix}${index}`;
    }

    if (type === 'oscillator') {
      newConfig.components.oscillators[newId] = {
        type: 'sine',
        level: 0.5
      };
    } else if (type === 'filter') {
      newConfig.components.filters[newId] = {
        type: 'lowpass',
        frequency: 1000,
        Q: 1
      };
    } else {
      newConfig.components.envelopes[newId] = {
        attack: 0.05,
        decay: 0.2,
        sustain: 1.0,
        release: 0.4
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
    } else if (id.startsWith('env')) {
      delete newConfig.components.envelopes[id];
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
      case 'envelope':
        return 'bg-purple-500';
      case 'output':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Calculate connection paths with bezier curves
  const getConnectionPaths = () => {
    const paths: { path: string; from: string; to: string }[] = [];

    config.routing.forEach((conn) => {
      const fromPos = nodePositions[conn.from];
      const toPos = nodePositions[conn.to];
      if (!fromPos || !toPos) return;

      const start = { x: fromPos.x + 40, y: fromPos.y + 20 };
      const end = { x: toPos.x, y: toPos.y + 20 };

      // Calculate control points for a smoother curve
      const midX = (start.x + end.x) / 2;
      const controlPoint1 = { x: midX, y: start.y };
      const controlPoint2 = { x: midX, y: end.y };

      const path = `M ${start.x} ${start.y} C ${controlPoint1.x} ${controlPoint1.y}, ${controlPoint2.x} ${controlPoint2.y}, ${end.x} ${end.y}`;
      paths.push({ path, from: conn.from, to: conn.to });
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
          <button
            onClick={() => handleAddComponent('envelope')}
            className="px-2 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
          >
            + ADSR
          </button>
        </div>
      </div>

      {/* Graph Layout */}
      <div 
        className="relative h-[400px] border border-gray-700 rounded-lg bg-gray-800/50 overflow-hidden"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* SVG for connections */}
        <svg className="absolute w-full h-full" style={{ pointerEvents: 'all' }}>
          {connectionPaths.map(({ path, from, to }, index) => (
            <g key={index} style={{ pointerEvents: 'all' }}>
              <path
                d={path}
                stroke={hoveredConnection?.from === from && hoveredConnection?.to === to ? "#6B7280" : "#4B5563"}
                strokeWidth="2"
                fill="none"
                onMouseEnter={() => setHoveredConnection({ from, to })}
                onMouseLeave={() => setHoveredConnection(null)}
                onClick={() => handleDeleteConnection(from, to)}
                style={{ cursor: 'pointer' }}
              />
              <circle
                cx={nodePositions[to].x}
                cy={nodePositions[to].y + 20}
                r="4"
                fill="#4B5563"
              />
            </g>
          ))}
          {tempConnection && connecting && (
            <path
              d={getBezierPath(
                { x: nodePositions[connecting.from].x + 40, y: nodePositions[connecting.from].y + 20 },
                hoveredComponent ? 
                  { x: nodePositions[hoveredComponent].x, y: nodePositions[hoveredComponent].y + 20 } : 
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
        {Object.entries(nodePositions).map(([id, pos]) => (
          <div
            key={id}
            onMouseDown={(e) => handleMouseDown(e, id)}
            onClick={() => {
              if (!connecting && !draggingNode) {
                setConnecting({ from: id, type: id.startsWith('osc') ? 'oscillator' : id.startsWith('fil') ? 'filter' : 'envelope' });
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
            className={`group absolute w-[80px] h-[40px] rounded-lg cursor-move ${
              id === 'output' ? getComponentColor('output') : 
              id.startsWith('osc') ? getComponentColor('oscillator') : 
              id.startsWith('fil') ? getComponentColor('filter') : 
              getComponentColor('envelope')
            } ${hoveredComponent === id ? 'ring-2 ring-white' : ''} ${draggingNode === id ? 'ring-2 ring-white shadow-lg' : ''}`}
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