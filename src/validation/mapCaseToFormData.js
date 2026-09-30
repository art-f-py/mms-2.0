// ---------------------------------------------------------------------------
// MAPEADOR — caso de validação (valor bruto) → formData do formulário
// ---------------------------------------------------------------------------
// Função pura: recebe o caso no schema v1 e devolve o MESMO objeto que o
// formulário produziria se um usuário tivesse preenchido as telas à mão. É esse
// objeto que calculateNicholas/calculateUBC/calculateSHB e buildDecisionMatrix
// consomem — o mapeador não chama nenhum deles, só monta a entrada.
//
// TUDO SAI COMO STRING, inclusive os números. Não é descuido: os campos
// numéricos do formulário são <input> controlados (componente Num, Inputs.jsx),
// então o estado real guarda "1.55", não 1.55. Os cálculos fazem parseFloat de
// qualquer jeito, mas emitir número onde o app emite string faria o formData de
// teste divergir do formData de produção justamente nos testes que existem para
// dizer que eles são iguais.
//
// ACUMULA TODOS OS PROBLEMAS ANTES DE LANÇAR. Um caso com cinco lacunas deve
// revelar as cinco numa execução — quem está extraindo um relatório de 300
// páginas não pode descobrir um campo por vez.
//
// O QUE ESTE MÓDULO NÃO FAZ, DE PROPÓSITO:
//
//   RSS. Não classifica. O trio UCS/densidade/profundidade vai cru para o
//   formData e quem classifica é o próprio cálculo (classifyRSS no UBC/SH&B,
//   classifyRSSNicholas no Nicholas) — que usam ESCALAS DIFERENTES para o mesmo
//   número. Classificar aqui obrigaria a escolher uma das duas e entregaria a
//   classe errada a um dos métodos.
//
//   Profundidade e mergulho. Também não classifica: classifyDepthUBC/SHB e
//   classifyDipUBC/SHB rodam dentro dos cálculos, a partir do número. O
//   formulário guarda o número, e é o número que sai daqui.
//
// O QUE ELE FAZ, E POR QUE PRECISA FAZER: as três conversões que o app NÃO tem,
// porque no app elas acontecem na cabeça do usuário diante de um <select> —
// espessura em metros → faixa, fraturas/metro (ou RQD) → categoria, e RMR
// numérico → classe (esta última existe no app e é reusada, não reescrita).

import { rmrToClass, gsiToRmr, qToRmr } from "../data/rmrData";
import { isStepComplete, missingFieldsForStep, STEPS } from "../data/formRules";
import {
  ALL_METHODS,
  GRADE_OPTIONS,
  JOINT_CONDITION_OPTIONS,
  JOINT_SPACING_OPTIONS,
  NICHOLAS_RSS_OPTIONS,
  ORE_VALUE_OPTIONS,
  RMR_CLASS_OPTIONS,
  SHAPE_OPTIONS,
  ZONES,
  normalizeMethodCode,
  resolveThickness,
} from "./caseSchema";

// A conversão espessura → faixa mora em caseSchema.js desde que o validador
// passou a usá-la também; reexportada aqui para quem já a importava deste módulo.
export { THICKNESS_CUTS_M, thicknessCategory } from "./caseSchema";

/** Erro de mapeamento. `problems` traz a lista inteira. */
export class CaseMappingError extends Error {
  constructor(caseId, problems) {
    super(
      `[MMS/validation] o caso "${caseId}" não pode ser mapeado para o formulário — ` +
      `${problems.length} problema(s):\n` +
      problems.map((p) => `  • ${p.path}: ${p.reason}`).join("\n"),
    );
    this.name     = "CaseMappingError";
    this.caseId   = caseId;
    this.problems = problems;
  }
}

const isNumber = (v) => typeof v === "number" && Number.isFinite(v);

