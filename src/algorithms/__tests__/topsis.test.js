import { describe, it, expect } from "vitest";
import { topsis, equalWeights, normalizeWeights, DEGENERATE_CLOSENESS } from "../topsis";
import { DIRECTION } from "../mcdmCriteria";

// ---------------------------------------------------------------------------
// MOTOR TOPSIS
// ---------------------------------------------------------------------------

const MAX = DIRECTION.MAX;
const MIN = DIRECTION.MIN;
const ordem = (r) => r.ranking.map((e) => e.id);

// Cenario com escalas nativas deliberadamente distantes: "quality" em 0-9 (a
// escala de Saaty dos criterios classicos) e "cost" em 10-100 (o indice de
// custos comparativos do Francisco). Uma ordem de grandeza de diferenca.
const ESCALAS_MISTAS = {
  alternatives: ["A", "B", "C"],
  criteria: [{ id: "quality", direction: MAX }, { id: "cost", direction: MIN }],
  matrix: [
    [9, 100], // melhor qualidade, pior custo
    [8,  20], // quase tao boa, custo baixo
    [1,  15], // pior qualidade, melhor custo
  ],
};

/**
 * TOPSIS deliberadamente SEM o passo de normalizacao vetorial.
 * Existe so para provar, por contraste, que o passo 1 e quem faz o trabalho —
 * sem ele o resultado passa a depender da unidade em que a coluna foi medida.
 */
function semNormalizacao({ alternatives, criteria, matrix }) {
  const w = equalWeights(criteria.length);
  const weighted = matrix.map((row) => row.map((v, j) => v * w[j]));
  const ideal = [], anti = [];
  criteria.forEach((c, j) => {
    const col = weighted.map((row) => row[j]);
    const max = Math.max(...col);
    const min = Math.min(...col);
    ideal[j] = c.direction === MAX ? max : min;
    anti[j]  = c.direction === MAX ? min : max;
  });
  const dist = (row, ref) => Math.sqrt(row.reduce((s, v, j) => s + (v - ref[j]) ** 2, 0));
  return alternatives
    .map((id, i) => {
      const dp = dist(weighted[i], ideal);
      const dm = dist(weighted[i], anti);
      return { id, closeness: dp + dm === 0 ? DEGENERATE_CLOSENESS : dm / (dp + dm) };
    })
    .sort((a, b) => b.closeness - a.closeness)
    .map((e) => e.id);
}

describe("topsis — normalizacao vetorial com escalas nativas diferentes", () => {
  // Este bloco e o motivo de o TOPSIS ter sido escolhido em vez de outro motor.
  // Nao basta "funcionar por acaso": esta validado explicitamente.

  it("cada coluna normalizada vira um vetor unitario, qualquer que seja a escala", () => {
    const { normalized } = topsis(ESCALAS_MISTAS);
    ESCALAS_MISTAS.criteria.forEach((_c, j) => {
      const somaQuadrados = normalized.reduce((s, row) => s + row[j] ** 2, 0);
      expect(somaQuadrados).toBeCloseTo(1, 12);
    });
  });

  it("as duas colunas chegam ponderadas a magnitudes comparaveis", () => {
    // Antes: coluna de custo ~10x a de qualidade. Depois: mesma ordem de grandeza.
    const { weighted } = topsis(ESCALAS_MISTAS);
    const maiorPorColuna = ESCALAS_MISTAS.criteria.map(
      (_c, j) => Math.max(...weighted.map((row) => Math.abs(row[j]))),
    );
    const razao = Math.max(...maiorPorColuna) / Math.min(...maiorPorColuna);
    expect(razao).toBeLessThan(2);
  });

  it("trocar a unidade de uma coluna nao muda ranking nem proximidade", () => {
    // Medir custo em centavos em vez de reais e multiplicar a coluna por 100.
    // Se o motor fosse sensivel a escala, isso reordenaria o resultado.
    const base = topsis(ESCALAS_MISTAS);
    const reescalado = topsis({
      ...ESCALAS_MISTAS,
      matrix: ESCALAS_MISTAS.matrix.map(([q, c]) => [q, c * 100]),
    });

    expect(ordem(reescalado)).toEqual(ordem(base));
    reescalado.closeness.forEach((v, i) => {
      expect(v).toBeCloseTo(base.closeness[i], 12);
    });
  });

  it("guarda contra teste vacuo: sem normalizacao o mesmo reescalonamento QUEBRA o ranking", () => {
    // Prova que a invariancia acima nao e trivial — e trabalho do passo 1.
    const reescalada = {
      ...ESCALAS_MISTAS,
      matrix: ESCALAS_MISTAS.matrix.map(([q, c]) => [q, c * 100]),
    };
    expect(semNormalizacao(reescalada)).not.toEqual(semNormalizacao(ESCALAS_MISTAS));
    // ... enquanto o TOPSIS de verdade e imune ao mesmo reescalonamento.
    expect(ordem(topsis(reescalada))).toEqual(ordem(topsis(ESCALAS_MISTAS)));
  });

  it("a coluna de escala maior nao domina o resultado", () => {
    // B nao e a melhor em nenhuma das duas colunas, mas e a melhor de conjunto.
    // Se o custo (10-100) dominasse, C — a mais barata — venceria.
    const { ranking } = topsis(ESCALAS_MISTAS);
    expect(ranking[0].id).toBe("B");
    expect(ranking.map((e) => e.id)).toEqual(["B", "C", "A"]);
  });
});

