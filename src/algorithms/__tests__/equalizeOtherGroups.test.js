import { describe, it, expect } from "vitest";
import { equalizeOtherGroups, rebalanceGroupWeights, REBALANCE_MODES } from "../enfoqueRebalance";
import {
  ENFOQUE_GROUP_IDS,
  GROUP_WEIGHT_TOLERANCE,
  equalGroupWeights,
  validateGroupWeights,
} from "../enfoque";
import { CRITERION_GROUPS } from "../mcdmCriteria";

// ---------------------------------------------------------------------------
// REBALANCEAMENTO POR IGUALAÇÃO DOS PESOS DE GRUPO
// ---------------------------------------------------------------------------
// A segunda política de rebalanceamento, companheira da proporcional. O
// contrato de SAÍDA é o mesmo — o que sai daqui sempre passa em
// validateGroupWeights — e é por isso que os testes terminam validando de
// verdade em vez de só comparar números.
//
// O que muda é a REGRA: os três grupos não alterados recebem (1 - V) / 3 cada,
// e a repartição que tinham entre si é descartada. Testar isso é, em boa parte,
// testar que a entrada anterior NÃO influencia a saída — daí os casos que
// partem de vetores bem diferentes e esperam o mesmo resultado.

const { GEOMETRY, GEOMECHANICS, TECHNICAL, ECONOMIC } = CRITERION_GROUPS;

const soma = (pesos) => ENFOQUE_GROUP_IDS.reduce((acc, id) => acc + pesos[id], 0);

const pesos = (geometry, geomechanics, technical, economic) => ({
  [GEOMETRY]:     geometry,
  [GEOMECHANICS]: geomechanics,
  [TECHNICAL]:    technical,
  [ECONOMIC]:     economic,
});

describe("fórmula", () => {
  // O caso que originou o modo, conferido à mão: 0.7 no grupo alterado e
  // (1 - 0.7) / 3 = 0.1 exato em cada um dos outros três.
  it("Geometria em 0.7 deixa os outros três em 0.1 cada", () => {
    const resultado = equalizeOtherGroups(equalGroupWeights(), GEOMETRY, 0.7);
    expect(resultado[GEOMETRY]).toBeCloseTo(0.7, 12);
    expect(resultado[GEOMECHANICS]).toBeCloseTo(0.1, 12);
    expect(resultado[TECHNICAL]).toBeCloseTo(0.1, 12);
    expect(resultado[ECONOMIC]).toBeCloseTo(0.1, 12);
  });

  it("0.4 no grupo alterado deixa 0.2 em cada um dos outros", () => {
    const resultado = equalizeOtherGroups(equalGroupWeights(), TECHNICAL, 0.4);
    expect(resultado[TECHNICAL]).toBeCloseTo(0.4, 12);
    for (const id of [GEOMETRY, GEOMECHANICS, ECONOMIC]) {
      expect(resultado[id]).toBeCloseTo(0.2, 12);
    }
  });

  it("0.25 reconstrói o uniforme", () => {
    const resultado = equalizeOtherGroups(pesos(0.9, 0.05, 0.05, 0), GEOMETRY, 0.25);
    for (const id of ENFOQUE_GROUP_IDS) expect(resultado[id]).toBeCloseTo(0.25, 12);
  });

  it("devolve exatamente o valor pedido no grupo alterado", () => {
    for (const id of ENFOQUE_GROUP_IDS) {
      expect(equalizeOtherGroups(equalGroupWeights(), id, 0.55)[id]).toBeCloseTo(0.55, 12);
    }
  });
});

