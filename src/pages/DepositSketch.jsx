import { useTranslation } from "react-i18next";
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

// Retorna a chave canônica da classe de mergulho (traduzida no render via enums.dipClass).
function dipClassKey(deg) {
  const d = parseFloat(deg);
  if (isNaN(d)) return "";
  if (d < 20)  return "Plano";
  if (d <= 55) return "Intermediário";
  return "Inclinado";
}

// ---------------------------------------------------------------------------
// GEOMETRIA DO CORPO DE MINÉRIO
// ---------------------------------------------------------------------------
function closedPathD(points) {
  const [first, ...rest] = points;
  return `M ${first[0]},${first[1]} ` + rest.map(([x, y]) => `L ${x},${y}`).join(" ") + " Z";
}

// Suaviza um polígono fechado com curvas de Bézier quadráticas: cada vértice
// original vira ponto de controle, e a curva passa pelos pontos médios entre
// vértices consecutivos — elimina pontas agudas mantendo o contorno irregular.
function smoothedClosedPathD(points) {
  const n = points.length;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(points[n - 1], points[0]);
  let d = `M ${m0[0]},${m0[1]} `;
  for (let i = 0; i < n; i++) {
    const cur  = points[i];
    const next = points[(i + 1) % n];
    const m    = mid(cur, next);
    d += `Q ${cur[0]},${cur[1]} ${m[0]},${m[1]} `;
  }
  return d + "Z";
}

function orePolygon(shape, halfLen, hw, cx, centerY, dx, dy, nx, ny) {
  if (shape === "Massivo") {
    const rx = halfLen * 1.1, ry = hw * 1.4;
    const points = Array.from({ length: 25 }, (_, i) => {
      const rad = (i / 24) * Math.PI * 2;
      return [
        cx + rx * Math.cos(rad) * dx - ry * Math.sin(rad) * nx,
        centerY + rx * Math.cos(rad) * dy - ry * Math.sin(rad) * ny,
      ];
    });
    return closedPathD(points);
  }
  if (shape === "Irregular") {
    // Variação de raio moderada para evitar pontas estreladas mesmo antes da suavização
    const radios = [0.58, 1.42, 0.7, 1.54, 0.52, 1.24, 1.48, 0.64, 1.36, 0.58, 1.3, 0.88];
    const offDeg = [20, -18, 25, -10, 22, -20, 15, -25, 18, -15, 20, -12];
    const N      = 12;
    const baseL  = halfLen * 0.65;
    const baseP  = hw * 0.9;
    const points = Array.from({ length: N }, (_, i) => {
      const a  = (i / N) * Math.PI * 2 + offDeg[i] * (Math.PI / 180);
      const rL = baseL * radios[i];
      const rP = baseP * radios[i];
      return [
        cx + rL * Math.cos(a) * dx - rP * Math.sin(a) * nx,
        centerY + rL * Math.cos(a) * dy - rP * Math.sin(a) * ny,
      ];
    });
    return smoothedClosedPathD(points);
  }
  // Tabular
  const p1 = [cx - halfLen * dx - hw * nx, centerY - halfLen * dy - hw * ny];
  const p2 = [cx + halfLen * dx - hw * nx, centerY + halfLen * dy - hw * ny];
  const p3 = [cx + halfLen * dx + hw * nx, centerY + halfLen * dy + hw * ny];
  const p4 = [cx - halfLen * dx + hw * nx, centerY - halfLen * dy + hw * ny];
  return closedPathD([p1, p2, p3, p4]);
}

