// MCDM — CRITÉRIOS FIXOS POR MÉTODO DE LAVRA
// Fonte: tabela_pesos_francisco.xlsx, aba "Hoja1" (Francisco Vargas).
//
// Ordem dos métodos (índice fixo):
// 0:OP  1:BC  2:SLS  3:SLC  4:LW  5:R&P  6:SKS  7:C&F  8:TS  9:SQS
//
// Estes seis critérios descrevem o MÉTODO DE LAVRA em si, não o depósito: ao
// contrário de tudo que UBC/Nicholas/SH&B pontuam, o valor não depende de nada
// que o usuário preencha no formulário. Por isso são uma tabela de referência
// fixa, no mesmo formato das tabelas de peso já existentes (chave → array
// indexado pela ordem de METHODS).
//
// ATENÇÃO NA MANUTENÇÃO: a planilha de origem lista SQS na penúltima linha e TS
// na última — o inverso de METHODS. Os arrays abaixo já estão reordenados para
// a ordem de METHODS. Ao reconferir contra a planilha, comparar por código de
// método, nunca por posição de linha.

import { METHODS } from "./ubcWeights";

/**
 * Direção de otimização de um critério.
 *
 * Constante explícita, e não inferida do nome do critério em runtime: é o dado
 * que diz ao TOPSIS qual extremo é a solução ideal. Errar a direção de uma
 * coluna inverte silenciosamente o ranking, sem nenhum sintoma visível.
 */
export const DIRECTION = Object.freeze({
  MIN: "min",
  MAX: "max",
});

/**
 * Os quatro grupos do Enfoque.
 *
 * Cobrem as DUAS fontes de critérios da matriz estendida: TECHNICAL e ECONOMIC
 * agrupam os seis critérios fixos declarados neste arquivo; GEOMETRY e
 * GEOMECHANICS agrupam os treze critérios clássicos do Nicholas, cujos
 * descritores vivem em classicCriteria.js (tabela paralela, porque as chaves
 * das tabelas de peso não são únicas — ver o cabeçalho de lá).
 *
 * Os ids internos de TECHNICAL e ECONOMIC são deliberadamente estáveis: os
 * critérios fixos referenciam esses valores no campo `group` logo abaixo, e o
 * redesenho do Enfoque para quatro grupos mudou só o RÓTULO de exibição deles.
 * Trocar o id obrigaria a mexer em FIXED_CRITERIA sem nenhum ganho.
 */
export const CRITERION_GROUPS = Object.freeze({
  GEOMETRY:     "geometry",
  GEOMECHANICS: "geomechanics",
  TECHNICAL:    "technical",
  ECONOMIC:     "economic",
});

/**
 * Rótulos de exibição dos grupos.
 *
 * Em português, ao contrário dos rótulos de CRITÉRIO deste arquivo e de
 * EXPORT_CRITERION_LABELS, que são em inglês por irem para um arquivo de dados
 * lido por outro software. A diferença é proposital: nome de grupo do Enfoque
 * não vai para a planilha — é controle de interface, e foi nomeado pelo usuário
 * nestes termos. Fora do i18n como todo o resto deste módulo; se um dia o
 * Enfoque virar tela traduzida, estes rótulos são o ponto de entrada.
 */
export const CRITERION_GROUP_LABELS = Object.freeze({
  [CRITERION_GROUPS.GEOMETRY]:     "Geometria",
  [CRITERION_GROUPS.GEOMECHANICS]: "Geomecânica",
  [CRITERION_GROUPS.TECHNICAL]:    "Técnico-Operacional",
  [CRITERION_GROUPS.ECONOMIC]:     "Economia",
});

/**
 * Os seis critérios fixos, com grupo e direção.
 *
 * Rótulos em inglês e fora do sistema de i18n, pela mesma razão de
 * EXPORT_CRITERION_LABELS em decisionMatrix.js: o destino é um arquivo de dados
 * lido por outro software, não a interface.
 */
export const FIXED_CRITERIA = Object.freeze([
  // Técnico
  { id: "performance",  label: "Performance",  group: CRITERION_GROUPS.TECHNICAL, direction: DIRECTION.MAX },
  { id: "productivity", label: "Productivity", group: CRITERION_GROUPS.TECHNICAL, direction: DIRECTION.MAX },
  { id: "recovery",     label: "Recovery",     group: CRITERION_GROUPS.TECHNICAL, direction: DIRECTION.MAX },
  { id: "dilution",     label: "Dilution",     group: CRITERION_GROUPS.TECHNICAL, direction: DIRECTION.MIN },
  // Econômico
  { id: "capitalInvestment", label: "Capital Investment", group: CRITERION_GROUPS.ECONOMIC, direction: DIRECTION.MIN },
  { id: "comparativeCosts",  label: "Comparative Costs",  group: CRITERION_GROUPS.ECONOMIC, direction: DIRECTION.MIN },
]);

