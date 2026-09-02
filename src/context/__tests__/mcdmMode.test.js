import { describe, it, expect } from "vitest";
import { mmsReducer, normalizeMcdmWeights } from "../MmsContext";
import { WEIGHTING_MODES, equalGroupWeights } from "../../algorithms/enfoque";
import { REBALANCE_MODES } from "../../algorithms/enfoqueRebalance";
import { CRITERION_GROUPS } from "../../algorithms/mcdmCriteria";

// ---------------------------------------------------------------------------
// MODO DE PONDERAÇÃO NO ESTADO — ENFOQUE x ENTROPY
// ---------------------------------------------------------------------------
// `mode` decide QUEM determina os pesos: o usuário (Enfoque, repartindo 1.0
// entre os quatro grupos) ou os dados (Entropy, pela dispersão de cada coluna).
//
// A garantia menos óbvia, e a que mais importa em uso: OS groupWeights
// SOBREVIVEM À TROCA DE MODO. Eles são ignorados enquanto Entropy está ativo,
// não descartados — é o que faz a troca ser reversível. Quem ajustou os quatro
// sliders, espiou o Entropy e voltou precisa reencontrar a repartição que
// deixou, não o uniforme.

const { GEOMETRY, GEOMECHANICS, TECHNICAL, ECONOMIC } = CRITERION_GROUPS;

const SENTINELA_UBC     = { geo: { shape: 0.5 } };
const SENTINELA_RESULTS = { ubc: { scores: {} }, nicholas: null, shb: null };

const PESOS_AJUSTADOS = { [GEOMETRY]: 0.7, [GEOMECHANICS]: 0.1, [TECHNICAL]: 0.1, [ECONOMIC]: 0.1 };

