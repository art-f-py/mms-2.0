// RANKING MCDM PARA A TELA — formData + pesos de grupo -> ranking TOPSIS
//
// Camada fina entre o estado do app e o pipeline puro: monta a matriz do
// método de seleção pedido a partir do formulário, embrulha os pesos de grupo
// no estado de ponderação que o Enfoque espera, e roda o pipeline.
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

export const MCDM_STATUS = Object.freeze({
  OK:          "ok",
  UNAVAILABLE: "unavailable",
});

/**
 * Etapas do formulário que precisam estar completas para o ranking ter sentido.
 *
 * NÃO VARIA POR MÉTODO, e isso foi verificado e não presumido. Geometria e
 * geotécnica alimentam TODAS as colunas clássicas dos dois métodos liberados: o
 * Nicholas lê forma/espessura/mergulho/teor mais espaçamento e condição de
 * juntas por domínio; o UBC lê os mesmos quatro de geometria mais profundidade,
 * RSS (derivado de UCS/densidade/profundidade) e RMR por domínio. A
 * profundidade, único campo que o Nicholas não usa, já é coletada na etapa de
 * Geometria — requiredFieldsForStep a exige lá assim que UBC ou SH&B está
 * marcado. O primeiro método a precisar de uma terceira etapa é o SH&B, que lê
 * `oreValue` (etapa EESG) e segue bloqueado por outro motivo; quem o liberar
 * precisa transformar esta lista numa tabela por método.
 *
 * Complementar e revisar continuam de fora: não têm campo obrigatório (ver
 * requiredFieldsForStep em formRules.js).
 */
const REQUIRED_STEPS = [STEPS.GEOMETRY, STEPS.GEOTECHNICAL];

/**
 * Roda o pipeline MCDM, para o método de seleção pedido, a partir do formulário.
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
 *     matriz, embora runMcdmPipeline também a chame. Deixou de ser redundante
 *     quando a tela passou a oferecer mais de um método: é ela que transforma
 *     um `method` inválido (ou ausente) em "indisponível" antes de
 *     buildDecisionMatrix montar uma aba que ninguém sabe converter.
 *   - requireSheet          — método não marcado ao montar a matriz
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
 * POR QUE `method` ENTROU NUM OBJETO, E NÃO COMO QUARTO POSICIONAL. Com quatro
 * posicionais, quem só quisesse trocar o método seria obrigado a repetir o
 * `mode` para alcançá-lo — `deriveMcdmRanking(fd, w, WEIGHTING_MODES.ENFOQUE,
 * "ubc")` — e é exatamente o caso da comparação de cenários, que é Enfoque por
 * definição do modelo de cenário e não tem opinião sobre modo. Um objeto nomeado
 * deixa cada chamada dizendo só o que lhe importa.
 *
 * `method` NÃO TEM DEFAULT, de propósito. Um default "nicholas" faria uma
 * chamada que esqueceu de passar o método devolver um ranking plausível e do
 * método errado — o tipo de erro que ninguém percebe. Sem default, o esquecimento
 * cai em assertMcdmMethodSupported e vira "indisponível" com o motivo no console.
 *
 * @param {object} formData         estado do formulário (só leitura)
 * @param {object} groupWeights     { [groupId]: peso }, os quatro grupos somando
 *                                  1; ignorado quando `mode` é 'entropy'
 * @param {object} options
 * @param {string} [options.mode]   'enfoque' (default) ou 'entropy'
 * @param {string} options.method   chave do método de seleção ('nicholas', 'ubc')
 * @returns {{status: "ok", result: object}
 *          | {status: "unavailable", incompleteStep: string|null, error: Error|null}}
 */
export function deriveMcdmRanking(
  formData,
  groupWeights,
  { mode = WEIGHTING_MODES.ENFOQUE, method } = {},
) {
  // Fora do try, e sem console.error: formulário incompleto é ESTADO ESPERADO
  // do app (o usuário pode ainda estar preenchendo), não falha a depurar.
  const incompleteStep = REQUIRED_STEPS.find((stepId) => !isStepComplete(stepId, formData)) ?? null;
  if (incompleteStep) {
    return { status: MCDM_STATUS.UNAVAILABLE, incompleteStep, error: null };
  }

  try {
    assertMcdmMethodSupported(method);

    const matrix = buildDecisionMatrix(formData, { [method]: true });

    // Em modo 'entropy' os pesos saem dos dados, e setWeightingMode nem aceita
    // groupWeights fora do modo 'enfoque' (ver a guarda lá). Os pesos de grupo
    // continuam no estado do app, guardados e ignorados — é o que torna a
    // troca de modo reversível; ver defaultMcdmWeights em MmsContext.jsx.
    const weighting = mode === WEIGHTING_MODES.ENTROPY
      ? setWeightingMode(createWeightingState(), WEIGHTING_MODES.ENTROPY)
      : setWeightingMode(createWeightingState(), WEIGHTING_MODES.ENFOQUE, { groupWeights });

    const result = runMcdmPipeline(matrix, { method, weighting });

    return { status: MCDM_STATUS.OK, result };
  } catch (error) {
    // Silencioso para o USUÁRIO, não para quem for depurar: uma exceção
    // engolida sem rastro nenhum transformaria "o bloco sumiu" num mistério.
    // Mesmo prefixo [MMS] do resto do app.
    console.error("[MMS] ranking MCDM indisponível:", error);
    return { status: MCDM_STATUS.UNAVAILABLE, incompleteStep: null, error };
  }
}
