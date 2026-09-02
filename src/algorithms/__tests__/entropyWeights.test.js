import { describe, it, expect } from "vitest";
import { calculateEntropyWeights } from "../entropyWeights";

// ---------------------------------------------------------------------------
// PONDERAÇÃO POR ENTROPIA DE SHANNON
// ---------------------------------------------------------------------------
// O que precisa ficar provado, em ordem de importância:
//
//   1. A FÓRMULA. Contra um exemplo pequeno calculado à mão, célula por célula,
//      e não contra a própria fórmula rodada de novo — um teste que reimplementa
//      o cálculo passa igualmente bem com os dois errados do mesmo jeito.
//   2. INVARIÂNCIA DE ESCALA. Multiplicar uma coluna por uma constante não muda
//      peso nenhum. É a propriedade que sustenta usar isto sobre uma matriz com
//      colunas de escalas nativas muito diferentes (Saaty 1–9 ao lado de índice
//      de custo 10–100), a mesma que já validou o TOPSIS para esta matriz.
//   3. AS GUARDAS. Coluna zerada e caso degenerado, ambos barulhentos ou
//      explícitos — nunca NaN se espalhando em silêncio.

// Aba mínima no formato que o pipeline produz: só `rows[].values` importa aqui.
const aba = (...linhas) => ({ rows: linhas.map((values) => ({ values })) });

// ---------------------------------------------------------------------------
// EXEMPLO CALCULADO À MÃO
// ---------------------------------------------------------------------------
// Duas alternativas, três critérios:
//
//   A = [1, 3]   B = [1, 1]   C = [1, 7]
//
// Passo a passo, com m = 2 e ln(2) = 0.693147180559945:
//
//   A: soma 4, p = [0.25, 0.75]
//      Σ p·ln p = 0.25·ln(0.25) + 0.75·ln(0.75) = -0.562335144669...
//      e = 0.562335.../0.693147... = 0.811278124459133   →  d = 0.188721875540867
//
//   B: soma 2, p = [0.5, 0.5]
//      Σ p·ln p = ln(0.5) = -0.693147180559945
//      e = 1 exatamente (coluna uniforme)                →  d = 0
//
//   C: soma 8, p = [0.125, 0.875]
//      Σ p·ln p = 0.125·ln(0.125) + 0.875·ln(0.875) = -0.376770...
//      e = 0.543564443199596                             →  d = 0.456435556800404
//
//   Σd = 0.645157432341271
//   w_A = 0.188721875540867 / 0.645157432341271 = 0.292520656324143
//   w_B = 0
//   w_C = 0.456435556800404 / 0.645157432341271 = 0.707479343675857
const EXEMPLO = aba([1, 1, 1], [3, 1, 7]);
const EXEMPLO_IDS = ["A", "B", "C"];
const EXEMPLO_ESPERADO = [0.292520656324143, 0, 0.707479343675857];

describe("a fórmula, contra um exemplo calculado à mão", () => {
  it("bate célula por célula", () => {
    const w = calculateEntropyWeights(EXEMPLO, EXEMPLO_IDS);
    expect(w[0]).toBeCloseTo(EXEMPLO_ESPERADO[0], 12);
    expect(w[1]).toBeCloseTo(EXEMPLO_ESPERADO[1], 12);
    expect(w[2]).toBeCloseTo(EXEMPLO_ESPERADO[2], 12);
  });

  it("a coluna perfeitamente uniforme recebe peso exatamente zero", () => {
    // e_j = 1 quando todos os p são iguais, e d_j = 0. Uma coluna em que os dez
    // métodos empatam não distingue ninguém: é a afirmação central do método,
    // e o único ponto do cálculo que dá um número redondo verificável a olho.
    const w = calculateEntropyWeights(EXEMPLO, EXEMPLO_IDS);
    expect(w[1]).toBe(0);
  });

  it("a coluna que mais espalha recebe o maior peso", () => {
    const w = calculateEntropyWeights(EXEMPLO, EXEMPLO_IDS);
    expect(w[2]).toBeGreaterThan(w[0]);
    expect(w[0]).toBeGreaterThan(w[1]);
  });
});

