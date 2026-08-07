import { describe, it, expect } from "vitest";
import {
  buildDecisionMatrix,
  applyExportOffset,
  sheetToAoa,
  neutralWeights,
  EXPORT_CRITERION_LABELS,
  EXPORT_ROW_HEADER,
  PRO_DM_SCORE_OFFSET,
} from "../decisionMatrix";
import { calculateUBC, calculateNicholas } from "../algorithms";
import { METHODS } from "../ubcWeights";

// ---------------------------------------------------------------------------
// MATRIZ DE DECISAO — EXPORTACAO BRUTA
// ---------------------------------------------------------------------------
// O contrato desta exportacao e "scores brutos das tabelas": nenhuma das duas
// camadas de ponderacao do usuario pode vazar para a planilha. Os testes abaixo
// provam isso partindo de um estado com pesos deliberadamente extremos.

// Cenario completo: preenche tudo que os tres algoritmos consomem.
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

// Pesos do usuario bem longe do neutro, nas DUAS camadas. Se algum deles
// escapar para a matriz, os numeros mudam e o teste quebra.
const LOADED_WEIGHTS = {
  geo:    { shape: 2, thickness: 0, dip: 1.75, grade: 0.25, depth: 2 },
  econ:   { oreValue: 0.5 },
  ob:     { rss: 2, rmr: 0, jointSpacing: 1.5, jointCondition: 0.4 },
  hw:     { rss: 0.1, rmr: 2, jointSpacing: 0.2, jointCondition: 1.9 },
  fw:     { rss: 1.3, rmr: 1.7, jointSpacing: 2, jointCondition: 0 },
  domain: { geo: 2, ob: 0.5, hw: 1.8, fw: 0.3 },
};

const ALL_METHODS = { ubc: true, nicholas: true, shb: true };

const sheetByKey = (matrix, key) => matrix.sheets.find((s) => s.key === key);

