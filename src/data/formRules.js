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
