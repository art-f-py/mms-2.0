import { describe, it, expect } from "vitest";
import { runMcdmPipeline, MCDM_SUPPORTED_METHODS, assertMcdmMethodSupported } from "../mcdmPipeline";
import { buildDecisionMatrix } from "../decisionMatrix";
import { calculateEntropyWeights } from "../entropyWeights";
import {
  createWeightingState,
  setWeightingMode,
  WEIGHTING_MODES,
  equalGroupWeights,
  groupOfCriterion,
  applyEnfoque,
} from "../enfoque";
import { CRITERION_GROUPS, FIXED_CRITERIA } from "../mcdmCriteria";
import { METHODS } from "../ubcWeights";
import { toShbScale } from "../shbScale";

// ---------------------------------------------------------------------------
// PIPELINE MCDM PARA O SH&B — PONTA A PONTA
// ---------------------------------------------------------------------------
// Terceiro e último método a entrar. Traz duas novidades que nem o Nicholas nem
// o UBC exercitavam:
//
//   1. UM CRITÉRIO CLÁSSICO EM ECONOMIA. `oreValue` é o primeiro critério de um
//      método de seleção a cair num grupo que até aqui só tinha os fixos do
//      Francisco. Qualquer lógica que assumisse "Técnico e Economia são
//      exatamente os 6 fixos" erra a partir daqui.
//   2. UMA CONVERSÃO QUE PRECISA SABER A COLUNA. toShbScale divide pelo fator
//      embutido, e o fator vem do criterionId — então o pipeline passa a
//      repassar coluna e método de lavra à conversão.
//
// 18 colunas: 12 clássicos + 6 fixos. Número diferente do Nicholas (19) e do
// UBC (17), de propósito — é o que faz um "19" ou "17" implícito na lógica
// geral aparecer aqui em vez de continuar acertando por sorte.

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

const shbMatrix      = () => buildDecisionMatrix(FULL_SCENARIO, { shb: true });
const nicholasMatrix = () => buildDecisionMatrix(FULL_SCENARIO, { nicholas: true });
const ubcMatrix      = () => buildDecisionMatrix(FULL_SCENARIO, { ubc: true });

const enfoque = (groupWeights) =>
  setWeightingMode(createWeightingState(), WEIGHTING_MODES.ENFOQUE, { groupWeights });
const entropy = () => setWeightingMode(createWeightingState(), WEIGHTING_MODES.ENTROPY);

const rodarShb = (options = {}) => runMcdmPipeline(shbMatrix(), { method: "shb", ...options });
const somaDe   = (v) => v.reduce((a, b) => a + b, 0);

const IDS_FIXOS = FIXED_CRITERIA.map((c) => c.id);

// A composição esperada da aba do SH&B: 12 clássicos + 6 fixos.
const CLASSICOS_SHB = [
  "shape", "thickness", "dip", "grade", "depth", "oreValue",
  "rss_ob", "rmr_ob", "rss_hw", "rmr_hw", "rss_fw", "rmr_fw",
];

describe("liberação", () => {
  it("o SH&B está entre os métodos suportados", () => {
    expect(MCDM_SUPPORTED_METHODS).toContain("shb");
    expect(() => assertMcdmMethodSupported("shb")).not.toThrow();
  });
});

