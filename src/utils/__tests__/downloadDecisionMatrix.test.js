import { describe, it, expect, vi, afterEach } from "vitest";
import { downloadDecisionMatrix, DECISION_MATRIX_FILENAME } from "../downloadDecisionMatrix";
import { EXPORT_SCORE_OFFSET } from "../../algorithms/decisionMatrix";

// ---------------------------------------------------------------------------
// EXPORTAÇÃO DA MATRIZ — A FUNÇÃO CONTINUA VIVA SEM BOTÃO NA TELA
// ---------------------------------------------------------------------------
// O botão que chamava esta função saiu do Step 4 de Inputs.jsx (está comentado
// lá, com instrução de reativação). ESTES TESTES EXISTEM POR CAUSA DISSO: sem
// gatilho na UI, uma quebra aqui não apareceria em lugar nenhum até o dia em
// que alguém repusesse o botão — e aí pareceria culpa da reativação.
//
// O que se cobre é o que a camada faz de fato: montar → aplicar o offset de
// exportação → escrever o arquivo. O SheetJS é dublê; gravar .xlsx de verdade não
// é assunto deste teste (nem roda em `environment: 'node'`).

const FULL_SCENARIO = {
  selectedMethods: { ubc: true, nicholas: true, shb: false },
  geometry: { shape: "Tabular", thickness: "Intermediário", grade: "Uniforme" },
  dip:      "45",
  depth:    { ore: "300", hangingWall: "300", footwall: "300" },
  density:  { ore: "2500", hangingWall: "2600", footwall: "2700" },
  ucs:      { ore: "120",  hangingWall: "100",  footwall: "110" },
  rmr:      { ore: "Boa",  hangingWall: "Razoável", footwall: "Razoável" },
  jointSpacing:   { ore: "Perto", hangingWall: "Longe", footwall: "Perto" },
  jointCondition: { ore: "Média", hangingWall: "Forte", footwall: "Fraca" },
  oreValue: "Médio",
};

// Dublê do SheetJS. O import dentro da função é DINÂMICO (`await import("xlsx")`),
// e é justamente por isso que o mock precisa ser registrado no módulo: um espião
// passado por argumento não alcançaria essa chamada.
const escritas = [];
vi.mock("xlsx", () => ({
  utils: {
    book_new:          () => ({ abas: [] }),
    aoa_to_sheet:      (aoa) => ({ aoa }),
    book_append_sheet: (wb, sheet, name) => { wb.abas.push({ name, sheet }); },
  },
  writeFile: (wb, filename) => { escritas.push({ wb, filename }); },
}));

afterEach(() => { escritas.length = 0; vi.restoreAllMocks(); });

describe("downloadDecisionMatrix chamada diretamente", () => {
  it("monta, escreve e informa que escreveu", async () => {
    const saida = await downloadDecisionMatrix(FULL_SCENARIO, { nicholas: true });

    expect(saida.written).toBe(true);
    expect(saida.sheets).toHaveLength(1);
    expect(escritas).toHaveLength(1);
  });

  it("usa o nome de arquivo padrão, e aceita um próprio", async () => {
    await downloadDecisionMatrix(FULL_SCENARIO, { nicholas: true });
    expect(escritas[0].filename).toBe(DECISION_MATRIX_FILENAME);

    escritas.length = 0;
    await downloadDecisionMatrix(FULL_SCENARIO, { nicholas: true }, "outro.xlsx");
    expect(escritas[0].filename).toBe("outro.xlsx");
  });

  it("uma aba por método pedido", async () => {
    const saida = await downloadDecisionMatrix(FULL_SCENARIO, { nicholas: true, ubc: true });
    expect(saida.sheets).toHaveLength(2);
    expect(escritas[0].wb.abas).toHaveLength(2);
  });

  it("aplica o offset de exportação — o caminho de exportação, e não o do app", async () => {
    // A razão de o offset viver só aqui: o ranking da tela usa os scores
    // originais. Se o offset vazasse para buildDecisionMatrix, o MCDM inteiro
    // mudaria junto. Confere que a saída exportada está deslocada.
    const saida = await downloadDecisionMatrix(FULL_SCENARIO, { nicholas: true });
    const valores = saida.sheets[0].rows.flatMap((r) => r.values).filter((v) => typeof v === "number");

    expect(valores.length).toBeGreaterThan(0);
    // Com offset, nenhum score fica abaixo do piso deslocado.
    for (const v of valores) expect(v).toBeGreaterThanOrEqual(EXPORT_SCORE_OFFSET - 49);
  });

  it("sem método selecionado não escreve arquivo nenhum, e não lança", async () => {
    // A rede de baixo: o botão desabilitado sumiu da tela junto com o botão, e
    // esta guarda é a única que resta contra um workbook vazio (que faria o
    // SheetJS lançar).
    const saida = await downloadDecisionMatrix(FULL_SCENARIO, {});

    expect(saida.written).toBe(false);
    expect(saida.sheets).toEqual([]);
    expect(escritas).toHaveLength(0);
  });

  it("devolve uma Promise — quem chama depende do .catch()", async () => {
    // O handler removido fazia `.catch(...)`. Se a função deixasse de ser
    // async, a reativação quebraria de um jeito nada óbvio.
    const p = downloadDecisionMatrix(FULL_SCENARIO, { nicholas: true });
    expect(typeof p.then).toBe("function");
    await p;
  });
});
