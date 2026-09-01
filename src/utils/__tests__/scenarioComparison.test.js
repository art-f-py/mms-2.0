import { describe, it, expect, vi, afterEach } from "vitest";
import { buildScenarioComparisonTable } from "../scenarioComparison";
import { MCDM_STATUS, deriveMcdmRanking } from "../mcdmRanking";
import { rankToColor } from "../rankColor";
import { uiMethodLabel } from "../methodLabel";
import { METHODS } from "../../algorithms/ubcWeights";
import { CRITERION_GROUPS } from "../../algorithms/mcdmCriteria";
import { equalGroupWeights, WEIGHTING_MODES } from "../../algorithms/enfoque";

// ---------------------------------------------------------------------------
// TABELA DE COMPARAÇÃO DE CENÁRIOS
// ---------------------------------------------------------------------------
// O contrato tem cinco partes, e três delas são sobre NÃO fazer coisas.
//
//   1. As linhas saem na ordem canônica de METHODS, nunca na do ranking de
//      alguma coluna — eleger uma coluna para ordenar contradiz o propósito da
//      tabela, e faria as linhas dançarem a cada cenário salvo.
//   2. A cor vem de rankToColor, não de uma interpolação reimplementada aqui.
//   3. Cada coluna é recalculada com o MÉTODO E O MODO DO PRÓPRIO CENÁRIO —
//      nunca com um método da tabela, que não existe mais.
//   4. Indisponibilidade é POR COLUNA. Uma coluna que não calcula não derruba as
//      vizinhas.
//   5. Nenhum cenário salvo não é um caso de erro.
//
// O ranking em si NÃO é reencenado: mcdmRanking.test.js e mcdmPipeline.test.js
// já cobrem o que o TOPSIS produz. Aqui só interessa como esse resultado é
// arrumado em linhas e colunas.

const { GEOMETRY, ECONOMIC } = CRITERION_GROUPS;
const { ENFOQUE, ENTROPY } = WEIGHTING_MODES;

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
// ainda está preenchendo, e o que deriveMcdmRanking recusa — para TODOS os
// métodos, já que a geotecnia é exigência comum aos três.
const FORM_INCOMPLETO = {
  selectedMethods: { ubc: true, nicholas: true, shb: false },
  geometry: { shape: "Tabular", thickness: "Intermediário", grade: "Uniforme" },
  dip:      "45",
};

// O formulário que SEPARA os métodos: completo para Nicholas e UBC, incompleto
// para o SH&B — que é o único a exigir o valor do minério. É com ele que a
// indisponibilidade por coluna deixa de ser hipótese.
const SHB_SEM_VALOR_DO_MINERIO = {
  ...FULL_SCENARIO,
  selectedMethods: { ubc: true, nicholas: true, shb: true },
  oreValue: "",
};

const enfaseEm = (groupId) => {
  const pesos = { geometry: 0, geomechanics: 0, technical: 0, economic: 0 };
  return { ...pesos, [groupId]: 1 };
};

// Os cenários agora carregam método e modo. Os três abaixo são de Nicholas +
// Enfoque, para que os testes de linha, cor e colocação continuem falando da
// mesma coisa que falavam antes desta mudança.
const CENARIO_UNIFORME  = { id: "s1", name: "Uniforme",  method: "nicholas", mode: ENFOQUE, groupWeights: equalGroupWeights() };
const CENARIO_GEOMETRIA = { id: "s2", name: "Geometria", method: "nicholas", mode: ENFOQUE, groupWeights: enfaseEm(GEOMETRY) };
const CENARIO_ECONOMIA  = { id: "s3", name: "Economia",  method: "nicholas", mode: ENFOQUE, groupWeights: enfaseEm(ECONOMIC) };

