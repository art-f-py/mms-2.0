// ENFOQUE — PONDERAÇÃO MANUAL POR GRUPO DE CRITÉRIOS
//
// Enfoque é ponderação MANUAL: o usuário escolhe um grupo e os critérios desse
// grupo passam a pesar mais que os demais. Não confundir com Entropy, que é
// ponderação AUTOMÁTICA derivada da dispersão dos dados — são coisas
// diferentes, e são mutuamente exclusivas (confirmado com o Francisco).
//
// A exclusividade está garantida por construção: o modo de ponderação é UM
// campo com três estados possíveis, não dois toggles independentes que poderiam
// ficar ligados ao mesmo tempo. É o mesmo princípio do modo dual do Nicholas
// (presets de domínio OU individualização por critério, nunca os dois).
//
// O motor de Entropy NÃO está implementado — o modo existe aqui só para que a
// exclusividade já esteja estruturada quando ele chegar. Pedir 'entropy' agora
// lança.
//
// ESTRUTURA EXTENSÍVEL: os grupos são uma LISTA, não um booleano. A visão final
// tem quatro (Técnico, Econômico, Geométrico-domínio, Geomecânico-domínio) e
// esta primeira implementação cobre os dois primeiros. Acrescentar os outros
// dois é acrescentar entrada em ENFOQUE_GROUPS — nada aqui precisa mudar.

import { CRITERION_GROUPS, criteriaOfGroup } from "./mcdmCriteria";

/**
 * Modos de ponderação. Um único campo de estado, três valores possíveis.
 * 'none' = pesos-base intactos; 'enfoque' = boost manual; 'entropy' = futuro.
 */
export const WEIGHTING_MODES = Object.freeze({
  NONE:    "none",
  ENFOQUE: "enfoque",
  ENTROPY: "entropy",
});

/**
 * Fator aplicado ao peso dos critérios do grupo enfocado, quando o grupo não
 * define o seu.
 *
 * !!! VALOR ARBITRÁRIO DE PARTIDA — SEM FUNDAMENTAÇÃO EXTERNA !!!
 *
 * O 2 não veio do Francisco, não veio da bibliografia de MCDM e não foi
 * calibrado contra nenhum estudo de caso. É "o dobro", a leitura mais óbvia de
 * "este grupo pesa mais que os outros", escolhida para o modo Enfoque existir
 * com um número concreto enquanto a intensidade certa não é decidida. Qualquer
 * afirmação mais forte do que isso seria invenção.
 *
 * O que se sabe sobre o efeito dele, medido e fixado em teste
 * (mcdmPipeline.test.js): com 2, o Enfoque técnico e o econômico produzem
 * rankings diferentes entre si e diferentes do modo 'none' no cenário completo
 * do Nicholas. Ou seja, o valor é suficiente para o modo ter efeito visível —
 * o que ele NÃO é é justificado como a intensidade correta.
 *
 * A PENDÊNCIA REAL DO MÓDULO É ESTA CONSTANTE, e não o 0.5 do empate
 * degenerado do TOPSIS (esse é matematicamente forçado; ver
 * DEGENERATE_CLOSENESS em topsis.js). O boost é um parâmetro livre: mudá-lo
 * muda ranking. Vale confirmar com o Francisco antes de produção — inclusive
 * se o fator deve ser o mesmo para todos os grupos, já que a estrutura
 * (`boost` por grupo em ENFOQUE_GROUPS) já permite um valor por grupo.
 */
export const DEFAULT_BOOST = 2;

/**
 * Grupos de Enfoque disponíveis.
 *
 * `criterionIds` é derivado de FIXED_CRITERIA para os dois grupos de hoje — a
 * pertinência de cada critério ao seu grupo já está declarada lá, e duplicar a
 * lista aqui criaria duas fontes de verdade que divergiriam na primeira
 * mudança. Os grupos de domínio que entram depois vão listar critérios dos
 * métodos clássicos, que não vivem em FIXED_CRITERIA; o formato da entrada
 * suporta os dois casos sem alteração.
 */
export const ENFOQUE_GROUPS = Object.freeze([
  Object.freeze({
    id:           CRITERION_GROUPS.TECHNICAL,
    label:        "Technical",
    criterionIds: Object.freeze(criteriaOfGroup(CRITERION_GROUPS.TECHNICAL)),
    boost:        DEFAULT_BOOST,
  }),
  Object.freeze({
    id:           CRITERION_GROUPS.ECONOMIC,
    label:        "Economic",
    criterionIds: Object.freeze(criteriaOfGroup(CRITERION_GROUPS.ECONOMIC)),
    boost:        DEFAULT_BOOST,
  }),
  // A seguir, quando os critérios de domínio forem mapeados:
  // { id: "geometricDomain",   label: "Geometric — domain",   criterionIds: [...], boost: DEFAULT_BOOST },
  // { id: "geomechanicDomain", label: "Geomechanic — domain", criterionIds: [...], boost: DEFAULT_BOOST },
]);

