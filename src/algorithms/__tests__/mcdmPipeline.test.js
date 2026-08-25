import { describe, it, expect } from "vitest";
import {
  runMcdmPipeline,
  convertClassicColumnsToSaaty,
  assertMcdmMethodSupported,
  MCDM_SUPPORTED_METHODS,
  MCDM_PENDING_METHODS,
} from "../mcdmPipeline";
import {
  buildDecisionMatrix,
  extendSheetWithFixedCriteria,
} from "../decisionMatrix";
import {
  createWeightingState,
  setWeightingMode,
  WEIGHTING_MODES,
  ENFOQUE_GROUPS_BY_ID,
  equalGroupWeights,
  groupOfCriterion,
} from "../enfoque";
import {
  CRITERION_GROUPS,
  DIRECTION,
  FIXED_CRITERIA,
  FIXED_CRITERION_SCORES,
} from "../mcdmCriteria";
import { SAATY_ELIMINATION_VALUE } from "../saatyScale";
import { METHODS } from "../ubcWeights";

// ---------------------------------------------------------------------------
// PIPELINE MCDM — MATRIZ -> CRITERIOS FIXOS -> SAATY -> ENFOQUE -> TOPSIS
// ---------------------------------------------------------------------------
// Ate aqui as quatro pecas do MCDM so tinham teste isolado. O que estes testes
// fixam e a COMPOSICAO: a ordem dos passos, o que cada passo NAO deve tocar, e
// a guarda que impede UBC e SH&B de entrarem no pipeline antes de o Francisco
// definir a conversao dos valores fora do dominio.

