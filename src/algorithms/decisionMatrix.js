import { METHODS } from "./ubcWeights";
import { calculateUBC, calculateNicholas, calculateSHB } from "./algorithms";

// ---------------------------------------------------------------------------
// MATRIZ DE DECISÃO — EXPORTAÇÃO PARA MCDM EXTERNO
// ---------------------------------------------------------------------------
// Monta a matriz de decisão BRUTA (alternativas × critérios) para consumo por
// software MCDM externo (Pro D.M.), enquanto não existe integração direta.
//
// "Bruta" significa sem NENHUMA das duas camadas de ponderação do usuário:
//   1. pesos por critério (sliders de cada método de seleção);
//   2. multiplicadores de domínio do Nicholas (geo/ob/hw/fw, modo presets).
// Ambas entram neutras (1.00) via neutralWeights(). O estado do usuário é lido
// apenas para saber QUAIS critérios foram preenchidos — nunca para pontuar.
//
// Este módulo é puro: não toca no DOM, não escreve arquivo e não altera o
// estado do app. A gravação do .xlsx vive em src/utils/downloadDecisionMatrix.js.

// Rótulos das ALTERNATIVAS (métodos de lavra), em inglês e na ordem de METHODS.
// Deliberadamente separado de METHOD_LABELS (que é UI e abrevia SQS para
// "Square Set"): aqui o destino é um arquivo de dados lido por outro software.
export const EXPORT_METHOD_LABELS = {
  "OP":  "Open Pit",
  "BC":  "Block Caving",
  "SLS": "Sublevel Stoping",
  "SLC": "Sublevel Caving",
  "LW":  "Longwall",
  "R&P": "Room & Pillar",
  "SKS": "Shrinkage Stoping",
  "C&F": "Cut & Fill",
  "TS":  "Top Slicing",
  "SQS": "Square Set Stoping",
};

// Rótulos dos CRITÉRIOS, em inglês. Fora do sistema de i18n de propósito: o
// conteúdo da planilha é dado de saída com nomenclatura fixa, não interface.
export const EXPORT_CRITERION_LABELS = {
  shape:             "Shape",
  thickness:         "Thickness",
  dip:               "Dip",
  grade:             "Grade Distribution",
  depth:             "Depth",
  oreValue:          "Ore Value",
  rss_ob:            "RSS - Orebody",
  rss_hw:            "RSS - Hangingwall",
  rss_fw:            "RSS - Footwall",
  rmr_ob:            "RMR - Orebody",
  rmr_hw:            "RMR - Hangingwall",
  rmr_fw:            "RMR - Footwall",
  jointSpacing_ob:   "Joint Spacing - Orebody",
  jointSpacing_hw:   "Joint Spacing - Hangingwall",
  jointSpacing_fw:   "Joint Spacing - Footwall",
  jointCondition_ob: "Joint Condition - Orebody",
  jointCondition_hw: "Joint Condition - Hangingwall",
  jointCondition_fw: "Joint Condition - Footwall",
};

// Cabeçalho da primeira coluna (a das alternativas).
export const EXPORT_ROW_HEADER = "Mining Method";

// Nome da aba por método de seleção. Sem "/" — o Excel proíbe : \ / ? * [ ] em
// nome de aba, e é por isso que o Nicholas aparece como "1981-1992" aqui e como
// "1981/1992" na tela.
export const EXPORT_SHEET_NAMES = {
  ubc:      "UBC 1995",
  nicholas: "Nicholas 1981-1992",
  shb:      "SH&B 2007",
};

const CALCULATORS = {
  ubc:      calculateUBC,
  nicholas: calculateNicholas,
  shb:      calculateSHB,
};

// Ordem em que as abas saem no arquivo, independente da ordem do objeto recebido.
const EXPORT_ORDER = ["ubc", "nicholas", "shb"];

/**
 * Objeto de pesos inteiramente neutro (1.00), cobrindo as duas camadas.
 * Construído a cada chamada — os algoritmos fazem spread, não mutam, mas um
 * objeto novo remove qualquer chance de vazamento entre exportações.
 *
 * Não depender dos defaults internos de cada algoritmo é proposital: se algum
 * dia um default deixar de ser 1, a exportação continua neutra por construção.
 */
export function neutralWeights() {
  return {
    geo:    { shape: 1, thickness: 1, dip: 1, grade: 1, depth: 1 },
    econ:   { oreValue: 1 },
    ob:     { rss: 1, rmr: 1, jointSpacing: 1, jointCondition: 1 },
    hw:     { rss: 1, rmr: 1, jointSpacing: 1, jointCondition: 1 },
    fw:     { rss: 1, rmr: 1, jointSpacing: 1, jointCondition: 1 },
    domain: { geo: 1, ob: 1, hw: 1, fw: 1 },
  };
}

