// ---------------------------------------------------------------------------
// HARNESS DE COMPARAÇÃO — clássico vs. MCDM, para um caso real
// ---------------------------------------------------------------------------
// A pergunta que este módulo responde é a do Higor, e é uma só: o método que a
// mina DE FATO usa fica mais perto do topo do ranking depois do MCDM do que
// antes dele?
//
// Para cada caso, o mesmo formData atravessa os dois caminhos:
//
//   ANTES  — calculateNicholas / calculateUBC / calculateSHB, as três tabelas
//            clássicas somando pesos, exatamente como o app já faz.
//   DEPOIS — buildDecisionMatrix → runMcdmPipeline, para os mesmos três métodos
//            de seleção: a matriz clássica convertida para escala de valoração,
//            estendida com os seis critérios fixos do Francisco e ordenada por
//            TOPSIS.
//
// O DEPOIS RODA DUAS VEZES, NOS DOIS MODOS DE PONDERAÇÃO QUE A TELA OFERECE, e
// isso não é excesso de zelo: os dois respondem a perguntas diferentes.
//
//   Enfoque  — os pesos vêm de uma repartição DECLARADA entre os quatro grupos.
//              O default do app é uniforme entre grupos, que não é uniforme
//              entre critérios (cada critério de Economia pesa ~4,5× um de
//              Geomecânica, porque são 2 contra 9). É uma escolha editorial, e
//              um resultado medido só nela mede também essa escolha.
//   Entropy  — os pesos saem da DISPERSÃO dos dados da própria matriz, sem
//              ninguém declarar nada. Critério que não diferencia os métodos de
//              lavra pesa pouco por construção.
//
// Se o método real sobe nos dois, o efeito é do MCDM. Se sobe só no Enfoque, o
// efeito pode ser da repartição escolhida — que é exatamente a dúvida que a
// validação existe para não deixar em aberto.
//
// O que sai são NOVE posições do método real — três antes, seis depois — e a
// diferença de cada modo para o seu clássico. Com um subconjunto de métodos
// (options.methods), três por método pedido: os de fora nem são calculados.
//
// MESMO formData NOS DOIS LADOS, E É O PONTO DO EXPERIMENTO. Qualquer diferença
// de entrada entre os dois caminhos invalidaria a comparação: o que se quer
// medir é o efeito do MÉTODO de agregação, não o de um dado a mais.
//
// NÃO DECIDE NADA SOBRE O APP. Lê calculateX, buildDecisionMatrix e
// runMcdmPipeline; não os altera, não os embrulha com correção nenhuma.

import { calculateNicholas, calculateSHB, calculateUBC } from "../algorithms/algorithms";
import { equalGroupWeights, WEIGHTING_MODES } from "../algorithms/enfoque";
import { METHOD_LABELS, METHODS } from "../algorithms/ubcWeights";
import { deriveMcdmRanking, MCDM_STATUS } from "../utils/mcdmRanking";
import { ALL_METHODS, assertCaseReady } from "./caseSchema";
import { mapCaseToFormData } from "./mapCaseToFormData";

/** Os três métodos de seleção, na ordem em que o relatório os lista. */
export const SELECTION_METHODS = Object.freeze(["nicholas", "ubc", "shb"]);

/** Rótulo curto de cada método de seleção, para o relatório em texto. */
export const SELECTION_LABELS = Object.freeze({ nicholas: "Nicholas", ubc: "UBC", shb: "SH&B" });

/**
 * Os dois modos de ponderação comparados, na ordem do relatório.
 *
 * São os MESMOS que a tela oferece (MCDM_UI_MODES, em MmsContext.jsx). O modo
 * 'none' de enfoque.js fica de fora aqui pelo mesmo motivo que fica de fora da
 * UI: é o modo sem ponderação declarada, que o app não expõe a ninguém.
 */
export const WEIGHT_MODES = Object.freeze([WEIGHTING_MODES.ENFOQUE, WEIGHTING_MODES.ENTROPY]);

/** Rótulo de cada modo, para o relatório em texto. */
export const WEIGHT_MODE_LABELS = Object.freeze({
  [WEIGHTING_MODES.ENFOQUE]: "Enfoque (uniforme entre os 4 grupos)",
  [WEIGHTING_MODES.ENTROPY]: "Entropy (pesos vindos da dispersão dos dados)",
});

const CLASSIC_CALCULATORS = Object.freeze({
  nicholas: calculateNicholas,
  ubc:      calculateUBC,
  shb:      calculateSHB,
});

/**
 * Posição de um método de lavra no ranking clássico.
 *
 * A POSIÇÃO É O ÍNDICE NO ARRAY `ranking` + 1 — a mesma que a tela mostra, e não
 * uma colocação de competição recalculada aqui. Com empate de pontuação, o
 * desempate é o da ordem de METHODS (o sort do JS é estável), e é essa ordem que
 * o usuário vê; inventar outra faria o relatório de validação discordar da tela
 * para o mesmo caso.
 *
 * Empates são reportados à parte, em `tiedWith`: uma 2ª posição dividida com
 * outros três métodos não é a mesma informação que uma 2ª posição isolada, e a
 * diferença importa justamente quando se quer saber se o MCDM "melhorou" algo.
 */