describe("buildDecisionMatrix — neutralidade dos pesos", () => {
  it("ignora os pesos por criterio do usuario (camada dos sliders)", () => {
    const matrix = buildDecisionMatrix(FULL_SCENARIO, { ubc: true });
    const sheet  = sheetByKey(matrix, "ubc");

    // Referencia: o proprio algoritmo chamado com pesos neutros.
    const neutral = calculateUBC(FULL_SCENARIO, neutralWeights());
    const bKeys   = Object.keys(neutral.breakdown);

    sheet.rows.forEach((row, r) => {
      const code = METHODS[r];
      row.values.forEach((value, c) => {
        expect(value).toBe(neutral.breakdown[bKeys[c]][code]);
      });
    });
  });

  it("produz a mesma matriz com ou sem pesos customizados no estado", () => {
    // A exportacao nao recebe criteriaWeights — le so o formulario. Este teste
    // fixa o contrato: nenhum caminho futuro pode fazer os sliders entrarem.
    const semPesos = buildDecisionMatrix(FULL_SCENARIO, ALL_METHODS);
    const comPesos = buildDecisionMatrix(
      { ...FULL_SCENARIO, criteriaWeights: { ubc: LOADED_WEIGHTS, nicholas: LOADED_WEIGHTS, shb: LOADED_WEIGHTS } },
      ALL_METHODS,
    );
    expect(comPesos).toEqual(semPesos);
  });

  it("difere do resultado ponderado — prova que os pesos extremos mudariam algo", () => {
    // Guarda contra teste vacuo: se LOADED_WEIGHTS por acaso nao alterasse
    // nada, os dois testes acima passariam sem provar coisa alguma.
    const bruto      = buildDecisionMatrix(FULL_SCENARIO, { ubc: true });
    const ponderado  = calculateUBC(FULL_SCENARIO, LOADED_WEIGHTS);
    const bKeys      = Object.keys(ponderado.breakdown);
    const brutoFlat  = bruto.sheets[0].rows.flatMap((r) => r.values);
    const pondFlat   = METHODS.flatMap((code) => bKeys.map((k) => ponderado.breakdown[k][code]));
    expect(brutoFlat).not.toEqual(pondFlat);
  });

  it("Nicholas: ignora os multiplicadores de dominio mesmo com preset ativo", () => {
    // Estado real do app com o preset2 aplicado: e o formData inteiro (com
    // criteriaWeights dentro) que chega em buildDecisionMatrix pelo botao.
    const comPresetNoEstado = {
      ...FULL_SCENARIO,
      criteriaWeights: {
        nicholas: {
          geo: { shape: 1, thickness: 1, dip: 1, grade: 1 },
          ob:  { rss: 1, jointSpacing: 1, jointCondition: 1 },
          hw:  { rss: 1, jointSpacing: 1, jointCondition: 1 },
          fw:  { rss: 1, jointSpacing: 1, jointCondition: 1 },
          domain: { geo: 1.0, ob: 0.75, hw: 0.6, fw: 0.38 }, // preset2
        },
      },
    };
    const comPreset = buildDecisionMatrix(comPresetNoEstado, { nicholas: true });
    const neutral   = calculateNicholas(FULL_SCENARIO, neutralWeights());
    const bKeys     = Object.keys(neutral.breakdown);
    const sheet     = sheetByKey(comPreset, "nicholas");

    sheet.rows.forEach((row, r) => {
      row.values.forEach((value, c) => {
        expect(value).toBe(neutral.breakdown[bKeys[c]][METHODS[r]]);
      });
    });

    // E confirma que o preset2 REALMENTE mudaria os numeros se fosse aplicado —
    // sem isto o teste passaria mesmo que o preset fosse inocuo.
    const ponderadoComPreset = calculateNicholas(
      FULL_SCENARIO,
      comPresetNoEstado.criteriaWeights.nicholas,
    );
    const criterioDeOb = bKeys.find((k) => k.startsWith("rss_ob__"));
    expect(ponderadoComPreset.breakdown[criterioDeOb])
      .not.toEqual(neutral.breakdown[criterioDeOb]);
  });

  it("neutralWeights() devolve 1.00 em todas as camadas e um objeto novo a cada chamada", () => {
    const w = neutralWeights();
    for (const grupo of Object.values(w)) {
      for (const peso of Object.values(grupo)) expect(peso).toBe(1);
    }
    expect(neutralWeights()).not.toBe(w);
  });
});

describe("buildDecisionMatrix — colunas", () => {
  it("traz exatamente os criterios preenchidos para aquele metodo", () => {
    // Formulario parcial: so geometria (sem mergulho, sem profundidade) — o
    // resto dos criterios nao deve virar coluna.
    const parcial = { geometry: { shape: "Tabular", thickness: "Espesso", grade: "Errático" } };
    const sheet   = sheetByKey(buildDecisionMatrix(parcial, { ubc: true }), "ubc");

    expect(sheet.criterionKeys).toEqual(["shape", "thickness", "grade"]);
    expect(sheet.columns).toEqual(["Shape", "Thickness", "Grade Distribution"]);
  });

  it("acrescenta colunas conforme o formulario e preenchido", () => {
    const parcial = { geometry: { shape: "Tabular" } };
    const cheio   = { ...parcial, dip: "45", depth: { ore: "300" } };

    expect(sheetByKey(buildDecisionMatrix(parcial, { ubc: true }), "ubc").criterionKeys)
      .toEqual(["shape"]);
    expect(sheetByKey(buildDecisionMatrix(cheio, { ubc: true }), "ubc").criterionKeys)
      .toEqual(["shape", "dip", "depth"]);
  });

  it("cada metodo de selecao traz o proprio conjunto de criterios", () => {
    const matrix = buildDecisionMatrix(FULL_SCENARIO, ALL_METHODS);

    // UBC e SH&B usam RMR; o Nicholas usa espacamento/condicao de fraturas.
    expect(sheetByKey(matrix, "ubc").criterionKeys).toContain("rmr_ob");
    expect(sheetByKey(matrix, "ubc").criterionKeys).not.toContain("jointSpacing_ob");
    expect(sheetByKey(matrix, "nicholas").criterionKeys).toContain("jointSpacing_ob");
    expect(sheetByKey(matrix, "nicholas").criterionKeys).not.toContain("rmr_ob");
    // oreValue e exclusivo do SH&B.
    expect(sheetByKey(matrix, "shb").criterionKeys).toContain("oreValue");
    expect(sheetByKey(matrix, "ubc").criterionKeys).not.toContain("oreValue");
    // O Nicholas tambem nao usa profundidade.
    expect(sheetByKey(matrix, "nicholas").criterionKeys).not.toContain("depth");
  });

  it("todo criterio produzido tem rotulo em ingles no dicionario", () => {
    const matrix = buildDecisionMatrix(FULL_SCENARIO, ALL_METHODS);
    expect(matrix.unmappedKeys).toEqual([]);
    matrix.sheets.forEach((sheet) => {
      sheet.criterionKeys.forEach((key) => {
        expect(EXPORT_CRITERION_LABELS[key]).toBeTruthy();
      });
    });
  });
});

