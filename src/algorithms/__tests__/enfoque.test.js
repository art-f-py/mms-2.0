import { describe, it, expect } from "vitest";
import {
  WEIGHTING_MODES,
  ENFOQUE_GROUPS,
  ENFOQUE_GROUPS_BY_ID,
  DEFAULT_BOOST,
  createWeightingState,
  setWeightingMode,
  applyEnfoque,
  resolveWeights,
} from "../enfoque";
import { CRITERION_GROUPS, FIXED_CRITERIA } from "../mcdmCriteria";

// ---------------------------------------------------------------------------
// ENFOQUE — PONDERACAO MANUAL POR GRUPO
// ---------------------------------------------------------------------------
// Dois contratos estruturais sao testados aqui, e sao os que precisam
// sobreviver a implementacao do Entropy: (1) grupos sao lista extensivel, nao
// toggle binario; (2) os modos de ponderacao sao mutuamente exclusivos por
// construcao, nao por disciplina de quem chama.

const IDS = FIXED_CRITERIA.map((c) => c.id);

describe("ENFOQUE_GROUPS — estrutura extensivel", () => {
  it("e uma lista de grupos, nao um booleano", () => {
    expect(Array.isArray(ENFOQUE_GROUPS)).toBe(true);
  });

  it("a primeira implementacao cobre Tecnico e Economico", () => {
    expect(ENFOQUE_GROUPS.map((g) => g.id)).toEqual([
      CRITERION_GROUPS.TECHNICAL,
      CRITERION_GROUPS.ECONOMIC,
    ]);
  });

  it("todo grupo traz id, label, lista de criterios e fator de boost", () => {
    ENFOQUE_GROUPS.forEach((g) => {
      expect(typeof g.id).toBe("string");
      expect(typeof g.label).toBe("string");
      expect(Array.isArray(g.criterionIds)).toBe(true);
      expect(g.criterionIds.length).toBeGreaterThan(0);
      expect(typeof g.boost).toBe("number");
      expect(g.boost).toBeGreaterThan(0);
    });
  });

  it("os criterios de cada grupo batem com a tabela de criterios fixos", () => {
    // Fonte unica de verdade: a pertinencia ao grupo e declarada em
    // FIXED_CRITERIA e derivada aqui, nao duplicada.
    expect(ENFOQUE_GROUPS_BY_ID[CRITERION_GROUPS.TECHNICAL].criterionIds)
      .toEqual(["performance", "productivity", "recovery", "dilution"]);
    expect(ENFOQUE_GROUPS_BY_ID[CRITERION_GROUPS.ECONOMIC].criterionIds)
      .toEqual(["capitalInvestment", "comparativeCosts"]);
  });

  it("os grupos nao se sobrepoem", () => {
    const todos = ENFOQUE_GROUPS.flatMap((g) => [...g.criterionIds]);
    expect(new Set(todos).size).toBe(todos.length);
  });

  it("acrescentar um grupo novo nao exige mudar a mecanica do boost", () => {
    // Simula o grupo de dominio que entra depois: applyEnfoque nao conhece
    // nenhum id em particular, entao um grupo futuro passaria pelo mesmo
    // caminho. Aqui provamos que a mecanica e generica sobre a lista.
    ENFOQUE_GROUPS.forEach((g) => {
      const pesos = applyEnfoque(IDS, g.id);
      IDS.forEach((id, i) => {
        expect(pesos[i]).toBe(g.criterionIds.includes(id) ? g.boost : 1);
      });
    });
  });
});

describe("applyEnfoque — boost", () => {
  it("multiplica so os criterios do grupo enfocado", () => {
    const pesos = applyEnfoque(IDS, CRITERION_GROUPS.ECONOMIC);
    const porId = Object.fromEntries(IDS.map((id, i) => [id, pesos[i]]));

    expect(porId.capitalInvestment).toBe(DEFAULT_BOOST);
    expect(porId.comparativeCosts).toBe(DEFAULT_BOOST);
    expect(porId.performance).toBe(1);
    expect(porId.productivity).toBe(1);
    expect(porId.recovery).toBe(1);
    expect(porId.dilution).toBe(1);
  });

  it("respeita os pesos-base recebidos em vez de assumir 1", () => {
    const base  = IDS.map((_id, i) => i + 1);
    const pesos = applyEnfoque(IDS, CRITERION_GROUPS.TECHNICAL, base);
    const tecnicos = ENFOQUE_GROUPS_BY_ID[CRITERION_GROUPS.TECHNICAL].criterionIds;

    IDS.forEach((id, i) => {
      expect(pesos[i]).toBe(tecnicos.includes(id) ? base[i] * DEFAULT_BOOST : base[i]);
    });
  });

  it("segue a ordem das colunas recebidas, nao a de FIXED_CRITERIA", () => {
    // A matriz estendida traz os criterios classicos antes dos fixos, entao a
    // ordem das colunas nao e a da tabela. O boost tem que acompanhar.
    const colunas = ["shape", "comparativeCosts", "dip", "performance"];
    expect(applyEnfoque(colunas, CRITERION_GROUPS.ECONOMIC)).toEqual([1, DEFAULT_BOOST, 1, 1]);
  });

  it("nao muta os pesos-base recebidos", () => {
    const base = IDS.map(() => 1);
    const copia = [...base];
    applyEnfoque(IDS, CRITERION_GROUPS.TECHNICAL, base);
    expect(base).toEqual(copia);
  });

  it("recusa grupo desconhecido e contagem de pesos incompativel", () => {
    expect(() => applyEnfoque(IDS, "geometricDomain")).toThrow(/grupo de Enfoque desconhecido/);
    expect(() => applyEnfoque(IDS, CRITERION_GROUPS.TECHNICAL, [1, 2]))
      .toThrow(/2 pesos para 6 critérios/);
  });
});

