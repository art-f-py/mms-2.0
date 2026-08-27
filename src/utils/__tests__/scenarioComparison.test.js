import { describe, it, expect, vi, afterEach } from "vitest";
import { buildScenarioComparisonTable } from "../scenarioComparison";
import { MCDM_STATUS, deriveMcdmRanking } from "../mcdmRanking";
import { rankToColor } from "../rankColor";
import { uiMethodLabel } from "../methodLabel";
import { METHODS } from "../../algorithms/ubcWeights";
import { CRITERION_GROUPS } from "../../algorithms/mcdmCriteria";
import { equalGroupWeights } from "../../algorithms/enfoque";

// ---------------------------------------------------------------------------
// TABELA DE COMPARAÇÃO DE CENÁRIOS
// ---------------------------------------------------------------------------
// O contrato tem quatro partes, e três delas são sobre NÃO fazer coisas.
//
//   1. As linhas saem na ordem canônica de METHODS, nunca na do ranking de
//      alguma coluna — eleger uma coluna para ordenar contradiz o propósito da
//      tabela, e faria as linhas dançarem a cada cenário salvo.
//   2. A cor vem de rankToColor, não de uma interpolação reimplementada aqui.
//   3. Indisponibilidade é da tabela inteira, nunca de uma coluna.
//   4. Nenhum cenário salvo não é um caso de erro.
//
// O ranking em si NÃO é reencenado: mcdmRanking.test.js e mcdmPipeline.test.js
// já cobrem o que o TOPSIS produz. Aqui só interessa como esse resultado é
// arrumado em linhas e colunas.

const { GEOMETRY, ECONOMIC } = CRITERION_GROUPS;

// Mesmo cenário completo de mcdmRanking.test.js e decisionMatrix.test.js.
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

// Formulário pela metade: geometria sem geotecnia. É o estado normal de quem
// ainda está preenchendo, e o que deriveMcdmRanking recusa.
const FORM_INCOMPLETO = {
  selectedMethods: { ubc: true, nicholas: true, shb: false },
  geometry: { shape: "Tabular", thickness: "Intermediário", grade: "Uniforme" },
  dip:      "45",
};

const enfaseEm = (groupId) => {
  const pesos = { geometry: 0, geomechanics: 0, technical: 0, economic: 0 };
  return { ...pesos, [groupId]: 1 };
};

const CENARIO_UNIFORME = { id: "s1", name: "Uniforme",  groupWeights: equalGroupWeights() };
const CENARIO_GEOMETRIA = { id: "s2", name: "Geometria", groupWeights: enfaseEm(GEOMETRY) };
const CENARIO_ECONOMIA  = { id: "s3", name: "Economia",  groupWeights: enfaseEm(ECONOMIC) };

const silenciarConsole = () => vi.spyOn(console, "error").mockImplementation(() => {});
afterEach(() => { vi.restoreAllMocks(); });

describe("ordem das linhas", () => {
  it("é a de METHODS, e não a colocação de nenhum cenário", () => {
    const tabela = buildScenarioComparisonTable([CENARIO_UNIFORME], FULL_SCENARIO);
    expect(tabela.rows.map((r) => r.code)).toEqual(METHODS);
  });

  it("não muda quando os cenários mudam", () => {
    // A garantia que importa em uso: salvar ou remover um cenário não pode
    // reordenar as linhas debaixo do olho de quem está lendo.
    const um   = buildScenarioComparisonTable([CENARIO_GEOMETRIA], FULL_SCENARIO);
    const tres = buildScenarioComparisonTable(
      [CENARIO_GEOMETRIA, CENARIO_ECONOMIA, CENARIO_UNIFORME],
      FULL_SCENARIO,
    );
    expect(um.rows.map((r) => r.code)).toEqual(tres.rows.map((r) => r.code));
    expect(tres.rows.map((r) => r.code)).toEqual(METHODS);
  });

  it("a ordem das linhas independe de qual método ganha em cada coluna", () => {
    // Dois cenários que produzem rankings diferentes — se a ordem seguisse
    // algum ranking, estas duas listas discordariam.
    const geo = buildScenarioComparisonTable([CENARIO_GEOMETRIA], FULL_SCENARIO);
    const eco = buildScenarioComparisonTable([CENARIO_ECONOMIA], FULL_SCENARIO);
    expect(geo.rows.map((r) => r.code)).toEqual(eco.rows.map((r) => r.code));
  });
});

