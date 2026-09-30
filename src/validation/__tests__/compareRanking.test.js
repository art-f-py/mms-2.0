import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { METHODS } from "../../algorithms/ubcWeights";
import { MCDM_SUPPORTED_METHODS } from "../../algorithms/mcdmPipeline";
import { ALL_METHODS, CaseIncompleteError } from "../caseSchema";
import { loadCase } from "../caseLoader";
import { WEIGHTING_MODES } from "../../algorithms/enfoque";
import {
  SELECTION_METHODS,
  WEIGHT_MODES,
  compareCase,
  compareFormData,
  formatComparison,
} from "../compareRanking";
import { mapCaseToFormData } from "../mapCaseToFormData";

const aqui      = dirname(fileURLToPath(import.meta.url));
const CASOS_DIR = resolve(aqui, "../../../docs/validacao-mcdm/casos");
const FIXTURE   = resolve(aqui, "../fixtures/sintetico_completo.json");

const fixture   = loadCase(FIXTURE).case;
const belgravia = loadCase(resolve(CASOS_DIR, "belgravia_ochoa.json")).case;

describe("cobertura do harness", () => {
  it("compara exatamente os metodos que o pipeline MCDM suporta hoje", () => {
    expect([...SELECTION_METHODS].sort()).toEqual([...MCDM_SUPPORTED_METHODS].sort());
  });

  it("compara os dois modos de ponderacao que a tela oferece", () => {
    expect(WEIGHT_MODES).toEqual([WEIGHTING_MODES.ENFOQUE, WEIGHTING_MODES.ENTROPY]);
  });
});

describe("compareCase — fixture sintetica", () => {
  const resultado = compareCase(fixture);

  it("identifica o metodo real pelo codigo canonico do app", () => {
    expect(resultado.realMethod).toBe("R&P");
    expect(resultado.realMethodLabel).toBe("Room & Pillar");
  });

  it("devolve as nove posicoes — tres classicas e tres MCDM por modo", () => {
    for (const m of SELECTION_METHODS) {
      expect(resultado.classic[m].position).toBeGreaterThanOrEqual(1);
      expect(resultado.classic[m].position).toBeLessThanOrEqual(METHODS.length);
      for (const modo of WEIGHT_MODES) {
        expect(resultado.mcdm[m][modo].position).toBeGreaterThanOrEqual(1);
        expect(resultado.mcdm[m][modo].position).toBeLessThanOrEqual(METHODS.length);
      }
    }
    expect(resultado.unavailable).toEqual([]);
  });

  it("os dois modos aparecem para os tres metodos, nenhum faltando", () => {
    for (const m of SELECTION_METHODS) {
      expect(Object.keys(resultado.mcdm[m])).toEqual([...WEIGHT_MODES]);
      expect(Object.keys(resultado.deltas[m])).toEqual([...WEIGHT_MODES]);
    }
    expect(resultado.modes).toEqual([...WEIGHT_MODES]);
  });

  it("Enfoque e Entropy sao rankings distintos — nao ha modo ignorado em silencio", () => {
    // Os pesos vem de origens diferentes (repartição declarada x dispersão dos
    // dados), então os dois coincidirem em TODAS as posições, para os três
    // métodos, seria sinal de que um deles não rodou de fato. Coincidir em
    // alguma posição isolada é normal e não é o que se checa aqui.
    const todasIguais = SELECTION_METHODS.every((m) =>
      resultado.mcdm[m][WEIGHTING_MODES.ENFOQUE].closeness ===
      resultado.mcdm[m][WEIGHTING_MODES.ENTROPY].closeness);
    expect(todasIguais).toBe(false);
  });

  it("o ranking classico tem os 10 metodos de lavra, sem sobra nem falta", () => {
    for (const m of SELECTION_METHODS) expect(resultado.classic[m].of).toBe(METHODS.length);
  });

  it("o classico eh o mesmo para os dois modos — a ponderacao so existe no MCDM", () => {
    const soEnfoque = compareCase(fixture, { modes: [WEIGHTING_MODES.ENFOQUE] });
    const soEntropy = compareCase(fixture, { modes: [WEIGHTING_MODES.ENTROPY] });
    expect(soEnfoque.classic).toEqual(resultado.classic);
    expect(soEntropy.classic).toEqual(resultado.classic);
  });

  it("rodar um modo sozinho da o mesmo numero que rodar os dois", () => {
    const soEntropy = compareCase(fixture, { modes: [WEIGHTING_MODES.ENTROPY] });
    for (const m of SELECTION_METHODS) {
      expect(soEntropy.mcdm[m][WEIGHTING_MODES.ENTROPY])
        .toEqual(resultado.mcdm[m][WEIGHTING_MODES.ENTROPY]);
      expect(soEntropy.mcdm[m][WEIGHTING_MODES.ENFOQUE]).toBeUndefined();
    }
  });

  it("o delta de cada modo eh medido contra o mesmo classico", () => {
    for (const m of SELECTION_METHODS) {
      for (const modo of WEIGHT_MODES) {
        expect(resultado.deltas[m][modo])
          .toBe(resultado.classic[m].position - resultado.mcdm[m][modo].position);
      }
    }
  });

  it("o relatorio em texto traz o classico e um bloco por modo", () => {
    const texto = formatComparison(resultado);
    expect(texto).toContain("Método real: R&P — Room & Pillar");
    expect(texto).toContain("Posição no ranking CLÁSSICO");
    expect(texto).toContain("Posição no ranking MCDM — Enfoque");
    expect(texto).toContain("Posição no ranking MCDM — Entropy");
    for (const rotulo of ["Nicholas", "UBC", "SH&B"]) expect(texto).toContain(rotulo);
  });
});

