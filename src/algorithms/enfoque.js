// ENFOQUE — PONDERAÇÃO MANUAL POR GRUPO DE CRITÉRIOS
//
// Enfoque é ponderação MANUAL: o usuário distribui peso entre quatro grupos de
// critérios, e o peso de cada grupo se reparte igualmente entre os critérios
// dele. Não confundir com Entropy, que é ponderação AUTOMÁTICA derivada da
// dispersão dos dados — são coisas diferentes, e são mutuamente exclusivas
// (confirmado com o Francisco).
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
// ---------------------------------------------------------------------------
// O MODELO: PESO POR GRUPO, SOMANDO 1
// ---------------------------------------------------------------------------
// Os quatro grupos recebem pesos que somam exatamente 1 (sliders na UI, quando
// ela existir). Dentro de um grupo, o peso se divide IGUALMENTE entre os
// critérios:
//
//     peso(critério) = pesoDoGrupo / quantidadeDeCritériosNoGrupo
//
// Somando sobre os 19 critérios da matriz estendida (13 clássicos + 6 fixos), o
// total volta a ser exatamente 1 — cada grupo devolve o próprio peso inteiro,
// só que repartido. Isso é invariante e está fixado em teste.
//
// SUBSTITUIU o modelo anterior de "boost multiplicativo num único grupo
// escolhido" (um `enfoqueGroupId` e um fator DEFAULT_BOOST = 2). Aquele modelo
// não foi estendido, foi trocado: não dava para expressar quatro intensidades
// simultâneas, e o fator 2 era um valor arbitrário sem fundamentação externa. A
// constante e a pendência que a acompanhava saíram junto com o mecanismo.
//
// ESTRUTURA EXTENSÍVEL: os grupos continuam sendo uma LISTA, e os criterionIds
// de cada um são DERIVADOS das tabelas de descritores — nunca escritos à mão
// aqui. Acrescentar um critério a um grupo é acrescentar a linha na tabela de
// descritores correspondente; este arquivo não muda.

import {
  CRITERION_GROUPS,
  CRITERION_GROUP_LABELS,
  FIXED_CRITERIA_BY_ID,
  criteriaOfGroup,
} from "./mcdmCriteria";
import { CLASSIC_CRITERIA_BY_ID, classicCriteriaOfGroup } from "./classicCriteria";

/**
 * Modos de ponderação. Um único campo de estado, três valores possíveis.
 * 'none' = pesos-base intactos; 'enfoque' = peso por grupo; 'entropy' = futuro.
 */
export const WEIGHTING_MODES = Object.freeze({
  NONE:    "none",
  ENFOQUE: "enfoque",
  ENTROPY: "entropy",
});

/**
 * Tolerância na verificação de que os pesos de grupo somam 1.
 *
 * Existe porque a soma vem de ponto flutuante: 0.1 + 0.2 + 0.3 + 0.4 não dá
 * exatamente 1 em IEEE 754. Exigir igualdade exata rejeitaria entradas
 * legítimas de qualquer UI de slider.
 */
export const GROUP_WEIGHT_SUM = 1;
export const GROUP_WEIGHT_TOLERANCE = 1e-6;

/**
 * Grupo a que um critério pertence, ou undefined se ele não estiver em nenhuma
 * das duas tabelas de descritores.
 *
 * Mesmo padrão de lookup de sheetCriteriaDirections em decisionMatrix.js:
 * procura primeiro entre os critérios fixos, depois entre os clássicos. A
 * diferença é o que acontece no fim — lá um critério não encontrado recebe a
 * direção default (MAX, que é o valor correto para todo critério clássico);
 * aqui não existe grupo default possível, e quem chama trata o undefined
 * lançando. Ver resolveWeights.
 */
export function groupOfCriterion(criterionId) {
  return (FIXED_CRITERIA_BY_ID[criterionId] ?? CLASSIC_CRITERIA_BY_ID[criterionId])?.group;
}