describe("topsis — calculo", () => {
  it("resultado conferido a mao: dominancia total da 1 e 0", () => {
    // A domina B nas duas colunas. Normas ambas = 5; ponderadas por 0.5,
    // A = [0.4, 0.4] (a propria ideal) e B = [0.3, 0.3] (a propria anti-ideal).
    const r = topsis({
      alternatives: ["A", "B"],
      criteria: [{ id: "c1", direction: MAX }, { id: "c2", direction: MAX }],
      matrix: [[4, 4], [3, 3]],
    });
    expect(r.closeness[0]).toBeCloseTo(1, 12);
    expect(r.closeness[1]).toBeCloseTo(0, 12);
    expect(ordem(r)).toEqual(["A", "B"]);
  });

  it("simetria perfeita da empate em 0.5", () => {
    const r = topsis({
      alternatives: ["A", "B"],
      criteria: [{ id: "c1", direction: MAX }, { id: "c2", direction: MAX }],
      matrix: [[3, 4], [4, 3]],
    });
    expect(r.closeness[0]).toBeCloseTo(0.5, 12);
    expect(r.closeness[1]).toBeCloseTo(0.5, 12);
  });

  it("proximidade fica sempre em [0, 1]", () => {
    const r = topsis(ESCALAS_MISTAS);
    r.closeness.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    });
  });

  it("atribui rank crescente em ordem decrescente de proximidade", () => {
    const { ranking } = topsis(ESCALAS_MISTAS);
    expect(ranking.map((e) => e.rank)).toEqual([1, 2, 3]);
    for (let i = 1; i < ranking.length; i++) {
      expect(ranking[i - 1].closeness).toBeGreaterThanOrEqual(ranking[i].closeness);
    }
  });
});

describe("topsis — direcao dos criterios", () => {
  it("minimizar e maximizar produzem ideais opostos na mesma coluna", () => {
    const entrada = {
      alternatives: ["barato", "caro"],
      criteria: [{ id: "cost", direction: MIN }],
      matrix: [[10], [90]],
    };
    expect(ordem(topsis(entrada))).toEqual(["barato", "caro"]);

    const invertido = { ...entrada, criteria: [{ id: "cost", direction: MAX }] };
    expect(ordem(topsis(invertido))).toEqual(["caro", "barato"]);
  });

  it("direcao ausente ou invalida lanca — nao assume um default", () => {
    // Assumir MAX em silencio inverteria o ranking de um criterio de custo sem
    // nenhum sintoma. Melhor falhar.
    const entrada = {
      alternatives: ["A", "B"],
      criteria: [{ id: "cost" }],
      matrix: [[1], [2]],
    };
    expect(() => topsis(entrada)).toThrow(/sem direção válida/);
    expect(() => topsis({ ...entrada, criteria: [{ id: "c", direction: "menor" }] }))
      .toThrow(/sem direção válida/);
  });
});

