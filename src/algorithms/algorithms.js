import { METHODS } from "./ubcWeights";
import {
  UBC_GEOMETRY, UBC_OREBODY, UBC_HANGINGWALL, UBC_FOOTWALL,
} from "./ubcWeights";
import {
  NICHOLAS81_GEOMETRY, NICHOLAS81_OREBODY, NICHOLAS81_HANGINGWALL, NICHOLAS81_FOOTWALL,
} from "./nicholas81Weights";
import {
  NICHOLAS92_GEOMETRY, NICHOLAS92_OREBODY, NICHOLAS92_HANGINGWALL, NICHOLAS92_FOOTWALL,
  DEFAULT_MULTIPLIERS,
} from "./nicholas92Weights";
import {
  SHB_GEOMETRY, SHB_ECONOMIC, SHB_OREBODY, SHB_HANGINGWALL, SHB_FOOTWALL,
} from "./shbWeights";

// ---------------------------------------------------------------------------
// CLASSIFICAÇÕES NUMÉRICAS COMPARTILHADAS
// ---------------------------------------------------------------------------

/**
 * Classifica ângulo de mergulho para UBC / Nicholas (3 categorias)
 * Plano <20° | Intermediário 20-55° | Inclinado >55°
 */
export function classifyDipUBC(degrees) {
  const d = parseFloat(degrees);
  if (isNaN(d)) return "";
  if (d < 20)  return "Plano";
  if (d <= 55) return "Intermediário";
  return "Inclinado";
}

/**
 * Classifica ângulo de mergulho para SH&B (5 categorias)
 * Plano <15° | Baixo 15-30° | Intermediário 30-45° | Pouco inclinado 45-60° | Inclinado >60°
 */
export function classifyDipSHB(degrees) {
  const d = parseFloat(degrees);
  if (isNaN(d)) return "";
  if (d < 15)  return "Plano";
  if (d < 30)  return "Baixo";
  if (d < 45)  return "Intermediário";
  if (d < 60)  return "Pouco inclinado";
  return "Inclinado";
}

/**
 * Classifica profundidade para UBC (3 categorias)
 * Rasa ≤100m | Intermediária 100-600m | Profunda >600m
 */
export function classifyDepthUBC(meters) {
  const m = parseFloat(meters);
  if (isNaN(m)) return "";
  if (m <= 100) return "Rasa";
  if (m <= 600) return "Intermediária";
  return "Profunda";
}

/**
 * Classifica profundidade para SH&B (4 categorias)
 * Rasa ≤100m | Intermediária 100-400m | Pouco profunda 400-600m | Profunda >600m
 * (faixas estimadas — confirmar com orientador)
 */
export function classifyDepthSHB(meters) {
  const m = parseFloat(meters);
  if (isNaN(m)) return "";
  if (m <= 100) return "Rasa";
  if (m <= 400) return "Intermediária";
  if (m <= 600) return "Pouco profunda";
  return "Profunda";
}

// ---------------------------------------------------------------------------
// FUNÇÃO GENÉRICA DE PONTUAÇÃO
// ---------------------------------------------------------------------------

/**
 * Soma scores de uma lista de critérios sobre o vetor de métodos.
 * -49 / -50 somam como penalidade (sem eliminação).
 * null = critério não se aplica ao método (não soma).
 */
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
// ALGORITMO UBC
// ---------------------------------------------------------------------------

export function calculateUBC(formData) {
  const depthClass = classifyDepthUBC(formData.depth?.ore);
  const dipClass   = classifyDipUBC(formData.dip);

  const criteria = [
    [UBC_GEOMETRY,    "shape",     formData.geometry?.shape],
    [UBC_GEOMETRY,    "thickness", formData.geometry?.thickness],
    [UBC_GEOMETRY,    "dip",       dipClass],
    [UBC_GEOMETRY,    "grade",     formData.geometry?.grade],
    [UBC_GEOMETRY,    "depth",     depthClass],
    [UBC_OREBODY,     "rss",       formData.rss?.ore],
    [UBC_OREBODY,     "rmr",       formData.rmr?.ore],
    [UBC_HANGINGWALL, "rss",       formData.rss?.hangingWall],
    [UBC_HANGINGWALL, "rmr",       formData.rmr?.hangingWall],
    [UBC_FOOTWALL,    "rss",       formData.rss?.footwall],
    [UBC_FOOTWALL,    "rmr",       formData.rmr?.footwall],
  ];

  const { totals, breakdown } = sumCriteria(criteria);
  const ranking = [...METHODS].sort((a, b) => totals[b] - totals[a]);
  return { scores: totals, ranking, breakdown };
}

// ---------------------------------------------------------------------------
// ALGORITMO NICHOLAS 81
// ---------------------------------------------------------------------------

