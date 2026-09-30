import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { calculateNicholas, calculateSHB, calculateUBC } from "../../algorithms/algorithms";
import {
  CaseMappingError,
  jointSpacingFromFracturesPerM,
  jointSpacingFromRqd,
  mapCaseToFormData,
  resolveRmrClass,
  thicknessCategory,
} from "../mapCaseToFormData";
import { JOINT_SPACING_OPTIONS } from "../caseSchema";
import { loadCase } from "../caseLoader";
import { belgraviaLegado } from "./helpers/belgraviaLegado";

const aqui      = dirname(fileURLToPath(import.meta.url));
const CASOS_DIR = resolve(aqui, "../../../docs/validacao-mcdm/casos");
const FIXTURE   = resolve(aqui, "../fixtures/sintetico_completo.json");

const fixture   = loadCase(FIXTURE).case;
const belgravia = loadCase(resolve(CASOS_DIR, "belgravia_ochoa.json")).case;
const highland  = loadCase(resolve(CASOS_DIR, "highland_copperwood.json")).case;

const problemasDe = (caso, options) => {
  try {
    mapCaseToFormData(caso, options);
  } catch (erro) {
    if (erro instanceof CaseMappingError) return erro.problems;
    throw erro;
  }
  throw new Error("esperava CaseMappingError e o mapeamento passou");
};

// ---------------------------------------------------------------------------
// ESPESSURA — Nicholas (1981), Table 1
// ---------------------------------------------------------------------------
describe("thicknessCategory", () => {
  it.each([
    [10,   "Intermediário"],  // extremo compartilhado: 10 pertence a "10-30"
    [29.9, "Intermediário"],
    [30,   "Intermediário"],  // extremo compartilhado vai para a faixa de baixo
    [30.1, "Espesso"],
    [100,  "Espesso"],
    [100.1, "Muito espesso"],
    [250,  "Muito espesso"],
  ])("%s m -> %s", (metros, esperado) => {
    expect(thicknessCategory(metros, { ubcOuShb: true })).toEqual({ value: esperado });
  });

  it("abaixo de 10 m com Nicholas sozinho eh Estreito, sem ambiguidade", () => {
    expect(thicknessCategory(1.55, { ubcOuShb: false })).toEqual({ value: "Estreito" });
    expect(thicknessCategory(9.99, { ubcOuShb: false })).toEqual({ value: "Estreito" });
  });

  it("abaixo de 10 m com UBC/SH&B eh AMBIGUO — nao adivinha Muito estreito", () => {
    const r = thicknessCategory(1.55, { ubcOuShb: true });
    expect(r.value).toBeUndefined();
    expect(r.ambiguous).toContain("Muito estreito");
    expect(r.ambiguous).toContain("Miller");
  });
});

// ---------------------------------------------------------------------------
// ESPACAMENTO DE FRATURAS — Nicholas (1981), Table 2
// ---------------------------------------------------------------------------
describe("jointSpacing a partir de fraturas por metro", () => {
  it.each([
    [40,  "Muito Perto"],
    [16.1, "Muito Perto"],
    [16,  "Perto"],        // ">16" na fonte exclui o 16
    [12,  "Perto"],
    [10,  "Perto"],        // extremo compartilhado -> o mais fraturado
    [9.9, "Longe"],
    [3,   "Longe"],        // "<3" na fonte exclui o 3
    [2.9, "Muito Longe"],
    [0.5, "Muito Longe"],
  ])("%s fraturas/m -> %s", (f, esperado) => {
    expect(jointSpacingFromFracturesPerM(f)).toBe(esperado);
  });
});

describe("jointSpacing a partir de RQD", () => {
  it.each([
    [0,   "Muito Perto"],
    [20,  "Muito Perto"],  // extremos compartilhados -> a classe pior
    [21,  "Perto"],
    [40,  "Perto"],
    [55,  "Longe"],
    [70,  "Longe"],
    [71,  "Muito Longe"],
    [100, "Muito Longe"],
  ])("RQD %s%% -> %s", (rqd, esperado) => {
    expect(jointSpacingFromRqd(rqd)).toBe(esperado);
  });
});