// Os que existem para provar que a coluna manda: mesmo peso, método diferente;
// e o de Entropy, que não tem peso nenhum.
const CENARIO_UBC     = { id: "u1", name: "Geometria",  method: "ubc", mode: ENFOQUE, groupWeights: enfaseEm(GEOMETRY) };
const CENARIO_ENTROPY = { id: "e1", name: "Sem opinião", method: "nicholas", mode: ENTROPY, groupWeights: null };
const CENARIO_SHB     = { id: "b1", name: "SH&B",       method: "shb", mode: ENFOQUE, groupWeights: equalGroupWeights() };

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

  it("levam método, modo e status — é o que identifica a coluna na tela", () => {
    // Os PESOS continuam fora: a tela não desenha nada com eles. Método e modo
    // entraram porque o cabeçalho passou a mostrá-los, e sem eles duas colunas
    // de mesmo nome e métodos diferentes seriam indistinguíveis.
    const tabela = buildScenarioComparisonTable([CENARIO_UNIFORME], FULL_SCENARIO);
    expect(tabela.scenarios[0]).toEqual({
      id: "s1", name: "Uniforme", method: "nicholas", mode: ENFOQUE, status: MCDM_STATUS.OK,
    });
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

  it("a colocação é a que deriveMcdmRanking devolve para aquele cenário", () => {
    // Prova que a tabela não recalcula nem reordena nada por conta própria:
    // compara célula a célula com a fonte, chamada com o método e o modo DO
    // CENÁRIO.
    const esperado = deriveMcdmRanking(FULL_SCENARIO, CENARIO_GEOMETRIA.groupWeights, {
      method: CENARIO_GEOMETRIA.method,
      mode:   CENARIO_GEOMETRIA.mode,
    });
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

// ---------------------------------------------------------------------------
// CADA CENÁRIO COM O PRÓPRIO MÉTODO E O PRÓPRIO MODO
// ---------------------------------------------------------------------------
// É a mudança inteira do item: a tabela deixou de ter UM método. O que estes
// casos travam é que a configuração usada no recálculo sai do cenário, e de
// mais lugar nenhum.
describe("método e modo por cenário", () => {
  it("dois cenários com o MESMO peso e métodos diferentes dão colunas diferentes", () => {
    // CENARIO_GEOMETRIA e CENARIO_UBC têm a repartição idêntica. Se o método do
    // cenário fosse ignorado, as duas colunas sairiam iguais — e a comparação
    // Nicholas x UBC, que é o ponto todo, não existiria.
    const tabela = buildScenarioComparisonTable([CENARIO_GEOMETRIA, CENARIO_UBC], FULL_SCENARIO);
    const col1 = tabela.rows.map((r) => r.cells[0].rank);
    const col2 = tabela.rows.map((r) => r.cells[1].rank);
    expect(col1).not.toEqual(col2);
    expect(tabela.scenarios.map((s) => s.method)).toEqual(["nicholas", "ubc"]);
  });

  it("um cenário de Entropy calcula, sem peso nenhum guardado", () => {
    const tabela = buildScenarioComparisonTable([CENARIO_ENTROPY], FULL_SCENARIO);
    expect(tabela.status).toBe(MCDM_STATUS.OK);
    expect(tabela.scenarios[0].mode).toBe(ENTROPY);
    expect(tabela.rows.map((r) => r.cells[0].rank).sort((a, b) => a - b))
      .toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("Entropy e Enfoque no MESMO método dão colunas diferentes", () => {
    // Se o modo do cenário fosse ignorado, o de Entropy sairia igual ao de
    // Enfoque com os pesos que ele nem guarda.
    const tabela = buildScenarioComparisonTable([CENARIO_GEOMETRIA, CENARIO_ENTROPY], FULL_SCENARIO);
    const col1 = tabela.rows.map((r) => r.cells[0].rank);
    const col2 = tabela.rows.map((r) => r.cells[1].rank);
    expect(col1).not.toEqual(col2);
  });

  it("Nicholas, UBC e Entropy convivem na mesma tabela", () => {
    // O caso de uso que a mudança libera, escrito por extenso.
    const tabela = buildScenarioComparisonTable(
      [CENARIO_GEOMETRIA, CENARIO_UBC, CENARIO_ENTROPY],
      FULL_SCENARIO,
    );
    expect(tabela.status).toBe(MCDM_STATUS.OK);
    expect(tabela.scenarios.map((s) => `${s.method}/${s.mode}`))
      .toEqual(["nicholas/enfoque", "ubc/enfoque", "nicholas/entropy"]);
    for (const row of tabela.rows) {
      expect(row.cells.every((c) => c.status === MCDM_STATUS.OK)).toBe(true);
    }
  });

  it("as LINHAS não mudam com o método — só as colocações", () => {
    // A ordem canônica das linhas é METHODS, não a colocação de ninguém.
    const tabela = buildScenarioComparisonTable([CENARIO_GEOMETRIA, CENARIO_UBC], FULL_SCENARIO);
    expect(tabela.rows.map((r) => r.code)).toEqual(METHODS);
  });

  it("o SH&B entra como qualquer outro método de cenário", () => {
    const tabela = buildScenarioComparisonTable([CENARIO_SHB], FULL_SCENARIO);
    expect(tabela.status).toBe(MCDM_STATUS.OK);
    expect(tabela.rows).toHaveLength(METHODS.length);
  });
});

// ---------------------------------------------------------------------------
// INDISPONIBILIDADE POR COLUNA
// ---------------------------------------------------------------------------
// Era da tabela inteira, com o argumento (então correto) de que o veredito
// dependia só do formData e do método, iguais para todos os cenários. Com o
// método dentro do cenário isso deixou de valer: a exigência de completude
// varia por método.
describe("indisponibilidade por coluna", () => {
  it("um cenário de SH&B sem o valor do minério não derruba os vizinhos", () => {
    // O caso concreto: SH&B exige `oreValue` (etapa complementar), Nicholas e
    // UBC não. Duas colunas calculam, uma não.
    const tabela = buildScenarioComparisonTable(
      [CENARIO_GEOMETRIA, CENARIO_SHB, CENARIO_UBC],
      SHB_SEM_VALOR_DO_MINERIO,
    );

    expect(tabela.status).toBe(MCDM_STATUS.OK);
    expect(tabela.scenarios.map((s) => s.status))
      .toEqual([MCDM_STATUS.OK, MCDM_STATUS.UNAVAILABLE, MCDM_STATUS.OK]);
  });

  it("a coluna indisponível vira célula vazia em TODAS as linhas", () => {
    const tabela = buildScenarioComparisonTable(
      [CENARIO_GEOMETRIA, CENARIO_SHB],
      SHB_SEM_VALOR_DO_MINERIO,
    );
    for (const row of tabela.rows) {
      expect(row.cells[0].rank).toBeGreaterThan(0);
      expect(row.cells[1]).toEqual({
        scenarioId: "b1", rank: null, color: null, status: MCDM_STATUS.UNAVAILABLE,
      });
    }
  });

  it("as células continuam alinhadas com as colunas, posição a posição", () => {
    // O risco concreto de marcar coluna a coluna: pular a coluna vazia em vez de
    // preenchê-la desalinharia tudo o que vem depois dela.
    const cenarios = [CENARIO_SHB, CENARIO_GEOMETRIA, CENARIO_SHB, CENARIO_UBC];
    const tabela   = buildScenarioComparisonTable(cenarios, SHB_SEM_VALOR_DO_MINERIO);
    for (const row of tabela.rows) {
      expect(row.cells).toHaveLength(cenarios.length);
      expect(row.cells.map((c) => c.scenarioId)).toEqual(cenarios.map((c) => c.id));
    }
  });

  it("método desconhecido derruba SÓ a coluna dele", () => {
    silenciarConsole();
    const quebrado = { id: "x", name: "?", method: "topsis-9000", mode: ENFOQUE, groupWeights: equalGroupWeights() };
    const tabela   = buildScenarioComparisonTable([quebrado, CENARIO_UNIFORME], FULL_SCENARIO);

    expect(tabela.status).toBe(MCDM_STATUS.OK);
    expect(tabela.scenarios.map((s) => s.status))
      .toEqual([MCDM_STATUS.UNAVAILABLE, MCDM_STATUS.OK]);
    expect(tabela.rows[0].cells[1].rank).toBeGreaterThan(0);
  });

  it("pesos inválidos derrubam SÓ a coluna deles", () => {
    silenciarConsole();
    const naoSomaUm = { geometry: 0.5, geomechanics: 0.5, technical: 0.5, economic: 0.5 };
    const torto = { id: "x", name: "?", method: "nicholas", mode: ENFOQUE, groupWeights: naoSomaUm };
    const tabela = buildScenarioComparisonTable([torto, CENARIO_UNIFORME], FULL_SCENARIO);

    expect(tabela.scenarios.map((s) => s.status))
      .toEqual([MCDM_STATUS.UNAVAILABLE, MCDM_STATUS.OK]);
  });
});

describe("formulário incompleto para todos os métodos", () => {
  it("com nenhuma coluna calculando, o status do topo vira indisponível", () => {
    // O único caso em que a tela tem algo melhor a fazer do que desenhar a
    // grade: não há uma coluna sequer com colocação.
    const tabela = buildScenarioComparisonTable(
      [CENARIO_UNIFORME, CENARIO_GEOMETRIA, CENARIO_ECONOMIA],
      FORM_INCOMPLETO,
    );
    expect(tabela.status).toBe(MCDM_STATUS.UNAVAILABLE);
  });

  it("as colunas continuam sendo devolvidas, para a tela saber o que existe", () => {
    const tabela = buildScenarioComparisonTable([CENARIO_UNIFORME, CENARIO_ECONOMIA], FORM_INCOMPLETO);
    expect(tabela.scenarios.map((s) => s.id)).toEqual(["s1", "s3"]);
  });

  it("a caixa do método no formulário NÃO derruba a coluna", () => {
    // Contraintuitivo, e por isso está escrito. deriveMcdmRanking monta a
    // matriz com `{ [method]: true }` — a aba do método PEDIDO, marcada ou não
    // no formulário. Quem depende da caixa é a ABA em Statistics.jsx
    // (showMcdmTab, via availableMcdmMethods), que some e leva a comparação
    // junto; a função aqui não sabe nada de abas e continua respondendo.
    const semNicholas = { ...FULL_SCENARIO, selectedMethods: { ubc: true, nicholas: false, shb: false } };
    const tabela = buildScenarioComparisonTable([CENARIO_UNIFORME], semNicholas);
    expect(tabela.status).toBe(MCDM_STATUS.OK);
    expect(tabela.rows).toHaveLength(METHODS.length);
  });

  it("formulário vazio é indisponível, e sem lançar", () => {
    silenciarConsole();
    const tabela = buildScenarioComparisonTable([CENARIO_UNIFORME], {});
    expect(tabela.status).toBe(MCDM_STATUS.UNAVAILABLE);
    expect(tabela.rows[0].cells[0].rank).toBeNull();
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
