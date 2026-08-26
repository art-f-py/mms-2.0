import { describe, it, expect } from "vitest";
import { mmsReducer, normalizeMcdmWeights } from "../MmsContext";
import {
  ENFOQUE_GROUP_IDS,
  equalGroupWeights,
  validateGroupWeights,
} from "../../algorithms/enfoque";
import { CRITERION_GROUPS } from "../../algorithms/mcdmCriteria";

// ---------------------------------------------------------------------------
// PESOS DO MCDM NO ESTADO — SUB-ÁRVORE ADITIVA
// ---------------------------------------------------------------------------
// Duas coisas para provar aqui. A primeira é que a sub-árvore nova é ADITIVA:
// mexer nela não pode encostar em ubc/nicholas/shb nem nos resultados. A
// segunda é que o rebalanceamento acontece DENTRO do reducer — o estado nunca
// chega a guardar um vetor que não some 1.

const { GEOMETRY, GEOMECHANICS, TECHNICAL, ECONOMIC } = CRITERION_GROUPS;

// Sentinelas nas outras sub-árvores: se o reducer as recriar em vez de
// preservá-las por referência, o teste mostra exatamente qual sumiu.
const SENTINELA_UBC      = { geo: { shape: 0.5 } };
const SENTINELA_NICHOLAS = { geo: { shape: 1.7 }, domain: { geo: 1, ob: 1.33 } };
const SENTINELA_SHB      = { econ: { oreValue: 0.25 } };
const SENTINELA_RESULTS  = { ubc: { scores: {} }, nicholas: null, shb: null };

const estado = (groupWeights = equalGroupWeights()) => ({
  formData: {
    geometry: { shape: "Tabular", thickness: "Intermediário", grade: "Uniforme" },
    criteriaWeights: {
      ubc:      SENTINELA_UBC,
      nicholas: SENTINELA_NICHOLAS,
      shb:      SENTINELA_SHB,
      mcdm:     { groupWeights },
    },
  },
  results: SENTINELA_RESULTS,
});

const pesosDe = (s) => s.formData.criteriaWeights.mcdm.groupWeights;
const soma    = (pesos) => ENFOQUE_GROUP_IDS.reduce((acc, id) => acc + pesos[id], 0);

describe("SET_MCDM_GROUP_WEIGHT", () => {
  it("grava o valor pedido no grupo alterado", () => {
    const depois = mmsReducer(estado(), { type: "SET_MCDM_GROUP_WEIGHT", group: GEOMETRY, value: 0.4 });
    expect(pesosDe(depois)[GEOMETRY]).toBeCloseTo(0.4, 12);
  });

  it("rebalanceia os outros três — o estado guardado sempre soma 1", () => {
    const depois = mmsReducer(estado(), { type: "SET_MCDM_GROUP_WEIGHT", group: GEOMETRY, value: 0.4 });
    expect(soma(pesosDe(depois))).toBeCloseTo(1, 12);
    expect(() => validateGroupWeights(pesosDe(depois))).not.toThrow();
    expect(pesosDe(depois)[GEOMECHANICS]).toBeCloseTo(0.2, 12);
    expect(pesosDe(depois)[TECHNICAL]).toBeCloseTo(0.2, 12);
    expect(pesosDe(depois)[ECONOMIC]).toBeCloseTo(0.2, 12);
  });

  it("não toca nas outras sub-árvores de pesos", () => {
    const depois = mmsReducer(estado(), { type: "SET_MCDM_GROUP_WEIGHT", group: TECHNICAL, value: 0.7 });
    expect(depois.formData.criteriaWeights.ubc).toBe(SENTINELA_UBC);
    expect(depois.formData.criteriaWeights.nicholas).toBe(SENTINELA_NICHOLAS);
    expect(depois.formData.criteriaWeights.shb).toBe(SENTINELA_SHB);
  });

  it("não toca nos resultados dos três métodos clássicos", () => {
    const depois = mmsReducer(estado(), { type: "SET_MCDM_GROUP_WEIGHT", group: ECONOMIC, value: 0.1 });
    expect(depois.results).toBe(SENTINELA_RESULTS);
  });

  it("não toca no resto do formData", () => {
    const antes  = estado();
    const depois = mmsReducer(antes, { type: "SET_MCDM_GROUP_WEIGHT", group: GEOMETRY, value: 0.9 });
    expect(depois.formData.geometry).toBe(antes.formData.geometry);
  });

  it("não muta o estado recebido", () => {
    const antes    = estado();
    const original = { ...pesosDe(antes) };
    mmsReducer(antes, { type: "SET_MCDM_GROUP_WEIGHT", group: GEOMETRY, value: 0.9 });
    expect(pesosDe(antes)).toEqual(original);
  });

  it("aguenta uma cadeia de interações sem drift acumulado", () => {
    // O caminho real do usuário: arrastar vários sliders em sequência. Cada
    // despacho parte do estado que o anterior produziu.
    let atual = estado();
    const valores = [0.1, 0.37, 0.9, 0.03, 0.66, 0.5];
    for (let i = 0; i < 300; i += 1) {
      atual = mmsReducer(atual, {
        type:  "SET_MCDM_GROUP_WEIGHT",
        group: ENFOQUE_GROUP_IDS[i % ENFOQUE_GROUP_IDS.length],
        value: valores[i % valores.length],
      });
      expect(() => validateGroupWeights(pesosDe(atual))).not.toThrow();
    }
  });

  it("repara um vetor persistido inválido em vez de propagá-lo", () => {
    // Entrada que não soma 1 — o rebalanceamento reconstrói a soma em vez de
    // escalar o desvio junto.
    const torto = { [GEOMETRY]: 0.5, [GEOMECHANICS]: 0.5, [TECHNICAL]: 0.5, [ECONOMIC]: 0.5 };
    const depois = mmsReducer(estado(torto), { type: "SET_MCDM_GROUP_WEIGHT", group: GEOMETRY, value: 0.25 });
    expect(() => validateGroupWeights(pesosDe(depois))).not.toThrow();
  });
});

