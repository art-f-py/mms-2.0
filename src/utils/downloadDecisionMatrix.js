import { buildDecisionMatrix, sheetToAoa } from "../algorithms/decisionMatrix";

export const DECISION_MATRIX_FILENAME = "mms2-decision-matrix.xlsx";

/**
 * Gera o .xlsx da matriz de decisão bruta e dispara o download no navegador.
 *
 * Camada fina de propósito: toda a montagem (extração, tradução dos rótulos,
 * linhas/colunas) vive em algorithms/decisionMatrix.js, que é puro e testado.
 * Aqui só sobra o que depende do SheetJS e do navegador.
 *
 * O SheetJS entra por import dinâmico: são ~286 kB (96 kB gzip) que só fazem
 * sentido para quem clica no botão. Como import estático, iam para o bundle
 * principal e pesavam no carregamento de todo mundo.
 *
 * @returns {Promise<{ sheets: Array, unmappedKeys: string[], written: boolean }>}
 */
export async function downloadDecisionMatrix(formData, selectedMethods, filename = DECISION_MATRIX_FILENAME) {
  const { sheets, unmappedKeys } = buildDecisionMatrix(formData, selectedMethods);

  // Sem método selecionado não há aba — e um workbook vazio faz o SheetJS
  // lançar. O botão já fica desabilitado nesse caso; isto é a rede de baixo.
  if (sheets.length === 0) return { sheets, unmappedKeys, written: false };

  const XLSX = await import("xlsx");

  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetToAoa(sheet)), sheet.name);
  }
  XLSX.writeFile(wb, filename);

  return { sheets, unmappedKeys, written: true };
}
