// PIPELINE MCDM — DA MATRIZ DE DECISÃO AO RANKING TOPSIS
//
// Orquestra, numa ordem única, as quatro peças que até aqui só existiam
// isoladas: a extensão da matriz com os critérios fixos (decisionMatrix.js), a
// conversão para a escala de Saaty (saatyScale.js), a resolução de pesos do
// Enfoque (enfoque.js) e o motor TOPSIS (topsis.js).
//
// Sequência:
//   1. escolhe a aba do método de seleção pedido, dentro da matriz recebida
//   2. estende com os seis critérios fixos     → extendSheetWithFixedCriteria
//   3. converte SÓ as colunas clássicas        → toSaaty
//   4. resolve os pesos conforme o modo        → resolveWeights
//   5. roda o motor                            → topsis
//
// SÓ NICHOLAS, POR ENQUANTO. As tabelas do Nicholas pontuam exclusivamente em
// {−49, 0, 1, 2, 3, 4} — inteiramente dentro do domínio que o toSaaty cobre.
// UBC e SH&B ficam de fora deliberadamente: as tabelas deles contêm valores
// que a especificação da escala não cobre (−10, 5 e 6 no UBC; −7, −10, −25 e
// os fracionários acima de 4 no SH&B, que já embute multiplicadores nas
// próprias tabelas). A regra de conversão para esses valores é decisão do
// Francisco e ainda não chegou. Ver a guarda em assertMcdmMethodSupported.
//
// Puro: não lê estado global, não toca no DOM, não muta o que recebe.

import { extendSheetWithFixedCriteria, sheetCriteriaDirections } from "./decisionMatrix";
import { FIXED_CRITERIA_BY_ID } from "./mcdmCriteria";
import { toSaaty } from "./saatyScale";
import { createWeightingState, resolveWeights } from "./enfoque";
import { topsis } from "./topsis";

/** Métodos de seleção cujo pipeline MCDM já está liberado. */
export const MCDM_SUPPORTED_METHODS = Object.freeze(["nicholas"]);

/**
 * Métodos bloqueados e o motivo, em formato legível por máquina.
 *
 * Existe como tabela — e não como string solta dentro do throw — para que a UI
 * possa desabilitar o botão com a mesma justificativa que o erro carrega, sem
 * ninguém precisar duplicar o texto.
 */
export const MCDM_PENDING_METHODS = Object.freeze({
  ubc: Object.freeze({
    label:  "UBC",
    reason: "aguardando regra de conversão Saaty do Francisco para os valores fora do domínio 0–4/−49 (−10, 5, 6)",
  }),
  shb: Object.freeze({
    label:  "SH&B",
    reason: "aguardando regra de conversão Saaty do Francisco para os valores fora do domínio 0–4/−50 (−7, −10, −25, e os fracionários acima de 4: 4.2, 4.38, 5.25)",
  }),
});

/**
 * Barra os métodos ainda não suportados, com mensagem que diz o que falta.
 *
 * A guarda existe porque, sem ela, o UBC e o SH&B falhariam mesmo assim — só
 * que lá dentro do toSaaty, com um "score X fora do domínio especificado" que
 * não diz nem qual método de seleção foi pedido nem que a pendência é externa.
 * A falha aqui é PROPOSITAL e esperada nesta fase do projeto: não é bug.
 *
 * @param {string} methodKey  "ubc" | "nicholas" | "shb"
 * @throws {Error} se o método não estiver em MCDM_SUPPORTED_METHODS
 */
export function assertMcdmMethodSupported(methodKey) {
  if (MCDM_SUPPORTED_METHODS.includes(methodKey)) return;

  const pending = MCDM_PENDING_METHODS[methodKey];
  if (pending) {
    throw new Error(
      `[MMS] Pipeline MCDM ainda não suportado para ${pending.label} — ${pending.reason}. ` +
      `Suportado por enquanto: ${MCDM_SUPPORTED_METHODS.join(", ")}.`,
    );
  }

  throw new Error(
    `[MMS] Pipeline MCDM: método de seleção desconhecido (${String(methodKey)}). ` +
    `Suportado por enquanto: ${MCDM_SUPPORTED_METHODS.join(", ")}.`,
  );
}

/** True se a coluna é um dos seis critérios fixos do Francisco. */
function isFixedCriterion(criterionKey) {
  return criterionKey in FIXED_CRITERIA_BY_ID;
}

/**
 * Converte para Saaty apenas as colunas clássicas de uma aba já estendida.
 *
 * As seis colunas dos critérios fixos passam INTACTAS, na escala nativa da
 * tabela do Francisco (1–5 nos técnicos, 10–100 no índice de custo). Não é
 * descuido: a normalização vetorial do TOPSIS divide cada coluna pela própria
 * norma euclidiana, então colunas de escalas diferentes já entram na conta em
 * pé de igualdade. Passar os fixos pelo toSaaty, além de estourar (o índice de
 * custo vai até 100), destruiria a informação de proporção entre eles.
 *
 * Puro: devolve uma aba nova.
 *
 * @param {object} sheet  aba de buildDecisionMatrix, tipicamente já estendida
 */
