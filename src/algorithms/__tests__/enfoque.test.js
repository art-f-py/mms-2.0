import { describe, it, expect } from "vitest";
import {
  WEIGHTING_MODES,
  ENFOQUE_GROUPS,
  ENFOQUE_GROUPS_BY_ID,
  ENFOQUE_GROUP_IDS,
  GROUP_WEIGHT_TOLERANCE,
  createWeightingState,
  setWeightingMode,
  equalGroupWeights,
  validateGroupWeights,
  groupOfCriterion,
  applyEnfoque,
  resolveWeights,
} from "../enfoque";
import { CRITERION_GROUPS, CRITERION_GROUP_LABELS, FIXED_CRITERIA } from "../mcdmCriteria";
import { CLASSIC_CRITERIA, PENDING_DOMAIN_SUBMODE } from "../classicCriteria";

// ---------------------------------------------------------------------------
// ENFOQUE — PESO POR GRUPO, SOMANDO 1
// ---------------------------------------------------------------------------
// Esta suite foi reescrita junto com o modelo. O anterior era boost
// multiplicativo num unico grupo escolhido (`enfoqueGroupId` + DEFAULT_BOOST);
// o atual e peso simultaneo dos quatro grupos, repartido igualmente dentro de
// cada um. Os testes de boost nao foram adaptados — o mecanismo que eles
// cobriam nao existe mais.
//
// O contrato central, e o que mais importa manter vivo: NENHUM criterio da
// matriz pode ficar sem grupo em silencio.

// Os descritores declarados: 17 classicos (13 do Nicholas + 4 exclusivos do
// UBC) e os 6 fixos. NAO e a matriz de nenhum metodo — e a uniao dos dois.
const IDS_CLASSICOS  = CLASSIC_CRITERIA.map((c) => c.id);
const IDS_FIXOS      = FIXED_CRITERIA.map((c) => c.id);
const IDS_DECLARADOS = [...IDS_CLASSICOS, ...IDS_FIXOS];

// As colunas de cada metodo, na ordem em que o pipeline as produz. Sao dois
// conjuntos DIFERENTES com 11 ids em comum, e essa e a razao de applyEnfoque
// contar os criterios presentes na matriz em vez do total declarado.
const IDS_19 = [
  "shape", "thickness", "dip", "grade",
  "rss_ob", "jointSpacing_ob", "jointCondition_ob",
  "rss_hw", "jointSpacing_hw", "jointCondition_hw",
  "rss_fw", "jointSpacing_fw", "jointCondition_fw",
  ...IDS_FIXOS,
];
const IDS_17_UBC = [
  "shape", "thickness", "dip", "grade", "depth",
  "rss_ob", "rmr_ob", "rss_hw", "rmr_hw", "rss_fw", "rmr_fw",
  ...IDS_FIXOS,
];

// Tamanho de um grupo DENTRO de uma matriz — a conta que applyEnfoque faz.
const presentesNoGrupo = (ids, groupId) =>
  ids.filter((id) => groupOfCriterion(id) === groupId).length;

const enfoqueState = (groupWeights) =>
  setWeightingMode(createWeightingState(), WEIGHTING_MODES.ENFOQUE, { groupWeights });

// Dois vetores de peso bem diferentes, usados em varios testes.
const PESO_GEOMETRIA = {
  [CRITERION_GROUPS.GEOMETRY]:     0.7,
  [CRITERION_GROUPS.GEOMECHANICS]: 0.1,
  [CRITERION_GROUPS.TECHNICAL]:    0.1,
  [CRITERION_GROUPS.ECONOMIC]:     0.1,
};
const PESO_ECONOMIA = {
  [CRITERION_GROUPS.GEOMETRY]:     0.1,
  [CRITERION_GROUPS.GEOMECHANICS]: 0.1,
  [CRITERION_GROUPS.TECHNICAL]:    0.1,
  [CRITERION_GROUPS.ECONOMIC]:     0.7,
};

const somaDe = (pesos) => pesos.reduce((a, b) => a + b, 0);

// ---------------------------------------------------------------------------
// COBERTURA DE GRUPO — o ponto mais importante da suite
// ---------------------------------------------------------------------------

