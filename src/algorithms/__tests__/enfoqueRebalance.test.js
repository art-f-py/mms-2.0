import { describe, it, expect } from "vitest";
import { rebalanceGroupWeights, REBALANCE_NEAR_ZERO } from "../enfoqueRebalance";
import {
  ENFOQUE_GROUP_IDS,
  GROUP_WEIGHT_TOLERANCE,
  equalGroupWeights,
  validateGroupWeights,
} from "../enfoque";
import { CRITERION_GROUPS } from "../mcdmCriteria";

// ---------------------------------------------------------------------------
// REBALANCEAMENTO PROPORCIONAL DOS PESOS DE GRUPO
// ---------------------------------------------------------------------------
// O contrato que estes testes fixam: seja qual for a sequência de interações,
// o que sai daqui SEMPRE passa em validateGroupWeights. É por isso que quase
// todo teste termina chamando a validação de verdade, e não só comparando
// números — o que importa não é o valor em si, é o invariante continuar de pé.

const { GEOMETRY, GEOMECHANICS, TECHNICAL, ECONOMIC } = CRITERION_GROUPS;

const soma = (pesos) => ENFOQUE_GROUP_IDS.reduce((acc, id) => acc + pesos[id], 0);

// Atalho para não repetir o objeto de quatro chaves em cada caso.
const pesos = (geometry, geomechanics, technical, economic) => ({
  [GEOMETRY]:     geometry,
  [GEOMECHANICS]: geomechanics,
  [TECHNICAL]:    technical,
  [ECONOMIC]:     economic,
});

describe("rebalanceamento normal", () => {
  it("devolve exatamente o valor pedido no grupo alterado", () => {
    const resultado = rebalanceGroupWeights(equalGroupWeights(), GEOMETRY, 0.4);
    expect(resultado[GEOMETRY]).toBeCloseTo(0.4, 12);
  });

  it("os quatro pesos somam 1", () => {
    const resultado = rebalanceGroupWeights(equalGroupWeights(), GEOMETRY, 0.4);
    expect(soma(resultado)).toBeCloseTo(1, 12);
    expect(() => validateGroupWeights(resultado)).not.toThrow();
  });

  it("reparte o restante igualmente quando os outros já eram iguais", () => {
    // 0.4 no primeiro deixa 0.6 para os outros três: 0.2 cada.
    const resultado = rebalanceGroupWeights(equalGroupWeights(), GEOMETRY, 0.4);
    expect(resultado[GEOMECHANICS]).toBeCloseTo(0.2, 12);
    expect(resultado[TECHNICAL]).toBeCloseTo(0.2, 12);
    expect(resultado[ECONOMIC]).toBeCloseTo(0.2, 12);
  });

  it("preserva a PROPORÇÃO entre os outros três, não os valores", () => {
    // Outros na razão 1 : 2 : 3 (0.1 / 0.2 / 0.3, soma 0.6). Subir o primeiro
    // para 0.7 deixa 0.3 a repartir — a razão 1:2:3 tem que sobreviver.
    const resultado = rebalanceGroupWeights(pesos(0.4, 0.1, 0.2, 0.3), GEOMETRY, 0.7);
    expect(resultado[GEOMECHANICS]).toBeCloseTo(0.05, 12);
    expect(resultado[TECHNICAL]).toBeCloseTo(0.10, 12);
    expect(resultado[ECONOMIC]).toBeCloseTo(0.15, 12);
    expect(resultado[TECHNICAL] / resultado[GEOMECHANICS]).toBeCloseTo(2, 9);
    expect(resultado[ECONOMIC]  / resultado[GEOMECHANICS]).toBeCloseTo(3, 9);
  });

  it("funciona para qualquer um dos quatro grupos, não só o primeiro", () => {
    for (const id of ENFOQUE_GROUP_IDS) {
      const resultado = rebalanceGroupWeights(equalGroupWeights(), id, 0.55);
      expect(resultado[id]).toBeCloseTo(0.55, 12);
      expect(() => validateGroupWeights(resultado)).not.toThrow();
    }
  });

  it("não muta o objeto recebido", () => {
    const original = equalGroupWeights();
    const copia    = { ...original };
    rebalanceGroupWeights(original, GEOMETRY, 0.9);
    expect(original).toEqual(copia);
  });

  it("baixar um grupo devolve peso aos outros, mantendo a proporção", () => {
    const resultado = rebalanceGroupWeights(pesos(0.7, 0.05, 0.10, 0.15), GEOMETRY, 0.1);
    expect(resultado[GEOMETRY]).toBeCloseTo(0.1, 12);
    // Os outros somavam 0.3 e passam a somar 0.9 — fator 3 em cada um.
    expect(resultado[GEOMECHANICS]).toBeCloseTo(0.15, 12);
    expect(resultado[TECHNICAL]).toBeCloseTo(0.30, 12);
    expect(resultado[ECONOMIC]).toBeCloseTo(0.45, 12);
  });
});

