import { useMemo } from "react";
import { VALID_CUBE_NETS } from "../canvas/netsConfig";
import { layoutNet, resolveFaceIds } from "../../lib/netGeometry";

/** A saved box drawn as its flat net: each square shows that face's colour / picture. */
export default function NetThumb({ facesConfig, activeNetId = 0, netRotation = 0, netFlipX = false, netFlipY = false, className = "" }) {
  const layout = useMemo(() => {
    const net = VALID_CUBE_NETS[activeNetId] || VALID_CUBE_NETS[0];
    const transform = { rotation: netRotation, flipX: netFlipX, flipY: netFlipY };
    try {
      const ids = resolveFaceIds(net, transform);
      const { cells, columns, rows } = layoutNet(net, transform);
      return { cells: cells.map((c) => ({ ...c, faceId: ids.get(c.path) })), columns, rows };
    } catch {
      return null;
    }
  }, [activeNetId, netRotation, netFlipX, netFlipY]);

  if (!layout) return null;
  const side = Math.max(layout.columns, layout.rows);
  return (
    <div className={`relative ${className}`} style={{ aspectRatio: "1" }} aria-hidden="true">
      <div
        className="absolute"
        style={{
          left: `${((side - layout.columns) / 2 / side) * 100}%`,
          top: `${((side - layout.rows) / 2 / side) * 100}%`,
          width: `${(layout.columns / side) * 100}%`,
          height: `${(layout.rows / side) * 100}%`,
        }}
      >
        {layout.cells.map((c) => {
          const f = facesConfig?.[c.faceId] || {};
          return (
            <div
              key={c.path}
              className="absolute p-[2%]"
              style={{ left: `${(c.x / layout.columns) * 100}%`, top: `${(c.y / layout.rows) * 100}%`, width: `${100 / layout.columns}%`, height: `${100 / layout.rows}%` }}
            >
              <div className="w-full h-full rounded-[12%] overflow-hidden border border-black/10" style={{ background: f.color || "#fff" }}>
                {f.textureUrl && (
                  <img
                    src={f.textureUrl}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover"
                    style={{ transform: `rotate(${f.rotation || 0}deg) scale(${f.flipX ? -1 : 1}, ${f.flipY ? -1 : 1})` }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
