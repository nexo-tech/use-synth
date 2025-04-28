import React from 'react';
import { UseSynthConfig, RoutingConnection } from '../page';

interface RoutingProps {
  config: UseSynthConfig;
  onConfigChange: (newConfig: UseSynthConfig) => void;
}

export default function Routing({ config, onConfigChange }: RoutingProps) {
  const [dragging, setDragging] = React.useState<{ from: string; type: string } | null>(null);
  const [showNewComponentModal, setShowNewComponentModal] = React.useState(false);
  const [newComponentType, setNewComponentType] = React.useState<'oscillator' | 'filter'>('oscillator');

  const handleDragStart = (id: string, type: string) => {
    setDragging({ from: id, type });
  };

  const handleDrop = (toId: string) => {
    if (!dragging) return;

    const newRouting = [...config.routing];
    const existingConnection = newRouting.find(
      conn => conn.from === dragging.from && conn.to === toId
    );

    if (!existingConnection) {
      newRouting.push({
        from: dragging.from,
        to: toId,
        mix: 1,
        gain: 1,
        pan: 0
      });
    }

    onConfigChange({
      ...config,
      routing: newRouting
    });

    setDragging(null);
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
    let x = 0;
    let y = 0;

    // Position oscillators
    Object.keys(config.components.oscillators).forEach(id => {
      positions[id] = { x: 0, y: y };
      y += 100;
    });

    // Position filters
    y = 0;
    Object.keys(config.components.filters).forEach(id => {
      positions[id] = { x: 200, y: y };
      y += 100;
    });

    // Position output
    positions['output'] = { x: 400, y: Math.max(y - 100, 0) };

    return positions;
  };

  const positions = calculatePositions();

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Routing</h2>
        <div className="flex gap-2">
          <button
            onClick={() => handleAddComponent('oscillator')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Add Oscillator
          </button>
          <button
            onClick={() => handleAddComponent('filter')}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Add Filter
          </button>
        </div>
      </div>

      {/* Graph Layout */}
      <div className="relative h-[400px] border border-gray-700 rounded-lg bg-gray-800/50">
        {/* Connections */}
        {config.routing.map((conn, index) => {
          const fromPos = positions[conn.from];
          const toPos = positions[conn.to];
          if (!fromPos || !toPos) return null;

          return (
            <div
              key={index}
              className="absolute"
              style={{
                left: fromPos.x + 50,
                top: fromPos.y + 25,
                width: toPos.x - fromPos.x,
                height: 2,
                backgroundColor: '#4B5563',
                transform: `rotate(${Math.atan2(toPos.y - fromPos.y, toPos.x - fromPos.x)}rad)`,
                transformOrigin: 'left center',
              }}
            >
              <div className="absolute -right-2 -top-2">
                <button
                  onClick={() => handleDeleteConnection(conn.from, conn.to)}
                  className="text-red-500 hover:text-red-700"
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}

        {/* Components */}
        {Object.entries(positions).map(([id, pos]) => (
          <div
            key={id}
            draggable={id !== 'output'}
            onDragStart={() => handleDragStart(id, id.startsWith('osc') ? 'oscillator' : 'filter')}
            onDragOver={e => e.preventDefault()}
            onDrop={() => handleDrop(id)}
            className={`absolute w-[100px] h-[50px] rounded-lg cursor-move ${
              id === 'output' ? getComponentColor('output') : 
              id.startsWith('osc') ? getComponentColor('oscillator') : 
              getComponentColor('filter')
            }`}
            style={{
              left: pos.x,
              top: pos.y,
            }}
          >
            <div className="p-2 text-center text-sm font-quantico">
              {id}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 