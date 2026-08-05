import { describe, it, expect } from "vitest";
import { calculateUBC, calculateNicholas, calculateSHB } from "../algorithms";

// ---------------------------------------------------------------------------
// ORIGEM DO RSS POR ALGORITMO
// ---------------------------------------------------------------------------
// fd.rss e o campo do select manual de RSS (Inputs.jsx), que so renderiza no
// modo Nicholas-sozinho e oferece as 3 classes da escala do Nicholas
// (Fraca <8 | Moderada 8-15 | Resistente >15).
//
// UBC e SH&B operam noutra escala (Muito fraca <5 | Fraca 5-10 | Moderada
// 10-15 | Resistente >=15). Como fd.rss persiste no localStorage e nada o
// limpa ao trocar de metodo, aceita-lo nesses dois lia a classe na escala
// errada, em silencio. Por isso o fallback existe SO no Nicholas.
//
// A checagem e feita pelo breakdown: sumCriteria so cria a linha
// `rss_<dominio>__<classe>` quando o criterio realmente pontua.
// ---------------------------------------------------------------------------

const rssKeys = (result) => Object.keys(result.breakdown).filter((k) => k.startsWith("rss_"));

// Sem UCS/densidade/profundidade, classifyRSS devolve "" — resta so o fd.rss.
const APENAS_MANUAL = {
  geometry: { shape: "Tabular", thickness: "Intermediário", grade: "Uniforme" },
  dip:      "45",
  ucs:      { ore: "", hangingWall: "", footwall: "" },
  density:  { ore: "", hangingWall: "", footwall: "" },
  depth:    { ore: "", hangingWall: "", footwall: "" },
  rss:      { ore: "Moderada", hangingWall: "Moderada", footwall: "Moderada" },
};

describe("fd.rss sem inputs numericos — UBC e SH&B ignoram", () => {
  it.each([
    ["calculateUBC", calculateUBC],
    ["calculateSHB", calculateSHB],
  ])("%s nao contabiliza nenhum criterio de RSS", (_nome, calcular) => {
    expect(rssKeys(calcular(APENAS_MANUAL))).toEqual([]);
  });

  it.each([
    ["calculateUBC", calculateUBC],
    ["calculateSHB", calculateSHB],
  ])("%s produz o mesmo score com e sem fd.rss", (_nome, calcular) => {
    const semCampo = { ...APENAS_MANUAL, rss: { ore: "", hangingWall: "", footwall: "" } };
    expect(calcular(APENAS_MANUAL).scores).toEqual(calcular(semCampo).scores);
  });

  it("calculateNicholas contabiliza os 3 dominios (fallback preservado)", () => {
    expect(rssKeys(calculateNicholas(APENAS_MANUAL)).sort()).toEqual([
      "rss_fw__Moderada",
      "rss_hw__Moderada",
      "rss_ob__Moderada",
    ]);
  });

  it("calculateNicholas muda de score conforme o fd.rss", () => {
    const fraca      = { ...APENAS_MANUAL, rss: { ore: "Fraca", hangingWall: "Fraca", footwall: "Fraca" } };
    const resistente = { ...APENAS_MANUAL, rss: { ore: "Resistente", hangingWall: "Resistente", footwall: "Resistente" } };
    expect(calculateNicholas(fraca).scores).not.toEqual(calculateNicholas(resistente).scores);
  });
});

// ---------------------------------------------------------------------------
// Com os inputs numericos preenchidos, classifyRSS resolve e o `||` faz
// curto-circuito — fd.rss nao deve influenciar NENHUM dos tres.
// ---------------------------------------------------------------------------
describe("fd.rss com inputs numericos preenchidos — ninguem e influenciado", () => {
  // Carvao a 900 m: RSS ~2.0 -> "Muito fraca" (UBC/SH&B) / "Fraca" (Nicholas).
  const COM_NUMEROS = {
    ...APENAS_MANUAL,
    ucs:     { ore: "25", hangingWall: "40", footwall: "50" },
    density: { ore: "1400", hangingWall: "2400", footwall: "2500" },
    depth:   { ore: "900", hangingWall: "900", footwall: "900" },
  };

  // Valores manuais deliberadamente conflitantes com o que o calculo devolve.
  const contraditorio = (rss) => ({ ...COM_NUMEROS, rss });

  it.each([
    ["calculateUBC",      calculateUBC],
    ["calculateNicholas", calculateNicholas],
    ["calculateSHB",      calculateSHB],
  ])("%s ignora fd.rss divergente", (_nome, calcular) => {
    const base = calcular({ ...COM_NUMEROS, rss: { ore: "", hangingWall: "", footwall: "" } });
    const comResistente = calcular(contraditorio({ ore: "Resistente", hangingWall: "Resistente", footwall: "Resistente" }));
    const comFraca      = calcular(contraditorio({ ore: "Fraca", hangingWall: "Fraca", footwall: "Fraca" }));
    expect(comResistente.scores).toEqual(base.scores);
    expect(comFraca.scores).toEqual(base.scores);
  });

  it.each([
    ["calculateUBC", calculateUBC, "Muito fraca"],
    ["calculateSHB", calculateSHB, "Muito fraca"],
    ["calculateNicholas", calculateNicholas, "Fraca"],
  ])("%s usa a classe vinda do calculo", (_nome, calcular, esperada) => {
    const keys = rssKeys(calcular(contraditorio({ ore: "Resistente", hangingWall: "Resistente", footwall: "Resistente" })));
    expect(keys.sort()).toEqual([
      `rss_fw__${esperada}`,
      `rss_hw__${esperada}`,
      `rss_ob__${esperada}`,
    ]);
  });
});