/**
 * Ids dos critérios de um grupo, vindos das DUAS fontes de descritores.
 *
 * Derivado, nunca escrito à mão: a pertinência de cada critério ao seu grupo já
 * está declarada em FIXED_CRITERIA e em CLASSIC_CRITERIA, e repetir a lista
 * aqui criaria duas fontes de verdade que divergiriam na primeira mudança.
 */
function criterionIdsOfGroup(groupId) {
  return [...classicCriteriaOfGroup(groupId), ...criteriaOfGroup(groupId)];
}

/**
 * Os quatro grupos de Enfoque, na ordem em que a UI deve apresentá-los.
 *
 * Note que não há mais campo `boost`: no modelo de peso por grupo, a
 * intensidade não é propriedade do grupo, é entrada do usuário. O que a entrada
 * do grupo carrega é só identidade, rótulo e composição.
 */
export const ENFOQUE_GROUPS = Object.freeze(
  [
    CRITERION_GROUPS.GEOMETRY,
    CRITERION_GROUPS.GEOMECHANICS,
    CRITERION_GROUPS.TECHNICAL,
    CRITERION_GROUPS.ECONOMIC,
  ].map((id) =>
    Object.freeze({
      id,
      label:        CRITERION_GROUP_LABELS[id],
      criterionIds: Object.freeze(criterionIdsOfGroup(id)),
    }),
  ),
);

/** Índice id → grupo. */
export const ENFOQUE_GROUPS_BY_ID = Object.freeze(
  Object.fromEntries(ENFOQUE_GROUPS.map((g) => [g.id, g])),
);

/** Ids dos quatro grupos, na ordem de ENFOQUE_GROUPS. */
export const ENFOQUE_GROUP_IDS = Object.freeze(ENFOQUE_GROUPS.map((g) => g.id));

/** Estado inicial: nenhuma ponderação aplicada. */
export function createWeightingState() {
  return { mode: WEIGHTING_MODES.NONE, groupWeights: null };
}

/**
 * Pesos de grupo uniformes — 1/4 para cada um dos quatro grupos.
 *
 * Ponto de partida natural para a UI, e entrada válida por construção (quatro
 * chaves, soma exata: 0.25 × 4 = 1 sem erro de ponto flutuante).
 *
 * ATENÇÃO: uniforme entre GRUPOS não é uniforme entre CRITÉRIOS. Com 0.25 em
 * cada grupo, cada critério de Economia (2 critérios) pesa 0.125 e cada um de
 * Geomecânica (9 critérios) pesa ≈ 0.0278 — quatro vezes e meia menos. Quem
 * quer critérios uniformes usa o modo 'none', não este helper.
 */
export function equalGroupWeights() {
  return Object.fromEntries(ENFOQUE_GROUP_IDS.map((id) => [id, 1 / ENFOQUE_GROUP_IDS.length]));
}

/**
 * Valida um objeto de pesos por grupo, lançando com a causa nomeada.
 *
 * Quatro checagens, nesta ordem, cada uma com mensagem própria: chave faltando,
 * chave desconhecida, valor fora de [0, 1], soma diferente de 1.
 *
 * NÃO NORMALIZA. Receber pesos que somam 0.9 e dividir tudo por 0.9 devolveria
 * um resultado plausível para uma entrada que o usuário não quis dar — e o
 * único sintoma seria um ranking sutilmente diferente do esperado. Vale a mesma
 * regra da célula vazia no TOPSIS: quem chamou precisa consertar a entrada.
 *
 * @param {object} groupWeights  { [groupId]: peso }, as quatro chaves
 * @throws {RangeError} com a causa nomeada
 */
