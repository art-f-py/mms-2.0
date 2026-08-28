// CONVERSÃO DOS CRITÉRIOS CLÁSSICOS DO UBC PARA A ESCALA DE SAATY
//
// Tabela categórica do Francisco, confirmada, cobrindo 100% do domínio real das
// tabelas de ubcWeights.js — {−49, −10, 0, 1, 2, 3, 4, 5, 6}, verificado célula
// a célula (440 células, nenhum valor fora desse conjunto).
//
// ARQUIVO PRÓPRIO, E NÃO UM RAMO A MAIS DENTRO DE saatyScale.js. Aquele módulo
// é a fórmula LINEAR (2 × score + 1) mais o mapeamento direto das eliminações,
// e esta tabela NÃO é aquela fórmula estendida: ela diverge da linear em dois
// pontos do domínio comum — 3 vira 5 (a linear daria 7) e 4 vira 7 (a linear
// daria 9). Esses dois valores ocupam 185 das 440 células do UBC, 42% da
// matriz; não é um caso de borda que caberia como exceção. Enxertar isto lá
// dentro faria um módulo com duas regras concorrentes para a mesma entrada,
// decidindo qual usar por um parâmetro — e a primeira leitura errada desse
// parâmetro converteria a matriz inteira pela regra do outro método.
//
// NÃO É INJETIVA, E ISSO É A TABELA OFICIAL, NÃO UM DEFEITO. Três pares de
// scores distintos caem no mesmo valor convertido:
//
//   −10 e 0 → 1        2 e 3 → 5        5 e 6 → 9
//
// A consequência é real e esperada: numa coluna em que dois métodos de lavra
// pontuavam 2 e 3, o TOPSIS passa a vê-los EMPATADOS naquele critério. A
// distinção existia na tabela do UBC e não sobrevive à conversão. Quem
// estranhar um empate que "não devia existir" está vendo isto, e está
// funcionando como especificado: são nove scores de entrada para seis valores
// de saída (0, 1, 3, 5, 7, 9), então alguma fusão é inevitável por contagem —
// a tabela só decide QUAIS pares se fundem.
//
// Puro: não lê estado global, não toca no DOM, não muta o que recebe.

/**
 * A tabela, escrita como tabela.
 *
 * Mapa explícito em vez de condicionais encadeadas de propósito: o que está
 * especificado é uma correspondência de nove entradas, e é assim que ela se
 * confere contra o papel do Francisco — linha a linha, sem traduzir faixas
 * mentalmente. Também é o que torna o domínio inspecionável de fora (ver
 * UBC_SCORE_DOMAIN), em vez de ficar implícito na ordem dos ifs.
 */
const UBC_TO_SAATY = Object.freeze({
  "-49": 0,
  "-10": 1,
  "0":   1,
  "1":   3,
  "2":   5,
  "3":   5,
  "4":   7,
  "5":   9,
  "6":   9,
});

/**
 * Os nove scores que as tabelas do UBC de fato contêm, em ordem.
 *
 * Derivado do mapa, nunca escrito à mão: é a mesma lista, e duas cópias
 * divergiriam na primeira vez que a tabela mudasse.
 */
export const UBC_SCORE_DOMAIN = Object.freeze(
  Object.keys(UBC_TO_SAATY).map(Number).sort((a, b) => a - b),
);

/** Valor de saída da eliminação (−49) — o piso da escala, igual ao do toSaaty. */
export const UBC_ELIMINATION_VALUE = 0;

/** Extremos do domínio de SAÍDA. O 0 das eliminações fica abaixo do mínimo. */
export const UBC_SAATY_MIN = 1;
export const UBC_SAATY_MAX = 9;

/**
 * Converte um score clássico do UBC para a escala de Saaty.
 *
 * Total sobre o domínio confirmado e nada além dele: um valor fora da tabela
 * LANÇA em vez de receber um palpite. Mesmo espírito de toSaaty, e pelo mesmo
 * motivo — um score não previsto convertido por aproximação produziria um
 * número plausível e errado, que atravessaria o TOPSIS sem sintoma nenhum até
 * alguém conferir o ranking à mão. Se aparecer valor novo em ubcWeights.js, a
 * regra para ele é decisão do Francisco, não deste módulo.
 *
 * @param {number|null} score  score da tabela do UBC, ou null para célula sem valor
 * @returns {number|null} valor na escala de Saaty; null se a entrada for null
 * @throws {RangeError} se o score não for um dos nove do domínio confirmado
 */
export function toUbcScale(score) {
  // Célula vazia continua vazia — mesma convenção de toSaaty: converter um
  // valor ausente inventaria um score que a tabela não tem.
  if (score === null || score === undefined) return null;

  if (typeof score !== "number" || Number.isNaN(score)) {
    throw new RangeError(`[MMS] toUbcScale: score não numérico (${String(score)})`);
  }

  // `in` sobre a chave em string cobre o caso do −0, que viraria "0" e é o
  // mesmo score. Number.isInteger barra os fracionários antes: 2.0 é 2, mas
  // 2.5 não tem entrada e precisa cair no erro, não numa chave inexistente com
  // mensagem pior.
  const converted = Number.isInteger(score) ? UBC_TO_SAATY[String(score)] : undefined;
  if (converted === undefined) {
    throw new RangeError(
      `[MMS] toUbcScale: score ${score} fora do domínio confirmado do UBC ` +
      `(${UBC_SCORE_DOMAIN.join(", ")}). A regra de conversão para este valor ainda não foi definida.`,
    );
  }

  return converted;
}
