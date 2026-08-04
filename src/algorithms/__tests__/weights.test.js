import { describe, it, expect } from "vitest";
import { calculateUBC, calculateNicholas, calculateSHB } from "../algorithms";
import {
  METHODS,
  UBC_GEOMETRY,
  UBC_OREBODY,
  UBC_HANGINGWALL,
  UBC_FOOTWALL,
} from "../ubcWeights";
import {
  NICHOLAS_OREBODY,
  NICHOLAS_HANGINGWALL,
  NICHOLAS_FOOTWALL,
} from "../nicholasWeights";
import { SHB_OREBODY, SHB_HANGINGWALL, SHB_FOOTWALL } from "../shbWeights";

// ---------------------------------------------------------------------------
// Fixtures — densidade/UCS vazios de proposito para o RSS cair no valor manual
// ---------------------------------------------------------------------------
const BASE_GEOMETRY = {
  geometry: { shape: "Tabular", thickness: "Intermediário", grade: "Uniforme" },
  dip:      "35",   // UBC -> Intermediário | SH&B -> Intermediário
  depth:    { ore: "300", hangingWall: "300", footwall: "300" }, // -> Intermediária
  density:  { ore: "", hangingWall: "", footwall: "" },
  ucs:      { ore: "", hangingWall: "", footwall: "" },
};

const UBC_FD = {
  ...BASE_GEOMETRY,
  rss: { ore: "Fraca", hangingWall: "Moderada", footwall: "Resistente" },
  rmr: { ore: "Pobre", hangingWall: "Razoável", footwall: "Boa" },
};

const SHB_FD = { ...UBC_FD, oreValue: "Médio" };

const NICHOLAS_FD = {
  ...BASE_GEOMETRY,
  rss:            { ore: "Moderada", hangingWall: "Fraca", footwall: "Resistente" },
  jointSpacing:   { ore: "Perto", hangingWall: "Longe", footwall: "Muito Longe" },
  jointCondition: { ore: "Média", hangingWall: "Forte", footwall: "Fraca" },
};

// Pesos neutros, iguais aos que o MmsContext cria por padrao
const NEUTRAL_UBC = {
  geo: { shape: 1, thickness: 1, dip: 1, grade: 1, depth: 1 },
  ob:  { rss: 1, rmr: 1 },
  hw:  { rss: 1, rmr: 1 },
  fw:  { rss: 1, rmr: 1 },
};
const NEUTRAL_SHB = { ...NEUTRAL_UBC, econ: { oreValue: 1 } };
const NEUTRAL_NICHOLAS = {
  geo:    { shape: 1, thickness: 1, dip: 1, grade: 1 },
  ob:     { rss: 1, jointSpacing: 1, jointCondition: 1 },
  hw:     { rss: 1, jointSpacing: 1, jointCondition: 1 },
  fw:     { rss: 1, jointSpacing: 1, jointCondition: 1 },
  domain: { geo: 1, ob: 1, hw: 1, fw: 1 },
};

const expectSameScores = (a, b, precision = 10) => {
  for (const m of METHODS) {
    expect(a.scores[m], `metodo ${m}`).toBeCloseTo(b.scores[m], precision);
  }
};

// Soma as linhas do breakdown cujo nome casa com o filtro, por metodo.
const contributionOf = (breakdown, matcher) =>
  Object.fromEntries(
    METHODS.map((m) => [
      m,
      Object.entries(breakdown)
        .filter(([key]) => matcher.test(key))
        .reduce((acc, [, row]) => acc + (row[m] ?? 0), 0),
    ])
  );

describe("Pesos neutros (1.00) equivalem a nao passar pesos", () => {
  it("UBC", () => {
    const bare = calculateUBC(UBC_FD);
    const neutral = calculateUBC(UBC_FD, NEUTRAL_UBC);
    expectSameScores(bare, neutral);
    expect(neutral.ranking).toEqual(bare.ranking);
    expect(Object.keys(neutral.breakdown).sort()).toEqual(Object.keys(bare.breakdown).sort());
  });

  it("Nicholas (criterios e multiplicadores de dominio em 1.00)", () => {
    const bare = calculateNicholas(NICHOLAS_FD);
    const neutral = calculateNicholas(NICHOLAS_FD, NEUTRAL_NICHOLAS);
    expectSameScores(bare, neutral);
    expect(neutral.ranking).toEqual(bare.ranking);
  });

  it("SH&B", () => {
    const bare = calculateSHB(SHB_FD);
    const neutral = calculateSHB(SHB_FD, NEUTRAL_SHB);
    expectSameScores(bare, neutral);
    expect(neutral.ranking).toEqual(bare.ranking);
  });

  it("objeto de pesos vazio tambem e neutro", () => {
    expectSameScores(calculateUBC(UBC_FD, {}), calculateUBC(UBC_FD));
    expectSameScores(calculateNicholas(NICHOLAS_FD, {}), calculateNicholas(NICHOLAS_FD));
    expectSameScores(calculateSHB(SHB_FD, {}), calculateSHB(SHB_FD));
  });

  it("pesos parciais preservam o default 1.00 dos criterios omitidos", () => {
    // so 'ob' informado — os demais dominios continuam neutros
    const partial = calculateUBC(UBC_FD, { ob: { rss: 1 } });
    expectSameScores(partial, calculateUBC(UBC_FD));
  });
});