export function validateGroupWeights(groupWeights) {
  if (!groupWeights || typeof groupWeights !== "object" || Array.isArray(groupWeights)) {
    throw new RangeError(
      `[MMS] Enfoque: groupWeights precisa ser um objeto { grupo: peso } (recebido: ${String(groupWeights)})`,
    );
  }

  const faltando = ENFOQUE_GROUP_IDS.filter((id) => !(id in groupWeights));
  if (faltando.length > 0) {
    throw new RangeError(
      `[MMS] Enfoque: groupWeights sem os grupos: ${faltando.join(", ")}. ` +
      `Os quatro são obrigatórios: ${ENFOQUE_GROUP_IDS.join(", ")}.`,
    );
  }

  // Chave a mais é quase sempre erro de digitação, e sem esta checagem ela
  // simplesmente não faria efeito nenhum — o usuário mexeria num slider que não
  // existe e o ranking não mudaria, sem nada indicando o porquê.
  const desconhecidos = Object.keys(groupWeights).filter((id) => !ENFOQUE_GROUP_IDS.includes(id));
  if (desconhecidos.length > 0) {
    throw new RangeError(
      `[MMS] Enfoque: groupWeights com grupo desconhecido: ${desconhecidos.join(", ")}. ` +
      `Os grupos válidos são: ${ENFOQUE_GROUP_IDS.join(", ")}.`,
    );
  }

  for (const id of ENFOQUE_GROUP_IDS) {
    const peso = groupWeights[id];
    if (typeof peso !== "number" || !Number.isFinite(peso)) {
      throw new RangeError(
        `[MMS] Enfoque: peso do grupo "${id}" não é um número finito (${String(peso)})`,
      );
    }
    if (peso < 0 || peso > 1) {
      throw new RangeError(
        `[MMS] Enfoque: peso do grupo "${id}" fora de [0, 1] (${peso})`,
      );
    }
  }

  const soma = ENFOQUE_GROUP_IDS.reduce((acc, id) => acc + groupWeights[id], 0);
  if (Math.abs(soma - GROUP_WEIGHT_SUM) > GROUP_WEIGHT_TOLERANCE) {
    throw new RangeError(
      `[MMS] Enfoque: os pesos dos grupos precisam somar ${GROUP_WEIGHT_SUM}, mas somam ${soma}. ` +
      `Tolerância: ${GROUP_WEIGHT_TOLERANCE}.`,
    );
  }
}

/**
 * Troca o modo de ponderação, devolvendo um estado novo.
 *
 * Aqui mora a exclusividade: sair do Enfoque limpa os pesos de grupo, e
 * qualquer modo diferente de 'enfoque' não carrega configuração de Enfoque
 * junto. Não há caminho que deixe dois modos ativos.
 *
 * @param {object} state    estado atual (não é mutado)
 * @param {string} mode     um de WEIGHTING_MODES
 * @param {{groupWeights?: object}} [options]  obrigatório groupWeights quando mode = 'enfoque'
 */
export function setWeightingMode(state, mode, options = {}) {
  if (!Object.values(WEIGHTING_MODES).includes(mode)) {
    throw new RangeError(`[MMS] modo de ponderação desconhecido: ${String(mode)}`);
  }

  if (mode !== WEIGHTING_MODES.ENFOQUE) {
    return { ...state, mode, groupWeights: null };
  }

  const { groupWeights } = options;
  validateGroupWeights(groupWeights);
  // Cópia rasa: o estado não pode compartilhar referência com o objeto de quem
  // chamou, senão uma mutação lá fora mudaria a ponderação já aplicada aqui.
  return { ...state, mode, groupWeights: { ...groupWeights } };
}

