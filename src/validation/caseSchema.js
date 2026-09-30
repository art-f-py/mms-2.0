// ---------------------------------------------------------------------------
// SCHEMA DO CASO DE VALIDAÇÃO — vocabulário, campos obrigatórios e completude
// ---------------------------------------------------------------------------
// Este módulo é INFRAESTRUTURA DE VALIDAÇÃO EMPÍRICA, não faz parte do app: nada
// em src/pages, src/components ou src/context importa daqui, e nada daqui altera
// o comportamento do formulário ou dos cálculos. Ele lê o app, nunca escreve.
//
// O QUE É UM "CASO". Um relatório técnico (NI 43-101) reduzido a um JSON com os
// valores brutos do depósito mais a provenância de cada um — de onde o número
// saiu e por que aquele número, e não outro. A metodologia de extração está em
// docs/validacao-mcdm/casos/METODOLOGIA.md; este arquivo é a forma executável
// dela: o que o schema exige, o que ele considera "pronto para rodar", e o que
// continua decisão humana.
//
// POR QUE "PRONTO" É UMA PERGUNTA SEPARADA DE "VÁLIDO". Um caso pode estar
// perfeitamente bem-formado e ainda assim ser inútil para o pipeline, porque
// falta o dado que um dos três métodos exige. Os dois casos reais processados
// até aqui (Belgravia/Ochoa e Highland/Copperwood) são exatamente isso: JSON
// correto, extração honesta, e mesmo assim `usable_now: false`. Tratá-los como
// prontos produziria um ranking construído sobre critérios faltantes — e o
// perigo aqui não é o erro barulhento, é o silencioso: sumCriteria (algorithms.js)
// DESCARTA critério não preenchido sem lançar nada, então um caso incompleto
// atravessaria os três cálculos e devolveria um ranking plausível e vazio de
// geologia. É essa falha silenciosa que validateCase existe para interceptar.
//
// VOCABULÁRIO DERIVADO, NUNCA TRANSCRITO. Todas as listas de categorias abaixo
// saem das próprias tabelas de peso, por Object.keys. Copiá-las à mão criaria
// uma segunda cópia do vocabulário que divergiria da primeira na primeira
// revisão do Francisco — e a divergência seria invisível, porque o valor errado
// não lança: só some da pontuação.

import {
  NICHOLAS_GEOMETRY,
  NICHOLAS_OREBODY,
} from "../algorithms/nicholasWeights";
import { METHODS, UBC_GEOMETRY, UBC_OREBODY } from "../algorithms/ubcWeights";
import { SHB_ECONOMIC, SHB_GEOMETRY } from "../algorithms/shbWeights";
import { isNicholasOnly, thicknessOptionsFor } from "../data/formRules";

/** Versão do schema. Muda quando um campo obrigatório entra, sai ou troca de nome. */
export const CASE_SCHEMA_VERSION = 1;

/**
 * Os três domínios geológicos, com os nomes que o formData usa.
 *
 * `ore` / `hangingWall` / `footwall` — e não `ob`/`hw`/`fw`, que só existem como
 * chaves de peso e de breakdown (ver criteriaWeights em algorithms.js). O caso
 * de validação fala a língua do formData, porque é para lá que ele vai.
 */
export const ZONES = Object.freeze(["ore", "hangingWall", "footwall"]);

// ---------------------------------------------------------------------------
// VOCABULÁRIO CATEGÓRICO — derivado das tabelas de peso
// ---------------------------------------------------------------------------

/**
 * Confere que os três métodos oferecem exatamente as mesmas opções para um
 * critério, e devolve a lista.
 *
 * Forma e teor são idênticos nas três tabelas HOJE. Se um dia deixarem de ser,
 * o caso de validação não tem mais um vocabulário único para gravar — e a
 * decisão de qual usar é humana, não deste módulo. Falhar no import é o lado
 * seguro: o contrário é gravar um valor que um dos métodos ignora em silêncio.
 */
