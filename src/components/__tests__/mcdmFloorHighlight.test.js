import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ptBR from "../../i18n/locales/pt-BR.json";

// ---------------------------------------------------------------------------
// MARCA DE PISO DE ESCALA NOS CARTÕES DO MCDM — REGRESSÃO DE FONTE
// ---------------------------------------------------------------------------
// A REGRA está em utils/scaleFloorCriteria.js e é testada de verdade lá, contra
// as abas que o pipeline realmente produz nos três métodos de seleção. O que
// não dá para testar assim é a LIGAÇÃO com o cartão, e é ela que tem as duas
// coisas mais fáceis de desfazer sem ninguém perceber:
//
//   1. o JOIN por CÓDIGO. `ranking` vem ordenado por colocação e `sheet.rows`
//      vem na ordem canônica de METHODS — casar as duas por índice compilaria,
//      renderizaria e mostraria os critérios de um método no cartão de outro.
//   2. o TEXTO. Aqui o vermelho NÃO quer dizer eliminação: o método segue
//      ranqueado, e a frase precisa dizer isso por extenso. Um texto copiado do
//      da aba clássica passaria em qualquer teste de estilo e mentiria para o
//      usuário.
//
// O projeto não tem infraestrutura de teste de componente React (vite.config.js
// roda em `environment: 'node'`, sem Testing Library) — ver o comentário no topo
// de mcdmNoBestHighlight.test.js. Isto lê o fonte: não prova que a tela pinta
// certo, prova que os mecanismos estão escritos como se decidiu.

const leia = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const MCDM_BLOCK = leia("../McdmBlock.jsx");
const STATISTICS = leia("../../pages/Statistics.jsx");

// O corpo do cartão de ranking do MCDM — não o dos blocos clássicos, que vive
// em Statistics.jsx e não foi tocado.
const CARTAO = MCDM_BLOCK.slice(
  MCDM_BLOCK.indexOf("derived.result.ranking.map("),
  MCDM_BLOCK.indexOf("</>", MCDM_BLOCK.indexOf("derived.result.ranking.map(")),
);

