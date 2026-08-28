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
//   3. converte SÓ as colunas clássicas        → toSaaty / toUbcScale
//   4. resolve os pesos conforme o modo        → resolveWeights
//   5. roda o motor                            → topsis
//
// UMA ESCALA POR MÉTODO DE SELEÇÃO. O passo 3 não tem uma conversão só: o
// Nicholas pontua em {−49, 0, 1, 2, 3, 4} e usa a fórmula linear de
// saatyScale.js; o UBC pontua em {−49, −10, 0, 1, 2, 3, 4, 5, 6} e usa a tabela
// categórica de ubcScale.js, que NÃO é aquela fórmula estendida — diverge dela
// em 3 e em 4, 42% das células. A escolha é uma tabela (CLASSIC_SCALE_BY_METHOD)
// e não um if, pelo mesmo motivo que MCDM_PENDING_METHODS é tabela: quem
// acrescentar o SH&B acrescenta uma linha, e esquecer de acrescentá-la falha na
// guarda em vez de converter pela escala do método errado.
//
// SH&B AINDA DE FORA. As tabelas dele contêm valores que nenhuma das duas
// escalas cobre (−7 e os fracionários 4.2, 4.38 e 5.25, resultado de a tabela
// já embutir multiplicadores). Ver a guarda em assertMcdmMethodSupported.
//
// Puro: não lê estado global, não toca no DOM, não muta o que recebe.

import { extendSheetWithFixedCriteria, sheetCriteriaDirections } from "./decisionMatrix";
import { FIXED_CRITERIA_BY_ID } from "./mcdmCriteria";
import { toSaaty } from "./saatyScale";
import { toUbcScale } from "./ubcScale";
import { createWeightingState, resolveWeights, WEIGHTING_MODES } from "./enfoque";
import { calculateEntropyWeights } from "./entropyWeights";
import { topsis } from "./topsis";

/** Métodos de seleção cujo pipeline MCDM já está liberado. */
export const MCDM_SUPPORTED_METHODS = Object.freeze(["nicholas", "ubc"]);

/**
 * A conversão de escala de cada método liberado.
 *
 * FONTE ÚNICA da decisão do passo 3, e é ela que torna "liberado" e "tem escala
 * definida" a mesma coisa: um método em MCDM_SUPPORTED_METHODS sem entrada aqui
 * cairia em `undefined` na hora de converter. A guarda logo abaixo fecha isso
 * verificando as duas listas juntas.
 */
export const CLASSIC_SCALE_BY_METHOD = Object.freeze({
  nicholas: toSaaty,
  ubc:      toUbcScale,
});

/**
 * Métodos bloqueados e o motivo, em formato legível por máquina.
 *
 * Existe como tabela — e não como string solta dentro do throw — para que a UI
 * possa desabilitar o botão com a mesma justificativa que o erro carrega, sem
 * ninguém precisar duplicar o texto.
 */
export const MCDM_PENDING_METHODS = Object.freeze({
  shb: Object.freeze({
    label:  "SH&B",
    reason: "a Tabela 25 do Francisco cobre parte do domínio, mas ainda faltam −7 e os fracionários acima de 4 (4.2, 4.38, 5.25), que vêm de a tabela já embutir multiplicadores",
  }),
});

/**
 * Barra os métodos ainda não suportados, com mensagem que diz o que falta.
 *
 * A guarda existe porque, sem ela, o SH&B falharia mesmo assim — só que lá
 * dentro da conversão de escala, com um "score X fora do domínio especificado"
 * que não diz nem qual método de seleção foi pedido nem que a pendência é
 * externa. A falha aqui é PROPOSITAL e esperada nesta fase do projeto: não é bug.
 *
 * Confere TAMBÉM que o método liberado tem escala declarada. As duas listas
 * podem divergir por descuido — liberar um método e esquecer a linha em
 * CLASSIC_SCALE_BY_METHOD —, e o sintoma disso seria um `undefined` chamado
 * como função lá adiante, sem relação visível com a causa.
 *
 * @param {string} methodKey  "ubc" | "nicholas" | "shb"
 * @throws {Error} se o método não estiver em MCDM_SUPPORTED_METHODS
 */