function sharedOptions(criterion, tables) {
  const lists = tables.map(([nome, tabela]) => [nome, Object.keys(tabela[criterion].options)]);
  const [, primeira] = lists[0];
  for (const [nome, lista] of lists.slice(1)) {
    const igual = lista.length === primeira.length && lista.every((v, i) => v === primeira[i]);
    if (!igual) {
      throw new Error(
        `[MMS/validation] as opções de "${criterion}" divergem entre as tabelas: ` +
        `${lists[0][0]} traz [${primeira.join(", ")}] e ${nome} traz [${lista.join(", ")}]. ` +
        `O caso de validação grava UM vocabulário; qual deles vale é decisão humana.`,
      );
    }
  }
  return Object.freeze(primeira);
}

/** "Massivo" | "Tabular" | "Irregular" — idênticas nos três métodos. */
export const SHAPE_OPTIONS = sharedOptions("shape", [
  ["Nicholas", NICHOLAS_GEOMETRY], ["UBC", UBC_GEOMETRY], ["SH&B", SHB_GEOMETRY],
]);

/** "Uniforme" | "Gradacional" | "Errático" — a DISTRIBUIÇÃO do teor, não o teor. */
export const GRADE_OPTIONS = sharedOptions("grade", [
  ["Nicholas", NICHOLAS_GEOMETRY], ["UBC", UBC_GEOMETRY], ["SH&B", SHB_GEOMETRY],
]);

/**
 * "Muito Perto" | "Perto" | "Longe" | "Muito Longe" — ATENÇÃO À CAIXA.
 *
 * P e L maiúsculos, única exceção de caixa no projeto (todas as outras
 * categorias compostas são minúsculas: "Muito estreito", "Muito fraca"). Vem
 * daqui, derivado, justamente para que ninguém precise acertar a caixa de
 * memória: sumCriteria compara a string literalmente e, se não bater, o
 * critério some da pontuação sem erro — o console.warn que avisaria só roda em
 * DEV (algorithms.js, warnCriterionDropped).
 */
export const JOINT_SPACING_OPTIONS = Object.freeze(
  Object.keys(NICHOLAS_OREBODY.jointSpacing.options),
);

/** "Fraca" | "Média" | "Forte" — resistência ao cisalhamento da fratura. */
export const JOINT_CONDITION_OPTIONS = Object.freeze(
  Object.keys(NICHOLAS_OREBODY.jointCondition.options),
);

/**
 * Classes de RMR no vocabulário do UBC — que é o que o formData grava.
 *
 * As tabelas do SH&B usam outras strings ("Muito fraca"/"Média"/"Muito forte"),
 * mas isso não vaza para o formulário: calculateSHB traduz internamente em
 * mapRmrToSHB. O caso de validação grava sempre o vocabulário do UBC.
 */
export const RMR_CLASS_OPTIONS = Object.freeze(Object.keys(UBC_OREBODY.rmr.options));

/** Classes de RSS do Nicholas — o campo manual, só utilizável com Nicholas sozinho. */
export const NICHOLAS_RSS_OPTIONS = Object.freeze(Object.keys(NICHOLAS_OREBODY.rss.options));

/** "Baixo" | "Médio" | "Alto" — exclusivo do SH&B. */
export const ORE_VALUE_OPTIONS = Object.freeze(Object.keys(SHB_ECONOMIC.oreValue.options));

// ---------------------------------------------------------------------------
// CÓDIGO DO MÉTODO REAL
// ---------------------------------------------------------------------------

/**
 * Apelidos aceitos para o código do método de lavra.
 *
 * O app usa "R&P" e "C&F" (METHODS, em ubcWeights.js), mas os dois casos reais
 * já extraídos gravaram "RP" — o & é inconveniente em nome de arquivo, planilha
 * e URL, e a variante sem ele apareceu naturalmente. Não é ambiguidade: "RP" só
 * pode ser Room & Pillar, e nos dois casos a citação do relatório diz
 * "room-and-pillar" com todas as letras.
 *
 * A tabela é EXPLÍCITA e curta de propósito. Normalizar por regex (tirar
 * pontuação, comparar maiúsculas) aceitaria silenciosamente qualquer variante
 * futura, inclusive uma errada; aqui, um código não previsto lança e vira
 * decisão de quem extraiu.
 */
export const METHOD_CODE_ALIASES = Object.freeze({ RP: "R&P", CF: "C&F" });

/**
 * Converte o código do método real para o código canônico do app.
 *
 * @param {string} code  código como veio no arquivo do caso
 * @returns {string|null} código em METHODS, ou null se não reconhecido
 */
