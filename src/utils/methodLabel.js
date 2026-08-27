// RÓTULO DE MÉTODO DE LAVRA PARA A TELA — FONTE ÚNICA
//
// Existem DOIS conjuntos de rótulos para os mesmos dez métodos, e a diferença
// entre eles é proposital:
//
//   METHOD_LABELS        (ubcWeights.js)     — UI.        "SQS" -> "Square Set"
//   EXPORT_METHOD_LABELS (decisionMatrix.js) — .xlsx.     "SQS" -> "Square Set Stoping"
//
// O de exportação é nome completo porque o destino é um arquivo de dados lido
// por outro software, onde a forma extensa é a identificação correta; o de UI é
// abreviado porque cabe em cartão, cabeçalho de coluna e célula de tabela.
//
// O PROBLEMA QUE ESTA FUNÇÃO RESOLVE. `buildDecisionMatrix` carimba o rótulo de
// EXPORTAÇÃO em `sheet.rows[].method`, e o pipeline o copia para
// `ranking[].label`. Quem exibe essas estruturas na tela herda, sem querer, o
// rótulo do arquivo — foi assim que "Square Set Stoping" apareceu nos cartões
// de ranking e na matriz. A correção é no CAMINHO DE EXIBIÇÃO: a tela deixa de
// ler o campo que vem junto do dado e passa a resolver o rótulo pelo código.
// decisionMatrix.js não muda, e o .xlsx continua saindo com o nome completo.
//
// Resolver por CÓDIGO, e não com fallback para `row.method`/`entry.label`, é o
// ponto todo: um fallback para esses campos reintroduziria silenciosamente o
// rótulo de exportação no dia em que um código novo entrasse sem entrada em
// METHOD_LABELS. Melhor a tela mostrar "SQS" — que é visivelmente um código e
// alguém corrige — do que mostrar o rótulo errado, que ninguém percebe.
//
// Puro: não lê estado global, não toca no DOM.

import { METHOD_LABELS } from "../algorithms/ubcWeights";

/**
 * Rótulo de exibição de um método de lavra, a partir do seu código.
 *
 * Mesmo idioma de Statistics.jsx (`METHOD_LABELS[m] || m`), extraído para que o
 * bloco MCDM não precise reimplementá-lo em cada um dos lugares onde mostra
 * nome de método.
 *
 * @param {string} code  código do método ("OP", "SQS", ...)
 * @returns {string} rótulo de UI, ou o próprio código se não houver rótulo
 */
export function uiMethodLabel(code) {
  return METHOD_LABELS[code] || code;
}
