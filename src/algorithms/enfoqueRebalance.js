// REBALANCEAMENTO DOS PESOS DE GRUPO DO ENFOQUE
//
// Os quatro pesos de grupo do Enfoque precisam somar 1 (ver GROUP_WEIGHT_SUM em
// enfoque.js). Numa UI de quatro sliders independentes isso seria uma regra que
// o usuário quebra a todo momento e alguém precisa validar depois. Aqui o
// invariante é mantido pela PRÓPRIA INTERAÇÃO: mexer num slider redistribui os
// outros três, então nunca existe um instante em que o estado esteja inválido.
// Não é validação — é construção.
//
// DUAS POLÍTICAS, MESMO INVARIANTE. rebalanceGroupWeights preserva a proporção
// entre os três não alterados; equalizeOtherGroups iguala os três. As duas têm
// a mesma assinatura e as mesmas garantias de saída — quem chama escolhe uma e
// não precisa saber mais nada. Ver REBALANCE_MODES.
//
// Arquivo companheiro, e não uma função a mais dentro de enfoque.js, porque o
// que mora aqui é POLÍTICA DE INTERAÇÃO, não o modelo de ponderação. O modelo
// (o que é um grupo, quanto cada critério recebe, o que torna um vetor de pesos
// válido) está em enfoque.js e não muda por causa da tela. Esta é uma das
// muitas formas de produzir um vetor válido; outras telas poderiam usar outra.
//
// Puro: não lê estado global, não toca no DOM, não muta o que recebe.

import { ENFOQUE_GROUP_IDS, GROUP_WEIGHT_SUM } from "./enfoque";

/**
 * Abaixo disto, a soma dos outros três grupos é tratada como zero.
 *
 * Precisa ser um limiar, e não uma comparação com 0, porque a soma chega aqui
 * depois de N rebalanceamentos encadeados: um grupo que o usuário zerou pode
 * carregar um resíduo da ordem de 1e-17 em vez de 0 exato. Escalar os outros
 * por (1 - V) / 1e-17 devolveria pesos absurdos a partir de um estado que, para
 * qualquer efeito prático, era "todos os outros em zero".
 *
 * Muito abaixo de GROUP_WEIGHT_TOLERANCE (1e-6) de propósito: aquela é a
 * tolerância do que ainda conta como soma 1; esta é a fronteira do que ainda
 * conta como zero. Confundir as duas faria um vetor legítimo de pesos pequenos
 * (0.9997 / 0.0001 / 0.0001 / 0.0001) cair no ramo da distribuição igual.
 */
export const REBALANCE_NEAR_ZERO = 1e-12;

/** Limita ao intervalo [0, 1] — o domínio que validateGroupWeights exige. */
const clampToUnit = (value) => Math.min(1, Math.max(0, value));

/**
 * Lê um peso do objeto recebido, tolerando ausência e lixo.
 *
 * Deliberadamente leniente, ao contrário de validateGroupWeights: esta função é
 * o mecanismo de REPARO do vetor de pesos, e recusar entrada imperfeita seria
 * inverter o próprio papel dela. Um estado persistido de uma versão anterior,
 * uma chave faltando, um `undefined` vindo de um render intermediário — tudo
 * isso vira 0 e é redistribuído, em vez de derrubar a tela.
 */
const readWeight = (weights, groupId) => {
  const value = weights?.[groupId];
  return typeof value === "number" && Number.isFinite(value) ? clampToUnit(value) : 0;
};

/**
 * Novo vetor de pesos de grupo depois de o usuário mover UM slider.
 *
 * O grupo alterado recebe exatamente o valor pedido; os outros três são
 * escalados pelo fator (1 - V) / (soma anterior dos outros três), preservando a
 * proporção entre eles. Se a soma anterior dos outros for ~0 não há proporção a
 * preservar — o restante se divide igualmente entre os três.
 *
 * CORREÇÃO DE DRIFT. O último passo soma ao grupo alterado o resíduo que faltar
 * para 1. Sem isso, cada rebalanceamento introduz erro de arredondamento IEEE
 * 754 da ordem de 1e-17, e o resultado de um passo é a entrada do próximo:
 * depois de muitas interações consecutivas o erro acumulado pode ultrapassar
 * GROUP_WEIGHT_TOLERANCE (1e-6) e fazer validateGroupWeights lançar por
 * aritmética, não por erro de uso. O resíduo vai para o grupo alterado — que é
 * o que o usuário está olhando — e não para os outros, que ele acabou de ver se
 * ajustarem sozinhos.
 *
 * O clamp final absorve o caso patológico em que o resíduo empurraria o grupo
 * alterado para fora de [0, 1]. Ele pode deixar a soma a alguns ULPs de 1, o
 * que é irrelevante: são ~1e-16 contra uma tolerância de 1e-6.
 *
 * @param {object|null} currentWeights  pesos atuais { [groupId]: peso }; ver readWeight
 * @param {string}      changedGroupId  grupo que o usuário moveu
 * @param {number}      newValue        novo valor desse grupo, em [0, 1]
 * @returns {object} os quatro pesos novos, somando 1 dentro da precisão de float
 * @throws {RangeError} se o grupo for desconhecido ou newValue estiver fora de [0, 1]
 */