describe("soma dos outros ≈ 0", () => {
  it("distribui o restante igualmente quando os outros três estão zerados", () => {
    // Estado de partida: um grupo com tudo. Descer para 0.4 não tem proporção
    // anterior a preservar — 0.6 se divide em três partes iguais.
    const resultado = rebalanceGroupWeights(pesos(1, 0, 0, 0), GEOMETRY, 0.4);
    expect(resultado[GEOMETRY]).toBeCloseTo(0.4, 12);
    expect(resultado[GEOMECHANICS]).toBeCloseTo(0.2, 12);
    expect(resultado[TECHNICAL]).toBeCloseTo(0.2, 12);
    expect(resultado[ECONOMIC]).toBeCloseTo(0.2, 12);
    expect(() => validateGroupWeights(resultado)).not.toThrow();
  });

  it("trata resíduo abaixo de REBALANCE_NEAR_ZERO como zero", () => {
    // Um "zero" que sobrou de rebalanceamentos anteriores. Sem o limiar, o
    // fator de escala seria (0.6 / 3e-18) e os pesos explodiriam.
    const residuo = REBALANCE_NEAR_ZERO / 1000;
    const resultado = rebalanceGroupWeights(
      pesos(1 - 3 * residuo, residuo, residuo, residuo), GEOMETRY, 0.4,
    );
    expect(resultado[GEOMECHANICS]).toBeCloseTo(0.2, 12);
    expect(resultado[TECHNICAL]).toBeCloseTo(0.2, 12);
    expect(resultado[ECONOMIC]).toBeCloseTo(0.2, 12);
    expect(() => validateGroupWeights(resultado)).not.toThrow();
  });

  it("NÃO cai na distribuição igual com pesos pequenos porém legítimos", () => {
    // A fronteira do outro lado: 3e-4 é pequeno, mas é uma proporção real que
    // o usuário pediu. Tem que ser escalada, não substituída por 1/3 cada.
    const resultado = rebalanceGroupWeights(pesos(0.9997, 0.0001, 0.0002, 0.0000), GEOMETRY, 0.4);
    expect(resultado[TECHNICAL] / resultado[GEOMECHANICS]).toBeCloseTo(2, 9);
    expect(resultado[ECONOMIC]).toBeCloseTo(0, 12);
    expect(() => validateGroupWeights(resultado)).not.toThrow();
  });

  it("recupera de um vetor todo zerado, que nem soma 1", () => {
    // Não é entrada legítima — é a rede de baixo. O ponto é sair daqui com um
    // vetor válido em vez de propagar o estado quebrado.
    const resultado = rebalanceGroupWeights(pesos(0, 0, 0, 0), TECHNICAL, 0.25);
    expect(resultado[TECHNICAL]).toBeCloseTo(0.25, 12);
    expect(() => validateGroupWeights(resultado)).not.toThrow();
  });

  it("recupera de chaves ausentes e de valores não numéricos", () => {
    const resultado = rebalanceGroupWeights(
      { [GEOMETRY]: 0.5, [GEOMECHANICS]: undefined, [TECHNICAL]: NaN }, ECONOMIC, 0.5,
    );
    expect(resultado[ECONOMIC]).toBeCloseTo(0.5, 12);
    expect(() => validateGroupWeights(resultado)).not.toThrow();
  });

  it("aceita currentWeights nulo, distribuindo o restante igualmente", () => {
    const resultado = rebalanceGroupWeights(null, GEOMETRY, 0.7);
    expect(resultado[GEOMETRY]).toBeCloseTo(0.7, 12);
    expect(resultado[GEOMECHANICS]).toBeCloseTo(0.1, 12);
    expect(() => validateGroupWeights(resultado)).not.toThrow();
  });
});

describe("caso trivial — um grupo leva tudo", () => {
  it("mover um slider para 1 zera os outros três", () => {
    const resultado = rebalanceGroupWeights(equalGroupWeights(), GEOMECHANICS, 1);
    expect(resultado[GEOMECHANICS]).toBe(1);
    expect(resultado[GEOMETRY]).toBe(0);
    expect(resultado[TECHNICAL]).toBe(0);
    expect(resultado[ECONOMIC]).toBe(0);
    expect(soma(resultado)).toBe(1);
    expect(() => validateGroupWeights(resultado)).not.toThrow();
  });

  it("o grupo em 1 continua exatamente 1 — a correção de drift não o empurra para fora de [0, 1]", () => {
    // Se o resíduo fosse somado sem clamp, 1 + 1e-16 reprovaria em
    // validateGroupWeights por "fora de [0, 1]" — não por soma errada.
    const resultado = rebalanceGroupWeights(pesos(0.13, 0.37, 0.29, 0.21), GEOMETRY, 1);
    expect(resultado[GEOMETRY]).toBeLessThanOrEqual(1);
    expect(resultado[GEOMETRY]).toBe(1);
    expect(() => validateGroupWeights(resultado)).not.toThrow();
  });

  it("mover um slider para 0 reparte tudo entre os outros três", () => {
    const resultado = rebalanceGroupWeights(equalGroupWeights(), GEOMETRY, 0);
    expect(resultado[GEOMETRY]).toBe(0);
    expect(soma(resultado)).toBeCloseTo(1, 12);
    expect(() => validateGroupWeights(resultado)).not.toThrow();
  });

  it("sair de um grupo em 1 é reversível — volta a distribuir", () => {
    const tudoEmUm = rebalanceGroupWeights(equalGroupWeights(), GEOMETRY, 1);
    const devolta  = rebalanceGroupWeights(tudoEmUm, GEOMETRY, 0.25);
    expect(devolta[GEOMETRY]).toBeCloseTo(0.25, 12);
    expect(devolta[GEOMECHANICS]).toBeCloseTo(0.25, 12);
    expect(() => validateGroupWeights(devolta)).not.toThrow();
  });
});