export function normalizeMethodCode(code) {
  if (typeof code !== "string") return null;
  const bruto = code.trim();
  const canonico = METHOD_CODE_ALIASES[bruto.toUpperCase()] ?? bruto;
  return METHODS.includes(canonico) ? canonico : null;
}

// ---------------------------------------------------------------------------
// O SCHEMA, DESCRITO
// ---------------------------------------------------------------------------
/**
 * FORMATO DO ARQUIVO DE CASO (v1)
 *
 * {
 *   "case_id":        "belgravia_ochoa",            // obrigatório
 *   "schema_version": 1,                            // opcional; ausente = 1
 *   "status":         "parcial | usable",           // informativo
 *   "source": {                                     // obrigatório: título + arquivo
 *     "report_title", "company", "drive_file", "report_date", "drive_file_id"
 *   },
 *   "real_method": {                                // obrigatório: code
 *     "code": "R&P" | "RP" | ...,                   // ver normalizeMethodCode
 *     "confidence", "quote", "location"
 *   },
 *   "geometry": {
 *     "shape":              "Massivo|Tabular|Irregular",
 *     "thickness_m":        number,                 // espessura real, em metros
 *     "thickness_category": "Estreito|...",         // opcional; tem precedência
 *                                                   // sobre thickness_m e é o que
 *                                                   // resolve < 10 m com UBC/SH&B
 *     "dip_deg":            number,                 // 0–90
 *     "grade_distribution": "Uniforme|Gradacional|Errático",
 *     "grade_pct":          number,                 // INFORMATIVO — ver nota abaixo
 *     "depth_m":            number,                 // profundidade do corpo
 *     "<campo>_provenance": "texto",                // de onde saiu o valor
 *     "<campo>_confidence": "texto"
 *   },
 *   "geomechanical": {
 *     "ore": { ... }, "hangingWall": { ... }, "footwall": { ... }
 *     // por domínio, todos opcionais isoladamente — o que é exigido depende
 *     // dos métodos que se quer rodar:
 *     //   "ucs_mpa":         number   // resistência à compressão uniaxial
 *     //   "density_kg_m3":   number
 *     //   "depth_m":         number   // profundidade DESTE domínio; no ore é
 *     //                                // opcional se geometry.depth_m existir
 *     //                                // (é o mesmo campo; vale geometry.depth_m)
 *     //   "rmr":             number   // 0–100  ─┐ uma destas quatro
 *     //   "rmr_class":       "Boa"    //         │ resolve o RMR
 *     //   "gsi":             number   //         │ (precedência nesta ordem)
 *     //   "q":               number   // >0     ─┘
 *     //   "fractures_per_m": number   // ─┐ uma das duas resolve o
 *     //   "rqd_pct":         number   // ─┘ espaçamento de fraturas
 *     //   "joint_condition": "Fraca|Média|Forte"
 *     //   "rss_class":       "Fraca|Moderada|Resistente"  // só Nicholas sozinho
 *     //   "<campo>_provenance": "texto"
 *   },
 *   "economic": { "ore_value_class": "Baixo|Médio|Alto", "..._provenance": "" },
 *   "gaps":       ["texto livre"],
 *   "usable_now": boolean
 * }
 *
 * DOIS DESVIOS EM RELAÇÃO AO RASCUNHO DO METODOLOGIA.md, os dois deliberados:
 *
 * 1. `grade_distribution` É UM CAMPO NOVO, E É ELE QUE ALIMENTA O FORMULÁRIO.
 *    O rascunho previa `grade_pct` e os dois casos reais gravaram o teor em
 *    porcentagem (83.9% de polialita, 1.43% de Cu). Esse número NÃO é o critério
 *    "teor" dos três métodos: o formulário pergunta a DISTRIBUIÇÃO do teor no
 *    corpo — Uniforme / Gradacional / Errático (ver tips.grade na i18n) —, que é
 *    uma propriedade de variabilidade espacial, não um valor. Um depósito de
 *    83,9% pode ser errático e um de 1,4% pode ser uniforme. `grade_pct` fica no
 *    schema como dado informativo (é o que sustenta uma futura classificação de
 *    `ore_value_class`), mas não entra em nenhuma tabela de peso.
 *
 * 2. `geomechanical` DEIXOU DE SER UM CAMPO DE TEXTO. No rascunho ele era uma
 *    string de status descrevendo a pendência; aqui é a estrutura por domínio
 *    que o formulário de fato consome. A pendência que a string descrevia
 *    continua real — ela só passou a ser expressa como campo ausente, que
 *    validateCase nomeia, em vez de prosa que nenhum código lê.
 */