describe("Peso 0.00 zera a contribuicao do criterio", () => {
  it("UBC — criterio com peso 0 nao soma nada ao total", () => {
    const zeroed = calculateUBC(UBC_FD, { geo: { shape: 0 } });
    const without = calculateUBC({ ...UBC_FD, geometry: { ...UBC_FD.geometry, shape: "" } });
    expectSameScores(zeroed, without);
  });

  it("UBC — a diferenca para o neutro e exatamente a linha do criterio", () => {
    const neutral = calculateUBC(UBC_FD);
    const zeroed = calculateUBC(UBC_FD, { geo: { shape: 0 } });
    const row = UBC_GEOMETRY.shape.options["Tabular"];
    METHODS.forEach((m, i) => {
      expect(neutral.scores[m] - zeroed.scores[m], `metodo ${m}`).toBeCloseTo(row[i], 10);
    });
  });

  it("UBC — a linha do breakdown continua presente, mas toda zerada", () => {
    const zeroed = calculateUBC(UBC_FD, { geo: { shape: 0 } });
    const row = zeroed.breakdown["shape__Tabular"];
    expect(row).toBeDefined();
    for (const m of METHODS) {
      expect(row[m], `metodo ${m}`).toBeCloseTo(0, 10);
    }
  });

  it("peso 0 zera tambem os valores de eliminacao (-49 / -50)", () => {
    // forma Massivo elimina LW (-49 no UBC)
    const fd = { ...UBC_FD, geometry: { ...UBC_FD.geometry, shape: "Massivo" } };
    const neutral = calculateUBC(fd);
    const zeroed = calculateUBC(fd, { geo: { shape: 0 } });
    expect(UBC_GEOMETRY.shape.options["Massivo"][METHODS.indexOf("LW")]).toBe(-49);
    expect(neutral.scores["LW"] - zeroed.scores["LW"]).toBeCloseTo(-49, 10);
    expect(zeroed.breakdown["shape__Massivo"]["LW"]).toBeCloseTo(0, 10);
  });

  it("Nicholas — peso 0 num dominio inteiro remove o dominio do total", () => {
    const neutral = calculateNicholas(NICHOLAS_FD);
    const noOb = calculateNicholas(NICHOLAS_FD, { domain: { ob: 0 } });
    const ob = contributionOf(neutral.breakdown, /_ob__/);
    for (const m of METHODS) {
      expect(noOb.scores[m], `metodo ${m}`).toBeCloseTo(neutral.scores[m] - ob[m], 10);
    }
  });

  it("SH&B — peso 0 no fator economico remove o valor do minerio", () => {
    const zeroed = calculateSHB(SHB_FD, { econ: { oreValue: 0 } });
    const without = calculateSHB({ ...SHB_FD, oreValue: "" });
    expectSameScores(zeroed, without);
  });
});

