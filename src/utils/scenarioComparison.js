// COMPARAÇÃO DE CENÁRIOS — CENÁRIOS SALVOS -> ESTRUTURA DE TABELA
//
// Recebe a lista de cenários (cada um só {id, name, groupWeights}), o formData
// ATUAL e o método de seleção em foco, e devolve a tabela pronta para a tela:
// uma linha por método de lavra, uma coluna por cenário, e em cada célula a
// colocação daquele método sob aqueles pesos.
//
// O CENÁRIO É METHOD-AGNÓSTICO — guarda só {id, name, groupWeights}, sem
// nenhuma marca de qual método estava na tela quando foi salvo. É de propósito:
// uma repartição de peso do Enfoque ("70% em Geometria") é uma POSTURA DE
// DECISÃO, não um resultado, e faz o mesmo sentido no Nicholas e no UBC.
// Reaplicá-la contra o método atual é o que deixa o usuário comparar as mesmas
// posturas de um método para o outro trocando a pill, em vez de manter duas
// listas paralelas de cenários que diriam a mesma coisa.
//
// RECALCULA, NÃO LÊ CACHE. Uma chamada a deriveMcdmRanking por cenário, sempre
// contra o formData do momento. É o que faz a comparação acompanhar o
// formulário: corrigir um RMR na etapa de geotecnia muda todas as colunas de
// uma vez, porque nenhuma delas guardava ranking. O custo é N pipelines TOPSIS
// por render — com a dezena de cenários que esta tela comporta, é ruído perto
// do que a própria matriz de decisão já faz, e o componente memoiza.
//
// A ORDEM DAS LINHAS É METHODS, A CANÔNICA — não a colocação de nenhum cenário.
// Escolher um cenário para ordenar seria eleger uma coluna como a "certa", e a
// tabela existe justamente para não ter uma; e ordenar por qualquer uma delas
// faria as linhas dançarem ao salvar ou remover um cenário, quando o que se
// quer é seguir um método com o olho ao longo das colunas. Mesma decisão (e
// mesmo motivo) da matriz de decisão em McdmBlock.
//
// A ORDEM DAS COLUNAS É A DE INSERÇÃO — a ordem em que o usuário salvou. Não é
// ordenada por nome nem por desempenho, pelo mesmo motivo: a coluna que o
// usuário acabou de acrescentar deve aparecer onde ele espera, no fim.
//
// Puro: não lê estado global, não toca no DOM, não muta o que recebe.

import { METHODS } from "../algorithms/ubcWeights";
import { deriveMcdmRanking, MCDM_STATUS } from "./mcdmRanking";
import { uiMethodLabel } from "./methodLabel";
import { rankToColor } from "./rankColor";

/**
 * Tabela de comparação de cenários.
 *
 * INDISPONIBILIDADE É DA TABELA INTEIRA, NUNCA DE UMA COLUNA. O que torna o
 * ranking indisponível (formulário incompleto, método não marcado) depende só do
 * formData e do método, os mesmos para todos os cenários — então ou todas as colunas
 * teriam ranking, ou nenhuma tem. Marcar coluna a coluna sugeriria que um
 * cenário pode estar indisponível e o vizinho não, o que não existe. Nesse caso
 * `rows` volta VAZIA: não há colocação nenhuma a mostrar, e devolver dez linhas
 * de células vazias convidaria a tela a desenhar uma grade que não diz nada.
 *
 * A COR NÃO É CALCULADA AQUI. `rankToColor` (utilitário próprio, já testado) é
 * a fonte única do gradiente; esta função só a chama com a colocação e o total
 * de linhas. Reimplementar a interpolação aqui criaria dois gradientes para
 * manter em sincronia.
 *
 * @param {Array<{id: string, name: string, groupWeights: object}>} scenarios
 *        cenários salvos, na ordem em que foram acrescentados
 * @param {object} formData  estado do formulário (só leitura)
 * @param {string} method    chave do método de seleção contra o qual reaplicar
 *                           os cenários ('nicholas', 'ubc')
 * @returns {{
 *   status: "ok"|"unavailable",
 *   scenarios: Array<{id: string, name: string}>,
 *   rows: Array<{
 *     code: string,
 *     label: string,
 *     cells: Array<{scenarioId: string, rank: number, color: string}>
 *   }>
 * }}
 *   `scenarios` são os cabeçalhos de coluna (só o que a tela precisa deles — os
 *   pesos não vão junto). Em cada linha, `cells` acompanha `scenarios` posição a
 *   posição.
 */
export function buildScenarioComparisonTable(scenarios, formData, method) {
  const list    = Array.isArray(scenarios) ? scenarios : [];
  const columns = list.map(({ id, name }) => ({ id, name }));

  // As linhas saem de METHODS, e não de `sheet.rows`, para que existirem
  // dependa apenas da constante — sem nenhum cenário salvo não há pipeline a
  // rodar, e mesmo assim a tabela sabe quais são suas linhas.
  const rows = METHODS.map((code) => ({ code, label: uiMethodLabel(code), cells: [] }));

  // Nenhum cenário: nada a calcular, e zero chamadas ao pipeline. A tela mostra
  // o estado vazio a partir de `scenarios.length`, não daqui.
  if (columns.length === 0) {
    return { status: MCDM_STATUS.OK, scenarios: columns, rows };
  }

  const porCodigo = new Map(rows.map((row) => [row.code, row]));

  for (const scenario of list) {
    // Sem `mode`: o cenário É uma repartição do Enfoque, então o default da
    // função (enfoque) é o modo certo por definição do modelo de cenário.
    const derived = deriveMcdmRanking(formData, scenario.groupWeights, { method });

    // O primeiro "indisponível" encerra: os demais cenários dariam o mesmo
    // veredito, e rodar o pipeline para cada um deles só para confirmar seria
    // trabalho jogado fora.
    if (derived.status !== MCDM_STATUS.OK) {
      return { status: MCDM_STATUS.UNAVAILABLE, scenarios: columns, rows: [] };
    }

    for (const entry of derived.result.ranking) {
      const row = porCodigo.get(entry.code);
      // Código de método fora de METHODS não deveria existir — o pipeline
      // ranqueia exatamente as linhas da aba, que vêm de METHODS. Se aparecer,
      // é ignorado em vez de criar uma linha órfã fora da ordem canônica.
      if (!row) continue;
      row.cells.push({
        scenarioId: scenario.id,
        rank:       entry.rank,
        color:      rankToColor(entry.rank, rows.length),
      });
    }
  }

  return { status: MCDM_STATUS.OK, scenarios: columns, rows };
}