export function assertMcdmMethodSupported(methodKey) {
  if (MCDM_SUPPORTED_METHODS.includes(methodKey)) {
    if (typeof CLASSIC_SCALE_BY_METHOD[methodKey] === "function") return;
    throw new Error(
      `[MMS] Pipeline MCDM: "${methodKey}" está em MCDM_SUPPORTED_METHODS mas não tem ` +
      `conversão de escala em CLASSIC_SCALE_BY_METHOD. As duas listas precisam andar juntas.`,
    );
  }

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
 * pé de igualdade. Passar os fixos pela conversão, além de estourar (o índice
 * de custo vai até 100), destruiria a informação de proporção entre eles.
 *
 * A escala das colunas clássicas depende do MÉTODO DE SELEÇÃO — ver
 * CLASSIC_SCALE_BY_METHOD e o cabeçalho do arquivo. O default é "nicholas"
 * para não quebrar quem já chamava esta função com um argumento só.
 *
 * Puro: devolve uma aba nova.
 *
 * @param {object} sheet       aba de buildDecisionMatrix, tipicamente já estendida
 * @param {string} [methodKey] método de seleção; decide a escala das colunas clássicas
 */
export function convertClassicColumnsToSaaty(sheet, methodKey = "nicholas") {
  const toScale = CLASSIC_SCALE_BY_METHOD[methodKey];
  if (typeof toScale !== "function") {
    throw new RangeError(
      `[MMS] Pipeline MCDM: não há conversão de escala para "${String(methodKey)}". ` +
      `Métodos com escala definida: ${Object.keys(CLASSIC_SCALE_BY_METHOD).join(", ")}.`,
    );
  }

  const classicColumn = sheet.criterionKeys.map((key) => !isFixedCriterion(key));

  return {
    ...sheet,
    rows: sheet.rows.map((row) => ({
      ...row,
      values: row.values.map((value, j) => (classicColumn[j] ? toScale(value) : value)),
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
 * @param {number[]} [options.baseWeights]        pesos-base, um por coluna da aba ESTENDIDA;
 *                                                só vale com o modo 'none' — combiná-lo com
 *                                                'enfoque' lança (ver resolveWeights)
 * @returns {{
 *   selectionMethod: string,
 *   sheet: object,
 *   criterionIds: string[],
 *   criteria: Array<{id: string, direction: string}>,
 *   weights: number[],
 *   topsis: object,
 *   ranking: Array<{code: string, label: string, rank: number, closeness: number}>
 * }}
 *   `sheet` é a aba estendida e já convertida — é o que o motor de fato leu, e
 *   está no retorno para inspeção e para a futura exibição na tela.
 *   `weights` são os pesos ANTES da normalização do TOPSIS (os normalizados
 *   ficam em `topsis.weights`), porque é neles que a repartição do Enfoque
 *   aparece — peso do grupo ÷ critérios do grupo na matriz, somando 1 sobre as
 *   colunas da aba (19 no Nicholas, 17 no UBC).
 */
export function runMcdmPipeline(matrix, options = {}) {
  const {
    method    = "nicholas",
    weighting = createWeightingState(),
    baseWeights,
  } = options;

  // Passo 0 — a guarda, antes de qualquer conta. Chegar à conversão com um
  // método bloqueado é exatamente o que ela existe para impedir.
  assertMcdmMethodSupported(method);

  // Passos 1 a 3 — aba, extensão, conversão na escala do método.
  const extended  = extendSheetWithFixedCriteria(requireSheet(matrix, method));
  const converted = convertClassicColumnsToSaaty(extended, method);
  assertNoEmptyCells(converted);

  const criteria     = sheetCriteriaDirections(converted);
  const criterionIds = converted.criterionKeys;

  // Passo 4 — pesos. Em modo 'none' resolveWeights devolve os pesos-base
  // intactos, e o default de pesos-base é 1 para cada critério; depois da
  // normalização do TOPSIS isso é exatamente o equalWeights do motor. Em modo
  // 'enfoque' devolve peso-de-grupo ÷ tamanho-do-grupo para cada critério.
  //
  // ENTROPY RAMIFICA AQUI, E NÃO DENTRO DE resolveWeights. A diferença não é de
  // arrumação: resolveWeights recebe `criterionIds` e o estado de ponderação, e
  // é só disso que ela precisa para os modos 'none' e 'enfoque' — ambos
  // calculam pesos a partir da ESTRUTURA dos critérios. Entropy precisa dos
  // DADOS, da aba inteira, que resolveWeights não recebe nem deveria receber:
  // enfoque.js é o modelo de ponderação declarada pelo usuário e não tem por
  // que conhecer o formato de uma aba de decisão.
  //
  // Consequência deliberada: resolveWeights continua LANÇANDO para 'entropy' se
  // alguém a chamar direto. É o comportamento certo — quem a chama com esse
  // modo está pedindo algo que ela não tem como fazer, e receber pesos-base em
  // silêncio seria pior. Há teste fixando as duas metades: que o pipeline
  // funciona no modo entropy e que resolveWeights sozinha ainda recusa.
  const weights = weighting.mode === WEIGHTING_MODES.ENTROPY
    ? calculateEntropyWeights(converted, criterionIds)
    : resolveWeights(weighting, criterionIds, baseWeights);

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
    //
    // O campo é `label`, e não `method`, de propósito: `selectionMethod` no
    // topo deste mesmo objeto é o método de SELEÇÃO (nicholas/ubc/shb), e um
    // `method` aqui dentro valendo método de LAVRA ("Open Pit") daria dois
    // sentidos à mesma palavra num único retorno. A linha de origem na aba
    // continua chamando o campo de `method` — é o formato de decisionMatrix.js
    // e não muda por causa disto.
    ranking: result.ranking.map((entry) => ({
      ...entry,
      code:  entry.id,
      label: converted.rows[entry.index].method,
    })),
  };
}
