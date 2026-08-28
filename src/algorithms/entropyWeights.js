// PONDERAÇÃO POR ENTROPIA DE SHANNON — PESOS TIRADOS DOS PRÓPRIOS DADOS
//
// Alternativa ao Enfoque, e o oposto dele em espírito. No Enfoque quem decide o
// que importa é o usuário: ele reparte 1.0 entre os quatro grupos e a tela
// obedece. Aqui ninguém decide — o peso de um critério sai da DISPERSÃO da
// coluna dele. Critério em que os dez métodos pontuam quase igual não separa
// ninguém e recebe peso baixo; critério que espalha os métodos recebe peso alto.
//
// O procedimento, na forma clássica (Shannon):
//
//   1. Normaliza cada coluna pela sua soma:   p_ij = x_ij / Σ_i x_ij
//   2. Entropia da coluna:                    e_j  = -(1/ln m) · Σ_i p_ij·ln(p_ij)
//   3. Grau de diversificação:                d_j  = 1 - e_j
//   4. Peso:                                  w_j  = d_j / Σ_j d_j
//
// O fator 1/ln(m) normaliza a entropia para [0, 1]: ln(m) é a entropia máxima de
// m alternativas, atingida quando todas têm o mesmo p. Assim e_j = 1 significa
// coluna perfeitamente uniforme (d_j = 0, peso zero) e e_j = 0 significa toda a
// massa numa alternativa só.
//
// DIREÇÃO (MIN/MAX) NÃO ENTRA AQUI, e isso é da natureza do método, não uma
// simplificação. Entropia mede o quanto uma coluna DISCRIMINA, não o que nela é
// bom: inverter a direção de um critério não muda a dispersão dos seus valores,
// e portanto não pode mudar o peso dele. Quem sabe o que é melhor é o TOPSIS,
// no passo seguinte, quando escolhe a solução ideal e a anti-ideal. Misturar as
// duas coisas aqui daria pesos que dependem de para que lado se olha.
//
// 0·ln(0) = 0 — convenção padrão da teoria da informação, e não um caso
// especial inventado para não dividir por zero. O limite de p·ln(p) quando p→0
// é 0; uma alternativa com pontuação nula simplesmente não contribui para a
// entropia daquela coluna.
//
// Puro: não lê estado global, não toca no DOM, não muta o que recebe.

/**
 * Abaixo disto, a soma dos graus de diversificação é tratada como zero.
 *
 * Existe pelo mesmo motivo do REBALANCE_NEAR_ZERO em enfoqueRebalance.js: a
 * soma chega aqui depois de logaritmos e divisões, e um caso que é
 * matematicamente 0 (toda coluna uniforme) costuma sair como resíduo da ordem
 * de 1e-16, não como zero exato. Comparar com 0 exato deixaria o caso degenerado
 * passar batido e produziria pesos dominados por ruído de arredondamento.
 */
export const ENTROPY_NEAR_ZERO = 1e-12;

/**
 * Pesos por entropia de Shannon, um por critério.
 *
 * O QUE ELE LANÇA, E POR QUÊ NÃO TEM FALLBACK. Uma coluna inteiramente zerada
 * não é normalizável — p_ij seria 0/0. Devolver NaN ali espalharia NaN por toda
 * a matriz ponderada do TOPSIS e o sintoma apareceria longe da causa, como um
 * ranking sem sentido em vez de um erro. Não é esperado que aconteça com dados
 * reais (a escala de Saaty começa em 1), e é exatamente por isso que, se
 * acontecer, precisa ser barulhento.
 *
 * CASO DEGENERADO — TODA COLUNA UNIFORME. Se todos os d_j forem zero, nenhum
 * critério discrimina nada e Σd = 0. Devolve pesos uniformes. É a mesma classe
 * de decisão do DEGENERATE_CLOSENESS em topsis.js, e vale repetir o argumento
 * de lá: é convenção interna sobre uma indeterminação matemática, não número de
 * calibragem. Com todas as colunas igualmente (não) informativas, QUALQUER
 * vetor de pesos produz a mesma ordenação — o uniforme é só o único que não
 * finge preferir um critério sem ter motivo.
 *
 * @param {{rows: Array<{values: number[]}>}} sheet  aba já estendida e convertida
 * @param {string[]} criterionIds  ids na ordem das colunas; usados para nomear o
 *                                 critério no erro e para conferir a largura
 * @returns {number[]} um peso por critério, somando 1
 * @throws {RangeError} aba vazia, largura inconsistente, coluna zerada ou negativa
 */
export function calculateEntropyWeights(sheet, criterionIds) {
  const rows = sheet?.rows ?? [];
  const m    = rows.length;
  const n    = criterionIds.length;

  if (m === 0) {
    throw new RangeError("[MMS] Entropy: aba sem alternativas — não há dispersão a medir.");
  }
  // Uma alternativa só: ln(1) = 0 e o fator 1/ln(m) explode. Também não há o que
  // medir — com uma linha, nenhuma coluna discrimina coisa alguma.
  if (m === 1) {
    throw new RangeError("[MMS] Entropy: uma única alternativa — a entropia não é definida (ln 1 = 0).");
  }

  for (const row of rows) {
    if (row.values.length !== n) {
      throw new RangeError(
        `[MMS] Entropy: a aba tem ${row.values.length} colunas e foram passados ${n} ids de critério. ` +
        "Sem correspondência entre os dois, o peso iria para o critério errado.",
      );
    }
  }

  // Passo 1 — soma de cada coluna, com as duas guardas.
  const colSums = criterionIds.map((id, j) => {
    let soma = 0;
    for (const row of rows) {
      const valor = row.values[j];
      if (typeof valor !== "number" || !Number.isFinite(valor)) {
        throw new RangeError(`[MMS] Entropy: valor não numérico na coluna "${id}".`);
      }
      // Valor negativo faria ln(p) com p negativo = NaN. Mesma escolha da coluna
      // zerada: barulhento em vez de silencioso.
      if (valor < 0) {
        throw new RangeError(
          `[MMS] Entropy: valor negativo (${valor}) na coluna "${id}". ` +
          "A normalização por soma pressupõe valores não negativos.",
        );
      }
      soma += valor;
    }
    if (soma === 0) {
      throw new RangeError(
        `[MMS] Entropy: a coluna "${id}" soma zero — todas as alternativas estão zeradas nela, ` +
        "e não há como normalizá-la (0/0).",
      );
    }
    return soma;
  });

  const lnM = Math.log(m);

  // Passos 2 e 3 — entropia e diversificação, coluna a coluna.
  const d = criterionIds.map((_, j) => {
    let somaPlnP = 0;
    for (const row of rows) {
      const p = row.values[j] / colSums[j];
      // 0·ln(0) = 0, o limite conhecido. Sem isto, ln(0) = -Infinity e o
      // produto viria NaN.
      if (p > 0) somaPlnP += p * Math.log(p);
    }
    const e = -somaPlnP / lnM;

    // e_j ≤ 1 por construção, mas o arredondamento pode devolver 1 + 1e-16 numa
    // coluna perfeitamente uniforme, e daí um d_j negativo — que viraria peso
    // negativo. O clamp corta só o ruído.
    return Math.max(0, 1 - e);
  });

  // Passo 4 — normalização.
  const somaD = d.reduce((acc, valor) => acc + valor, 0);
  if (somaD <= ENTROPY_NEAR_ZERO) {
    return criterionIds.map(() => 1 / n);
  }

  return d.map((valor) => valor / somaD);
}
