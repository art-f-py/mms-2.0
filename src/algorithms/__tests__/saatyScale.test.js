import { describe, it, expect } from "vitest";
import {
  toSaaty,
  isEliminationScore,
  ELIMINATION_SCORES,
  SAATY_ELIMINATION_VALUE,
  SAATY_MIN,
  SAATY_MAX,
} from "../saatyScale";

// ---------------------------------------------------------------------------
// ESCALA DE SAATY
// ---------------------------------------------------------------------------
// Dois ramos independentes: a formula linear (0-4) e o mapeamento direto das
// penalidades de eliminacao. Os dois estao cobertos separadamente, porque o
// erro classico aqui e deixar -49 cair na formula linear e virar -97.

describe("toSaaty — ramo linear (2x + 1)", () => {
  it("converte os cinco valores do dominio classico", () => {
    expect(toSaaty(0)).toBe(1);
    expect(toSaaty(1)).toBe(3);
    expect(toSaaty(2)).toBe(5);
    expect(toSaaty(3)).toBe(7);
    expect(toSaaty(4)).toBe(9);
  });

  it("leva 0-4 exatamente para 1-9, a escala de Saaty", () => {
    const saidas = [0, 1, 2, 3, 4].map(toSaaty);
    expect(Math.min(...saidas)).toBe(SAATY_MIN);
    expect(Math.max(...saidas)).toBe(SAATY_MAX);
  });

  it("e estritamente crescente — preserva a ordem dos scores", () => {
    const saidas = [0, 1, 2, 3, 4].map(toSaaty);
    for (let i = 1; i < saidas.length; i++) {
      expect(saidas[i]).toBeGreaterThan(saidas[i - 1]);
    }
  });
});

describe("toSaaty — ramo das penalidades de eliminacao", () => {
  it("-49 (UBC/Nicholas) mapeia direto para 0", () => {
    expect(toSaaty(-49)).toBe(0);
  });

  it("-50 (SH&B) mapeia direto para 0", () => {
    expect(toSaaty(-50)).toBe(0);
  });

  it("as penalidades NAO passam pela formula linear", () => {
    // Se passassem, -49 viraria -97 e -50 viraria -99. Este teste e o motivo
    // de o ramo existir.
    expect(toSaaty(-49)).not.toBe(2 * -49 + 1);
    expect(toSaaty(-50)).not.toBe(2 * -50 + 1);
    expect(toSaaty(-49)).toBe(SAATY_ELIMINATION_VALUE);
  });

  it("o valor de eliminacao fica ABAIXO do pior score comum", () => {
    // A distincao entre "pior metodo viavel" (0 -> 1) e "metodo eliminado"
    // (-49 -> 0) precisa sobreviver a conversao.
    expect(toSaaty(-49)).toBeLessThan(toSaaty(0));
  });

  it("a saida inteira e nao-negativa — era esse o objetivo da escala", () => {
    [-50, -49, 0, 1, 2, 3, 4].forEach((v) => {
      expect(toSaaty(v)).toBeGreaterThanOrEqual(0);
    });
  });

  it("isEliminationScore reconhece so -49 e -50", () => {
    expect(ELIMINATION_SCORES).toEqual([-49, -50]);
    expect(isEliminationScore(-49)).toBe(true);
    expect(isEliminationScore(-50)).toBe(true);
    expect(isEliminationScore(-10)).toBe(false);
    expect(isEliminationScore(0)).toBe(false);
  });
});

describe("toSaaty — celula vazia", () => {
  it("null e undefined continuam vazios, nao viram zero", () => {
    // Zero e um score valido na escala convertida (o das eliminacoes). Deixar
    // uma celula vazia virar zero a transformaria num metodo eliminado.
    expect(toSaaty(null)).toBeNull();
    expect(toSaaty(undefined)).toBeNull();
  });
});

describe("toSaaty — fora do dominio especificado", () => {
  // As tabelas do projeto contem hoje valores que a especificacao nao cobre.
  // Enquanto a regra nao vier do Francisco, converter e proibido: um numero
  // plausivel e errado seria pior que um erro.
  it.each([
    ["-10 (penalidade intermediaria do UBC e do SH&B)", -10],
    ["-25 (penalidade intermediaria do SH&B)", -25],
    ["-7 (penalidade intermediaria do SH&B)", -7],
    ["5 (UBC orebody/hangingwall)", 5],
    ["6 (UBC orebody/hangingwall)", 6],
  ])("lanca em %s", (_rotulo, valor) => {
    expect(() => toSaaty(valor)).toThrow(RangeError);
    expect(() => toSaaty(valor)).toThrow(/fora do domínio especificado/);
  });

  it("lanca em entrada nao numerica", () => {
    expect(() => toSaaty("3")).toThrow(RangeError);
    expect(() => toSaaty(NaN)).toThrow(RangeError);
  });
});