describe("modo de ponderacao — exclusividade estrutural", () => {
  it("comeca sem ponderacao nenhuma", () => {
    expect(createWeightingState()).toEqual({
      mode: WEIGHTING_MODES.NONE,
      enfoqueGroupId: null,
    });
  });

  it("o modo e UM campo com tres estados, nao dois toggles independentes", () => {
    // Este e o teste que garante a exclusividade: nao existe forma de
    // representar "Enfoque e Entropy ligados ao mesmo tempo" neste estado.
    const state = createWeightingState();
    expect(Object.values(WEIGHTING_MODES)).toEqual(["none", "enfoque", "entropy"]);
    expect(typeof state.mode).toBe("string");
  });

  it("entrar em Enfoque exige um grupo", () => {
    const state = setWeightingMode(createWeightingState(), WEIGHTING_MODES.ENFOQUE, {
      groupId: CRITERION_GROUPS.TECHNICAL,
    });
    expect(state.mode).toBe(WEIGHTING_MODES.ENFOQUE);
    expect(state.enfoqueGroupId).toBe(CRITERION_GROUPS.TECHNICAL);

    expect(() => setWeightingMode(createWeightingState(), WEIGHTING_MODES.ENFOQUE))
      .toThrow(/grupo de Enfoque desconhecido/);
  });

  it("passar para Entropy apaga a configuracao de Enfoque", () => {
    const comEnfoque = setWeightingMode(createWeightingState(), WEIGHTING_MODES.ENFOQUE, {
      groupId: CRITERION_GROUPS.ECONOMIC,
    });
    const comEntropy = setWeightingMode(comEnfoque, WEIGHTING_MODES.ENTROPY);

    expect(comEntropy.mode).toBe(WEIGHTING_MODES.ENTROPY);
    expect(comEntropy.enfoqueGroupId).toBeNull();
  });

  it("voltar para 'none' tambem limpa o grupo", () => {
    const comEnfoque = setWeightingMode(createWeightingState(), WEIGHTING_MODES.ENFOQUE, {
      groupId: CRITERION_GROUPS.TECHNICAL,
    });
    expect(setWeightingMode(comEnfoque, WEIGHTING_MODES.NONE).enfoqueGroupId).toBeNull();
  });

  it("trocar de grupo dentro do Enfoque substitui, nao acumula", () => {
    let state = setWeightingMode(createWeightingState(), WEIGHTING_MODES.ENFOQUE, {
      groupId: CRITERION_GROUPS.TECHNICAL,
    });
    state = setWeightingMode(state, WEIGHTING_MODES.ENFOQUE, {
      groupId: CRITERION_GROUPS.ECONOMIC,
    });
    expect(state.enfoqueGroupId).toBe(CRITERION_GROUPS.ECONOMIC);
  });

  it("nao muta o estado recebido", () => {
    const inicial = createWeightingState();
    setWeightingMode(inicial, WEIGHTING_MODES.ENFOQUE, { groupId: CRITERION_GROUPS.TECHNICAL });
    expect(inicial).toEqual({ mode: WEIGHTING_MODES.NONE, enfoqueGroupId: null });
  });

  it("recusa modo desconhecido", () => {
    expect(() => setWeightingMode(createWeightingState(), "ahp"))
      .toThrow(/modo de ponderação desconhecido/);
  });
});

describe("resolveWeights — ponto unico de decisao", () => {
  it("modo 'none' devolve os pesos-base intactos", () => {
    const base = [1, 2, 3, 4, 5, 6];
    expect(resolveWeights(createWeightingState(), IDS, base)).toEqual(base);
  });

  it("modo 'enfoque' aplica o boost do grupo selecionado", () => {
    const state = setWeightingMode(createWeightingState(), WEIGHTING_MODES.ENFOQUE, {
      groupId: CRITERION_GROUPS.ECONOMIC,
    });
    const pesos = resolveWeights(state, IDS);
    const porId = Object.fromEntries(IDS.map((id, i) => [id, pesos[i]]));

    expect(porId.comparativeCosts).toBe(DEFAULT_BOOST);
    expect(porId.recovery).toBe(1);
  });

  it("modo 'entropy' lanca — motor ainda nao implementado", () => {
    // Devolver os pesos-base em silencio entregaria um resultado SEM Entropy a
    // quem pediu Entropy, sem nada indicando isso.
    const state = setWeightingMode(createWeightingState(), WEIGHTING_MODES.ENTROPY);
    expect(() => resolveWeights(state, IDS)).toThrow(/Entropy ainda não implementada/);
  });

  it("nunca aplica Enfoque e Entropy juntos", () => {
    // Mesmo forcando um estado invalido a mao, so um caminho pode ser tomado.
    const forcado = { mode: WEIGHTING_MODES.ENTROPY, enfoqueGroupId: CRITERION_GROUPS.TECHNICAL };
    expect(() => resolveWeights(forcado, IDS)).toThrow(/Entropy ainda não implementada/);
  });

  it("nao muta os pesos-base", () => {
    const base = IDS.map(() => 1);
    const copia = [...base];
    const state = setWeightingMode(createWeightingState(), WEIGHTING_MODES.ENFOQUE, {
      groupId: CRITERION_GROUPS.TECHNICAL,
    });
    resolveWeights(state, IDS, base);
    expect(base).toEqual(copia);
  });
});
