// RANKING MCDM PARA A TELA — formData + pesos de grupo -> ranking TOPSIS
//
// Camada fina entre o estado do app e o pipeline puro: monta a matriz do
// Nicholas a partir do formulário, embrulha os pesos de grupo no estado de
// ponderação que o Enfoque espera, e roda o pipeline.
//
// Vive fora do componente por dois motivos. O primeiro é teste: o projeto não
// tem infraestrutura de teste de componente React (vite.config.js roda em
// `environment: 'node'`, e não há Testing Library instalada), então a única
// forma de cobrir a integração formulário -> pipeline é ela ser uma função
// comum. O segundo é que um useMemo com try/catch dentro fica ilegível.
//
// Puro exceto pelo console.error do caminho de falha.

import { buildDecisionMatrix } from "../algorithms/decisionMatrix";
import { createWeightingState, setWeightingMode, WEIGHTING_MODES } from "../algorithms/enfoque";
import { assertMcdmMethodSupported, runMcdmPipeline } from "../algorithms/mcdmPipeline";
import { STEPS, isStepComplete } from "../data/formRules";

/**
 * Único método de seleção que o pipeline MCDM aceita nesta fase.
 *
 * Não é escolha desta camada — é o que MCDM_SUPPORTED_METHODS declara em
 * mcdmPipeline.js. A constante existe aqui só para não repetir a string.
 */
export const MCDM_SELECTION_METHOD = "nicholas";

export const MCDM_STATUS = Object.freeze({
  OK:          "ok",
  UNAVAILABLE: "unavailable",
});

/**
 * Etapas do formulário que precisam estar completas para o ranking ter sentido.
 *
 * Geometria e geotécnica são as que alimentam as 13 colunas clássicas da aba do
 * Nicholas. As outras não entram: EESG só existe para o SH&B, complementar e
 * revisar não têm campo obrigatório (ver requiredFieldsForStep em formRules.js).
 */
const REQUIRED_STEPS = [STEPS.GEOMETRY, STEPS.GEOTECHNICAL];

/**
 * Roda o pipeline MCDM para o Nicholas a partir do estado do formulário.
 *
 * NUNCA LANÇA. Toda falha vira o estado "indisponível", e o bloco na tela
 * mostra um aviso em vez de derrubar /statistics inteira — junto com os três
 * MethodBlock clássicos, que não têm nada a ver com o MCDM e continuariam
 * corretos. É a mesma escolha do botão de exportar matriz em Inputs.jsx: o
 * erro vai para o console, não para uma tela em branco.
 *
 * POR QUE A COMPLETUDE É CHECADA AQUI, E NÃO DEIXADA PARA O PIPELINE. Era de
 * se esperar que assertNoEmptyCells barrasse formulário incompleto — não
 * barra, e o motivo é que campo vazio nunca chega a virar célula vazia:
 * calculateNicholas DESCARTA o critério não preenchido (loga "[MMS] critério
 * descartado: ... não preenchido") e a coluna simplesmente não existe na aba.
 * Com o formulário todo vazio a aba sai com ZERO colunas clássicas, a extensão
 * acrescenta os seis critérios fixos, e o pipeline devolve — sem erro nenhum —
 * um ranking construído só sobre os critérios fixos, que não dependem de
 * nenhuma entrada do usuário. Um ranking assim é plausível à primeira vista e
 * completamente vazio de geologia: pior que nenhum ranking. Daí a guarda.
 *
 * A completude é decidida por isStepComplete, a MESMA regra que o formulário
 * usa para liberar o botão "Calcular" — não uma contagem de colunas esperadas,
 * que viraria um número mágico a divergir na primeira mudança de critério.
 *
 * As guardas que ainda podem disparar depois dela:
 *   - assertMcdmMethodSupported — chamada de propósito ANTES de montar a
 *     matriz, embora runMcdmPipeline também a chame. Hoje é redundante; se um
 *     dia a tela passar a oferecer UBC/SH&B, é aqui que a barreira aparece,
 *     sem depender de o pipeline continuar checando.
 *   - requireSheet          — Nicholas não marcado ao montar a matriz
 *   - validateGroupWeights  — pesos de grupo fora do contrato
 *
 * O QUE VAI EM `result`: a saída INTEIRA de runMcdmPipeline, sem filtro. Além
 * de `ranking`, isso inclui `sheet` (a aba já estendida e convertida — a matriz
 * que o motor de fato leu), `weights` (os pesos por critério ANTES da
 * normalização do TOPSIS, que é onde a repartição do Enfoque aparece) e
 * `criterionIds`. A matriz de decisão exibida na tela sai desses três, sem
 * nenhuma conta a mais — repassar o objeto inteiro em vez de escolher campos é
 * o que evita ter de mexer aqui a cada dado novo que a tela quiser mostrar.
 *
 * @param {object} formData      estado do formulário (só leitura)
 * @param {object} groupWeights  { [groupId]: peso }, os quatro grupos somando 1
 * @returns {{status: "ok", result: object}
 *          | {status: "unavailable", incompleteStep: string|null, error: Error|null}}
 */
export function deriveMcdmRanking(formData, groupWeights) {
  // Fora do try, e sem console.error: formulário incompleto é ESTADO ESPERADO
  // do app (o usuário pode ainda estar preenchendo), não falha a depurar.
  const incompleteStep = REQUIRED_STEPS.find((stepId) => !isStepComplete(stepId, formData)) ?? null;
  if (incompleteStep) {
    return { status: MCDM_STATUS.UNAVAILABLE, incompleteStep, error: null };
  }

  try {
    assertMcdmMethodSupported(MCDM_SELECTION_METHOD);

    const matrix    = buildDecisionMatrix(formData, { [MCDM_SELECTION_METHOD]: true });
    const weighting = setWeightingMode(createWeightingState(), WEIGHTING_MODES.ENFOQUE, { groupWeights });
    const result    = runMcdmPipeline(matrix, { method: MCDM_SELECTION_METHOD, weighting });

    return { status: MCDM_STATUS.OK, result };
  } catch (error) {
    // Silencioso para o USUÁRIO, não para quem for depurar: uma exceção
    // engolida sem rastro nenhum transformaria "o bloco sumiu" num mistério.
    // Mesmo prefixo [MMS] do resto do app.
    console.error("[MMS] ranking MCDM indisponível:", error);
    return { status: MCDM_STATUS.UNAVAILABLE, incompleteStep: null, error };
  }
}
