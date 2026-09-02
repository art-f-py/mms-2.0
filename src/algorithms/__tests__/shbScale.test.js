import { describe, it, expect } from "vitest";
import {
  toShbScale,
  assertSqsOreValueCellUnchanged,
  SHB_SCALE_ARTIFACT,
  SQS_ORE_VALUE_CRITERION,
  SQS_ORE_VALUE_METHOD,
  SQS_ORE_VALUE_RAW,
  SQS_ORE_VALUE_OVERRIDE,
} from "../shbScale";
import {
  SHB_GEOMETRY, SHB_ECONOMIC, SHB_OREBODY, SHB_HANGINGWALL, SHB_FOOTWALL,
} from "../shbWeights";

// ---------------------------------------------------------------------------
// CONVERSÃO DO SH&B — BASE EMBUTIDA, MARCADORES E DUAS EXCEÇÕES
// ---------------------------------------------------------------------------
// A diferença para saatyScale/ubcScale: a tabela do SH&B guarda a base JÁ
// MULTIPLICADA por um fator por critério, então converter exige saber de que
// coluna o valor veio. Os testes abaixo cobrem os três caminhos (marcador,
// fórmula geral, exceção) e as duas guardas.

const METHODS = ["OP","BC","SLS","SLC","LW","R&P","SKS","C&F","TS","SQS"];

// Os 10 pares da tabela confirmada pelo Francisco, base → valoração.
const TABELA = [
  [-50, 0], [-25, 1], [-10, 1], [0, 1], [1, 3],
  [2, 5], [3, 5], [4, 7], [5, 9], [6, 9],
];

describe("a tabela de conversão, par a par", () => {
  // `shape` tem fator 1, então bruto == base: é a coluna que exercita a tabela
  // sem a divisão no caminho.
  it.each(TABELA)("base %i vira %i", (base, esperado) => {
    expect(toShbScale(base, "shape", "OP")).toBe(esperado);
  });

  it("a tabela não é injetiva, e isso é a especificação", () => {
    // Quatro bases distintas caem em 1, e dois pares se fundem mais adiante.
    // A consequência é real: dois métodos que diferiam na tabela do SH&B podem
    // empatar naquele critério depois da conversão.
    expect([-25, -10, 0].map((b) => toShbScale(b, "shape"))).toEqual([1, 1, 1]);
    expect(toShbScale(2, "shape")).toBe(toShbScale(3, "shape"));
    expect(toShbScale(5, "shape")).toBe(toShbScale(6, "shape"));
  });
});

describe("o fator embutido é desfeito antes da conversão", () => {
  it("cada critério usa o SEU fator", () => {
    // Mesmo bruto, colunas diferentes, bases diferentes — é o ponto todo do
    // criterionId na assinatura.
    expect(toShbScale(3.5, "rss_ob")).toBe(7);   // 3.5 / 0.875 = 4 -> 7
    expect(toShbScale(3.5, "rss_hw")).toBe(9);   // 3.5 / 0.7   = 5 -> 9
  });

  it("os fracionários que bloqueavam o SH&B convertem sem reclamar", () => {
    // Os três valores nomeados na antiga pendência do pipeline.
    expect(toShbScale(4.2,  "rss_hw")).toBe(9);  // 6 -> 9
    expect(toShbScale(4.38, "rss_ob")).toBe(9);  // 5 -> 9
    expect(toShbScale(5.25, "rss_ob")).toBe(9);  // 6 -> 9
  });

  it("absorve o arredondamento de duas casas da tabela", () => {
    // 3 × 0,875 = 2,625, gravado como 2.63. A base sai 3,00571 e tem de virar 3.
    expect(toShbScale(2.63, "rss_ob")).toBe(5);  // base 3 -> 5
    expect(toShbScale(0.88, "rss_ob")).toBe(3);  // base 1 -> 3
    expect(toShbScale(0.88, "rss_fw")).toBe(5);  // base 2 -> 5 (fator 0,44)
  });

  it("o fator 1 dos critérios geométricos deixa o bruto passar como base", () => {
    for (const id of ["shape", "thickness", "dip"]) {
      expect(toShbScale(4, id)).toBe(7);
    }
  });
});