// ---------------------------------------------------------------------------
// FRATURAS → espaçamento
// ---------------------------------------------------------------------------
// FONTE: Nicholas (1981), Table 2 — duas colunas equivalentes para a mesma
// categoria:
//
//   Muito Perto   > 16 fraturas/m     RQD  0–20 %
//   Perto          10–16              RQD 20–40 %
//   Longe           3–10              RQD 40–70 %
//   Muito Longe   <  3                RQD 70–100 %
//
// As faixas publicadas compartilham extremos (10 aparece em "10–16" e em
// "3–10"; 20, 40 e 70 aparecem em dois intervalos de RQD cada). A regra de
// desempate é a MESMA do METODOLOGIA.md para faixas em geral — o valor menos
// favorável à lavra —, que aqui significa o maciço mais fraturado: extremo
// compartilhado cai na categoria de espaçamento MENOR (RQD menor).
//
// A saída sai sempre de JOINT_SPACING_OPTIONS, derivado da tabela de pesos do
// Nicholas: a caixa exata ("Muito Perto", com P maiúsculo — única exceção de
// caixa do projeto) nunca é digitada aqui, nem repassada do arquivo de caso.
// Uma string com caixa errada não lança em lugar nenhum: o critério some da
// pontuação em silêncio (sumCriteria, em algorithms.js).
const [MUITO_PERTO, PERTO, LONGE, MUITO_LONGE] = JOINT_SPACING_OPTIONS;

export const FRACTURES_PER_M_CUTS = Object.freeze({ muitoPerto: 16, perto: 10, longe: 3 });
export const RQD_CUTS_PCT         = Object.freeze({ muitoPerto: 20, perto: 40, longe: 70 });

/** Fraturas por metro → categoria de espaçamento (Nicholas 1981, Table 2). */
export function jointSpacingFromFracturesPerM(f) {
  if (f > FRACTURES_PER_M_CUTS.muitoPerto) return MUITO_PERTO;
  if (f >= FRACTURES_PER_M_CUTS.perto)     return PERTO;       // 10 compartilhado → o mais fraturado
  if (f >= FRACTURES_PER_M_CUTS.longe)     return LONGE;
  return MUITO_LONGE;
}

/** RQD (%) → categoria de espaçamento (Nicholas 1981, Table 2). */
export function jointSpacingFromRqd(rqd) {
  if (rqd <= RQD_CUTS_PCT.muitoPerto) return MUITO_PERTO;      // 20, 40, 70 compartilhados
  if (rqd <= RQD_CUTS_PCT.perto)      return PERTO;
  if (rqd <= RQD_CUTS_PCT.longe)      return LONGE;
  return MUITO_LONGE;
}

// ---------------------------------------------------------------------------
// RMR → classe
// ---------------------------------------------------------------------------
/**
 * Resolve a classe de RMR de um domínio, na ordem de precedência do schema.
 *
 * REUSA rmrToClass / gsiToRmr / qToRmr (src/data/rmrData.js) — as mesmas funções
 * que os botões de conversão do formulário chamam (Inputs.jsx). Reimplementar as
 * faixas de Bieniawski aqui criaria uma segunda cópia que divergiria da primeira
 * sem ninguém notar, e a conversão do caso deixaria de ser a conversão do app.
 *
 * @returns {{value: string} | {problem: string}}
 */
export function resolveRmrClass(z) {
  if (z.rmr_class !== undefined && z.rmr_class !== null) {
    return RMR_CLASS_OPTIONS.includes(z.rmr_class)
      ? { value: z.rmr_class }
      : { problem: `"${z.rmr_class}" não é uma classe de RMR (${RMR_CLASS_OPTIONS.join(" | ")})` };
  }
  if (isNumber(z.rmr)) {
    if (z.rmr < 0 || z.rmr > 100) return { problem: `rmr ${z.rmr} fora de 0–100` };
    return { value: rmrToClass(z.rmr) };
  }
  if (isNumber(z.gsi)) {
    if (z.gsi < 0 || z.gsi > 100) return { problem: `gsi ${z.gsi} fora de 0–100` };
    return { value: rmrToClass(gsiToRmr(z.gsi)) };
  }
  if (isNumber(z.q)) {
    if (z.q <= 0) return { problem: `q ${z.q} precisa ser > 0 (qToRmr usa logaritmo)` };
    return { value: rmrToClass(qToRmr(z.q)) };
  }
  return { problem: "ausente — informe rmr_class, rmr (0–100), gsi ou q" };
}

// ---------------------------------------------------------------------------
// O MAPEADOR
// ---------------------------------------------------------------------------

