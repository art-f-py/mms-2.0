import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  CASE_SCHEMA_VERSION,
  JOINT_SPACING_OPTIONS,
  ORE_VALUE_OPTIONS,
  SHAPE_OPTIONS,
  assertCaseReady,
  formatValidation,
  normalizeMethodCode,
  validateCase,
} from "../caseSchema";
import { loadCase, loadCaseDir, CaseFileError } from "../caseLoader";
import { mapCaseToFormData } from "../mapCaseToFormData";
import { belgraviaLegado } from "./helpers/belgraviaLegado";

const aqui       = dirname(fileURLToPath(import.meta.url));
const CASOS_DIR  = resolve(aqui, "../../../docs/validacao-mcdm/casos");
const FIXTURE    = resolve(aqui, "../fixtures/sintetico_completo.json");

// ---------------------------------------------------------------------------
// VOCABULÁRIO
// ---------------------------------------------------------------------------
// As listas saem das tabelas de peso por Object.keys. Os testes abaixo fixam o
// CONTEUDO esperado — se uma tabela mudar, e a mudanca for legitima, eh aqui que
// ela aparece primeiro, em vez de num ranking silenciosamente diferente.
describe("vocabulario derivado das tabelas de peso", () => {
  it("shape traz as tres opcoes, identicas nos tres metodos", () => {
    expect(SHAPE_OPTIONS).toEqual(["Massivo", "Tabular", "Irregular"]);
  });

  it("jointSpacing preserva a caixa exata do app — P e L maiusculos", () => {
    expect(JOINT_SPACING_OPTIONS).toEqual(["Muito Perto", "Perto", "Longe", "Muito Longe"]);
    // A caixa errada eh o defeito que este projeto inteiro tenta evitar: ela nao
    // lanca em lugar nenhum, o criterio so some da pontuacao.
    expect(JOINT_SPACING_OPTIONS).not.toContain("Muito perto");
    expect(JOINT_SPACING_OPTIONS).not.toContain("muito perto");
  });

  it("oreValue vem da tabela do SH&B", () => {
    expect(ORE_VALUE_OPTIONS).toEqual(["Baixo", "Médio", "Alto"]);
  });
});

