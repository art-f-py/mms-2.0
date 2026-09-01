import { describe, it, expect } from "vitest";
import { mmsReducer, normalizeMcdmWeights } from "../MmsContext";
import { WEIGHTING_MODES, equalGroupWeights } from "../../algorithms/enfoque";
import { REBALANCE_MODES } from "../../algorithms/enfoqueRebalance";
import { CRITERION_GROUPS } from "../../algorithms/mcdmCriteria";

// ---------------------------------------------------------------------------
// POLÍTICA DE REBALANCEAMENTO NO ESTADO — PROPORCIONAL x IGUALAR
// ---------------------------------------------------------------------------
// `rebalanceMode` decide COMO os três grupos não alterados reagem a um slider.
// O que estes testes fixam é que a escolha acontece DENTRO do reducer: a mesma
// ação SET_MCDM_GROUP_WEIGHT produz vetores diferentes conforme o modo gravado,
// e a tela não sabe que existem duas funções.
//
// O caso mais fácil de errar, e por isso o mais testado: o vetor 0.7 / 0.1 /
// 0.1 / 0.1 só sai com "igualar" se a partida NÃO for uniforme. Partindo do
// uniforme os dois modos concordam, e um teste que usasse só essa partida
// passaria mesmo com a função errada sendo chamada.

const { GEOMETRY, GEOMECHANICS, TECHNICAL, ECONOMIC } = CRITERION_GROUPS;

const SENTINELA_UBC     = { geo: { shape: 0.5 } };
const SENTINELA_RESULTS = { ubc: { scores: {} }, nicholas: null, shb: null };

// Partida DESIGUAL de propósito — ver o cabeçalho.
const DESIGUAL = { [GEOMETRY]: 0.4, [GEOMECHANICS]: 0.1, [TECHNICAL]: 0.2, [ECONOMIC]: 0.3 };

const estado = (mcdm) => ({
  formData: {
    geometry: { shape: "Tabular" },
    criteriaWeights: {
      ubc:      SENTINELA_UBC,
      nicholas: { geo: { shape: 1 } },
      shb:      { econ: { oreValue: 1 } },
      mcdm,
    },
  },
  results:       SENTINELA_RESULTS,
  mcdmScenarios: [],
});

const comModo = (rebalanceMode, groupWeights = DESIGUAL) =>
  estado({ mode: WEIGHTING_MODES.ENFOQUE, rebalanceMode, groupWeights });

const mcdmDe  = (s) => s.formData.criteriaWeights.mcdm;
const pesosDe = (s) => mcdmDe(s).groupWeights;

describe("SET_MCDM_GROUP_WEIGHT escolhe a função pelo rebalanceMode", () => {
  it("'equalize' iguala os outros três — 0.7 vira 0.1 / 0.1 / 0.1", () => {
    const depois = mmsReducer(
      comModo(REBALANCE_MODES.EQUALIZE),
      { type: "SET_MCDM_GROUP_WEIGHT", group: GEOMETRY, value: 0.7 },
    );
    expect(pesosDe(depois)[GEOMETRY]).toBeCloseTo(0.7, 12);
    for (const id of [GEOMECHANICS, TECHNICAL, ECONOMIC]) {
      expect(pesosDe(depois)[id]).toBeCloseTo(0.1, 12);
    }
  });

  it("'proportional' preserva a proporção — a mesma ação dá outro vetor", () => {
    const depois = mmsReducer(
      comModo(REBALANCE_MODES.PROPORTIONAL),
      { type: "SET_MCDM_GROUP_WEIGHT", group: GEOMETRY, value: 0.7 },
    );
    expect(pesosDe(depois)[GEOMETRY]).toBeCloseTo(0.7, 12);
    // 0.1 : 0.2 : 0.3 escalados para somar 0.3 → 0.05 / 0.10 / 0.15.
    expect(pesosDe(depois)[GEOMECHANICS]).toBeCloseTo(0.05, 12);
    expect(pesosDe(depois)[TECHNICAL]).toBeCloseTo(0.10, 12);
    expect(pesosDe(depois)[ECONOMIC]).toBeCloseTo(0.15, 12);
  });

  it("modo ausente cai no proporcional — o comportamento anterior ao campo", () => {
    const semCampo = estado({ mode: WEIGHTING_MODES.ENFOQUE, groupWeights: DESIGUAL });
    const depois   = mmsReducer(semCampo, { type: "SET_MCDM_GROUP_WEIGHT", group: GEOMETRY, value: 0.7 });
    expect(pesosDe(depois)[GEOMECHANICS]).toBeCloseTo(0.05, 12);
  });

  it("modo desconhecido cai no proporcional, sem lançar", () => {
    const depois = mmsReducer(
      comModo("modo-inventado"),
      { type: "SET_MCDM_GROUP_WEIGHT", group: GEOMETRY, value: 0.7 },
    );
    expect(pesosDe(depois)[GEOMECHANICS]).toBeCloseTo(0.05, 12);
  });

  it("mexer num slider não muda a política gravada", () => {
    const depois = mmsReducer(
      comModo(REBALANCE_MODES.EQUALIZE),
      { type: "SET_MCDM_GROUP_WEIGHT", group: GEOMETRY, value: 0.7 },
    );
    expect(mcdmDe(depois).rebalanceMode).toBe(REBALANCE_MODES.EQUALIZE);
  });

  it("os dois modos concordam quando a partida é uniforme", () => {
    const acao = { type: "SET_MCDM_GROUP_WEIGHT", group: GEOMETRY, value: 0.7 };
    const igualado     = mmsReducer(comModo(REBALANCE_MODES.EQUALIZE, equalGroupWeights()), acao);
    const proporcional = mmsReducer(comModo(REBALANCE_MODES.PROPORTIONAL, equalGroupWeights()), acao);
    expect(pesosDe(igualado)).toEqual(pesosDe(proporcional));
  });
});