/** Estrutura vazia de formData, no formato exato do estado do app. */
const emptyFormData = () => ({
  selectedMethods: { nicholas: false, ubc: false, shb: false },
  geometry: { shape: "", thickness: "", grade: "" },
  dip:      "",
  ucs:      { ore: "", hangingWall: "", footwall: "" },
  density:  { ore: "", hangingWall: "", footwall: "" },
  depth:    { ore: "", hangingWall: "", footwall: "" },
  rss:      { ore: "", hangingWall: "", footwall: "" },
  rmr:      { ore: "", hangingWall: "", footwall: "" },
  jointSpacing:   { ore: "", hangingWall: "", footwall: "" },
  jointCondition: { ore: "", hangingWall: "", footwall: "" },
  oreValue: "",
});

/**
 * Mapeia um caso para o formData que os algoritmos esperam.
 *
 * @param {object} caseObj  caso no schema v1
 * @param {object} [options]
 * @param {object} [options.methods]  { nicholas, ubc, shb } — default: os três
 * @returns {{formData: object, selectedMethods: object, realMethod: string,
 *            notes: Array<{path, note}>}}
 * @throws {CaseMappingError} com a lista completa do que impede o mapeamento
 */
export function mapCaseToFormData(caseObj, { methods = ALL_METHODS } = {}) {
  const problems = [];
  const notes    = [];
  const falha    = (path, reason) => problems.push({ path, reason });
  const nota     = (path, note) => notes.push({ path, note });

  const caseId = caseObj?.case_id ?? "(sem case_id)";
  if (!caseObj || typeof caseObj !== "object") {
    throw new CaseMappingError(caseId, [{ path: "(raiz)", reason: "o caso não é um objeto" }]);
  }

  const selectedMethods = {
    nicholas: Boolean(methods.nicholas),
    ubc:      Boolean(methods.ubc),
    shb:      Boolean(methods.shb),
  };
  const ubcOuShb   = selectedMethods.ubc || selectedMethods.shb;
  const soNicholas = selectedMethods.nicholas && !ubcOuShb;
  if (!selectedMethods.nicholas && !ubcOuShb) {
    throw new CaseMappingError(caseId, [
      { path: "options.methods", reason: "nenhum método selecionado — não há formulário a montar" },
    ]);
  }

  const fd = emptyFormData();
  fd.selectedMethods = selectedMethods;

  // --- método real ----------------------------------------------------------
  const realMethod = normalizeMethodCode(caseObj.real_method?.code);
  if (!realMethod) {
    falha("real_method.code",
      caseObj.real_method?.code
        ? `"${caseObj.real_method.code}" não é um código de método conhecido`
        : "ausente — é o método que a comparação procura no ranking");
  }

  // --- geometria ------------------------------------------------------------
  const g = caseObj.geometry ?? {};

  if (SHAPE_OPTIONS.includes(g.shape)) fd.geometry.shape = g.shape;
  else falha("geometry.shape", g.shape
    ? `"${g.shape}" não é uma opção do formulário (${SHAPE_OPTIONS.join(" | ")})`
    : `${g.shape === null ? "é null" : "ausente"} — precisa ser uma de: ${SHAPE_OPTIONS.join(" | ")}`);

  // Espessura: a regra é a do validador (resolveThickness, em caseSchema.js) —
  // categoria explícita tem precedência sobre o número, e a ambiguidade abaixo
  // de 10 m com UBC/SH&B é recusada com a mesma mensagem nas duas etapas.
  const espessura = resolveThickness(g, selectedMethods);
  if (espessura.problem) falha(espessura.path, espessura.problem);
  else fd.geometry.thickness = espessura.value;

  if (!isNumber(g.dip_deg)) {
    falha("geometry.dip_deg",
      `${g.dip_deg === null ? "é null" : "ausente"} — mergulho em graus, campo obrigatório para os métodos selecionados`);
  } else if (g.dip_deg < 0 || g.dip_deg > 90) {
    falha("geometry.dip_deg", `${g.dip_deg}° fora de 0–90`);
  } else {
    fd.dip = String(g.dip_deg);
  }

  if (GRADE_OPTIONS.includes(g.grade_distribution)) fd.geometry.grade = g.grade_distribution;
  else falha("geometry.grade_distribution", g.grade_distribution
    ? `"${g.grade_distribution}" não é uma opção do formulário (${GRADE_OPTIONS.join(" | ")})`
    : "ausente — é a DISTRIBUIÇÃO do teor no corpo (Uniforme/Gradacional/Errático), " +
      "não o teor em porcentagem; grade_pct não serve para este critério");

  // --- geomecânica por domínio ----------------------------------------------
  const gm = caseObj.geomechanical ?? {};
  if (typeof gm === "string" || typeof gm.status === "string") {
    falha("geomechanical",
      "está no formato antigo (texto de status), não na estrutura por domínio " +
      `(${ZONES.join(", ")}) que o schema v1 exige`);
  }

  // Profundidade do corpo: a etapa Geometria e a geotécnica compartilham o mesmo
  // fd.depth.ore (ver a nota "Mesmo valor da etapa Geometria" no formulário), e
  // por isso o caso pode trazê-la em geometry.depth_m ou no domínio ore.
  // Vale o primeiro dos dois que for número; não havendo número, preserva o
  // valor original (null, e não `undefined`) para a mensagem de erro poder
  // dizer "é null" em vez de "ausente" — a diferença entre "o extrator não
  // procurou" e "o extrator procurou e não achou" é a informação útil aqui.
  const profundidadeCorpo = isNumber(g.depth_m) ? g.depth_m
    : isNumber(gm?.ore?.depth_m) ? gm.ore.depth_m
    : g.depth_m !== undefined ? g.depth_m
    : gm?.ore?.depth_m;

  for (const zona of ZONES) {
    const z = (gm && typeof gm === "object" ? gm[zona] : null) ?? {};
    const profundidadeZona = zona === "ore" ? profundidadeCorpo : z.depth_m;

    // UCS / densidade / profundidade — o trio do RSS. Vai cru; quem classifica
    // é o cálculo, cada um na sua escala.
    const trio = [
      ["ucs_mpa",       "ucs",     z.ucs_mpa,         "UCS em MPa"],
      ["density_kg_m3", "density", z.density_kg_m3,   "densidade em kg/m³"],
      ["depth_m",       "depth",   profundidadeZona,  "profundidade em metros"],
    ];
    const trioCompleto = trio.every(([, , valor]) => isNumber(valor) && valor > 0);

    if (trioCompleto) {
      for (const [, campoFd, valor] of trio) fd[campoFd][zona] = String(valor);
    } else if (soNicholas && NICHOLAS_RSS_OPTIONS.includes(z.rss_class)) {
      // Caminho manual do RSS: existe SÓ no modo Nicholas-sozinho, e é o mesmo
      // <select> que o formulário oferece nesse modo. UBC e SH&B ignoram
      // fd.rss de propósito — escala diferente (ver calculateUBC).
      fd.rss[zona] = z.rss_class;
      nota(`geomechanical.${zona}.rss_class`,
        "RSS informado direto (caminho manual do Nicholas), sem UCS/densidade/profundidade");
    } else {
      for (const [campoCaso, , valor, rotulo] of trio) {
        if (!isNumber(valor) || valor <= 0) {
          const onde = campoCaso === "depth_m" && zona === "ore"
            ? "geomechanical.ore.depth_m (ou geometry.depth_m)"
            : `geomechanical.${zona}.${campoCaso}`;
          falha(onde,
            `${valor === null ? "é null" : valor === undefined ? "ausente" : `"${valor}" inválido`} — ` +
            `${rotulo}, campo obrigatório para o cálculo do RSS` +
            (soNicholas ? " (ou informe rss_class para o caminho manual do Nicholas)" : ""));
        }
      }
      if (!soNicholas && NICHOLAS_RSS_OPTIONS.includes(z.rss_class)) {
        falha(`geomechanical.${zona}.rss_class`,
          "rss_class só vale com o Nicholas sozinho — a escala dele (<8 / 8–15 / >15) não é a " +
          "do UBC/SH&B (<5 / 5–10 / 10–15 / ≥15), e esses dois ignoram o campo de propósito");
      }
    }

    // RMR — só UBC/SH&B têm o critério.
    if (ubcOuShb) {
      const rmr = resolveRmrClass(z);
      if (rmr.value) fd.rmr[zona] = rmr.value;
      else falha(`geomechanical.${zona}.rmr`, `${rmr.problem} — exigido por ${selectedMethods.ubc && selectedMethods.shb ? "UBC/SH&B" : selectedMethods.ubc ? "UBC" : "SH&B"}`);
    }

    // Espaçamento e condição de fratura — só Nicholas.
    if (selectedMethods.nicholas) {
      const temFraturas = isNumber(z.fractures_per_m);
      const temRqd      = isNumber(z.rqd_pct);

      if (temFraturas && z.fractures_per_m < 0) {
        falha(`geomechanical.${zona}.fractures_per_m`, `${z.fractures_per_m} não é um número de fraturas por metro`);
      } else if (temRqd && (z.rqd_pct < 0 || z.rqd_pct > 100)) {
        falha(`geomechanical.${zona}.rqd_pct`, `${z.rqd_pct} fora de 0–100 %`);
      } else if (temFraturas) {
        fd.jointSpacing[zona] = jointSpacingFromFracturesPerM(z.fractures_per_m);
        // As duas colunas da Table 2 são equivalentes, mas medidas reais podem
        // discordar. Prevalece a contagem de fraturas (coluna primária da
        // tabela); a divergência vira nota, não erro — é informação sobre o
        // maciço, não defeito do caso.
        if (temRqd) {
          const porRqd = jointSpacingFromRqd(z.rqd_pct);
          if (porRqd !== fd.jointSpacing[zona]) {
            nota(`geomechanical.${zona}.rqd_pct`,
              `RQD ${z.rqd_pct}% daria "${porRqd}", fraturas/m ${z.fractures_per_m} dá ` +
              `"${fd.jointSpacing[zona]}" — prevaleceu a contagem de fraturas`);
          }
        }
      } else if (temRqd) {
        fd.jointSpacing[zona] = jointSpacingFromRqd(z.rqd_pct);
      } else {
        falha(`geomechanical.${zona}.fractures_per_m`,
          `${z.fractures_per_m === null ? "é null" : "ausente"} — informe fraturas por metro ou rqd_pct ` +
          "(Nicholas 1981, Table 2), campo obrigatório para Nicholas");
      }

      if (JOINT_CONDITION_OPTIONS.includes(z.joint_condition)) {
        fd.jointCondition[zona] = z.joint_condition;
      } else {
        falha(`geomechanical.${zona}.joint_condition`,
          (z.joint_condition ? `"${z.joint_condition}" não é uma opção` : `${z.joint_condition === null ? "é null" : "ausente"}`) +
          ` — ${JOINT_CONDITION_OPTIONS.join(" | ")}, campo obrigatório para Nicholas. ` +
          "Definição (Nicholas 1981, Table 2): Fraca = junta limpa de superfície lisa OU preenchida com " +
          "material menos resistente que a rocha; Média = junta limpa de superfície rugosa; " +
          "Forte = junta preenchida com material de resistência igual ou maior que a rocha");
      }
    }
  }

  // --- econômico (só SH&B) --------------------------------------------------
  if (selectedMethods.shb) {
    const valor = caseObj.economic?.ore_value_class;
    if (ORE_VALUE_OPTIONS.includes(valor)) {
      fd.oreValue = valor;
    } else {
      falha("economic.ore_value_class",
        (valor ? `"${valor}" não é uma opção (${ORE_VALUE_OPTIONS.join(" | ")})` : `${valor === null ? "é null" : "ausente"}`) +
        " — campo obrigatório para SH&B. Não há critério publicado que converta teor ou preço em " +
        "Baixo/Médio/Alto: a classificação é do Francisco e precisa vir explícita no caso, com provenância");
    }
  }

  if (problems.length > 0) throw new CaseMappingError(caseId, problems);

  // --- rede de segurança ----------------------------------------------------
  // Última conferência contra a MESMA regra que o formulário usa para liberar o
  // botão "Calcular" (formRules.js). Se ela reprovar aqui, o defeito é DESTE
  // módulo — todo campo que ela exige já deveria ter sido preenchido ou
  // reclamado acima. É a guarda que impede o mapeador de devolver, em silêncio,
  // um formData que os cálculos aceitariam com critérios faltando.
  const etapas = [STEPS.GEOMETRY, STEPS.GEOTECHNICAL, STEPS.COMPLEMENTARY];
  const restantes = etapas
    .filter((etapa) => !isStepComplete(etapa, fd, selectedMethods))
    .flatMap((etapa) => missingFieldsForStep(etapa, fd, selectedMethods).map((campo) => ({
      path: `formData.${campo}`,
      reason: `ficou vazio depois do mapeamento (etapa "${etapa}") — defeito do mapeador, não do caso`,
    })));
  if (restantes.length > 0) throw new CaseMappingError(caseId, restantes);

  return { formData: fd, selectedMethods, realMethod, notes };
}
