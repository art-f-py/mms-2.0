// MOTOR TOPSIS
// Hwang & Yoon (1981). Technique for Order of Preference by Similarity to Ideal Solution.
//
// Agnóstico: recebe uma matriz de decisão pronta (alternativas × critérios, com
// a direção de cada critério) e devolve o ranking. Não sabe o que é método de
// lavra, não conhece UBC/Nicholas/SH&B, não lê formulário nem toca no DOM.
// Puro — nada do que recebe é mutado.
//
// Por que TOPSIS e não outro motor: o passo 1 é uma normalização VETORIAL, que
// divide cada coluna pela própria norma euclidiana. Cada critério é tratado de
// forma independente, então colunas de escalas nativas muito diferentes (aqui:
// 1–5 nos critérios técnicos, 10–100 no índice de custo, 0–9 nos clássicos
// convertidos para Saaty) entram na conta em pé de igualdade, sem ninguém
// precisar reescalar nada à mão. Isso está fixado em teste, não é acidente.
//
// Os cinco passos:
//   1. normalização vetorial:  r_ij = x_ij / sqrt(Σ_i x_ij²)
//   2. ponderação:             v_ij = w_j · r_ij
//   3. soluções ideal e anti-ideal, por coluna, conforme a direção do critério
//   4. distâncias euclidianas de cada alternativa até as duas soluções
//   5. proximidade relativa:   C_i = d⁻_i / (d⁺_i + d⁻_i)

import { DIRECTION } from "./mcdmCriteria";

/**
 * Proximidade atribuída no empate degenerado.
 *
 * QUANDO DISPARA — e quando NÃO dispara. A condição é uma só: d⁺ + d⁻ = 0 para
 * a alternativa, o que só acontece quando ideal e anti-ideal coincidem em todas
 * as colunas, isto é, quando TODAS as alternativas são idênticas na matriz
 * ponderada. Aí C_i = d⁻/(d⁺+d⁻) seria 0/0.
 *
 * Não é o caminho de célula vazia nem o de direção ausente: os dois são
 * recusados por validate() com RangeError, antes de qualquer conta. Célula
 * vazia virando esta constante seria justamente o silêncio que aquela validação
 * existe para impedir. Vale registrar porque a confusão é fácil de fazer.
 *
 * POR QUE 0. Não porque seja matematicamente mais correto que 0.5 — não é. O
 * empate total é uma indeterminação, e mais de uma convenção é defensável: 0.5,
 * que esta constante já usou, tem a leitura razoável de "à mesma distância dos
 * dois extremos, logo o ponto médio". O motivo é outro, e é de fidelidade: 0 é
 * o valor do motor de referência do Francisco (portado de funciones_mcdm.R e
 * validado contra o R real), e a decisão do projeto é seguir a convenção do
 * motor original sempre que não houver motivo técnico para divergir. Aqui não
 * há: o caso é ranking-inerte (ver abaixo), então alinhar não custa nada em
 * comportamento e evita que os dois motores respondam diferente ao mesmo dado.
 *
 * NÃO PRECISA DE CONFIRMAÇÃO EXTERNA — e é por isso que não entra em
 * PENDING_CONFIRMATION junto do TS_PERFORMANCE_ESTIMATED. Os dois casos são de
 * naturezas diferentes: o do Top Slicing é um dado que existe no mundo e falta
 * na planilha, então só o Francisco pode fechar. Este é uma convenção sobre uma
 * indeterminação matemática, e é inerte quanto a ranking: com todas as
 * alternativas empatadas, QUALQUER constante produz exatamente a mesma
 * ordenação — está fixado em teste. Trocar este número não muda nenhuma decisão
 * do app; muda só o valor exibido num cenário em que ele não distingue ninguém.
 * Foi justamente essa inércia que permitiu adotar a convenção da referência sem
 * precisar de validação de domínio.
 *
 * (Este comentário já apontou o DEFAULT_BOOST do Enfoque como a constante que
 * de fato merecia validação externa, por contraste com esta. O contraste morreu
 * dos dois lados: o DEFAULT_BOOST deixou de existir — o Enfoque trocou o boost
 * multiplicativo por peso de grupo declarado pelo usuário — e esta constante
 * não se sustenta mais como "valor forçado pela definição", e sim como escolha
 * entre convenções, resolvida por fidelidade ao motor original.)
 */
export const DEGENERATE_CLOSENESS = 0;

/**
 * Pesos iguais somando 1, um por critério.
 * Default quando o chamador não passa pesos — TOPSIS sem ponderação declarada.
 */
export function equalWeights(count) {
  return Array.from({ length: count }, () => 1 / count);
}

/**
 * Normaliza pesos para somarem 1.
 *
 * Escalar todos os pesos por uma constante multiplica d⁺ e d⁻ pela mesma
 * constante e deixa C_i intacto, então isto não muda ranking nenhum. Serve para
 * que a proximidade seja comparável entre execuções com pesos de magnitudes
 * diferentes — o modo 'none' do Enfoque devolve 1 para cada critério (soma = n),
 * e o modo 'enfoque' devolve pesos que já somam 1.
 */
export function normalizeWeights(weights) {
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) {
    throw new RangeError("[MMS] topsis: a soma dos pesos precisa ser positiva");
  }
  return weights.map((w) => w / total);
}

/**
 * Checagem de forma, feita ANTES de resolver os pesos.
 *
 * A ordem importa: com zero critérios o default de pesos iguais sai vazio e a
 * normalização estouraria com "a soma dos pesos precisa ser positiva" — uma
 * mensagem que não descreve o problema real de quem chamou.
 */
