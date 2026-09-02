// CONVERSÃO DOS CRITÉRIOS CLÁSSICOS DO SH&B PARA A ESCALA DE VALORAÇÃO (1–9)
//
// Terceira e última das conversões clássicas, ao lado de saatyScale.js
// (Nicholas) e ubcScale.js (UBC). A tabela base → valoração é a MESMA do UBC —
// {−50,−25,−10,0..6} → {0,1,1,1,3,5,5,7,9,9} —, mas a entrada não é: as tabelas
// do SH&B não guardam a base, guardam a base JÁ MULTIPLICADA por um fator de
// importância do critério. Daí este módulo ter um passo que os outros dois não
// têm, e precisar saber DE QUE COLUNA o valor veio.
//
// POR QUE O FATOR EXISTE NO DADO. Nicholas e UBC guardam o score cru e aplicam
// o peso do critério depois; o SH&B publicou as tabelas com o peso embutido —
// "Piso/footwall" vale menos que "Zona mineralizada", e isso aparece como 1.32
// em vez de 3. Converter sem desfazer a multiplicação leria 1.32 como um score
// fora do domínio, e foi exatamente esse o motivo de o SH&B ter ficado de fora
// do pipeline até aqui (ver o histórico em MCDM_PENDING_METHODS).
//
// A DIVISÃO NÃO PERDE O PESO DO CRITÉRIO. Ela o tira do DADO, onde estava
// misturado ao score; a ponderação do MCDM é responsabilidade do Enfoque
// (enfoque.js), que reparte peso por GRUPO sobre a matriz já convertida. Deixar
// o fator embutido seria ponderar duas vezes, uma delas invisível.
//
// DUAS EXCEÇÕES, as duas confirmadas pelo Francisco e nenhuma delas uma regra:
//
//   −7 (uma única célula: Teto/hanging wall · RSS · "Muito fraca" · R&P) é um
//   ARTEFATO DE ESCALA da fonte original — o marcador −10 recebeu o fator 0,7
//   que só deveria valer para os scores. É tratado como o marcador −10 que
//   sempre foi, sem passar pela divisão. Verificado: ocorre exatamente uma vez
//   em 500 células, e é o único negativo fora de {−50,−25,−10}.
//
//   Econômico/oreValue · "Alto" · SQS traz bruto 4, cuja base seria 10 — fora
//   do domínio 0–6. O Francisco fixou o resultado final em 9 para essa célula
//   específica. Ver SQS_ORE_VALUE_OVERRIDE abaixo, e a guarda que impede o
//   override de sobreviver caladamente a uma mudança no dado.
//
// Puro: não lê estado global, não toca no DOM, não muta o que recebe.

import { SHB_ECONOMIC } from "./shbWeights";

/**
 * Fator de importância embutido em cada coluna clássica do SH&B.
 *
 * Chaveado pelo criterionId que a matriz de decisão usa — o `breakdownKey` para
 * os critérios com domínio geológico (rss_ob, rmr_hw, ...) e a própria chave
 * para os demais. É a mesma identidade que CLASSIC_CRITERIA usa, de propósito:
 * um id que resolve grupo lá tem de resolver fator aqui.
 */
const SHB_CRITERION_FACTOR = Object.freeze({
  shape:     1,
  thickness: 1,
  dip:       1,
  grade:     0.95,
  depth:     0.6,
  oreValue:  0.4,
  rss_ob:    0.875,
  rmr_ob:    0.875,
  rss_hw:    0.7,
  rmr_hw:    0.7,
  rss_fw:    0.44,
  rmr_fw:    0.44,
});

/**
 * A tabela base → valoração.
 *
 * MESMO conteúdo de UBC_TO_SAATY, escrito de novo em vez de importado: são duas
 * tabelas que hoje coincidem e têm donos diferentes. Compartilhar o objeto faria
 * uma revisão do Francisco no SH&B mudar o UBC sem ninguém pedir — e o −25, que
 * só o SH&B tem, já é uma diferença de domínio entre as duas.
 */
