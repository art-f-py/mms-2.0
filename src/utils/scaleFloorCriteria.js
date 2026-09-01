// CRITÉRIOS NO PISO DA ESCALA, NA MATRIZ QUE O TOPSIS LEU
//
// Responde, para cada método de lavra: em quais critérios CLÁSSICOS ele ficou
// com o valor mínimo da escala convertida (0)?
//
// ARQUIVO PRÓPRIO, E NÃO UM RAMO A MAIS DENTRO DE eliminationMarker.js. As duas
// funções respondem perguntas parecidas e leem FONTES DIFERENTES, e é a fonte
// que manda:
//
//   eliminationMarker.js  lê `result.breakdown` — os scores CRUS das tabelas, já
//                         multiplicados pelo peso por critério do Complementar.
//                         Procura o marcador de eliminação da publicação (−49
//                         no Nicholas e no UBC, −50 no SH&B), que é um número
//                         diferente por método de seleção.
//
//   este módulo           lê `sheet.rows[].values` — a matriz DEPOIS da conversão
//                         de escala, que buildDecisionMatrix monta com pesos
//                         neutros (ver `neutralWeights()` lá). Procura o 0, que
//                         é o mesmo número nos três métodos porque a conversão
//                         já uniformizou as três escalas.
//
// Mesmo espírito de shbScale.js não importar a tabela de ubcScale.js apesar de
// as duas coincidirem hoje: formas parecidas, donos diferentes. Fundir os dois
// faria uma mudança na escala de conversão mexer na marcação da aba clássica,
// que não depende de escala nenhuma.
//
// POR QUE O 0 IDENTIFICA SEM AMBIGUIDADE. Verificado célula a célula nas três
// tabelas reais (1370 células, zero exceções): o marcador de eliminação de cada
// método é o ÚNICO valor de entrada que converte para 0, e a contagem de
// marcadores bate exatamente com a contagem de zeros na saída. Todo o resto
// pousa em 1 ou acima — inclusive os que parecem candidatos: o score 0 puro vira
// 1 nos três, e no SH&B as penalidades −25, −10 e o artefato −7 também viram 1.
// Ver os cabeçalhos de saatyScale.js, ubcScale.js e shbScale.js.
//
// SÓ AS COLUNAS CLÁSSICAS. Os seis critérios fixos do Francisco atravessam o
// pipeline SEM conversão de escala (ver convertClassicColumnsToSaaty em
// mcdmPipeline.js), então um 0 numa coluna dessas não significaria piso de
// escala nenhum — significaria o score 0 da tabela do Francisco, que é um valor
// legítimo. Nenhuma das seis tem zero hoje, mas isso é propriedade do DADO
// ATUAL e não uma garantia declarada em lugar nenhum: o filtro é ativo, e não
// uma coincidência em que este módulo confia.
//
// O QUE ISTO **NÃO** SIGNIFICA. Piso de escala não é exclusão. O TOPSIS ranqueia
// o método normalmente com um 0 numa coluna — 0 é o valor mais baixo da escala,
// não uma retirada da matriz. É a diferença de sentido em relação à aba
// clássica, onde o marcador é um veto da publicação, e é por isso que o texto
// que a tela mostra precisa dizer que o método continua ranqueado. Quem for
// mexer no texto do hover, esta é a razão de ele ser diferente do outro.
//
// Puro: não lê estado global, não toca no DOM, não muta o que recebe.

import { FIXED_CRITERIA_BY_ID } from "../algorithms/mcdmCriteria";

/**
 * O valor mínimo da escala convertida — o que as três conversões devolvem para
 * o marcador de eliminação do método correspondente.
 */
export const SCALE_FLOOR_VALUE = 0;

/**
 * True se a coluna é um dos seis critérios fixos do Francisco.
 *
 * Consulta de PERTINÊNCIA no índice, não uma varredura da lista de fixos: quem
 * dita o que existe é `sheet.criterionKeys`, e os fixos entram aqui só para
 * serem descartados. Mesmo idioma de isFixedCriterion em mcdmPipeline.js e de
 * criterionLabel em McdmBlock.jsx — três lugares perguntando a mesma coisa ao
 * mesmo índice.
 */
const isFixedCriterion = (criterionId) => criterionId in FIXED_CRITERIA_BY_ID;

/**
 * Critérios clássicos no piso da escala, por método de lavra.
 *
 * Devolve um Map porque o consumidor é um JOIN: o painel de ranking percorre
 * `ranking[]` (ordenado por colocação) e precisa achar, por `entry.code`, a
 * lista daquele método. Um Map resolve isso em O(1) por cartão, sem varrer
 * `sheet.rows` dez vezes.
 *
 * TODO método de lavra da aba entra no Map, inclusive os sem nenhum piso — com
 * lista vazia. A tela pergunta pelo código e recebe um array; um `undefined`
 * para os métodos limpos obrigaria cada chamada a se defender do caso comum.
 *
 * Devolve os IDS dos critérios, não os rótulos: o rótulo é assunto da tela e sai
 * do i18n (`results.criteria.<id>`), que é a mesma resolução que o cabeçalho da
 * matriz de decisão usa para as colunas clássicas. Devolver id aqui é o que
 * mantém esta função testável sem i18n — mesma decisão de eliminationMarker.js.
 *
 * A ordem dentro de cada lista é a das colunas da aba, que é a ordem em que o
 * método montou os critérios. É a mesma sequência da matriz de decisão logo
 * abaixo, então a lista do hover e a tabela se leem na mesma direção.
 *
 * @param {{criterionKeys: string[], rows: Array<{code: string, values: Array}>}} sheet
 *        a aba JÁ CONVERTIDA que o pipeline devolve em `result.sheet`
 * @returns {Map<string, string[]>} código do método de lavra -> ids no piso
 */
export function floorCriteriaBySheet(sheet) {
  const criterionKeys = Array.isArray(sheet?.criterionKeys) ? sheet.criterionKeys : [];
  const rows          = Array.isArray(sheet?.rows) ? sheet.rows : [];

  // As colunas a olhar são decididas UMA VEZ, fora do laço das linhas: a
  // classificação depende só do id da coluna, e é a mesma para os dez métodos.
  const classicIndexes = criterionKeys
    .map((id, index) => ({ id, index }))
    .filter(({ id }) => !isFixedCriterion(id));

  return new Map(
    rows.map((row) => {
      const values = Array.isArray(row?.values) ? row.values : [];
      return [
        row?.code,
        classicIndexes
          .filter(({ index }) => values[index] === SCALE_FLOOR_VALUE)
          .map(({ id }) => id),
      ];
    }),
  );
}