function validateShape(alternatives, criteria) {
  if (!Array.isArray(alternatives) || alternatives.length === 0) {
    throw new RangeError("[MMS] topsis: é preciso ao menos uma alternativa");
  }
  if (!Array.isArray(criteria) || criteria.length === 0) {
    throw new RangeError("[MMS] topsis: é preciso ao menos um critério");
  }
}

function validate(alternatives, criteria, matrix, weights) {
  validateShape(alternatives, criteria);

  if (matrix.length !== alternatives.length) {
    throw new RangeError(
      `[MMS] topsis: a matriz tem ${matrix.length} linhas para ${alternatives.length} alternativas`,
    );
  }
  matrix.forEach((row, i) => {
    if (row.length !== criteria.length) {
      throw new RangeError(
        `[MMS] topsis: linha ${i} tem ${row.length} colunas para ${criteria.length} critérios`,
      );
    }
    row.forEach((value, j) => {
      if (typeof value !== "number" || Number.isNaN(value)) {
        // Célula vazia não pode virar zero silenciosamente: zero é um score, e
        // num critério de minimizar seria o valor ÓTIMO. O chamador precisa
        // decidir o que fazer com o buraco antes de chegar aqui.
        throw new RangeError(
          `[MMS] topsis: célula não numérica em [${i}][${j}] (${String(value)})`,
        );
      }
    });
  });
  criteria.forEach((criterion, j) => {
    if (criterion.direction !== DIRECTION.MIN && criterion.direction !== DIRECTION.MAX) {
      throw new RangeError(
        `[MMS] topsis: critério ${criterion.id ?? j} sem direção válida (${String(criterion.direction)})`,
      );
    }
  });
  if (weights.length !== criteria.length) {
    throw new RangeError(
      `[MMS] topsis: ${weights.length} pesos para ${criteria.length} critérios`,
    );
  }
}

/**
 * Roda o TOPSIS sobre uma matriz de decisão.
 *
 * @param {object}   input
 * @param {string[]} input.alternatives  ids/rótulos das linhas
 * @param {Array<{id?: string, direction: string}>} input.criteria  colunas, com direção
 * @param {number[][]} input.matrix      valores brutos, linha por alternativa
 * @param {number[]} [input.weights]     um peso por critério; default = iguais
 * @returns {{
 *   ranking: Array<{id: string, index: number, rank: number, closeness: number, distanceToIdeal: number, distanceToAntiIdeal: number}>,
 *   closeness: number[], normalized: number[][], weighted: number[][],
 *   ideal: number[], antiIdeal: number[], weights: number[]
 * }}
 *   `ranking` sai ordenado do melhor para o pior; os demais campos seguem a
 *   ordem original das alternativas e existem para inspeção e teste dos passos
 *   intermediários.
 */
export function topsis({ alternatives, criteria, matrix, weights }) {
  validateShape(alternatives, criteria);
  const w = normalizeWeights(weights ?? equalWeights(criteria.length));
  validate(alternatives, criteria, matrix, w);

  const nRows = alternatives.length;
  const nCols = criteria.length;

  // Passo 1 — normalização vetorial, coluna a coluna.
  const norms = Array.from({ length: nCols }, (_, j) =>
    Math.sqrt(matrix.reduce((sum, row) => sum + row[j] * row[j], 0)),
  );
  const normalized = matrix.map((row) =>
    // Coluna inteiramente zerada tem norma zero: normalizar seria dividir por
    // zero. A coluna é constante, logo não diferencia ninguém — fica em zero e
    // sai da disputa por construção.
    row.map((value, j) => (norms[j] === 0 ? 0 : value / norms[j])),
  );

  // Passo 2 — ponderação.
  const weighted = normalized.map((row) => row.map((value, j) => value * w[j]));

  // Passo 3 — ideal e anti-ideal, respeitando a direção de cada critério.
  const ideal = [];
  const antiIdeal = [];
  for (let j = 0; j < nCols; j++) {
    const column = weighted.map((row) => row[j]);
    const max = Math.max(...column);
    const min = Math.min(...column);
    const maximize = criteria[j].direction === DIRECTION.MAX;
    ideal[j]     = maximize ? max : min;
    antiIdeal[j] = maximize ? min : max;
  }

  // Passo 4 — distâncias euclidianas até as duas soluções.
  const distance = (row, reference) =>
    Math.sqrt(row.reduce((sum, value, j) => sum + (value - reference[j]) ** 2, 0));

  const distanceToIdeal     = weighted.map((row) => distance(row, ideal));
  const distanceToAntiIdeal = weighted.map((row) => distance(row, antiIdeal));

  // Passo 5 — proximidade relativa.
  const closeness = Array.from({ length: nRows }, (_, i) => {
    const spread = distanceToIdeal[i] + distanceToAntiIdeal[i];
    return spread === 0 ? DEGENERATE_CLOSENESS : distanceToAntiIdeal[i] / spread;
  });

  const ranking = alternatives
    .map((id, index) => ({
      id,
      index,
      closeness: closeness[index],
      distanceToIdeal:     distanceToIdeal[index],
      distanceToAntiIdeal: distanceToAntiIdeal[index],
    }))
    // Empate desempata pela ordem original — ranking estável, não dependente da
    // implementação de sort do motor JS.
    .sort((a, b) => (b.closeness - a.closeness) || (a.index - b.index))
    .map((entry, position) => ({ ...entry, rank: position + 1 }));

  return { ranking, closeness, normalized, weighted, ideal, antiIdeal, weights: w };
}
