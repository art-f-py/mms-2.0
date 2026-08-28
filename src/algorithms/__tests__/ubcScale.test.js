import { describe, it, expect } from "vitest";
import { toUbcScale, UBC_SCORE_DOMAIN, UBC_ELIMINATION_VALUE } from "../ubcScale";
import { toSaaty } from "../saatyScale";
import {
  UBC_GEOMETRY,
  UBC_OREBODY,
  UBC_HANGINGWALL,
  UBC_FOOTWALL,
} from "../ubcWeights";

// ---------------------------------------------------------------------------
// CONVERSÃO DO UBC PARA A ESCALA DE SAATY
// ---------------------------------------------------------------------------
// A tabela do Francisco é dado, não fórmula: cada um dos nove valores é
// conferido individualmente contra o que está escrito, sem nenhuma aritmética
// no meio que pudesse "explicar" um erro de transcrição.
//
// Os dois testes que mais importam depois disso não são sobre valores certos:
// são o de NÃO-INJETIVIDADE (comportamento intencional que parece bug) e o de
// COBERTURA DO DOMÍNIO REAL, que varre ubcWeights.js de verdade em vez de
// confiar na lista que este próprio módulo declara.

// A tabela oficial, transcrita aqui de forma independente do módulo — é contra
// esta lista que a implementação é conferida, e não contra o mapa dela.
const TABELA_OFICIAL = [
  [-49, 0],
  [-10, 1],
  [0,   1],
  [1,   3],
  [2,   5],
  [3,   5],
  [4,   7],
  [5,   9],
  [6,   9],
];

describe("os nove valores do domínio confirmado", () => {
  it.each(TABELA_OFICIAL)("score %i vira %i", (entrada, esperado) => {
    expect(toUbcScale(entrada)).toBe(esperado);
  });

  it("UBC_SCORE_DOMAIN lista exatamente os nove, em ordem", () => {
    expect(UBC_SCORE_DOMAIN).toEqual([-49, -10, 0, 1, 2, 3, 4, 5, 6]);
  });

  it("a eliminação (−49) vai para o piso da escala", () => {
    expect(toUbcScale(-49)).toBe(UBC_ELIMINATION_VALUE);
    expect(UBC_ELIMINATION_VALUE).toBe(0);
  });

  it("só a eliminação sai abaixo de 1 — todo score comum sai em 1..9", () => {
    for (const [entrada, saida] of TABELA_OFICIAL) {
      if (entrada === -49) continue;
      expect(saida).toBeGreaterThanOrEqual(1);
      expect(saida).toBeLessThanOrEqual(9);
    }
  });
});

describe("NÃO-INJETIVIDADE — intencional, não defeito", () => {
  // Estes três pares existem na tabela oficial e são a razão de este bloco
  // existir: quem encontrar dois métodos de lavra empatados numa coluna do UBC
  // que na tabela original tinham scores diferentes está vendo isto funcionar
  // como especificado. Ver o cabeçalho de ubcScale.js.
  it("−10 e 0 caem no mesmo valor", () => {
    expect(toUbcScale(-10)).toBe(toUbcScale(0));
  });

  it("2 e 3 caem no mesmo valor", () => {
    expect(toUbcScale(2)).toBe(toUbcScale(3));
  });

  it("5 e 6 caem no mesmo valor", () => {
    expect(toUbcScale(5)).toBe(toUbcScale(6));
  });

  it("nove scores de entrada produzem só seis valores distintos", () => {
    const saidas = new Set(UBC_SCORE_DOMAIN.map(toUbcScale));
    expect(UBC_SCORE_DOMAIN).toHaveLength(9);
    expect([...saidas].sort((a, b) => a - b)).toEqual([0, 1, 3, 5, 7, 9]);
  });
});

describe("não é o toSaaty estendido", () => {
  // O motivo de o módulo existir separado. Se algum dia alguém "simplificar"
  // reaproveitando a fórmula linear, estes dois casos quebram.
  it("diverge da fórmula linear em 3 e em 4", () => {
    expect(toUbcScale(3)).toBe(5);
    expect(toSaaty(3)).toBe(7);
    expect(toUbcScale(4)).toBe(7);
    expect(toSaaty(4)).toBe(9);
  });

  it("coincide com a linear em −49, 0, 1 e 2", () => {
    for (const score of [-49, 0, 1, 2]) {
      expect(toUbcScale(score)).toBe(toSaaty(score));
    }
  });
});

describe("célula vazia", () => {
  it("null continua null", () => {
    expect(toUbcScale(null)).toBeNull();
  });

  it("undefined também", () => {
    expect(toUbcScale(undefined)).toBeNull();
  });
});

describe("fora do domínio confirmado", () => {
  it("recusa inteiro sem entrada na tabela, nomeando o valor", () => {
    expect(() => toUbcScale(7)).toThrow(RangeError);
    expect(() => toUbcScale(7)).toThrow(/score 7 fora do domínio confirmado/);
  });

  it("recusa os outros marcadores de eliminação do projeto", () => {
    // −50 é do SH&B e −25 é penalidade intermediária de outra tabela: nenhum
    // dos dois aparece no UBC, e converter por engano seria silencioso.
    expect(() => toUbcScale(-50)).toThrow(RangeError);
    expect(() => toUbcScale(-25)).toThrow(RangeError);
  });

  it("recusa fracionário, inclusive os do SH&B", () => {
    for (const score of [2.5, 4.2, 4.38, 5.25]) {
      expect(() => toUbcScale(score)).toThrow(RangeError);
    }
  });

  it("recusa não numérico", () => {
    expect(() => toUbcScale("3")).toThrow(RangeError);
    expect(() => toUbcScale(NaN)).toThrow(RangeError);
    expect(() => toUbcScale(Infinity)).toThrow(RangeError);
  });

  it("−0 é 0 e converte normalmente", () => {
    expect(toUbcScale(-0)).toBe(1);
  });
});

describe("COBERTURA — varre ubcWeights.js de verdade", () => {
  // Não confia na lista declarada pelo módulo: percorre as quatro tabelas e
  // exige que toda célula real converta. Se alguém acrescentar uma linha nova
  // com um score não previsto, é aqui que aparece.
  const todasAsCelulas = () => {
    const out = [];
    for (const tabela of [UBC_GEOMETRY, UBC_OREBODY, UBC_HANGINGWALL, UBC_FOOTWALL]) {
      for (const criterio of Object.values(tabela)) {
        for (const scores of Object.values(criterio.options)) {
          out.push(...scores);
        }
      }
    }
    return out;
  };

  it("toda célula das quatro tabelas do UBC converte sem lançar", () => {
    const celulas = todasAsCelulas();
    expect(celulas.length).toBe(440);
    for (const score of celulas) {
      expect(() => toUbcScale(score)).not.toThrow();
    }
  });

  it("o domínio real é exatamente o domínio declarado", () => {
    const reais = [...new Set(todasAsCelulas())].sort((a, b) => a - b);
    expect(reais).toEqual([...UBC_SCORE_DOMAIN]);
  });
});