describe("marcadores de eliminação", () => {
  it.each([[-50, 0], [-25, 1], [-10, 1]])("%i vira %i sem passar pelo fator", (marcador, esperado) => {
    // Se o marcador fosse dividido, −50 / 0,44 daria −113 e cairia no erro.
    for (const id of ["shape", "rss_fw", "oreValue", "depth"]) {
      expect(toShbScale(marcador, id)).toBe(esperado);
    }
  });
});

describe("exceção 1 — o artefato de escala −7", () => {
  it("−7 é tratado como o marcador −10, e dá 1", () => {
    expect(toShbScale(SHB_SCALE_ARTIFACT, "rss_hw", "R&P")).toBe(1);
    expect(toShbScale(-7, "rss_hw", "R&P")).toBe(toShbScale(-10, "rss_hw", "R&P"));
  });

  it("não passa pela divisão — o fator do teto não é aplicado de novo", () => {
    // −7 / 0,7 daria −10 por coincidência, mas o caminho é outro: o valor é
    // reconhecido como marcador antes de qualquer divisão. Confere-se pedindo a
    // conversão em outra coluna, onde a divisão daria um número diferente.
    expect(toShbScale(-7, "rss_fw")).toBe(1);
    expect(toShbScale(-7, "shape")).toBe(1);
  });

  it("existe exatamente uma célula com −7 em todo o dataset", () => {
    // O que autoriza tratá-lo como caso pontual, e não como valor da escala.
    const tabelas = { SHB_GEOMETRY, SHB_ECONOMIC, SHB_OREBODY, SHB_HANGINGWALL, SHB_FOOTWALL };
    const achados = [];
    for (const [nome, tabela] of Object.entries(tabelas)) {
      for (const [crit, { options }] of Object.entries(tabela)) {
        for (const [cat, valores] of Object.entries(options)) {
          valores.forEach((v, i) => { if (v === -7) achados.push(`${nome}.${crit}/${cat}/${METHODS[i]}`); });
        }
      }
    }
    expect(achados).toEqual(["SHB_HANGINGWALL.rss/Muito fraca/R&P"]);
  });
});

describe("exceção 2 — o override de oreValue/SQS", () => {
  it("o bruto 4 em oreValue/SQS vira 9, e não os 7 da fórmula", () => {
    // A base seria 4 / 0,4 = 10, fora do domínio. O 9 é decisão do Francisco.
    expect(toShbScale(SQS_ORE_VALUE_RAW, SQS_ORE_VALUE_CRITERION, SQS_ORE_VALUE_METHOD))
      .toBe(SQS_ORE_VALUE_OVERRIDE);
    expect(toShbScale(4, "oreValue", "SQS")).not.toBe(7);
  });

  it("O OVERRIDE NÃO PEGA AS OUTRAS CATEGORIAS da mesma coluna", () => {
    // A armadilha desta exceção: a coluna oreValue/SQS NÃO é sempre 4. Vale 0
    // em "Baixo" e 0,4 em "Médio", conforme o formulário, e esses dois são
    // scores normais. Um override preso só ao par (oreValue, SQS) devolveria 9
    // para os três e corromperia duas células legítimas.
    const porCategoria = SHB_ECONOMIC.oreValue.options;
    expect(porCategoria["Baixo"][9]).toBe(0);
    expect(porCategoria["Médio"][9]).toBe(0.4);

    expect(toShbScale(0,   "oreValue", "SQS")).toBe(1);  // base 0 -> 1
    expect(toShbScale(0.4, "oreValue", "SQS")).toBe(3);  // base 1 -> 3
  });

  it("não pega oreValue em OUTROS métodos", () => {
    // 1.60 é o bruto de "Alto" no OP: base 4, fórmula normal.
    expect(toShbScale(1.6, "oreValue", "OP")).toBe(7);
    // E o mesmo bruto 4 noutro método não existe no dado, mas se existisse
    // seria erro de domínio, não override.
    expect(() => toShbScale(4, "oreValue", "OP")).toThrow(RangeError);
  });

  it("não pega outro critério no SQS", () => {
    expect(toShbScale(4, "shape", "SQS")).toBe(7);
  });

  it("a guarda defensiva dispara se o bruto da célula mudar", () => {
    // O ponto do parâmetro injetável: simula uma revisão da tabela sem tocar no
    // dado real. O override é uma correção de UMA célula — sobre um dado
    // diferente, ele precisa ser reconfirmado, não reaplicado.
    expect(() => assertSqsOreValueCellUnchanged(5)).toThrow(/precisa ser reconfirmado/);
    expect(() => assertSqsOreValueCellUnchanged(5)).toThrow(/agora traz 5/);
    expect(() => assertSqsOreValueCellUnchanged(0)).toThrow(Error);
  });

  it("a guarda passa contra o dado real de hoje", () => {
    expect(() => assertSqsOreValueCellUnchanged()).not.toThrow();
    expect(SHB_ECONOMIC.oreValue.options["Alto"][9]).toBe(SQS_ORE_VALUE_RAW);
  });
});

