import { useMemo } from "react";
import { classifyDepthSHB } from "../algorithms/algorithms";

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

const W = 680, H = 500, CX = 310, SURFACE_Y = 90;

// Posição vertical do centro do corpo de minério por faixa de profundidade.
// Posições fixas evitam que o polígono ultrapasse a superfície em ângulos altos.
const DEPTH_CENTER = {
  "Rasa":           H * 0.48,
  "Intermediária":  H * 0.58,
  "Pouco profunda": H * 0.70,
  "Profunda":       H * 0.82,
};

const GRADE_LABELS = {
  "Uniforme":    "Teor uniforme",
  "Gradacional": "Teor gradacional",
  "Errático":    "Teor errático",
};

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
function orePolygon(shape, halfLen, hw, cx, centerY, dx, dy, nx, ny) {
  if (shape === "Massivo") {
    const rx = halfLen * 1.1, ry = hw * 1.4;
    return Array.from({ length: 25 }, (_, i) => {
      const rad = (i / 24) * Math.PI * 2;
      return `${cx + rx * Math.cos(rad) * dx - ry * Math.sin(rad) * nx},${centerY + rx * Math.cos(rad) * dy - ry * Math.sin(rad) * ny}`;
    }).join(" ");
  }
  if (shape === "Irregular") {
    const radios = [0.3, 1.7, 0.5, 1.9, 0.2, 1.4, 1.8, 0.4, 1.6, 0.3, 1.5, 0.8];
    const offDeg = [20, -18, 25, -10, 22, -20, 15, -25, 18, -15, 20, -12];
    const N      = 12;
    const baseL  = halfLen * 0.65;
    const baseP  = hw * 0.9;
    return Array.from({ length: N }, (_, i) => {
      const a  = (i / N) * Math.PI * 2 + offDeg[i] * (Math.PI / 180);
      const rL = baseL * radios[i];
      const rP = baseP * radios[i];
      return `${cx + rL * Math.cos(a) * dx - rP * Math.sin(a) * nx},${centerY + rL * Math.cos(a) * dy - rP * Math.sin(a) * ny}`;
    }).join(" ");
  }
  // Tabular
  const p1x = cx - halfLen * dx - hw * nx, p1y = centerY - halfLen * dy - hw * ny;
  const p2x = cx + halfLen * dx - hw * nx, p2y = centerY + halfLen * dy - hw * ny;
  const p3x = cx + halfLen * dx + hw * nx, p3y = centerY + halfLen * dy + hw * ny;
  const p4x = cx - halfLen * dx + hw * nx, p4y = centerY - halfLen * dy + hw * ny;
  return `${p1x},${p1y} ${p2x},${p2y} ${p3x},${p3y} ${p4x},${p4y}`;
}

