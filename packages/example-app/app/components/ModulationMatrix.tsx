import { useMemo } from "react";
import { Modulation, ModulationEvent } from "../v3/base";
import { Knob } from "./Knob";

interface ModulationMatrixProps {
  lastTouchedParam: {
    id: string;
    parameter: string;
  } | null;
  activeModulations: Modulation[];
  modulationSources: {
    id: string;
    type: "env" | "lfo";
    name: string;
  }[];
  onModulationChange(ev: ModulationEvent): void;
}

export default function ModulationMatrix({
  activeModulations,
  modulationSources,
  lastTouchedParam,
  onModulationChange,
}: ModulationMatrixProps) {
  // Get unique targets from active modulations
  const activeTargets = useMemo(() => {
    const res: { id: string; parameter: string }[] = [];
    activeModulations.forEach((mod) => {
      res.push({
        id: mod.toID,
        parameter: mod.parameter,
      });
    });

    if (lastTouchedParam) {
      for (const mod of activeModulations) {
        if (
          mod.toID === lastTouchedParam.id &&
          mod.parameter === lastTouchedParam.parameter
        ) {
          return res;
        }
      }

      res.push({
        id: lastTouchedParam.id,
        parameter: lastTouchedParam.parameter,
      });
    }

    return res;
  }, [activeModulations, lastTouchedParam]);

  return (
    <div className="bg-gray-800/50 rounded-lg p-2">
      <div className="flex justify-between items-center mb-2">
        <div className="text-sm font-quantico text-gray-400">Modulation</div>
        <div className="flex gap-2">
          <button
            onClick={() => {}}
            className="px-2 py-1 text-xs font-quantico bg-gray-700 hover:bg-gray-600 rounded"
          >
            +LFO
          </button>
          <button
            onClick={() => {}}
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
              <th className="text-left text-xs font-quantico text-gray-400 p-1">
                Parameter
              </th>
              {modulationSources.map((source) => (
                <th
                  key={source.id}
                  className="text-center text-xs font-quantico text-gray-400 p-1"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span
                      className="cursor-pointer hover:bg-gray-700/50 px-1"
                      // onClick={() => onSourceClick(source.id)}
                    >
                      {source.name}
                    </span>
                    <button
                      // onClick={() => onRemoveSource(source.id)}
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
            {activeTargets.map((target) => {
              const isLastTouched =
                lastTouchedParam &&
                target.id === lastTouchedParam.id &&
                target.parameter === lastTouchedParam.parameter;

              return (
                <tr
                  key={target.id + target.parameter}
                  className={`border-t border-gray-700 ${
                    isLastTouched ? "bg-gray-700/30" : ""
                  }`}
                >
                  <td className="text-xs font-quantico text-gray-300 p-1">
                    {target.id}.{target.parameter}
                  </td>
                  {modulationSources.map((source) => {
                    const modulation = activeModulations.find(
                      (mod) =>
                        mod.fromID === source.id &&
                        mod.toID === target.id &&
                        mod.parameter === target.parameter
                    );
                    const amount = modulation?.amount ?? 0;

                    return (
                      <td
                        key={`${target.id + target.parameter}-${source.id}`}
                        className="p-1"
                      >
                        <div className="flex justify-center">
                          <Knob
                            size="sm"
                            value={amount}
                            onChange={(value) =>
                              onModulationChange(
                                new ModulationEvent(
                                  source.id,
                                  target.id,
                                  target.parameter,
                                  value
                                )
                              )
                            }
                            min={-1}
                            max={1}
                            step={0.01}
                            label={`${source.name} → ${target.parameter}`}
                          />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// export interface ModulationSource {
//   id: string;
//   type: "env" | "lfo";
//   name: string;
// }

// export interface ModulationTarget {
//   id: string;
//   name: string;
//   componentId: string;
//   componentType: "osc" | "filter";
//   parameter: string;
// }

// interface ModulationMatrixProps {
//   engine: SynthEngine;
//   sources: ModulationSource[];
//   lastTouchedParam: {
//     id: string;
//     parameter: string;
//     value: number;
//   } | null;
//   onSourceClick: (sourceId: string) => void;
//   onCreateLFO: () => void;
//   onCreateModEnv: () => void;
//   onRemoveSource: (sourceId: string) => void;
// }

// export const ModulationMatrix: React.FC<ModulationMatrixProps> = ({
//   engine,
//   sources,
//   lastTouchedParam,
//   onSourceClick,
//   onCreateLFO,
//   onCreateModEnv,
//   onRemoveSource,
// }) => {
//   // Get all active modulations from the engine
//   const activeModulations = engine?.modulations?.getAllModulations() ?? [];
//   console.log(activeModulations);

//   // Get unique targets from active modulations
//   const activeTargets = Array.from(
//     new Set(activeModulations.map((mod) => mod.toID))
//   ).map((targetId) => {
//     return {
//       id: targetId,
//       name: activeModulations.find((m) => m.toID === targetId)?.parameter || "",
//       componentId: targetId,
//       componentType: "osc" as "osc" | "filter", // TODO: determine from modulation
//       parameter:
//         activeModulations.find((m) => m.toID === targetId)?.parameter || "",
//     };
//   });

//   // Add last touched parameter if it exists and isn't already in active targets
//   const visibleTargets = [
//     ...activeTargets,
//     ...(lastTouchedParam &&
//     !activeTargets.some((t) => t.id === lastTouchedParam.id)
//       ? [
//           {
//             id: lastTouchedParam.id,
//             name: lastTouchedParam.parameter,
//             componentId: lastTouchedParam.id,
//             componentType: "osc" as "osc" | "filter", // TODO: determine from modulation
//             parameter: lastTouchedParam.parameter,
//           },
//         ]
//       : []),
//   ];

//   const handleModulationChange = (
//     sourceId: string,
//     targetId: string,
//     amount: number
//   ) => {
//     if (!lastTouchedParam) return;

//     console.log(sourceId, targetId, lastTouchedParam.parameter, amount);

//     // Send modulation event to the engine
//     engine.sendEvent(
//       new ModulationEvent(
//         sourceId,
//         targetId,
//         lastTouchedParam.parameter,
//         amount
//       )
//     );
//   };

//   return (
//     <div className="bg-gray-800/50 rounded-lg p-2">
//       <div className="flex justify-between items-center mb-2">
//         <div className="text-sm font-quantico text-gray-400">Modulation</div>
//         <div className="flex gap-2">
//           <button
//             onClick={onCreateLFO}
//             className="px-2 py-1 text-xs font-quantico bg-gray-700 hover:bg-gray-600 rounded"
//           >
//             +LFO
//           </button>
//           <button
//             onClick={onCreateModEnv}
//             className="px-2 py-1 text-xs font-quantico bg-gray-700 hover:bg-gray-600 rounded"
//           >
//             +MOD-ENV
//           </button>
//         </div>
//       </div>
//       <div className="overflow-x-auto">
//         <table className="w-full">
//           <thead>
//             <tr>
//               <th className="text-left text-xs font-quantico text-gray-400 p-1">
//                 Parameter
//               </th>
//               {sources.map((source) => (
//                 <th
//                   key={source.id}
//                   className="text-center text-xs font-quantico text-gray-400 p-1"
//                 >
//                   <div className="flex items-center justify-center gap-1">
//                     <span
//                       className="cursor-pointer hover:bg-gray-700/50 px-1"
//                       onClick={() => onSourceClick(source.id)}
//                     >
//                       {source.name}
//                     </span>
//                     <button
//                       onClick={() => onRemoveSource(source.id)}
//                       className="text-red-400 hover:text-red-300"
//                     >
//                       ×
//                     </button>
//                   </div>
//                 </th>
//               ))}
//             </tr>
//           </thead>
//           <tbody>
//             {visibleTargets.map((target) => {
//               const isLastTouched =
//                 lastTouchedParam &&
//                 target.id === lastTouchedParam.id &&
//                 target.parameter === lastTouchedParam.parameter;

//               return (
//                 <tr
//                   key={target.id}
//                   className={`border-t border-gray-700 ${
//                     isLastTouched ? "bg-gray-700/30" : ""
//                   }`}
//                 >
//                   <td className="text-xs font-quantico text-gray-300 p-1">
//                     {target.componentId}.{target.parameter}
//                   </td>
//                   {sources.map((source) => {
//                     const modulation = activeModulations.find(
//                       (mod) =>
//                         mod.fromID === source.id &&
//                         mod.toID === target.id &&
//                         mod.parameter === target.parameter
//                     );
//                     const amount = modulation?.amount ?? 0;

//                     return (
//                       <td key={`${target.id}-${source.id}`} className="p-1">
//                         <div className="flex justify-center">
//                           <Knob
//                             size="sm"
//                             value={amount}
//                             onChange={(value) =>
//                               handleModulationChange(
//                                 source.id,
//                                 target.id,
//                                 value
//                               )
//                             }
//                             min={-1}
//                             max={1}
//                             step={0.01}
//                             label={`${source.name} → ${target.name}`}
//                           />
//                         </div>
//                       </td>
//                     );
//                   })}
//                 </tr>
//               );
//             })}
//           </tbody>
//         </table>
//       </div>
//     </div>
//   );
// };

// export default ModulationMatrix;
