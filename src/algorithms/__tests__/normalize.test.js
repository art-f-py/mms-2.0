import { describe, it, expect } from "vitest";
import { normalizeScores } from "../algorithms";
import { METHODS } from "../ubcWeights";

// ---------------------------------------------------------------------------
// normalizeScores — escala usada pelo radar em src/pages/Statistics.jsx.
// Leva o menor score a 0 e o maior a 100, arredondando para inteiro. Nao e
// percentual de acerto: e posicao relativa dentro do proprio cenario, entao
// o pior metodo sempre marca 0 mesmo quando o score bruto e positivo.
// ---------------------------------------------------------------------------

// Monta um objeto de scores completo (os 10 metodos) a partir de uma lista.
const scoresFrom = (values) =>
  Object.fromEntries(METHODS.map((m, i) => [m, values[i]]));

describe("normalizeScores — ancoras 0 e 100", () => {
  // 0, 10, 20, ... 90 — espalhamento linear, facil de conferir na mao.
  const input  = scoresFrom([0, 10, 20, 30, 40, 50, 60, 70, 80, 90]);
  const result = normalizeScores(input);

  it("leva o menor score a 0", () => {
    expect(result["OP"]).toBe(0);
  });

  it("leva o maior score a 100", () => {
    expect(result["SQS"]).toBe(100);
  });

  it("mantem a proporcao dos valores intermediarios", () => {
    // 10/90 -> 11.1 | 40/90 -> 44.4 | 80/90 -> 88.9
    expect(result["BC"]).toBe(11);
    expect(result["LW"]).toBe(44);
    expect(result["TS"]).toBe(89);
  });

  it("devolve inteiros (o radar nao recebe fracao)", () => {
    for (const m of METHODS) {
      expect(Number.isInteger(result[m])).toBe(true);
    }
  });

  it("devolve exatamente os 10 metodos", () => {
    expect(Object.keys(result).sort()).toEqual([...METHODS].sort());
  });
});

describe("normalizeScores — scores negativos", () => {
  // Cenario real: as tabelas aplicam penalidades de -49/-50, entao score
  // negativo e comum e o minimo costuma ser negativo.
  const input  = scoresFrom([-50, 0, 0, 0, 0, 0, 0, 0, 0, 50]);
  const result = normalizeScores(input);

  it("ancora o negativo mais baixo em 0", () => {
    expect(result["OP"]).toBe(0);
  });

  it("ancora o maior em 100", () => {
    expect(result["SQS"]).toBe(100);
  });

  it("posiciona o meio da faixa em 50", () => {
    expect(result["BC"]).toBe(50);
  });
});

describe("normalizeScores — todos os scores iguais", () => {
  // Divisao por zero evitada com `range || 1`. Consequencia: empate geral
  // achata tudo em 0, nao em 50 nem em 100. O radar sai vazio (todos no
  // centro) em vez de quebrar — comportamento pinado aqui de proposito.
  const result = normalizeScores(scoresFrom([7, 7, 7, 7, 7, 7, 7, 7, 7, 7]));

  it("nao gera NaN nem Infinity", () => {
    for (const m of METHODS) {
      expect(Number.isFinite(result[m])).toBe(true);
    }
  });

  it("achata todos em 0", () => {
    for (const m of METHODS) {
      expect(result[m]).toBe(0);
    }
  });
});

describe("normalizeScores — nao muta a entrada", () => {
  it("preserva o objeto de scores original", () => {
    const input = scoresFrom([0, 10, 20, 30, 40, 50, 60, 70, 80, 90]);
    const copy  = { ...input };
    normalizeScores(input);
    expect(input).toEqual(copy);
  });
});