describe("cobertura de grupo — os criterios declarados", () => {
  it("os quatro grupos sao Geometria, Geomecanica, Tecnico-Operacional e Economia", () => {
    expect(ENFOQUE_GROUP_IDS).toEqual([
      CRITERION_GROUPS.GEOMETRY,
      CRITERION_GROUPS.GEOMECHANICS,
      CRITERION_GROUPS.TECHNICAL,
      CRITERION_GROUPS.ECONOMIC,
    ]);
    expect(ENFOQUE_GROUPS.map((g) => g.label)).toEqual([
      "Geometria", "Geomecânica", "Técnico-Operacional", "Economia",
    ]);
  });

  it("cada grupo tem a contagem DECLARADA esperada", () => {
    // O total declarado e a uniao dos TRES metodos, e nao a matriz de nenhum
    // deles: Geometria tem os 4 comuns mais `depth`, Geomecanica tem os 9 do
    // Nicholas mais os 3 `rmr_*`, e Economia ganhou `oreValue` do SH&B ao lado
    // dos 2 fixos do Francisco.
    const tamanho = (id) => ENFOQUE_GROUPS_BY_ID[id].criterionIds.length;
    expect(tamanho(CRITERION_GROUPS.GEOMETRY)).toBe(5);
    expect(tamanho(CRITERION_GROUPS.GEOMECHANICS)).toBe(12);
    expect(tamanho(CRITERION_GROUPS.TECHNICAL)).toBe(4);
    expect(tamanho(CRITERION_GROUPS.ECONOMIC)).toBe(3);
    expect(ENFOQUE_GROUPS.reduce((n, g) => n + g.criterionIds.length, 0)).toBe(24);
    expect(IDS_DECLARADOS).toHaveLength(24);
  });

  it("cada grupo tem a contagem esperada DENTRO de cada matriz", () => {
    // O numero que applyEnfoque de fato usa. Nicholas 4/9/4/2 = 19 colunas;
    // UBC 5/6/4/2 = 17.
    const { GEOMETRY, GEOMECHANICS, TECHNICAL, ECONOMIC } = CRITERION_GROUPS;
    expect(IDS_19).toHaveLength(19);
    expect(presentesNoGrupo(IDS_19, GEOMETRY)).toBe(4);
    expect(presentesNoGrupo(IDS_19, GEOMECHANICS)).toBe(9);
    expect(presentesNoGrupo(IDS_19, TECHNICAL)).toBe(4);
    expect(presentesNoGrupo(IDS_19, ECONOMIC)).toBe(2);

    expect(IDS_17_UBC).toHaveLength(17);
    expect(presentesNoGrupo(IDS_17_UBC, GEOMETRY)).toBe(5);
    expect(presentesNoGrupo(IDS_17_UBC, GEOMECHANICS)).toBe(6);
    expect(presentesNoGrupo(IDS_17_UBC, TECHNICAL)).toBe(4);
    expect(presentesNoGrupo(IDS_17_UBC, ECONOMIC)).toBe(2);
  });

  it("os 11 criterionIds do UBC caem em exatamente um grupo cada, sem orfao", () => {
    const { GEOMETRY, GEOMECHANICS } = CRITERION_GROUPS;
    const classicosDoUbc = IDS_17_UBC.filter((id) => !IDS_FIXOS.includes(id));
    expect(classicosDoUbc).toHaveLength(11);

    classicosDoUbc.forEach((id) => {
      const grupo = groupOfCriterion(id);
      expect(ENFOQUE_GROUP_IDS).toContain(grupo);
      const ocorrencias = ENFOQUE_GROUPS.filter((g) => g.criterionIds.includes(id));
      expect(ocorrencias).toHaveLength(1);          // sem sobreposicao
      expect(ocorrencias[0].id).toBe(grupo);
    });

    expect(classicosDoUbc.filter((id) => groupOfCriterion(id) === GEOMETRY))
      .toEqual(["shape", "thickness", "dip", "grade", "depth"]);
    expect(classicosDoUbc.filter((id) => groupOfCriterion(id) === GEOMECHANICS))
      .toEqual(["rss_ob", "rmr_ob", "rss_hw", "rmr_hw", "rss_fw", "rmr_fw"]);
  });

  it("os 7 ids que UBC e Nicholas compartilham resolvem para o MESMO grupo", () => {
    // Verificado, nao presumido: o UBC so pode reaproveitar as entradas do
    // Nicholas se elas ja apontarem para o grupo que ele precisa.
    const { GEOMETRY, GEOMECHANICS } = CRITERION_GROUPS;
    const compartilhados = IDS_19.filter((id) => IDS_17_UBC.includes(id) && !IDS_FIXOS.includes(id));
    expect(compartilhados).toEqual(["shape", "thickness", "dip", "grade", "rss_ob", "rss_hw", "rss_fw"]);
    expect(compartilhados.map(groupOfCriterion)).toEqual([
      GEOMETRY, GEOMETRY, GEOMETRY, GEOMETRY, GEOMECHANICS, GEOMECHANICS, GEOMECHANICS,
    ]);
  });

  it("todo criterio das 19 colunas cai em exatamente um grupo", () => {
    IDS_19.forEach((id) => {
      const grupo = groupOfCriterion(id);
      expect(ENFOQUE_GROUP_IDS).toContain(grupo);
      // E aparece uma unica vez na uniao das listas dos grupos.
      const ocorrencias = ENFOQUE_GROUPS.filter((g) => g.criterionIds.includes(id));
      expect(ocorrencias).toHaveLength(1);
      expect(ocorrencias[0].id).toBe(grupo);
    });
  });

  it("nao ha orfao nem sobreposicao — a uniao dos grupos e exatamente os declarados", () => {
    const uniao = ENFOQUE_GROUPS.flatMap((g) => [...g.criterionIds]);
    expect(uniao).toHaveLength(24);              // sem sobreposicao
    expect(new Set(uniao).size).toBe(24);        // sem duplicata
    expect([...uniao].sort()).toEqual([...IDS_DECLARADOS].sort()); // sem orfao
  });

  it("a Geometria sao os 4 comuns mais o `depth` do UBC", () => {
    expect(ENFOQUE_GROUPS_BY_ID[CRITERION_GROUPS.GEOMETRY].criterionIds)
      .toEqual(["shape", "thickness", "dip", "grade", "depth"]);
  });

  it("a Geomecanica sao os 9 do Nicholas mais os 3 `rmr_*` do UBC", () => {
    expect(ENFOQUE_GROUPS_BY_ID[CRITERION_GROUPS.GEOMECHANICS].criterionIds).toEqual([
      "rss_ob", "jointSpacing_ob", "jointCondition_ob",
      "rss_hw", "jointSpacing_hw", "jointCondition_hw",
      "rss_fw", "jointSpacing_fw", "jointCondition_fw",
      "rmr_ob", "rmr_hw", "rmr_fw",
    ]);
  });

  it("Tecnico-Operacional e Economia contem os 6 fixos, e Economia mais o oreValue", () => {
    // MUDOU COM O SH&B: ate aqui os dois grupos eram EXATAMENTE os 6 criterios
    // fixos do Francisco, sem nenhum criterio classico. `oreValue` e o primeiro
    // criterio de um METODO DE SELECAO a cair num deles, e entra em Economia ao
    // lado dos dois fixos. Vem ANTES deles na ordem porque ENFOQUE_GROUPS le
    // CLASSIC_CRITERIA primeiro e FIXED_CRITERIA depois (ver o teste de
    // derivacao logo abaixo).
    const tecnicos = ENFOQUE_GROUPS_BY_ID[CRITERION_GROUPS.TECHNICAL].criterionIds;
    const economicos = ENFOQUE_GROUPS_BY_ID[CRITERION_GROUPS.ECONOMIC].criterionIds;
    expect(tecnicos).toEqual(["performance", "productivity", "recovery", "dilution"]);
    expect(economicos).toEqual(["oreValue", "capitalInvestment", "comparativeCosts"]);
    // Os 6 fixos continuam todos ali; o que mudou e que Economia tem um a mais.
    expect([...tecnicos, ...economicos].filter((id) => IDS_FIXOS.includes(id)).sort())
      .toEqual([...IDS_FIXOS].sort());
    expect(CRITERION_GROUP_LABELS[CRITERION_GROUPS.TECHNICAL]).toBe("Técnico-Operacional");
    expect(CRITERION_GROUP_LABELS[CRITERION_GROUPS.ECONOMIC]).toBe("Economia");
  });

  it("criterionIds sao derivados das tabelas de descritores, nao escritos a mao", () => {
    // Se alguem acrescentar um criterio a CLASSIC_CRITERIA ou FIXED_CRITERIA, o
    // grupo correspondente tem de crescer sozinho.
    ENFOQUE_GROUPS.forEach((g) => {
      const esperado = [
        ...CLASSIC_CRITERIA.filter((c) => c.group === g.id).map((c) => c.id),
        ...FIXED_CRITERIA.filter((c) => c.group === g.id).map((c) => c.id),
      ];
      expect(g.criterionIds).toEqual(esperado);
    });
  });

  it("criterio desconhecido nao tem grupo", () => {
    expect(groupOfCriterion("naoExiste")).toBeUndefined();
    // `oreValue` DEIXOU de ser orfao quando o SH&B entrou no pipeline: hoje e
    // declarado em CLASSIC_CRITERIA como Economia.
    expect(groupOfCriterion("oreValue")).toBe(CRITERION_GROUPS.ECONOMIC);
  });
});