export function convertClassicColumnsToSaaty(sheet) {
  const classicColumn = sheet.criterionKeys.map((key) => !isFixedCriterion(key));

  return {
    ...sheet,
    rows: sheet.rows.map((row) => ({
      ...row,
      values: row.values.map((value, j) => (classicColumn[j] ? toSaaty(value) : value)),
    })),
  };
}

/**
 * Localiza a aba de um método de seleção dentro da matriz.
 *
 * Erro próprio em vez de deixar o `undefined` seguir adiante: o sintoma de uma
 * aba ausente apareceria só no TOPSIS, como "é preciso ao menos uma
 * alternativa", que não aponta para a causa (o método não foi selecionado na
 * hora de montar a matriz).
 */
function requireSheet(matrix, methodKey) {
  const sheet = matrix?.sheets?.find((s) => s.key === methodKey);
  if (!sheet) {
    const disponiveis = (matrix?.sheets ?? []).map((s) => s.key).join(", ") || "nenhuma";
    throw new Error(
      `[MMS] Pipeline MCDM: a matriz recebida não tem aba para "${methodKey}" ` +
      `(abas presentes: ${disponiveis}). Marque o método em buildDecisionMatrix antes de rodar o pipeline.`,
    );
  }
  return sheet;
}

/**
 * Falha alto em célula vazia, ANTES de chegar ao motor.
 *
 * Mesma razão pela qual o TOPSIS recusa célula não numérica: null não pode
 * virar zero em silêncio — zero é um score, e num critério de minimizar é o
 * valor ÓTIMO. Aqui a mensagem consegue nomear o método de lavra e o critério;
 * lá dentro só sobrariam os índices da matriz.
 */
function assertNoEmptyCells(sheet) {
  sheet.rows.forEach((row) => {
    row.values.forEach((value, j) => {
      if (typeof value !== "number" || Number.isNaN(value)) {
        throw new Error(
          `[MMS] Pipeline MCDM: célula vazia em ${row.code} × ${sheet.criterionKeys[j]} ` +
          `(${String(value)}). O TOPSIS precisa da matriz completa.`,
        );
      }
    });
  });
}

/**
 * Roda o pipeline MCDM completo para um método de seleção.
 *
 * @param {{sheets: Array, unmappedKeys: string[]}} matrix  saída de buildDecisionMatrix
 * @param {object}   [options]
 * @param {string}   [options.method="nicholas"]  método de seleção; ver a guarda
 * @param {object}   [options.weighting]          estado de enfoque.js; default = modo 'none'
 * @param {number[]} [options.baseWeights]        pesos-base, um por coluna da aba ESTENDIDA
 * @returns {{
 *   selectionMethod: string,
 *   sheet: object,
 *   criterionIds: string[],
 *   criteria: Array<{id: string, direction: string}>,
 *   weights: number[],
 *   topsis: object,
 *   ranking: Array<{code: string, method: string, rank: number, closeness: number}>
 * }}
 *   `sheet` é a aba estendida e já convertida — é o que o motor de fato leu, e
 *   está no retorno para inspeção e para a futura exibição na tela.
 *   `weights` são os pesos ANTES da normalização do TOPSIS (os normalizados
 *   ficam em `topsis.weights`), porque é neles que o boost do Enfoque aparece.
 */
export function runMcdmPipeline(matrix, options = {}) {
  const {
    method    = "nicholas",
    weighting = createWeightingState(),
    baseWeights,
  } = options;

  // Passo 0 — a guarda, antes de qualquer conta. Chegar ao toSaaty com um
  // método bloqueado é exatamente o que ela existe para impedir.
  assertMcdmMethodSupported(method);

  // Passos 1 a 3 — aba, extensão, conversão.
  const extended  = extendSheetWithFixedCriteria(requireSheet(matrix, method));
  const converted = convertClassicColumnsToSaaty(extended);
  assertNoEmptyCells(converted);

  const criteria     = sheetCriteriaDirections(converted);
  const criterionIds = converted.criterionKeys;

  // Passo 4 — pesos. Em modo 'none' resolveWeights devolve os pesos-base
  // intactos, e o default de pesos-base é 1 para cada critério; depois da
  // normalização do TOPSIS isso é exatamente o equalWeights do motor.
  const weights = resolveWeights(weighting, criterionIds, baseWeights);

  // Passo 5 — motor.
  const result = topsis({
    alternatives: converted.rows.map((row) => row.code),
    criteria,
    matrix:       converted.rows.map((row) => row.values),
    weights,
  });

  return {
    selectionMethod: method,
    sheet:           converted,
    criterionIds,
    criteria,
    weights,
    topsis:          result,
    // `id` do motor é o código do método de lavra; o rótulo legível vem da
    // linha correspondente da aba, pelo índice original.
    ranking: result.ranking.map((entry) => ({
      ...entry,
      code:   entry.id,
      method: converted.rows[entry.index].method,
    })),
  };
}
