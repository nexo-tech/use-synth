import React, { useState, useEffect } from 'react';
import type { ModulationMatrixProps, ModulationEntry, ModulationSource, ModulationTarget } from '../types';

/**
 * A component for visualizing and editing modulation routings
 */
export const ModulationMatrix: React.FC<ModulationMatrixProps> = ({
  sources = [],
  targets = [],
  values = {},
  onChange,
  className = '',
  children
}) => {
  const [matrix, setMatrix] = useState<ModulationEntry[]>([]);
  
  // Initialize matrix from provided values
  useEffect(() => {
    const initialMatrix: ModulationEntry[] = [];
    
    // Generate entries from the values object
    Object.entries(values).forEach(([key, amount]) => {
      const [sourceId, targetPath] = key.split('->');
      
      if (sourceId && targetPath) {
        // Find matching source and target
        const sourceType = sourceId.startsWith('lfo') ? 'lfo' : 
                          sourceId.startsWith('env') ? 'envelope' :
                          sourceId === 'velocity' ? 'velocity' :
                          sourceId === 'pitchbend' ? 'pitchbend' :
                          sourceId === 'aftertouch' ? 'aftertouch' : '';
        
        if (sourceType) {
          const entry: ModulationEntry = {
            // @ts-ignore
            source: sourceType === 'lfo' || sourceType === 'envelope' 
              ? { type: sourceType as 'lfo' | 'envelope', id: sourceId.replace(`${sourceType}.`, '') }
              : { type: sourceType as 'velocity' | 'pitchbend' | 'aftertouch' | 'midicc' },
            target: { path: targetPath },
            amount: amount as number
          };
          
          initialMatrix.push(entry);
        }
      }
    });
    
    setMatrix(initialMatrix);
  }, [values]);
  
  // Handle modulation amount change
  const handleAmountChange = (index: number, newAmount: number) => {
    const updatedMatrix = [...matrix];
    updatedMatrix[index].amount = newAmount;
    setMatrix(updatedMatrix);
    
    // Notify parent component
    onChange?.(updatedMatrix);
  };
  
  // Add a new modulation routing
  const addModulation = (source: ModulationSource, target: ModulationTarget) => {
    const newMatrix = [
      ...matrix,
      { source, target, amount: 50 } // Default to 50%
    ];
    
    setMatrix(newMatrix);
    onChange?.(newMatrix);
  };
  
  // Remove a modulation routing
  const removeModulation = (index: number) => {
    const newMatrix = matrix.filter((_, i) => i !== index);
    setMatrix(newMatrix);
    onChange?.(newMatrix);
  };
  
  // Format source name for display
  const formatSourceName = (source: ModulationSource) => {
    if (source.type === 'lfo' || source.type === 'envelope') {
      return `${source.type.toUpperCase()} ${source.id}`;
    }
    return source.type.charAt(0).toUpperCase() + source.type.slice(1);
  };
  
  // Format target name for display
  const formatTargetName = (target: ModulationTarget) => {
    const parts = target.path.split('.');
    if (parts.length === 3) {
      return `${parts[0]} ${parts[1]} ${parts[2]}`.replace(/([A-Z])/g, ' $1').trim();
    }
    return target.path;
  };
  
  return (
    <div className={`synth-modulation-matrix ${className}`}>
      <div className="synth-matrix-header">
        <div className="synth-matrix-source">Source</div>
        <div className="synth-matrix-target">Target</div>
        <div className="synth-matrix-amount">Amount</div>
        <div className="synth-matrix-actions"></div>
      </div>
      
      {matrix.length === 0 ? (
        <div className="synth-matrix-empty">No modulation routings defined</div>
      ) : (
        <div className="synth-matrix-rows">
          {matrix.map((mod, index) => (
            <div key={index} className="synth-matrix-row">
              <div className="synth-matrix-source">{formatSourceName(mod.source)}</div>
              <div className="synth-matrix-target">{formatTargetName(mod.target)}</div>
              <div className="synth-matrix-amount">
                <input 
                  type="range" 
                  min="-100" 
                  max="100" 
                  value={mod.amount} 
                  onChange={(e) => handleAmountChange(index, parseInt(e.target.value))}
                />
                <span>{mod.amount}%</span>
              </div>
              <div className="synth-matrix-actions">
                <button 
                  className="synth-matrix-remove" 
                  onClick={() => removeModulation(index)}
                >×</button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {sources.length > 0 && targets.length > 0 && (
        <div className="synth-matrix-add">
          <select id="source-select">
            {sources.map((source, index) => (
              <option key={`source-${index}`} value={index}>
                {formatSourceName(source)}
              </option>
            ))}
          </select>
          <span className="synth-matrix-arrow">→</span>
          <select id="target-select">
            {targets.map((target, index) => (
              <option key={`target-${index}`} value={index}>
                {formatTargetName(target)}
              </option>
            ))}
          </select>
          <button 
            className="synth-matrix-add-btn"
            onClick={() => {
              const sourceSelect = document.getElementById('source-select') as HTMLSelectElement;
              const targetSelect = document.getElementById('target-select') as HTMLSelectElement;
              
              if (sourceSelect && targetSelect) {
                const sourceIndex = parseInt(sourceSelect.value);
                const targetIndex = parseInt(targetSelect.value);
                
                addModulation(sources[sourceIndex], targets[targetIndex]);
              }
            }}
          >
            Add
          </button>
        </div>
      )}
      
      {children}
    </div>
  );
}; 