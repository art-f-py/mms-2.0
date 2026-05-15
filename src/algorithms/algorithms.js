import { METHODS } from "./ubcWeights";
import { UBC_GEOMETRY, UBC_OREBODY, UBC_HANGINGWALL, UBC_FOOTWALL } from "./ubcWeights";
import { NICHOLAS81_GEOMETRY, NICHOLAS81_OREBODY, NICHOLAS81_HANGINGWALL, NICHOLAS81_FOOTWALL } from "./nicholas81Weights";
import { NICHOLAS92_GEOMETRY, NICHOLAS92_OREBODY, NICHOLAS92_HANGINGWALL, NICHOLAS92_FOOTWALL, DEFAULT_MULTIPLIERS } from "./nicholas92Weights";
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
  if (m <= 100) return "Rasa";
  if (m <= 400) return "Intermediária";
  if (m <= 600) return "Pouco profunda";
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
export function calculateUBC(fd) {
  const depthClass = classifyDepthUBC(fd.depth?.ore);
  const dipClass   = classifyDipUBC(fd.dip);
  const rssOre = classifyRSS(fd.ucs?.ore,         fd.density?.ore,         fd.depth?.ore)         || fd.rss?.ore;
  const rssHW  = classifyRSS(fd.ucs?.hangingWall, fd.density?.hangingWall, fd.depth?.hangingWall) || fd.rss?.hangingWall;
  const rssFW  = classifyRSS(fd.ucs?.footwall,    fd.density?.footwall,    fd.depth?.footwall)    || fd.rss?.footwall;

  const criteria = [
    [UBC_GEOMETRY,    "shape",     fd.geometry?.shape],
    [UBC_GEOMETRY,    "thickness", fd.geometry?.thickness],
    [UBC_GEOMETRY,    "dip",       dipClass],
    [UBC_GEOMETRY,    "grade",     fd.geometry?.grade],
    [UBC_GEOMETRY,    "depth",     depthClass],
    [UBC_OREBODY,     "rss",       rssOre],
    [UBC_OREBODY,     "rmr",       fd.rmr?.ore],
    [UBC_HANGINGWALL, "rss",       rssHW],
    [UBC_HANGINGWALL, "rmr",       fd.rmr?.hangingWall],
    [UBC_FOOTWALL,    "rss",       rssFW],
    [UBC_FOOTWALL,    "rmr",       fd.rmr?.footwall],
  ];

  const { totals, breakdown } = sumCriteria(criteria);
  return { scores: totals, ranking: [...METHODS].sort((a, b) => totals[b] - totals[a]), breakdown };
}

export function calculateNicholas81(fd) {
  const dipClass = classifyDipUBC(fd.dip);
  const rssOre = classifyRSSNicholas(fd.ucs?.ore,         fd.density?.ore,         fd.depth?.ore)         || fd.rss?.ore;
  const rssHW  = classifyRSSNicholas(fd.ucs?.hangingWall, fd.density?.hangingWall, fd.depth?.hangingWall) || fd.rss?.hangingWall;
  const rssFW  = classifyRSSNicholas(fd.ucs?.footwall,    fd.density?.footwall,    fd.depth?.footwall)    || fd.rss?.footwall;

  const criteria = [
    [NICHOLAS81_GEOMETRY,    "shape",          fd.geometry?.shape],
    [NICHOLAS81_GEOMETRY,    "thickness",      fd.geometry?.thickness],
    [NICHOLAS81_GEOMETRY,    "dip",            dipClass],
    [NICHOLAS81_GEOMETRY,    "grade",          fd.geometry?.grade],
    [NICHOLAS81_OREBODY,     "rss",            rssOre],
    [NICHOLAS81_OREBODY,     "jointSpacing",   fd.jointSpacing?.ore],
    [NICHOLAS81_OREBODY,     "jointCondition", fd.jointCondition?.ore],
    [NICHOLAS81_HANGINGWALL, "rss",            rssHW],
    [NICHOLAS81_HANGINGWALL, "jointSpacing",   fd.jointSpacing?.hangingWall],
    [NICHOLAS81_HANGINGWALL, "jointCondition", fd.jointCondition?.hangingWall],
    [NICHOLAS81_FOOTWALL,    "rss",            rssFW],
    [NICHOLAS81_FOOTWALL,    "jointSpacing",   fd.jointSpacing?.footwall],
    [NICHOLAS81_FOOTWALL,    "jointCondition", fd.jointCondition?.footwall],
  ];

  const { totals, breakdown } = sumCriteria(criteria);
  return { scores: totals, ranking: [...METHODS].sort((a, b) => totals[b] - totals[a]), breakdown };
}