export function calculateNicholas81(formData) {
  const dipClass = classifyDipUBC(formData.dip);

  const criteria = [
    [NICHOLAS81_GEOMETRY,    "shape",          formData.geometry?.shape],
    [NICHOLAS81_GEOMETRY,    "thickness",      formData.geometry?.thickness],
    [NICHOLAS81_GEOMETRY,    "dip",            dipClass],
    [NICHOLAS81_GEOMETRY,    "grade",          formData.geometry?.grade],
    [NICHOLAS81_OREBODY,     "rss",            formData.rss?.ore],
    [NICHOLAS81_OREBODY,     "jointSpacing",   formData.jointSpacing?.ore],
    [NICHOLAS81_OREBODY,     "jointCondition", formData.jointCondition?.ore],
    [NICHOLAS81_HANGINGWALL, "rss",            formData.rss?.hangingWall],
    [NICHOLAS81_HANGINGWALL, "jointSpacing",   formData.jointSpacing?.hangingWall],
    [NICHOLAS81_HANGINGWALL, "jointCondition", formData.jointCondition?.hangingWall],
    [NICHOLAS81_FOOTWALL,    "rss",            formData.rss?.footwall],
    [NICHOLAS81_FOOTWALL,    "jointSpacing",   formData.jointSpacing?.footwall],
    [NICHOLAS81_FOOTWALL,    "jointCondition", formData.jointCondition?.footwall],
  ];

  const { totals, breakdown } = sumCriteria(criteria);
  const ranking = [...METHODS].sort((a, b) => totals[b] - totals[a]);
  return { scores: totals, ranking, breakdown };
}

// ---------------------------------------------------------------------------
// ALGORITMO NICHOLAS 92 (com multiplicadores ajustáveis)
// ---------------------------------------------------------------------------

export function calculateNicholas92(formData, multipliers = DEFAULT_MULTIPLIERS) {
  const dipClass = classifyDipUBC(formData.dip);
  const g = multipliers.geometry;
  const o = multipliers.orebody;
  const h = multipliers.hangingWall;
  const f = multipliers.footwall;

  const criteria = [
    [NICHOLAS92_GEOMETRY,    "shape",          formData.geometry?.shape,            g],
    [NICHOLAS92_GEOMETRY,    "thickness",      formData.geometry?.thickness,        g],
    [NICHOLAS92_GEOMETRY,    "dip",            dipClass,                            g],
    [NICHOLAS92_GEOMETRY,    "grade",          formData.geometry?.grade,            g],
    [NICHOLAS92_OREBODY,     "rss",            formData.rss?.ore,                   o],
    [NICHOLAS92_OREBODY,     "jointSpacing",   formData.jointSpacing?.ore,          o],
    [NICHOLAS92_OREBODY,     "jointCondition", formData.jointCondition?.ore,        o],
    [NICHOLAS92_HANGINGWALL, "rss",            formData.rss?.hangingWall,           h],
    [NICHOLAS92_HANGINGWALL, "jointSpacing",   formData.jointSpacing?.hangingWall,  h],
    [NICHOLAS92_HANGINGWALL, "jointCondition", formData.jointCondition?.hangingWall,h],
    [NICHOLAS92_FOOTWALL,    "rss",            formData.rss?.footwall,              f],
    [NICHOLAS92_FOOTWALL,    "jointSpacing",   formData.jointSpacing?.footwall,     f],
    [NICHOLAS92_FOOTWALL,    "jointCondition", formData.jointCondition?.footwall,   f],
  ];

  const { totals, breakdown } = sumCriteria(criteria);
  const ranking = [...METHODS].sort((a, b) => totals[b] - totals[a]);
  return { scores: totals, ranking, breakdown, multipliers };
}

// ---------------------------------------------------------------------------
// ALGORITMO SH&B
// ---------------------------------------------------------------------------

export function calculateSHB(formData) {
  const dipClass   = classifyDipSHB(formData.dip);
  const depthClass = classifyDepthSHB(formData.depth?.ore);

  const criteria = [
    [SHB_GEOMETRY,    "shape",     formData.geometry?.shape],
    [SHB_GEOMETRY,    "thickness", formData.geometry?.thickness],
    [SHB_GEOMETRY,    "dip",       dipClass],
    [SHB_GEOMETRY,    "grade",     formData.geometry?.grade],
    [SHB_GEOMETRY,    "depth",     depthClass],
    [SHB_ECONOMIC,    "oreValue",  formData.oreValue],
    [SHB_OREBODY,     "rss",       formData.rss?.ore],
    [SHB_OREBODY,     "rmr",       formData.rmr?.ore],
    [SHB_HANGINGWALL, "rss",       formData.rss?.hangingWall],
    [SHB_HANGINGWALL, "rmr",       formData.rmr?.hangingWall],
    [SHB_FOOTWALL,    "rss",       formData.rss?.footwall],
    [SHB_FOOTWALL,    "rmr",       formData.rmr?.footwall],
  ];

  const { totals, breakdown } = sumCriteria(criteria);
  const ranking = [...METHODS].sort((a, b) => totals[b] - totals[a]);
  return { scores: totals, ranking, breakdown };
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
