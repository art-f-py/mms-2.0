// CONVERSÃO DOS CRITÉRIOS CLÁSSICOS PARA A ESCALA DE SAATY
//
// Os três métodos clássicos pontuam em 0–4 e usam valores muito negativos como
// eliminação (−49 no UBC/Nicholas, −50 no SH&B). Um MCDM não sabe ler isso: o
// negativo não é "muito ruim" numa escala contínua, é um marcador de "método
// descartado". A conversão abaixo, confirmada pelo Francisco, leva os dois
// casos para uma escala única e não-negativa:
//
//   • valores 0–4        →  2 × antigo + 1   (mapeia 0–4 em 1–9, a escala de Saaty)
//   • valores −49 e −50  →  0                (direto, FORA da fórmula linear)
//
// O zero das eliminações é o piso da escala, abaixo do 1 que o pior score comum
// recebe — a distinção entre "pior método viável" e "método eliminado"
// sobrevive à conversão.
//
// Por que não o offset +50 que a exportação usa: ele preserva a distância
// enorme entre −49 e 0, e isso concentrava mais de 50% do peso calculado por
// Entropy num único critério. A escala de Saaty comprime essa distância.
// Ver PRO_DM_SCORE_OFFSET em decisionMatrix.js — os dois caminhos coexistem e
// servem a consumidores diferentes.

/** Extremos do domínio de entrada coberto pela fórmula linear. */
export const CLASSIC_SCORE_MIN = 0;
export const CLASSIC_SCORE_MAX = 4;

/** Scores que os três métodos usam como eliminação. */
export const ELIMINATION_SCORES = Object.freeze([-49, -50]);

/** Valor de saída das eliminações — o piso da escala convertida. */
export const SAATY_ELIMINATION_VALUE = 0;

/** Extremos do domínio de saída da fórmula linear (2×0+1 e 2×4+1). */
export const SAATY_MIN = 1;
export const SAATY_MAX = 9;

/**
 * Converte um score clássico para a escala de Saaty.
 *
 * Puro e total sobre o domínio especificado; fora dele lança em vez de devolver
 * um número. Isso é deliberado: as tabelas do projeto contêm hoje valores que a
 * especificação não cobre (−10 e −25 como penalidades intermediárias, 5 e 6 no
 * UBC, e a família de valores fracionários do SH&B, que já embute
 * multiplicadores nas próprias tabelas). Aplicar a fórmula linear a eles
 * produziria números plausíveis e errados — um −10 viraria −19, negativo dentro
 * de uma escala que deveria começar em zero. Falhar alto força a regra a ser
 * definida pelo Francisco antes de qualquer uso, em vez de ser inventada aqui.
 *
 * @param {number|null} score  score clássico, ou null para célula sem valor
 * @returns {number|null} valor na escala de Saaty; null se a entrada for null
 * @throws {RangeError} se o score estiver fora do domínio especificado
 */
export function toSaaty(score) {
  // Célula vazia continua vazia — mesma convenção de applyExportOffset: somar ou
  // converter um valor ausente inventaria um score que a tabela não tem.
  if (score === null || score === undefined) return null;

  if (typeof score !== "number" || Number.isNaN(score)) {
    throw new RangeError(`[MMS] toSaaty: score não numérico (${String(score)})`);
  }

  // Ramo das eliminações: mapeamento direto, antes da fórmula.
  if (ELIMINATION_SCORES.includes(score)) return SAATY_ELIMINATION_VALUE;

  // Ramo linear.
  if (score < CLASSIC_SCORE_MIN || score > CLASSIC_SCORE_MAX) {
    throw new RangeError(
      `[MMS] toSaaty: score ${score} fora do domínio especificado ` +
      `(${CLASSIC_SCORE_MIN}–${CLASSIC_SCORE_MAX} ou ${ELIMINATION_SCORES.join(" / ")}). ` +
      `A regra de conversão para este valor ainda não foi definida.`,
    );
  }

  return 2 * score + 1;
}

/** True se o score é um marcador de eliminação, não um score comum. */
export function isEliminationScore(score) {
  return ELIMINATION_SCORES.includes(score);
}
