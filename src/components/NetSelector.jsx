import { useMemo } from 'react';
import { VALID_CUBE_NETS } from "./canvas/netsConfig";
import { layoutNet } from "../lib/netGeometry";
import { useLang } from "../contexts/LanguageContext";

// Net picker icons are generated from the same layout code the 3D renderer uses,
// so the icon always matches what appears on screen (including rotation / mirror).
export default function NetSelector({ activeNetId, setActiveNetId, netFlipX, netFlipY, netRotation = 0 }) {
  const { t } = useLang();
  const netsVisuals = useMemo(() => VALID_CUBE_NETS.map((net, i) => {
    const { cells, columns, rows } = layoutNet(net, { rotation: netRotation, flipX: netFlipX, flipY: netFlipY });
    return { id: i, coords: cells, width: columns, height: rows };
  }), [netFlipX, netFlipY, netRotation]);

  return (
    <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label={t("pickNet")}>
      {netsVisuals.map((visual) => {
        const on = activeNetId === visual.id;
        const side = Math.max(visual.width, visual.height);
        return (
          <button
            key={visual.id}
            role="radio"
            aria-checked={on}
            aria-pressed={on}
            onClick={() => setActiveNetId(visual.id)}
            className={`relative aspect-square grid place-items-center rounded-xl border transition-all duration-200 ${
              on ? "border-mint bg-mint/12 shadow-[0_6px_16px_-8px_rgb(0_200_181/0.8)]" : "border-line bg-surface-2/70 hover:border-brand"
            }`}
            title={t("netN").replace("{n}", visual.id + 1)}
          >
            <svg viewBox={`0 0 ${side} ${side}`} className={`w-[72%] h-[72%] transition-transform duration-300 ${on ? "scale-105" : ""}`} aria-hidden="true">
              <g transform={`translate(${(side - visual.width) / 2} ${(side - visual.height) / 2})`}>
                {visual.coords.map((c) => (
                  <rect
                    key={c.path}
                    x={c.x + 0.04}
                    y={c.y + 0.04}
                    width="0.92"
                    height="0.92"
                    rx="0.14"
                    fill={on ? (c.parentPath == null ? "#177681" : "#00c8b5") : "var(--muted)"}
                    fillOpacity={on ? 1 : c.parentPath == null ? 0.85 : 0.45}
                  />
                ))}
              </g>
            </svg>
            <span className={`absolute top-1 left-1.5 text-[10px] font-display font-semibold ${on ? "text-brand-ink" : "text-muted"}`}>{visual.id + 1}</span>
          </button>
        );
      })}
    </div>
  );
}