describe("defaults e reset", () => {
  it("RESET_ALL devolve os quatro grupos ao uniforme", () => {
    const mexido = mmsReducer(estado(), { type: "SET_MCDM_GROUP_WEIGHT", group: GEOMETRY, value: 0.95 });
    const depois = mmsReducer(mexido, { type: "RESET_ALL" });
    expect(pesosDe(depois)).toEqual(equalGroupWeights());
  });

  it("RESET_CRITERIA_WEIGHTS também repõe o uniforme", () => {
    const mexido = mmsReducer(estado(), { type: "SET_MCDM_GROUP_WEIGHT", group: GEOMETRY, value: 0.95 });
    const depois = mmsReducer(mexido, { type: "RESET_CRITERIA_WEIGHTS" });
    expect(pesosDe(depois)).toEqual(equalGroupWeights());
  });

  it("o uniforme padrão é entrada válida por construção", () => {
    expect(() => validateGroupWeights(equalGroupWeights())).not.toThrow();
  });
});

describe("normalizeMcdmWeights — estado persistido de versões anteriores", () => {
  it("acrescenta a sub-árvore quando o estado salvo não tem mcdm", () => {
    // O caso que motivou a função: o merge de loadInitialState é raso, então um
    // criteriaWeights salvo antes desta versão substituiria o default inteiro.
    const antigo = { criteriaWeights: { ubc: SENTINELA_UBC, nicholas: SENTINELA_NICHOLAS, shb: SENTINELA_SHB } };
    const depois = normalizeMcdmWeights(antigo);
    expect(depois.criteriaWeights.mcdm.groupWeights).toEqual(equalGroupWeights());
  });

  it("preserva as outras sub-árvores ao acrescentar", () => {
    const antigo = { criteriaWeights: { ubc: SENTINELA_UBC, nicholas: SENTINELA_NICHOLAS, shb: SENTINELA_SHB } };
    const depois = normalizeMcdmWeights(antigo);
    expect(depois.criteriaWeights.ubc).toBe(SENTINELA_UBC);
    expect(depois.criteriaWeights.nicholas).toBe(SENTINELA_NICHOLAS);
    expect(depois.criteriaWeights.shb).toBe(SENTINELA_SHB);
  });

  it("devolve o MESMO objeto quando já há pesos válidos", () => {
    const atual = estado().formData;
    expect(normalizeMcdmWeights(atual)).toBe(atual);
  });

  it("preserva pesos válidos e não uniformes que o usuário salvou", () => {
    const salvos = { [GEOMETRY]: 0.7, [GEOMECHANICS]: 0.1, [TECHNICAL]: 0.1, [ECONOMIC]: 0.1 };
    const depois = normalizeMcdmWeights(estado(salvos).formData);
    expect(depois.criteriaWeights.mcdm.groupWeights).toEqual(salvos);
  });

  it("descarta pesos gravados que não passam na validação", () => {
    const adulterado = { [GEOMETRY]: 0.9, [GEOMECHANICS]: 0.9, [TECHNICAL]: 0.9, [ECONOMIC]: 0.9 };
    const depois = normalizeMcdmWeights(estado(adulterado).formData);
    expect(depois.criteriaWeights.mcdm.groupWeights).toEqual(equalGroupWeights());
  });

  it("aguenta criteriaWeights inteiramente ausente", () => {
    const depois = normalizeMcdmWeights({ geometry: {} });
    expect(depois.criteriaWeights.mcdm.groupWeights).toEqual(equalGroupWeights());
  });
});