// Mesmo cenario completo de decisionMatrix.test.js — reaproveitado de proposito
// para que o teste ponta-a-ponta parta de uma entrada ja conhecida no projeto.
const FULL_SCENARIO = {
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

const nicholasMatrix = () => buildDecisionMatrix(FULL_SCENARIO, { nicholas: true });

const enfoque = (groupWeights) =>
  setWeightingMode(createWeightingState(), WEIGHTING_MODES.ENFOQUE, { groupWeights });

// Vetor de pesos que concentra 0.7 num grupo e reparte 0.1 entre os outros
// tres. Uma forma compacta de escrever "enfase neste grupo" sem repetir o
// objeto de quatro chaves em cada teste.
const enfaseEm = (groupId) =>
  Object.fromEntries(
    Object.values(CRITERION_GROUPS).map((id) => [id, id === groupId ? 0.7 : 0.1]),
  );

const ordem = (resultado) => resultado.ranking.map((r) => r.code);

// Os 13 criterios que o Nicholas produz com o formulario cheio, na ordem em que
// o algoritmo os monta. Fixado aqui para que uma mudanca de ordem apareca como
// falha explicita, e nao como um ranking silenciosamente diferente.
const CLASSICOS_NICHOLAS = [
  "shape", "thickness", "dip", "grade",
  "rss_ob", "jointSpacing_ob", "jointCondition_ob",
  "rss_hw", "jointSpacing_hw", "jointCondition_hw",
  "rss_fw", "jointSpacing_fw", "jointCondition_fw",
];

const IDS_FIXOS = FIXED_CRITERIA.map((c) => c.id);

// ---------------------------------------------------------------------------
// GUARDA — METODO NAO SUPORTADO
// ---------------------------------------------------------------------------
// Esta e a falha PROPOSITAL da fase atual: UBC e SH&B tem, nas proprias
// tabelas, valores que a escala de Saaty ainda nao sabe converter. O ponto dos
// testes nao e so "lanca", e "lanca dizendo o que falta e de quem depende".

describe("guarda de metodo nao suportado", () => {
  it("so o Nicholas esta liberado por enquanto", () => {
    expect(MCDM_SUPPORTED_METHODS).toEqual(["nicholas"]);
    expect(Object.keys(MCDM_PENDING_METHODS).sort()).toEqual(["shb", "ubc"]);
  });

  it("assertMcdmMethodSupported passa para nicholas e lanca para ubc/shb", () => {
    expect(() => assertMcdmMethodSupported("nicholas")).not.toThrow();
    expect(() => assertMcdmMethodSupported("ubc")).toThrow(/ainda não suportado para UBC/);
    expect(() => assertMcdmMethodSupported("shb")).toThrow(/ainda não suportado para SH&B/);
  });

  it("runMcdmPipeline para UBC lanca a mensagem explicita, citando a pendencia externa", () => {
    // A matriz TEM a aba de UBC — o que barra e a guarda, nao a falta de dados.
    const matrix = buildDecisionMatrix(FULL_SCENARIO, { ubc: true, nicholas: true });

    expect(() => runMcdmPipeline(matrix, { method: "ubc" }))
      .toThrow(/Pipeline MCDM ainda não suportado para UBC/);
    expect(() => runMcdmPipeline(matrix, { method: "ubc" }))
      .toThrow(/regra de conversão Saaty do Francisco/);
  });

  it("runMcdmPipeline para SH&B lanca a mensagem explicita, citando a pendencia externa", () => {
    const matrix = buildDecisionMatrix(FULL_SCENARIO, { shb: true, nicholas: true });

    expect(() => runMcdmPipeline(matrix, { method: "shb" }))
      .toThrow(/Pipeline MCDM ainda não suportado para SH&B/);
    expect(() => runMcdmPipeline(matrix, { method: "shb" }))
      .toThrow(/regra de conversão Saaty do Francisco/);
  });

  it("a guarda nao deixa o erro generico do toSaaty ser a unica pista", () => {
    // Sem a guarda, o UBC quebraria mesmo assim — mas com "score -10 fora do
    // dominio especificado", que nao diz qual metodo de selecao foi pedido nem
    // que a decisao e do Francisco. Este teste prova as DUAS coisas: que a
    // mensagem generica realmente aconteceria, e que nao e ela que sai.
    const matrix = buildDecisionMatrix({ geometry: { thickness: "Muito estreito" } }, { ubc: true });
    const abaUbc = extendSheetWithFixedCriteria(matrix.sheets[0]);

    // O caminho sem guarda: RangeError do toSaaty, sem contexto de metodo.
    expect(() => convertClassicColumnsToSaaty(abaUbc)).toThrow(RangeError);
    expect(() => convertClassicColumnsToSaaty(abaUbc)).toThrow(/toSaaty: score -10 fora do domínio/);

    // O caminho com guarda: erro nomeando o metodo e a pendencia. A mensagem
    // tambem fala em dominio, mas como EXPLICACAO — nao e o erro cru do
    // toSaaty, e nao e um RangeError de conversao.
    let capturado;
    try { runMcdmPipeline(matrix, { method: "ubc" }); } catch (e) { capturado = e; }
    expect(capturado).toBeInstanceOf(Error);
    expect(capturado).not.toBeInstanceOf(RangeError);
    expect(capturado.message).toMatch(/não suportado para UBC/);
    expect(capturado.message).not.toMatch(/toSaaty/);
  });

  it("nao retorna resultado nenhum para UBC/SH&B — lanca, nao devolve ranking errado", () => {
    // O risco que este teste cobre e o pior dos dois: um pipeline que ignorasse
    // silenciosamente as colunas problematicas devolveria um ranking plausivel
    // e sem sentido.
    const matrix = buildDecisionMatrix(FULL_SCENARIO, { ubc: true, shb: true });
    for (const method of ["ubc", "shb"]) {
      let resultado = "nao atribuido";
      expect(() => { resultado = runMcdmPipeline(matrix, { method }); }).toThrow();
      expect(resultado).toBe("nao atribuido");
    }
  });

  it("metodo desconhecido tem mensagem propria, diferente da de pendencia", () => {
    expect(() => runMcdmPipeline(nicholasMatrix(), { method: "aleatorio" }))
      .toThrow(/método de seleção desconhecido/);
    expect(() => runMcdmPipeline(nicholasMatrix(), { method: "aleatorio" }))
      .not.toThrow(/Francisco/);
  });
});

// ---------------------------------------------------------------------------
// PONTA A PONTA — NICHOLAS
// ---------------------------------------------------------------------------

describe("runMcdmPipeline — Nicholas ponta a ponta", () => {
  it("roda a matriz completa ate o ranking final", () => {
    const r = runMcdmPipeline(nicholasMatrix());

    expect(r.selectionMethod).toBe("nicholas");
    expect(r.ranking).toHaveLength(METHODS.length);
    expect(r.ranking.map((e) => e.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    // Ranking ordenado do melhor para o pior, sem empate fora de ordem.
    r.ranking.forEach((entry, i) => {
      if (i > 0) expect(entry.closeness).toBeLessThanOrEqual(r.ranking[i - 1].closeness);
    });
    // Toda alternativa aparece exatamente uma vez.
    expect([...ordem(r)].sort()).toEqual([...METHODS].sort());
  });

  it("o Nicholas e o default de method — nao e preciso passar opcao nenhuma", () => {
    expect(runMcdmPipeline(nicholasMatrix(), { method: "nicholas" }))
      .toEqual(runMcdmPipeline(nicholasMatrix()));
  });

  it("cada entrada do ranking traz codigo, rotulo e proximidade", () => {
    const r = runMcdmPipeline(nicholasMatrix());
    const primeiro = r.ranking[0];

    expect(METHODS).toContain(primeiro.code);
    expect(primeiro.label).toBe("Open Pit");
    expect(primeiro.closeness).toBeGreaterThan(0);
    expect(primeiro.closeness).toBeLessThan(1);
  });

  it("o rotulo do metodo de lavra chama-se `label`, nunca `method`", () => {
    // Trava do desambiguamento: `method` no topo do retorno seria o metodo de
    // SELECAO, e dentro da entrada seria o de LAVRA. Uma palavra so para dois
    // sentidos no mesmo objeto foi o que este rename desfez — que nao volte.
    const r = runMcdmPipeline(nicholasMatrix());

    expect(r.selectionMethod).toBe("nicholas");
    r.ranking.forEach((entry) => {
      expect(entry).not.toHaveProperty("method");
      expect(typeof entry.label).toBe("string");
      expect(entry.label.length).toBeGreaterThan(0);
    });
    // E o rotulo continua casando com a linha de origem da aba.
    r.ranking.forEach((entry) => {
      expect(entry.label).toBe(r.sheet.rows[entry.index].method);
    });
  });

  it("ranking do cenario completo — trava de regressao", () => {
    // Valor de referencia gerado por este pipeline. Nao e verdade externa: e
    // uma trava, para que qualquer mudanca de escala, direcao ou ordem de
    // coluna apareca aqui em vez de passar despercebida.
    expect(ordem(runMcdmPipeline(nicholasMatrix())))
      .toEqual(["OP", "C&F", "SQS", "SKS", "R&P", "SLS", "BC", "LW", "SLC", "TS"]);
  });

  it("as colunas sao as 13 classicas do Nicholas mais as 6 fixas, nessa ordem", () => {
    const r = runMcdmPipeline(nicholasMatrix());
    expect(r.criterionIds).toEqual([...CLASSICOS_NICHOLAS, ...IDS_FIXOS]);
    expect(r.criteria.map((c) => c.id)).toEqual(r.criterionIds);
  });

  it("as direcoes chegam ao motor: classicas de maximizar, fixas conforme declarado", () => {
    const porId = Object.fromEntries(
      runMcdmPipeline(nicholasMatrix()).criteria.map((c) => [c.id, c.direction]),
    );
    CLASSICOS_NICHOLAS.forEach((id) => expect(porId[id]).toBe(DIRECTION.MAX));
    expect(porId.dilution).toBe(DIRECTION.MIN);
    expect(porId.capitalInvestment).toBe(DIRECTION.MIN);
    expect(porId.comparativeCosts).toBe(DIRECTION.MIN);
    expect(porId.recovery).toBe(DIRECTION.MAX);
  });

  it("a matriz recebida nao e alterada pelo pipeline", () => {
    const matrix = nicholasMatrix();
    const antes  = JSON.parse(JSON.stringify(matrix));
    runMcdmPipeline(matrix, { weighting: enfoque(enfaseEm(CRITERION_GROUPS.TECHNICAL)) });
    expect(matrix).toEqual(antes);
  });

  it("lanca com mensagem propria quando a aba do metodo nao esta na matriz", () => {
    const soUbc = buildDecisionMatrix(FULL_SCENARIO, { ubc: true });
    expect(() => runMcdmPipeline(soUbc, { method: "nicholas" }))
      .toThrow(/não tem aba para "nicholas"/);
  });
});

// ---------------------------------------------------------------------------
// CONVERSAO — CLASSICAS EM SAATY, FIXAS INTACTAS
// ---------------------------------------------------------------------------
// O passo mais facil de errar do pipeline inteiro: converter demais. Passar as
// colunas fixas pelo toSaaty estouraria no indice de custo (vai ate 100) — e,
// nos criterios de 1 a 5, produziria numeros plausiveis e errados.

describe("conversao para Saaty — so as colunas classicas", () => {
  it("converte cada score classico por 2x+1", () => {
    const bruta = nicholasMatrix().sheets[0];
    const r     = runMcdmPipeline(nicholasMatrix());

    r.sheet.rows.forEach((row, i) => {
      bruta.rows[i].values.forEach((valorBruto, j) => {
        const esperado = valorBruto === -49 ? SAATY_ELIMINATION_VALUE : 2 * valorBruto + 1;
        expect(row.values[j]).toBe(esperado);
      });
    });
  });

  it("Open Pit no cenario completo: 2,3,3,3... vira 5,7,7,7...", () => {
    const r  = runMcdmPipeline(nicholasMatrix());
    const op = r.sheet.rows.find((row) => row.code === "OP");
    expect(op.values.slice(0, 4)).toEqual([5, 7, 7, 7]);
  });

  it("a eliminacao -49 do Nicholas vira 0, o piso da escala", () => {
    // Forma "Massivo": LW vale -49 na tabela de geometria do Nicholas.
    const r  = runMcdmPipeline(buildDecisionMatrix({ geometry: { shape: "Massivo" } }, { nicholas: true }));
    const lw = r.sheet.rows.find((row) => row.code === "LW");

    expect(r.criterionIds[0]).toBe("shape");
    expect(lw.values[0]).toBe(SAATY_ELIMINATION_VALUE);
    // E continua sendo o pior da coluna, nao o melhor.
    const coluna = r.sheet.rows.map((row) => row.values[0]);
    expect(Math.min(...coluna)).toBe(0);
  });

  it("as seis colunas fixas passam intactas, na escala nativa da tabela", () => {
    const r = runMcdmPipeline(nicholasMatrix());

    r.sheet.rows.forEach((row) => {
      const indiceMetodo = METHODS.indexOf(row.code);
      IDS_FIXOS.forEach((id) => {
        const coluna = r.criterionIds.indexOf(id);
        expect(row.values[coluna]).toBe(FIXED_CRITERION_SCORES[id][indiceMetodo]);
      });
    });
  });

  it("o indice de custo mantem a escala 10-100 — prova de que nao passou por Saaty", () => {
    // 10 esta fora do dominio do toSaaty: se tivesse passado, teria lancado.
    const r      = runMcdmPipeline(nicholasMatrix());
    const coluna = r.criterionIds.indexOf("comparativeCosts");
    const custos = r.sheet.rows.map((row) => row.values[coluna]);

    expect(custos).toEqual([10, 25, 40, 50, 40, 30, 55, 60, 70, 100]);
    expect(Math.max(...custos)).toBeGreaterThan(9);
  });

  it("convertClassicColumnsToSaaty e pura — a aba recebida nao muda", () => {
    const aba   = extendSheetWithFixedCriteria(nicholasMatrix().sheets[0]);
    const copia = JSON.parse(JSON.stringify(aba));
    convertClassicColumnsToSaaty(aba);
    expect(aba).toEqual(copia);
  });
});

// ---------------------------------------------------------------------------
// ENFOQUE — ATIVO x INATIVO
// ---------------------------------------------------------------------------

describe("Enfoque dentro do pipeline", () => {
  it("sem Enfoque, todos os criterios entram com o mesmo peso", () => {
    const r = runMcdmPipeline(nicholasMatrix());
    expect(r.weights).toEqual(r.criterionIds.map(() => 1));
    // O motor normaliza; depois disso e exatamente equalWeights.
    r.topsis.weights.forEach((w) => expect(w).toBeCloseTo(1 / r.criterionIds.length, 12));
  });

  it("estado default explicito e ausencia de estado dao o mesmo resultado", () => {
    expect(runMcdmPipeline(nicholasMatrix(), { weighting: createWeightingState() }))
      .toEqual(runMcdmPipeline(nicholasMatrix()));
  });

  it("cada peso e o peso do grupo dividido pelo tamanho do grupo", () => {
    const gw = enfaseEm(CRITERION_GROUPS.GEOMETRY);
    const r  = runMcdmPipeline(nicholasMatrix(), { weighting: enfoque(gw) });

    r.criterionIds.forEach((id, j) => {
      const grupo   = groupOfCriterion(id);
      const tamanho = ENFOQUE_GROUPS_BY_ID[grupo].criterionIds.length;
      expect(r.weights[j]).toBeCloseTo(gw[grupo] / tamanho, 12);
    });
  });

  it("INVARIANTE: com as 19 colunas presentes, os pesos somam 1", () => {
    // A invariante do modelo, verificada no pipeline real e nao so na unidade.
    const cenarios = [
      equalGroupWeights(),
      enfaseEm(CRITERION_GROUPS.GEOMETRY),
      enfaseEm(CRITERION_GROUPS.GEOMECHANICS),
      enfaseEm(CRITERION_GROUPS.TECHNICAL),
      enfaseEm(CRITERION_GROUPS.ECONOMIC),
    ];
    cenarios.forEach((gw) => {
      const r = runMcdmPipeline(nicholasMatrix(), { weighting: enfoque(gw) });
      expect(r.criterionIds).toHaveLength(19);
      expect(r.weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    });
  });

  it("os 19 criterios da matriz caem todos em algum grupo — nenhum orfao", () => {
    // Se o pipeline produzir uma coluna que ninguem declarou, o Enfoque lanca.
    // Este teste confirma que hoje isso nao acontece para o Nicholas completo.
    const r = runMcdmPipeline(nicholasMatrix());
    r.criterionIds.forEach((id) => {
      expect(groupOfCriterion(id)).toBeTruthy();
    });
    expect(() => runMcdmPipeline(nicholasMatrix(), { weighting: enfoque(equalGroupWeights()) }))
      .not.toThrow();
  });

  it("enfase em Geometria produz um ranking DIFERENTE do sem Enfoque", () => {
    const sem = runMcdmPipeline(nicholasMatrix());
    const com = runMcdmPipeline(nicholasMatrix(), { weighting: enfoque(enfaseEm(CRITERION_GROUPS.GEOMETRY)) });

    expect(ordem(com)).not.toEqual(ordem(sem));
    // Trava de regressao dos dois lados, para que "diferente" nao vire
    // "diferente de qualquer jeito".
    expect(ordem(sem)).toEqual(["OP", "C&F", "SQS", "SKS", "R&P", "SLS", "BC", "LW", "SLC", "TS"]);
    expect(ordem(com)).toEqual(["C&F", "SQS", "OP", "R&P", "SKS", "SLS", "BC", "SLC", "LW", "TS"]);
  });

  it("enfase em Economia produz um ranking DIFERENTE do sem Enfoque e do de Geometria", () => {
    const sem  = runMcdmPipeline(nicholasMatrix());
    const geo  = runMcdmPipeline(nicholasMatrix(), { weighting: enfoque(enfaseEm(CRITERION_GROUPS.GEOMETRY)) });
    const econ = runMcdmPipeline(nicholasMatrix(), { weighting: enfoque(enfaseEm(CRITERION_GROUPS.ECONOMIC)) });

    expect(ordem(econ)).not.toEqual(ordem(sem));
    expect(ordem(econ)).not.toEqual(ordem(geo));
    expect(ordem(econ)).toEqual(["SLS", "SKS", "BC", "R&P", "SLC", "OP", "LW", "C&F", "TS", "SQS"]);
  });

  it("os quatro grupos, mais o uniforme e o modo 'none', dao seis ordens distintas", () => {
    // Guarda contra teste vacuo em escala: se a ponderacao por grupo nao
    // mexesse de fato nas contas, alguma dessas ordens colidiria.
    const rotulos = ["none", "uniforme", "geometry", "geomechanics", "technical", "economic"];
    const ordens = [
      ordem(runMcdmPipeline(nicholasMatrix())),
      ordem(runMcdmPipeline(nicholasMatrix(), { weighting: enfoque(equalGroupWeights()) })),
      ...Object.values(CRITERION_GROUPS).map((id) =>
        ordem(runMcdmPipeline(nicholasMatrix(), { weighting: enfoque(enfaseEm(id)) })),
      ),
    ];
    const unicas = new Set(ordens.map((o) => o.join(">")));
    expect(unicas.size).toBe(rotulos.length);
  });

  it("a ponderacao muda a proximidade, nao so a ordem de desempate", () => {
    const sem = runMcdmPipeline(nicholasMatrix());
    const com = runMcdmPipeline(nicholasMatrix(), { weighting: enfoque(enfaseEm(CRITERION_GROUPS.TECHNICAL)) });
    expect(com.topsis.closeness).not.toEqual(sem.topsis.closeness);
  });

  it("modo Entropy continua barrado dentro do pipeline", () => {
    // A exclusividade vive em resolveWeights; aqui so se confirma que o
    // pipeline nao contorna a decisao dela.
    const estado = { ...createWeightingState(), mode: WEIGHTING_MODES.ENTROPY };
    expect(() => runMcdmPipeline(nicholasMatrix(), { weighting: estado }))
      .toThrow(/Entropy ainda não implementada/);
  });

  it("groupWeights invalidos sao barrados na entrada do pipeline", () => {
    const somaErrada = Object.fromEntries(Object.values(CRITERION_GROUPS).map((id) => [id, 0.1]));
    expect(() => enfoque(somaErrada)).toThrow(/precisam somar 1, mas somam 0\.4/);
  });

  it("baseWeights vale no modo 'none' e e recusado no modo 'enfoque'", () => {
    // No modelo de peso por grupo os pesos sao absolutos — nao ha sobre o que
    // um peso-base multiplicar. Recusar e melhor que ignorar em silencio.
    const matrix = nicholasMatrix();
    const ids    = runMcdmPipeline(matrix).criterionIds;
    const base   = ids.map((_, j) => (j === 0 ? 3 : 1));

    const semEnfoque = runMcdmPipeline(matrix, { baseWeights: base });
    expect(semEnfoque.weights).toEqual(base);

    expect(() => runMcdmPipeline(matrix, {
      weighting: enfoque(equalGroupWeights()),
      baseWeights: base,
    })).toThrow(/baseWeights não se aplica ao modo 'enfoque'/);
  });
});

// ---------------------------------------------------------------------------
// CELULA VAZIA
// ---------------------------------------------------------------------------

describe("celula vazia", () => {
  it("lanca nomeando metodo e criterio, em vez de virar zero", () => {
    // Zero e um score valido — e num criterio de minimizar seria o OTIMO. Um
    // buraco na matriz nao pode virar "o melhor da coluna" em silencio.
    const comBuraco = {
      sheets: [{
        key: "nicholas", name: "Nicholas 1981-1992",
        columns: ["Shape"], criterionKeys: ["shape"],
        rows: METHODS.map((code) => ({ code, method: code, values: [code === "BC" ? null : 2] })),
      }],
      unmappedKeys: [],
    };
    expect(() => runMcdmPipeline(comBuraco)).toThrow(/célula vazia em BC × shape/);
  });
});