// ---------------------------------------------------------------------------
// A CAIXA
// ---------------------------------------------------------------------------
// O defeito que este bloco existe para impedir: "Muito perto" (p minusculo) nao
// lanca em lugar nenhum — sumCriteria simplesmente nao encontra a linha e o
// criterio some da pontuacao, em producao sem nenhum aviso.
describe("caixa exata do espacamento de fraturas", () => {
  it("o mapeador sempre produz a grafia da tabela, nunca a do arquivo de caso", () => {
    const { formData } = mapCaseToFormData(fixture);
    for (const zona of ["ore", "hangingWall", "footwall"]) {
      expect(JOINT_SPACING_OPTIONS).toContain(formData.jointSpacing[zona]);
    }
  });

  it("caso com a caixa errada NAO repassa a string: o valor sai da contagem de fraturas", () => {
    // O campo jointSpacing nem existe no schema do caso — o caso traz fraturas
    // por metro, e a categoria eh derivada. Uma string com caixa errada no
    // arquivo, sob qualquer nome, nao tem por onde chegar ao formData.
    const comLixo = {
      ...fixture,
      geomechanical: {
        ...fixture.geomechanical,
        ore: { ...fixture.geomechanical.ore, jointSpacing: "muito perto", joint_spacing: "Muito perto" },
      },
    };
    const { formData } = mapCaseToFormData(comLixo);
    expect(formData.jointSpacing.ore).toBe("Longe");            // 6 fraturas/m
    expect(formData.jointSpacing.ore).not.toBe("muito perto");
  });

  it("a categoria produzida pontua de fato — o criterio aparece no breakdown", () => {
    const { formData } = mapCaseToFormData(fixture);
    const chaves = Object.keys(calculateNicholas(formData).breakdown);
    expect(chaves).toContain("jointSpacing_ob__Longe");
    expect(chaves).toContain("jointSpacing_hw__Perto");
    expect(chaves).toContain("jointSpacing_fw__Muito Longe");
  });
});

// ---------------------------------------------------------------------------
// RMR — reuso dos conversores do app
// ---------------------------------------------------------------------------
describe("resolveRmrClass", () => {
  it("usa a classe explicita quando ela vem no caso", () => {
    expect(resolveRmrClass({ rmr_class: "Boa" })).toEqual({ value: "Boa" });
  });

  it("converte RMR numerico pelas faixas de Bieniawski (rmrToClass do app)", () => {
    expect(resolveRmrClass({ rmr: 62 })).toEqual({ value: "Boa" });
    expect(resolveRmrClass({ rmr: 20 })).toEqual({ value: "Muito pobre" });
    expect(resolveRmrClass({ rmr: 81 })).toEqual({ value: "Muito boa" });
  });

  it("converte GSI e Q pelos mesmos conversores que os botoes do formulario usam", () => {
    expect(resolveRmrClass({ gsi: 60 }).value).toBe("Boa");     // (60+11.63)/1.13 = 63.4
    expect(resolveRmrClass({ q: 10 }).value).toBe("Boa");       // 9*ln(10)+44 = 64.7
    expect(resolveRmrClass({ q: 1 }).value).toBe("Razoável");   // 9*ln(1)+44  = 44
  });

  it("recusa valores fora de faixa em vez de converter", () => {
    expect(resolveRmrClass({ rmr: 120 }).problem).toContain("0–100");
    expect(resolveRmrClass({ q: 0 }).problem).toContain("logaritmo");
    expect(resolveRmrClass({}).problem).toContain("rmr_class");
  });
});