// ---------------------------------------------------------------------------
// COMPONENTE
// ---------------------------------------------------------------------------
export default function DepositSketch({ shape, thickness, dip, depth, grade }) {
  const { t }     = useTranslation();
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

  const gradId     = `ore-grad-${dipDeg}-${depthM}`;
  const lx         = W - 168, ly = SURFACE_Y + 16;
  const gradeLabel = grade ? t(`deposit.gradeLabels.${grade}`) : "";
  const dipKey     = dipClassKey(dipDeg);

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      style={{ display: "block", borderRadius: "8px", maxWidth: "100%", height: "auto" }}
    >
      <title>{t("deposit.svgTitle")}</title>
      <desc>{t("deposit.svgDesc")}</desc>

      <defs>
        <clipPath id="below-surface">
          <rect x="0" y={SURFACE_Y} width={W} height={H - SURFACE_Y} />
        </clipPath>

        {/* Recorte pelo polígono do corpo de minério — usado pela textura do errático */}
        <clipPath id="ore-clip">
          <path d={poly} />
        </clipPath>

        {/* Teor errático: ruído fractal colorizado (efeito mármore).
            1) feTurbulence gera ruído orgânico em escala de cinza (seed fixa → reproduzível).
            2) feColorMatrix colapsa o ruído para luminância e estica o contraste
               (ganho 0.825, viés -0.75) para usar toda a faixa da escala.
            3) feComponentTransfer mapeia essa luminância (0→1) para a paleta rainbow
               via tabelas por canal: frio/pobre (azul) nas zonas baixas, quente/rico
               (vermelho) nas altas — mesmas 5 cores do gradacional, misturadas sem ordem. */}
        <filter id="erratic-noise" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="4" seed="17" result="noise"/>
          <feColorMatrix in="noise" type="matrix"
            values="0.825 0.825 0.825 0 -0.75
                    0.825 0.825 0.825 0 -0.75
                    0.825 0.825 0.825 0 -0.75
                    0     0     0     0  1" result="gray"/>
          <feComponentTransfer in="gray">
            <feFuncR type="table" tableValues="0.231 0.133 0.980 0.976 0.863"/>
            <feFuncG type="table" tableValues="0.510 0.773 0.800 0.451 0.149"/>
            <feFuncB type="table" tableValues="0.965 0.369 0.082 0.086 0.149"/>
          </feComponentTransfer>
        </filter>

        <pattern id="ore-uniforme" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke="#5bc0de" strokeWidth="1.5" opacity="0.45"/>
        </pattern>

        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#dc2626"/>
          <stop offset="25%"  stopColor="#f97316"/>
          <stop offset="50%"  stopColor="#facc15"/>
          <stop offset="75%"  stopColor="#22c55e"/>
          <stop offset="100%" stopColor="#3b82f6"/>
        </linearGradient>

        <linearGradient id="legend-rainbow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#dc2626"/>
          <stop offset="25%"  stopColor="#f97316"/>
          <stop offset="50%"  stopColor="#facc15"/>
          <stop offset="75%"  stopColor="#22c55e"/>
          <stop offset="100%" stopColor="#3b82f6"/>
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
      <text x="34" y={SURFACE_Y / 2} textAnchor="middle" dominantBaseline="central" fontSize="12" fill="#64748b">{t("deposit.surface")}</text>

      {/* Rocha */}
      <rect x="0" y={SURFACE_Y} width={W} height={H - SURFACE_Y} fill="#e2e8f0" opacity="0.25"/>

      {/* HW, FW e ore — recortados pela superfície */}
      <g clipPath="url(#below-surface)">

        {isTabular && (
          <>
            <polygon points={hwPoly} fill="url(#sk-hw)" stroke="#cbd5e1" strokeWidth="0.8" strokeDasharray="4 3" strokeLinejoin="round"/>
            <text x={(h1x+h2x)/2 - 8} y={(h1y+h2y)/2 - 12} textAnchor="middle" dominantBaseline="central" fontSize="11" fill="#64748b">HW</text>
            <polygon points={fwPoly} fill="url(#sk-fw)" stroke="#cbd5e1" strokeWidth="0.8" strokeDasharray="4 3" strokeLinejoin="round"/>
            <text x={(f3x+f4x)/2 + 8} y={(f3y+f4y)/2 + 12} textAnchor="middle" dominantBaseline="central" fontSize="11" fill="#64748b">FW</text>
          </>
        )}

        <path d={poly} fill="#1e3a5f" opacity="0.80" stroke="#1d6fa4" strokeWidth="1.5" strokeLinejoin="round"/>

        {grade === "Uniforme" && (
          <path d={poly} fill="url(#ore-uniforme)"/>
        )}
        {grade === "Gradacional" && (
          <>
            <path d={poly} fill={`url(#${gradId})`} opacity="0.9"/>
            <path d={poly} fill="url(#grad-white-overlay)"/>
            <text
              x={CX - halfLen * dx - oreHw * nx - 6}
              y={centerY - halfLen * dy - oreHw * ny - 14}
              textAnchor="middle" dominantBaseline="central" fontSize="11" fill="#dc2626"
            >{t("deposit.gradeArrow")}</text>
          </>
        )}
        {grade === "Errático" && (
          <>
            {/* Textura de ruído fractal colorizado (mármore), recortada pelo polígono
                do ore para não vazar. Comunica zonas ricas e pobres misturadas sem
                ordem previsível, usando a mesma escala de cor do gradacional. */}
            <g clipPath="url(#ore-clip)">
              <rect
                x="0" y={SURFACE_Y} width={W} height={H - SURFACE_Y}
                filter="url(#erratic-noise)" opacity="0.9"
              />
            </g>
          </>
        )}

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
      <text x={lx + 20} y={ly + 8}  textAnchor="start" dominantBaseline="central" fontSize="11" fill="#475569">{t("zones.ore")}</text>
      <rect x={lx} y={ly + 22} width="14" height="10" fill="url(#sk-hw)" stroke="#cbd5e1" strokeWidth="0.6" rx="2"/>
      <text x={lx + 20} y={ly + 28} textAnchor="start" dominantBaseline="central" fontSize="11" fill="#475569">{t("zones.hangingWall")}</text>
      <rect x={lx} y={ly + 42} width="14" height="10" fill="url(#sk-fw)" stroke="#cbd5e1" strokeWidth="0.6" rx="2"/>
      <text x={lx + 20} y={ly + 48} textAnchor="start" dominantBaseline="central" fontSize="11" fill="#475569">{t("zones.footwall")}</text>
      <rect x={lx} y={ly + 62} width="14" height="10" rx="2"
        fill={grade === "Gradacional" || grade === "Errático" ? "url(#legend-rainbow)" : "#5bc0de"}
        opacity={grade === "Gradacional" || grade === "Errático" ? 1 : 0.5}/>
      <text x={lx + 20} y={ly + 68} textAnchor="start" dominantBaseline="central" fontSize="11" fill="#475569">{gradeLabel}</text>

      {/* Rodapé */}
      <text x={CX} y={H - 10} textAnchor="middle" dominantBaseline="central" fontSize="11" fill="#94a3b8">
        {`${t("deposit.dipLabel")}: ${dipKey ? t(`enums.dipClass.${dipKey}`) : ""}  |  ${t("deposit.depthLabel")}: ${t(`enums.depthFaixa.${faixaDepth}`)}`}
      </text>
    </svg>
  );
}
