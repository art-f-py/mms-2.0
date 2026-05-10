import {
  METHODS,
  UBC_GEOMETRY,
  UBC_OREBODY,
  UBC_HANGINGWALL,
  UBC_FOOTWALL,
} from "./ubcWeights";

/**
 * Calcula o ranking UBC (1995).
 * Valores -49 são tratados como penalidade — nenhum método é eliminado.
 *
 * @param {Object} formData
 *   formData.geometry  = { shape, dip, thickness, grade, depth }
 *   formData.rss       = { ore, hangingWall, footwall }
 *   formData.rmr       = { ore, hangingWall, footwall }
 *
 * @returns {{ scores, ranking, breakdown }}
 */
export function calculateUBC(formData) {
  const criteria = [
    [UBC_GEOMETRY,    "shape",     formData.geometry?.shape],
    [UBC_GEOMETRY,    "thickness", formData.geometry?.thickness],
    [UBC_GEOMETRY,    "dip",       formData.geometry?.dip],
    [UBC_GEOMETRY,    "grade",     formData.geometry?.grade],
    [UBC_GEOMETRY,    "depth",     formData.geometry?.depth],
    [UBC_OREBODY,     "rss",       formData.rss?.ore],
    [UBC_OREBODY,     "rmr",       formData.rmr?.ore],
    [UBC_HANGINGWALL, "rss",       formData.rss?.hangingWall],
    [UBC_HANGINGWALL, "rmr",       formData.rmr?.hangingWall],
    [UBC_FOOTWALL,    "rss",       formData.rss?.footwall],
    [UBC_FOOTWALL,    "rmr",       formData.rmr?.footwall],
  ];

  const totals    = Object.fromEntries(METHODS.map((m) => [m, 0]));
  const breakdown = {};

  for (const [table, key, selectedValue] of criteria) {
    if (!selectedValue || selectedValue === "") continue;

    const scores = table[key]?.options?.[selectedValue];
    if (!scores) continue;

    breakdown[`${key}__${selectedValue}`] = {};

    METHODS.forEach((method, i) => {
      const s = scores[i];
      if (s === null) return;
      breakdown[`${key}__${selectedValue}`][method] = s;
      totals[method] += s;
    });
  }

  const ranking = [...METHODS].sort((a, b) => totals[b] - totals[a]);

  return { scores: totals, ranking, breakdown };
}

/**
 * Normaliza scores para 0-100 (gráfico radar).
 */
export function normalizeScores(scores) {
  const values = METHODS.map((m) => scores[m]);
  const min    = Math.min(...values);
  const max    = Math.max(...values);
  const range  = max - min || 1;
  return Object.fromEntries(
    METHODS.map((m) => [m, Math.round(((scores[m] - min) / range) * 100)])
  );
}
