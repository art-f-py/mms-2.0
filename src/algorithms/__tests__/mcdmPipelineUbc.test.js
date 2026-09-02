import { describe, it, expect } from "vitest";
import { runMcdmPipeline, MCDM_SUPPORTED_METHODS } from "../mcdmPipeline";
import { buildDecisionMatrix } from "../decisionMatrix";
import { calculateEntropyWeights } from "../entropyWeights";
import {
  createWeightingState,
  setWeightingMode,
  WEIGHTING_MODES,
  equalGroupWeights,
  groupOfCriterion,
  resolveWeights,
} from "../enfoque";
import { CRITERION_GROUPS, FIXED_CRITERIA } from "../mcdmCriteria";
import { METHODS } from "../ubcWeights";
import { toUbcScale } from "../ubcScale";

// ---------------------------------------------------------------------------
// PIPELINE MCDM PARA O UBC — PONTA A PONTA
// ---------------------------------------------------------------------------
// O UBC entrou no pipeline depois do Nicholas, e as duas matrizes têm formatos
// diferentes: 17 colunas contra 19, com 11 ids clássicos em comum, `depth` e os
// três `rmr_*` só no UBC, e os seis `jointSpacing_*`/`jointCondition_*` só no
// Nicholas.
//
// É essa diferença que estes testes existem para exercitar. Enquanto só o
// Nicholas rodava, qualquer "19" implícito na lógica geral — um tamanho de
// grupo fixo, uma contagem de colunas presumida — passava despercebido porque
// sempre acertava. Aqui ele erra.

const FULL_SCENARIO = {
  geometry: { shape: "Tabular", thickness: "Intermediário", grade: "Uniforme" },
  dip:      "45",
  depth:    { ore: "300", hangingWall: "300", footwall: "300" },
  density:  { ore: "2500", hangingWall: "2600", footwall: "2700" },
  ucs:      { ore: "120",  hangingWall: "100",  footwall: "110" },
  rmr:      { ore: "Boa",  hangingWall: "Razoável", footwall: "Razoável" },
  jointSpacing:   { ore: "Perto", hangingWall: "Longe", footwall: "Perto" },
  jointCondition: { ore: "Média", hangingWall: "Forte", footwall: "Fraca" },
  oreValue: "Médio",
};

const ubcMatrix      = () => buildDecisionMatrix(FULL_SCENARIO, { ubc: true });
const nicholasMatrix = () => buildDecisionMatrix(FULL_SCENARIO, { nicholas: true });

const enfoque = (groupWeights) =>
  setWeightingMode(createWeightingState(), WEIGHTING_MODES.ENFOQUE, { groupWeights });
const entropy = () => setWeightingMode(createWeightingState(), WEIGHTING_MODES.ENTROPY);

const rodarUbc = (options = {}) => runMcdmPipeline(ubcMatrix(), { method: "ubc", ...options });
const somaDe   = (v) => v.reduce((a, b) => a + b, 0);

const IDS_FIXOS = FIXED_CRITERIA.map((c) => c.id);

// A composição esperada da aba do UBC: 11 clássicos + 6 fixos.
const CLASSICOS_UBC = [
  "shape", "thickness", "dip", "grade", "depth",
  "rss_ob", "rmr_ob", "rss_hw", "rmr_hw", "rss_fw", "rmr_fw",
];

describe("liberação", () => {
  it("o UBC está entre os métodos suportados", () => {
    expect(MCDM_SUPPORTED_METHODS).toContain("ubc");
  });

  it("runMcdmPipeline para UBC não lança mais", () => {
    expect(() => rodarUbc()).not.toThrow();
  });
});