describe("rótulo das linhas", () => {
  it("usa a fonte de UI, não a de exportação", () => {
    const tabela = buildScenarioComparisonTable([CENARIO_UNIFORME], FULL_SCENARIO);
    const sqs    = tabela.rows.find((r) => r.code === "SQS");
    expect(sqs.label).toBe("Square Set");
    expect(sqs.label).not.toBe("Square Set Stoping");
  });

  it("todos os dez rótulos vêm de uiMethodLabel", () => {
    const tabela = buildScenarioComparisonTable([CENARIO_UNIFORME], FULL_SCENARIO);
    for (const row of tabela.rows) {
      expect(row.label).toBe(uiMethodLabel(row.code));
    }
  });
});

describe("colunas", () => {
  it("saem na ordem em que os cenários foram acrescentados", () => {
    const tabela = buildScenarioComparisonTable(
      [CENARIO_ECONOMIA, CENARIO_UNIFORME, CENARIO_GEOMETRIA],
      FULL_SCENARIO,
    );
    expect(tabela.scenarios.map((s) => s.id)).toEqual(["s3", "s1", "s2"]);
    expect(tabela.scenarios.map((s) => s.name)).toEqual(["Economia", "Uniforme", "Geometria"]);
  });

  it("não carregam os pesos junto — a tela não precisa deles", () => {
    const tabela = buildScenarioComparisonTable([CENARIO_UNIFORME], FULL_SCENARIO);
    expect(tabela.scenarios[0]).toEqual({ id: "s1", name: "Uniforme" });
  });

  it("cada linha tem uma célula por cenário, na mesma ordem das colunas", () => {
    const cenarios = [CENARIO_UNIFORME, CENARIO_GEOMETRIA, CENARIO_ECONOMIA];
    const tabela   = buildScenarioComparisonTable(cenarios, FULL_SCENARIO);
    for (const row of tabela.rows) {
      expect(row.cells).toHaveLength(cenarios.length);
      expect(row.cells.map((c) => c.scenarioId)).toEqual(["s1", "s2", "s3"]);
    }
  });
});