export function rebalanceGroupWeights(currentWeights, changedGroupId, newValue) {
  if (!ENFOQUE_GROUP_IDS.includes(changedGroupId)) {
    throw new RangeError(
      `[MMS] Enfoque: grupo desconhecido no rebalanceamento: ${String(changedGroupId)}. ` +
      `Os grupos válidos são: ${ENFOQUE_GROUP_IDS.join(", ")}.`,
    );
  }
  if (typeof newValue !== "number" || !Number.isFinite(newValue) || newValue < 0 || newValue > 1) {
    throw new RangeError(
      `[MMS] Enfoque: novo peso do grupo "${changedGroupId}" fora de [0, 1] (${String(newValue)})`,
    );
  }

  const others           = ENFOQUE_GROUP_IDS.filter((id) => id !== changedGroupId);
  const previousSum      = others.reduce((acc, id) => acc + readWeight(currentWeights, id), 0);
  const remaining        = GROUP_WEIGHT_SUM - newValue;

  const next = { [changedGroupId]: newValue };
  if (previousSum <= REBALANCE_NEAR_ZERO) {
    // Sem proporção anterior a preservar: divide o restante igualmente.
    const share = remaining / others.length;
    for (const id of others) next[id] = clampToUnit(share);
  } else {
    const factor = remaining / previousSum;
    for (const id of others) next[id] = clampToUnit(readWeight(currentWeights, id) * factor);
  }

  const soma = ENFOQUE_GROUP_IDS.reduce((acc, id) => acc + next[id], 0);
  next[changedGroupId] = clampToUnit(next[changedGroupId] + (GROUP_WEIGHT_SUM - soma));

  return next;
}

/**
 * Os dois modos de rebalanceamento que a tela oferece.
 *
 * Não é a mesma família de WEIGHTING_MODES: aquilo é QUEM decide os pesos
 * (usuário ou dados); isto é COMO os outros três reagem quando o usuário move
 * um slider. Só faz sentido dentro do modo 'enfoque' — em 'entropy' não há
 * slider para mover.
 */
export const REBALANCE_MODES = Object.freeze({
  PROPORTIONAL: "proportional",
  EQUALIZE:     "equalize",
});

/**
 * Novo vetor de pesos IGUALANDO os outros três — a alternativa a
 * rebalanceGroupWeights.
 *
 * O grupo alterado recebe V; os outros três recebem (1 - V) / 3 cada,
 * independentemente do que tinham antes. A repartição anterior entre eles é
 * DESCARTADA de propósito: é justamente isso que distingue este modo do
 * proporcional. Quem põe Geometria em 0.7 e quer os outros três em 0.1 cada
 * não está pedindo que uma proporção seja preservada — está dizendo que os
 * outros três não se distinguem entre si.
 *
 * Mais simples que a proporcional por não precisar do ramo de "soma dos outros
 * ≈ zero" (ver REBALANCE_NEAR_ZERO): aquele ramo existe para decidir o que
 * fazer quando não há proporção a preservar, e aqui nunca há — o resultado é o
 * mesmo com qualquer entrada. Por isso `currentWeights` só é lido para nada:
 * o parâmetro fica na assinatura para as duas funções serem intercambiáveis no
 * ponto de chamada do reducer.
 *
 * Mesma correção de drift e mesmo clamp final da companheira, e pelos mesmos
 * motivos — ver o cabeçalho de rebalanceGroupWeights.
 *
 * @param {object|null} currentWeights  pesos atuais; aceito e ignorado (ver acima)
 * @param {string}      changedGroupId  grupo que o usuário moveu
 * @param {number}      newValue        novo valor desse grupo, em [0, 1]
 * @returns {object} os quatro pesos novos, somando 1 dentro da precisão de float
 * @throws {RangeError} se o grupo for desconhecido ou newValue estiver fora de [0, 1]
 */
export function equalizeOtherGroups(currentWeights, changedGroupId, newValue) {
  if (!ENFOQUE_GROUP_IDS.includes(changedGroupId)) {
    throw new RangeError(
      `[MMS] Enfoque: grupo desconhecido no rebalanceamento: ${String(changedGroupId)}. ` +
      `Os grupos válidos são: ${ENFOQUE_GROUP_IDS.join(", ")}.`,
    );
  }
  if (typeof newValue !== "number" || !Number.isFinite(newValue) || newValue < 0 || newValue > 1) {
    throw new RangeError(
      `[MMS] Enfoque: novo peso do grupo "${changedGroupId}" fora de [0, 1] (${String(newValue)})`,
    );
  }

  const others = ENFOQUE_GROUP_IDS.filter((id) => id !== changedGroupId);
  const share  = (GROUP_WEIGHT_SUM - newValue) / others.length;

  const next = { [changedGroupId]: newValue };
  for (const id of others) next[id] = clampToUnit(share);

  const soma = ENFOQUE_GROUP_IDS.reduce((acc, id) => acc + next[id], 0);
  next[changedGroupId] = clampToUnit(next[changedGroupId] + (GROUP_WEIGHT_SUM - soma));

  return next;
}