// ---------------------------------------------------------------------------
// ESPESSURA (m) → faixa do formulário
// ---------------------------------------------------------------------------
// FONTE: Nicholas, D.E. (1981), "Method Selection — A Numerical Approach",
// Table 1 — narrow <10 m | intermediate 10–30 m | thick 30–100 m | very thick
// >100 m. Confirmado na fonte primária (ver METODOLOGIA.md, seção "Espessura"),
// e igual às faixas que a i18n do app já exibia em tips.thickness.
//
// EXTREMO COMPARTILHADO VAI PARA A FAIXA DE BAIXO (10 é intermediate, 30 é
// thick... não: 30 é intermediate, 100 é thick). A convenção não é escolha nova
// — é a mesma que o próprio app usa em classifyDepthUBC ("m <= 100" é Rasa,
// "m <= 600" é Intermediária) e em classifyDepthSHB. Faixas publicadas como
// "10–30" e "30–100" compartilham o 30; divergir da convenção do app aqui faria
// dois módulos do mesmo repositório lerem a mesma tabela de dois jeitos.
export const THICKNESS_CUTS_M = Object.freeze({
  estreito:      10,   // < 10
  intermediario: 30,   // 10 ≤ e ≤ 30
  espesso:       100,  // 30 < e ≤ 100
});

/**
 * Converte espessura em metros para a faixa do formulário.
 *
 * A FAIXA "Muito estreito" NÃO É DECIDIDA AQUI, e é por isso que esta função
 * precisa saber quais métodos vão rodar. Ela é uma extensão do UBC (1995) que o
 * Nicholas não tem, e o limite numérico dela não está em nenhuma fonte que
 * tenhamos: seria Miller, Pakalnis & Poulin (1995), não localizada. Consequência
 * prática:
 *
 *   • Só Nicholas → toda espessura abaixo de 10 m é "Estreito", sem ambiguidade
 *     nenhuma: a categoria extra não existe nesse método, e o formulário nem a
 *     oferece (thicknessOptionsFor, em formRules.js).
 *   • Com UBC ou SH&B → abaixo de 10 m NÃO DÁ PARA DECIDIR entre "Estreito" e
 *     "Muito estreito" sem o limite. Devolve ambiguidade, e quem extraiu decide
 *     com a fonte na mão. Chutar aqui trocaria a linha inteira da tabela de
 *     pesos por outra — em "Muito estreito" o BC e o SLC são ELIMINADOS (−49) e
 *     o R&P ganha 4; em "Estreito", o R&P ganha 3. Não é arredondamento.
 *
 * @returns {{value: string} | {ambiguous: string}}
 */
export function thicknessCategory(metros, { ubcOuShb }) {
  if (metros < THICKNESS_CUTS_M.estreito) {
    if (ubcOuShb) {
      return {
        ambiguous:
          `${metros} m cai abaixo de 10 m, onde "Estreito" (Nicholas 1981, Table 1) e ` +
          `"Muito estreito" (extensão UBC 1995) se sobrepõem. O limite numérico de ` +
          `"Muito estreito" não está em nenhuma fonte disponível — seria Miller, Pakalnis & ` +
          `Poulin (1995), não localizada. Informe geometry.thickness_category ` +
          `("Estreito" ou "Muito estreito") no caso para resolver, ou rode só o Nicholas.`,
      };
    }
    return { value: "Estreito" };
  }
  if (metros <= THICKNESS_CUTS_M.intermediario) return { value: "Intermediário" };
  if (metros <= THICKNESS_CUTS_M.espesso)       return { value: "Espesso" };
  return { value: "Muito espesso" };
}

