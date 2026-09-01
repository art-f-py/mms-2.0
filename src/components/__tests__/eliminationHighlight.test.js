import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// LIGAÇÃO DA MARCA DE ELIMINAÇÃO NA TELA — REGRESSÃO DE FONTE
// ---------------------------------------------------------------------------
// A REGRA está em utils/eliminationMarker.js e é testada de verdade lá, contra
// os `calculate*`. O que NÃO dá para testar assim é a ligação dela com o
// cartão: que o vermelho está preso ao resultado da função, que o hover mostra
// RÓTULOS traduzidos e não ids crus, e — o mais fácil de desfazer sem perceber
// — que o marcador consultado é o DO BLOCO (`sm.key`) e não um número global.
//
// O projeto não tem infraestrutura de teste de componente React (vite.config.js
// roda em `environment: 'node'`, sem Testing Library — ver o comentário no topo
// de mcdmNoBestHighlight.test.js, que segue o mesmo padrão). Então isto lê o
// fonte. Não prova que a tela pinta certo; prova que os mecanismos estão
// escritos como se decidiu. Se um dia houver Testing Library, este arquivo deve
// virar um teste de renderização de verdade.
//
// O SEGUNDO ARQUIVO cobre o painel de métodos pendentes, que parou de ser
// renderizado com a lista vazia — mesma natureza de asserção, mesma limitação.

const leia = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const STATISTICS = leia("../../pages/Statistics.jsx");
const MCDM_BLOCK = leia("../McdmBlock.jsx");

// O cartão de ranking dos blocos CLÁSSICOS — não o do MCDM, que é outro
// componente e continua sem realce nenhum (ver mcdmNoBestHighlight.test.js).
const CARTAO = STATISTICS.slice(
  STATISTICS.indexOf("{result.ranking.map("),
  STATISTICS.indexOf("</div>\n      </div>\n    </div>"),
);

describe("marca de eliminação no cartão de ranking clássico", () => {
  it("a decisão vem de eliminatingCriteriaFor, não de um número escrito à mão", () => {
    expect(STATISTICS).toMatch(/import \{ eliminatingCriteriaFor \} from "\.\.\/utils\/eliminationMarker"/);
    expect(CARTAO).toMatch(/eliminatingCriteriaFor\(result, sm\.key, m\)/);
  });

  it("o marcador consultado é o do MÉTODO DE SELEÇÃO do bloco", () => {
    // `sm.key` é o que faz o SH&B procurar −50 e os outros dois −49. Trocá-lo
    // por uma constante deixaria os cartões do SH&B permanentemente limpos, e
    // nada na tela denunciaria.
    expect(CARTAO).toMatch(/sm\.key/);
    // Nenhum valor de eliminação escrito aqui dentro.
    expect(CARTAO).not.toMatch(/-49|-50/);
  });

  it("o vermelho sai dos tokens semânticos de erro, não de um hex novo", () => {
    expect(STATISTICS).toMatch(/danger:\s*"var\(--color-danger\)"/);
    expect(STATISTICS).toMatch(/danger50:\s*"var\(--color-danger-50\)"/);
    expect(CARTAO).toMatch(/colors\.danger/);
    expect(CARTAO).toMatch(/colors\.danger50/);
  });

  it("a borda existe sempre, transparente quando não há eliminação", () => {
    // Pintá-la só no caso vermelho mudaria a altura do cartão e faria a fileira
    // saltar quando um critério passasse a eliminar.
    expect(CARTAO).toMatch(/border:\s*`2px solid \$\{eliminated \? colors\.danger : "transparent"\}`/);
  });

  it("o hover usa `title` e passa pelos RÓTULOS do i18n, não pelos ids", () => {
    expect(CARTAO).toMatch(/title=\{/);
    expect(CARTAO).toMatch(/results\.eliminatedBy/);
    // A mesma chave de rótulo que o radar de breakdown usa logo acima.
    expect(CARTAO).toMatch(/results\.criteria\.\$\{id\}/);
    // Todos os critérios que dispararam, não só o primeiro.
    expect(CARTAO).toMatch(/\.join\(", "\)/);
  });

  it("cartão sem eliminação não recebe title nenhum", () => {
    // `title` vazio é um tooltip fantasma que aparece em cartão limpo.
    expect(CARTAO).toMatch(/:\s*undefined/);
  });
});

describe("painel de métodos pendentes só renderiza com lista não vazia", () => {
  it("a renderização é condicionada ao tamanho de MCDM_PENDING_METHODS", () => {
    expect(MCDM_BLOCK).toMatch(/\{Object\.keys\(MCDM_PENDING_METHODS\)\.length > 0 && \(/);
  });

  it("o mecanismo FICA — constante, texto e JSX continuam ligados", () => {
    // Só a renderização é condicional. Apagar o painel obrigaria a reinventá-lo
    // no dia em que um quarto método de seleção chegasse bloqueado.
    expect(MCDM_BLOCK).toMatch(/import \{ MCDM_PENDING_METHODS \}/);
    expect(MCDM_BLOCK).toMatch(/results\.mcdm\.pendingTitle/);
    expect(MCDM_BLOCK).toMatch(/results\.mcdm\.pendingReason/);
    expect(MCDM_BLOCK).toMatch(/Object\.entries\(MCDM_PENDING_METHODS\)\.map/);
  });
});
