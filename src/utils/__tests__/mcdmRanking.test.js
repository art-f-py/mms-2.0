import { describe, it, expect, vi, afterEach } from "vitest";
import { deriveMcdmRanking, MCDM_STATUS, MCDM_SELECTION_METHOD } from "../mcdmRanking";
import { equalGroupWeights, ENFOQUE_GROUP_IDS, groupOfCriterion } from "../../algorithms/enfoque";
import { CRITERION_GROUPS } from "../../algorithms/mcdmCriteria";
import { METHODS } from "../../algorithms/ubcWeights";
import { STEPS } from "../../data/formRules";

// ---------------------------------------------------------------------------
// INTEGRAÇÃO FORMULÁRIO -> PIPELINE MCDM
// ---------------------------------------------------------------------------
// O projeto não tem teste de componente React (ver o comentário no topo de
// mcdmRanking.js), então é aqui que a ligação entre o estado do app e o
// pipeline fica coberta: o que a tela vai chamar é exatamente esta função.
//
// O que os testes de mcdmPipeline.test.js já garantem — ordem dos passos,
// conversão de Saaty, repartição do Enfoque — NÃO é reencenado aqui. O que
// falta cobrir é a fronteira: montar a matriz a partir do formData, embrulhar
// os pesos no estado de ponderação, e nunca lançar.

// Mesmo cenário completo de decisionMatrix.test.js e mcdmPipeline.test.js —
// reaproveitado de propósito para partir de uma entrada já conhecida no projeto.
//
// `selectedMethods` foi acrescentado ao original: a guarda de completude usa
// isStepComplete, que decide quais campos são obrigatórios A PARTIR dos métodos
// marcados. Com UBC+Nicholas o RSS é CALCULADO (ucs/densidade/profundidade), que
// é justamente o trio que este cenário preenche. Ver NICHOLAS_SOZINHO abaixo
// para a outra combinação, em que o RSS é digitado à mão.
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

// Nicholas sozinho: o formulário troca o trio UCS/densidade/profundidade pelo
// select manual de RSS, e a profundidade sai da etapa de geometria.
const NICHOLAS_SOZINHO = {
  selectedMethods: { ubc: false, nicholas: true, shb: false },
  geometry: { shape: "Tabular", thickness: "Intermediário", grade: "Uniforme" },
  dip:      "45",
  rss:      { ore: "Moderada", hangingWall: "Fraca", footwall: "Resistente" },
  jointSpacing:   { ore: "Perto", hangingWall: "Longe", footwall: "Perto" },
  jointCondition: { ore: "Média", hangingWall: "Forte", footwall: "Fraca" },
};

// O caminho de falha loga no console de propósito; silencia para não poluir a
// saída da suíte, e de quebra permite afirmar que o log aconteceu.
const silenciarConsole = () => vi.spyOn(console, "error").mockImplementation(() => {});

afterEach(() => { vi.restoreAllMocks(); });

