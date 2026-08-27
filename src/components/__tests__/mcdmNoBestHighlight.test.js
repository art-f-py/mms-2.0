import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// NENHUM REALCE DE MELHOR COLOCAÇÃO — REGRESSÃO
// ---------------------------------------------------------------------------
// O destaque do 1º lugar existia em DOIS lugares de McdmBlock.jsx: o cartão de
// ranking (`entry.rank === 1` pintando fundo, texto e borda) e a linha da
// matriz de decisão (`row.code === bestCode` pintando fundo, peso da fonte e
// cor). Os dois saíram. Este arquivo existe para que não voltem sem que alguém
// perceba — sobretudo o da matriz, que é discreto e passaria numa revisão.
//
// O QUE ESTE TESTE É, E O QUE ELE NÃO É. Ele lê o FONTE e procura os padrões
// que caracterizam o realce. Não é teste de renderização: o projeto não tem
// infraestrutura de teste de componente React (vite.config.js roda em
// `environment: 'node'`, sem Testing Library), então não há como montar o
// componente e olhar o estilo que saiu. Um teste de fonte não prova que a tela
// está neutra — prova que os mecanismos que a deixavam não-neutra não estão
// mais escritos ali, que é o mais forte que se consegue aqui.
//
// Se um dia houver Testing Library no projeto, este arquivo deve ser
// substituído por um que monte o bloco e compare os estilos das dez linhas.

const SRC = readFileSync(
  fileURLToPath(new URL("../McdmBlock.jsx", import.meta.url)),
  "utf8",
);

describe("a prop bestCode não existe mais", () => {
  it("não aparece em lugar nenhum do arquivo", () => {
    // Era a via pela qual a matriz sabia quem era o primeiro. Sem ela, a
    // tabela não tem como realçar linha nenhuma, e o código morto não fica
    // para trás.
    expect(SRC).not.toMatch(/bestCode/);
  });

  it("DecisionMatrixTable não recebe nenhuma prop de melhor colocação", () => {
    const assinatura = SRC.match(/function DecisionMatrixTable\(\{([^}]*)\}/);
    expect(assinatura).not.toBeNull();
    expect(assinatura[1]).not.toMatch(/best|first|winner/i);
  });
});

describe("nenhuma comparação de colocação sobrou", () => {
  it("não há teste de primeiro lugar por rank", () => {
    // Pega `entry.rank === 1`, `rank===1` e variações com espaço.
    expect(SRC).not.toMatch(/rank\s*===\s*1\b/);
  });

  it("não há comparação de código de método com um vencedor", () => {
    expect(SRC).not.toMatch(/\.code\s*===\s*\w*[Bb]est/);
  });

  it("não sobrou variável `best` nem `first`", () => {
    expect(SRC).not.toMatch(/\bconst\s+best\b/);
    expect(SRC).not.toMatch(/\bconst\s+first\b/);
  });
});

describe("os dois lugares que tinham realce estão neutros", () => {
  // Recorta o corpo de cada um e verifica que não há estilo condicional lá
  // dentro. Recortar importa: o arquivo inteiro tem ternários legítimos (o
  // layout com a matriz aberta, o acordeão), e procurar "?" no todo acusaria
  // falso positivo.

  const recorte = (inicio, fim) => {
    const i = SRC.indexOf(inicio);
    const f = SRC.indexOf(fim, i);
    expect(i).toBeGreaterThan(-1);
    expect(f).toBeGreaterThan(i);
    return SRC.slice(i, f);
  };

  it("a linha da matriz não tem estilo condicional", () => {
    const corpo = recorte("{sheet.rows.map(", "</tbody>");
    expect(corpo).not.toMatch(/backgroundColor:\s*\w+\s*\?/);
    expect(corpo).not.toMatch(/fontWeight:\s*\w+\s*\?/);
    expect(corpo).not.toMatch(/color:\s*\w+\s*\?/);
  });

  it("o cartão de ranking não tem estilo condicional", () => {
    const corpo = recorte("derived.result.ranking.map(", "</div>");
    expect(corpo).not.toMatch(/backgroundColor:\s*\w+\s*\?/);
    expect(corpo).not.toMatch(/border:\s*`[^`]*\$\{\w+\s*\?/);
    expect(corpo).not.toMatch(/color:\s*\w+\s*\?/);
  });

  it("a linha da matriz usa o mesmo fundo para todas as linhas", () => {
    const corpo = recorte("{sheet.rows.map(", "</tbody>");
    // Duas ocorrências: o cabeçalho de linha (o nome do método) e as células.
    const fundos = corpo.match(/backgroundColor:\s*colors\.white/g) || [];
    expect(fundos.length).toBeGreaterThanOrEqual(2);
  });
});