describe("runMcdmPipeline — SH&B ponta a ponta", () => {
  it("roda a matriz completa até o ranking final, sem lançar", () => {
    const r = rodarShb({ weighting: enfoque(equalGroupWeights()) });

    expect(r.selectionMethod).toBe("shb");
    expect(r.ranking).toHaveLength(METHODS.length);
    expect(r.ranking.map((e) => e.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    // Toda alternativa aparece exatamente uma vez.
    expect(r.ranking.map((e) => e.code).sort()).toEqual([...METHODS].sort());
  });

  it("a proximidade fica em [0, 1] e sai ordenada do melhor para o pior", () => {
    const r = rodarShb({ weighting: enfoque(equalGroupWeights()) });
    r.ranking.forEach((entry, i) => {
      expect(entry.closeness).toBeGreaterThanOrEqual(0);
      expect(entry.closeness).toBeLessThanOrEqual(1);
      if (i > 0) expect(entry.closeness).toBeLessThanOrEqual(r.ranking[i - 1].closeness);
    });
  });

  it("a aba tem as 18 colunas — 12 clássicas mais as 6 fixas", () => {
    const r = rodarShb({ weighting: enfoque(equalGroupWeights()) });

    expect(r.criterionIds).toHaveLength(18);
    expect(r.criterionIds.filter((id) => !IDS_FIXOS.includes(id))).toEqual(CLASSICOS_SHB);
    expect(r.criterionIds.filter((id) => IDS_FIXOS.includes(id))).toEqual(IDS_FIXOS);
  });

  it("as colunas clássicas saem na escala 1–9, e as fixas passam intactas", () => {
    const r = rodarShb({ weighting: enfoque(equalGroupWeights()) });
    const classica = r.criterionIds.map((id) => !IDS_FIXOS.includes(id));

    for (const row of r.sheet.rows) {
      row.values.forEach((v, j) => {
        if (classica[j]) expect([0, 1, 3, 5, 7, 9]).toContain(v);
      });
    }
    // O índice de custo dos fixos vai muito além de 9 — prova que não passou
    // pela conversão.
    const iCusto = r.criterionIds.indexOf("comparativeCosts");
    expect(Math.max(...r.sheet.rows.map((row) => row.values[iCusto]))).toBeGreaterThan(9);
  });

  it("a conversão recebe a COLUNA, não só o valor", () => {
    // O que distingue o SH&B dos outros dois. `rss_ob` e `rss_hw` têm fatores
    // diferentes (0,875 e 0,7), então o mesmo bruto tem de sair diferente — e
    // sai, porque o pipeline repassa o criterionId.
    expect(toShbScale(3.5, "rss_ob")).not.toBe(toShbScale(3.5, "rss_hw"));

    const r = rodarShb({ weighting: enfoque(equalGroupWeights()) });
    // Se o criterionId não chegasse, a conversão lançaria "critério
    // desconhecido" e nada disto existiria.
    expect(r.sheet.rows).toHaveLength(METHODS.length);
  });
});

describe("Enfoque sobre as 18 colunas", () => {
  it("todo critério da aba pertence a um grupo — nenhum órfão", () => {
    const r = rodarShb({ weighting: enfoque(equalGroupWeights()) });
    for (const id of r.criterionIds) {
      expect(groupOfCriterion(id)).toBeDefined();
    }
  });

  it("a guarda de órfão dispara se um critério da aba não for declarado", () => {
    // A proteção que valeu para o `rmr_ob` do UBC e para o `oreValue` do SH&B
    // na entrada de cada um: o dia em que uma coluna nova chegar sem grupo, o
    // pipeline falha alto em vez de repartir peso torto.
    expect(() => applyEnfoque([...CLASSICOS_SHB, "colunaNova"], equalGroupWeights()))
      .toThrow(/não pertence a nenhum grupo/);
  });

  it("os grupos da aba do SH&B são 5 / 6 / 4 / 3", () => {
    // Geometria 5, Geomecânica 6, Técnico 4 (fixos), Economia 3 — os 2 fixos
    // MAIS o oreValue. É a Economia que muda em relação a Nicholas e UBC.
    const r = rodarShb({ weighting: enfoque(equalGroupWeights()) });
    const conta = (g) => r.criterionIds.filter((id) => groupOfCriterion(id) === g).length;

    expect(conta(CRITERION_GROUPS.GEOMETRY)).toBe(5);
    expect(conta(CRITERION_GROUPS.GEOMECHANICS)).toBe(6);
    expect(conta(CRITERION_GROUPS.TECHNICAL)).toBe(4);
    expect(conta(CRITERION_GROUPS.ECONOMIC)).toBe(3);
  });

  it("o oreValue divide o peso de Economia com os dois fixos", () => {
    // Consequência concreta de oreValue ser econômico: o grupo passa a repartir
    // seu peso entre TRÊS critérios, não dois. Nicholas e UBC seguem com dois.
    const r = rodarShb({ weighting: enfoque(equalGroupWeights()) });
    const pesoDe = (id) => r.weights[r.criterionIds.indexOf(id)];

    expect(pesoDe("oreValue")).toBeCloseTo(pesoDe("capitalInvestment"), 10);
    expect(pesoDe("oreValue")).toBeCloseTo(0.25 / 3, 10);
  });

  it("os pesos somam 1 sobre as 18 colunas", () => {
    const r = rodarShb({ weighting: enfoque(equalGroupWeights()) });
    expect(r.weights).toHaveLength(18);
    expect(somaDe(r.weights)).toBeCloseTo(1, 10);
    for (const p of r.weights) expect(p).toBeGreaterThan(0);
  });
});

describe("Entropy sobre as 18 colunas", () => {
  it("calculateEntropyWeights roda sobre a matriz do SH&B sem modificação", () => {
    const r = rodarShb({ weighting: entropy() });

    expect(r.weights).toHaveLength(18);
    expect(somaDe(r.weights)).toBeCloseTo(1, 10);
    expect(r.ranking).toHaveLength(METHODS.length);
  });

  it("chamada direta sobre a aba convertida devolve um peso por coluna", () => {
    // A função recebe a ABA e os ids (para nomear a coluna no erro e conferir a
    // largura), não uma matriz crua — ver a assinatura em entropyWeights.js.
    const r     = rodarShb({ weighting: entropy() });
    const pesos = calculateEntropyWeights(r.sheet, r.criterionIds);

    expect(pesos).toHaveLength(18);
    expect(somaDe(pesos)).toBeCloseTo(1, 10);
    // E é exatamente o que o pipeline usou: nenhuma etapa a mais no caminho.
    expect(pesos).toEqual(r.weights);
  });
});

describe("regressão — Nicholas e UBC inalterados", () => {
  it("o Nicholas segue com 19 colunas e ranking completo", () => {
    const r = runMcdmPipeline(nicholasMatrix(), { weighting: enfoque(equalGroupWeights()) });
    expect(r.selectionMethod).toBe("nicholas");
    expect(r.criterionIds).toHaveLength(19);
    expect(r.ranking).toHaveLength(METHODS.length);
    expect(somaDe(r.weights)).toBeCloseTo(1, 10);
  });

  it("o UBC segue com 17 colunas e ranking completo", () => {
    const r = runMcdmPipeline(ubcMatrix(), { method: "ubc", weighting: enfoque(equalGroupWeights()) });
    expect(r.selectionMethod).toBe("ubc");
    expect(r.criterionIds).toHaveLength(17);
    expect(r.ranking).toHaveLength(METHODS.length);
    expect(somaDe(r.weights)).toBeCloseTo(1, 10);
  });

  it("os três métodos leem o MESMO formulário e produzem matrizes diferentes", () => {
    const nicholas = runMcdmPipeline(nicholasMatrix(), { weighting: enfoque(equalGroupWeights()) });
    const ubc      = runMcdmPipeline(ubcMatrix(),      { method: "ubc", weighting: enfoque(equalGroupWeights()) });
    const shb      = rodarShb({ weighting: enfoque(equalGroupWeights()) });

    const tamanhos = [nicholas, ubc, shb].map((r) => r.criterionIds.length);
    expect(tamanhos).toEqual([19, 17, 18]);
    // Só o SH&B tem oreValue.
    expect(shb.criterionIds).toContain("oreValue");
    expect(nicholas.criterionIds).not.toContain("oreValue");
    expect(ubc.criterionIds).not.toContain("oreValue");
  });
});