describe("caminho feliz", () => {
  it("devolve status ok com o formulário completo", () => {
    const saida = deriveMcdmRanking(FULL_SCENARIO, equalGroupWeights());
    expect(saida.status).toBe(MCDM_STATUS.OK);
  });

  it("o ranking cobre todos os métodos de lavra, um por posição", () => {
    const { result } = deriveMcdmRanking(FULL_SCENARIO, equalGroupWeights());
    expect(result.ranking).toHaveLength(METHODS.length);
    expect(result.ranking.map((r) => r.rank)).toEqual(METHODS.map((_, i) => i + 1));
  });

  it("cada entrada traz o que a tela precisa renderizar", () => {
    const { result } = deriveMcdmRanking(FULL_SCENARIO, equalGroupWeights());
    for (const entrada of result.ranking) {
      expect(typeof entrada.code).toBe("string");
      expect(typeof entrada.label).toBe("string");
      expect(entrada.label.length).toBeGreaterThan(0);
      expect(typeof entrada.closeness).toBe("number");
      expect(Number.isFinite(entrada.closeness)).toBe(true);
    }
  });

  it("a proximidade fica em [0, 1] e sai ordenada do melhor para o pior", () => {
    const { result } = deriveMcdmRanking(FULL_SCENARIO, equalGroupWeights());
    const valores = result.ranking.map((r) => r.closeness);
    for (const v of valores) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect([...valores].sort((a, b) => b - a)).toEqual(valores);
  });

  it("roda sobre a aba do Nicholas", () => {
    const { result } = deriveMcdmRanking(FULL_SCENARIO, equalGroupWeights());
    expect(result.selectionMethod).toBe(MCDM_SELECTION_METHOD);
    expect(MCDM_SELECTION_METHOD).toBe("nicholas");
  });

  it("os pesos chegam repartidos sobre os 19 critérios da matriz estendida", () => {
    const { result } = deriveMcdmRanking(FULL_SCENARIO, equalGroupWeights());
    expect(result.criterionIds).toHaveLength(19);
    expect(result.weights).toHaveLength(19);
    expect(result.weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
  });
});

describe("matriz de decisão no retorno", () => {
  // A tabela da tela lê `sheet`, `weights` e `criterionIds` direto daqui. Estes
  // testes existem para que uma futura filtragem do retorno (escolher só
  // `ranking`, por exemplo) apareça como falha e não como tabela vazia.

  it("devolve a aba que o motor leu, com as 19 colunas e os 10 métodos", () => {
    const { result } = deriveMcdmRanking(FULL_SCENARIO, equalGroupWeights());
    expect(result.sheet.criterionKeys).toHaveLength(19);
    expect(result.sheet.columns).toHaveLength(19);
    expect(result.sheet.rows).toHaveLength(METHODS.length);
  });

  it("cada linha da aba traz um valor por critério", () => {
    const { result } = deriveMcdmRanking(FULL_SCENARIO, equalGroupWeights());
    for (const row of result.sheet.rows) {
      expect(row.values).toHaveLength(19);
      expect(typeof row.method).toBe("string");
    }
  });

  it("o rótulo do método na aba é o MESMO dos cartões de ranking", () => {
    // A tabela usa sheet.rows[].method como cabeçalho de coluna e o ranking usa
    // entry.label; divergir faria a mesma alternativa aparecer com dois nomes.
    const { result } = deriveMcdmRanking(FULL_SCENARIO, equalGroupWeights());
    const naAba = Object.fromEntries(result.sheet.rows.map((r) => [r.code, r.method]));
    for (const entry of result.ranking) {
      expect(entry.label).toBe(naAba[entry.code]);
    }
  });

  it("criterionIds e weights ficam alinhados coluna a coluna com a aba", () => {
    const { result } = deriveMcdmRanking(FULL_SCENARIO, equalGroupWeights());
    expect(result.criterionIds).toEqual(result.sheet.criterionKeys);
    expect(result.weights).toHaveLength(result.criterionIds.length);
  });

  it("todo critério da aba pertence a um dos quatro grupos", () => {
    // O agrupamento das linhas da tabela depende disso: um critério sem grupo
    // sumiria da tela em silêncio.
    const { result } = deriveMcdmRanking(FULL_SCENARIO, equalGroupWeights());
    for (const id of result.criterionIds) {
      expect(ENFOQUE_GROUP_IDS).toContain(groupOfCriterion(id));
    }
  });

  it("os valores das células NÃO mudam com os pesos — só os pesos mudam", () => {
    // A distinção que a tela precisa comunicar: peso é escolha do usuário,
    // célula é dado da publicação.
    const uniforme = deriveMcdmRanking(FULL_SCENARIO, equalGroupWeights()).result;
    const enfase   = deriveMcdmRanking(FULL_SCENARIO, {
      [CRITERION_GROUPS.GEOMETRY]: 0.7, [CRITERION_GROUPS.GEOMECHANICS]: 0.1,
      [CRITERION_GROUPS.TECHNICAL]: 0.1, [CRITERION_GROUPS.ECONOMIC]: 0.1,
    }).result;

    expect(enfase.sheet.rows.map((r) => r.values)).toEqual(uniforme.sheet.rows.map((r) => r.values));
    expect(enfase.weights).not.toEqual(uniforme.weights);
  });
});

describe("os pesos de grupo realmente entram na conta", () => {
  const enfaseEm = (groupId) =>
    Object.fromEntries(Object.values(CRITERION_GROUPS).map((id) => [id, id === groupId ? 0.7 : 0.1]));

  it("mudar os pesos muda o vetor de pesos por critério", () => {
    const uniforme  = deriveMcdmRanking(FULL_SCENARIO, equalGroupWeights()).result;
    const geometria = deriveMcdmRanking(FULL_SCENARIO, enfaseEm(CRITERION_GROUPS.GEOMETRY)).result;
    expect(geometria.weights).not.toEqual(uniforme.weights);
  });

  it("dois enfoques diferentes produzem vetores de peso diferentes entre si", () => {
    const geometria = deriveMcdmRanking(FULL_SCENARIO, enfaseEm(CRITERION_GROUPS.GEOMETRY)).result;
    const economia  = deriveMcdmRanking(FULL_SCENARIO, enfaseEm(CRITERION_GROUPS.ECONOMIC)).result;
    expect(geometria.weights).not.toEqual(economia.weights);
  });

  it("a mesma entrada devolve o mesmo ranking — a derivação é determinística", () => {
    const a = deriveMcdmRanking(FULL_SCENARIO, equalGroupWeights()).result;
    const b = deriveMcdmRanking(FULL_SCENARIO, equalGroupWeights()).result;
    expect(a.ranking.map((r) => r.code)).toEqual(b.ranking.map((r) => r.code));
  });
});

describe("Nicholas sozinho — RSS manual", () => {
  it("também produz ranking, com a outra combinação de campos obrigatórios", () => {
    const saida = deriveMcdmRanking(NICHOLAS_SOZINHO, equalGroupWeights());
    expect(saida.status).toBe(MCDM_STATUS.OK);
    expect(saida.result.criterionIds).toHaveLength(19);
  });
});

describe("guarda de completude do formulário", () => {
  // Esta suíte existe por causa de um comportamento que NÃO é o esperado à
  // primeira vista: campo vazio não vira célula vazia. calculateNicholas
  // descarta o critério não preenchido e a coluna some da aba, então o
  // assertNoEmptyCells do pipeline nunca dispara por formulário incompleto —
  // o que sai é um ranking calculado só sobre os seis critérios fixos, que não
  // dependem de nenhuma entrada do usuário. Plausível e vazio de geologia.
  // Ver o comentário de deriveMcdmRanking.

  it("formulário vazio vira indisponível, e NÃO um ranking só de critérios fixos", () => {
    const saida = deriveMcdmRanking({}, equalGroupWeights());
    expect(saida.status).toBe(MCDM_STATUS.UNAVAILABLE);
    expect(saida.result).toBeUndefined();
  });

  it("aponta qual etapa está incompleta", () => {
    expect(deriveMcdmRanking({}, equalGroupWeights()).incompleteStep).toBe(STEPS.GEOMETRY);
  });

  it("um único campo geotécnico em branco já bloqueia", () => {
    const parcial = { ...FULL_SCENARIO, jointCondition: { ore: "", hangingWall: "Forte", footwall: "Fraca" } };
    const saida = deriveMcdmRanking(parcial, equalGroupWeights());
    expect(saida.status).toBe(MCDM_STATUS.UNAVAILABLE);
    expect(saida.incompleteStep).toBe(STEPS.GEOTECHNICAL);
  });

  it("um único campo de geometria em branco já bloqueia", () => {
    const parcial = { ...FULL_SCENARIO, geometry: { ...FULL_SCENARIO.geometry, shape: "" } };
    expect(deriveMcdmRanking(parcial, equalGroupWeights()).incompleteStep).toBe(STEPS.GEOMETRY);
  });

  it("formData nulo vira indisponível", () => {
    expect(deriveMcdmRanking(null, equalGroupWeights()).status).toBe(MCDM_STATUS.UNAVAILABLE);
  });

  it("formulário incompleto não polui o console — é estado esperado, não falha", () => {
    const spy = silenciarConsole();
    deriveMcdmRanking({}, equalGroupWeights());
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("estado indisponível — nunca lança", () => {
  it("pesos de grupo inválidos viram indisponível", () => {
    const spy = silenciarConsole();
    const naoSomaUm = { geometry: 0.5, geomechanics: 0.5, technical: 0.5, economic: 0.5 };
    const saida = deriveMcdmRanking(FULL_SCENARIO, naoSomaUm);
    expect(saida.status).toBe(MCDM_STATUS.UNAVAILABLE);
    expect(saida.error).toBeInstanceOf(Error);
    expect(spy).toHaveBeenCalled();
  });

  it("pesos de grupo ausentes viram indisponível", () => {
    silenciarConsole();
    expect(deriveMcdmRanking(FULL_SCENARIO, undefined).status).toBe(MCDM_STATUS.UNAVAILABLE);
    expect(deriveMcdmRanking(FULL_SCENARIO, {}).status).toBe(MCDM_STATUS.UNAVAILABLE);
  });

  it("registra a causa no console para depuração", () => {
    const spy = silenciarConsole();
    deriveMcdmRanking(FULL_SCENARIO, {});
    expect(spy.mock.calls[0][0]).toContain("[MMS]");
  });
});
