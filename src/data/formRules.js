// ---------------------------------------------------------------------------
// REGRAS DE FORMULÁRIO DEPENDENTES DOS MÉTODOS SELECIONADOS
// ---------------------------------------------------------------------------
// Compartilhado entre o estado (MmsContext) e o formulário (Inputs) para que a
// regra não se duplique — e não divirja — entre os dois.

// Faixas de espessura oferecidas pelo formulário (valores canônicos do estado;
// a i18n só troca o rótulo). "Muito estreito" é a extensão do UBC 1995.
export const THICKNESS_OPTIONS = [
  "Muito estreito",
  "Estreito",
  "Intermediário",
  "Espesso",
  "Muito espesso",
];

// Faixa do Nicholas equivalente a "Muito estreito" — a publicação dele começa
// em "Estreito" (<10 m). Mesmo destino que calculateNicholas usa ao pontuar.
const NICHOLAS_THICKNESS_FALLBACK = "Estreito";

export const isNicholasOnly = (sm) => Boolean(sm?.nicholas && !sm?.ubc && !sm?.shb);

// Opções de espessura válidas para a seleção de métodos atual.
export const thicknessOptionsFor = (sm) =>
  isNicholasOnly(sm)
    ? THICKNESS_OPTIONS.filter((o) => o !== "Muito estreito")
    : THICKNESS_OPTIONS;

/**
 * Corrige a espessura órfã: com o Nicholas sozinho, "Muito estreito" deixa de
 * ser oferecida e o <select> (controlado) passaria a exibir o placeholder
 * enquanto o estado seguiria no valor antigo. Reverte para a faixa equivalente.
 * Devolve o mesmo objeto quando não há nada a corrigir.
 */
export function normalizeThickness(formData) {
  if (
    isNicholasOnly(formData.selectedMethods) &&
    formData.geometry?.thickness === "Muito estreito"
  ) {
    return {
      ...formData,
      geometry: { ...formData.geometry, thickness: NICHOLAS_THICKNESS_FALLBACK },
    };
  }
  return formData;
}

// Domínios do RSS manual — o mesmo trio de zonas do formulário.
const RSS_ZONES = ["ore", "hangingWall", "footwall"];

export const emptyRss = () => ({ ore: "", hangingWall: "", footwall: "" });

export const hasManualRss = (rss) => RSS_ZONES.some((z) => Boolean(rss?.[z]));

/**
 * Limpa o RSS manual órfão: o <select> de RSS só é renderizado com o Nicholas
 * sozinho, e só calculateNicholas ainda lê fd.rss (como fallback). Ao marcar
 * UBC/SH&B o campo sai da tela, mas o valor gravado seguiria pontuando —
 * invisível e sem como editar. Devolve o mesmo objeto quando não há o que
 * corrigir.
 */
export function normalizeRss(formData) {
  if (!isNicholasOnly(formData.selectedMethods) && hasManualRss(formData.rss)) {
    return { ...formData, rss: emptyRss() };
  }
  return formData;
}

// ---------------------------------------------------------------------------
// VALIDAÇÃO POR ETAPA
// ---------------------------------------------------------------------------
// Identidade estável de cada etapa. O número da etapa no stepper é dinâmico
// (EESG só existe com SH&B), então a validação se ancora no id, não no índice.
export const STEPS = {
  METHODS:       "methods",
  GEOMETRY:      "geometry",
  GEOTECHNICAL:  "geotechnical",
  EESG:          "eesg",
  COMPLEMENTARY: "complementary",
  REVIEW:        "review",
};

// Zonas do formulário, na ordem em que aparecem na tela.
const ZONES = ["ore", "hangingWall", "footwall"];

// Preenchido: só "" / null / undefined faltam. "0" conta — mergulho horizontal
// é um valor legítimo, não um campo em branco.
const isFilled = (value) => value !== undefined && value !== null && String(value).trim() !== "";

// Lê um campo pelo caminho ("dip", "geometry.shape", "ucs.ore").
const valueAt = (formData, path) => {
  const [section, field] = path.split(".");
  return field === undefined ? formData?.[section] : formData?.[section]?.[field];
};

const forZones = (...prefixes) => ZONES.flatMap((z) => prefixes.map((p) => `${p}.${z}`));

/**
 * Campos obrigatórios de uma etapa para a seleção de métodos dada.
 *
 * REGRA INEGOCIÁVEL: cada condicional aqui espelha a condicional de render do
 * Inputs.jsx. Campo que não aparece na tela nunca é exigido — exigir o
 * invisível trava o usuário sem saída.
 */
export function requiredFieldsForStep(stepId, methods) {
  // Mesmas condicionais do Inputs.jsx:
  const showUbcShb = Boolean(methods?.ubc || methods?.shb); // trio UCS/densidade/profundidade + RMR
  const showNich   = Boolean(methods?.nicholas);            // fraturas
  const showManualRss = isNicholasOnly(methods);            // select manual de RSS

  switch (stepId) {
    case STEPS.GEOMETRY: {
      const fields = ["geometry.shape", "geometry.thickness", "dip", "geometry.grade"];
      // Profundidade: o Nicholas não usa, e o campo só renderiza com UBC/SH&B.
      if (showUbcShb) fields.push("depth.ore");
      return fields;
    }
    case STEPS.GEOTECHNICAL: {
      const fields = [];
      // RSS calculado (UBC/SH&B) x RSS manual (Nicholas sozinho) — nunca os dois.
      if (showUbcShb)    fields.push(...forZones("ucs", "density", "depth"));
      if (showManualRss) fields.push(...forZones("rss"));
      if (showUbcShb)    fields.push(...forZones("rmr"));
      if (showNich)      fields.push(...forZones("jointSpacing", "jointCondition"));
      return fields;
    }
    case STEPS.EESG:
      return methods?.shb ? ["oreValue"] : [];
    default:
      // Métodos tem regra própria (ver missingFieldsForStep); complementar e
      // revisar não têm campo obrigatório — os pesos já vêm com padrão.
      return [];
  }
}

/**
 * Campos obrigatórios ainda vazios na etapa. Lista vazia = etapa liberada.
 * `methods` default vem do próprio formData; o parâmetro existe para testar
 * combinações sem remontar o estado.
 */
export function missingFieldsForStep(stepId, formData, methods = formData?.selectedMethods) {
  if (stepId === STEPS.METHODS) {
    return Object.values(methods || {}).some(Boolean) ? [] : ["selectedMethods"];
  }
  return requiredFieldsForStep(stepId, methods).filter((path) => !isFilled(valueAt(formData, path)));
}

export const isStepComplete = (stepId, formData, methods) =>
  missingFieldsForStep(stepId, formData, methods).length === 0;