describe("normalização e soma", () => {
  it("os pesos somam exatamente 1", () => {
    const w = calculateEntropyWeights(EXEMPLO, EXEMPLO_IDS);
    expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });

  it("soma 1 também numa matriz do tamanho real — 10 alternativas, 19 critérios", () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      Array.from({ length: 19 }, (_, j) => 1 + ((i * 7 + j * 3) % 9)),
    );
    const ids = Array.from({ length: 19 }, (_, j) => `c${j}`);
    const w = calculateEntropyWeights(aba(...rows), ids);
    expect(w).toHaveLength(19);
    expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });

  it("devolve um peso por critério, nenhum negativo", () => {
    const w = calculateEntropyWeights(EXEMPLO, EXEMPLO_IDS);
    expect(w).toHaveLength(EXEMPLO_IDS.length);
    for (const peso of w) expect(peso).toBeGreaterThanOrEqual(0);
  });
});

describe("invariância de escala", () => {
  // A propriedade: p_ij = x_ij / Σx_ij não muda se a coluna inteira for
  // multiplicada por k, porque k sai do numerador e do denominador. Logo e_j,
  // d_j e — como Σd também não muda — o peso final ficam iguais.

  const escalar = (sheet, coluna, k) => ({
    rows: sheet.rows.map((row) => ({
      values: row.values.map((v, j) => (j === coluna ? v * k : v)),
    })),
  });

  it("multiplicar uma coluna por uma constante não muda peso nenhum", () => {
    const base = calculateEntropyWeights(EXEMPLO, EXEMPLO_IDS);
    for (const k of [2, 10, 0.5, 1000]) {
      const w = calculateEntropyWeights(escalar(EXEMPLO, 0, k), EXEMPLO_IDS);
      expect(w[0]).toBeCloseTo(base[0], 12);
      expect(w[1]).toBeCloseTo(base[1], 12);
      expect(w[2]).toBeCloseTo(base[2], 12);
    }
  });

  it("vale para qualquer uma das colunas", () => {
    const base = calculateEntropyWeights(EXEMPLO, EXEMPLO_IDS);
    for (let j = 0; j < EXEMPLO_IDS.length; j++) {
      const w = calculateEntropyWeights(escalar(EXEMPLO, j, 7), EXEMPLO_IDS);
      w.forEach((peso, i) => expect(peso).toBeCloseTo(base[i], 12));
    }
  });

  it("escalar TODAS as colunas por fatores diferentes também não muda nada", () => {
    // O caso que importa na prática: é exatamente a situação da matriz real,
    // com Saaty 1–9 ao lado de um índice de custo 10–100.
    const fatores = [3, 100, 0.01];
    const reescalada = {
      rows: EXEMPLO.rows.map((row) => ({ values: row.values.map((v, j) => v * fatores[j]) })),
    };
    const base = calculateEntropyWeights(EXEMPLO, EXEMPLO_IDS);
    const w    = calculateEntropyWeights(reescalada, EXEMPLO_IDS);
    w.forEach((peso, i) => expect(peso).toBeCloseTo(base[i], 12));
  });
});

describe("guarda — coluna zerada", () => {
  it("lança nomeando o critério", () => {
    const zerada = aba([1, 0, 3], [2, 0, 4]);
    expect(() => calculateEntropyWeights(zerada, ["custo", "recuperacao", "diluicao"]))
      .toThrow(/recuperacao/);
  });

  it("a mensagem diz que o problema é a normalização, não um erro genérico", () => {
    const zerada = aba([0], [0]);
    expect(() => calculateEntropyWeights(zerada, ["so_zeros"]))
      .toThrow(/soma zero|0\/0/);
  });

  it("não devolve NaN em vez de lançar", () => {
    // O ponto da guarda: sem ela seriam NaN espalhados pela matriz ponderada, e
    // o sintoma apareceria longe da causa.
    const zerada = aba([1, 0], [2, 0]);
    let saida;
    try { saida = calculateEntropyWeights(zerada, ["a", "b"]); } catch { saida = "lançou"; }
    expect(saida).toBe("lançou");
  });

  it("valor negativo também é barrado, nomeando o critério", () => {
    // ln de p negativo é NaN. Mesma escolha: barulhento em vez de silencioso.
    const negativa = aba([1, -5], [2, 3]);
    expect(() => calculateEntropyWeights(negativa, ["ok", "negativa"]))
      .toThrow(/negativa/);
  });

  it("valor não numérico é barrado", () => {
    expect(() => calculateEntropyWeights(aba([1, null], [2, 3]), ["a", "b"]))
      .toThrow(/não numérico/);
  });
});