const SHB_BASE_TO_SCALE = Object.freeze({
  "-50": 0,
  "-25": 1,
  "-10": 1,
  "0":   1,
  "1":   3,
  "2":   5,
  "3":   5,
  "4":   7,
  "5":   9,
  "6":   9,
});

/** Marcadores de eliminação: entram na tabela SEM passar pela divisão. */
const SHB_MARKERS = Object.freeze([-50, -25, -10]);

/** O bruto −7 e o marcador que ele deveria ter sido. Ver o cabeçalho. */
export const SHB_SCALE_ARTIFACT = -7;
const SHB_SCALE_ARTIFACT_MARKER = -10;

/** Bases válidas fora dos marcadores — o domínio confirmado dos scores. */
const SHB_BASE_MIN = 0;
const SHB_BASE_MAX = 6;

/**
 * Tolerância na conferência da base reconstruída.
 *
 * As tabelas guardam o produto ARREDONDADO A DUAS CASAS: 3 × 0,875 está gravado
 * como 2.63, não 2.625, então a divisão devolve 3,00571 e não 3. O maior desvio
 * em todo o dataset é 0,0057 (rss_ob/"Muito fraca"/OP), e 0,01 o cobre com folga
 * sem chegar perto de 0,5, que é onde duas bases inteiras se confundiriam.
 */
const BASE_TOLERANCE = 0.01;

// ---------------------------------------------------------------------------
// EXCEÇÃO PONTUAL — Econômico/oreValue · "Alto" · SQS
// ---------------------------------------------------------------------------
export const SQS_ORE_VALUE_CRITERION = "oreValue";
export const SQS_ORE_VALUE_METHOD    = "SQS";
/** O bruto que a célula tem hoje, e a única entrada que o override aceita. */
export const SQS_ORE_VALUE_RAW       = 4;
/** O resultado final, dado direto pelo Francisco — não sai da fórmula. */
export const SQS_ORE_VALUE_OVERRIDE  = 9;

/** Índice do SQS nas tabelas do SH&B (ver o cabeçalho de shbWeights.js). */
const SQS_INDEX = 9;
/** A categoria em que a anomalia vive. As outras duas são normais. */
const SQS_ORE_VALUE_CATEGORY = "Alto";

/**
 * Guarda: o override continua descrevendo o dado que ele foi escrito para cobrir?
 *
 * O QUE ELA PROTEGE. O override é uma correção de UMA CÉLULA, não uma regra do
 * método. Se um dia a tabela do SH&B for revisada e o bruto de "Alto"/SQS deixar
 * de ser 4, aplicar 9 assim mesmo devolveria um número plausível para um dado
 * que mudou — o tipo de erro que atravessa o TOPSIS inteiro sem sintoma nenhum.
 * Falhar é a única saída honesta: o valor novo é decisão do Francisco.
 *
 * LÊ A FONTE, NÃO O ARGUMENTO. A checagem é contra shbWeights.js, e não contra o
 * `value` que chega em toShbScale, porque `value` NÃO identifica a célula: a
 * coluna oreValue/SQS vale 0 em "Baixo", 0,4 em "Médio" e 4 em "Alto", conforme
 * o que o usuário escolheu no formulário. Só a fonte sabe qual é a célula anômala.
 *
 * O parâmetro existe para o teste simular a mudança sem tocar no dado real.
 *
 * @param {number} [rawCell] bruto de "Alto"/SQS; default = o valor real da tabela
 * @throws {Error} se o dado mudou e o override precisa de revisão humana
 */
export function assertSqsOreValueCellUnchanged(
  rawCell = SHB_ECONOMIC.oreValue.options[SQS_ORE_VALUE_CATEGORY][SQS_INDEX],
) {
  if (rawCell !== SQS_ORE_VALUE_RAW) {
    throw new Error(
      `[MMS] toShbScale: o override de ${SQS_ORE_VALUE_CRITERION}/"${SQS_ORE_VALUE_CATEGORY}"/${SQS_ORE_VALUE_METHOD} ` +
      `vale para o bruto ${SQS_ORE_VALUE_RAW}, mas a tabela agora traz ${rawCell}. ` +
      `Este override é uma correção pontual do Francisco para uma célula específica, não uma regra: ` +
      `com o dado alterado, o valor convertido precisa ser reconfirmado antes de o pipeline voltar a rodar.`,
    );
  }
}