/** Índice id → grupo. */
export const ENFOQUE_GROUPS_BY_ID = Object.freeze(
  Object.fromEntries(ENFOQUE_GROUPS.map((g) => [g.id, g])),
);

/** Estado inicial: nenhuma ponderação aplicada. */
export function createWeightingState() {
  return { mode: WEIGHTING_MODES.NONE, enfoqueGroupId: null };
}

/**
 * Troca o modo de ponderação, devolvendo um estado novo.
 *
 * Aqui mora a exclusividade: sair do Enfoque limpa o grupo selecionado, e
 * qualquer modo diferente de 'enfoque' não carrega configuração de Enfoque
 * junto. Não há caminho que deixe dois modos ativos.
 *
 * @param {object} state    estado atual (não é mutado)
 * @param {string} mode     um de WEIGHTING_MODES
 * @param {{groupId?: string}} [options]  obrigatório groupId quando mode = 'enfoque'
 */
export function setWeightingMode(state, mode, options = {}) {
  if (!Object.values(WEIGHTING_MODES).includes(mode)) {
    throw new RangeError(`[MMS] modo de ponderação desconhecido: ${String(mode)}`);
  }

  if (mode !== WEIGHTING_MODES.ENFOQUE) {
    return { ...state, mode, enfoqueGroupId: null };
  }

  const { groupId } = options;
  if (!(groupId in ENFOQUE_GROUPS_BY_ID)) {
    throw new RangeError(`[MMS] grupo de Enfoque desconhecido: ${String(groupId)}`);
  }
  return { ...state, mode, enfoqueGroupId: groupId };
}

/**
 * Aplica o boost de um grupo sobre os pesos-base.
 *
 * Critério pertencente ao grupo é multiplicado pelo boost; os demais ficam
 * como estão. O resultado NÃO é normalizado — quem consome (o TOPSIS) já
 * normaliza, e normalizar duas vezes só esconderia a intenção do boost.
 *
 * @param {string[]} criterionIds  ids na ordem das colunas da matriz
 * @param {string}   groupId       grupo enfocado
 * @param {number[]} [baseWeights] pesos antes do boost; default = 1 para cada
 * @returns {number[]} pesos na mesma ordem de criterionIds
 */
export function applyEnfoque(criterionIds, groupId, baseWeights) {
  const group = ENFOQUE_GROUPS_BY_ID[groupId];
  if (!group) throw new RangeError(`[MMS] grupo de Enfoque desconhecido: ${String(groupId)}`);

  const base = baseWeights ?? criterionIds.map(() => 1);
  if (base.length !== criterionIds.length) {
    throw new RangeError(
      `[MMS] applyEnfoque: ${base.length} pesos para ${criterionIds.length} critérios`,
    );
  }

  const boosted = new Set(group.criterionIds);
  return criterionIds.map((id, i) => (boosted.has(id) ? base[i] * group.boost : base[i]));
}

/**
 * Resolve os pesos finais a partir do estado de ponderação.
 *
 * Ponto único por onde a decisão passa — é o que garante que Enfoque e Entropy
 * nunca rodem juntos, independente de quem chame.
 *
 * @param {object}   state         estado de createWeightingState/setWeightingMode
 * @param {string[]} criterionIds  ids na ordem das colunas
 * @param {number[]} [baseWeights] pesos antes de qualquer ponderação
 */
export function resolveWeights(state, criterionIds, baseWeights) {
  const base = baseWeights ?? criterionIds.map(() => 1);

  switch (state.mode) {
    case WEIGHTING_MODES.NONE:
      return [...base];

    case WEIGHTING_MODES.ENFOQUE:
      return applyEnfoque(criterionIds, state.enfoqueGroupId, base);

    case WEIGHTING_MODES.ENTROPY:
      // Fora de escopo por enquanto. Lançar é melhor que devolver os pesos-base
      // em silêncio: o usuário pediu Entropy e receberia um resultado sem
      // Entropy nenhum, sem nada indicando isso.
      throw new Error("[MMS] ponderação por Entropy ainda não implementada");

    default:
      throw new RangeError(`[MMS] modo de ponderação desconhecido: ${String(state.mode)}`);
  }
}
