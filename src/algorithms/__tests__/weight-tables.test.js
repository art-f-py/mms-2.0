import { describe, it, expect } from "vitest";
import {
  METHODS,
  UBC_GEOMETRY,
  UBC_OREBODY,
  UBC_HANGINGWALL,
  UBC_FOOTWALL,
} from "../ubcWeights";
import {
  NICHOLAS_GEOMETRY,
  NICHOLAS_OREBODY,
  NICHOLAS_HANGINGWALL,
  NICHOLAS_FOOTWALL,
} from "../nicholasWeights";
import {
  SHB_GEOMETRY,
  SHB_ECONOMIC,
  SHB_OREBODY,
  SHB_HANGINGWALL,
  SHB_FOOTWALL,
} from "../shbWeights";
import {
  classifyRSS,
  classifyRSSNicholas,
  classifyDepthUBC,
  classifyDepthSHB,
  classifyDipUBC,
  classifyDipSHB,
  calculateUBC,
  calculateNicholas,
  calculateSHB,
} from "../algorithms";

// Todas as tabelas de peso do projeto, em um registro unico.
const ALL_TABLES = {
  UBC_GEOMETRY,
  UBC_OREBODY,
  UBC_HANGINGWALL,
  UBC_FOOTWALL,
  NICHOLAS_GEOMETRY,
  NICHOLAS_OREBODY,
  NICHOLAS_HANGINGWALL,
  NICHOLAS_FOOTWALL,
  SHB_GEOMETRY,
  SHB_ECONOMIC,
  SHB_OREBODY,
  SHB_HANGINGWALL,
  SHB_FOOTWALL,
};

// [nomeTabela, chaveCriterio, chaveOpcao, linha] para cada linha de opcao.
const ALL_ROWS = Object.entries(ALL_TABLES).flatMap(([tableName, table]) =>
  Object.entries(table).flatMap(([criterion, def]) =>
    Object.entries(def.options).map(([option, row]) => [tableName, criterion, option, row])
  )
);

// Conjunto de classes que uma funcao de classificacao consegue produzir,
// derivado de amostras reais (nao de uma lista escrita a mao).
const producedClasses = (fn, samples) => new Set(samples.map((s) => fn(s)));

const optionKeys = (table, criterion) => new Set(Object.keys(table[criterion].options));

describe("Integridade estrutural das tabelas de peso", () => {
  it("existem linhas para percorrer (guarda contra registro vazio)", () => {
    expect(ALL_ROWS.length).toBeGreaterThan(100);
  });

  it("METHODS tem 10 metodos e nenhum duplicado", () => {
    expect(METHODS).toHaveLength(10);
    expect(new Set(METHODS).size).toBe(10);
  });

  describe.each(Object.keys(ALL_TABLES))("%s", (tableName) => {
    const rows = ALL_ROWS.filter(([t]) => t === tableName);

    it("toda linha de opcao tem exatamente 10 elementos", () => {
      const wrong = rows
        .filter(([, , , row]) => !Array.isArray(row) || row.length !== METHODS.length)
        .map(([, c, o, row]) => `${c}.${o} -> ${Array.isArray(row) ? row.length : typeof row}`);
      expect(wrong).toEqual([]);
    });

    it("todos os elementos sao numeros finitos (sem undefined/null/NaN)", () => {
      const bad = [];
      for (const [, criterion, option, row] of rows) {
        row.forEach((v, i) => {
          if (typeof v !== "number" || !Number.isFinite(v)) {
            bad.push(`${criterion}.${option}[${i}] (${METHODS[i]}) = ${String(v)}`);
          }
        });
      }
      expect(bad).toEqual([]);
    });

    it("nenhum criterio tem lista de opcoes vazia", () => {
      for (const [criterion, def] of Object.entries(ALL_TABLES[tableName])) {
        expect(Object.keys(def.options).length, `${tableName}.${criterion}`).toBeGreaterThan(0);
      }
    });

    it("nenhuma chave de opcao com espaco sobrando nas pontas", () => {
      const untrimmed = rows.filter(([, , o]) => o !== o.trim()).map(([, c, o]) => `${c}."${o}"`);
      expect(untrimmed).toEqual([]);
    });
  });
});