const estado = (mcdm = { mode: WEIGHTING_MODES.ENFOQUE, groupWeights: equalGroupWeights() }) => ({
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

const mcdmDe = (s) => s.formData.criteriaWeights.mcdm;

describe("SET_MCDM_MODE", () => {
  it("grava o modo pedido", () => {
    const depois = mmsReducer(estado(), { type: "SET_MCDM_MODE", mode: WEIGHTING_MODES.ENTROPY });
    expect(mcdmDe(depois).mode).toBe(WEIGHTING_MODES.ENTROPY);
  });

  it("volta para Enfoque", () => {
    let s = estado();
    s = mmsReducer(s, { type: "SET_MCDM_MODE", mode: WEIGHTING_MODES.ENTROPY });
    s = mmsReducer(s, { type: "SET_MCDM_MODE", mode: WEIGHTING_MODES.ENFOQUE });
    expect(mcdmDe(s).mode).toBe(WEIGHTING_MODES.ENFOQUE);
  });

  it("PRESERVA os groupWeights ao entrar em Entropy", () => {
    const antes  = estado({ mode: WEIGHTING_MODES.ENFOQUE, groupWeights: PESOS_AJUSTADOS });
    const depois = mmsReducer(antes, { type: "SET_MCDM_MODE", mode: WEIGHTING_MODES.ENTROPY });
    expect(mcdmDe(depois).groupWeights).toEqual(PESOS_AJUSTADOS);
  });

  it("a repartição ajustada volta intacta depois de ir e voltar", () => {
    // O ciclo completo, que é como o usuário encontra isto: ajustar, espiar o
    // Entropy, voltar. Perder os pesos aqui só apareceria no fim, com os
    // sliders no uniforme sem ninguém ter mexido neles.
    let s = estado({ mode: WEIGHTING_MODES.ENFOQUE, groupWeights: PESOS_AJUSTADOS });
    s = mmsReducer(s, { type: "SET_MCDM_MODE", mode: WEIGHTING_MODES.ENTROPY });
    s = mmsReducer(s, { type: "SET_MCDM_MODE", mode: WEIGHTING_MODES.ENFOQUE });
    expect(mcdmDe(s).groupWeights).toEqual(PESOS_AJUSTADOS);
  });

  it("não toca nas outras sub-árvores de pesos", () => {
    const depois = mmsReducer(estado(), { type: "SET_MCDM_MODE", mode: WEIGHTING_MODES.ENTROPY });
    expect(depois.formData.criteriaWeights.ubc).toBe(SENTINELA_UBC);
  });

  it("não toca nos resultados nem nos cenários", () => {
    const antes  = estado();
    const depois = mmsReducer(antes, { type: "SET_MCDM_MODE", mode: WEIGHTING_MODES.ENTROPY });
    expect(depois.results).toBe(SENTINELA_RESULTS);
    expect(depois.mcdmScenarios).toBe(antes.mcdmScenarios);
  });

  it("não toca no resto do formData", () => {
    const antes  = estado();
    const depois = mmsReducer(antes, { type: "SET_MCDM_MODE", mode: WEIGHTING_MODES.ENTROPY });
    expect(depois.formData.geometry).toBe(antes.formData.geometry);
  });

  it("não muta o estado recebido", () => {
    const antes = estado();
    mmsReducer(antes, { type: "SET_MCDM_MODE", mode: WEIGHTING_MODES.ENTROPY });
    expect(mcdmDe(antes).mode).toBe(WEIGHTING_MODES.ENFOQUE);
  });

  it("mexer num slider não muda o modo", () => {
    const antes  = estado({ mode: WEIGHTING_MODES.ENTROPY, groupWeights: equalGroupWeights() });
    const depois = mmsReducer(antes, { type: "SET_MCDM_GROUP_WEIGHT", group: GEOMETRY, value: 0.6 });
    expect(mcdmDe(depois).mode).toBe(WEIGHTING_MODES.ENTROPY);
  });
});

describe("defaults e reset", () => {
  it("o modo padrão é Enfoque — o comportamento que existia antes do campo", () => {
    const depois = mmsReducer(estado(), { type: "RESET_ALL" });
    expect(depois.formData.criteriaWeights.mcdm.mode).toBe(WEIGHTING_MODES.ENFOQUE);
  });

  it("RESET_CRITERIA_WEIGHTS também repõe o modo padrão", () => {
    const s = mmsReducer(
      estado({ mode: WEIGHTING_MODES.ENTROPY, groupWeights: equalGroupWeights() }),
      { type: "RESET_CRITERIA_WEIGHTS" },
    );
    expect(mcdmDe(s).mode).toBe(WEIGHTING_MODES.ENFOQUE);
  });
});

// ---------------------------------------------------------------------------
// PERSISTÊNCIA
// ---------------------------------------------------------------------------
// O estado gravado por qualquer versão anterior a Entropy tem groupWeights e
// NÃO tem mode. O reparo precisa acrescentar o campo que falta sem descartar os
// pesos que estão lá — mesma família de correção que já cobria groupWeights
// ausente, e o mesmo cuidado: reparar o mínimo.

describe("normalizeMcdmWeights — o campo mode", () => {
  it("acrescenta o modo quando o estado gravado não tem", () => {
    const salvo = estado({ groupWeights: equalGroupWeights() }).formData;
    expect(normalizeMcdmWeights(salvo).criteriaWeights.mcdm.mode).toBe(WEIGHTING_MODES.ENFOQUE);
  });

  it("PRESERVA os pesos ao acrescentar o modo que faltava", () => {
    const salvo  = estado({ groupWeights: PESOS_AJUSTADOS }).formData;
    const depois = normalizeMcdmWeights(salvo);
    expect(depois.criteriaWeights.mcdm.groupWeights).toEqual(PESOS_AJUSTADOS);
  });

  it("preserva um modo Entropy legitimamente gravado", () => {
    const salvo = estado({ mode: WEIGHTING_MODES.ENTROPY, groupWeights: equalGroupWeights() }).formData;
    expect(normalizeMcdmWeights(salvo).criteriaWeights.mcdm.mode).toBe(WEIGHTING_MODES.ENTROPY);
  });

  it("repõe modo desconhecido, sem descartar os pesos", () => {
    const salvo  = estado({ mode: "modo-inventado", groupWeights: PESOS_AJUSTADOS }).formData;
    const depois = normalizeMcdmWeights(salvo);
    expect(depois.criteriaWeights.mcdm.mode).toBe(WEIGHTING_MODES.ENFOQUE);
    expect(depois.criteriaWeights.mcdm.groupWeights).toEqual(PESOS_AJUSTADOS);
  });

  it("repõe o modo 'none' — existe em enfoque.js, mas a tela não o oferece", () => {
    const salvo = estado({ mode: WEIGHTING_MODES.NONE, groupWeights: equalGroupWeights() }).formData;
    expect(normalizeMcdmWeights(salvo).criteriaWeights.mcdm.mode).toBe(WEIGHTING_MODES.ENFOQUE);
  });

  it("devolve o MESMO objeto quando pesos, modo e rebalanceamento são válidos", () => {
    const salvo = estado({
      mode:          WEIGHTING_MODES.ENTROPY,
      rebalanceMode: REBALANCE_MODES.PROPORTIONAL,
      groupWeights:  PESOS_AJUSTADOS,
    }).formData;
    expect(normalizeMcdmWeights(salvo)).toBe(salvo);
  });

  it("pesos inválidos repõem a sub-árvore inteira, modo incluído", () => {
    const torto = { [GEOMETRY]: 0.9, [GEOMECHANICS]: 0.9, [TECHNICAL]: 0.9, [ECONOMIC]: 0.9 };
    const salvo = estado({ mode: WEIGHTING_MODES.ENTROPY, groupWeights: torto }).formData;
    const depois = normalizeMcdmWeights(salvo);
    expect(depois.criteriaWeights.mcdm.groupWeights).toEqual(equalGroupWeights());
    expect(depois.criteriaWeights.mcdm.mode).toBe(WEIGHTING_MODES.ENFOQUE);
  });

  it("é idempotente — normalizar duas vezes dá o mesmo objeto", () => {
    const salvo = estado({ groupWeights: PESOS_AJUSTADOS }).formData;
    const uma   = normalizeMcdmWeights(salvo);
    expect(normalizeMcdmWeights(uma)).toBe(uma);
  });

  it("sobrevive a uma ida e volta por JSON, como no localStorage", () => {
    const salvo = estado({ mode: WEIGHTING_MODES.ENTROPY, groupWeights: PESOS_AJUSTADOS }).formData;
    const daStorage = JSON.parse(JSON.stringify(salvo));
    const depois = normalizeMcdmWeights(daStorage);
    expect(depois.criteriaWeights.mcdm.mode).toBe(WEIGHTING_MODES.ENTROPY);
    expect(depois.criteriaWeights.mcdm.groupWeights).toEqual(PESOS_AJUSTADOS);
  });
});
