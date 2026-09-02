// COMPARAÇÃO DE CENÁRIOS — CENÁRIOS SALVOS -> ESTRUTURA DE TABELA
//
// Recebe a lista de cenários (cada um {id, name, method, mode, groupWeights}) e
// o formData ATUAL, e devolve a tabela pronta para a tela: uma linha por método
// de lavra, uma coluna por cenário, e em cada célula a colocação daquele método
// sob aquela configuração de ponderação.
//
// CADA CENÁRIO CARREGA O PRÓPRIO MÉTODO E O PRÓPRIO MODO, e é recalculado com
// eles — nunca com o método selecionado na tela. Era o contrário: o cenário
// guardava só a repartição de pesos e era reaplicado contra o método em foco,
// pela ideia de que uma repartição ("70% em Geometria") é uma POSTURA DE DECISÃO
// que faz o mesmo sentido em qualquer método. A ideia não estava errada, mas
// custava caro: com todas as colunas presas ao mesmo método, a tabela nunca
// respondia "o Nicholas e o UBC concordam?", que é a comparação mais útil que
// alguém faria aqui. Agora uma coluna pode ser "Nicholas · Enfoque" e a vizinha
// "UBC · Entropy", lado a lado, sobre os mesmos dados.
//
// Por isso esta função NÃO recebe mais um `method`: não existe mais um método da
// tabela. Quem quiser a comparação method-agnóstica de antes salva o mesmo
// cenário em cada método — que é, aliás, exatamente o que a tela não permitia
// fazer antes.
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
 * INDISPONIBILIDADE É POR COLUNA. Era da tabela inteira, com o argumento de que
 * o que torna um ranking indisponível — formulário incompleto, método não
 * marcado — dependia só do formData e do método, os mesmos para todos os
 * cenários. Isso deixou de valer no momento em que cada cenário passou a trazer
 * o próprio método: a exigência de completude VARIA por método (o SH&B precisa
 * do valor do minério, que os outros dois não pedem — ver
 * REQUIRED_STEPS_BY_METHOD em mcdmRanking.js), e um método não marcado no
 * formulário derruba a coluna dele e só ela. Derrubar a tabela inteira por causa
 * de um cenário incompleto apagaria colunas perfeitamente calculáveis.
 *
 * Coluna indisponível vira `status: 'unavailable'` no cabeçalho E uma célula
 * `rank: null` em cada linha. As células continuam acompanhando `scenarios`
 * posição a posição — é isso que permite à tela desenhar a grade sem ter de
 * casar ids.
 *
 * O `status` DO TOPO SOBREVIVE, com significado estreito: 'unavailable' só
 * quando NENHUMA coluna calculou. É o caso em que a tela tem uma escolha melhor
 * a fazer do que desenhar dez linhas de traço — mostrar a mensagem de
 * indisponibilidade e mais nada. Com uma coluna que seja calculada, o status é
 * 'ok' e a grade vale a pena.
 *
 * A COR NÃO É CALCULADA AQUI. `rankToColor` (utilitário próprio, já testado) é
 * a fonte única do gradiente; esta função só a chama com a colocação e o total
 * de linhas. Reimplementar a interpolação aqui criaria dois gradientes para
 * manter em sincronia.
 *
 * @param {Array<{id: string, name: string, method: string, mode: string,
 *                groupWeights: object|null}>} scenarios
 *        cenários salvos, na ordem em que foram acrescentados
 * @param {object} formData  estado do formulário (só leitura)
 * @returns {{
 *   status: "ok"|"unavailable",
 *   scenarios: Array<{id: string, name: string, method: string, mode: string,
 *                     status: "ok"|"unavailable"}>,
 *   rows: Array<{
 *     code: string,
 *     label: string,
 *     cells: Array<{scenarioId: string, rank: number|null, color: string|null,
 *                   status: "ok"|"unavailable"}>
 *   }>
 * }}
 *   `scenarios` são os cabeçalhos de coluna — nome, método e modo, que é o que
 *   identifica a coluna na tela; os pesos não vão junto. Em cada linha, `cells`
 *   acompanha `scenarios` posição a posição.
 */
export function buildScenarioComparisonTable(scenarios, formData) {
  const list = Array.isArray(scenarios) ? scenarios : [];

  // As linhas saem de METHODS, e não de `sheet.rows`, para que existirem
  // dependa apenas da constante — sem nenhum cenário salvo não há pipeline a
  // rodar, e mesmo assim a tabela sabe quais são suas linhas.
  const rows = METHODS.map((code) => ({ code, label: uiMethodLabel(code), cells: [] }));

  // Nenhum cenário: nada a calcular, e zero chamadas ao pipeline. A tela mostra
  // o estado vazio a partir de `scenarios.length`, não daqui.
  if (list.length === 0) {
    return { status: MCDM_STATUS.OK, scenarios: [], rows };
  }

  const columns = [];

  for (const scenario of list) {
    // Método e modo do CENÁRIO. É a linha inteira do item: trocar qualquer um
    // dos dois por um valor vindo da tela devolveria a tabela ao método único.
    const derived = deriveMcdmRanking(formData, scenario.groupWeights, {
      mode:   scenario.mode,
      method: scenario.method,
    });

    const ok = derived.status === MCDM_STATUS.OK;
    columns.push({
      id:     scenario.id,
      name:   scenario.name,
      method: scenario.method,
      mode:   scenario.mode,
      status: ok ? MCDM_STATUS.OK : MCDM_STATUS.UNAVAILABLE,
    });

    if (!ok) {
      // Uma célula vazia em CADA linha, e não nenhuma célula: as células
      // acompanham as colunas posição a posição, e pular a coluna aqui
      // desalinharia todas as que vierem depois dela.
      for (const row of rows) {
        row.cells.push({
          scenarioId: scenario.id,
          rank:       null,
          color:      null,
          status:     MCDM_STATUS.UNAVAILABLE,
        });
      }
      continue;
    }

    // Ranking em mãos, mas ele pode não cobrir todas as linhas se algum código
    // vier fora de METHODS. Preenche por código e completa o que faltar, para a
    // contagem de células continuar batendo com a de colunas.
    const porLinha = new Map(derived.result.ranking.map((entry) => [entry.code, entry]));
    for (const row of rows) {
      const entry = porLinha.get(row.code);
      // Código de método fora de METHODS não deveria existir — o pipeline
      // ranqueia exatamente as linhas da aba, que vêm de METHODS. Se acontecer
      // o contrário (uma linha de METHODS sem entrada no ranking), a célula sai
      // vazia em vez de desalinhar a coluna.
      row.cells.push(
        entry
          ? {
              scenarioId: scenario.id,
              rank:       entry.rank,
              color:      rankToColor(entry.rank, rows.length),
              status:     MCDM_STATUS.OK,
            }
          : {
              scenarioId: scenario.id,
              rank:       null,
              color:      null,
              status:     MCDM_STATUS.UNAVAILABLE,
            },
      );
    }
  }

  const alguma = columns.some((c) => c.status === MCDM_STATUS.OK);
  return {
    status:    alguma ? MCDM_STATUS.OK : MCDM_STATUS.UNAVAILABLE,
    scenarios: columns,
    rows,
  };
}