describe("SET_MCDM_REBALANCE_MODE", () => {
  it("grava a política pedida", () => {
    const depois = mmsReducer(
      comModo(REBALANCE_MODES.PROPORTIONAL),
      { type: "SET_MCDM_REBALANCE_MODE", rebalanceMode: REBALANCE_MODES.EQUALIZE },
    );
    expect(mcdmDe(depois).rebalanceMode).toBe(REBALANCE_MODES.EQUALIZE);
  });

  it("NÃO mexe nos pesos — a nova política vale do próximo arraste em diante", () => {
    const depois = mmsReducer(
      comModo(REBALANCE_MODES.PROPORTIONAL),
      { type: "SET_MCDM_REBALANCE_MODE", rebalanceMode: REBALANCE_MODES.EQUALIZE },
    );
    expect(pesosDe(depois)).toEqual(DESIGUAL);
  });

  it("não mexe no modo de ponderação nem nas outras sub-árvores", () => {
    const antes  = comModo(REBALANCE_MODES.PROPORTIONAL);
    const depois = mmsReducer(antes, { type: "SET_MCDM_REBALANCE_MODE", rebalanceMode: REBALANCE_MODES.EQUALIZE });
    expect(mcdmDe(depois).mode).toBe(WEIGHTING_MODES.ENFOQUE);
    expect(depois.formData.criteriaWeights.ubc).toBe(SENTINELA_UBC);
    expect(depois.results).toBe(SENTINELA_RESULTS);
  });

  it("não muta o estado recebido", () => {
    const antes = comModo(REBALANCE_MODES.PROPORTIONAL);
    mmsReducer(antes, { type: "SET_MCDM_REBALANCE_MODE", rebalanceMode: REBALANCE_MODES.EQUALIZE });
    expect(mcdmDe(antes).rebalanceMode).toBe(REBALANCE_MODES.PROPORTIONAL);
  });
});

describe("o cenário salvo não guarda a política", () => {
  // Um cenário é {id, name, groupWeights}. O modo usado para AJUSTAR os pesos
  // não é propriedade dos pesos ajustados: dois caminhos diferentes podem levar
  // à mesma repartição, e é a repartição que a comparação recalcula.
  it("ADD_MCDM_SCENARIO não grava a política de rebalanceamento", () => {
    // O cenário guarda o RESULTADO (os quatro pesos), não o caminho usado para
    // chegar a ele. Método e modo entraram na lista de campos depois; a
    // política continua de fora.
    const depois = mmsReducer(
      comModo(REBALANCE_MODES.EQUALIZE),
      { type: "ADD_MCDM_SCENARIO", name: "Geometria pesada", method: "nicholas", mode: "enfoque", groupWeights: DESIGUAL },
    );
    expect(Object.keys(depois.mcdmScenarios[0]).sort())
      .toEqual(["groupWeights", "id", "method", "mode", "name"]);
    expect(depois.mcdmScenarios[0].rebalanceMode).toBeUndefined();
  });
});

describe("defaults e reset", () => {
  it("a política padrão é proporcional — o comportamento anterior ao campo", () => {
    const depois = mmsReducer(comModo(REBALANCE_MODES.EQUALIZE), { type: "RESET_ALL" });
    expect(depois.formData.criteriaWeights.mcdm.rebalanceMode).toBe(REBALANCE_MODES.PROPORTIONAL);
  });

  it("RESET_CRITERIA_WEIGHTS também repõe a política padrão", () => {
    const depois = mmsReducer(comModo(REBALANCE_MODES.EQUALIZE), { type: "RESET_CRITERIA_WEIGHTS" });
    expect(mcdmDe(depois).rebalanceMode).toBe(REBALANCE_MODES.PROPORTIONAL);
  });
});

