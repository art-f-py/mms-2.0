import { METHODS } from "./ubcWeights";
import { UBC_GEOMETRY, UBC_OREBODY, UBC_HANGINGWALL, UBC_FOOTWALL } from "./ubcWeights";
import { NICHOLAS_GEOMETRY, NICHOLAS_OREBODY, NICHOLAS_HANGINGWALL, NICHOLAS_FOOTWALL } from "./nicholasWeights";
import { SHB_GEOMETRY, SHB_ECONOMIC, SHB_OREBODY, SHB_HANGINGWALL, SHB_FOOTWALL } from "./shbWeights";

// ---------------------------------------------------------------------------
// CLASSIFICAÇÕES NUMÉRICAS
// ---------------------------------------------------------------------------

/**
 * RSS = UCS (MPa) × 1e6 / (Densidade (kg/m³) × Profundidade (m) × 9.81)
 * Resultado adimensional — faixas UBC/SH&B: <5 Muito fraca | 5-10 Fraca | 10-15 Moderada | ≥15 Resistente
 */
export function classifyRSS(ucs, densityKgM3, depthM) {
  const u = parseFloat(ucs);
  const d = parseFloat(densityKgM3);
  const p = parseFloat(depthM);
  if (isNaN(u) || isNaN(d) || isNaN(p) || d <= 0 || p <= 0) return "";
  const ratio = (u * 1e6) / (d * p * 9.81);
  if (ratio < 5)  return "Muito fraca";
  if (ratio < 10) return "Fraca";
  if (ratio < 15) return "Moderada";
  return "Resistente";
}

/**
 * RSS para Nicholas — faixas diferentes: <8 Fraca | 8-15 Moderada | >15 Resistente
 */
export function classifyRSSNicholas(ucs, densityKgM3, depthM) {
  const u = parseFloat(ucs);
  const d = parseFloat(densityKgM3);
  const p = parseFloat(depthM);
  if (isNaN(u) || isNaN(d) || isNaN(p) || d <= 0 || p <= 0) return "";
  const ratio = (u * 1e6) / (d * p * 9.81);
  if (ratio < 8)  return "Fraca";
  if (ratio <= 15) return "Moderada";
  return "Resistente";
}

export function classifyDepthUBC(meters) {
  const m = parseFloat(meters);
  if (isNaN(m)) return "";
  if (m <= 100) return "Rasa";
  if (m <= 600) return "Intermediária";
  return "Profunda";
}

export function classifyDepthSHB(meters) {
  const m = parseFloat(meters);
  if (isNaN(m)) return "";
  if (m <= 200) return "Rasa";
  if (m <= 500) return "Intermediária";
  if (m <= 800) return "Pouco profunda";
  return "Profunda";
}

export function classifyDipUBC(degrees) {
  const d = parseFloat(degrees);
  if (isNaN(d)) return "";
  if (d < 20)  return "Plano";
  if (d <= 55) return "Intermediário";
  return "Inclinado";
}

export function classifyDipSHB(degrees) {
  const d = parseFloat(degrees);
  if (isNaN(d)) return "";
  if (d < 15)  return "Plano";
  if (d < 30)  return "Baixo";
  if (d < 45)  return "Intermediário";
  if (d < 60)  return "Pouco inclinado";
  return "Inclinado";
}

// ---------------------------------------------------------------------------
// PESOS PADRÃO POR CRITÉRIO
// ---------------------------------------------------------------------------
const DEFAULT_CRITERIA_WEIGHTS = {
  shape: 1, thickness: 1, dip: 1, grade: 1, depth: 1,
  rss: 1, rmr: 1, jointSpacing: 1, jointCondition: 1, oreValue: 1,
};

// Multiplicadores de domínio padrão (Nicholas 92)
const DEFAULT_DOMAIN = { geo: 1, ob: 1, hw: 1, fw: 1 };