describe("origem do dado", () => {
  it("sai da aba que o pipeline já devolveu, sem consulta nova", () => {
    // `derived.result.sheet` é a MESMA aba que a matriz de decisão exibe. Uma
    // segunda chamada a deriveMcdmRanking aqui rodaria um TOPSIS inteiro a mais
    // por render, para chegar exatamente ao mesmo objeto.
    expect(MCDM_BLOCK).toMatch(/import \{ floorCriteriaBySheet \} from "\.\.\/utils\/scaleFloorCriteria"/);
    expect(MCDM_BLOCK).toMatch(/floorCriteriaBySheet\(derived\.result\.sheet\)/);
    // Uma única chamada ao pipeline no arquivo inteiro — a que já existia.
    expect(MCDM_BLOCK.match(/deriveMcdmRanking\(/g)).toHaveLength(1);
  });

  it("o join é por CÓDIGO, via Map — nunca por índice", () => {
    expect(CARTAO).toMatch(/floorByCode\.get\(entry\.code\)/);
    // O erro que isto barra: `sheet.rows[i]` ou `floorCriteria[index]` dentro do
    // map do ranking, que alinharia colocação com ordem canônica.
    //
    // O `\w` depois do colchete é o que separa INDEXAÇÃO de menção: o comentário
    // do próprio cartão fala de `sheet.rows[].code` para explicar o join, e um
    // padrão mais frouxo acusaria a explicação como se fosse o erro.
    expect(CARTAO).not.toMatch(/sheet\.rows\[\s*\w/);
    expect(CARTAO).not.toMatch(/\[\s*(index|i)\s*\]/);
  });

  it("método ausente da aba não quebra o cartão", () => {
    expect(CARTAO).toMatch(/\?\?\s*\[\]/);
  });
});

describe("tratamento visual", () => {
  it("reusa os tokens semânticos de erro, sem vermelho novo", () => {
    expect(MCDM_BLOCK).toMatch(/danger:\s*"var\(--color-danger\)"/);
    expect(MCDM_BLOCK).toMatch(/danger50:\s*"var\(--color-danger-50\)"/);
    expect(CARTAO).toMatch(/colors\.danger50/);
    expect(CARTAO).toMatch(/colors\.danger/);
  });

  it("a borda continua 1px — só troca de cor", () => {
    // O cartão do MCDM já tinha borda; trocar a espessura moveria a fileira
    // inteira quando um método passasse a ficar marcado.
    expect(CARTAO).toMatch(/border:\s*`1px solid \$\{atFloor \? colors\.danger : colors\.border\}`/);
  });

  it("o hover usa `title`, o mesmo mecanismo do resto da tela", () => {
    expect(CARTAO).toMatch(/title=\{/);
  });

  it("cartão sem piso não recebe title nenhum", () => {
    // `title` vazio é um tooltip fantasma em cartão limpo.
    expect(CARTAO).toMatch(/:\s*undefined/);
  });
});

describe("texto do hover", () => {
  it("usa chave PRÓPRIA, e não a da aba clássica", () => {
    expect(CARTAO).toMatch(/results\.mcdm\.floorScore/);
    expect(CARTAO).not.toMatch(/results\.eliminatedBy/);
  });

  it("resolve rótulos pela mesma chave que a matriz usa nas colunas clássicas", () => {
    expect(CARTAO).toMatch(/results\.criteria\.\$\{id\}/);
  });

  it("concatena TODOS os critérios, não só o primeiro", () => {
    expect(CARTAO).toMatch(/\.join\(", "\)/);
  });

  it("a frase interpola a lista de critérios e nomeia o que aconteceu", () => {
    // A EXPLICAÇÃO SAIU DO TEXTO, por decisão do usuário: a frase carregava um
    // segundo período dizendo que o método continuava ranqueado e que o piso
    // não era eliminação, e ficou só o fato. O que esta asserção protege é o
    // que sobrou de indispensável — o placeholder, sem o qual o hover não diz
    // QUAIS critérios, e a palavra que nomeia o fato, sem a qual ele não diz
    // nada.
    //
    // A distinção de sentido em relação à aba clássica não sumiu do projeto:
    // ela continua escrita em scaleFloorCriteria.js e no comentário do cartão,
    // que é onde quem mexe no código a encontra. O que mudou é que ela deixou
    // de ser repetida ao usuário a cada hover.
    const frase = ptBR.results.mcdm.floorScore;
    expect(frase).toMatch(/\{\{criteria\}\}/);
    expect(frase.toLowerCase()).toMatch(/mínima|minima|piso|mínimo/);
  });

  it("a frase NÃO fala em eliminação — o sentido aqui é outro", () => {
    // O texto encurtou, mas não pode encurtar para o lado errado: chamar isto
    // de eliminação seria dizer o oposto do que acontece, já que o método segue
    // ranqueado pelo TOPSIS.
    expect(ptBR.results.mcdm.floorScore.toLowerCase()).not.toMatch(/elimina/);
  });

  it("é um texto diferente do da aba clássica", () => {
    expect(ptBR.results.mcdm.floorScore).not.toBe(ptBR.results.eliminatedBy);
  });
});

// ---------------------------------------------------------------------------
// AS DUAS MARCAÇÕES SEGUEM SEPARADAS
// ---------------------------------------------------------------------------
// Fontes de dado diferentes, módulos diferentes, textos diferentes. O risco de
// alguém "unificar" as duas por parecerem iguais é real, e o resultado seria a
// aba clássica passar a procurar 0 (que lá é um score legítimo) ou o MCDM
// passar a procurar -49 (que lá não existe, porque a conversão já o consumiu).
describe("a aba clássica não foi tocada", () => {
  it("Statistics.jsx continua usando eliminationMarker, e só ele", () => {
    expect(STATISTICS).toMatch(/import \{ eliminatingCriteriaFor \} from "\.\.\/utils\/eliminationMarker"/);
    // NÃO IMPORTA nem CHAMA o módulo do MCDM. O padrão não pode ser só
    // "scaleFloorCriteria": a aba clássica passou a citar o arquivo num
    // comentário, ao explicar que as duas marcações usam a mesma TÉCNICA (ler
    // de uma fonte sem peso) procurando coisas diferentes — e a menção é
    // justamente a documentação que se quer manter.
    expect(STATISTICS).not.toMatch(/from "\.\.\/utils\/scaleFloorCriteria"/);
    expect(STATISTICS).not.toMatch(/floorCriteriaBySheet\s*\(/);
  });

  it("McdmBlock.jsx não importa eliminationMarker", () => {
    expect(MCDM_BLOCK).not.toMatch(/eliminationMarker/);
    expect(MCDM_BLOCK).not.toMatch(/eliminatingCriteriaFor/);
  });

  it("scaleFloorCriteria não conhece os marcadores da aba clássica", () => {
    // -49 e -50 não aparecem no módulo novo: depois da conversão de escala eles
    // não existem mais, e procurá-los ali seria procurar o que já foi traduzido.
    const UTIL = leia("../../utils/scaleFloorCriteria.js");
    expect(UTIL).not.toMatch(/ELIMINATION_SCORE_BY_METHOD/);
    expect(UTIL).not.toMatch(/-49|-50/);
  });
});

// ---------------------------------------------------------------------------
// A MATRIZ DE DECISÃO SEGUE SEM MARCAÇÃO
// ---------------------------------------------------------------------------
// Fora de escopo desta tarefa por decisão explícita. Se um dia for estendida
// para lá, é tarefa separada — e este caso é o lembrete de que a decisão foi
// tomada, não esquecida.
describe("a marcação NÃO foi para a matriz de decisão", () => {
  it("a linha da matriz não conhece o marcador de piso", () => {
    const corpo = MCDM_BLOCK.slice(
      MCDM_BLOCK.indexOf("{sheet.rows.map("),
      MCDM_BLOCK.indexOf("</tbody>"),
    );
    expect(corpo).not.toMatch(/atFloor|floorByCode|floorCriteria/);
  });
});