describe("topsis — pesos", () => {
  it("sem pesos declarados usa pesos iguais", () => {
    const r = topsis(ESCALAS_MISTAS);
    expect(r.weights).toEqual([0.5, 0.5]);
  });

  it("peso zero anula a influencia do criterio", () => {
    const soQualidade = topsis({ ...ESCALAS_MISTAS, weights: [1, 0] });
    // So a qualidade conta: A (9) > B (8) > C (1).
    expect(ordem(soQualidade)).toEqual(["A", "B", "C"]);
  });

  it("normaliza pesos para somar 1 sem alterar o ranking", () => {
    const a = topsis({ ...ESCALAS_MISTAS, weights: [1, 1] });
    const b = topsis({ ...ESCALAS_MISTAS, weights: [50, 50] });
    expect(a.weights).toEqual([0.5, 0.5]);
    expect(ordem(b)).toEqual(ordem(a));
    b.closeness.forEach((v, i) => expect(v).toBeCloseTo(a.closeness[i], 12));
  });

  it("normalizeWeights e equalWeights somam 1", () => {
    expect(equalWeights(4).reduce((s, v) => s + v, 0)).toBeCloseTo(1, 12);
    expect(normalizeWeights([2, 3, 5])).toEqual([0.2, 0.3, 0.5]);
    expect(() => normalizeWeights([0, 0])).toThrow(/soma dos pesos/);
  });
});

describe("topsis — casos degenerados", () => {
  it("alternativas identicas empatam em DEGENERATE_CLOSENESS", () => {
    const r = topsis({
      alternatives: ["A", "B", "C"],
      criteria: [{ id: "c1", direction: MAX }, { id: "c2", direction: MIN }],
      matrix: [[5, 5], [5, 5], [5, 5]],
    });
    r.closeness.forEach((v) => expect(v).toBe(DEGENERATE_CLOSENESS));
    expect(ordem(r)).toEqual(["A", "B", "C"]);
  });

  it("coluna inteiramente zerada nao gera divisao por zero", () => {
    const r = topsis({
      alternatives: ["A", "B"],
      criteria: [{ id: "vazio", direction: MAX }, { id: "c2", direction: MAX }],
      matrix: [[0, 4], [0, 2]],
    });
    r.normalized.forEach((row) => expect(row[0]).toBe(0));
    r.closeness.forEach((v) => expect(Number.isFinite(v)).toBe(true));
    expect(ordem(r)).toEqual(["A", "B"]);
  });

  it("empate na proximidade preserva a ordem original de entrada", () => {
    const r = topsis({
      alternatives: ["primeiro", "segundo"],
      criteria: [{ id: "c1", direction: MAX }],
      matrix: [[7], [7]],
    });
    expect(ordem(r)).toEqual(["primeiro", "segundo"]);
  });

  it("uma unica alternativa e valida", () => {
    const r = topsis({
      alternatives: ["so"],
      criteria: [{ id: "c1", direction: MAX }],
      matrix: [[3]],
    });
    expect(r.ranking).toHaveLength(1);
    expect(r.ranking[0].rank).toBe(1);
  });
});

describe("topsis — contrato de entrada", () => {
  const valido = {
    alternatives: ["A", "B"],
    criteria: [{ id: "c1", direction: MAX }],
    matrix: [[1], [2]],
  };

  it("recusa matriz com numero de linhas diferente das alternativas", () => {
    expect(() => topsis({ ...valido, matrix: [[1]] })).toThrow(/linhas para 2 alternativas/);
  });

  it("recusa linha com numero de colunas diferente dos criterios", () => {
    expect(() => topsis({ ...valido, matrix: [[1, 9], [2, 9]] })).toThrow(/colunas para 1 critérios/);
  });

  it("recusa celula vazia em vez de trata-la como zero", () => {
    // Zero num criterio de minimizar seria o valor OTIMO — um buraco na matriz
    // viraria a melhor alternativa possivel.
    expect(() => topsis({ ...valido, matrix: [[null], [2]] })).toThrow(/célula não numérica/);
    expect(() => topsis({ ...valido, matrix: [[NaN], [2]] })).toThrow(/célula não numérica/);
  });

  it("recusa numero de pesos diferente do de criterios", () => {
    expect(() => topsis({ ...valido, weights: [1, 1] })).toThrow(/2 pesos para 1 critérios/);
  });

  it("recusa entrada vazia", () => {
    expect(() => topsis({ alternatives: [], criteria: [{ id: "c", direction: MAX }], matrix: [] }))
      .toThrow(/ao menos uma alternativa/);
    expect(() => topsis({ alternatives: ["A"], criteria: [], matrix: [[]] }))
      .toThrow(/ao menos um critério/);
  });
});