describe("buildDecisionMatrix — linhas", () => {
  it("traz sempre os 10 metodos de lavra, na ordem de METHODS", () => {
    const matrix = buildDecisionMatrix(FULL_SCENARIO, ALL_METHODS);
    matrix.sheets.forEach((sheet) => {
      expect(sheet.rows).toHaveLength(10);
      expect(sheet.rows.map((r) => r.code)).toEqual(METHODS);
      expect(sheet.rows.map((r) => r.method)).toEqual([
        "Open Pit", "Block Caving", "Sublevel Stoping", "Sublevel Caving", "Longwall",
        "Room & Pillar", "Shrinkage Stoping", "Cut & Fill", "Top Slicing", "Square Set Stoping",
      ]);
    });
  });

  it("mantem os metodos penalizados, com o score negativo intacto", () => {
    // "Muito estreito" penaliza BC/SLC com -49 na tabela de espessura do UBC.
    // buildDecisionMatrix devolve o BRUTO — o offset e um passo posterior.
    const sheet = sheetByKey(
      buildDecisionMatrix({ geometry: { thickness: "Muito estreito" } }, { ubc: true }),
      "ubc",
    );
    const valorDe = (code) => sheet.rows.find((r) => r.code === code).values[0];

    expect(sheet.rows).toHaveLength(10);
    expect(valorDe("BC")).toBe(-49);
    expect(valorDe("SLC")).toBe(-49);
    expect(valorDe("SLS")).toBe(-10);
    // A matriz e de scores brutos, nao de ranking: nada e filtrado nem reordenado.
    expect(sheet.rows.some((r) => r.values[0] < 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// OFFSET DE EXPORTACAO (+50) — compatibilidade com o Pro D.M.
// ---------------------------------------------------------------------------
describe("applyExportOffset", () => {
  const primeiraColuna = (matrix, key, code) =>
    sheetByKey(matrix, key).rows.find((r) => r.code === code).values[0];

  it("a constante e 50", () => {
    expect(PRO_DM_SCORE_OFFSET).toBe(50);
  });

  it("penalidade -49 do UBC exporta como 1", () => {
    // Espessura "Muito estreito": BC e SLC valem -49 na tabela do UBC.
    const bruta = buildDecisionMatrix({ geometry: { thickness: "Muito estreito" } }, { ubc: true });
    const comOffset = applyExportOffset(bruta, PRO_DM_SCORE_OFFSET);

    expect(primeiraColuna(bruta, "ubc", "BC")).toBe(-49);
    expect(primeiraColuna(comOffset, "ubc", "BC")).toBe(1);
    expect(primeiraColuna(comOffset, "ubc", "SLC")).toBe(1);
  });

  it("penalidade -49 do Nicholas exporta como 1", () => {
    // Forma "Massivo": LW vale -49 na tabela de geometria do Nicholas.
    const bruta = buildDecisionMatrix({ geometry: { shape: "Massivo" } }, { nicholas: true });
    const comOffset = applyExportOffset(bruta, PRO_DM_SCORE_OFFSET);

    expect(primeiraColuna(bruta, "nicholas", "LW")).toBe(-49);
    expect(primeiraColuna(comOffset, "nicholas", "LW")).toBe(1);
  });

  it("penalidade -50 do SH&B exporta como 0", () => {
    // Mergulho 70 -> "Inclinado": LW e R&P valem -50 na tabela do SH&B.
    const bruta = buildDecisionMatrix({ dip: "70" }, { shb: true });
    const comOffset = applyExportOffset(bruta, PRO_DM_SCORE_OFFSET);

    expect(primeiraColuna(bruta, "shb", "LW")).toBe(-50);
    expect(primeiraColuna(comOffset, "shb", "LW")).toBe(0);
    expect(primeiraColuna(comOffset, "shb", "R&P")).toBe(0);
  });

  it("valor comum 4 exporta como 54", () => {
    const bruta = buildDecisionMatrix({ geometry: { thickness: "Muito estreito" } }, { ubc: true });
    const comOffset = applyExportOffset(bruta, PRO_DM_SCORE_OFFSET);

    expect(primeiraColuna(bruta, "ubc", "LW")).toBe(4);
    expect(primeiraColuna(comOffset, "ubc", "LW")).toBe(54);
  });

  it("aplica o offset uniformemente nas tres abas, em toda celula", () => {
    const bruta = buildDecisionMatrix(FULL_SCENARIO, ALL_METHODS);
    const comOffset = applyExportOffset(bruta, PRO_DM_SCORE_OFFSET);

    expect(comOffset.sheets).toHaveLength(3);
    comOffset.sheets.forEach((sheet, s) => {
      const original = bruta.sheets[s];
      expect(sheet.key).toBe(original.key);
      sheet.rows.forEach((row, r) => {
        row.values.forEach((valor, c) => {
          expect(valor).toBe(original.rows[r].values[c] + PRO_DM_SCORE_OFFSET);
        });
      });
    });
  });

  it("nao mexe em rotulos de linha nem em cabecalhos de coluna", () => {
    const bruta = buildDecisionMatrix(FULL_SCENARIO, ALL_METHODS);
    const comOffset = applyExportOffset(bruta, PRO_DM_SCORE_OFFSET);

    comOffset.sheets.forEach((sheet, s) => {
      expect(sheet.name).toBe(bruta.sheets[s].name);
      expect(sheet.columns).toEqual(bruta.sheets[s].columns);
      expect(sheet.criterionKeys).toEqual(bruta.sheets[s].criterionKeys);
      expect(sheet.rows.map((r) => r.method)).toEqual(bruta.sheets[s].rows.map((r) => r.method));
    });
    expect(comOffset.unmappedKeys).toEqual(bruta.unmappedKeys);
  });

  it("e puro — nao altera a matriz recebida", () => {
    const bruta = buildDecisionMatrix(FULL_SCENARIO, ALL_METHODS);
    const antes = JSON.parse(JSON.stringify(bruta));
    applyExportOffset(bruta, PRO_DM_SCORE_OFFSET);
    expect(bruta).toEqual(antes);
  });

  it("usa 50 por padrao e aceita outro deslocamento", () => {
    const bruta = buildDecisionMatrix({ geometry: { thickness: "Muito estreito" } }, { ubc: true });
    expect(primeiraColuna(applyExportOffset(bruta), "ubc", "BC")).toBe(1);
    expect(primeiraColuna(applyExportOffset(bruta, 0), "ubc", "BC")).toBe(-49);
    expect(primeiraColuna(applyExportOffset(bruta, 100), "ubc", "BC")).toBe(51);
  });

  it("nao inventa valor onde a celula esta vazia", () => {
    // Guarda do `?? null` em buildSheet: uma tabela poderia trazer null para um
    // metodo num criterio, e somar 50 ali criaria um score que nao existe.
    const comBuraco = {
      sheets: [{ key: "ubc", name: "UBC 1995", columns: ["Shape"], criterionKeys: ["shape"],
                 rows: [{ code: "OP", method: "Open Pit", values: [4] },
                        { code: "BC", method: "Block Caving", values: [null] }] }],
      unmappedKeys: [],
    };
    const r = applyExportOffset(comBuraco, 50).sheets[0].rows;
    expect(r[0].values[0]).toBe(54);
    expect(r[1].values[0]).toBeNull();
  });
});

describe("matriz exportada — pipeline completo", () => {
  it("as celulas do AOA saem com o offset e os rotulos sem ele", () => {
    // Mesma composicao de downloadDecisionMatrix: montar -> offset -> AOA.
    const matrix = applyExportOffset(
      buildDecisionMatrix({ geometry: { thickness: "Muito estreito" } }, { ubc: true }),
      PRO_DM_SCORE_OFFSET,
    );
    const aoa = sheetToAoa(matrix.sheets[0]);

    expect(aoa[0]).toEqual([EXPORT_ROW_HEADER, "Thickness"]);
    expect(aoa[1]).toEqual(["Open Pit", 51]);          // 1 + 50
    expect(aoa[2]).toEqual(["Block Caving", 1]);       // -49 + 50
    expect(aoa[4]).toEqual(["Sublevel Caving", 1]);    // -49 + 50
    expect(aoa[5]).toEqual(["Longwall", 54]);          // 4 + 50
    // Nenhuma celula negativa sobra na planilha.
    aoa.slice(1).forEach((linha) => expect(linha[1]).toBeGreaterThanOrEqual(0));
  });
});

describe("buildDecisionMatrix — abas", () => {
  it("gera uma aba por metodo ativo, na ordem UBC / Nicholas / SH&B", () => {
    expect(buildDecisionMatrix(FULL_SCENARIO, ALL_METHODS).sheets.map((s) => s.name))
      .toEqual(["UBC 1995", "Nicholas 1981-1992", "SH&B 2007"]);
    expect(buildDecisionMatrix(FULL_SCENARIO, { shb: true, ubc: true }).sheets.map((s) => s.name))
      .toEqual(["UBC 1995", "SH&B 2007"]);
    expect(buildDecisionMatrix(FULL_SCENARIO, { nicholas: true }).sheets.map((s) => s.name))
      .toEqual(["Nicholas 1981-1992"]);
  });

  it("sem metodo selecionado nao gera aba nenhuma", () => {
    expect(buildDecisionMatrix(FULL_SCENARIO, {}).sheets).toEqual([]);
  });

  it("usa nomes de aba validos para o Excel (sem : \\ / ? * [ ] e ate 31 chars)", () => {
    buildDecisionMatrix(FULL_SCENARIO, ALL_METHODS).sheets.forEach((sheet) => {
      expect(sheet.name).not.toMatch(/[:\\/?*[\]]/);
      expect(sheet.name.length).toBeLessThanOrEqual(31);
    });
  });

  it("nao altera o formulario recebido", () => {
    const antes = JSON.parse(JSON.stringify(FULL_SCENARIO));
    buildDecisionMatrix(FULL_SCENARIO, ALL_METHODS);
    expect(FULL_SCENARIO).toEqual(antes);
  });
});

describe("sheetToAoa", () => {
  it("monta cabecalho + 10 linhas com a primeira coluna sendo o metodo", () => {
    const sheet = sheetByKey(buildDecisionMatrix(FULL_SCENARIO, { ubc: true }), "ubc");
    const aoa   = sheetToAoa(sheet);

    expect(aoa).toHaveLength(11);
    expect(aoa[0]).toEqual([EXPORT_ROW_HEADER, ...sheet.columns]);
    expect(aoa[1][0]).toBe("Open Pit");
    expect(aoa[10][0]).toBe("Square Set Stoping");
    // Toda linha tem a mesma largura do cabecalho.
    aoa.forEach((row) => expect(row).toHaveLength(sheet.columns.length + 1));
  });
});