// ---------------------------------------------------------------------------
// FUNÇÃO GENÉRICA DE PONTUAÇÃO
// ---------------------------------------------------------------------------
function sumCriteria(criteria) {
  const totals    = Object.fromEntries(METHODS.map((m) => [m, 0]));
  const breakdown = {};

  for (const [table, key, selectedValue, multiplier = 1] of criteria) {
    if (!selectedValue || selectedValue === "") continue;
    const scores = table[key]?.options?.[selectedValue];
    if (!scores) continue;

    const bKey = `${key}__${selectedValue}`;
    breakdown[bKey] = {};

    METHODS.forEach((method, i) => {
      const s = scores[i];
      if (s === null || s === undefined) return;
      const weighted = s * multiplier;
      breakdown[bKey][method] = weighted;
      totals[method] += weighted;
    });
  }

  return { totals, breakdown };
}

// ---------------------------------------------------------------------------
// ALGORITMOS
// ---------------------------------------------------------------------------
export function calculateUBC(fd, criteriaWeights = {}) {
  const w          = { ...DEFAULT_CRITERIA_WEIGHTS, ...criteriaWeights };
  const depthClass = classifyDepthUBC(fd.depth?.ore);
  const dipClass   = classifyDipUBC(fd.dip);
  const rssOre = classifyRSS(fd.ucs?.ore,         fd.density?.ore,         fd.depth?.ore)         || fd.rss?.ore;
  const rssHW  = classifyRSS(fd.ucs?.hangingWall, fd.density?.hangingWall, fd.depth?.hangingWall) || fd.rss?.hangingWall;
  const rssFW  = classifyRSS(fd.ucs?.footwall,    fd.density?.footwall,    fd.depth?.footwall)    || fd.rss?.footwall;

  const criteria = [
    [UBC_GEOMETRY,    "shape",     fd.geometry?.shape,        w.shape],
    [UBC_GEOMETRY,    "thickness", fd.geometry?.thickness,    w.thickness],
    [UBC_GEOMETRY,    "dip",       dipClass,                  w.dip],
    [UBC_GEOMETRY,    "grade",     fd.geometry?.grade,        w.grade],
    [UBC_GEOMETRY,    "depth",     depthClass,                w.depth],
    [UBC_OREBODY,     "rss",       rssOre,                    w.rss],
    [UBC_OREBODY,     "rmr",       fd.rmr?.ore,               w.rmr],
    [UBC_HANGINGWALL, "rss",       rssHW,                     w.rss],
    [UBC_HANGINGWALL, "rmr",       fd.rmr?.hangingWall,       w.rmr],
    [UBC_FOOTWALL,    "rss",       rssFW,                     w.rss],
    [UBC_FOOTWALL,    "rmr",       fd.rmr?.footwall,          w.rmr],
  ];

  const { totals, breakdown } = sumCriteria(criteria);
  return { scores: totals, ranking: [...METHODS].sort((a, b) => totals[b] - totals[a]), breakdown };
}

export function calculateNicholas(fd, criteriaWeights = {}) {
  const w        = { ...DEFAULT_CRITERIA_WEIGHTS, ...criteriaWeights };
  const domain   = { ...DEFAULT_DOMAIN, ...(criteriaWeights.domain || {}) };
  const dipClass = classifyDipUBC(fd.dip);
  const rssOre = classifyRSSNicholas(fd.ucs?.ore,         fd.density?.ore,         fd.depth?.ore)         || fd.rss?.ore;
  const rssHW  = classifyRSSNicholas(fd.ucs?.hangingWall, fd.density?.hangingWall, fd.depth?.hangingWall) || fd.rss?.hangingWall;
  const rssFW  = classifyRSSNicholas(fd.ucs?.footwall,    fd.density?.footwall,    fd.depth?.footwall)    || fd.rss?.footwall;

  const criteria = [
    // Geometria — multiplicador de domínio geo
    [NICHOLAS_GEOMETRY,    "shape",          fd.geometry?.shape,             w.shape     * domain.geo],
    [NICHOLAS_GEOMETRY,    "thickness",      fd.geometry?.thickness,         w.thickness * domain.geo],
    [NICHOLAS_GEOMETRY,    "dip",            dipClass,                       w.dip       * domain.geo],
    [NICHOLAS_GEOMETRY,    "grade",          fd.geometry?.grade,             w.grade     * domain.geo],
    // Corpo de minério — multiplicador de domínio ob
    [NICHOLAS_OREBODY,     "rss",            rssOre,                         w.rss            * domain.ob],
    [NICHOLAS_OREBODY,     "jointSpacing",   fd.jointSpacing?.ore,           w.jointSpacing   * domain.ob],
    [NICHOLAS_OREBODY,     "jointCondition", fd.jointCondition?.ore,         w.jointCondition * domain.ob],
    // Hanging wall — multiplicador de domínio hw
    [NICHOLAS_HANGINGWALL, "rss",            rssHW,                          w.rss            * domain.hw],
    [NICHOLAS_HANGINGWALL, "jointSpacing",   fd.jointSpacing?.hangingWall,   w.jointSpacing   * domain.hw],
    [NICHOLAS_HANGINGWALL, "jointCondition", fd.jointCondition?.hangingWall, w.jointCondition * domain.hw],
    // Foot wall — multiplicador de domínio fw
    [NICHOLAS_FOOTWALL,    "rss",            rssFW,                          w.rss            * domain.fw],
    [NICHOLAS_FOOTWALL,    "jointSpacing",   fd.jointSpacing?.footwall,      w.jointSpacing   * domain.fw],
    [NICHOLAS_FOOTWALL,    "jointCondition", fd.jointCondition?.footwall,    w.jointCondition * domain.fw],
  ];

  const { totals, breakdown } = sumCriteria(criteria);
  return { scores: totals, ranking: [...METHODS].sort((a, b) => totals[b] - totals[a]), breakdown };
}