describe("topsis — pureza", () => {
  it("nao altera a matriz, os criterios nem os pesos recebidos", () => {
    const matrix   = [[9, 100], [8, 20], [1, 15]];
    const criteria = [{ id: "quality", direction: MAX }, { id: "cost", direction: MIN }];
    const weights  = [3, 1];
    const copias   = JSON.parse(JSON.stringify({ matrix, criteria, weights }));

    topsis({ alternatives: ["A", "B", "C"], criteria, matrix, weights });

    expect({ matrix, criteria, weights }).toEqual(copias);
  });

  it("nao conhece metodo de lavra nenhum — funciona com alternativas arbitrarias", () => {
    // Fixa o desacoplamento: o motor e agnostico de onde a matriz veio.
    const r = topsis({
      alternatives: ["fornecedor X", "fornecedor Y"],
      criteria: [{ id: "prazo", direction: MIN }, { id: "nota", direction: MAX }],
      matrix: [[30, 8], [45, 9]],
    });
    expect(r.ranking).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// PARIDADE COM O MOTOR DE REFERENCIA DO FRANCISCO
// ---------------------------------------------------------------------------
// Caso de referencia portado do R original, validado 38/38 contra o R real com
// tolerancia 1e-6. Os numeros esperados NAO sao recalculados aqui: sao o
// resultado do outro motor, transcrito. Se este teste cair, um dos dois motores
// mudou de formula — nao se ajusta o numero, investiga-se a divergencia.
//
// A matriz entra exatamente como esta na referencia, sem readaptacao: so o
// invólucro da chamada ({alternatives, criteria, matrix, weights}) foi montado
// em volta dela.
const REFERENCIA_FRANCISCO = {
  alternatives: ["L1", "L2", "L3", "L4"],
  criteria: [
    { id: "c1", direction: MAX },
    { id: "c2", direction: MAX },
    { id: "c3", direction: MIN },
  ],
  matrix: [
    [250, 16, 12],
    [200, 16,  8],
    [300, 32, 16],
    [275, 32,  8],
  ],
  weights: [0.35, 0.40, 0.25],
};

const PROXIMIDADE_ESPERADA = [
  0.2853905732,
  0.3776792974,
  0.6223207026,
  0.9053825018,
];

describe("topsis — paridade com o motor de referencia (R portado)", () => {
  it("reproduz a proximidade de cada alternativa dentro de 1e-6", () => {
    const { closeness } = topsis(REFERENCIA_FRANCISCO);

    expect(closeness).toHaveLength(PROXIMIDADE_ESPERADA.length);
    PROXIMIDADE_ESPERADA.forEach((esperado, i) => {
      expect(Math.abs(closeness[i] - esperado)).toBeLessThan(1e-6);
    });
  });

  it("nenhuma alternativa cai no caso degenerado", () => {
    // A divergencia conhecida entre os dois motores esta so no 0/0 (referencia:
    // 0 fixo; aqui: DEGENERATE_CLOSENESS). Esta matriz nao empata alternativas,
    // entao a paridade acima e sobre a formula, nao sobre a convencao.
    const { distanceToIdeal, distanceToAntiIdeal } = topsis(REFERENCIA_FRANCISCO).ranking
      .reduce((acc, e) => {
        acc.distanceToIdeal.push(e.distanceToIdeal);
        acc.distanceToAntiIdeal.push(e.distanceToAntiIdeal);
        return acc;
      }, { distanceToIdeal: [], distanceToAntiIdeal: [] });

    distanceToIdeal.forEach((dp, i) => {
      expect(dp + distanceToAntiIdeal[i]).toBeGreaterThan(0);
    });
  });
});