describe("a repartição anterior é descartada", () => {
  // O ponto que distingue este modo do proporcional: qualquer que fosse a
  // repartição entre os outros três, o resultado é o mesmo.
  it("entradas bem diferentes produzem a MESMA saída", () => {
    const a = equalizeOtherGroups(pesos(0.1, 0.8, 0.05, 0.05), GEOMETRY, 0.7);
    const b = equalizeOtherGroups(pesos(0.4, 0.0, 0.30, 0.30), GEOMETRY, 0.7);
    const c = equalizeOtherGroups(null, GEOMETRY, 0.7);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it("difere do proporcional quando os outros três não eram iguais", () => {
    const partida     = pesos(0.4, 0.1, 0.2, 0.3);
    const igualado    = equalizeOtherGroups(partida, GEOMETRY, 0.7);
    const proporcional = rebalanceGroupWeights(partida, GEOMETRY, 0.7);
    expect(igualado[GEOMECHANICS]).toBeCloseTo(0.1, 12);
    expect(proporcional[GEOMECHANICS]).not.toBeCloseTo(igualado[GEOMECHANICS], 6);
  });

  it("coincide com o proporcional quando os outros três já eram iguais", () => {
    const igualado     = equalizeOtherGroups(equalGroupWeights(), GEOMETRY, 0.7);
    const proporcional = rebalanceGroupWeights(equalGroupWeights(), GEOMETRY, 0.7);
    for (const id of ENFOQUE_GROUP_IDS) {
      expect(igualado[id]).toBeCloseTo(proporcional[id], 12);
    }
  });

  it("não muta o objeto recebido", () => {
    const original = pesos(0.4, 0.1, 0.2, 0.3);
    equalizeOtherGroups(original, GEOMETRY, 0.9);
    expect(original).toEqual(pesos(0.4, 0.1, 0.2, 0.3));
  });
});

describe("a soma continua 1", () => {
  it("nos extremos do intervalo", () => {
    for (const valor of [0, 1]) {
      const resultado = equalizeOtherGroups(pesos(0.13, 0.37, 0.29, 0.21), GEOMETRY, valor);
      expect(soma(resultado)).toBeCloseTo(1, 12);
      expect(() => validateGroupWeights(resultado)).not.toThrow();
    }
  });

  it("em 1 os outros três zeram", () => {
    const resultado = equalizeOtherGroups(equalGroupWeights(), GEOMECHANICS, 1);
    expect(resultado[GEOMECHANICS]).toBeCloseTo(1, 12);
    for (const id of [GEOMETRY, TECHNICAL, ECONOMIC]) expect(resultado[id]).toBeCloseTo(0, 12);
  });

  it("em 0 os outros três ficam com 1/3 cada", () => {
    const resultado = equalizeOtherGroups(pesos(0.9, 0.05, 0.05, 0), GEOMETRY, 0);
    expect(resultado[GEOMETRY]).toBeCloseTo(0, 12);
    for (const id of [GEOMECHANICS, TECHNICAL, ECONOMIC]) {
      expect(resultado[id]).toBeCloseTo(1 / 3, 12);
    }
  });

  // Entrada torta (soma ≠ 1, chaves faltando) não contamina a saída: ao
  // contrário da proporcional, aqui a entrada nem é lida.
  it("conserta vetor de entrada inválido", () => {
    const resultado = equalizeOtherGroups({ [GEOMETRY]: 5, [ECONOMIC]: "x" }, TECHNICAL, 0.25);
    expect(soma(resultado)).toBeCloseTo(1, 12);
    expect(() => validateGroupWeights(resultado)).not.toThrow();
  });

  it("aguenta cem rebalanceamentos encadeados sem estourar a tolerância", () => {
    let atual = equalGroupWeights();
    for (let i = 0; i < 100; i++) {
      const grupo = ENFOQUE_GROUP_IDS[i % ENFOQUE_GROUP_IDS.length];
      atual = equalizeOtherGroups(atual, grupo, (i % 101) / 100);
      expect(Math.abs(soma(atual) - 1)).toBeLessThan(GROUP_WEIGHT_TOLERANCE);
    }
    expect(() => validateGroupWeights(atual)).not.toThrow();
  });
});

describe("reversibilidade", () => {
  // Ir a um extremo e voltar ao uniforme devolve o uniforme. Não é o mesmo tipo
  // de reversibilidade da proporcional (lá a proporção anterior é o que se
  // perde no caminho); aqui vale porque 0.25 sempre reconstrói o uniforme.
  it("ida ao extremo e volta a 0.25 devolve o uniforme", () => {
    const tudoEmUm = equalizeOtherGroups(pesos(0.4, 0.1, 0.2, 0.3), GEOMETRY, 1);
    const devolta  = equalizeOtherGroups(tudoEmUm, GEOMETRY, 0.25);
    for (const id of ENFOQUE_GROUP_IDS) expect(devolta[id]).toBeCloseTo(0.25, 12);
  });

  it("mover o mesmo grupo duas vezes é o mesmo que mover uma só vez", () => {
    const passo   = equalizeOtherGroups(pesos(0.4, 0.1, 0.2, 0.3), GEOMETRY, 0.6);
    const segundo = equalizeOtherGroups(passo, GEOMETRY, 0.7);
    const direto  = equalizeOtherGroups(pesos(0.4, 0.1, 0.2, 0.3), GEOMETRY, 0.7);
    for (const id of ENFOQUE_GROUP_IDS) expect(segundo[id]).toBeCloseTo(direto[id], 12);
  });
});

describe("entrada inválida", () => {
  // Mesmas guardas da companheira, e pelo mesmo motivo: quem chama é o reducer,
  // e um valor torto chegando lá derrubaria a tela inteira.
  it("recusa grupo desconhecido", () => {
    expect(() => equalizeOtherGroups(equalGroupWeights(), "financeiro", 0.5)).toThrow(RangeError);
  });

  it("recusa valor fora de [0, 1]", () => {
    expect(() => equalizeOtherGroups(equalGroupWeights(), GEOMETRY, 1.5)).toThrow(RangeError);
    expect(() => equalizeOtherGroups(equalGroupWeights(), GEOMETRY, -0.1)).toThrow(RangeError);
  });

  it("recusa valor não numérico", () => {
    expect(() => equalizeOtherGroups(equalGroupWeights(), GEOMETRY, "0.5")).toThrow(RangeError);
    expect(() => equalizeOtherGroups(equalGroupWeights(), GEOMETRY, NaN)).toThrow(RangeError);
  });
});

describe("REBALANCE_MODES", () => {
  it("nomeia as duas políticas com os valores que o estado grava", () => {
    expect(REBALANCE_MODES.PROPORTIONAL).toBe("proportional");
    expect(REBALANCE_MODES.EQUALIZE).toBe("equalize");
  });
});