describe("guardas de entrada", () => {
  it("null e undefined passam como null", () => {
    expect(toShbScale(null, "shape")).toBeNull();
    expect(toShbScale(undefined, "shape")).toBeNull();
  });

  it("valor não numérico lança", () => {
    expect(() => toShbScale("4", "shape")).toThrow(/valor não numérico/);
    expect(() => toShbScale(NaN, "shape")).toThrow(/valor não numérico/);
  });

  it("criterionId desconhecido lança, nomeando os que existem", () => {
    expect(() => toShbScale(2, "criterioInventado")).toThrow(/critério desconhecido/);
    expect(() => toShbScale(2, "criterioInventado")).toThrow(/rss_ob/);
    expect(() => toShbScale(2, undefined)).toThrow(/critério desconhecido/);
  });

  it("valor que não é marcador nem base válida lança, nomeando o que calculou", () => {
    // 7 em `shape` (fator 1) daria base 7, acima do máximo 6.
    expect(() => toShbScale(7, "shape")).toThrow(RangeError);
    expect(() => toShbScale(7, "shape")).toThrow(/dá base 7/);
    // Negativo que não é marcador conhecido.
    expect(() => toShbScale(-3, "shape")).toThrow(/não é um inteiro de 0 a 6/);
    // Fracionário que não bate com fator nenhum.
    expect(() => toShbScale(2.5, "rss_ob")).toThrow(RangeError);
  });

  it("a tolerância não é frouxa a ponto de confundir duas bases", () => {
    // 0,44 é base 1 no piso. Um valor a meio caminho entre duas bases tem de
    // falhar, e não escolher a mais próxima em silêncio.
    expect(toShbScale(0.44, "rss_fw")).toBe(3);
    expect(() => toShbScale(0.66, "rss_fw")).toThrow(RangeError);
  });
});

describe("cobertura do dataset real — todas as 500 células convertem", () => {
  it("nenhuma célula do SH&B fica sem conversão", () => {
    // A prova de que o domínio está fechado: se sobrasse um valor sem regra,
    // ele apareceria aqui em vez de derrubar a tela do usuário.
    const tabelas = [
      [SHB_GEOMETRY, null], [SHB_ECONOMIC, null],
      [SHB_OREBODY, "_ob"], [SHB_HANGINGWALL, "_hw"], [SHB_FOOTWALL, "_fw"],
    ];
    const saidas = new Set();
    let total = 0;

    for (const [tabela, sufixo] of tabelas) {
      for (const [crit, { options }] of Object.entries(tabela)) {
        const id = sufixo ? crit + sufixo : crit;
        for (const valores of Object.values(options)) {
          valores.forEach((v, i) => {
            const convertido = toShbScale(v, id, METHODS[i]);
            expect(convertido).not.toBeNull();
            saidas.add(convertido);
            total += 1;
          });
        }
      }
    }

    expect(total).toBe(500);
    // A escala de saída: 0 para eliminação, mais os ímpares de 1 a 9.
    expect([...saidas].sort((a, b) => a - b)).toEqual([0, 1, 3, 5, 7, 9]);
  });
});
