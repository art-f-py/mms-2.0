// CRITÉRIOS DE ELIMINAÇÃO NOS RESULTADOS CLÁSSICOS
//
// As tabelas dos três métodos de seleção não pontuam só de 0 para cima: elas
// carregam um valor SENTINELA que não é uma nota baixa, é um veto. "Este método
// de lavra está eliminado por este critério." O valor é diferente por método —
// −49 no Nicholas e no UBC, −50 no SH&B (ver a nota no topo de shbWeights.js) —
// e é isso que esta tabela guarda.
//
// −25 DO SH&B NÃO ENTRA. Ele aparece uma vez só (depth "Pouco profunda" para
// Open Pit) e é PENALIDADE PARCIAL, não veto: a cava a céu aberto fica cara
// nessa profundidade, não impossível. Tratá-lo como eliminação pintaria de
// vermelho um cartão que a publicação não elimina. Mesma razão para −10 e −7
// ficarem de fora — são penalidades da mesma família, só que menores.
//
// LIMITE CONHECIDO: o breakdown guarda o score JÁ MULTIPLICADO pelo peso por
// critério da etapa Complementar (ver sumCriteria em algorithms/algorithms.js).
// Com os pesos no padrão — 1.00, que é onde eles ficam a não ser que alguém
// mexa — o valor gravado é o da tabela e a comparação exata acerta. Com um peso
// diferente de 1 o marcador vira outro número e o cartão deixa de ser marcado.
// A comparação continua EXATA de propósito: a alternativa (dividir pelo peso
// para recuperar o valor cru) reconstruiria por aritmética de ponto flutuante
// um dado que o breakdown não guarda, e um falso positivo aqui — cartão pintado
// de vermelho sem eliminação nenhuma — é pior que um falso negativo. Quem quiser
// resolver isso de verdade precisa fazer sumCriteria guardar o score cru ao lado
// do ponderado; é mudança na camada de algoritmo, não aqui.
//
// Puro: não lê estado global, não toca no DOM, não muta o que recebe.

/**
 * O valor de eliminação de cada método de SELEÇÃO.
 *
 * Chaveado pela chave do método de seleção ('nicholas', 'ubc', 'shb') — a mesma
 * de state.results e de SELECTION_METHODS em Statistics.jsx.
 */
export const ELIMINATION_SCORE_BY_METHOD = Object.freeze({
  nicholas: -49,
  ubc:      -49,
  shb:      -50,
});

/**
 * Os critérios que ELIMINAM um método de lavra, dentro de um resultado clássico.
 *
 * Devolve os IDS dos critérios (`rss_ob`, `thickness`, ...), não os rótulos: o
 * rótulo é assunto da tela e sai do i18n (`results.criteria.<id>`), que é onde
 * o radar de breakdown já o busca. Devolver id aqui é o que mantém esta função
 * testável sem i18n.
 *
 * As chaves do breakdown têm a forma `${criterio}__${valorSelecionado}` (ver
 * sumCriteria); só a primeira metade identifica o critério. Como cada critério
 * entra uma vez por cálculo, não há id repetido na saída.
 *
 * A ordem é a do breakdown — a ordem em que o `calculate*` montou os critérios.
 * É a mesma que o radar de breakdown usa, então a lista do hover sai na mesma
 * sequência que o gráfico ao lado.
 *
 * @param {object} result               saída de calculateNicholas/UBC/SHB
 * @param {string} selectionMethodKey   'nicholas' | 'ubc' | 'shb'
 * @param {string} miningCode           código do método de lavra ('OP', 'BC', ...)
 * @returns {string[]} ids dos critérios que eliminam; vazio quando nenhum
 */
export function eliminatingCriteriaFor(result, selectionMethodKey, miningCode) {
  const marker = ELIMINATION_SCORE_BY_METHOD[selectionMethodKey];
  const breakdown = result?.breakdown;
  if (marker === undefined || !breakdown) return [];

  return Object.entries(breakdown)
    .filter(([, scores]) => scores?.[miningCode] === marker)
    .map(([breakdownKey]) => breakdownKey.split("__")[0]);
}