// ---------------------------------------------------------------------------
// FIXTURE COMPLETA
// ---------------------------------------------------------------------------
describe("mapeamento da fixture sintetica", () => {
  const { formData, selectedMethods, realMethod } = mapCaseToFormData(fixture);

  it("produz o formato exato do formData — numeros como string", () => {
    expect(formData.geometry).toEqual({ shape: "Tabular", thickness: "Intermediário", grade: "Uniforme" });
    expect(formData.dip).toBe("6");
    expect(formData.depth).toEqual({ ore: "250", hangingWall: "240", footwall: "260" });
    expect(formData.ucs.ore).toBe("95");
    expect(formData.density.ore).toBe("2700");
    expect(formData.oreValue).toBe("Médio");
    expect(selectedMethods).toEqual({ nicholas: true, ubc: true, shb: true });
    expect(realMethod).toBe("R&P");
  });

  it("nao classifica RSS — deixa o trio cru para cada calculo usar a propria escala", () => {
    expect(formData.rss).toEqual({ ore: "", hangingWall: "", footwall: "" });
    // O UBC (escala <5/5-10/10-15/>=15) ve "Moderada" no minerio; o Nicholas
    // (escala <8/8-15/>15) tambem — mas por faixas diferentes, e eh cada um que
    // decide, a partir do mesmo numero.
    expect(Object.keys(calculateUBC(formData).breakdown)).toContain("rss_ob__Moderada");
    expect(Object.keys(calculateNicholas(formData).breakdown)).toContain("rss_ob__Moderada");
  });

  it("o formData resultante roda os tres calculos com todos os criterios", () => {
    // Nicholas: 4 geometria + 3 dominios x 3 criterios = 13
    expect(Object.keys(calculateNicholas(formData).breakdown)).toHaveLength(13);
    // UBC: 5 geometria + 3 dominios x 2 criterios = 11
    expect(Object.keys(calculateUBC(formData).breakdown)).toHaveLength(11);
    // SH&B: 5 geometria + 1 economico + 3 dominios x 2 = 12
    expect(Object.keys(calculateSHB(formData).breakdown)).toHaveLength(12);
  });
});

// ---------------------------------------------------------------------------
// CASOS REAIS PARCIAIS — o erro precisa nomear o que falta
// ---------------------------------------------------------------------------
describe("belgravia_ochoa — mapeamento recusado com a lista do que falta", () => {
  // Lacunas que o arquivo real JÁ NÃO TEM (profundidade, Forma, geomecânica,
  // distribuição de teor) são exercitadas sobre o snapshot anterior à extração —
  // ver helpers/belgraviaLegado.js. A espessura de 1.55 m continua no real.
  const porCaminho = Object.fromEntries(
    problemasDe(belgraviaLegado(belgravia)).map((p) => [p.path, p.reason]),
  );
  const atual = Object.fromEntries(problemasDe(belgravia).map((p) => [p.path, p.reason]));

  it("nomeia a profundidade nula do corpo de minerio", () => {
    expect(porCaminho["geomechanical.ore.depth_m (ou geometry.depth_m)"]).toContain("é null");
    expect(porCaminho["geomechanical.ore.depth_m (ou geometry.depth_m)"]).toContain("obrigatório");
  });

  it("nomeia a Forma ausente", () => {
    expect(porCaminho["geometry.shape"]).toContain("Massivo | Tabular | Irregular");
  });

  it("nomeia a geomecanica no formato antigo (texto de status)", () => {
    expect(porCaminho["geomechanical"]).toContain("formato antigo");
  });

  it("explica que o teor em % nao substitui a distribuicao de teor", () => {
    expect(porCaminho["geometry.grade_distribution"]).toContain("grade_pct");
  });

  it("a espessura de 1.55 m cai na faixa ambigua do Muito estreito", () => {
    expect(atual["geometry.thickness_m"]).toContain("Muito estreito");
  });

  it("o caso atual so eh recusado pelo que de fato falta nele", () => {
    expect(Object.keys(atual).sort()).toEqual([
      "economic.ore_value_class",
      "geomechanical.footwall.joint_condition",
      "geomechanical.ore.joint_condition",
      "geometry.thickness_m",
    ]);
  });

  it("com Nicholas sozinho, a mesma espessura deixa de ser ambigua", () => {
    const soNicholas = problemasDe(belgravia, { methods: { nicholas: true } });
    expect(soNicholas.map((p) => p.path)).not.toContain("geometry.thickness_m");
  });

  it("nunca devolve formData pela metade — lanca em vez de retornar", () => {
    expect(() => mapCaseToFormData(belgravia)).toThrow(CaseMappingError);
  });
});