describe("normalizeMethodCode", () => {
  it("aceita o codigo canonico do app", () => {
    expect(normalizeMethodCode("R&P")).toBe("R&P");
    expect(normalizeMethodCode("OP")).toBe("OP");
  });

  it('aceita "RP", a grafia sem & que os dois casos reais usaram', () => {
    expect(normalizeMethodCode("RP")).toBe("R&P");
    expect(normalizeMethodCode("rp")).toBe("R&P");
    expect(normalizeMethodCode("CF")).toBe("C&F");
  });

  it("recusa o que nao esta na tabela, em vez de adivinhar", () => {
    expect(normalizeMethodCode("Room and Pillar")).toBeNull();
    expect(normalizeMethodCode("R & P")).toBeNull();
    expect(normalizeMethodCode(undefined)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// COMPLETUDE
// ---------------------------------------------------------------------------
describe("validateCase — fixture sintetica", () => {
  const { case: fixture, ready, validation } = loadCase(FIXTURE);

  it("a fixture esta pronta para rodar os tres metodos", () => {
    expect(ready).toBe(true);
    expect(validation.missing).toEqual([]);
  });

  it("assertCaseReady devolve o proprio caso quando esta pronto", () => {
    expect(assertCaseReady(fixture)).toBe(fixture);
  });

  it("schema_version fora do esperado vira pendencia", () => {
    const resultado = validateCase({ ...fixture, schema_version: CASE_SCHEMA_VERSION + 1 });
    expect(resultado.ok).toBe(false);
    expect(resultado.missing.map((m) => m.path)).toContain("schema_version");
  });
});

describe("validateCase — casos reais parciais", () => {
  const casos = Object.fromEntries(
    loadCaseDir(CASOS_DIR).map((r) => [r.case?.case_id ?? r.path, r]),
  );

  it("carrega os dois casos reais do diretorio", () => {
    expect(Object.keys(casos).sort()).toEqual(["belgravia_ochoa", "highland_copperwood"]);
  });

  it.each(["belgravia_ochoa", "highland_copperwood"])(
    "%s eh identificado como NAO pronto, sem lancar",
    (id) => {
      expect(casos[id].ready).toBe(false);
      expect(casos[id].validation.missing.length).toBeGreaterThan(0);
    },
  );

  // Comportamento exercitado sobre o snapshot ANTERIOR à extração — o arquivo
  // real já não tem essas lacunas (ver helpers/belgraviaLegado.js).
  const legado = validateCase(belgraviaLegado(casos.belgravia_ochoa.case));

  it("belgravia (snapshot legado) nomeia a profundidade nula, a Forma e a geomecanica no formato antigo", () => {
    const caminhos = legado.missing.map((m) => m.path);
    expect(caminhos).toContain("geometry.depth_m");
    expect(caminhos).toContain("geometry.shape");
    expect(caminhos).toContain("geomechanical");

    const profundidade = legado.missing.find((m) => m.path === "geometry.depth_m");
    expect(profundidade.reason).toContain("null");
    expect(profundidade.neededBy).toContain("UBC");
  });

  it("highland nomeia o mergulho nulo — a lacuna que o proprio relatorio registra", () => {
    const caminhos = casos.highland_copperwood.validation.missing.map((m) => m.path);
    expect(caminhos).toContain("geometry.dip_deg");
    const mergulho = casos.highland_copperwood.validation.missing.find((m) => m.path === "geometry.dip_deg");
    expect(mergulho.reason).toContain("null");
  });

  it("sem distribuicao de teor, a mensagem explica que grade_pct nao serve", () => {
    for (const validacao of [legado, casos.highland_copperwood.validation]) {
      const teor = validacao.missing.find((m) => m.path === "geometry.grade_distribution");
      expect(teor).toBeDefined();
      expect(teor.reason).toContain("grade_pct");
    }
  });

  it("assertCaseReady lanca listando TODAS as pendencias, nao so a primeira", () => {
    let erro;
    try {
      assertCaseReady(belgraviaLegado(casos.belgravia_ochoa.case));
    } catch (e) {
      erro = e;
    }
    expect(erro?.name).toBe("CaseIncompleteError");
    expect(erro.missing.length).toBe(legado.missing.length);
    expect(erro.message).toContain("geometry.depth_m");
    expect(erro.message).toContain("geomechanical");
  });

  it("o resumo em texto marca pendente com ✘ e pronto com ✔", () => {
    expect(formatValidation(casos.belgravia_ochoa.validation)).toMatch(/^✘ belgravia_ochoa/);
    expect(formatValidation(loadCase(FIXTURE).validation)).toMatch(/^✔ sintetico_completo/);
  });
});

// ---------------------------------------------------------------------------
// BELGRAVIA — ESTADO ATUAL DO CASO REAL
// ---------------------------------------------------------------------------
// Primeiro caso real com geomecânica extraída (Tables 16-13 e 16-15, em imagem).
// Estes testes FIXAM o que ainda falta nele; quando o arquivo mudar, é aqui — e
// só aqui — que eles devem ser atualizados.
describe("belgravia_ochoa — pendencias atuais do caso real", () => {
  const { case: belgravia } = loadCase(resolve(CASOS_DIR, "belgravia_ochoa.json"));
  const caminhos = (methods) =>
    validateCase(belgravia, methods && { methods }).missing.map((m) => m.path).sort();

  it("com os tres metodos: espessura ambigua, juntas do minerio e do piso, classe economica", () => {
    expect(caminhos()).toEqual([
      "economic.ore_value_class",
      "geomechanical.footwall.joint_condition",
      "geomechanical.ore.joint_condition",
      "geometry.thickness_m",
    ]);
  });

  it("so UBC: a unica pendencia eh a faixa de espessura, decisao humana", () => {
    expect(caminhos({ ubc: true })).toEqual(["geometry.thickness_m"]);
  });

  it("so Nicholas: a espessura nao eh ambigua, faltam so as juntas", () => {
    expect(caminhos({ nicholas: true })).toEqual([
      "geomechanical.footwall.joint_condition",
      "geomechanical.ore.joint_condition",
    ]);
  });
});

// ---------------------------------------------------------------------------
// VALIDADOR E MAPEADOR — MESMO CONTRATO
// ---------------------------------------------------------------------------
// "Pronto" no validador tem que significar "mapeável" no mapeador. Os dois
// divergiam em dois pontos (profundidade do corpo e espessura < 10 m).
describe("profundidade do corpo — geometry.depth_m OU geomechanical.ore.depth_m", () => {
  const { case: fixture } = loadCase(FIXTURE);
  const semOreDepth = (c) => {
    const ore = { ...c.geomechanical.ore };
    delete ore.depth_m;
    return { ...c, geomechanical: { ...c.geomechanical, ore } };
  };
  const semGeometryDepth = (c) => ({ ...c, geometry: { ...c.geometry, depth_m: undefined } });

  it("geometry.depth_m sozinho basta — o validador aceita e o mapeador tambem", () => {
    const caso = semOreDepth(fixture);
    expect(validateCase(caso).ok).toBe(true);
    expect(() => mapCaseToFormData(caso)).not.toThrow();
  });

  it("ore.depth_m sozinho tambem basta — eh o mesmo campo do formulario", () => {
    const caso = semGeometryDepth(fixture);
    expect(validateCase(caso).ok).toBe(true);
    expect(() => mapCaseToFormData(caso)).not.toThrow();
  });

  it("sem nenhum dos dois, a pendencia aparece UMA vez, como geometry.depth_m", () => {
    const caso = semOreDepth(semGeometryDepth(fixture));
    for (const methods of [undefined, { nicholas: true }, { ubc: true }]) {
      const caminhos = validateCase(caso, methods && { methods }).missing.map((m) => m.path);
      expect(caminhos.filter((p) => p === "geometry.depth_m")).toHaveLength(1);
      expect(caminhos).not.toContain("geomechanical.ore.depth_m");
    }
  });

  it("os dois preenchidos e diferentes: aviso, e vale geometry.depth_m", () => {
    const caso = {
      ...fixture,
      geomechanical: { ...fixture.geomechanical, ore: { ...fixture.geomechanical.ore, depth_m: 999 } },
    };
    const r = validateCase(caso);
    expect(r.ok).toBe(true);
    expect(r.warnings.map((w) => w.path)).toContain("geomechanical.ore.depth_m");
  });
});

describe("espessura abaixo de 10 m — o validador pega a ambiguidade antes do mapeador", () => {
  const { case: fixture } = loadCase(FIXTURE);
  const fino = { ...fixture, geometry: { ...fixture.geometry, thickness_m: 1.55 } };
  const declarado = (cat) => ({ ...fino, geometry: { ...fino.geometry, thickness_category: cat } });

  it("com UBC ou SH&B, 1.55 m eh pendencia de validacao, nao um 'pronto' falso", () => {
    for (const methods of [undefined, { ubc: true }, { shb: true }]) {
      const r = validateCase(fino, methods && { methods });
      expect(r.ok).toBe(false);
      const espessura = r.missing.find((m) => m.path === "geometry.thickness_m");
      expect(espessura.reason).toContain("Muito estreito");
      expect(espessura.reason).toContain("thickness_category");
    }
  });

  it("com Nicholas sozinho nao ha ambiguidade", () => {
    expect(validateCase(fino, { methods: { nicholas: true } }).ok).toBe(true);
  });

  it("thickness_category declarada resolve — e so aceita faixa oferecida para a selecao", () => {
    expect(validateCase(declarado("Muito estreito")).ok).toBe(true);
    expect(validateCase(declarado("Estreito")).ok).toBe(true);
    const r = validateCase(declarado("Muito estreito"), { methods: { nicholas: true } });
    expect(r.missing.map((m) => m.path)).toEqual(["geometry.thickness_category"]);
  });

  it("validador e mapeador concordam em todas as variantes", () => {
    const variantes = [
      [fino, undefined], [fino, { ubc: true }], [fino, { shb: true }],
      [declarado("Estreito"), undefined], [declarado("Muito estreito"), { nicholas: true }],
      [fixture, undefined],
    ];
    for (const [caso, methods] of variantes) {
      const opcoes = methods && { methods };
      let mapeou = true;
      try { mapCaseToFormData(caso, opcoes); } catch { mapeou = false; }
      expect(validateCase(caso, opcoes).ok).toBe(mapeou);
    }
  });

  // DIVERGÊNCIA CONHECIDA, FORA DO ESCOPO DESTA CORREÇÃO. Com o Nicholas
  // sozinho o formulário só oferece o RSS manual (formRules: showManualRss), e
  // a rede de segurança do mapeador exige fd.rss — mas o validador aceita o
  // trio UCS/densidade/profundidade. Resolver pede decidir quem converte o trio
  // em classe de RSS do Nicholas; até lá, este teste FALHA de propósito
  // (it.fails) e passa a acusar no dia em que a divergência for fechada.
  it.fails("Nicholas sozinho com o trio do RSS: validador e mapeador concordam", () => {
    let mapeou = true;
    try { mapCaseToFormData(fino, { methods: { nicholas: true } }); } catch { mapeou = false; }
    expect(validateCase(fino, { methods: { nicholas: true } }).ok).toBe(mapeou);
  });
});

describe("validateCase — completude depende dos metodos pedidos", () => {
  const { case: fixture } = loadCase(FIXTURE);

  it("sem oreValue, o caso roda Nicholas/UBC mas nao SH&B", () => {
    const semValor = { ...fixture, economic: {} };
    expect(validateCase(semValor, { methods: { nicholas: true, ubc: true } }).ok).toBe(true);

    const comShb = validateCase(semValor, { methods: { shb: true } });
    expect(comShb.ok).toBe(false);
    expect(comShb.missing.map((m) => m.path)).toContain("economic.ore_value_class");
    expect(comShb.missing.find((m) => m.path === "economic.ore_value_class").reason)
      .toContain("Francisco");
  });

  it("sem fraturas, o caso roda UBC/SH&B mas nao Nicholas", () => {
    const semFraturas = {
      ...fixture,
      geomechanical: Object.fromEntries(
        Object.entries(fixture.geomechanical).map(([z, v]) => {
          const { fractures_per_m: _f, ...resto } = v;
          return [z, resto];
        }),
      ),
    };
    expect(validateCase(semFraturas, { methods: { ubc: true, shb: true } }).ok).toBe(true);

    const comNicholas = validateCase(semFraturas, { methods: { nicholas: true } });
    expect(comNicholas.ok).toBe(false);
    expect(comNicholas.missing.map((m) => m.path)).toContain("geomechanical.ore.fractures_per_m");
  });
});

describe("requireProvenance — a exigencia metodologica, opcional por padrao", () => {
  const { case: fixture } = loadCase(FIXTURE);
  const semProvenancia = {
    ...fixture,
    geometry: { ...fixture.geometry, thickness_provenance: undefined },
  };

  it("por padrao a falta de provenancia eh AVISO — o pipeline roda sem ela", () => {
    const r = validateCase(semProvenancia);
    expect(r.ok).toBe(true);
    expect(r.warnings.map((w) => w.path)).toContain("geometry.thickness_provenance");
  });

  it("com requireProvenance, a mesma falta vira pendencia", () => {
    const r = validateCase(semProvenancia, { requireProvenance: true });
    expect(r.ok).toBe(false);
    expect(r.missing.map((m) => m.path)).toContain("geometry.thickness_provenance");
  });
});

describe("leitor de arquivo", () => {
  it("arquivo inexistente lanca CaseFileError — defeito de arquivo, nao caso incompleto", () => {
    expect(() => loadCase(resolve(CASOS_DIR, "nao_existe.json"))).toThrow(CaseFileError);
  });
});