/**
 * Resolve a faixa de espessura de um caso — a regra ÚNICA, usada pelo validador
 * e pelo mapeador.
 *
 * Existe porque as duas etapas liam a espessura de jeitos diferentes: o
 * validador só conferia que thickness_m era um número positivo e dava o caso
 * como pronto, e o mapeador descobria depois que 1.55 m com UBC não tem faixa
 * decidível. "Pronto" que se revela falso na etapa seguinte é pior que
 * "pendente" — então a ambiguidade passou a ser pendência de validação, com a
 * mesma mensagem nos dois lugares.
 *
 * `thickness_category` explícita tem precedência sobre o número: é ela que
 * resolve a ambiguidade do "Muito estreito" quando quem extraiu tem a fonte
 * para decidir. As faixas aceitas são as que o formulário oferece para a seleção
 * de métodos (thicknessOptionsFor, em formRules.js).
 *
 * @param {object} g        caseObj.geometry
 * @param {object} methods  { nicholas, ubc, shb }
 * @returns {{value: string} | {path: string, problem: string}}
 */
export function resolveThickness(g, methods) {
  const ubcOuShb = Boolean(methods.ubc || methods.shb);

  if (g.thickness_category !== undefined && g.thickness_category !== null) {
    const oferecidas = thicknessOptionsFor(methods);
    return oferecidas.includes(g.thickness_category)
      ? { value: g.thickness_category }
      : {
          path: "geometry.thickness_category",
          problem:
            `"${g.thickness_category}" não é uma faixa oferecida para ` +
            `${isNicholasOnly(methods) ? "Nicholas sozinho" : "esta seleção de métodos"} ` +
            `(${oferecidas.join(" | ")})`,
        };
  }

  if (!isNumber(g.thickness_m)) {
    return {
      path: "geometry.thickness_m",
      problem: `${g.thickness_m === null ? "é null" : "ausente"} — espessura em metros, campo obrigatório`,
    };
  }
  if (g.thickness_m <= 0) {
    return { path: "geometry.thickness_m", problem: `${g.thickness_m} m não é uma espessura positiva` };
  }

  const faixa = thicknessCategory(g.thickness_m, { ubcOuShb });
  return faixa.ambiguous ? { path: "geometry.thickness_m", problem: faixa.ambiguous } : faixa;
}

// ---------------------------------------------------------------------------
// COMPLETUDE
// ---------------------------------------------------------------------------

/** Métodos rodados por padrão: os três, que é o que o harness de comparação usa. */
export const ALL_METHODS = Object.freeze({ nicholas: true, ubc: true, shb: true });

/** Erro de caso incompleto. `missing` traz a lista inteira, não só o primeiro. */
export class CaseIncompleteError extends Error {
  constructor(caseId, missing) {
    super(
      `[MMS/validation] caso "${caseId}" não está pronto para rodar — ` +
      `${missing.length} pendência(s):\n` +
      missing.map((m) => `  • ${m.path}: ${m.reason}${m.neededBy ? ` (exigido por: ${m.neededBy})` : ""}`).join("\n"),
    );
    this.name    = "CaseIncompleteError";
    this.caseId  = caseId;
    this.missing = missing;
  }
}

const isNumber = (v) => typeof v === "number" && Number.isFinite(v);
const isFilledString = (v) => typeof v === "string" && v.trim() !== "";

/** Nomes dos métodos ativos, para a mensagem de erro. */
const activeNames = (m) =>
  [m.nicholas && "Nicholas", m.ubc && "UBC", m.shb && "SH&B"].filter(Boolean).join("/");

/**
 * Valida um caso e diz se ele está pronto para rodar.
 *
 * NUNCA LANÇA e nunca muta o caso — devolve o diagnóstico inteiro para quem
 * chamou decidir o que fazer. Quem quer a falha ruidosa usa assertCaseReady.
 *
 * `missing` é a lista COMPLETA, não a primeira pendência: quem está extraindo um
 * relatório precisa saber tudo o que falta numa passada, não descobrir um campo
 * por vez a cada nova execução.
 *
 * @param {object} caseObj                caso carregado do JSON
 * @param {object} [options]
 * @param {object} [options.methods]      { nicholas, ubc, shb } — default: os três
 * @param {boolean} [options.requireProvenance]  promove provenância ausente de
 *   aviso a pendência. Default false: provenância é exigência METODOLÓGICA (a
 *   rastreabilidade do número até o relatório), não do pipeline — sem ela o
 *   cálculo roda igual, e travar a execução por causa dela esconderia o fato de
 *   que o dado em si está lá. Com true, a regra do METODOLOGIA.md passa a valer
 *   integralmente — é o modo para auditar um lote antes de publicar resultado.
 * @returns {{ok: boolean, caseId: string, methods: object,
 *            missing: Array<{path, reason, neededBy}>, warnings: Array<{path, reason}>}}
 */
