import { useMemo } from 'react';
import { VALID_CUBE_NETS } from "./canvas/netsConfig";
import { layoutNet } from "../lib/netGeometry";

// Net picker icons are generated from the same layout code the 3D renderer uses,
// so the icon always matches what appears on screen (including rotation / mirror).
export default function NetSelector({ activeNetId, setActiveNetId, netFlipX, netFlipY, netRotation = 0 }) {
  const netsVisuals = useMemo(() => VALID_CUBE_NETS.map((net, i) => {
    const { cells, columns, rows } = layoutNet(net, { rotation: netRotation, flipX: netFlipX, flipY: netFlipY });
    return { id: i, coords: cells, width: columns, height: rows };
  }), [netFlipX, netFlipY, netRotation]);

  return (
    <div className="grid grid-cols-4 gap-2 mt-2">
      {netsVisuals.map((visual) => (
        <button
          key={visual.id}
          onClick={() => setActiveNetId(visual.id)}
          aria-pressed={activeNetId === visual.id}
          className={`relative aspect-square flex items-center justify-center rounded-lg border-2 transition-all overflow-hidden bg-slate-100 dark:bg-slate-800/50
            ${activeNetId === visual.id
              ? 'border-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.4)] dark:bg-indigo-900/20'
              : 'border-transparent hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700/50'
            }`}
          title={`Net Type ${visual.id + 1}`}
        >
          <svg
            viewBox={`0 0 ${Math.max(visual.width, visual.height)} ${Math.max(visual.width, visual.height)}`}
            className="w-3/4 h-3/4 drop-shadow-sm transition-transform duration-300"
          >
            <g transform={`translate(${(Math.max(visual.width, visual.height) - visual.width) / 2} ${(Math.max(visual.width, visual.height) - visual.height) / 2})`}>
              {visual.coords.map((c) => (
                <rect
                  key={c.path}
                  x={c.x}
                  y={c.y}
                  width="1"
                  height="1"
                  fill={activeNetId === visual.id ? '#6366f1' : '#94a3b8'}
                  stroke={activeNetId === visual.id ? '#4f46e5' : '#64748b'}
                  strokeWidth="0.05"
                  rx="0.1"
                />
              ))}
            </g>
          </svg>

          {/* Badge Number */}
          <div className={`absolute top-0.5 right-1 pointer-events-none text-[8px] font-bold z-10 ${activeNetId === visual.id ? 'text-indigo-400' : 'text-slate-400'}`}>
            {visual.id + 1}
          </div>
        </button>
      ))}
    </div>
  );
}
