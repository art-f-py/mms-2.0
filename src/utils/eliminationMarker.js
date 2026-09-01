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
// A FONTE É A MATRIZ DE PESOS NEUTROS, E NÃO O `breakdown` DO RESULTADO.
// Esta função já leu o breakdown, e isso era um bug: o breakdown guarda o score
// JÁ MULTIPLICADO pelo peso por critério da etapa Complementar (ver sumCriteria
// em algorithms/algorithms.js). Com os pesos no padrão o valor gravado é o da
// tabela e a comparação exata acertava; bastava alguém arrastar um slider para
// −49 virar −73,5 e o cartão parar de ser marcado. Falso negativo silencioso:
// o método continuava eliminado pela publicação e a tela deixava de dizer.
//
// A CORREÇÃO NÃO MEXEU NO CÁLCULO CLÁSSICO, mexeu na origem do dado. O que
// chega aqui agora é uma aba de `buildDecisionMatrix`, que monta os scores com
// `neutralWeights()` — as duas camadas de ponderação do usuário em 1.00, por
// contrato declarado no cabeçalho de decisionMatrix.js. Os pesos continuam
// valendo em tudo o que a tela EXIBE (scores, ranking, radar de breakdown);
// eles só não têm voz em "a publicação elimina este método?", que é uma
// pergunta sobre a tabela, não sobre a ponderação de quem preenche o
// formulário.
//
// É A MESMA TÉCNICA que scaleFloorCriteria.js usa na aba multicritério — ler de
// uma fonte sem peso em vez de tentar desfazer a multiplicação —, e os dois
// módulos seguem SEPARADOS de propósito, porque o que eles procuram é
// diferente. Lá o valor já passou pela conversão de escala (Saaty/UBC/SH&B) e a
// eliminação virou 0. AQUI NÃO HÁ CONVERSÃO NENHUMA: a aba clássica é lida crua,
// então o que se procura continua sendo −49 / −50, e um 0 nesta matriz é um
// score legítimo da tabela — o oposto do que um 0 significa lá. Fundir os dois
// faria cada um procurar o número do outro.
//
// Puro: não lê estado global, não toca no DOM, não muta o que recebe.

/**
 * O valor de eliminação de cada método de SELEÇÃO.
 *
 * Chaveado pela chave do método de seleção ('nicholas', 'ubc', 'shb') — a mesma
 * de state.results, de SELECTION_METHODS em Statistics.jsx e de `sheet.key`.
 */
export const ELIMINATION_SCORE_BY_METHOD = Object.freeze({
  nicholas: -49,
  ubc:      -49,
  shb:      -50,
});

/**
 * Os critérios que ELIMINAM um método de lavra, numa aba clássica sem pesos.
 *
 * Devolve os IDS dos critérios (`rss_ob`, `thickness`, ...), não os rótulos: o
 * rótulo é assunto da tela e sai do i18n (`results.criteria.<id>`), que é onde
 * o radar de breakdown já o busca. Devolver id aqui é o que mantém esta função
 * testável sem i18n.
 *
 * `sheet.criterionKeys` e `row.values` andam juntos posição a posição — é o
 * formato que buildDecisionMatrix produz e que McdmBlock já consome. Os ids são
 * OS MESMOS que o breakdown produzia (`criterionKeys` sai de `Object.keys(
 * breakdown).map(k => k.split("__")[0])`, ver buildSheet), na mesma ordem, o
 * que é o que permitiu trocar a fonte sem reescrever esta comparação: a lista
 * do hover continua saindo na ordem em que o `calculate*` montou os critérios,
 * a mesma do radar de breakdown ao lado.
 *
 * Como cada critério entra uma vez por cálculo, não há id repetido na saída.
 *
 * O `selectionMethodKey` continua sendo parâmetro, e não é lido de `sheet.key`,
 * porque é ele que escolhe o MARCADOR — a pergunta que esta função faz é "qual
 * o veto DESTE método?", e a tela já carrega essa chave (`sm.key`) para o bloco
 * inteiro. Ler do sheet economizaria um argumento e criaria uma segunda fonte
 * para a mesma decisão.
 *
 * @param {{criterionKeys: string[], rows: Array<{code: string, values: Array}>}} sheet
 *        aba de buildDecisionMatrix para este método de seleção (pesos neutros)
 * @param {string} selectionMethodKey   'nicholas' | 'ubc' | 'shb'
 * @param {string} miningCode           código do método de lavra ('OP', 'BC', ...)
 * @returns {string[]} ids dos critérios que eliminam; vazio quando nenhum
 */
export function eliminatingCriteriaFor(sheet, selectionMethodKey, miningCode) {
  const marker = ELIMINATION_SCORE_BY_METHOD[selectionMethodKey];
  if (marker === undefined) return [];

  const criterionKeys = Array.isArray(sheet?.criterionKeys) ? sheet.criterionKeys : [];
  const row = Array.isArray(sheet?.rows)
    ? sheet.rows.find((r) => r?.code === miningCode)
    : undefined;
  if (!row) return [];

  const values = Array.isArray(row.values) ? row.values : [];
  return criterionKeys.filter((_, index) => values[index] === marker);
}