/**
 * Converte um valor clássico do SH&B para a escala de valoração 1–9.
 *
 * ASSINATURA DE TRÊS ARGUMENTOS, contra o único de toSaaty/toUbcScale. O
 * `criterionId` é indispensável (é ele que escolhe o fator); o `methodCode`
 * serve SÓ à exceção do SQS. O pipeline passa os três para as três conversões —
 * as outras duas ignoram o que sobra —, o que evita uma ramificação de aridade
 * no ponto em que a conversão é chamada.
 *
 * @param {number|null} value    valor bruto da tabela do SH&B
 * @param {string} criterionId   id da coluna (breakdownKey quando há domínio)
 * @param {string} [methodCode]  código do método de lavra ("OP", "SQS", ...)
 * @returns {number|null} valor na escala 1–9 (0 na eliminação); null se a entrada for null
 * @throws {RangeError} valor não numérico, criterionId desconhecido, ou base fora de 0–6
 * @throws {Error} se a célula do override do SQS mudou na fonte
 */
export function toShbScale(value, criterionId, methodCode) {
  // 1. Célula vazia continua vazia — mesma convenção de toSaaty e toUbcScale.
  if (value === null || value === undefined) return null;

  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new RangeError(`[MMS] toShbScale: valor não numérico (${String(value)})`);
  }

  // 2. O artefato de escala, ANTES de qualquer divisão: −7 nunca foi um score,
  //    é o marcador −10 com um fator aplicado por engano na fonte.
  if (value === SHB_SCALE_ARTIFACT) {
    return SHB_BASE_TO_SCALE[String(SHB_SCALE_ARTIFACT_MARKER)];
  }

  // 3. A exceção pontual do SQS. CONDICIONADA AO BRUTO 4, e não apenas ao par
  //    (oreValue, SQS): as categorias "Baixo" e "Médio" põem 0 e 0,4 nesta mesma
  //    coluna, e são scores normais que devem seguir pela fórmula geral. Um
  //    override cego ao valor devolveria 9 para as três.
  if (
    criterionId === SQS_ORE_VALUE_CRITERION &&
    methodCode === SQS_ORE_VALUE_METHOD &&
    value === SQS_ORE_VALUE_RAW
  ) {
    assertSqsOreValueCellUnchanged();
    return SQS_ORE_VALUE_OVERRIDE;
  }

  // 4. Marcadores de eliminação: lookup direto, sem dividir por fator.
  if (SHB_MARKERS.includes(value)) return SHB_BASE_TO_SCALE[String(value)];

  // 5. Caso geral: desfaz o fator e converte a base.
  const factor = SHB_CRITERION_FACTOR[criterionId];
  if (factor === undefined) {
    throw new RangeError(
      `[MMS] toShbScale: critério desconhecido "${String(criterionId)}" — sem fator declarado. ` +
      `Critérios com fator: ${Object.keys(SHB_CRITERION_FACTOR).join(", ")}.`,
    );
  }

  const base    = value / factor;
  const rounded = Math.round(base);

  if (Math.abs(base - rounded) > BASE_TOLERANCE || rounded < SHB_BASE_MIN || rounded > SHB_BASE_MAX) {
    throw new RangeError(
      `[MMS] toShbScale: o bruto ${value} em "${criterionId}" (fator ${factor}) dá base ${base}, ` +
      `que não é um inteiro de ${SHB_BASE_MIN} a ${SHB_BASE_MAX}. ` +
      `A regra de conversão para este valor ainda não foi definida.`,
    );
  }

  return SHB_BASE_TO_SCALE[String(rounded)];
}