describe("guarda — caso degenerado", () => {
  it("toda coluna uniforme devolve pesos uniformes", () => {
    // Σd = 0: nenhuma coluna discrimina nada. Mesma classe de decisão do
    // DEGENERATE_CLOSENESS em topsis.js — convenção interna sobre uma
    // indeterminação matemática, não número de calibragem. Com todas as colunas
    // igualmente (não) informativas, qualquer vetor de pesos produz a mesma
    // ordenação; o uniforme é o único que não finge preferir um critério.
    const uniforme = aba([5, 2, 9], [5, 2, 9], [5, 2, 9]);
    const w = calculateEntropyWeights(uniforme, ["a", "b", "c"]);
    expect(w).toEqual([1 / 3, 1 / 3, 1 / 3]);
  });

  it("com 19 critérios, o degenerado dá 1/19 em cada", () => {
    const linha = Array.from({ length: 19 }, (_, j) => j + 1);
    const w = calculateEntropyWeights(
      aba(linha, [...linha], [...linha]),
      Array.from({ length: 19 }, (_, j) => `c${j}`),
    );
    for (const peso of w) expect(peso).toBeCloseTo(1 / 19, 15);
    expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });

  it("não lança no degenerado — é caso previsto, não erro", () => {
    const uniforme = aba([1, 1], [1, 1]);
    expect(() => calculateEntropyWeights(uniforme, ["a", "b"])).not.toThrow();
  });

  it("UMA coluna uniforme entre outras não dispara o degenerado", () => {
    // A distinção que o limiar precisa preservar: peso zero para aquela coluna,
    // e os outros pesos calculados normalmente.
    const w = calculateEntropyWeights(EXEMPLO, EXEMPLO_IDS);
    expect(w[1]).toBe(0);
    expect(w[0]).not.toBeCloseTo(1 / 3, 6);
  });
});

describe("guarda — aba malformada", () => {
  it("aba sem linhas lança", () => {
    expect(() => calculateEntropyWeights(aba(), ["a"])).toThrow(/sem alternativas/);
  });

  it("uma alternativa só lança, em vez de dividir por ln(1) = 0", () => {
    expect(() => calculateEntropyWeights(aba([1, 2]), ["a", "b"])).toThrow(/ln 1|única alternativa/);
  });

  it("largura inconsistente com os ids lança, em vez de pesar o critério errado", () => {
    expect(() => calculateEntropyWeights(aba([1, 2, 3], [4, 5, 6]), ["a", "b"]))
      .toThrow(/3 colunas e foram passados 2/);
  });
});

describe("direção não entra no cálculo", () => {
  it("a função não recebe direção nenhuma — a assinatura é (sheet, criterionIds)", () => {
    // Entropia mede DISPERSÃO, não o que é bom. Inverter a direção de um
    // critério não muda a dispersão dos valores dele, então não pode mudar o
    // peso. Quem sabe o que é melhor é o TOPSIS, no passo seguinte.
    expect(calculateEntropyWeights.length).toBe(2);
  });

  it("um argumento de direção a mais é simplesmente ignorado", () => {
    const comDirecao = calculateEntropyWeights(EXEMPLO, EXEMPLO_IDS, ["min", "max", "min"]);
    const sem        = calculateEntropyWeights(EXEMPLO, EXEMPLO_IDS);
    expect(comDirecao).toEqual(sem);
  });
});

// ---------------------------------------------------------------------------
// PARIDADE COM O MOTOR DE REFERENCIA DO FRANCISCO
// ---------------------------------------------------------------------------
// Mesma matriz do caso de referencia do TOPSIS, portada do R original. Os pesos
// esperados sao o resultado do outro motor, transcrito — nao recalculados aqui.
const REFERENCIA_FRANCISCO = aba(
  [250, 16, 12],
  [200, 16,  8],
  [300, 32, 16],
  [275, 32,  8],
);
const REFERENCIA_IDS = ["c1", "c2", "c3"];
const PESOS_ESPERADOS = [0.0959568799438, 0.5078519485792, 0.3961911714770];

describe("paridade com o motor de referência (R portado)", () => {
  it("reproduz os três pesos dentro de 1e-6", () => {
    const w = calculateEntropyWeights(REFERENCIA_FRANCISCO, REFERENCIA_IDS);

    expect(w).toHaveLength(PESOS_ESPERADOS.length);
    PESOS_ESPERADOS.forEach((esperado, j) => {
      expect(Math.abs(w[j] - esperado)).toBeLessThan(1e-6);
    });
  });
});