describe("highland_copperwood — mapeamento recusado com a lista do que falta", () => {
  const porCaminho = Object.fromEntries(problemasDe(highland).map((p) => [p.path, p.reason]));

  it("nomeia o mergulho nulo", () => {
    expect(porCaminho["geometry.dip_deg"]).toContain("é null");
    expect(porCaminho["geometry.dip_deg"]).toContain("mergulho");
  });

  it("nomeia a profundidade nula — a que o relatorio so tem por painel de lavra", () => {
    expect(porCaminho["geomechanical.ore.depth_m (ou geometry.depth_m)"]).toContain("é null");
  });

  it("nomeia a geomecanica ausente por dominio", () => {
    expect(porCaminho["geomechanical"]).toContain("formato antigo");
  });
});

// ---------------------------------------------------------------------------
// CAMINHOS ESPECIAIS
// ---------------------------------------------------------------------------
describe("RSS manual — so existe com o Nicholas sozinho", () => {
  const semTrio = {
    ...fixture,
    geomechanical: Object.fromEntries(
      ["ore", "hangingWall", "footwall"].map((z) => [z, {
        rss_class: "Moderada",
        fractures_per_m: fixture.geomechanical[z].fractures_per_m,
        joint_condition: fixture.geomechanical[z].joint_condition,
      }]),
    ),
    geometry: { ...fixture.geometry, depth_m: undefined },
  };

  it("com Nicholas sozinho, rss_class preenche fd.rss e o caso mapeia", () => {
    const { formData, notes } = mapCaseToFormData(semTrio, { methods: { nicholas: true } });
    expect(formData.rss).toEqual({ ore: "Moderada", hangingWall: "Moderada", footwall: "Moderada" });
    expect(notes.map((n) => n.path)).toContain("geomechanical.ore.rss_class");
  });

  it("com UBC junto, rss_class eh recusado — escala diferente", () => {
    const porCaminho = Object.fromEntries(
      problemasDe(semTrio, { methods: { nicholas: true, ubc: true } }).map((p) => [p.path, p.reason]),
    );
    expect(porCaminho["geomechanical.ore.rss_class"]).toContain("Nicholas sozinho");
  });
});

describe("thickness_category explicita resolve a ambiguidade", () => {
  it("o caso pode declarar a faixa e o mapeador a respeita", () => {
    const declarado = {
      ...belgravia,
      geometry: {
        ...belgravia.geometry,
        shape: "Tabular",
        grade_distribution: "Uniforme",
        thickness_category: "Muito estreito",
      },
    };
    const problemas = problemasDe(declarado);
    expect(problemas.map((p) => p.path)).not.toContain("geometry.thickness_m");
  });

  it('"Muito estreito" nao eh aceito com o Nicholas sozinho — a faixa nao existe nele', () => {
    const declarado = {
      ...fixture,
      geometry: { ...fixture.geometry, thickness_category: "Muito estreito" },
    };
    const porCaminho = Object.fromEntries(
      problemasDe(declarado, { methods: { nicholas: true } }).map((p) => [p.path, p.reason]),
    );
    expect(porCaminho["geometry.thickness_category"]).toContain("Nicholas sozinho");
  });
});

describe("conflito entre fraturas/m e RQD", () => {
  it("prevalece a contagem de fraturas, e a divergencia vira nota", () => {
    const conflitante = {
      ...fixture,
      geomechanical: {
        ...fixture.geomechanical,
        ore: { ...fixture.geomechanical.ore, fractures_per_m: 6, rqd_pct: 15 },
      },
    };
    const { formData, notes } = mapCaseToFormData(conflitante);
    expect(formData.jointSpacing.ore).toBe("Longe");
    expect(notes.find((n) => n.path === "geomechanical.ore.rqd_pct").note).toContain("Muito Perto");
  });
});
