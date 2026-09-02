import { describe, it, expect } from "vitest";
import { rankToColor } from "../rankColor";

// ---------------------------------------------------------------------------
// COR DE COLOCAÇÃO
// ---------------------------------------------------------------------------
// O contrato tem duas metades e a segunda é a que costuma quebrar em silêncio.
// A primeira — verde no primeiro, vermelho no último — qualquer um vê na tela.
// A segunda é que saturação e luminosidade NÃO variam: se um refactor as fizer
// acompanhar o matiz, a tabela continua parecendo certa (ainda é verde-para-
// vermelho) enquanto passa a sugerir uma diferença de intensidade que não
// existe nos dados. Por isso os testes de S e L constantes leem a string de
// saída, e não uma constante do módulo: o que precisa estar travado é o que
// chega ao CSS.

// Dez métodos — o tamanho real da tabela hoje. Usado como caso concreto, não
// como número que a função conheça.
const TOTAL = 10;

const parse = (css) => {
  const m = /^hsl\((-?[\d.]+), ([\d.]+)%, ([\d.]+)%\)$/.exec(css);
  if (!m) throw new Error(`formato HSL inesperado: ${css}`);
  return { hue: Number(m[1]), saturation: Number(m[2]), lightness: Number(m[3]) };
};

const hueOf = (rank, total = TOTAL) => parse(rankToColor(rank, total)).hue;

describe("pontas do gradiente", () => {
  it("a primeira colocação é verde puro (120°)", () => {
    expect(hueOf(1)).toBe(120);
  });

  it("a última colocação é vermelho puro (0°)", () => {
    expect(hueOf(TOTAL)).toBe(0);
  });

  it("as pontas são exatas em qualquer tamanho de lista", () => {
    for (const total of [2, 3, 7, 10, 19, 100]) {
      expect(hueOf(1, total)).toBe(120);
      expect(hueOf(total, total)).toBe(0);
    }
  });

  it("o meio do caminho é amarelo (60°)", () => {
    // Total ímpar para que exista uma colocação exatamente no meio.
    expect(hueOf(2, 3)).toBe(60);
    expect(hueOf(6, 11)).toBe(60);
  });
});

describe("monotonicidade", () => {
  it("o matiz decresce a cada colocação", () => {
    for (let rank = 1; rank < TOTAL; rank++) {
      expect(hueOf(rank + 1)).toBeLessThan(hueOf(rank));
    }
  });

  it("decresce também em listas de outros tamanhos", () => {
    for (const total of [2, 5, 19]) {
      for (let rank = 1; rank < total; rank++) {
        expect(hueOf(rank + 1, total)).toBeLessThan(hueOf(rank, total));
      }
    }
  });

  it("os passos são iguais — o gradiente é linear na colocação", () => {
    // Duas colocações vizinhas distam sempre o mesmo, em qualquer trecho da
    // curva. É o que garante que a distância entre cores signifique distância
    // entre colocações, e não a posição no gradiente.
    const passos = [];
    for (let rank = 1; rank < TOTAL; rank++) {
      passos.push(Number((hueOf(rank) - hueOf(rank + 1)).toFixed(2)));
    }
    for (const passo of passos) {
      expect(passo).toBeCloseTo(120 / (TOTAL - 1), 1);
    }
  });
});

describe("saturação e luminosidade constantes", () => {
  it("não variam ao longo da curva", () => {
    const primeira = parse(rankToColor(1, TOTAL));
    for (let rank = 1; rank <= TOTAL; rank++) {
      const { saturation, lightness } = parse(rankToColor(rank, TOTAL));
      expect(saturation).toBe(primeira.saturation);
      expect(lightness).toBe(primeira.lightness);
    }
  });

  it("não variam entre listas de tamanhos diferentes", () => {
    const referencia = parse(rankToColor(1, TOTAL));
    for (const total of [1, 2, 3, 19, 100]) {
      for (const rank of [1, Math.ceil(total / 2), total]) {
        const { saturation, lightness } = parse(rankToColor(rank, total));
        expect(saturation).toBe(referencia.saturation);
        expect(lightness).toBe(referencia.lightness);
      }
    }
  });
});

describe("bordas", () => {
  it("uma colocação só não divide por zero", () => {
    const css = rankToColor(1, 1);
    expect(css).not.toMatch(/NaN|Infinity/);
    expect(parse(css).hue).toBe(120);
  });

  it("colocação fora da faixa satura na ponta, sem dar a volta no círculo", () => {
    // Sem clamp, estes virariam magenta e azul — cores de outra família, que na
    // tabela leriam como categoria nova em vez de extremo.
    for (const rank of [0, -3]) {
      expect(hueOf(rank)).toBe(120);
    }
    for (const rank of [TOTAL + 1, 999]) {
      expect(hueOf(rank)).toBe(0);
    }
  });

  it("todo matiz fica no arco verde→vermelho, sem passar por ciano ou magenta", () => {
    for (let rank = 1; rank <= TOTAL; rank++) {
      const hue = hueOf(rank);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThanOrEqual(120);
    }
  });

  it("devolve sempre HSL válido, sem ruído de ponto flutuante", () => {
    for (const total of [1, 2, 3, 7, 10, 19]) {
      for (let rank = 1; rank <= total; rank++) {
        expect(rankToColor(rank, total)).toMatch(/^hsl\(\d+(\.\d{1,2})?, 65%, 62%\)$/);
      }
    }
  });
});
