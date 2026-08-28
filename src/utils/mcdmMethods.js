// MÉTODOS DE SELEÇÃO DISPONÍVEIS PARA O MCDM — interseção testável
//
// Duas perguntas que a aba "Decisão multicritério" faz o tempo todo e que não
// deveriam morar dentro de um componente:
//
//   1. quais dos métodos ATIVOS na tela o pipeline MCDM aceita?
//   2. dada uma escolha do usuário, qual método a tela deve de fato usar?
//
// Vivem aqui pelo mesmo motivo que deriveMcdmRanking vive fora do componente:
// o projeto não tem infraestrutura de teste de componente React (vite.config.js
// roda em `environment: 'node'`, sem Testing Library), então uma regra só é
// coberta se for função comum.
//
// Puro: não lê estado global, não toca no DOM, não muta o que recebe.

import { MCDM_SUPPORTED_METHODS } from "../algorithms/mcdmPipeline";

/**
 * Os métodos ativos que o pipeline MCDM aceita, na ordem em que chegaram.
 *
 * A ORDEM É A DE ENTRADA, e não a de MCDM_SUPPORTED_METHODS, porque quem chama
 * passa `activeMethods` — já filtrado e já na ordem em que as pills aparecem em
 * /statistics. Reordenar aqui faria o seletor da aba MCDM listar os métodos numa
 * ordem diferente da fileira de pills logo acima, sem nenhum ganho.
 *
 * Recebe os OBJETOS de método ({ key, label, color }), não as chaves, para que o
 * seletor de pills possa renderizar direto o que sai daqui — sem uma segunda
 * volta para reencontrar rótulo e cor a partir da chave.
 *
 * @param {Array<{key: string}>} activeMethods  métodos ativos na tela
 * @returns {Array<{key: string}>} subconjunto suportado, mesma ordem
 */
export function availableMcdmMethods(activeMethods) {
  const list = Array.isArray(activeMethods) ? activeMethods : [];
  return list.filter((m) => MCDM_SUPPORTED_METHODS.includes(m?.key));
}

/**
 * Clampa a escolha do usuário no que ainda está disponível.
 *
 * MESMO PADRÃO DO `safeView` DE Statistics.jsx, e pelo mesmo motivo: desligar a
 * pill do método selecionado (lá em /inputs ou na própria fileira de filtros)
 * deixaria a aba presa num método que não está mais ativo. Corrigir por efeito
 * colateral — um useEffect que conserta o useState depois do render — mostraria
 * um quadro intermediário com o método errado. Clampar na leitura não mostra.
 *
 * Devolve `null` quando não há método disponível nenhum. Nesse caso a aba MCDM
 * nem aparece (ver showMcdmTab em Statistics.jsx), então o `null` não chega a
 * virar ranking — mas é um valor honesto a devolver, e não uma chave inventada.
 *
 * @param {string|null} selected           chave escolhida pelo usuário
 * @param {Array<{key: string}>} available saída de availableMcdmMethods
 * @returns {string|null} a chave a usar de fato
 */
export function safeMcdmMethod(selected, available) {
  const list = Array.isArray(available) ? available : [];
  if (list.some((m) => m?.key === selected)) return selected;
  return list[0]?.key ?? null;
}