/**
 * Converte o breakdown de um resultado numa aba da matriz.
 *
 * As chaves do breakdown têm a forma `${criterio}__${valorSelecionado}` e só
 * existem para critérios efetivamente preenchidos — é exatamente o filtro de
 * "colunas ativas" que a exportação precisa. A ordem de inserção do objeto
 * segue a ordem do array de critérios do algoritmo, então as colunas saem na
 * mesma sequência em que aparecem no formulário.
 */
function buildSheet(key, result) {
  const breakdownKeys  = Object.keys(result.breakdown);
  const criterionKeys  = breakdownKeys.map((k) => k.split("__")[0]);

  const rows = METHODS.map((code) => ({
    code,
    method: EXPORT_METHOD_LABELS[code] || code,
    // `?? null` cobre o caso de a tabela trazer null para um método num critério
    // (célula vazia na planilha em vez de zero, que seria um score falso).
    values: breakdownKeys.map((bKey) => result.breakdown[bKey][code] ?? null),
  }));

  return {
    key,
    name:    EXPORT_SHEET_NAMES[key] || key,
    columns: criterionKeys.map((c) => EXPORT_CRITERION_LABELS[c] || c),
    criterionKeys,
    rows,
  };
}

/**
 * Monta a matriz de decisão bruta para cada método de seleção ativo.
 *
 * @param {object} formData        estado do formulário (só leitura)
 * @param {object} selectedMethods { ubc, nicholas, shb } — booleanos
 * @returns {{ sheets: Array, unmappedKeys: string[] }}
 *   `unmappedKeys` lista critérios que o breakdown produziu e o dicionário não
 *   cobre. Nesse caso a coluna sai com a própria chave em vez de quebrar a
 *   exportação — mas é sinal de dicionário desatualizado e deve ser reportado.
 */
export function buildDecisionMatrix(formData, selectedMethods = {}) {
  const sheets = [];
  const unmapped = new Set();

  for (const key of EXPORT_ORDER) {
    if (!selectedMethods[key]) continue;
    const result = CALCULATORS[key](formData, neutralWeights());
    const sheet  = buildSheet(key, result);
    sheet.criterionKeys.forEach((c) => {
      if (!(c in EXPORT_CRITERION_LABELS)) unmapped.add(c);
    });
    sheets.push(sheet);
  }

  return { sheets, unmappedKeys: [...unmapped] };
}

// Deslocamento aplicado aos scores na exportação, por exigência do Pro D.M.
// O menor valor das tabelas é exatamente -50 (penalidades do SH&B), então +50
// leva o intervalo para começar em zero: -50 → 0, -49 → 1, 4 → 54.
export const PRO_DM_SCORE_OFFSET = 50;

/**
 * Soma um deslocamento constante a TODA célula numérica da matriz.
 *
 * Passo separado de propósito: `buildDecisionMatrix` continua devolvendo os
 * scores BRUTOS das tabelas, e o offset entra só no caminho de exportação
 * (ver utils/downloadDecisionMatrix.js). Assim o app — ranking, Statistics,
 * breakdown na tela — segue lendo os valores originais, sem offset.
 *
 * Puro: devolve uma estrutura nova, não mexe na recebida. Rótulos de linha
 * (métodos de lavra) e cabeçalhos de coluna passam intactos — só `values` muda.
 *
 * @param {{sheets: Array, unmappedKeys: string[]}} matrix saída de buildDecisionMatrix
 * @param {number} offset  constante somada a cada score
 */
export function applyExportOffset(matrix, offset = PRO_DM_SCORE_OFFSET) {
  return {
    ...matrix,
    sheets: matrix.sheets.map((sheet) => ({
      ...sheet,
      rows: sheet.rows.map((row) => ({
        ...row,
        // Célula sem score (null) continua vazia: somar o offset ali inventaria
        // um valor que a tabela não tem.
        values: row.values.map((v) => (typeof v === "number" ? v + offset : v)),
      })),
    })),
  };
}

/**
 * Achata uma aba em array-of-arrays, o formato que o SheetJS consome direto.
 * Mantido aqui (e não no módulo de download) para ficar coberto por teste.
 */
export function sheetToAoa(sheet) {
  return [
    [EXPORT_ROW_HEADER, ...sheet.columns],
    ...sheet.rows.map((row) => [row.method, ...row.values]),
  ];
}