describe("colocações", () => {
  it("cada coluna traz as dez colocações, de 1 a 10, sem repetir", () => {
    const tabela = buildScenarioComparisonTable([CENARIO_UNIFORME], FULL_SCENARIO);
    const ranks  = tabela.rows.map((r) => r.cells[0].rank).sort((a, b) => a - b);
    expect(ranks).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("a colocação é a que deriveMcdmRanking devolve para aqueles pesos", () => {
    // Prova que a tabela não recalcula nem reordena nada por conta própria:
    // compara célula a célula com a fonte.
    const esperado = deriveMcdmRanking(FULL_SCENARIO, CENARIO_GEOMETRIA.groupWeights);
    const porCodigo = new Map(esperado.result.ranking.map((e) => [e.code, e.rank]));

    const tabela = buildScenarioComparisonTable([CENARIO_GEOMETRIA], FULL_SCENARIO);
    for (const row of tabela.rows) {
      expect(row.cells[0].rank).toBe(porCodigo.get(row.code));
    }
  });

  it("cenários com pesos diferentes produzem colunas diferentes", () => {
    // Se as colunas fossem idênticas, a tabela inteira seria decorativa.
    const tabela = buildScenarioComparisonTable([CENARIO_GEOMETRIA, CENARIO_ECONOMIA], FULL_SCENARIO);
    const col1 = tabela.rows.map((r) => r.cells[0].rank);
    const col2 = tabela.rows.map((r) => r.cells[1].rank);
    expect(col1).not.toEqual(col2);
  });
});

describe("cor da célula", () => {
  it("vem de rankToColor, não de uma interpolação própria", () => {
    const tabela = buildScenarioComparisonTable([CENARIO_UNIFORME], FULL_SCENARIO);
    for (const row of tabela.rows) {
      const { rank, color } = row.cells[0];
      expect(color).toBe(rankToColor(rank, tabela.rows.length));
    }
  });

  it("o total passado é o número de linhas, não um 10 fixo", () => {
    // A checagem que pega o 10 hardcoded: as dez linhas atuais fazem
    // rankToColor(1, 10) e rankToColor(1, rows.length) coincidirem, então a
    // prova precisa vir das PONTAS do gradiente, que só fecham se o total
    // estiver certo.
    const tabela  = buildScenarioComparisonTable([CENARIO_UNIFORME], FULL_SCENARIO);
    const celulas = tabela.rows.map((r) => r.cells[0]);

    const primeira = celulas.find((c) => c.rank === 1);
    const ultima   = celulas.find((c) => c.rank === tabela.rows.length);

    expect(primeira.color).toBe(rankToColor(1, tabela.rows.length));
    expect(ultima.color).toBe(rankToColor(tabela.rows.length, tabela.rows.length));
  });

  it("a melhor colocação sai verde e a pior sai vermelha", () => {
    const tabela  = buildScenarioComparisonTable([CENARIO_UNIFORME], FULL_SCENARIO);
    const celulas = tabela.rows.map((r) => r.cells[0]);

    expect(celulas.find((c) => c.rank === 1).color).toBe("hsl(120, 65%, 62%)");
    expect(celulas.find((c) => c.rank === 10).color).toBe("hsl(0, 65%, 62%)");
  });
});

describe("formulário incompleto", () => {
  it("propaga indisponível para a tabela inteira", () => {
    const tabela = buildScenarioComparisonTable([CENARIO_UNIFORME], FORM_INCOMPLETO);
    expect(tabela.status).toBe(MCDM_STATUS.UNAVAILABLE);
  });

  it("não devolve linha nenhuma — não há colocação a mostrar", () => {
    const tabela = buildScenarioComparisonTable([CENARIO_UNIFORME], FORM_INCOMPLETO);
    expect(tabela.rows).toEqual([]);
  });

  it("as colunas continuam sendo devolvidas, para a tela saber o que existe", () => {
    const tabela = buildScenarioComparisonTable([CENARIO_UNIFORME, CENARIO_ECONOMIA], FORM_INCOMPLETO);
    expect(tabela.scenarios.map((s) => s.id)).toEqual(["s1", "s3"]);
  });

  it("é a tabela inteira, e nunca uma coluna sim outra não", () => {
    // Depende só do formData, então não há como um cenário estar disponível e o
    // vizinho não. O teste existe para que uma futura mudança que marcasse
    // coluna a coluna caia aqui.
    const tabela = buildScenarioComparisonTable(
      [CENARIO_UNIFORME, CENARIO_GEOMETRIA, CENARIO_ECONOMIA],
      FORM_INCOMPLETO,
    );
    expect(tabela.status).toBe(MCDM_STATUS.UNAVAILABLE);
    expect(tabela.rows).toHaveLength(0);
  });

  it("a caixa do Nicholas no formulário NÃO derruba a tabela", () => {
    // Contraintuitivo, e por isso está escrito. deriveMcdmRanking monta a
    // matriz com `{ nicholas: true }` fixo — o pipeline MCDM sempre lê a tabela
    // do Nicholas, marcada ou não. Quem depende da caixa é a ABA em
    // Statistics.jsx (showMcdmTab), que some e leva a comparação junto; a
    // função aqui não sabe nada de abas e continua respondendo.
    const semNicholas = { ...FULL_SCENARIO, selectedMethods: { ubc: true, nicholas: false, shb: false } };
    const tabela = buildScenarioComparisonTable([CENARIO_UNIFORME], semNicholas);
    expect(tabela.status).toBe(MCDM_STATUS.OK);
    expect(tabela.rows).toHaveLength(METHODS.length);
  });

  it("formulário vazio é indisponível, e sem lançar", () => {
    silenciarConsole();
    const tabela = buildScenarioComparisonTable([CENARIO_UNIFORME], {});
    expect(tabela.status).toBe(MCDM_STATUS.UNAVAILABLE);
    expect(tabela.rows).toEqual([]);
  });
});

describe("bordas", () => {
  it("nenhum cenário salvo não quebra", () => {
    const tabela = buildScenarioComparisonTable([], FULL_SCENARIO);
    expect(tabela.status).toBe(MCDM_STATUS.OK);
    expect(tabela.scenarios).toEqual([]);
  });

  it("sem cenários, as dez linhas existem com zero células", () => {
    const tabela = buildScenarioComparisonTable([], FULL_SCENARIO);
    expect(tabela.rows.map((r) => r.code)).toEqual(METHODS);
    for (const row of tabela.rows) expect(row.cells).toEqual([]);
  });

  it("sem cenários, nem o formulário incompleto quebra", () => {
    // Não há pipeline a rodar, então nem se chega a perguntar pelo status.
    const tabela = buildScenarioComparisonTable([], FORM_INCOMPLETO);
    expect(tabela.status).toBe(MCDM_STATUS.OK);
    expect(tabela.rows).toHaveLength(METHODS.length);
  });

  it("aguenta receber algo que não é lista", () => {
    for (const naoLista of [null, undefined, {}, "cenarios"]) {
      const tabela = buildScenarioComparisonTable(naoLista, FULL_SCENARIO);
      expect(tabela.scenarios).toEqual([]);
      expect(tabela.rows).toHaveLength(METHODS.length);
    }
  });

  it("não muta os cenários que recebe", () => {
    const cenarios = [{ ...CENARIO_UNIFORME }];
    const copia    = JSON.parse(JSON.stringify(cenarios));
    buildScenarioComparisonTable(cenarios, FULL_SCENARIO);
    expect(cenarios).toEqual(copia);
  });
});
