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

  // Add some curve to make the path more visible
  const curveOffset = Math.min(50, Math.abs(end.x - start.x) / 2);
  controlPoint1.x += curveOffset;
  controlPoint2.x -= curveOffset;

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
  const [viewportOffset, setViewportOffset] = React.useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = React.useState(false);
  const [panStart, setPanStart] = React.useState<{ x: number; y: number } | null>(null);
  const hasDragged = React.useRef(false);
  const [refreshID, setRefreshID] = React.useState(0);

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
    if (isPanning && panStart) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setViewportOffset(prev => ({
        x: prev.x + dx,
        y: prev.y + dy
      }));
      setPanStart({ x: e.clientX, y: e.clientY });
    } else if (connecting) {
      const rect = e.currentTarget.getBoundingClientRect();
      setTempConnection({
        x: e.clientX - rect.left - viewportOffset.x,
        y: e.clientY - rect.top - viewportOffset.y
      });
    } else if (draggingNode && dragStart) {
      const rect = e.currentTarget.getBoundingClientRect();
      const newX = e.clientX - rect.left - dragStart.x - viewportOffset.x;
      const newY = e.clientY - rect.top - dragStart.y - viewportOffset.y;

      hasDragged.current = true;
      setConnecting(null)
      setTempConnection(null)
      setNodePositions(prev => ({
        ...prev,
        [draggingNode]: {
          x: newX,
          y: newY
        }
      }));
    }
  };

  const handleMouseDown = (e: React.MouseEvent, id?: string) => {
    // If clicking on a node, don't start panning
    if (id) {
      const rect = e.currentTarget.getBoundingClientRect();
      const nodeRect = e.currentTarget.getBoundingClientRect();
      const offsetX = e.clientX - nodeRect.left;
      const offsetY = e.clientY - nodeRect.top;

      setDraggingNode(id);
      setDragStart({
        x: offsetX,
        y: offsetY
      });
      hasDragged.current = false;
      return;
    }

    // Only start panning if clicking on the background
    const target = e.target as HTMLElement;
    if (target === e.currentTarget || target.classList.contains('pan-area')) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!hasDragged.current) {
      setConnecting({ from: id, type: id.startsWith('osc') ? 'oscillator' : id.startsWith('fil') ? 'filter' : 'envelope' });
    }
    hasDragged.current = false;
  };

  const handleMouseUp = () => {
    if (connecting && hoveredComponent) {
      handleConnect(connecting.from, hoveredComponent);
      hasDragged.current = true;
    }
    setConnecting(null);
    setTempConnection(null);
    setHoveredComponent(null);
    setDraggingNode(null);
    setDragStart(null);
    setIsPanning(false);
    setPanStart(null);
    setRefreshID(prev => prev + 1);
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

    // Calculate the bottom position based on existing components
    let maxY = 50; // Start with initial Y position
    Object.values(nodePositions).forEach(pos => {
      maxY = Math.max(maxY, pos.y + 100); // Add 100 for spacing
    });

    // Set the X position based on component type
    let xPos = 50;
    if (type === 'filter') {
      xPos = 200;
    } else if (type === 'envelope') {
      xPos = 350;
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

    // Update node positions with the new component
    setNodePositions(prev => ({
      ...prev,
      [newId]: { x: xPos, y: maxY }
    }));

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

    setNodePositions(prev => {
      const newPositions = { ...prev };
      delete newPositions[id];
      return newPositions;
    });

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

      const start = { x: fromPos.x + 30, y: fromPos.y + 10 }; // Middle of the node
      const end = { x: toPos.x, y: toPos.y + 10 }; // Middle of the target node

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

  const tidyLayout = () => {
    const newPositions: Record<string, { x: number; y: number }> = {};
    const gridSpacing = 150; // Increased spacing
    const startX = 50;
    const startY = 50;

    // Group components by type
    const envelopes = Object.keys(config.components.envelopes);
    const oscillators = Object.keys(config.components.oscillators);
    const filters = Object.keys(config.components.filters);

    // Analyze connections to determine optimal placement
    const connections = config.routing;
    const nodeConnections: Record<string, { inputs: string[], outputs: string[] }> = {};

    // Initialize connection tracking
    [...envelopes, ...oscillators, ...filters, 'output'].forEach(id => {
      nodeConnections[id] = { inputs: [], outputs: [] };
    });

    // Track connections
    connections.forEach(conn => {
      nodeConnections[conn.from].outputs.push(conn.to);
      nodeConnections[conn.to].inputs.push(conn.from);
    });

    // Position envelopes first (leftmost)
    envelopes.forEach((id, index) => {
      newPositions[id] = {
        x: startX,
        y: startY + index * gridSpacing
      };
    });

    // Position oscillators in second column, with vertical offset based on their envelope connections
    oscillators.forEach((id, index) => {
      const connectedEnvelopes = nodeConnections[id].inputs.filter(i => i.startsWith('env'));
      let yOffset = 0;

      if (connectedEnvelopes.length > 0) {
        // Try to align with connected envelopes
        const envIndex = envelopes.indexOf(connectedEnvelopes[0]);
        if (envIndex !== -1) {
          yOffset = (envIndex - index) * (gridSpacing / 3);
        }
      }

      newPositions[id] = {
        x: startX + gridSpacing,
        y: startY + index * gridSpacing + yOffset
      };
    });

    // Position filters in third column, with vertical offset based on their oscillator connections
    filters.forEach((id, index) => {
      const connectedOscs = nodeConnections[id].inputs.filter(i => i.startsWith('osc'));
      let yOffset = 0;

      if (connectedOscs.length > 0) {
        // Try to align with connected oscillators
        const oscIndex = oscillators.indexOf(connectedOscs[0]);
        if (oscIndex !== -1) {
          yOffset = (oscIndex - index) * (gridSpacing / 3);
        }
      }

      newPositions[id] = {
        x: startX + gridSpacing * 2,
        y: startY + index * gridSpacing + yOffset
      };
    });

    // Position output in the middle of the right side
    newPositions['output'] = {
      x: startX + gridSpacing * 3,
      y: startY + Math.max(envelopes.length, oscillators.length, filters.length) * gridSpacing / 2
    };

    setNodePositions(newPositions);
    setViewportOffset({ x: 0, y: 0 }); // Reset viewport
  };

  return (
    <div >
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-sm font-quantico text-gray-400">Routing</h2>
        <div className="flex gap-1">
          <button
            onClick={tidyLayout}
            className="px-1.5 py-0.5 bg-gray-800 text-gray-300 rounded text-xs hover:bg-gray-700"
            title="Arrange nodes in a clean grid layout"
          >
            Tidy
          </button>
          <button
            onClick={() => handleAddComponent('oscillator')}
            className="px-1.5 py-0.5 bg-gray-800 text-gray-300 rounded text-xs hover:bg-gray-700"
          >
            +Osc
          </button>
          <button
            onClick={() => handleAddComponent('filter')}
            className="px-1.5 py-0.5 bg-gray-800 text-gray-300 rounded text-xs hover:bg-gray-700"
          >
            +Filter
          </button>
          <button
            onClick={() => handleAddComponent('envelope')}
            className="px-1.5 py-0.5 bg-gray-800 text-gray-300 rounded text-xs hover:bg-gray-700"
          >
            +ADSR
          </button>
        </div>
      </div>

      {/* Graph Layout */}
      <div
        className="relative h-[200px] border border-gray-700 rounded-lg bg-gray-800/50 overflow-hidden cursor-grab active:cursor-grabbing pan-area"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onMouseDown={(e) => handleMouseDown(e)}
      >
        {/* SVG for connections */}
        <svg
          className="absolute w-full h-full"
          style={{
            pointerEvents: 'none',
            transform: `translate(${viewportOffset.x}px, ${viewportOffset.y}px)`
          }}
        >
          {connectionPaths.map(({ path, from, to }, index) => (
            <g key={index} style={{ pointerEvents: 'all' }}>
              <path
                d={path}
                stroke={hoveredConnection?.from === from && hoveredConnection?.to === to ? "#4B5563" : "#374151"}
                strokeWidth="1.5"
                fill="none"
                onMouseEnter={() => setHoveredConnection({ from, to })}
                onMouseLeave={() => setHoveredConnection(null)}
                onClick={() => handleDeleteConnection(from, to)}
                style={{ cursor: 'pointer' }}
              />
              <circle
                cx={nodePositions[to].x}
                cy={nodePositions[to].y + 10} // Middle of the node
                r="3"
                fill="#374151"
              />
            </g>
          ))}
          {tempConnection && connecting && (
            <path
              d={getBezierPath(
                { x: nodePositions[connecting.from].x + 30, y: nodePositions[connecting.from].y + 10 }, // Middle of the node
                hoveredComponent ?
                  { x: nodePositions[hoveredComponent].x, y: nodePositions[hoveredComponent].y + 10 } : // Middle of the target node
                  tempConnection
              )}
              stroke="#4B5563"
              strokeWidth="1.5"
              fill="none"
              strokeDasharray="4"
            />
          )}
        </svg>

        {/* Components */}
        <div style={{ transform: `translate(${viewportOffset.x}px, ${viewportOffset.y}px)` }}>
          {Object.entries(nodePositions).map(([id, pos]) => (
            <div
              key={id}
              onMouseDown={(e) => handleMouseDown(e, id)}
              onClick={(e) => handleClick(e, id)}
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
              className={`group absolute w-[60px] h-[20px] rounded cursor-move text-[10px] font-quantico ${id === 'output' ? 'bg-gray-700' :
                id.startsWith('osc') ? 'bg-blue-600/50' :
                  id.startsWith('fil') ? 'bg-green-600/50' :
                    'bg-purple-600/50'
                } ${hoveredComponent === id ? 'ring-1 ring-white' : ''} ${draggingNode === id ? 'ring-1 ring-white shadow' : ''}`}
              style={{
                left: pos.x,
                top: pos.y,
              }}
            >
              <div className="relative p-1 text-center text-[10px] text-gray-200">
                {id}
                {id !== 'output' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteComponent(id);
                    }}
                    className="absolute -top-1 -right-1 w-3 h-3 bg-gray-700 text-gray-300 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[8px] hover:bg-gray-600"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 