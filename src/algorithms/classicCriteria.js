// DESCRITORES DOS CRITÉRIOS CLÁSSICOS (NICHOLAS + UBC)
//
// Tabela PARALELA às tabelas de peso: nicholasWeights.js continua sendo dado
// puro (valor selecionado → 10 scores), e o metadado de agrupamento mora aqui.
//
// POR QUE PARALELA, E NÃO UM CAMPO `group` DENTRO DE nicholasWeights.js: lá as
// chaves não são únicas. `rss`, `jointSpacing` e `jointCondition` existem três
// vezes cada, uma em NICHOLAS_OREBODY, outra em NICHOLAS_HANGINGWALL e outra em
// NICHOLAS_FOOTWALL. Um `group:` inline teria de ser repetido nas três, criando
// três fontes de verdade que divergiriam na primeira manutenção. A chave que É
// única é o `breakdownKey` que sumCriteria monta (`rss_ob`, `rss_hw`,
// `rss_fw`) — e é exatamente ele que chega ao pipeline como `criterionKeys`.
// Por isso a tabela abaixo é keyed por breakdownKey.
//
// FORMATO: espelha FIXED_CRITERIA de mcdmCriteria.js, menos o `direction`. A
// direção dos critérios clássicos não é declarada em lugar nenhum porque é
// uniforme — todos são de maximizar — e sheetCriteriaDirections já resolve isso
// por default em decisionMatrix.js. Declarar aqui criaria uma segunda fonte de
// verdade para a mesma informação.
//
// ESCOPO: Nicholas e UBC. Falta só o SH&B, que segue bloqueado enquanto a
// conversão de escala dele não estiver definida (ver MCDM_PENDING_METHODS em
// mcdmPipeline.js); quando entrar, o critério exclusivo dele (`oreValue`) vai
// precisar de entrada aqui — hoje não aparece em nenhuma coluna que o pipeline
// produza.
//
// A TABELA É UMA SÓ PARA OS DOIS MÉTODOS, e não uma por método, porque a
// pergunta que ela responde — "a que grupo de Enfoque este critério pertence?"
// — não depende de quem montou a coluna. `shape` é Geometria no Nicholas e no
// UBC; `rss_ob` é Geomecânica nos dois. Sete dos onze ids do UBC já estavam
// aqui por causa do Nicholas e resolvem para o grupo certo sem nenhuma
// adaptação — os quatro exclusivos do UBC entram no fim da lista.
//
// O QUE DEPENDE DO MÉTODO É O TAMANHO DO GRUPO, não a pertinência: o Nicholas
// traz 4 critérios de Geometria e 9 de Geomecânica, o UBC traz 5 e 6. Isso é
// resolvido em applyEnfoque (enfoque.js), contando os critérios presentes na
// matriz que está sendo ponderada — ver o comentário lá.

import { CRITERION_GROUPS } from "./mcdmCriteria";

/**
 * Os critérios clássicos, com o grupo de Enfoque de cada um.
 *
 * 13 do Nicholas seguidos dos 4 exclusivos do UBC — 17 entradas para 24
 * colunas de matriz (19 do Nicholas e 17 do UBC, com 11 ids em comum e os 6
 * fixos vindo de FIXED_CRITERIA). A ordem dentro de cada bloco é a mesma em que
 * o `calculate*` correspondente monta as colunas. Não é obrigatório que seja —
 * nada depende de posição aqui —, mas ler a tabela lado a lado com a matriz é
 * bem mais fácil assim.
 */
