import React from 'react';
import { Knob } from './Knob';

export interface ModulationSource {
  id: string;
  type: 'env' | 'lfo';
  name: string;
}

export interface ModulationTarget {
  id: string;
  name: string;
  componentId: string;
  componentType: 'osc' | 'filter';
  parameter: string;
}

export interface ModulationConnection {
  sourceId: string;
  targetId: string;
  amount: number;
}

interface ModulationMatrixProps {
  sources: ModulationSource[];
  targets: ModulationTarget[];
  connections: ModulationConnection[];
  onConnectionChange: (sourceId: string, targetId: string, amount: number) => void;
  onSourceClick: (sourceId: string) => void;
  onCreateLFO: () => void;
  onCreateModEnv: () => void;
  onRemoveSource: (sourceId: string) => void;
  lastTouchedParam: string | null;
}

export const ModulationMatrix: React.FC<ModulationMatrixProps> = ({
  sources,
  targets,
  connections,
  onConnectionChange,
  onSourceClick,
  onCreateLFO,
  onCreateModEnv,
  onRemoveSource,
  lastTouchedParam,
}) => {
  // Get all target IDs that have active connections
  const activeTargetIds = new Set(connections.map(conn => conn.targetId));
  
  // Filter targets to show only those with active connections or the last touched parameter
  const visibleTargets = targets.filter(target => 
    activeTargetIds.has(target.id) || target.id === lastTouchedParam
  );

  console.log({lastTouchedParam})

  return (
    <div className="bg-gray-800/50 rounded-lg p-2">
      <div className="flex justify-between items-center mb-2">
        <div className="text-sm font-quantico text-gray-400">Modulation</div>
        <div className="flex gap-2">
          <button
            onClick={onCreateLFO}
            className="px-2 py-1 text-xs font-quantico bg-gray-700 hover:bg-gray-600 rounded"
          >
            +LFO
          </button>
          <button
            onClick={onCreateModEnv}
            className="px-2 py-1 text-xs font-quantico bg-gray-700 hover:bg-gray-600 rounded"
          >
            +MOD-ENV
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left text-xs font-quantico text-gray-400 p-1">Parameter</th>
              {sources.map(source => (
                <th 
                  key={source.id}
                  className="text-center text-xs font-quantico text-gray-400 p-1"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span 
                      className="cursor-pointer hover:bg-gray-700/50 px-1"
                      onClick={() => onSourceClick(source.id)}
                    >
                      {source.name}
                    </span>
                    <button
                      onClick={() => onRemoveSource(source.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      ×
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleTargets.map(target => (
              <tr key={target.id} className={`border-t border-gray-700 ${target.id === lastTouchedParam ? 'bg-gray-700/30' : ''}`}>
                <td className="text-xs font-quantico text-gray-300 p-1">
                  {target.componentId}.{target.parameter}
                </td>
                {sources.map(source => {
                  const connection = connections.find(
                    conn => conn.sourceId === source.id && conn.targetId === target.id
                  );
                  const amount = connection?.amount ?? 0;
                  
                  return (
                    <td key={`${target.id}-${source.id}`} className="p-1">
                      <div className="flex justify-center">
                        <Knob
                          size="sm"
                          value={amount}
                          onChange={(value) => onConnectionChange(source.id, target.id, value)}
                          min={-1}
                          max={1}
                          step={0.01}
                          label={`${source.name} → ${target.name}`}
                        />
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ModulationMatrix; 