describe("ponta a ponta — a matriz do UBC atravessa o pipeline", () => {
  it("devolve ranking com os 10 métodos de lavra, sem repetição", () => {
    const r = rodarUbc();
    expect(r.ranking).toHaveLength(METHODS.length);
    expect(new Set(r.ranking.map((e) => e.code)).size).toBe(METHODS.length);
    expect([...r.ranking.map((e) => e.code)].sort()).toEqual([...METHODS].sort());
  });

  it("as colocações vão de 1 a 10, sem buraco", () => {
    const r = rodarUbc();
    expect(r.ranking.map((e) => e.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("a proximidade de cada método é um número em [0, 1]", () => {
    rodarUbc().ranking.forEach((entry) => {
      expect(Number.isFinite(entry.closeness)).toBe(true);
      expect(entry.closeness).toBeGreaterThanOrEqual(0);
      expect(entry.closeness).toBeLessThanOrEqual(1);
    });
  });

  it("o método de seleção volta no retorno", () => {
    expect(rodarUbc().selectionMethod).toBe("ubc");
  });

  it("a aba convertida tem 17 colunas — 11 clássicas + 6 fixas", () => {
    const r = rodarUbc();
    expect(r.criterionIds).toHaveLength(17);
    expect(r.criterionIds).toEqual([...CLASSICOS_UBC, ...IDS_FIXOS]);
  });

  it("nenhuma célula fica vazia depois da conversão", () => {
    rodarUbc().sheet.rows.forEach((row) => {
      row.values.forEach((v) => expect(Number.isFinite(v)).toBe(true));
    });
  });
});

describe("a conversão usada é a do UBC, não a do Nicholas", () => {
  it("toda coluna clássica sai num valor da escala do UBC", () => {
    const r = rodarUbc();
    const permitidos = new Set([0, 1, 3, 5, 7, 9]);
    r.sheet.rows.forEach((row) => {
      r.criterionIds.forEach((id, j) => {
        if (IDS_FIXOS.includes(id)) return;
        expect(permitidos.has(row.values[j])).toBe(true);
      });
    });
  });

  it("as colunas fixas passam INTACTAS, na escala nativa do Francisco", () => {
    const r = rodarUbc();
    // O índice de custo vai até 100 — se tivesse passado por alguma conversão,
    // teria estourado o domínio das duas escalas.
    const j = r.criterionIds.indexOf("comparativeCosts");
    const valores = r.sheet.rows.map((row) => row.values[j]);
    expect(Math.max(...valores)).toBeGreaterThan(9);
  });

  it("cada célula clássica bate com toUbcScale aplicado ao valor bruto", () => {
    // Confere a aba ANTES da conversão contra a aba depois, célula a célula.
    // A extensão com os critérios fixos acrescenta colunas no fim, então o
    // índice de cada coluna clássica é o mesmo nas duas — mas procurar pelo id
    // não depende disso.
    const bruta      = ubcMatrix().sheets[0];
    const convertida = rodarUbc().sheet;
    expect(bruta.criterionKeys).toEqual(CLASSICOS_UBC);

    bruta.criterionKeys.forEach((id, jBruto) => {
      const jConv = convertida.criterionKeys.indexOf(id);
      expect(jConv).toBeGreaterThanOrEqual(0);
      bruta.rows.forEach((row, i) => {
        expect(convertida.rows[i].values[jConv]).toBe(toUbcScale(row.values[jBruto]));
      });
    });
  });
});

describe("Enfoque sobre as 17 colunas", () => {
  it("os pesos somam 1, como no Nicholas", () => {
    [equalGroupWeights(),
     { [CRITERION_GROUPS.GEOMETRY]: 0.7, [CRITERION_GROUPS.GEOMECHANICS]: 0.1,
       [CRITERION_GROUPS.TECHNICAL]: 0.1, [CRITERION_GROUPS.ECONOMIC]: 0.1 },
     { [CRITERION_GROUPS.GEOMETRY]: 0.1, [CRITERION_GROUPS.GEOMECHANICS]: 0.1,
       [CRITERION_GROUPS.TECHNICAL]: 0.1, [CRITERION_GROUPS.ECONOMIC]: 0.7 },
    ].forEach((gw) => {
      expect(somaDe(rodarUbc({ weighting: enfoque(gw) }).weights)).toBeCloseTo(1, 12);
    });
  });

  it("Geometria reparte por 5 e Geomecânica por 6 — os números do UBC", () => {
    const r = rodarUbc({ weighting: enfoque(equalGroupWeights()) });
    expect(r.weights[r.criterionIds.indexOf("depth")]).toBeCloseTo(0.25 / 5, 12);
    expect(r.weights[r.criterionIds.indexOf("rmr_ob")]).toBeCloseTo(0.25 / 6, 12);
    expect(r.weights[r.criterionIds.indexOf("performance")]).toBeCloseTo(0.25 / 4, 12);
    expect(r.weights[r.criterionIds.indexOf("comparativeCosts")]).toBeCloseTo(0.25 / 2, 12);
  });

  it("GUARDA DE ÓRFÃO: nenhum dos 17 critérios fica sem grupo", () => {
    // O contrato que mais importa: um critério sem grupo LANÇA, e por isso o
    // pipeline rodar já prova que os 17 estão declarados. Este teste torna o
    // motivo explícito em vez de deixá-lo implícito no "não lançou".
    const ids = rodarUbc().criterionIds;
    ids.forEach((id) => expect(groupOfCriterion(id)).toBeDefined());
    expect(() => resolveWeights(enfoque(equalGroupWeights()), ids)).not.toThrow();
  });

  it("um id não declarado no meio dos 17 ainda é pego", () => {
    const ids = [...rodarUbc().criterionIds, "criterioFantasma"];
    expect(() => resolveWeights(enfoque(equalGroupWeights()), ids))
      .toThrow(/critério "criterioFantasma" não pertence a nenhum grupo/);
  });
});

describe("Entropy sobre as 17 colunas — invariante ao nº de critérios", () => {
  it("roda sem modificação e devolve um peso por coluna", () => {
    const r = rodarUbc({ weighting: entropy() });
    expect(r.weights).toHaveLength(17);
    r.weights.forEach((w) => expect(Number.isFinite(w)).toBe(true));
  });

  it("os pesos de Entropy somam 1", () => {
    expect(somaDe(rodarUbc({ weighting: entropy() }).weights)).toBeCloseTo(1, 12);
  });

  it("calculateEntropyWeights chamada direto dá o mesmo vetor", () => {
    const r = rodarUbc({ weighting: entropy() });
    expect(calculateEntropyWeights(r.sheet, r.criterionIds)).toEqual(r.weights);
  });

  it("a MESMA função serve às duas larguras de matriz — 17 e 19", () => {
    // A propriedade que o UBC veio testar: nada em Entropy presume 19 colunas.
    const ubc = rodarUbc({ weighting: entropy() });
    const nic = runMcdmPipeline(nicholasMatrix(), { method: "nicholas", weighting: entropy() });
    expect(ubc.weights).toHaveLength(17);
    expect(nic.weights).toHaveLength(19);
    expect(somaDe(ubc.weights)).toBeCloseTo(1, 12);
    expect(somaDe(nic.weights)).toBeCloseTo(1, 12);
  });

  it("Entropy e Enfoque produzem rankings de mesma forma, conteúdo livre", () => {
    const porEntropy = rodarUbc({ weighting: entropy() });
    const porEnfoque = rodarUbc({ weighting: enfoque(equalGroupWeights()) });
    expect(porEntropy.ranking).toHaveLength(10);
    expect(porEnfoque.ranking).toHaveLength(10);
    expect(porEntropy.weights).not.toEqual(porEnfoque.weights);
  });
});

describe("REGRESSÃO — o Nicholas continua igual", () => {
  // O risco concreto da mudança: `depth` e os `rmr_*` entraram em
  // CLASSIC_CRITERIA e aumentaram o tamanho DECLARADO de Geometria (4→5) e
  // Geomecânica (9→12). Se applyEnfoque dividisse por esses números, o Nicholas
  // passaria a somar 0.8875 e o ranking dele mudaria sem ninguém pedir.
  const rodarNicholas = (options = {}) =>
    runMcdmPipeline(nicholasMatrix(), { method: "nicholas", ...options });

  it("continua com 19 colunas", () => {
    expect(rodarNicholas().criterionIds).toHaveLength(19);
  });

  it("os pesos de Enfoque continuam somando 1", () => {
    expect(somaDe(rodarNicholas({ weighting: enfoque(equalGroupWeights()) }).weights))
      .toBeCloseTo(1, 12);
  });

  it("Geometria continua repartindo por 4 e Geomecânica por 9", () => {
    const r = rodarNicholas({ weighting: enfoque(equalGroupWeights()) });
    expect(r.weights[r.criterionIds.indexOf("shape")]).toBeCloseTo(0.25 / 4, 12);
    expect(r.weights[r.criterionIds.indexOf("rss_ob")]).toBeCloseTo(0.25 / 9, 12);
  });

  it("nenhuma coluna do UBC vazou para a aba do Nicholas", () => {
    const ids = rodarNicholas().criterionIds;
    ["depth", "rmr_ob", "rmr_hw", "rmr_fw"].forEach((id) => expect(ids).not.toContain(id));
  });

  it("o ranking do Nicholas não depende de o UBC estar liberado", () => {
    // Rodar as duas matrizes na mesma chamada de buildDecisionMatrix não muda
    // o resultado de nenhuma das duas: as abas são independentes.
    const juntas  = buildDecisionMatrix(FULL_SCENARIO, { ubc: true, nicholas: true });
    const sozinho = rodarNicholas({ weighting: enfoque(equalGroupWeights()) });
    const doPar   = runMcdmPipeline(juntas, {
      method: "nicholas", weighting: enfoque(equalGroupWeights()),
    });
    expect(doPar.ranking).toEqual(sozinho.ranking);
    expect(doPar.weights).toEqual(sozinho.weights);
  });
});
