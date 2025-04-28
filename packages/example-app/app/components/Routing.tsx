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
  const [newComponentId, setNewComponentId] = React.useState('');

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

  const handleCreateNewComponent = () => {
    if (!newComponentId) return;

    const newConfig = { ...config };
    if (newComponentType === 'oscillator') {
      newConfig.components.oscillators[newComponentId] = {
        type: 'sine',
        level: 0.5
      };
    } else {
      newConfig.components.filters[newComponentId] = {
        type: 'lowpass',
        frequency: 1000,
        Q: 1
      };
    }

    onConfigChange(newConfig);
    setShowNewComponentModal(false);
    setNewComponentId('');
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

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Routing</h2>
        <button
          onClick={() => setShowNewComponentModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Add Component
        </button>
      </div>

      <div className="flex flex-col gap-8">
        {/* Components Row */}
        <div className="flex flex-wrap gap-4">
          {/* Oscillators */}
          <div className="flex-1 min-w-[200px]">
            <h3 className="text-lg font-semibold mb-2">Oscillators</h3>
            <div className="flex flex-wrap gap-2">
              {Object.keys(config.components.oscillators).map(id => (
                <div
                  key={id}
                  draggable
                  onDragStart={() => handleDragStart(id, 'oscillator')}
                  className={`p-2 rounded ${getComponentColor('oscillator')} cursor-move`}
                >
                  {id}
                </div>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className="flex-1 min-w-[200px]">
            <h3 className="text-lg font-semibold mb-2">Filters</h3>
            <div className="flex flex-wrap gap-2">
              {Object.keys(config.components.filters).map(id => (
                <div
                  key={id}
                  draggable
                  onDragStart={() => handleDragStart(id, 'filter')}
                  className={`p-2 rounded ${getComponentColor('filter')} cursor-move`}
                >
                  {id}
                </div>
              ))}
            </div>
          </div>

          {/* Output */}
          <div className="flex-1 min-w-[200px]">
            <h3 className="text-lg font-semibold mb-2">Output</h3>
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop('output')}
              className={`p-2 rounded ${getComponentColor('output')} inline-block`}
            >
              output
            </div>
          </div>
        </div>

        {/* Connections */}
        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-2">Connections</h3>
          <div className="flex flex-wrap gap-4">
            {config.routing.map((conn, index) => (
              <div key={index} className="flex items-center gap-2 bg-gray-800 p-2 rounded">
                <span className="flex items-center gap-1">
                  <span className={`px-2 py-1 rounded ${getComponentColor('oscillator')}`}>
                    {conn.from}
                  </span>
                  <span>→</span>
                  <span className={`px-2 py-1 rounded ${getComponentColor('filter')}`}>
                    {conn.to}
                  </span>
                </span>
                <button
                  onClick={() => handleDeleteConnection(conn.from, conn.to)}
                  className="text-red-500 hover:text-red-700"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* New Component Modal */}
      {showNewComponentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-gray-800 p-6 rounded-lg">
            <h3 className="text-xl font-bold mb-4">Add New Component</h3>
            <div className="space-y-4">
              <div>
                <label className="block mb-2">Type</label>
                <select
                  value={newComponentType}
                  onChange={e => setNewComponentType(e.target.value as 'oscillator' | 'filter')}
                  className="w-full p-2 rounded bg-gray-700"
                >
                  <option value="oscillator">Oscillator</option>
                  <option value="filter">Filter</option>
                </select>
              </div>
              <div>
                <label className="block mb-2">ID</label>
                <input
                  type="text"
                  value={newComponentId}
                  onChange={e => setNewComponentId(e.target.value)}
                  className="w-full p-2 rounded bg-gray-700"
                  placeholder="Enter component ID"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowNewComponentModal(false)}
                  className="px-4 py-2 bg-gray-600 rounded hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateNewComponent}
                  className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 