describe("Alinhamento: classes produzidas pelas funcoes x chaves das tabelas", () => {
  // Amostras cobrindo todas as faixas de cada classificador.
  const depthSamples = [10, 100, 150, 300, 500, 700, 900, 1500];
  const dipSamples   = [0, 10, 19, 20, 35, 50, 55, 58, 70, 89];
  // densidade 2500 / profundidade 1000 -> razoes 1, 6, 12, 20
  const rssSamples   = [24.525, 147.15, 294.3, 490.5];

  const rssClasses = new Set(
    rssSamples.map((ucs) => classifyRSS(ucs, 2500, 1000))
  );
  const rssNicholasClasses = new Set(
    rssSamples.map((ucs) => classifyRSSNicholas(ucs, 2500, 1000))
  );

  it("as amostras cobrem todas as faixas dos classificadores", () => {
    expect(producedClasses(classifyDepthUBC, depthSamples).size).toBe(3);
    expect(producedClasses(classifyDepthSHB, depthSamples).size).toBe(4);
    expect(producedClasses(classifyDipUBC, dipSamples).size).toBe(3);
    expect(producedClasses(classifyDipSHB, dipSamples).size).toBe(5);
    expect(rssClasses.size).toBe(4);
    expect(rssNicholasClasses.size).toBe(3);
  });

  it("classifyDepthUBC <-> UBC_GEOMETRY.depth", () => {
    expect(optionKeys(UBC_GEOMETRY, "depth")).toEqual(producedClasses(classifyDepthUBC, depthSamples));
  });

  it("classifyDepthSHB <-> SHB_GEOMETRY.depth", () => {
    // "Pouco profunda" so existe no SH&B — desalinhamento aqui ja causou bug.
    expect(optionKeys(SHB_GEOMETRY, "depth")).toEqual(producedClasses(classifyDepthSHB, depthSamples));
  });

  it("classifyDipUBC <-> UBC_GEOMETRY.dip", () => {
    expect(optionKeys(UBC_GEOMETRY, "dip")).toEqual(producedClasses(classifyDipUBC, dipSamples));
  });

  it("classifyDipUBC <-> NICHOLAS_GEOMETRY.dip (Nicholas reusa as faixas do UBC)", () => {
    expect(optionKeys(NICHOLAS_GEOMETRY, "dip")).toEqual(producedClasses(classifyDipUBC, dipSamples));
  });

  it("classifyDipSHB <-> SHB_GEOMETRY.dip", () => {
    expect(optionKeys(SHB_GEOMETRY, "dip")).toEqual(producedClasses(classifyDipSHB, dipSamples));
  });

  describe.each([
    ["UBC_OREBODY", UBC_OREBODY],
    ["UBC_HANGINGWALL", UBC_HANGINGWALL],
    ["UBC_FOOTWALL", UBC_FOOTWALL],
    ["SHB_OREBODY", SHB_OREBODY],
    ["SHB_HANGINGWALL", SHB_HANGINGWALL],
    ["SHB_FOOTWALL", SHB_FOOTWALL],
  ])("classifyRSS <-> %s.rss", (_name, table) => {
    it("chaves batem", () => {
      expect(optionKeys(table, "rss")).toEqual(rssClasses);
    });
  });

  describe.each([
    ["NICHOLAS_OREBODY", NICHOLAS_OREBODY],
    ["NICHOLAS_HANGINGWALL", NICHOLAS_HANGINGWALL],
    ["NICHOLAS_FOOTWALL", NICHOLAS_FOOTWALL],
  ])("classifyRSSNicholas <-> %s.rss", (_name, table) => {
    it("chaves batem", () => {
      expect(optionKeys(table, "rss")).toEqual(rssNicholasClasses);
    });
  });
});

// ---------------------------------------------------------------------------
// Alinhamento com as opcoes oferecidas pelo formulario (src/pages/Inputs.jsx).
// Sao os valores canonicos gravados no estado — i18n so troca o rotulo.
// ---------------------------------------------------------------------------
const FORM_OPTIONS = {
  shape:          ["Massivo", "Tabular", "Irregular"],
  thickness:      ["Muito estreito", "Estreito", "Intermediário", "Espesso", "Muito espesso"],
  grade:          ["Uniforme", "Gradacional", "Errático"],
  rmr:            ["Muito pobre", "Pobre", "Razoável", "Boa", "Muito boa"],
  jointSpacing:   ["Muito Perto", "Perto", "Longe", "Muito Longe"],
  jointCondition: ["Fraca", "Média", "Forte"],
  oreValue:       ["Baixo", "Médio", "Alto"],
};