// ---------------------------------------------------------------------------
// COMPONENTE
// ---------------------------------------------------------------------------
export default function DepositSketch({ shape, thickness, dip, depth, grade }) {
  const hw        = THICKNESS_MAP[thickness] || 32;
  const dipDeg    = parseFloat(dip)   || 0;
  const depthM    = parseFloat(depth) || 400;
  const isTabular = (shape || "Tabular") === "Tabular";
  const halfLen   = isTabular ? 140 : 90;
  const oreHw     = isTabular ? hw * 0.6 : hw;

  const dipRad  = (dipDeg * Math.PI) / 180;

  const dx = Math.cos(dipRad), dy = Math.sin(dipRad);
  const nx = -dy,              ny =  dx;

  // Centro do corpo posicionado pela faixa de profundidade (não pelo valor numérico).
  const faixaDepth = classifyDepthSHB(depth) || "Intermediária";
  // Clamp dinâmico: garante que, mesmo com formas massivas e ângulos altos,
  // o centro nunca fique perto demais da superfície a ponto de o corpo ultrapassá-la.
  const maxRadius  = Math.max(halfLen * Math.abs(dy), oreHw * Math.abs(ny), oreHw * 1.4);
  const centerY    = Math.max(DEPTH_CENTER[faixaDepth], SURFACE_Y + maxRadius + 20);

  const poly   = orePolygon(shape || "Tabular", halfLen, oreHw, CX, centerY, dx, dy, nx, ny);
  const hwOff  = hw * 1.8;

  // HW zone
  const h1x = CX - halfLen*dx - hwOff*nx, h1y = centerY - halfLen*dy - hwOff*ny;
  const h2x = CX + halfLen*dx - hwOff*nx, h2y = centerY + halfLen*dy - hwOff*ny;
  const h3x = CX + halfLen*dx - hw*nx,    h3y = centerY + halfLen*dy - hw*ny;
  const h4x = CX - halfLen*dx - hw*nx,    h4y = centerY - halfLen*dy - hw*ny;
  const hwPoly = `${h1x},${h1y} ${h2x},${h2y} ${h3x},${h3y} ${h4x},${h4y}`;

  // FW zone
  const f1x = CX - halfLen*dx + hw*nx,    f1y = centerY - halfLen*dy + hw*ny;
  const f2x = CX + halfLen*dx + hw*nx,    f2y = centerY + halfLen*dy + hw*ny;
  const f3x = CX + halfLen*dx + hwOff*nx, f3y = centerY + halfLen*dy + hwOff*ny;
  const f4x = CX - halfLen*dx + hwOff*nx, f4y = centerY - halfLen*dy + hwOff*ny;
  const fwPoly = `${f1x},${f1y} ${f2x},${f2y} ${f3x},${f3y} ${f4x},${f4y}`;

  // Erratic blobs
  const erraticBlobs = useMemo(() => {
    const rand = seededRand(7);
    return Array.from({ length: 9 }, () => ({
      cx: CX + (rand() * 2 - 1) * halfLen * 0.75 * dx + (rand() * 1.4 - 0.7) * oreHw * nx,
      cy: centerY + (rand() * 2 - 1) * halfLen * 0.75 * dy + (rand() * 1.4 - 0.7) * oreHw * ny,
      r:  rand() * oreHw * 0.3 + oreHw * 0.12,
      op: rand() * 0.35 + 0.2,
    }));
  }, [shape, hw, dipDeg, depthM, dx, dy, nx, ny, centerY]); // eslint-disable-line

  const gradId     = `ore-grad-${dipDeg}-${depthM}`;
  const lx         = W - 168, ly = SURFACE_Y + 16;
  const gradeLabel = GRADE_LABELS[grade] || "Teor";

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
        <clipPath id="below-surface">
          <rect x="0" y={SURFACE_Y} width={W} height={H - SURFACE_Y} />
        </clipPath>

        <pattern id="ore-uniforme" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke="#5bc0de" strokeWidth="1.5" opacity="0.45"/>
        </pattern>

        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#1e3a5f" stopOpacity="1.0"/>
          <stop offset="30%"  stopColor="#1d6fa4" stopOpacity="0.7"/>
          <stop offset="100%" stopColor="#5bc0de" stopOpacity="0.05"/>
        </linearGradient>

        <linearGradient id="grad-white-overlay" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="white" stopOpacity="0.0"/>
          <stop offset="100%" stopColor="white" stopOpacity="0.75"/>
        </linearGradient>

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

      {/* HW, FW e ore — recortados pela superfície */}
      <g clipPath="url(#below-surface)">

        {isTabular && (
          <>
            <polygon points={hwPoly} fill="url(#sk-hw)" stroke="#cbd5e1" strokeWidth="0.8" strokeDasharray="4 3"/>
            <text x={(h1x+h2x)/2 - 8} y={(h1y+h2y)/2 - 12} textAnchor="middle" dominantBaseline="central" fontSize="11" fill="#64748b">HW</text>
            <polygon points={fwPoly} fill="url(#sk-fw)" stroke="#cbd5e1" strokeWidth="0.8" strokeDasharray="4 3"/>
            <text x={(f3x+f4x)/2 + 8} y={(f3y+f4y)/2 + 12} textAnchor="middle" dominantBaseline="central" fontSize="11" fill="#64748b">FW</text>
          </>
        )}

        <polygon points={poly} fill="#1e3a5f" opacity="0.80" stroke="#1d6fa4" strokeWidth="1.5"/>

        {grade === "Uniforme" && (
          <polygon points={poly} fill="url(#ore-uniforme)"/>
        )}
        {grade === "Gradacional" && (
          <>
            <polygon points={poly} fill={`url(#${gradId})`} opacity="0.9"/>
            <polygon points={poly} fill="url(#grad-white-overlay)"/>
            <text
              x={CX - halfLen * dx - oreHw * nx - 6}
              y={centerY - halfLen * dy - oreHw * ny - 14}
              textAnchor="middle" dominantBaseline="central" fontSize="11" fill="#5bc0de"
            >teor ↑</text>
          </>
        )}
        {grade === "Errático" && erraticBlobs.map((b, i) => (
          <circle key={i} cx={b.cx} cy={b.cy} r={b.r} fill="#5bc0de" opacity={b.op}/>
        ))}

      </g>

      {/* Indicador de mergulho */}
      {dipDeg > 5 && (
        <>
          <path
            d={`M${CX - halfLen * dx} ${centerY - halfLen * dy} L${CX - halfLen * dx + 32 * dx} ${centerY - halfLen * dy + 32 * dy}`}
            stroke="#b45309" strokeWidth="1" fill="none"
          />
          <text
            x={CX - halfLen * dx + 38}
            y={centerY - halfLen * dy + (dipDeg > 45 ? 18 : -10)}
            textAnchor="start" dominantBaseline="central" fontSize="11" fill="#b45309"
          >{dipDeg}°</text>
        </>
      )}

      {/* Legenda */}
      <rect x={lx - 8} y={ly - 8} width="164" height="88" rx="6" fill="white" fillOpacity="0.85" stroke="#e2e8f0" strokeWidth="0.8"/>
      <rect x={lx} y={ly + 2}  width="14" height="10" fill="#1e3a5f" opacity="0.8" rx="2"/>
      <text x={lx + 20} y={ly + 8}  textAnchor="start" dominantBaseline="central" fontSize="11" fill="#475569">Corpo de minério</text>
      <rect x={lx} y={ly + 22} width="14" height="10" fill="url(#sk-hw)" stroke="#cbd5e1" strokeWidth="0.6" rx="2"/>
      <text x={lx + 20} y={ly + 28} textAnchor="start" dominantBaseline="central" fontSize="11" fill="#475569">Hanging wall</text>
      <rect x={lx} y={ly + 42} width="14" height="10" fill="url(#sk-fw)" stroke="#cbd5e1" strokeWidth="0.6" rx="2"/>
      <text x={lx + 20} y={ly + 48} textAnchor="start" dominantBaseline="central" fontSize="11" fill="#475569">Foot wall</text>
      <rect x={lx} y={ly + 62} width="14" height="10" fill="#5bc0de" opacity="0.5" rx="2"/>
      <text x={lx + 20} y={ly + 68} textAnchor="start" dominantBaseline="central" fontSize="11" fill="#475569">{gradeLabel}</text>

      {/* Rodapé */}
      <text x={CX} y={H - 10} textAnchor="middle" dominantBaseline="central" fontSize="11" fill="#94a3b8">
        {`Mergulho: ${dipClassLabel(dipDeg)}  |  Profundidade: ${faixaDepth}`}
      </text>
    </svg>
  );
}