export function calculateSHB(fd, criteriaWeights = {}) {
  const w          = { ...DEFAULT_CRITERIA_WEIGHTS, ...criteriaWeights };
  const dipClass   = classifyDipSHB(fd.dip);
  const depthClass = classifyDepthSHB(fd.depth?.ore);
  const rssOre = classifyRSS(fd.ucs?.ore,         fd.density?.ore,         fd.depth?.ore)         || fd.rss?.ore;
  const rssHW  = classifyRSS(fd.ucs?.hangingWall, fd.density?.hangingWall, fd.depth?.hangingWall) || fd.rss?.hangingWall;
  const rssFW  = classifyRSS(fd.ucs?.footwall,    fd.density?.footwall,    fd.depth?.footwall)    || fd.rss?.footwall;

  const mapRmrToSHB = (val) => ({
    "Muito pobre": "Muito fraca",
    "Pobre":       "Fraca",
    "Razoável":    "Média",
    "Boa":         "Forte",
    "Muito boa":   "Muito forte",
  }[val] || val);

  const criteria = [
    [SHB_GEOMETRY,    "shape",     fd.geometry?.shape,      w.shape],
    [SHB_GEOMETRY,    "thickness", fd.geometry?.thickness,  w.thickness],
    [SHB_GEOMETRY,    "dip",       dipClass,                w.dip],
    [SHB_GEOMETRY,    "grade",     fd.geometry?.grade,      w.grade],
    [SHB_GEOMETRY,    "depth",     depthClass,              w.depth],
    [SHB_ECONOMIC,    "oreValue",  fd.oreValue,             w.oreValue],
    [SHB_OREBODY,     "rss",       rssOre,                  w.rss],
    [SHB_OREBODY,     "rmr",       mapRmrToSHB(fd.rmr?.ore),         w.rmr],
    [SHB_HANGINGWALL, "rss",       rssHW,                   w.rss],
    [SHB_HANGINGWALL, "rmr",       mapRmrToSHB(fd.rmr?.hangingWall), w.rmr],
    [SHB_FOOTWALL,    "rss",       rssFW,                   w.rss],
    [SHB_FOOTWALL,    "rmr",       mapRmrToSHB(fd.rmr?.footwall),    w.rmr],
  ];

  const { totals, breakdown } = sumCriteria(criteria);
  return { scores: totals, ranking: [...METHODS].sort((a, b) => totals[b] - totals[a]), breakdown };
}

// ---------------------------------------------------------------------------
// NORMALIZAÇÃO (radar)
// ---------------------------------------------------------------------------
export function normalizeScores(scores) {
  const values = METHODS.map((m) => scores[m]);
  const min    = Math.min(...values);
  const max    = Math.max(...values);
  const range  = max - min || 1;
  return Object.fromEntries(
    METHODS.map((m) => [m, Math.round(((scores[m] - min) / range) * 100)])
  );
}
