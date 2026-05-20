import { useMemo } from "react";

// ---------------------------------------------------------------------------
// MAPEAMENTOS
// ---------------------------------------------------------------------------
const THICKNESS_MAP = {
  "Muito estreito": 18,
  "Estreito":       32,
  "Intermediário":  55,
  "Espesso":        85,
  "Muito espesso":  120,
};

const DEPTH_RANGE = [50, 1200];
const W = 680, H = 420, CX = 310, SURFACE_Y = 80;

function depthClass(d) {
  const m = parseFloat(d);
  if (isNaN(m)) return null;
  if (m <= 100) return { label: "Rasa",          color: "#0f766e" };
  if (m <= 600) return { label: "Intermediária",  color: "#1d6fa4" };
  return              { label: "Profunda",        color: "#7c3aed" };
}

function dipClassLabel(deg) {
  const d = parseFloat(deg);
  if (isNaN(d)) return "";
  if (d < 20)  return "Plano";
  if (d <= 55) return "Intermediário";
  return "Inclinado";
}

function seededRand(seed) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

// ---------------------------------------------------------------------------
// GEOMETRIA DO CORPO DE MINÉRIO
// ---------------------------------------------------------------------------
function orePolygon(shape, halfLen, hw, CX, centerY, dx, dy, nx, ny) {
  if (shape === "Massivo") {
    const rx = halfLen * 0.7, ry = hw * 0.9;
    return Array.from({ length: 25 }, (_, i) => {
      const rad = (i / 24) * Math.PI * 2;
      return `${CX + rx * Math.cos(rad) * dx - ry * Math.sin(rad) * nx},${centerY + rx * Math.cos(rad) * dy - ry * Math.sin(rad) * ny}`;
    }).join(" ");
  }
  if (shape === "Irregular") {
    const seed = [0.9, 1.2, 0.7, 1.3, 0.8, 1.1, 1.4, 0.6];
    return Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      return `${CX + halfLen * 0.6 * seed[i] * Math.cos(a) * dx - hw * seed[(i + 3) % 8] * Math.sin(a) * nx},${centerY + halfLen * 0.6 * seed[i] * Math.cos(a) * dy - hw * seed[(i + 3) % 8] * Math.sin(a) * ny}`;
    }).join(" ");
  }
  // Tabular
  const p1x = CX - halfLen * dx - hw * nx, p1y = centerY - halfLen * dy - hw * ny;
  const p2x = CX + halfLen * dx - hw * nx, p2y = centerY + halfLen * dy - hw * ny;
  const p3x = CX + halfLen * dx + hw * nx, p3y = centerY + halfLen * dy + hw * ny;
  const p4x = CX - halfLen * dx + hw * nx, p4y = centerY - halfLen * dy + hw * ny;
  return `${p1x},${p1y} ${p2x},${p2y} ${p3x},${p3y} ${p4x},${p4y}`;
}