// ---------------------------------------------------------------------------
// PERSISTÊNCIA
// ---------------------------------------------------------------------------
// Todo estado gravado antes desta versão tem pesos e modo, e NÃO tem
// rebalanceMode. Repor o campo ausente não pode custar os pesos que estão lá —
// mesma regra que já valia para o `mode`.

describe("normalizeMcdmWeights — o campo rebalanceMode", () => {
  it("acrescenta a política quando o estado gravado não tem", () => {
    const salvo = estado({ mode: WEIGHTING_MODES.ENFOQUE, groupWeights: DESIGUAL }).formData;
    expect(normalizeMcdmWeights(salvo).criteriaWeights.mcdm.rebalanceMode)
      .toBe(REBALANCE_MODES.PROPORTIONAL);
  });

  it("PRESERVA pesos e modo ao acrescentar a política que faltava", () => {
    const salvo  = estado({ mode: WEIGHTING_MODES.ENTROPY, groupWeights: DESIGUAL }).formData;
    const depois = normalizeMcdmWeights(salvo);
    expect(depois.criteriaWeights.mcdm.groupWeights).toEqual(DESIGUAL);
    expect(depois.criteriaWeights.mcdm.mode).toBe(WEIGHTING_MODES.ENTROPY);
  });

  it("preserva 'equalize' legitimamente gravado", () => {
    const salvo = comModo(REBALANCE_MODES.EQUALIZE).formData;
    expect(normalizeMcdmWeights(salvo).criteriaWeights.mcdm.rebalanceMode)
      .toBe(REBALANCE_MODES.EQUALIZE);
  });

  it("repõe política desconhecida, sem descartar os pesos", () => {
    const salvo  = comModo("modo-inventado").formData;
    const depois = normalizeMcdmWeights(salvo);
    expect(depois.criteriaWeights.mcdm.rebalanceMode).toBe(REBALANCE_MODES.PROPORTIONAL);
    expect(depois.criteriaWeights.mcdm.groupWeights).toEqual(DESIGUAL);
  });

  it("repõe os dois campos de uma vez quando ambos faltam", () => {
    const salvo  = estado({ groupWeights: DESIGUAL }).formData;
    const depois = normalizeMcdmWeights(salvo);
    expect(depois.criteriaWeights.mcdm.mode).toBe(WEIGHTING_MODES.ENFOQUE);
    expect(depois.criteriaWeights.mcdm.rebalanceMode).toBe(REBALANCE_MODES.PROPORTIONAL);
    expect(depois.criteriaWeights.mcdm.groupWeights).toEqual(DESIGUAL);
  });

  it("pesos inválidos repõem a sub-árvore inteira, política incluída", () => {
    const torto = { [GEOMETRY]: 0.9, [GEOMECHANICS]: 0.9, [TECHNICAL]: 0.9, [ECONOMIC]: 0.9 };
    const salvo = comModo(REBALANCE_MODES.EQUALIZE, torto).formData;
    const depois = normalizeMcdmWeights(salvo);
    expect(depois.criteriaWeights.mcdm.groupWeights).toEqual(equalGroupWeights());
    expect(depois.criteriaWeights.mcdm.rebalanceMode).toBe(REBALANCE_MODES.PROPORTIONAL);
  });

  it("é idempotente", () => {
    const salvo = estado({ groupWeights: DESIGUAL }).formData;
    const uma   = normalizeMcdmWeights(salvo);
    expect(normalizeMcdmWeights(uma)).toBe(uma);
  });

  it("sobrevive a uma ida e volta por JSON, como no localStorage", () => {
    const salvo     = comModo(REBALANCE_MODES.EQUALIZE).formData;
    const daStorage = JSON.parse(JSON.stringify(salvo));
    const depois    = normalizeMcdmWeights(daStorage);
    expect(depois.criteriaWeights.mcdm.rebalanceMode).toBe(REBALANCE_MODES.EQUALIZE);
    expect(depois.criteriaWeights.mcdm.groupWeights).toEqual(DESIGUAL);
  });

  // O reducer é a porta de entrada; o estado reparado precisa atravessá-la sem
  // que a escolha de função mude de comportamento a meio caminho.
  it("o estado reparado rebalanceia proporcionalmente", () => {
    const salvo    = estado({ groupWeights: DESIGUAL }).formData;
    const reparado = { ...estado({}), formData: normalizeMcdmWeights(salvo) };
    const depois   = mmsReducer(reparado, { type: "SET_MCDM_GROUP_WEIGHT", group: GEOMETRY, value: 0.7 });
    expect(pesosDe(depois)[GEOMECHANICS]).toBeCloseTo(0.05, 12);
  });
});
