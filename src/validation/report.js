// ---------------------------------------------------------------------------
// RELATÓRIO DE LOTE — o estado de uma pasta de casos, em texto
// ---------------------------------------------------------------------------
// Junta as três peças numa saída só: carrega a pasta, diz quais casos estão
// prontos e o que falta nos que não estão, e roda a comparação clássico-vs-MCDM
// nos que estão. É o que se lê depois de uma rodada de extração para saber o que
// buscar no próximo PDF.
//
// DEVOLVE TEXTO, NÃO IMPRIME. Quem chama decide o destino — console, arquivo,
// expectativa de teste. Uma função que imprime não se testa sem capturar stdout.
//
// NÃO HÁ BINÁRIO DE LINHA DE COMANDO chamando isto, e a ausência é deliberada: os
// módulos de src/ importam sem extensão (".../algorithms/algorithms"), resolução
// que o Vite faz e o Node puro não — um `node script.mjs` falharia no primeiro
// import. Rodar por CLI exigiria `vite-node` como devDependency, que é mudança
// no projeto e decisão de quem o mantém. Hoje o ponto de entrada é a suíte:
// `npx vitest run src/validation`.

import { loadCaseDir } from "./caseLoader";
import { formatValidation } from "./caseSchema";
import { compareCase, formatComparison } from "./compareRanking";

/**
 * Relatório de uma pasta de casos.
 *
 * @param {string} diretorio  pasta com os .json de caso
 * @param {object} [options]  repassado a validateCase/compareCase
 * @returns {{text: string, ready: string[], pending: string[], failed: string[]}}
 */
export function buildValidationReport(diretorio, options = {}) {
  const entradas = loadCaseDir(diretorio, options);
  const ready = [];
  const pending = [];
  const failed = [];
  const blocos = [];

  for (const entrada of entradas) {
    if (entrada.error) {
      failed.push(entrada.path);
      blocos.push(`✘ ${entrada.path}\n  ${entrada.error.message}`);
      continue;
    }

    const id = entrada.case?.case_id ?? entrada.path;
    if (!entrada.ready) {
      pending.push(id);
      blocos.push(formatValidation(entrada.validation));
      continue;
    }

    ready.push(id);
    // Validador e mapeador compartilham as regras (a ambiguidade da espessura
    // abaixo de 10 m, que antes só o mapeador via, hoje é pendência de
    // validação). O try fica como rede: se um dia as duas etapas voltarem a
    // divergir, o relatório mostra o motivo em vez de derrubar o lote inteiro.
    try {
      blocos.push(formatComparison(compareCase(entrada.case, options)));
    } catch (erro) {
      blocos.push(`✘ ${id}: completo, mas não mapeável\n${erro.message}`);
    }
  }

  const cabecalho =
    `Casos em ${diretorio}: ${entradas.length} — ` +
    `${ready.length} pronto(s), ${pending.length} pendente(s), ${failed.length} ilegível(is)`;

  return { text: [cabecalho, "", ...blocos].join("\n\n"), ready, pending, failed };
}