describe("compareFormData — entrada direta, sem arquivo de caso", () => {
  const { formData } = mapCaseToFormData(fixture);

  it("aceita o formData mapeado e produz o mesmo resultado de compareCase", () => {
    const direto = compareFormData(formData, "R&P");
    const viaCaso = compareCase(fixture);
    expect(direto.classic).toEqual(viaCaso.classic);
    expect(direto.mcdm).toEqual(viaCaso.mcdm);
  });

  it("recusa um metodo de lavra que nao existe em METHODS", () => {
    expect(() => compareFormData(formData, "RP")).toThrow(/não está em METHODS/);
  });

  it("o mesmo formData atravessa os dois caminhos — nenhum ajuste no meio", () => {
    const antes = JSON.stringify(formData);
    compareFormData(formData, "R&P");
    expect(JSON.stringify(formData)).toBe(antes);
  });
});

describe("caso incompleto nao produz numero nenhum", () => {
  it("compareCase lanca CaseIncompleteError antes de calcular qualquer ranking", () => {
    expect(() => compareCase(belgravia)).toThrow(CaseIncompleteError);
  });

  it("o erro nomeia as pendencias, para o relatorio dizer o que buscar no PDF", () => {
    let erro;
    try {
      compareCase(belgravia);
    } catch (e) {
      erro = e;
    }
    expect(erro.missing.map((m) => m.path)).toContain("geometry.thickness_m");
    expect(erro.missing.map((m) => m.path)).toContain("geomechanical.ore.joint_condition");
    expect(erro.message).toContain("belgravia_ochoa");
  });

  it("a espessura ambigua barra ja na validacao, nao no mapeamento", () => {
    expect(() => compareCase(belgravia, { methods: { ubc: true } })).toThrow(CaseIncompleteError);
  });
});

// ---------------------------------------------------------------------------
// SUBCONJUNTO DE MÉTODOS — o que não foi pedido não é calculado
// ---------------------------------------------------------------------------
describe("compareCase com subconjunto de metodos", () => {
  // Fixture com Nicholas e SH&B INCOMPLETOS: sem condição de junta, sem
  // fraturas, sem classe econômica. Só o UBC tem tudo o que precisa.
  const soUbcCompleto = {
    ...fixture,
    geomechanical: Object.fromEntries(
      Object.entries(fixture.geomechanical).map(([zona, z]) => {
        const resto = { ...z };
        delete resto.joint_condition;
        delete resto.fractures_per_m;
        return [zona, resto];
      }),
    ),
    economic: {},
  };

  it("methods={ubc} sobre caso com Nicholas/SH&B incompletos nao lanca", () => {
    expect(() => compareCase(soUbcCompleto, { methods: { ubc: true } })).not.toThrow();
  });

  it("o resultado so tem UBC — nem o classico nem o MCDM dos outros existe", () => {
    const r = compareCase(soUbcCompleto, { methods: { ubc: true } });
    expect(r.selection).toEqual(["ubc"]);
    expect(Object.keys(r.classic)).toEqual(["ubc"]);
    expect(Object.keys(r.mcdm)).toEqual(["ubc"]);
    expect(Object.keys(r.deltas)).toEqual(["ubc"]);
    expect(r.unavailable.every((u) => u.method === "ubc")).toBe(true);
    expect(r.classic.ubc.position).toBeGreaterThanOrEqual(1);
    for (const modo of WEIGHT_MODES) expect(r.mcdm.ubc[modo].position).toBeGreaterThanOrEqual(1);
  });

  it("o relatorio em texto nao lista linha de metodo nao pedido", () => {
    const texto = formatComparison(compareCase(soUbcCompleto, { methods: { ubc: true } }));
    expect(texto).toMatch(/^ {2}UBC /m);
    expect(texto).not.toMatch(/^ {2}Nicholas /m);
    expect(texto).not.toMatch(/^ {2}SH&B /m);
  });

  it("compareFormData tambem respeita methods — e recusa selecao vazia", () => {
    const { formData } = mapCaseToFormData(fixture);
    const r = compareFormData(formData, "R&P", { methods: { nicholas: true, shb: true } });
    expect(r.selection).toEqual(["nicholas", "shb"]);
    expect(Object.keys(r.classic)).toEqual(["nicholas", "shb"]);
    expect(() => compareFormData(formData, "R&P", { methods: {} })).toThrow(/nenhum método/);
  });

  it("methods omitido roda os tres, identico a pedir os tres explicitamente", () => {
    const omitido = compareCase(fixture);
    expect(omitido.selection).toEqual([...SELECTION_METHODS]);
    expect(omitido).toEqual(compareCase(fixture, { methods: ALL_METHODS }));
  });
});