export function calculateNicholas92(fd, multipliers = DEFAULT_MULTIPLIERS) {
  const dipClass = classifyDipUBC(fd.dip);
  const { geometry: g, orebody: o, hangingWall: h, footwall: f } = multipliers;
  const rssOre = classifyRSSNicholas(fd.ucs?.ore,         fd.density?.ore,         fd.depth?.ore)         || fd.rss?.ore;
  const rssHW  = classifyRSSNicholas(fd.ucs?.hangingWall, fd.density?.hangingWall, fd.depth?.hangingWall) || fd.rss?.hangingWall;
  const rssFW  = classifyRSSNicholas(fd.ucs?.footwall,    fd.density?.footwall,    fd.depth?.footwall)    || fd.rss?.footwall;

  const criteria = [
    [NICHOLAS92_GEOMETRY,    "shape",          fd.geometry?.shape,             g],
    [NICHOLAS92_GEOMETRY,    "thickness",      fd.geometry?.thickness,         g],
    [NICHOLAS92_GEOMETRY,    "dip",            dipClass,                       g],
    [NICHOLAS92_GEOMETRY,    "grade",          fd.geometry?.grade,             g],
    [NICHOLAS92_OREBODY,     "rss",            rssOre,                         o],
    [NICHOLAS92_OREBODY,     "jointSpacing",   fd.jointSpacing?.ore,           o],
    [NICHOLAS92_OREBODY,     "jointCondition", fd.jointCondition?.ore,         o],
    [NICHOLAS92_HANGINGWALL, "rss",            rssHW,                          h],
    [NICHOLAS92_HANGINGWALL, "jointSpacing",   fd.jointSpacing?.hangingWall,   h],
    [NICHOLAS92_HANGINGWALL, "jointCondition", fd.jointCondition?.hangingWall, h],
    [NICHOLAS92_FOOTWALL,    "rss",            rssFW,                          f],
    [NICHOLAS92_FOOTWALL,    "jointSpacing",   fd.jointSpacing?.footwall,      f],
    [NICHOLAS92_FOOTWALL,    "jointCondition", fd.jointCondition?.footwall,    f],
  ];

  const { totals, breakdown } = sumCriteria(criteria);
  return { scores: totals, ranking: [...METHODS].sort((a, b) => totals[b] - totals[a]), breakdown, multipliers };
}

export function calculateSHB(fd) {
  const dipClass   = classifyDipSHB(fd.dip);
  const depthClass = classifyDepthSHB(fd.depth?.ore);
  const rssOre = classifyRSS(fd.ucs?.ore,         fd.density?.ore,         fd.depth?.ore)         || fd.rss?.ore;
  const rssHW  = classifyRSS(fd.ucs?.hangingWall, fd.density?.hangingWall, fd.depth?.hangingWall) || fd.rss?.hangingWall;
  const rssFW  = classifyRSS(fd.ucs?.footwall,    fd.density?.footwall,    fd.depth?.footwall)    || fd.rss?.footwall;

  const criteria = [
    [SHB_GEOMETRY,    "shape",     fd.geometry?.shape],
    [SHB_GEOMETRY,    "thickness", fd.geometry?.thickness],
    [SHB_GEOMETRY,    "dip",       dipClass],
    [SHB_GEOMETRY,    "grade",     fd.geometry?.grade],
    [SHB_GEOMETRY,    "depth",     depthClass],
    [SHB_ECONOMIC,    "oreValue",  fd.oreValue],
    [SHB_OREBODY,     "rss",       rssOre],
    [SHB_OREBODY,     "rmr",       fd.rmr?.ore],
    [SHB_HANGINGWALL, "rss",       rssHW],
    [SHB_HANGINGWALL, "rmr",       fd.rmr?.hangingWall],
    [SHB_FOOTWALL,    "rss",       rssFW],
    [SHB_FOOTWALL,    "rmr",       fd.rmr?.footwall],
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