// ---------------------------------------------------------------------------
// CRITERIO SEM GRUPO — teste de regressao do ponto critico
// ---------------------------------------------------------------------------

describe("criterio sem grupo — falha alto, nomeando o id", () => {
  it("applyEnfoque lanca nomeando o criterio orfao", () => {
    const comOrfao = [...IDS_19, "criterioFantasma"];
    expect(() => applyEnfoque(comOrfao, equalGroupWeights()))
      .toThrow(/critério "criterioFantasma" não pertence a nenhum grupo/);
  });

  it("resolveWeights em modo enfoque tambem lanca, e nao devolve peso zero", () => {
    // O risco coberto: um orfao com peso 0 sairia da conta sem nenhum sinal, e
    // "criterio some em silencio" ja foi bug real neste projeto.
    let pesos = "nao atribuido";
    expect(() => {
      pesos = resolveWeights(enfoqueState(equalGroupWeights()), ["shape", "orfao"]);
    }).toThrow(/não pertence a nenhum grupo/);
    expect(pesos).toBe("nao atribuido");
  });

  it("a mensagem diz onde declarar o criterio que faltou", () => {
    expect(() => applyEnfoque(["orfao"], equalGroupWeights()))
      .toThrow(/FIXED_CRITERIA .*ou.* CLASSIC_CRITERIA/s);
  });

  it("criterio nao declarado numa matriz de Enfoque e pego como orfao", () => {
    // A guarda que protegeu a entrada de cada metodo novo: esquecer de declarar
    // os criterios vira erro, nao ranking torto. Ja passaram por aqui `rmr_ob`
    // (UBC) e `oreValue` (SH&B), os dois hoje declarados — por isso o caso usa
    // um id que nao existe em metodo nenhum.
    expect(() => applyEnfoque(["shape", "criterioInexistente"], equalGroupWeights()))
      .toThrow(/critério "criterioInexistente" não pertence a nenhum grupo/);
    // E `oreValue`, que era o exemplo antigo, hoje passa sem orfao.
    expect(() => applyEnfoque(["shape", "oreValue"], equalGroupWeights())).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// VALIDACAO DOS PESOS DE GRUPO
// ---------------------------------------------------------------------------

describe("validateGroupWeights", () => {
  it("aceita quatro pesos somando 1", () => {
    expect(() => validateGroupWeights(equalGroupWeights())).not.toThrow();
    expect(() => validateGroupWeights(PESO_GEOMETRIA)).not.toThrow();
    expect(() => validateGroupWeights(PESO_ECONOMIA)).not.toThrow();
  });

  it("aceita peso 0 e peso 1 nos extremos", () => {
    expect(() => validateGroupWeights({
      [CRITERION_GROUPS.GEOMETRY]: 1,
      [CRITERION_GROUPS.GEOMECHANICS]: 0,
      [CRITERION_GROUPS.TECHNICAL]: 0,
      [CRITERION_GROUPS.ECONOMIC]: 0,
    })).not.toThrow();
  });

  it("rejeita chave faltando, nomeando quais faltam", () => {
    const semEconomia = { ...equalGroupWeights() };
    delete semEconomia[CRITERION_GROUPS.ECONOMIC];
    expect(() => validateGroupWeights(semEconomia)).toThrow(/sem os grupos: economic/);
  });

  it("rejeita chave desconhecida, nomeando qual", () => {
    // Sem esta checagem, um slider com id errado nao faria efeito nenhum e nada
    // indicaria o porque.
    expect(() => validateGroupWeights({ ...equalGroupWeights(), geometrico: 0 }))
      .toThrow(/grupo desconhecido: geometrico/);
  });

  it("rejeita valor negativo, nomeando o grupo e o valor", () => {
    expect(() => validateGroupWeights({
      [CRITERION_GROUPS.GEOMETRY]: -0.2,
      [CRITERION_GROUPS.GEOMECHANICS]: 0.4,
      [CRITERION_GROUPS.TECHNICAL]: 0.4,
      [CRITERION_GROUPS.ECONOMIC]: 0.4,
    })).toThrow(/peso do grupo "geometry" fora de \[0, 1\] \(-0\.2\)/);
  });

  it("rejeita valor acima de 1", () => {
    expect(() => validateGroupWeights({
      [CRITERION_GROUPS.GEOMETRY]: 1.5,
      [CRITERION_GROUPS.GEOMECHANICS]: 0,
      [CRITERION_GROUPS.TECHNICAL]: 0,
      [CRITERION_GROUPS.ECONOMIC]: -0.5,
    })).toThrow(/fora de \[0, 1\] \(1\.5\)/);
  });

  it("rejeita valor nao numerico", () => {
    expect(() => validateGroupWeights({ ...equalGroupWeights(), [CRITERION_GROUPS.ECONOMIC]: "0.25" }))
      .toThrow(/não é um número finito/);
    expect(() => validateGroupWeights({ ...equalGroupWeights(), [CRITERION_GROUPS.ECONOMIC]: NaN }))
      .toThrow(/não é um número finito/);
  });

  it("rejeita soma diferente de 1, com o valor real da soma na mensagem", () => {
    expect(() => validateGroupWeights({
      [CRITERION_GROUPS.GEOMETRY]: 0.2,
      [CRITERION_GROUPS.GEOMECHANICS]: 0.2,
      [CRITERION_GROUPS.TECHNICAL]: 0.2,
      [CRITERION_GROUPS.ECONOMIC]: 0.2,
    })).toThrow(/precisam somar 1, mas somam 0\.8/);
  });

  it("nao normaliza em silencio — soma errada e erro, nao ajuste", () => {
    const soma08 = {
      [CRITERION_GROUPS.GEOMETRY]: 0.2, [CRITERION_GROUPS.GEOMECHANICS]: 0.2,
      [CRITERION_GROUPS.TECHNICAL]: 0.2, [CRITERION_GROUPS.ECONOMIC]: 0.2,
    };
    let resultado = "nao atribuido";
    expect(() => { resultado = applyEnfoque(IDS_19, soma08); }).toThrow();
    expect(resultado).toBe("nao atribuido");
  });

  it("tolera erro de ponto flutuante dentro da tolerancia", () => {
    // Nem todo vetor "obvio" soma 1 exato em IEEE 754. Este e um caso real, e
    // nao inventado: e o proprio PESO_GEOMETRIA usado no resto da suite.
    // 0.7 + 0.1 + 0.1 + 0.1 = 0.9999999999999999, desvio de ~1.1e-16.
    const soma = Object.values(PESO_GEOMETRIA).reduce((a, b) => a + b, 0);
    expect(soma).not.toBe(1);
    expect(Math.abs(soma - 1)).toBeLessThan(GROUP_WEIGHT_TOLERANCE);
    expect(() => validateGroupWeights(PESO_GEOMETRIA)).not.toThrow();
  });

  it("rejeita desvio maior que a tolerancia", () => {
    const foraDaTolerancia = {
      [CRITERION_GROUPS.GEOMETRY]: 0.25 + GROUP_WEIGHT_TOLERANCE * 10,
      [CRITERION_GROUPS.GEOMECHANICS]: 0.25,
      [CRITERION_GROUPS.TECHNICAL]: 0.25,
      [CRITERION_GROUPS.ECONOMIC]: 0.25,
    };
    expect(() => validateGroupWeights(foraDaTolerancia)).toThrow(/precisam somar 1/);
  });

  it("rejeita entrada que nem e objeto", () => {
    expect(() => validateGroupWeights(null)).toThrow(/precisa ser um objeto/);
    expect(() => validateGroupWeights([0.25, 0.25, 0.25, 0.25])).toThrow(/precisa ser um objeto/);
  });
});

// ---------------------------------------------------------------------------
// A FORMULA — peso do grupo / tamanho do grupo
// ---------------------------------------------------------------------------

describe("applyEnfoque — peso do grupo dividido igualmente", () => {
  it("cenario uniforme entre grupos: cada peso e 0.25 / tamanho do grupo", () => {
    const pesos = applyEnfoque(IDS_19, equalGroupWeights());
    const porId = Object.fromEntries(IDS_19.map((id, i) => [id, pesos[i]]));

    expect(porId.shape).toBeCloseTo(0.25 / 4, 12);              // Geometria, 4
    expect(porId.rss_ob).toBeCloseTo(0.25 / 9, 12);             // Geomecanica, 9
    expect(porId.recovery).toBeCloseTo(0.25 / 4, 12);           // Tecnico, 4
    expect(porId.comparativeCosts).toBeCloseTo(0.25 / 2, 12);   // Economia, 2
  });

  it("cenario 1 — peso concentrado em Geometria, celula por celula", () => {
    const pesos = applyEnfoque(IDS_19, PESO_GEOMETRIA);
    IDS_19.forEach((id, i) => {
      const grupo = groupOfCriterion(id);
      expect(pesos[i]).toBeCloseTo(PESO_GEOMETRIA[grupo] / presentesNoGrupo(IDS_19, grupo), 12);
    });
    // E o efeito e visivel: um criterio de geometria pesa muito mais que um de
    // geomecanica.
    expect(pesos[IDS_19.indexOf("shape")]).toBeCloseTo(0.7 / 4, 12);
    expect(pesos[IDS_19.indexOf("rss_ob")]).toBeCloseTo(0.1 / 9, 12);
  });

  it("cenario 2 — peso concentrado em Economia, celula por celula", () => {
    const pesos = applyEnfoque(IDS_19, PESO_ECONOMIA);
    IDS_19.forEach((id, i) => {
      const grupo = groupOfCriterion(id);
      expect(pesos[i]).toBeCloseTo(PESO_ECONOMIA[grupo] / presentesNoGrupo(IDS_19, grupo), 12);
    });
    expect(pesos[IDS_19.indexOf("comparativeCosts")]).toBeCloseTo(0.7 / 2, 12);
    expect(pesos[IDS_19.indexOf("shape")]).toBeCloseTo(0.1 / 4, 12);
  });

  it("os dois cenarios produzem vetores de peso diferentes", () => {
    expect(applyEnfoque(IDS_19, PESO_GEOMETRIA)).not.toEqual(applyEnfoque(IDS_19, PESO_ECONOMIA));
  });

  it("INVARIANTE: a soma dos 19 pesos e exatamente 1", () => {
    // O ponto do modelo inteiro. Cada grupo devolve o proprio peso, so que
    // repartido — entao a soma volta a ser a soma dos pesos de grupo, que e 1.
    [equalGroupWeights(), PESO_GEOMETRIA, PESO_ECONOMIA].forEach((gw) => {
      expect(somaDe(applyEnfoque(IDS_19, gw))).toBeCloseTo(1, 12);
    });
  });

  it("grupo com peso zero zera todos os criterios dele, e so eles", () => {
    const semGeomecanica = {
      [CRITERION_GROUPS.GEOMETRY]: 0.5, [CRITERION_GROUPS.GEOMECHANICS]: 0,
      [CRITERION_GROUPS.TECHNICAL]: 0.3, [CRITERION_GROUPS.ECONOMIC]: 0.2,
    };
    const pesos = applyEnfoque(IDS_19, semGeomecanica);
    IDS_19.forEach((id, i) => {
      const zero = groupOfCriterion(id) === CRITERION_GROUPS.GEOMECHANICS;
      if (zero) expect(pesos[i]).toBe(0);
      else expect(pesos[i]).toBeGreaterThan(0);
    });
    expect(somaDe(pesos)).toBeCloseTo(1, 12);
  });

  it("usa os criterios PRESENTES na matriz, nao o total declarado", () => {
    // O comportamento que substituiu o "tamanho declarado". Com so dois dos
    // criterios de Geometria presentes, os dois repartem o peso INTEIRO do
    // grupo — e nao pesoDoGrupo / 5, que deixaria a Geometria valendo menos do
    // que foi declarado nos sliders. A soma continua abaixo de 1 porque os
    // outros tres grupos nao tem nenhum criterio nesta lista.
    const parcial = applyEnfoque(["shape", "thickness"], equalGroupWeights());
    expect(parcial).toEqual([0.25 / 2, 0.25 / 2]);
    expect(somaDe(parcial)).toBeCloseTo(0.25, 12);
  });

  it("a mesma repartição vale 1 nas DUAS matrizes, apesar dos tamanhos diferentes", () => {
    // O ponto do modelo com dois metodos liberados: Geometria tem 4 criterios
    // no Nicholas e 5 no UBC, Geomecanica tem 9 e 6, e mesmo assim cada grupo
    // devolve o proprio peso inteiro nos dois casos.
    [equalGroupWeights(), PESO_GEOMETRIA, PESO_ECONOMIA].forEach((gw) => {
      expect(somaDe(applyEnfoque(IDS_19, gw))).toBeCloseTo(1, 12);
      expect(somaDe(applyEnfoque(IDS_17_UBC, gw))).toBeCloseTo(1, 12);
    });
  });

  it("no UBC, cada criterio de Geomecanica vale pesoDoGrupo / 6", () => {
    const pesos = applyEnfoque(IDS_17_UBC, equalGroupWeights());
    expect(pesos[IDS_17_UBC.indexOf("rmr_ob")]).toBeCloseTo(0.25 / 6, 12);
    expect(pesos[IDS_17_UBC.indexOf("depth")]).toBeCloseTo(0.25 / 5, 12);
    // O MESMO id pesa diferente nas duas matrizes, e e isso que mantem a
    // proporcao entre grupos igual nos dois metodos.
    const doNicholas = applyEnfoque(IDS_19, equalGroupWeights());
    expect(doNicholas[IDS_19.indexOf("rss_ob")]).toBeCloseTo(0.25 / 9, 12);
    expect(pesos[IDS_17_UBC.indexOf("rss_ob")]).toBeCloseTo(0.25 / 6, 12);
  });

  it("e pura — nao altera o objeto de pesos recebido", () => {
    const gw    = equalGroupWeights();
    const copia = { ...gw };
    applyEnfoque(IDS_19, gw);
    expect(gw).toEqual(copia);
  });
});

// ---------------------------------------------------------------------------
// ESTADO E MODOS
// ---------------------------------------------------------------------------

describe("estado de ponderacao", () => {
  it("comeca em 'none', sem pesos de grupo", () => {
    expect(createWeightingState()).toEqual({ mode: WEIGHTING_MODES.NONE, groupWeights: null });
  });

  it("entrar no Enfoque exige groupWeights validos", () => {
    expect(() => setWeightingMode(createWeightingState(), WEIGHTING_MODES.ENFOQUE))
      .toThrow(/precisa ser um objeto/);
    expect(() => setWeightingMode(createWeightingState(), WEIGHTING_MODES.ENFOQUE, {
      groupWeights: { [CRITERION_GROUPS.GEOMETRY]: 1 },
    })).toThrow(/sem os grupos/);
  });

  it("guarda os pesos e nao compartilha referencia com quem chamou", () => {
    const gw    = equalGroupWeights();
    const state = enfoqueState(gw);
    expect(state.mode).toBe(WEIGHTING_MODES.ENFOQUE);
    expect(state.groupWeights).toEqual(gw);
    expect(state.groupWeights).not.toBe(gw);

    // Mutar o objeto original nao pode mexer na ponderacao ja aplicada.
    gw[CRITERION_GROUPS.GEOMETRY] = 0.9;
    expect(state.groupWeights[CRITERION_GROUPS.GEOMETRY]).toBe(0.25);
  });

  it("sair do Enfoque limpa os pesos — os modos sao exclusivos por construcao", () => {
    const comEnfoque = enfoqueState(equalGroupWeights());
    expect(setWeightingMode(comEnfoque, WEIGHTING_MODES.NONE).groupWeights).toBeNull();
    expect(setWeightingMode(comEnfoque, WEIGHTING_MODES.ENTROPY).groupWeights).toBeNull();
  });

  it("modo desconhecido lanca", () => {
    expect(() => setWeightingMode(createWeightingState(), "ahp"))
      .toThrow(/modo de ponderação desconhecido/);
  });

  it("nao muta o estado recebido", () => {
    const inicial = createWeightingState();
    const copia   = { ...inicial };
    enfoqueState(equalGroupWeights());
    setWeightingMode(inicial, WEIGHTING_MODES.ENTROPY);
    expect(inicial).toEqual(copia);
  });
});

describe("resolveWeights — ponto unico de decisao", () => {
  it("modo 'none' devolve pesos uniformes quando nao ha base", () => {
    expect(resolveWeights(createWeightingState(), IDS_19)).toEqual(IDS_19.map(() => 1));
  });

  it("modo 'none' devolve os pesos-base intactos, sem compartilhar referencia", () => {
    const base = IDS_19.map((_, i) => i + 1);
    const r    = resolveWeights(createWeightingState(), IDS_19, base);
    expect(r).toEqual(base);
    expect(r).not.toBe(base);
  });

  it("modo 'enfoque' aplica a formula", () => {
    expect(resolveWeights(enfoqueState(PESO_GEOMETRIA), IDS_19))
      .toEqual(applyEnfoque(IDS_19, PESO_GEOMETRIA));
  });

  it("modo 'enfoque' recusa baseWeights em vez de ignorar em silencio", () => {
    // No modelo de peso por grupo os pesos sao absolutos: nao ha sobre o que um
    // peso-base multiplicar. Aceitar e ignorar devolveria um resultado que
    // desconsidera o que o chamador pediu, sem aviso.
    expect(() => resolveWeights(enfoqueState(equalGroupWeights()), IDS_19, IDS_19.map(() => 2)))
      .toThrow(/baseWeights não se aplica ao modo 'enfoque'/);
  });

  it("modo 'entropy' continua lancando — nao implementado", () => {
    const state = setWeightingMode(createWeightingState(), WEIGHTING_MODES.ENTROPY);
    expect(() => resolveWeights(state, IDS_19)).toThrow(/Entropy ainda não implementada/);
    // Mesmo forcando o estado a mao, sem passar por setWeightingMode.
    const forcado = { mode: WEIGHTING_MODES.ENTROPY, groupWeights: equalGroupWeights() };
    expect(() => resolveWeights(forcado, IDS_19)).toThrow(/Entropy ainda não implementada/);
  });

  it("modo desconhecido no estado lanca", () => {
    expect(() => resolveWeights({ mode: "ahp", groupWeights: null }, IDS_19))
      .toThrow(/modo de ponderação desconhecido/);
  });
});

// ---------------------------------------------------------------------------
// PENDENCIA REGISTRADA — sub-modo de dominio da Geomecanica
// ---------------------------------------------------------------------------

describe("PENDING_DOMAIN_SUBMODE", () => {
  it("marca o sub-modo como nao implementado, no padrao de PENDING_CONFIRMATION", () => {
    expect(PENDING_DOMAIN_SUBMODE.implemented).toBe(false);
    expect(PENDING_DOMAIN_SUBMODE.groupId).toBe(CRITERION_GROUPS.GEOMECHANICS);
    expect(PENDING_DOMAIN_SUBMODE.reason).toMatch(/não implementado/);
  });

  it("os tres dominios cobrem os 9 criterios de Geomecanica DO NICHOLAS", () => {
    // So os do Nicholas: os `rmr_*` do UBC pertencem aos mesmos tres dominios,
    // mas ficam de fora enquanto o sub-modo nao existir — ver o comentario em
    // classicCriteria.js. Todos os listados sao, ainda assim, de Geomecanica.
    const { ob, hw, fw } = PENDING_DOMAIN_SUBMODE.domains;
    const todos = [...ob, ...hw, ...fw];
    expect(todos).toHaveLength(9);
    expect([...todos].sort()).toEqual([
      "rss_ob", "jointSpacing_ob", "jointCondition_ob",
      "rss_hw", "jointSpacing_hw", "jointCondition_hw",
      "rss_fw", "jointSpacing_fw", "jointCondition_fw",
    ].sort());
    const daGeomecanica = ENFOQUE_GROUPS_BY_ID[CRITERION_GROUPS.GEOMECHANICS].criterionIds;
    todos.forEach((id) => expect(daGeomecanica).toContain(id));
  });

  it("nesta fase a Geomecanica divide igualmente — o sub-modo nao esta ativo", () => {
    const pesos = applyEnfoque(IDS_19, equalGroupWeights());
    const daGeomecanica = IDS_19
      .map((id, i) => ({ id, peso: pesos[i] }))
      .filter(({ id }) => groupOfCriterion(id) === CRITERION_GROUPS.GEOMECHANICS);

    expect(daGeomecanica).toHaveLength(9);
    daGeomecanica.forEach(({ peso }) => expect(peso).toBeCloseTo(0.25 / 9, 12));
  });
});