/**
 * Aplica os pesos de grupo sobre uma lista de critérios.
 *
 * peso(critério) = pesoDoGrupo / quantidadeDeCritériosNoGrupo, onde a
 * quantidade é o TAMANHO DECLARADO do grupo (o que está nas tabelas de
 * descritores), e não quantos critérios daquele grupo aparecem em
 * `criterionIds`.
 *
 * A distinção importa num formulário parcialmente preenchido: com menos colunas
 * clássicas, a soma dos pesos devolvidos fica abaixo de 1. Isso é correto e
 * proposital — o peso do grupo é uma declaração sobre o grupo inteiro, e não
 * deve inflar porque metade dos critérios não foi preenchida. O TOPSIS
 * normaliza os pesos antes de usar, então a escala absoluta não afeta ranking;
 * o que afetaria, e seria errado, é a proporção ENTRE grupos mudar sozinha.
 *
 * @param {string[]} criterionIds  ids na ordem das colunas da matriz
 * @param {object}   groupWeights  { [groupId]: peso }, validado antes
 * @returns {number[]} pesos na mesma ordem de criterionIds
 * @throws {RangeError} se algum critério não pertencer a nenhum grupo
 */
export function applyEnfoque(criterionIds, groupWeights) {
  validateGroupWeights(groupWeights);

  return criterionIds.map((id) => {
    const groupId = groupOfCriterion(id);

    // ESTE É O PONTO CRÍTICO DO MÓDULO. Um critério sem grupo não pode receber
    // peso zero nem um peso default: nos dois casos ele sairia da conta sem
    // nenhum sinal, e "critério some em silêncio" já foi bug real neste projeto
    // duas vezes (espessura "Muito estreito" ausente da tabela do Nicholas, e
    // RSS lido de um campo de outra escala — ver a instrumentação de
    // warnCriterionDropped em algorithms.js). Aqui falha alto, nomeando o id.
    if (!groupId) {
      throw new RangeError(
        `[MMS] Enfoque: critério "${id}" não pertence a nenhum grupo. ` +
        `Todo critério da matriz precisa estar em FIXED_CRITERIA (mcdmCriteria.js) ` +
        `ou em CLASSIC_CRITERIA (classicCriteria.js).`,
      );
    }

    const tamanho = ENFOQUE_GROUPS_BY_ID[groupId].criterionIds.length;
    return groupWeights[groupId] / tamanho;
  });
}

/**
 * Resolve os pesos finais a partir do estado de ponderação.
 *
 * Ponto único por onde a decisão passa — é o que garante que Enfoque e Entropy
 * nunca rodem juntos, independente de quem chame.
 *
 * @param {object}   state         estado de createWeightingState/setWeightingMode
 * @param {string[]} criterionIds  ids na ordem das colunas
 * @param {number[]} [baseWeights] pesos-base; SÓ vale no modo 'none' (ver abaixo)
 */
export function resolveWeights(state, criterionIds, baseWeights) {
  switch (state.mode) {
    case WEIGHTING_MODES.NONE:
      return baseWeights ? [...baseWeights] : criterionIds.map(() => 1);

    case WEIGHTING_MODES.ENFOQUE:
      // No modelo de peso por grupo os pesos são ABSOLUTOS: a fórmula determina
      // o vetor inteiro, e não há sobre o que um peso-base multiplicar. No
      // modelo antigo, de boost, `baseWeights` fazia sentido — era o que o
      // boost multiplicava. Aceitar e ignorar seria devolver, em silêncio, um
      // resultado que desconsidera o que o chamador pediu.
      if (baseWeights) {
        throw new RangeError(
          "[MMS] Enfoque: baseWeights não se aplica ao modo 'enfoque' — os pesos por grupo " +
          "já determinam o vetor inteiro. Use baseWeights apenas no modo 'none'.",
        );
      }
      return applyEnfoque(criterionIds, state.groupWeights);

    case WEIGHTING_MODES.ENTROPY:
      // Fora de escopo por enquanto. Lançar é melhor que devolver os pesos-base
      // em silêncio: o usuário pediu Entropy e receberia um resultado sem
      // Entropy nenhum, sem nada indicando isso.
      throw new Error("[MMS] ponderação por Entropy ainda não implementada");

    default:
      throw new RangeError(`[MMS] modo de ponderação desconhecido: ${String(state.mode)}`);
  }
}