describe("Nicholas — multiplicadores de dominio x pesos por criterio", () => {
  const neutral = calculateNicholas(NICHOLAS_FD);
  const obContribution = contributionOf(neutral.breakdown, /_ob__/);

  it("dobrar o dominio ob soma uma copia extra da contribuicao de ob", () => {
    const doubled = calculateNicholas(NICHOLAS_FD, { domain: { geo: 1, ob: 2, hw: 1, fw: 1 } });
    for (const m of METHODS) {
      expect(doubled.scores[m], `metodo ${m}`)
        .toBeCloseTo(neutral.scores[m] + obContribution[m], 10);
    }
  });

  it("dobrar os 3 criterios de ob equivale a dobrar o multiplicador de dominio", () => {
    const byDomain = calculateNicholas(NICHOLAS_FD, { domain: { geo: 1, ob: 2, hw: 1, fw: 1 } });
    const byCriteria = calculateNicholas(NICHOLAS_FD, {
      ob: { rss: 2, jointSpacing: 2, jointCondition: 2 },
    });
    expectSameScores(byDomain, byCriteria);
  });

  it("com um lado neutro, o outro age sozinho (dominio neutro)", () => {
    const criteriaOnly = calculateNicholas(NICHOLAS_FD, {
      ob:     { rss: 2, jointSpacing: 1, jointCondition: 1 },
      domain: { geo: 1, ob: 1, hw: 1, fw: 1 },
    });
    const rssRow = NICHOLAS_OREBODY.rss.options[NICHOLAS_FD.rss.ore];
    METHODS.forEach((m, i) => {
      expect(criteriaOnly.scores[m] - neutral.scores[m], `metodo ${m}`).toBeCloseTo(rssRow[i], 10);
    });
  });

  it("com um lado neutro, o outro age sozinho (criterios neutros)", () => {
    const domainOnly = calculateNicholas(NICHOLAS_FD, {
      ...NEUTRAL_NICHOLAS,
      domain: { geo: 1, ob: 1, hw: 3, fw: 1 },
    });
    const hwContribution = contributionOf(neutral.breakdown, /_hw__/);
    for (const m of METHODS) {
      expect(domainOnly.scores[m], `metodo ${m}`)
        .toBeCloseTo(neutral.scores[m] + 2 * hwContribution[m], 10);
    }
  });

  it("os dois lados se multiplicam quando ambos saem do neutro", () => {
    const both = calculateNicholas(NICHOLAS_FD, {
      ob:     { rss: 3, jointSpacing: 1, jointCondition: 1 },
      domain: { geo: 1, ob: 2, hw: 1, fw: 1 },
    });
    const rssRow = NICHOLAS_OREBODY.rss.options[NICHOLAS_FD.rss.ore];
    const bKey = `rss_ob__${NICHOLAS_FD.rss.ore}`;
    METHODS.forEach((m, i) => {
      // 3 (criterio) x 2 (dominio) = 6
      expect(both.breakdown[bKey][m], `metodo ${m}`).toBeCloseTo(6 * rssRow[i], 10);
    });
  });

  it("multiplicador de dominio geo afeta os 4 criterios de geometria", () => {
    const geoDoubled = calculateNicholas(NICHOLAS_FD, { domain: { geo: 2, ob: 1, hw: 1, fw: 1 } });
    const geoContribution = contributionOf(neutral.breakdown, /^(shape|thickness|dip|grade)__/);
    for (const m of METHODS) {
      expect(geoDoubled.scores[m], `metodo ${m}`)
        .toBeCloseTo(neutral.scores[m] + geoContribution[m], 10);
    }
  });
});