export const CLASSIC_CRITERIA = Object.freeze([
  // Geometria — os quatro de NICHOLAS_GEOMETRY. Instância única: não têm
  // variante por domínio geológico no método (não existe "forma do hanging
  // wall"), e é por isso que este grupo não admite o sub-modo de divisão.
  Object.freeze({ id: "shape",              group: CRITERION_GROUPS.GEOMETRY }),
  Object.freeze({ id: "thickness",          group: CRITERION_GROUPS.GEOMETRY }),
  Object.freeze({ id: "dip",                group: CRITERION_GROUPS.GEOMETRY }),
  Object.freeze({ id: "grade",              group: CRITERION_GROUPS.GEOMETRY }),

  // Geomecânica — os três critérios de NICHOLAS_OREBODY, NICHOLAS_HANGINGWALL e
  // NICHOLAS_FOOTWALL, nove ao todo. Ver a pendência logo abaixo da tabela.
  Object.freeze({ id: "rss_ob",             group: CRITERION_GROUPS.GEOMECHANICS }),
  Object.freeze({ id: "jointSpacing_ob",    group: CRITERION_GROUPS.GEOMECHANICS }),
  Object.freeze({ id: "jointCondition_ob",  group: CRITERION_GROUPS.GEOMECHANICS }),
  Object.freeze({ id: "rss_hw",             group: CRITERION_GROUPS.GEOMECHANICS }),
  Object.freeze({ id: "jointSpacing_hw",    group: CRITERION_GROUPS.GEOMECHANICS }),
  Object.freeze({ id: "jointCondition_hw",  group: CRITERION_GROUPS.GEOMECHANICS }),
  Object.freeze({ id: "rss_fw",             group: CRITERION_GROUPS.GEOMECHANICS }),
  Object.freeze({ id: "jointSpacing_fw",    group: CRITERION_GROUPS.GEOMECHANICS }),
  Object.freeze({ id: "jointCondition_fw",  group: CRITERION_GROUPS.GEOMECHANICS }),

  // Exclusivos do UBC. `depth` é a profundidade classificada (UBC_GEOMETRY);
  // os três `rmr_*` são a classe de maciço por domínio geológico, o critério
  // que o UBC tem e o Nicholas não. Os outros 7 ids do UBC (shape, thickness,
  // dip, grade, rss_ob, rss_hw, rss_fw) já estão acima, vindos do Nicholas, e
  // valem para os dois sem duplicata.
  Object.freeze({ id: "depth",              group: CRITERION_GROUPS.GEOMETRY }),
  Object.freeze({ id: "rmr_ob",             group: CRITERION_GROUPS.GEOMECHANICS }),
  Object.freeze({ id: "rmr_hw",             group: CRITERION_GROUPS.GEOMECHANICS }),
  Object.freeze({ id: "rmr_fw",             group: CRITERION_GROUPS.GEOMECHANICS }),
]);

// ---------------------------------------------------------------------------
// !!! PENDÊNCIA — SUB-MODO DE DOMÍNIO DA GEOMECÂNICA, TAREFA FUTURA !!!
// ---------------------------------------------------------------------------
// Os nove critérios de Geomecânica se dividem naturalmente em três domínios
// geológicos — corpo de minério (ob), hanging wall (hw) e foot wall (fw), três
// critérios cada. A visão final prevê um sub-modo OPCIONAL em que o peso do
// grupo Geomecânica é repartido entre os domínios em vez de dividido igualmente
// entre os nove, reaproveitando os DOMAIN_PRESETS que já existem em
// MmsContext.jsx.
//
// ISSO NÃO ESTÁ IMPLEMENTADO E NÃO DEVE SER ASSUMIDO. Nesta fase a Geomecânica
// se comporta como grupo único: o peso do grupo se divide igualmente entre os
// critérios de Geomecânica presentes na matriz (9 no Nicholas, 6 no UBC). Quem for
// implementar o sub-modo precisa resolver antes uma questão de desenho que está
// em aberto — hoje já existem DUAS camadas ponderando geo/ob/hw/fw (os
// multiplicadores `criteriaWeights.domain` e os DOMAIN_PRESETS), e o sub-modo
// seria uma terceira. Como as três convivem é decisão do usuário, não deste
// módulo.
//
// Segue o padrão de PENDING_CONFIRMATION / TS_PERFORMANCE_ESTIMATED em
// mcdmCriteria.js: banner legível por humano mais constante legível por
// máquina, para que a UI possa desabilitar o controle com a mesma justificativa
// sem ninguém precisar lembrar da pendência de cabeça.
export const PENDING_DOMAIN_SUBMODE = Object.freeze({
  groupId: CRITERION_GROUPS.GEOMECHANICS,
  implemented: false,
  // Só os ids do Nicholas. Os `rmr_*` do UBC pertencem aos mesmos três domínios
  // e precisarão entrar aqui quando o sub-modo sair do papel — ficam de fora
  // agora porque esta constante descreve uma repartição que ninguém executa, e
  // completá-la sugeriria um suporte a UBC que o sub-modo ainda não tem.
  domains: Object.freeze({
    ob: Object.freeze(["rss_ob", "jointSpacing_ob", "jointCondition_ob"]),
    hw: Object.freeze(["rss_hw", "jointSpacing_hw", "jointCondition_hw"]),
    fw: Object.freeze(["rss_fw", "jointSpacing_fw", "jointCondition_fw"]),
  }),
  reason:
    "Sub-modo de repartição por domínio geológico (ob/hw/fw) ainda não implementado. " +
    "Nesta fase o grupo Geomecânica divide o próprio peso igualmente entre os critérios " +
    "de Geomecânica presentes na matriz (9 no Nicholas, 6 no UBC). " +
    "Depende de decidir como o sub-modo conviveria com criteriaWeights.domain e DOMAIN_PRESETS.",
});

/** Índice id → descritor, para lookup sem varrer o array. */
export const CLASSIC_CRITERIA_BY_ID = Object.freeze(
  Object.fromEntries(CLASSIC_CRITERIA.map((c) => [c.id, c])),
);

/** Ids dos critérios clássicos de um grupo, na ordem de CLASSIC_CRITERIA. */
export function classicCriteriaOfGroup(groupId) {
  return CLASSIC_CRITERIA.filter((c) => c.group === groupId).map((c) => c.id);
}