describe("correção de drift de ponto flutuante", () => {
  it("a soma é 1 dentro da tolerância depois de mil rebalanceamentos encadeados", () => {
    // O cenário que motivou a correção: o resultado de um passo é a entrada do
    // próximo, então o erro de arredondamento se acumula em vez de se cancelar.
    // Valores escolhidos para produzir dízimas em binário (0.1, 0.3, 0.7...).
    const valores = [0.1, 0.37, 0.9, 0.03, 0.66, 0.5, 0.21, 0.84];
    let atual = equalGroupWeights();

    for (let i = 0; i < 1000; i += 1) {
      const grupo = ENFOQUE_GROUP_IDS[i % ENFOQUE_GROUP_IDS.length];
      atual = rebalanceGroupWeights(atual, grupo, valores[i % valores.length]);
      // A validação DENTRO do laço: um drift que só aparecesse no passo 700
      // passaria despercebido se a checagem ficasse só no fim.
      expect(Math.abs(soma(atual) - 1)).toBeLessThanOrEqual(GROUP_WEIGHT_TOLERANCE);
    }

    expect(() => validateGroupWeights(atual)).not.toThrow();
  });

  it("mil rebalanceamentos passando por zero e por um também mantêm a soma", () => {
    // Alterna entre os extremos, que é onde os dois ramos (proporcional e
    // distribuição igual) se revezam a cada passo.
    let atual = equalGroupWeights();
    for (let i = 0; i < 1000; i += 1) {
      const grupo = ENFOQUE_GROUP_IDS[i % ENFOQUE_GROUP_IDS.length];
      atual = rebalanceGroupWeights(atual, grupo, i % 3 === 0 ? 1 : i % 3 === 1 ? 0 : 0.33);
      expect(Math.abs(soma(atual) - 1)).toBeLessThanOrEqual(GROUP_WEIGHT_TOLERANCE);
    }
    expect(() => validateGroupWeights(atual)).not.toThrow();
  });

  it("corrige um vetor que já chega com resíduo", () => {
    // Entrada fora da tolerância de propósito — o rebalanceamento não propaga
    // o desvio, reconstrói a soma.
    const torto = pesos(0.25, 0.25, 0.25, 0.2500001);
    const resultado = rebalanceGroupWeights(torto, TECHNICAL, 0.25);
    expect(Math.abs(soma(resultado) - 1)).toBeLessThanOrEqual(GROUP_WEIGHT_TOLERANCE);
    expect(() => validateGroupWeights(resultado)).not.toThrow();
  });

  it("nenhum peso escapa de [0, 1] ao longo da cadeia", () => {
    let atual = equalGroupWeights();
    for (let i = 0; i < 500; i += 1) {
      const grupo = ENFOQUE_GROUP_IDS[i % ENFOQUE_GROUP_IDS.length];
      atual = rebalanceGroupWeights(atual, grupo, (i % 101) / 100);
      for (const id of ENFOQUE_GROUP_IDS) {
        expect(atual[id]).toBeGreaterThanOrEqual(0);
        expect(atual[id]).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("entrada inválida", () => {
  it("lança para grupo desconhecido", () => {
    expect(() => rebalanceGroupWeights(equalGroupWeights(), "financeiro", 0.5))
      .toThrow(RangeError);
    expect(() => rebalanceGroupWeights(equalGroupWeights(), "financeiro", 0.5))
      .toThrow(/grupo desconhecido/);
  });

  it("lança para valor fora de [0, 1]", () => {
    expect(() => rebalanceGroupWeights(equalGroupWeights(), GEOMETRY, 1.5)).toThrow(RangeError);
    expect(() => rebalanceGroupWeights(equalGroupWeights(), GEOMETRY, -0.1)).toThrow(RangeError);
  });

  it("lança para valor não numérico", () => {
    expect(() => rebalanceGroupWeights(equalGroupWeights(), GEOMETRY, "0.5")).toThrow(RangeError);
    expect(() => rebalanceGroupWeights(equalGroupWeights(), GEOMETRY, NaN)).toThrow(RangeError);
  });
});