function classicPosition(resultado, code) {
  const posicao = resultado.ranking.indexOf(code) + 1;
  const score   = resultado.scores[code];
  const tiedWith = METHODS.filter((m) => m !== code && resultado.scores[m] === score);
  return { position: posicao, of: resultado.ranking.length, score, tiedWith };
}

/**
 * Posição de um método de lavra no ranking MCDM.
 *
 * Usa o `rank` que o próprio pipeline devolve (topsis.js já o calcula, com
 * desempate estável pela ordem original das linhas).
 */
function mcdmPosition(ranking, code) {
  const entrada = ranking.find((r) => r.code === code);
  if (!entrada) return { position: null, of: ranking.length, closeness: null, tiedWith: [] };
  const tiedWith = ranking
    .filter((r) => r.code !== code && r.closeness === entrada.closeness)
    .map((r) => r.code);
  return { position: entrada.rank, of: ranking.length, closeness: entrada.closeness, tiedWith };
}

/**
 * Compara as posições do método real, antes e depois do MCDM.
 *
 * Recebe formData já montado — é o ponto de entrada de quem tem um formulário
 * (do app ou de uma fixture) e não um arquivo de caso. Quem tem o caso usa
 * compareCase.
 *
 * @param {object} formData      estado do formulário (só leitura)
 * @param {string} realMethod    código do método de lavra realmente usado ("R&P", ...)
 * @param {object} [options]
 * @param {object} [options.groupWeights] repartição do Enfoque; default: uniforme
 *   entre os quatro grupos — o mesmo ponto de partida do app (defaultMcdmWeights,
 *   em MmsContext.jsx). Não é neutro entre CRITÉRIOS, e é de propósito: é o que o
 *   usuário do app encontra ao abrir a tela. Ignorado no modo Entropy, que tira
 *   os pesos dos dados.
 * @param {string[]} [options.modes] modos de ponderação a rodar; default: os dois
 * @param {object} [options.methods] { nicholas, ubc, shb } — métodos de seleção a
 *   comparar; default: os três. Método fora do subconjunto NÃO É CALCULADO — nem
 *   o clássico nem o MCDM — e não aparece no resultado. Não é filtro de saída:
 *   o formData de um subconjunto só tem os critérios daquele subconjunto, e
 *   rodar os outros métodos sobre ele produziria uma posição plausível sobre
 *   critérios descartados em silêncio (sumCriteria), que é a falha que a
 *   validação existe para impedir.
 * @returns {{realMethod, realMethodLabel, selection, classic, mcdm, deltas, unavailable}}
 *   `selection` lista os métodos calculados; `classic`, `mcdm` e `deltas` só têm
 *   chave para eles. `mcdm` e `deltas` são indexados por método de seleção E POR
 *   MODO — `mcdm.nicholas.enfoque`, `deltas.ubc.entropy`.
 */
export function compareFormData(formData, realMethod, {
  groupWeights = equalGroupWeights(),
  modes        = WEIGHT_MODES,
  methods      = ALL_METHODS,
} = {}) {
  if (!METHODS.includes(realMethod)) {
    throw new Error(
      `[MMS/validation] método real "${realMethod}" não está em METHODS (${METHODS.join(", ")}).`,
    );
  }

  const selection = SELECTION_METHODS.filter((m) => methods[m]);
  if (selection.length === 0) {
    throw new Error("[MMS/validation] nenhum método de seleção pedido — nada a comparar.");
  }

  const classic = {};
  const mcdm    = {};
  const deltas  = {};
  const unavailable = [];

  for (const selecao of selection) {
    // ANTES — a tabela clássica do método, sozinha. Uma vez só: o modo de
    // ponderação é do MCDM, o cálculo clássico não o conhece.
    classic[selecao] = classicPosition(CLASSIC_CALCULATORS[selecao](formData), realMethod);

    mcdm[selecao]   = {};
    deltas[selecao] = {};

    // DEPOIS — a mesma entrada pelo pipeline MCDM, uma vez por modo de peso.
    for (const mode of modes) {
      // deriveMcdmRanking NUNCA LANÇA: falha vira status 'unavailable', que é o
      // estado do app quando o formulário está incompleto. Aqui o formulário
      // nunca deveria estar incompleto (o mapeador já garantiu), então
      // 'unavailable' significa outra coisa — e essa outra coisa precisa
      // aparecer no relatório, não sumir como posição nula sem explicação.
      //
      // Um modo pode falhar sozinho: Entropy depende da DISPERSÃO das colunas e
      // tem modos de falha que o Enfoque não tem. Por isso a indisponibilidade é
      // registrada por par (método, modo), e o outro modo do mesmo método segue.
      const resultado = deriveMcdmRanking(formData, groupWeights, { mode, method: selecao });
      if (resultado.status !== MCDM_STATUS.OK) {
        mcdm[selecao][mode]   = { position: null, of: 0, closeness: null, tiedWith: [] };
        deltas[selecao][mode] = null;
        unavailable.push({
          method: selecao,
          mode,
          incompleteStep: resultado.incompleteStep,
          error: resultado.error ? resultado.error.message : null,
        });
        continue;
      }

      mcdm[selecao][mode] = mcdmPosition(resultado.result.ranking, realMethod);
      // Positivo = o método real SUBIU com o MCDM (posição menor é melhor).
      // O clássico é o mesmo para os dois modos — é dele que cada um se afasta.
      deltas[selecao][mode] = classic[selecao].position - mcdm[selecao][mode].position;
    }
  }

  return {
    realMethod,
    realMethodLabel: METHOD_LABELS[realMethod],
    selection,
    modes: [...modes],
    classic,
    mcdm,
    deltas,
    unavailable,
  };
}