// ---------------------------------------------------------------------------
// Regressao documentada: antes da correcao, criterios homonimos em dominios
// diferentes (rss em ob/hw/fw) colidiam numa unica chave de breakdown e o
// grafico exibia so o ultimo dominio processado.
// ---------------------------------------------------------------------------
describe("Breakdown — chaves compostas por dominio (bug de colisao corrigido)", () => {
  const SAME_CLASS = "Moderada";
  const sameRss = { ore: SAME_CLASS, hangingWall: SAME_CLASS, footwall: SAME_CLASS };

  it("UBC — 3 chaves distintas quando os 3 dominios tem a mesma classe de RSS", () => {
    const r = calculateUBC({ ...BASE_GEOMETRY, rss: sameRss });
    const keys = Object.keys(r.breakdown).filter((k) => k.startsWith("rss_"));
    expect(keys.sort()).toEqual([
      `rss_fw__${SAME_CLASS}`,
      `rss_hw__${SAME_CLASS}`,
      `rss_ob__${SAME_CLASS}`,
    ]);
  });

  it("UBC — cada chave carrega a linha da SUA tabela, nao a do ultimo dominio", () => {
    const r = calculateUBC({ ...BASE_GEOMETRY, rss: sameRss });
    METHODS.forEach((m, i) => {
      expect(r.breakdown[`rss_ob__${SAME_CLASS}`][m], `ob/${m}`)
        .toBeCloseTo(UBC_OREBODY.rss.options[SAME_CLASS][i], 10);
      expect(r.breakdown[`rss_hw__${SAME_CLASS}`][m], `hw/${m}`)
        .toBeCloseTo(UBC_HANGINGWALL.rss.options[SAME_CLASS][i], 10);
      expect(r.breakdown[`rss_fw__${SAME_CLASS}`][m], `fw/${m}`)
        .toBeCloseTo(UBC_FOOTWALL.rss.options[SAME_CLASS][i], 10);
    });
  });

  it("UBC — o total continua somando os 3 dominios", () => {
    const r = calculateUBC({ ...BASE_GEOMETRY, rss: sameRss });
    const rssOnly = calculateUBC({ rss: sameRss });
    METHODS.forEach((m, i) => {
      const expected =
        UBC_OREBODY.rss.options[SAME_CLASS][i] +
        UBC_HANGINGWALL.rss.options[SAME_CLASS][i] +
        UBC_FOOTWALL.rss.options[SAME_CLASS][i];
      expect(rssOnly.scores[m], `metodo ${m}`).toBeCloseTo(expected, 10);
    });
    expect(Object.keys(r.breakdown).filter((k) => k.startsWith("rss_"))).toHaveLength(3);
  });

  it("UBC — RMR igual nos 3 dominios tambem nao colide", () => {
    const r = calculateUBC({ rmr: { ore: "Razoável", hangingWall: "Razoável", footwall: "Razoável" } });
    expect(Object.keys(r.breakdown).sort()).toEqual([
      "rmr_fw__Razoável",
      "rmr_hw__Razoável",
      "rmr_ob__Razoável",
    ]);
  });

  it("Nicholas — rss / jointSpacing / jointCondition iguais nos 3 dominios geram 9 chaves", () => {
    const r = calculateNicholas({
      rss:            sameRss,
      jointSpacing:   { ore: "Perto", hangingWall: "Perto", footwall: "Perto" },
      jointCondition: { ore: "Média", hangingWall: "Média", footwall: "Média" },
    });
    expect(Object.keys(r.breakdown)).toHaveLength(9);
    METHODS.forEach((m, i) => {
      expect(r.breakdown[`rss_ob__${SAME_CLASS}`][m], `ob/${m}`)
        .toBeCloseTo(NICHOLAS_OREBODY.rss.options[SAME_CLASS][i], 10);
      expect(r.breakdown[`rss_hw__${SAME_CLASS}`][m], `hw/${m}`)
        .toBeCloseTo(NICHOLAS_HANGINGWALL.rss.options[SAME_CLASS][i], 10);
      expect(r.breakdown[`rss_fw__${SAME_CLASS}`][m], `fw/${m}`)
        .toBeCloseTo(NICHOLAS_FOOTWALL.rss.options[SAME_CLASS][i], 10);
    });
  });

  it("SH&B — RSS igual nos 3 dominios gera 3 chaves com as linhas corretas", () => {
    const r = calculateSHB({ ...BASE_GEOMETRY, rss: sameRss });
    METHODS.forEach((m, i) => {
      expect(r.breakdown[`rss_ob__${SAME_CLASS}`][m], `ob/${m}`)
        .toBeCloseTo(SHB_OREBODY.rss.options[SAME_CLASS][i], 10);
      expect(r.breakdown[`rss_hw__${SAME_CLASS}`][m], `hw/${m}`)
        .toBeCloseTo(SHB_HANGINGWALL.rss.options[SAME_CLASS][i], 10);
      expect(r.breakdown[`rss_fw__${SAME_CLASS}`][m], `fw/${m}`)
        .toBeCloseTo(SHB_FOOTWALL.rss.options[SAME_CLASS][i], 10);
    });
  });

  it("criterios de dominio unico mantem a chave simples (sem sufixo)", () => {
    const r = calculateUBC(UBC_FD);
    expect(r.breakdown).toHaveProperty("shape__Tabular");
    expect(r.breakdown).toHaveProperty("thickness__Intermediário");
    expect(r.breakdown).toHaveProperty("grade__Uniforme");
  });

  it("a soma do breakdown reproduz o total em todos os algoritmos", () => {
    for (const r of [calculateUBC(UBC_FD), calculateNicholas(NICHOLAS_FD), calculateSHB(SHB_FD)]) {
      for (const m of METHODS) {
        const sum = Object.values(r.breakdown).reduce((acc, row) => acc + (row[m] ?? 0), 0);
        expect(sum, `metodo ${m}`).toBeCloseTo(r.scores[m], 10);
      }
    }
  });

  it("criterios nao preenchidos nao entram no breakdown", () => {
    const r = calculateUBC({ geometry: { shape: "Tabular" } });
    expect(Object.keys(r.breakdown)).toEqual(["shape__Tabular"]);
  });
});