// ---------------------------------------------------------------------------
// !!! PENDÊNCIA — CONFIRMAR COM O FRANCISCO ANTES DE PRODUÇÃO !!!
// ---------------------------------------------------------------------------
// A célula de "desempenho" do Top Slicing está VAZIA na planilha original do
// Francisco. O valor 2 usado abaixo é uma ESTIMATIVA do Artur, obtida cruzando
// a correlação interna da própria tabela com a bibliografia (o Nicholas
// original descreve TS com as piores características de mecânica de rochas;
// dois estudos de caso reais o colocam perto do fim do ranking composto; um
// terceiro o trata como método largamente obsoleto).
//
// NÃO é dado do Francisco. Precisa ser confirmado ou substituído por ele antes
// de ir para produção. Está isolado nesta constante de propósito: nenhum outro
// ponto do código deve repetir esse número como se fosse definitivo.
export const TS_PERFORMANCE_ESTIMATED = 2;

/**
 * Lista legível por máquina do que ainda não é dado confirmado.
 *
 * Existe para que a camada de exportação/UI possa marcar a célula na tela ou na
 * planilha sem ninguém precisar lembrar da pendência de cabeça.
 */
export const PENDING_CONFIRMATION = Object.freeze([
  Object.freeze({
    criterionId: "performance",
    method:      "TS",
    value:       TS_PERFORMANCE_ESTIMATED,
    reason:      "Célula vazia na planilha do Francisco; valor estimado pelo Artur, não confirmado.",
  }),
]);

/**
 * Scores fixos: critério → array de 10 valores, na ordem de METHODS.
 *
 * As escalas nativas são deliberadamente diferentes entre colunas — os cinco
 * primeiros critérios vêm em 1–5 e `comparativeCosts` em 10–100 (índice de
 * custo relativo, com OP = 10 como base). Não são normalizados aqui: a
 * normalização vetorial do TOPSIS é justamente quem resolve isso, e converter
 * antes da hora perderia informação.
 */
export const FIXED_CRITERION_SCORES = Object.freeze({
  //                    OP  BC  SLS SLC LW  R&P SKS C&F TS  SQS
  performance:       Object.freeze([3, 1, 2, 2, 2, 3, 3, 2, TS_PERFORMANCE_ESTIMATED, 1]),
  productivity:      Object.freeze([4, 3, 3, 3, 3, 3, 2, 2, 2, 1]),
  recovery:          Object.freeze([4, 4, 3, 4, 4, 3, 4, 4, 4, 5]),
  dilution:          Object.freeze([3, 4, 3, 3, 2, 3, 2, 2, 4, 1]),
  capitalInvestment: Object.freeze([4, 3, 2, 2, 3, 3, 1, 2, 2, 1]),
  comparativeCosts:  Object.freeze([10, 25, 40, 50, 40, 30, 55, 60, 70, 100]),
});

/** Índice id → definição do critério, para lookup sem varrer o array. */
export const FIXED_CRITERIA_BY_ID = Object.freeze(
  Object.fromEntries(FIXED_CRITERIA.map((c) => [c.id, c])),
);

/**
 * Ids dos critérios FIXOS de um grupo, na ordem de FIXED_CRITERIA.
 *
 * Cobre só este arquivo. Para GEOMETRY e GEOMECHANICS devolve array vazio —
 * esses grupos são compostos de critérios clássicos, que vivem em
 * classicCriteria.js. Quem precisa da composição completa de um grupo usa
 * ENFOQUE_GROUPS (enfoque.js), que junta as duas fontes.
 */
export function criteriaOfGroup(groupId) {
  return FIXED_CRITERIA.filter((c) => c.group === groupId).map((c) => c.id);
}

/**
 * Score fixo de um método num critério.
 *
 * @param {string} criterionId  id em FIXED_CRITERIA
 * @param {string} methodCode   código em METHODS (ex: "OP")
 * @returns {number}
 */
export function fixedScore(criterionId, methodCode) {
  const column = FIXED_CRITERION_SCORES[criterionId];
  if (!column) throw new Error(`[MMS] critério fixo desconhecido: ${criterionId}`);

  const index = METHODS.indexOf(methodCode);
  if (index === -1) throw new Error(`[MMS] método de lavra desconhecido: ${methodCode}`);

  return column[index];
}

/**
 * Os critérios fixos como bloco de matriz de decisão: uma linha por método, na
 * ordem de METHODS, e uma coluna por critério, na ordem de FIXED_CRITERIA.
 *
 * Puro: monta arrays novos a cada chamada, nada compartilhado com a tabela.
 */
export function fixedCriteriaMatrix() {
  return METHODS.map((code) =>
    FIXED_CRITERIA.map((criterion) => fixedScore(criterion.id, code)),
  );
}
