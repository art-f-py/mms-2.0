// LAYOUT DA MATRIZ DE DECISÃO — ORDENAÇÃO DAS COLUNAS POR GRUPO
//
// A aba que o pipeline devolve traz os critérios numa ordem que serve ao
// cálculo, não à leitura: os 13 clássicos primeiro (na ordem do formulário) e
// os 6 fixos depois, o que deixa Técnico-Operacional e Economia misturados no
// fim. Na tela eles precisam sair agrupados, na ordem canônica de
// ENFOQUE_GROUP_IDS — a mesma dos sliders e da barra de proporção, para que a
// cor de um grupo signifique a mesma coisa nos três lugares.
//
// Aqui só se reordena e se agrupa. Nenhum valor, peso ou posição de ranking é
// tocado: o `index` original viaja junto em cada coluna, e é por ele que a tela
// vai buscar peso e células. Reordenar sem carregar o índice seria trocar os
// dados de coluna em silêncio.
//
// Extraído do componente porque é a única parte da matriz que tem lógica de
// verdade — o resto é JSX, que este projeto não tem como testar (ver o
// comentário no topo de mcdmRanking.js). Puro: não lê estado global, não toca
// no DOM, não muta o que recebe.

import { ENFOQUE_GROUP_IDS, groupOfCriterion } from "../algorithms/enfoque";

/**
 * Colunas da matriz, reordenadas e agrupadas para exibição.
 *
 * CRITÉRIO SEM GRUPO NÃO É DESCARTADO. Ele vai para um bloco final com
 * `groupId: null`, em vez de sumir da tabela. Hoje isso não deveria acontecer —
 * resolveWeights (enfoque.js) já teria lançado antes de o pipeline chegar à
 * tela se algum critério não pertencesse a grupo nenhum. Mas o custo de estar
 * errado nas duas direções não é o mesmo: uma coluna a mais sem cor de grupo é
 * visível e alguém pergunta; uma coluna que desaparece de uma matriz de 19 é
 * exatamente o tipo de coisa que ninguém percebe.
 *
 * @param {string[]} criterionIds  ids na ordem das colunas da aba
 * @returns {{
 *   columns: Array<{index: number, id: string, groupId: string|null}>,
 *   groups:  Array<{groupId: string|null, span: number}>
 * }}
 *   `columns` na ordem de exibição, cada uma com o `index` que ela ocupa na aba
 *   original. `groups` acompanha, na mesma ordem, com quantas colunas cada
 *   grupo ocupa — é o colSpan da linha de cabeçalho dos grupos. Grupo sem
 *   nenhum critério não entra (colSpan zero não existe).
 */
export function buildMatrixColumns(criterionIds = []) {
  // Map preserva a ordem de inserção, então percorrer os baldes no fim devolve
  // os grupos na ordem de ENFOQUE_GROUP_IDS sem precisar reordenar de novo.
  const baldes    = new Map(ENFOQUE_GROUP_IDS.map((id) => [id, []]));
  const semGrupo  = [];

  criterionIds.forEach((id, index) => {
    const groupId = groupOfCriterion(id);
    const balde   = baldes.get(groupId);
    if (balde) balde.push({ index, id, groupId });
    else       semGrupo.push({ index, id, groupId: null });
  });

  const columns = [];
  const groups  = [];

  for (const [groupId, itens] of baldes) {
    if (itens.length === 0) continue;
    groups.push({ groupId, span: itens.length });
    columns.push(...itens);
  }

  if (semGrupo.length > 0) {
    groups.push({ groupId: null, span: semGrupo.length });
    columns.push(...semGrupo);
  }

  return { columns, groups };
}