/**
 * Comparação a partir de um caso de validação.
 *
 * Encadeia validação → mapeamento → comparação. As duas primeiras etapas lançam
 * com a lista completa do que falta (CaseIncompleteError, CaseMappingError), que
 * é o comportamento que se quer: um caso pela metade não deve produzir número
 * nenhum — um ranking plausível sobre dado faltante é pior que nenhum ranking.
 *
 * @param {object} caseObj  caso no schema v1
 * O MESMO `methods` governa as três etapas: o que se valida é o que se mapeia e
 * é o que se calcula. Método fora dele não é exigido, não é mapeado e não é
 * ranqueado.
 *
 * @param {object} caseObj  caso no schema v1
 * @param {object} [options] { methods, groupWeights, modes } — methods default: os três
 */
export function compareCase(caseObj, options = {}) {
  const { methods = ALL_METHODS, ...restante } = options;
  assertCaseReady(caseObj, { methods });
  const { formData, realMethod, notes } = mapCaseToFormData(caseObj, { methods });
  return {
    caseId: caseObj.case_id,
    source: caseObj.source,
    notes,
    ...compareFormData(formData, realMethod, { ...restante, methods }),
  };
}

/**
 * Relatório em texto de uma comparação — as seis posições lado a lado.
 *
 * Linhas soltas, sem tabela: o resultado tem seis números e uma legenda, e uma
 * tabela desenhada com caracteres se desalinha no primeiro terminal com fonte
 * diferente.
 */
export function formatComparison(resultado) {
  const posicao = (p) => {
    if (p.position === null) return "indisponível";
    const empate = p.tiedWith.length > 0 ? ` (empatado com ${p.tiedWith.join(", ")})` : "";
    return `${p.position}º de ${p.of}${empate}`;
  };

  const delta = (d) => {
    if (d === null || d === undefined) return "—";
    const sinal = d > 0 ? `+${d}` : String(d);
    return `${sinal} ${d === 0 ? "(mesma posição)" : d > 0 ? "posição(ões) acima" : "posição(ões) abaixo"}`;
  };

  const modos    = resultado.modes ?? WEIGHT_MODES;
  const selecoes = resultado.selection ?? SELECTION_METHODS;

  const linhas = [
    `Caso: ${resultado.caseId ?? "(formData avulso)"}`,
    `Método real: ${resultado.realMethod} — ${resultado.realMethodLabel}`,
    "",
    "Posição no ranking CLÁSSICO (tabelas de peso, sem MCDM):",
    ...selecoes.map((m) => `  ${SELECTION_LABELS[m].padEnd(8)} ${posicao(resultado.classic[m])}`),
    "",
    "Entre colchetes, a diferença para o clássico do mesmo método de seleção " +
    "(positivo = o método real subiu com o MCDM).",
  ];

  for (const mode of modos) {
    linhas.push(
      "",
      `Posição no ranking MCDM — ${WEIGHT_MODE_LABELS[mode] ?? mode}:`,
      ...selecoes.map((m) =>
        `  ${SELECTION_LABELS[m].padEnd(8)} ${posicao(resultado.mcdm[m][mode])}` +
        `   [${delta(resultado.deltas[m][mode])}]`),
    );
  }

  if (resultado.unavailable?.length) {
    linhas.push("", "MCDM indisponível em:");
    for (const u of resultado.unavailable) {
      linhas.push(
        `  ${SELECTION_LABELS[u.method]} / ${u.mode} — ` +
        `${u.incompleteStep ? `etapa incompleta: ${u.incompleteStep}` : u.error}`,
      );
    }
  }

  if (resultado.notes?.length) {
    linhas.push("", "Notas do mapeamento:");
    for (const n of resultado.notes) linhas.push(`  ${n.path} — ${n.note}`);
  }

  return linhas.join("\n");
}