describe("Alinhamento: opcoes do formulario x chaves das tabelas", () => {
  const missing = (table, criterion, options) =>
    options.filter((o) => !(o in table[criterion].options));

  describe.each([
    ["UBC_GEOMETRY", UBC_GEOMETRY],
    ["NICHOLAS_GEOMETRY", NICHOLAS_GEOMETRY],
    ["SHB_GEOMETRY", SHB_GEOMETRY],
  ])("%s", (_name, table) => {
    it("aceita as 3 formas do formulario", () => {
      expect(missing(table, "shape", FORM_OPTIONS.shape)).toEqual([]);
    });
    // O Nicholas e a excecao: a tabela dele tem 4 espessuras (a classe "muito
    // estreito" e uma extensao do UBC 1995), entao o alinhamento direto nao
    // vale. calculateNicholas resolve mapeando "Muito estreito" -> "Estreito";
    // a cobertura desse mapa fica no bloco comportamental mais abaixo.
    const expectedMissing = table === NICHOLAS_GEOMETRY ? ["Muito estreito"] : [];
    it("aceita as espessuras do formulario", () => {
      expect(missing(table, "thickness", FORM_OPTIONS.thickness)).toEqual(expectedMissing);
    });
    it("aceita os 3 teores do formulario", () => {
      expect(missing(table, "grade", FORM_OPTIONS.grade)).toEqual([]);
    });
  });

  describe.each([
    ["UBC_OREBODY", UBC_OREBODY],
    ["UBC_HANGINGWALL", UBC_HANGINGWALL],
    ["UBC_FOOTWALL", UBC_FOOTWALL],
  ])("%s", (_name, table) => {
    it("aceita as 5 classes de RMR do formulario (sem traducao)", () => {
      expect(missing(table, "rmr", FORM_OPTIONS.rmr)).toEqual([]);
    });
  });

  describe.each([
    ["NICHOLAS_OREBODY", NICHOLAS_OREBODY],
    ["NICHOLAS_HANGINGWALL", NICHOLAS_HANGINGWALL],
    ["NICHOLAS_FOOTWALL", NICHOLAS_FOOTWALL],
  ])("%s", (_name, table) => {
    it("aceita os 4 espacamentos de fratura do formulario", () => {
      expect(missing(table, "jointSpacing", FORM_OPTIONS.jointSpacing)).toEqual([]);
    });
    it("aceita as 3 condicoes de fratura do formulario", () => {
      expect(missing(table, "jointCondition", FORM_OPTIONS.jointCondition)).toEqual([]);
    });
  });

  it("SHB_ECONOMIC aceita os 3 valores de minerio do formulario", () => {
    expect(missing(SHB_ECONOMIC, "oreValue", FORM_OPTIONS.oreValue)).toEqual([]);
  });

  // O SH&B renomeia as classes de RMR (Pobre -> Fraca, Razoavel -> Media, ...).
  // Teste comportamental: se o mapa quebrar, o criterio some do breakdown em
  // silencio e o score muda sem aviso.
  describe.each(FORM_OPTIONS.rmr)("RMR \"%s\" chega as tabelas SH&B", (rmrClass) => {
    it("produz linhas de breakdown nos 3 dominios", () => {
      const fd = { rmr: { ore: rmrClass, hangingWall: rmrClass, footwall: rmrClass } };
      const keys = Object.keys(calculateSHB(fd).breakdown);
      expect(keys.filter((k) => k.startsWith("rmr_ob__"))).toHaveLength(1);
      expect(keys.filter((k) => k.startsWith("rmr_hw__"))).toHaveLength(1);
      expect(keys.filter((k) => k.startsWith("rmr_fw__"))).toHaveLength(1);
    });
  });

  describe.each(FORM_OPTIONS.rmr)("RMR \"%s\" chega as tabelas UBC", (rmrClass) => {
    it("produz linhas de breakdown nos 3 dominios", () => {
      const fd = { rmr: { ore: rmrClass, hangingWall: rmrClass, footwall: rmrClass } };
      const keys = Object.keys(calculateUBC(fd).breakdown);
      expect(keys).toContain(`rmr_ob__${rmrClass}`);
      expect(keys).toContain(`rmr_hw__${rmrClass}`);
      expect(keys).toContain(`rmr_fw__${rmrClass}`);
    });
  });

  // O Nicholas so tem 4 espessuras; "Muito estreito" (extensao do UBC 1995) e
  // mapeado para "Estreito". Sem o mapa o criterio sumia do score em silencio,
  // derrubando a geometria de 4 para 3 criterios e mudando o ranking.
  describe.each(FORM_OPTIONS.thickness)("espessura \"%s\" pontua no Nicholas", (thickness) => {
    it("mantem o criterio de espessura no breakdown", () => {
      const fd = { geometry: { thickness } };
      const keys = Object.keys(calculateNicholas(fd).breakdown);
      expect(keys.filter((k) => k.startsWith("thickness__"))).toHaveLength(1);
    });
  });

  it("Nicholas trata \"Muito estreito\" exatamente como \"Estreito\"", () => {
    const muitoEstreito = calculateNicholas({ geometry: { thickness: "Muito estreito" } });
    const estreito      = calculateNicholas({ geometry: { thickness: "Estreito" } });
    expect(muitoEstreito.scores).toEqual(estreito.scores);
  });

  // As outras 4 espessuras seguem distintas entre si — o mapa nao pode ter
  // achatado a tabela inteira em uma classe so.
  it("Nicholas mantem as 4 espessuras da tabela distintas", () => {
    const scoreOf = (thickness) =>
      JSON.stringify(calculateNicholas({ geometry: { thickness } }).scores);
    const distintos = new Set(
      ["Estreito", "Intermediário", "Espesso", "Muito espesso"].map(scoreOf)
    );
    expect(distintos.size).toBe(4);
  });
});