export function validateCase(caseObj, { methods = ALL_METHODS, requireProvenance = false } = {}) {
  const missing  = [];
  const warnings = [];
  const falta    = (path, reason, neededBy) => missing.push({ path, reason, neededBy });
  const avisa    = (path, reason) => warnings.push({ path, reason });

  if (!caseObj || typeof caseObj !== "object") {
    return {
      ok: false, caseId: "(sem caso)", methods,
      missing: [{ path: "(raiz)", reason: "o caso não é um objeto", neededBy: null }],
      warnings: [],
    };
  }

  const caseId = isFilledString(caseObj.case_id) ? caseObj.case_id : "(sem case_id)";
  if (!isFilledString(caseObj.case_id)) falta("case_id", "ausente ou vazio", null);

  const versao = caseObj.schema_version ?? CASE_SCHEMA_VERSION;
  if (versao !== CASE_SCHEMA_VERSION) {
    falta("schema_version", `schema v${versao} não é lido por esta versão (v${CASE_SCHEMA_VERSION})`, null);
  }

  // --- proveniência ---------------------------------------------------------
  // Registra a falta como aviso ou pendência, conforme requireProvenance.
  const exigeProvenancia = (path, container, campo) => {
    const chave = `${campo}_provenance`;
    if (isFilledString(container?.[chave])) return;
    const motivo = "valor preenchido sem provenância — a metodologia exige rastrear o número até o relatório";
    if (requireProvenance) falta(`${path}_provenance`, motivo, "METODOLOGIA.md");
    else avisa(`${path}_provenance`, motivo);
  };

  // --- origem ---------------------------------------------------------------
  if (!isFilledString(caseObj.source?.report_title)) falta("source.report_title", "ausente", "rastreabilidade");
  if (!isFilledString(caseObj.source?.drive_file))   falta("source.drive_file", "ausente", "rastreabilidade");

  // --- método real ----------------------------------------------------------
  const codigo = normalizeMethodCode(caseObj.real_method?.code);
  if (!codigo) {
    falta(
      "real_method.code",
      caseObj.real_method?.code
        ? `"${caseObj.real_method.code}" não é um método conhecido (${METHODS.join(", ")}; ` +
          `apelidos aceitos: ${Object.keys(METHOD_CODE_ALIASES).join(", ")})`
        : "ausente — é o método que a comparação procura no ranking",
      "harness de comparação",
    );
  }
  if (!isFilledString(caseObj.real_method?.quote)) {
    avisa("real_method.quote", "sem citação do relatório — o método real fica sem evidência textual");
  }

  // --- geometria ------------------------------------------------------------
  const g     = caseObj.geometry ?? {};
  const todos = activeNames(methods);

  if (!SHAPE_OPTIONS.includes(g.shape)) {
    falta("geometry.shape", g.shape
      ? `"${g.shape}" não é uma opção do formulário (${SHAPE_OPTIONS.join(" | ")})`
      : `ausente — precisa ser uma de: ${SHAPE_OPTIONS.join(" | ")}`, todos);
  } else {
    exigeProvenancia("geometry.shape", g, "shape");
  }

  // Mesma regra do mapeador (resolveThickness): inclui a ambiguidade abaixo de
  // 10 m com UBC/SH&B, que antes só aparecia no mapeamento.
  const espessura = resolveThickness(g, methods);
  if (espessura.problem) {
    falta(espessura.path, espessura.problem,
      espessura.path === "geometry.thickness_m" && isNumber(g.thickness_m) && g.thickness_m > 0
        ? activeNames({ ubc: methods.ubc, shb: methods.shb })
        : todos);
  } else if (isFilledString(g.thickness_category)) {
    exigeProvenancia("geometry.thickness_category", g, "thickness_category");
  } else {
    exigeProvenancia("geometry.thickness", g, "thickness");
  }

  if (!isNumber(g.dip_deg)) {
    falta("geometry.dip_deg", g.dip_deg === null ? "é null" : "ausente ou não numérico", todos);
  } else if (g.dip_deg < 0 || g.dip_deg > 90) {
    falta("geometry.dip_deg", `${g.dip_deg}° fora de 0–90`, todos);
  } else {
    exigeProvenancia("geometry.dip", g, "dip");
  }

  if (!GRADE_OPTIONS.includes(g.grade_distribution)) {
    falta("geometry.grade_distribution", g.grade_distribution
      ? `"${g.grade_distribution}" não é uma opção do formulário (${GRADE_OPTIONS.join(" | ")})`
      : "ausente — é a DISTRIBUIÇÃO do teor (Uniforme/Gradacional/Errático), " +
        "não o teor em %; grade_pct não substitui este campo", todos);
  } else {
    exigeProvenancia("geometry.grade_distribution", g, "grade_distribution");
  }

  // --- profundidade do corpo -----------------------------------------------
  // CONTRATO (o mesmo do mapeador): a profundidade do corpo pode vir em
  // geometry.depth_m OU em geomechanical.ore.depth_m — no formulário as duas são
  // o MESMO campo (fd.depth.ore, compartilhado entre a etapa Geometria e a
  // geotécnica). Vale geometry.depth_m quando os dois são número. Antes, este
  // validador exigia ore.depth_m no trio do RSS mesmo com geometry.depth_m
  // preenchido, e recusava um caso que o mapeador aceitava.
  //
  // Entra no critério de profundidade (UBC/SH&B) e no RSS do minério (os três,
  // salvo Nicholas sozinho com rss_class). A pendência é nomeada UMA vez, aqui
  // ou no laço dos domínios, nunca nos dois.
  const precisaUbcShb = Boolean(methods.ubc || methods.shb);
  const nomesUbcShb   = activeNames({ ubc: methods.ubc, shb: methods.shb });
  const oreDepth      = caseObj.geomechanical?.ore?.depth_m;
  const profundidadeCorpo = isNumber(g.depth_m) ? g.depth_m : oreDepth;
  const faltaProfundidadeCorpo = (neededBy) => falta("geometry.depth_m",
    g.depth_m === null || oreDepth === null
      ? "é null — nem geometry.depth_m nem geomechanical.ore.depth_m trazem número"
      : "ausente — informe geometry.depth_m (ou geomechanical.ore.depth_m, que é o mesmo campo)",
    neededBy);

  if (precisaUbcShb && !isNumber(profundidadeCorpo)) {
    faltaProfundidadeCorpo(nomesUbcShb);
  } else if (isNumber(g.depth_m)) {
    exigeProvenancia("geometry.depth", g, "depth");
    if (isNumber(oreDepth) && oreDepth !== g.depth_m) {
      avisa("geomechanical.ore.depth_m",
        `${oreDepth} m diverge de geometry.depth_m (${g.depth_m} m) — é o mesmo campo no ` +
        "formulário, e vale geometry.depth_m");
    }
  }

  // --- geomecânica por domínio ----------------------------------------------
  const gm = caseObj.geomechanical ?? {};

  // O rascunho do METODOLOGIA.md trazia `geomechanical` como string de status.
  // Um caso nesse formato não é "geomecânica vazia": é um caso do schema antigo,
  // e dizer isso é mais útil do que listar nove campos ausentes.
  if (typeof gm === "string" || isFilledString(gm.status)) {
    falta("geomechanical",
      "está no formato antigo (texto de status) — v1 exige a estrutura por domínio " +
      `(${ZONES.join(", ")}); o texto atual descreve a pendência: ` +
      `"${String(typeof gm === "string" ? gm : gm.status).slice(0, 120)}…"`,
      todos);
  } else {
    for (const zona of ZONES) {
      const z = gm[zona] ?? {};

      // RSS: os três métodos usam, mas por caminhos diferentes. UBC/SH&B só
      // aceitam o RSS CALCULADO (ucs/densidade/profundidade) — o campo manual é
      // de outra escala e eles o ignoram de propósito (ver calculateUBC).
      const profundidadeZona = zona === "ore" ? profundidadeCorpo : z.depth_m;
      const temTrio = isNumber(z.ucs_mpa) && isNumber(z.density_kg_m3) && isNumber(profundidadeZona);
      const soNicholas = Boolean(methods.nicholas && !methods.ubc && !methods.shb);

      if (!temTrio) {
        const podeManual = soNicholas && NICHOLAS_RSS_OPTIONS.includes(z.rss_class);
        if (!podeManual) {
          if (zona === "ore" && !isNumber(profundidadeCorpo)
              && !missing.some((m) => m.path === "geometry.depth_m")) {
            faltaProfundidadeCorpo(soNicholas ? "Nicholas (ou informe rss_class)" : todos);
          }
          for (const [campo, rotulo] of [
            ["ucs_mpa", "UCS (MPa)"], ["density_kg_m3", "densidade (kg/m³)"], ["depth_m", "profundidade (m)"],
          ]) {
            if (zona === "ore" && campo === "depth_m") continue; // tratado acima, contrato do corpo
            if (!isNumber(z[campo])) {
              falta(`geomechanical.${zona}.${campo}`,
                z[campo] === null ? "é null" : `ausente — ${rotulo}, entra no cálculo do RSS`,
                soNicholas ? "Nicholas (ou informe rss_class)" : todos);
            }
          }
        }
      }

      if (methods.ubc || methods.shb) {
        const temRmr =
          RMR_CLASS_OPTIONS.includes(z.rmr_class) || isNumber(z.rmr) || isNumber(z.gsi) || isNumber(z.q);
        if (!temRmr) {
          falta(`geomechanical.${zona}.rmr`,
            "ausente — informe rmr_class, rmr (0–100), gsi ou q",
            nomesUbcShb);
        }
      }

      if (methods.nicholas) {
        if (!isNumber(z.fractures_per_m) && !isNumber(z.rqd_pct)) {
          falta(`geomechanical.${zona}.fractures_per_m`,
            "ausente — informe fraturas/metro ou rqd_pct (Nicholas 1981, Table 2)",
            "Nicholas");
        }
        if (!JOINT_CONDITION_OPTIONS.includes(z.joint_condition)) {
          falta(`geomechanical.${zona}.joint_condition`,
            z.joint_condition
              ? `"${z.joint_condition}" não é uma opção (${JOINT_CONDITION_OPTIONS.join(" | ")})`
              : `ausente — ${JOINT_CONDITION_OPTIONS.join(" | ")}`,
            "Nicholas");
        }
      }
    }
  }

  // --- econômico (só SH&B) --------------------------------------------------
  if (methods.shb) {
    const valor = caseObj.economic?.ore_value_class;
    if (!ORE_VALUE_OPTIONS.includes(valor)) {
      falta("economic.ore_value_class",
        valor
          ? `"${valor}" não é uma opção (${ORE_VALUE_OPTIONS.join(" | ")})`
          : "ausente — sem critério publicado que converta US$/t em classe; " +
            "a classificação é decisão do Francisco e precisa vir explícita no caso",
        "SH&B");
    }
  }

  return { ok: missing.length === 0, caseId, methods, missing, warnings };
}

/**
 * Mesma validação, lançando CaseIncompleteError quando o caso não está pronto.
 *
 * @returns {object} o próprio caso, quando pronto — para encadear
 * @throws {CaseIncompleteError}
 */
export function assertCaseReady(caseObj, options) {
  const resultado = validateCase(caseObj, options);
  if (!resultado.ok) throw new CaseIncompleteError(resultado.caseId, resultado.missing);
  return caseObj;
}

/** Resumo de uma linha por pendência, para log e relatório. */
export function formatValidation(resultado) {
  const cabecalho = resultado.ok
    ? `✔ ${resultado.caseId}: pronto para rodar`
    : `✘ ${resultado.caseId}: ${resultado.missing.length} pendência(s)`;
  const linhas = [
    ...resultado.missing.map((m) => `  falta  ${m.path} — ${m.reason}${m.neededBy ? ` [${m.neededBy}]` : ""}`),
    ...resultado.warnings.map((w) => `  aviso  ${w.path} — ${w.reason}`),
  ];
  return [cabecalho, ...linhas].join("\n");
}