// ---------------------------------------------------------------------------
// COMPONENTE
// ---------------------------------------------------------------------------
export default function DepositSketch({ shape, thickness, dip, depth, grade }) {
  const hw      = THICKNESS_MAP[thickness] || 32;
  const dipDeg  = parseFloat(dip)   || 0;
  const depthM  = parseFloat(depth) || 400;
  const halfLen = 90;

  const dipRad  = (dipDeg * Math.PI) / 180;
  const depthPx = H - SURFACE_Y - 20;
  const mPerPx  = DEPTH_RANGE[1] / depthPx;
  // centerY mínimo: garante que o corpo de minério nunca fique acima da superfície
  // considera a espessura máxima + margem de segurança
  const centerYRaw = SURFACE_Y + depthM / mPerPx;
  const centerY    = Math.max(centerYRaw, SURFACE_Y + hw * 2 + 20);

  const dx = Math.cos(dipRad), dy = Math.sin(dipRad);
  const nx = -dy,             ny =  dx;

  const poly    = orePolygon(shape || "Tabular", halfLen, hw, CX, centerY, dx, dy, nx, ny);
  const dc      = depthClass(depthM);
  const arrowX  = CX + halfLen + 22;
  const hwOff   = hw * 1.8;

  // HW zone points (tabular only)
  const h1x = CX - halfLen*dx - hwOff*nx, h1y = centerY - halfLen*dy - hwOff*ny;
  const h2x = CX + halfLen*dx - hwOff*nx, h2y = centerY + halfLen*dy - hwOff*ny;
  const h3x = CX + halfLen*dx - hw*nx,    h3y = centerY + halfLen*dy - hw*ny;
  const h4x = CX - halfLen*dx - hw*nx,    h4y = centerY - halfLen*dy - hw*ny;
  const hwPoly = `${h1x},${h1y} ${h2x},${h2y} ${h3x},${h3y} ${h4x},${h4y}`;

  // FW zone points (tabular only)
  const f1x = CX - halfLen*dx + hw*nx,    f1y = centerY - halfLen*dy + hw*ny;
  const f2x = CX + halfLen*dx + hw*nx,    f2y = centerY + halfLen*dy + hw*ny;
  const f3x = CX + halfLen*dx + hwOff*nx, f3y = centerY + halfLen*dy + hwOff*ny;
  const f4x = CX - halfLen*dx + hwOff*nx, f4y = centerY - halfLen*dy + hwOff*ny;
  const fwPoly = `${f1x},${f1y} ${f2x},${f2y} ${f3x},${f3y} ${f4x},${f4y}`;

  // Erratic blobs
  const erraticBlobs = useMemo(() => {
    const rand = seededRand(7);
    return Array.from({ length: 9 }, () => {
      const t = rand() * 2 - 1;
      const n = rand() * 1.4 - 0.7;
      return {
        cx: CX + t * halfLen * 0.75 * dx + n * hw * nx,
        cy: centerY + t * halfLen * 0.75 * dy + n * hw * ny,
        r:  rand() * hw * 0.3 + hw * 0.12,
        op: rand() * 0.35 + 0.2,
      };
    });
  }, [shape, hw, dipDeg, depthM]);

  const gradId  = `ore-grad-${dipDeg}-${depthM}`;
  const isTabular = (shape || "Tabular") === "Tabular";
  const lx = W - 168, ly = SURFACE_Y + 16;

  const shapeLabel = { Massivo: "Massivo", Tabular: "Tabular", Irregular: "Irregular" };

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      style={{ display: "block", borderRadius: "8px" }}
    >
      <title>Seção transversal do depósito</title>
      <desc>Visualização geométrica do depósito mineral gerada a partir dos inputs do formulário.</desc>

      <defs>
        {/* Recorta tudo abaixo da linha da superfície */}
        <clipPath id="below-surface">
          <rect x="0" y={SURFACE_Y} width={W} height={H - SURFACE_Y} />
        </clipPath>

        <marker id="sk-arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </marker>

        {/* Uniforme — hachura diagonal */}
        <pattern id="ore-uniforme" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke="#5bc0de" strokeWidth="1.5" opacity="0.45"/>
        </pattern>

        {/* Gradacional — gradiente linear */}
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#1e3a5f" stopOpacity="0.95"/>
          <stop offset="60%"  stopColor="#1d6fa4" stopOpacity="0.7"/>
          <stop offset="100%" stopColor="#5bc0de" stopOpacity="0.25"/>
        </linearGradient>

        {/* HW/FW dot patterns */}
        <pattern id="sk-hw" patternUnits="userSpaceOnUse" width="6" height="6">
          <circle cx="3" cy="3" r="0.8" fill="#64748b" opacity="0.35"/>
        </pattern>
        <pattern id="sk-fw" patternUnits="userSpaceOnUse" width="6" height="6">
          <circle cx="3" cy="3" r="0.8" fill="#64748b" opacity="0.35"/>
        </pattern>
      </defs>

      {/* Superfície */}
      <rect x="0" y="0" width={W} height={SURFACE_Y} fill="#f1f5f9" opacity="0.6"/>
      <line x1="0" y1={SURFACE_Y} x2={W} y2={SURFACE_Y} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6 4"/>
      <text x="34" y={SURFACE_Y / 2} textAnchor="middle" dominantBaseline="central" fontSize="12" fill="#64748b">Superfície</text>

      {/* Rocha */}
      <rect x="0" y={SURFACE_Y} width={W} height={H - SURFACE_Y} fill="#e2e8f0" opacity="0.25"/>

      {/* Escala de profundidade */}
      <line x1="44" y1={SURFACE_Y} x2="44" y2={H - 20} stroke="#cbd5e1" strokeWidth="0.8"/>
      {[100, 300, 600, 900, 1200].map(m => {
        const py = SURFACE_Y + m / mPerPx;
        if (py > H - 20) return null;
        return (
          <g key={m}>
            <line x1="40" y1={py} x2="48" y2={py} stroke="#94a3b8" strokeWidth="0.8"/>
            <text x="38" y={py} textAnchor="end" dominantBaseline="central" fontSize="11" fill="#94a3b8">{m}m</text>
          </g>
        );
      })}

      {/* HW, FW e ore — recortados pela superfície */}
      <g clipPath="url(#below-surface)">

        {/* HW e FW (só tabular) */}
        {isTabular && (
          <>
            <polygon points={hwPoly} fill="url(#sk-hw)" stroke="#cbd5e1" strokeWidth="0.8" strokeDasharray="4 3"/>
            <text x={(h1x+h2x)/2 - 8} y={(h1y+h2y)/2 - 12} textAnchor="middle" dominantBaseline="central" fontSize="11" fill="#64748b">HW</text>
            <polygon points={fwPoly} fill="url(#sk-fw)" stroke="#cbd5e1" strokeWidth="0.8" strokeDasharray="4 3"/>
            <text x={(f3x+f4x)/2 + 8} y={(f3y+f4y)/2 + 12} textAnchor="middle" dominantBaseline="central" fontSize="11" fill="#64748b">FW</text>
          </>
        )}

        {/* Corpo de minério — base */}
        <polygon points={poly} fill="#1e3a5f" opacity="0.80" stroke="#1d6fa4" strokeWidth="1.5"/>

        {/* Overlay de distribuição de teores */}
        {grade === "Uniforme" && (
          <polygon points={poly} fill="url(#ore-uniforme)"/>
        )}
        {grade === "Gradacional" && (
          <>
            <polygon points={poly} fill={`url(#${gradId})`} opacity="0.9"/>
            <text
              x={CX - halfLen * dx - hw * nx - 6}
              y={centerY - halfLen * dy - hw * ny - 14}
              textAnchor="middle" dominantBaseline="central" fontSize="11" fill="#5bc0de"
            >teor ↑</text>
          </>
        )}
        {grade === "Errático" && erraticBlobs.map((b, i) => (
          <circle key={i} cx={b.cx} cy={b.cy} r={b.r} fill="#5bc0de" opacity={b.op}/>
        ))}

      </g>

      {/* Seta de profundidade */}
      {dc && (
        <>
          <line
            x1={arrowX} y1={SURFACE_Y + 4}
            x2={arrowX} y2={centerY - 4}
            stroke="#1d6fa4" strokeWidth="1" strokeDasharray="4 3"
            markerEnd="url(#sk-arr)"
          />
          <text x={arrowX + 8} y={(SURFACE_Y + centerY) / 2}      textAnchor="start" dominantBaseline="central" fontSize="12" fill={dc.color}>{depthM}m</text>
          <text x={arrowX + 8} y={(SURFACE_Y + centerY) / 2 + 16} textAnchor="start" dominantBaseline="central" fontSize="11" fill={dc.color}>{dc.label}</text>
        </>
      )}

      {/* Indicador de mergulho */}
      {dipDeg > 5 && (() => {
        const p0x = CX - halfLen * dx, p0y = centerY - halfLen * dy;
        const p1x = p0x + 32 * dx,    p1y = p0y + 32 * dy;
        return (
          <>
            <path d={`M${p0x} ${p0y} L${p1x} ${p1y}`} stroke="#b45309" strokeWidth="1" fill="none"/>
            <text x={p0x + 38} y={p0y + (dipDeg > 45 ? 18 : -10)} textAnchor="start" dominantBaseline="central" fontSize="11" fill="#b45309">{dipDeg}°</text>
          </>
        );
      })()}

      {/* Legenda */}
      <rect x={lx - 8} y={ly - 8} width="164" height="88" rx="6" fill="white" fillOpacity="0.85" stroke="#e2e8f0" strokeWidth="0.8"/>
      <rect x={lx} y={ly + 2}  width="14" height="10" fill="#1e3a5f" opacity="0.8" rx="2"/>
      <text x={lx + 20} y={ly + 8}  textAnchor="start" dominantBaseline="central" fontSize="11" fill="#475569">Corpo de minério</text>
      <rect x={lx} y={ly + 22} width="14" height="10" fill="url(#sk-hw)" stroke="#cbd5e1" strokeWidth="0.6" rx="2"/>
      <text x={lx + 20} y={ly + 28} textAnchor="start" dominantBaseline="central" fontSize="11" fill="#475569">Hanging wall</text>
      <rect x={lx} y={ly + 42} width="14" height="10" fill="url(#sk-fw)" stroke="#cbd5e1" strokeWidth="0.6" rx="2"/>
      <text x={lx + 20} y={ly + 48} textAnchor="start" dominantBaseline="central" fontSize="11" fill="#475569">Foot wall</text>
      <rect x={lx} y={ly + 62} width="14" height="10" fill="#5bc0de" opacity="0.5" rx="2"/>
      <text x={lx + 20} y={ly + 68} textAnchor="start" dominantBaseline="central" fontSize="11" fill="#475569">
        {{ Uniforme: "Teor uniforme", Gradacional: "Teor gradacional", Errático: "Teor errático" }[grade] || "Teor"}
      </text>

      {/* Rodapé */}
      <text x={CX} y={H - 10} textAnchor="middle" dominantBaseline="central" fontSize="11" fill="#94a3b8">
        {`Mergulho: ${dipClassLabel(dipDeg)}  |  Forma: ${shape || "Tabular"}`}
      </text>
    </svg>
  );
}