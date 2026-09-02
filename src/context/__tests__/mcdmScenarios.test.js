import { describe, it, expect } from "vitest";
import { mmsReducer, normalizeScenarios } from "../MmsContext";
import { ENFOQUE_GROUP_IDS, equalGroupWeights } from "../../algorithms/enfoque";
import { CRITERION_GROUPS } from "../../algorithms/mcdmCriteria";

// ---------------------------------------------------------------------------
// CENÁRIOS DO MCDM — LISTA ADITIVA NA RAIZ DO ESTADO
// ---------------------------------------------------------------------------
// Mesma exigência que MmsContext.test.js impõe à sub-árvore de pesos, um nível
// acima: `mcdmScenarios` é irmão de formData e results e não pode encostar em
// nenhum dos dois. O que muda é o que está em risco — aqui o erro não seria um
// peso torto, seria a lista de cenários do usuário sumindo, ou levando o
// formulário junto.
//
// Arquivo separado, e não mais um describe em MmsContext.test.js, porque o
// assunto é outro: aquele arquivo é sobre a sub-árvore de PESOS dentro do
// formData; este é sobre uma lista nova na raiz, com ações próprias e
// persistência própria.
//
// O que NÃO é testado aqui: o ranking de cada cenário. Ele não mora no estado
// de propósito — é recalculado ao vivo contra o formData atual — e quem cobre
// isso é scenarioComparison.test.js.

const { GEOMETRY, GEOMECHANICS, TECHNICAL, ECONOMIC } = CRITERION_GROUPS;

// Sentinelas nas outras raízes: se o reducer as recriar em vez de preservá-las
// por referência, o teste mostra exatamente qual delas foi tocada.
const SENTINELA_FORMDATA = {
  geometry: { shape: "Tabular" },
  criteriaWeights: {
    ubc:      { geo: { shape: 1 } },
    nicholas: { geo: { shape: 1 } },
    shb:      { econ: { oreValue: 1 } },
    mcdm:     { groupWeights: equalGroupWeights() },
  },
};
const SENTINELA_RESULTS = { ubc: { scores: {} }, nicholas: null, shb: null };

const comCenarios = (mcdmScenarios) => ({
  formData:      SENTINELA_FORMDATA,
  results:       SENTINELA_RESULTS,
  mcdmScenarios,
});

const PESOS_ECONOMIA = { [GEOMETRY]: 0, [GEOMECHANICS]: 0, [TECHNICAL]: 0, [ECONOMIC]: 1 };

const adicionar = (state, name, groupWeights = equalGroupWeights()) =>
  mmsReducer(state, { type: "ADD_MCDM_SCENARIO", name, groupWeights });

describe("ADD_MCDM_SCENARIO", () => {
  it("acrescenta o cenário no fim da lista", () => {
    const depois = adicionar(comCenarios([]), "Uniforme");
    expect(depois.mcdmScenarios).toHaveLength(1);
    expect(depois.mcdmScenarios[0].name).toBe("Uniforme");
  });

  it("preserva a ordem de inserção — é a ordem das colunas na comparação", () => {
    let s = comCenarios([]);
    for (const nome of ["A", "B", "C"]) s = adicionar(s, nome);
    expect(s.mcdmScenarios.map((c) => c.name)).toEqual(["A", "B", "C"]);
  });

  it("gera um id para cada cenário, e ids distintos entre eles", () => {
    let s = comCenarios([]);
    for (const nome of ["A", "B", "C"]) s = adicionar(s, nome);
    const ids = s.mcdmScenarios.map((c) => c.id);
    expect(ids.every((id) => typeof id === "string" && id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(3);
  });

  it("guarda os quatro pesos nomeados, e só eles", () => {
    const depois = adicionar(comCenarios([]), "Economia", PESOS_ECONOMIA);
    expect(depois.mcdmScenarios[0].groupWeights).toEqual(PESOS_ECONOMIA);
    expect(Object.keys(depois.mcdmScenarios[0].groupWeights).sort())
      .toEqual([...ENFOQUE_GROUP_IDS].sort());
  });

  it("descarta chave desconhecida vinda junto dos pesos", () => {
    const depois = adicionar(comCenarios([]), "Sujo", { ...equalGroupWeights(), lixo: 99 });
    expect(depois.mcdmScenarios[0].groupWeights).not.toHaveProperty("lixo");
  });

  it("não guarda ranking nem formData — só a configuração de ponderação", () => {
    // O cenário é uma configuração de ponderação com nome: método, modo e (em
    // Enfoque) os pesos. Guardar ranking congelado faria a comparação responder
    // a pergunta de ontem com a cara da de hoje.
    const depois = adicionar(comCenarios([]), "X");
    expect(Object.keys(depois.mcdmScenarios[0]).sort())
      .toEqual(["groupWeights", "id", "method", "mode", "name"]);
  });

  it("não compartilha referência com os pesos do formulário", () => {
    // Um cenário que apontasse para o mesmo objeto mudaria sozinho no próximo
    // arrasto de slider, e a coluna salva deixaria de ser a que foi salva.
    const pesosDoForm = SENTINELA_FORMDATA.criteriaWeights.mcdm.groupWeights;
    const depois = adicionar(comCenarios([]), "X", pesosDoForm);
    expect(depois.mcdmScenarios[0].groupWeights).not.toBe(pesosDoForm);
    expect(depois.mcdmScenarios[0].groupWeights).toEqual(pesosDoForm);
  });

  it("não toca no formData nem nos resultados", () => {
    const depois = adicionar(comCenarios([]), "X");
    expect(depois.formData).toBe(SENTINELA_FORMDATA);
    expect(depois.results).toBe(SENTINELA_RESULTS);
  });

  it("não muta o estado recebido", () => {
    const antes = comCenarios([]);
    adicionar(antes, "X");
    expect(antes.mcdmScenarios).toHaveLength(0);
  });

  it("aceita nomes repetidos — quem distingue as colunas é o id", () => {
    let s = comCenarios([]);
    s = adicionar(s, "Igual");
    s = adicionar(s, "Igual");
    expect(s.mcdmScenarios).toHaveLength(2);
    expect(s.mcdmScenarios[0].id).not.toBe(s.mcdmScenarios[1].id);
  });
});

describe("REMOVE_MCDM_SCENARIO", () => {
  const TRES = [
    { id: "a", name: "A", groupWeights: equalGroupWeights() },
    { id: "b", name: "B", groupWeights: PESOS_ECONOMIA },
    { id: "c", name: "C", groupWeights: equalGroupWeights() },
  ];

  it("remove só o cenário pedido", () => {
    const depois = mmsReducer(comCenarios(TRES), { type: "REMOVE_MCDM_SCENARIO", id: "b" });
    expect(depois.mcdmScenarios.map((c) => c.id)).toEqual(["a", "c"]);
  });

  it("preserva a ordem dos que ficam", () => {
    const depois = mmsReducer(comCenarios(TRES), { type: "REMOVE_MCDM_SCENARIO", id: "a" });
    expect(depois.mcdmScenarios.map((c) => c.name)).toEqual(["B", "C"]);
  });

  it("id inexistente não remove nada e não quebra", () => {
    const depois = mmsReducer(comCenarios(TRES), { type: "REMOVE_MCDM_SCENARIO", id: "nao-existe" });
    expect(depois.mcdmScenarios.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("remover o último deixa a lista vazia, não indefinida", () => {
    const um = [{ id: "a", name: "A", groupWeights: equalGroupWeights() }];
    const depois = mmsReducer(comCenarios(um), { type: "REMOVE_MCDM_SCENARIO", id: "a" });
    expect(depois.mcdmScenarios).toEqual([]);
  });

  it("não toca no formData nem nos resultados", () => {
    const depois = mmsReducer(comCenarios(TRES), { type: "REMOVE_MCDM_SCENARIO", id: "b" });
    expect(depois.formData).toBe(SENTINELA_FORMDATA);
    expect(depois.results).toBe(SENTINELA_RESULTS);
  });

  it("não muta o estado recebido", () => {
    const antes = comCenarios(TRES);
    mmsReducer(antes, { type: "REMOVE_MCDM_SCENARIO", id: "b" });
    expect(antes.mcdmScenarios).toHaveLength(3);
  });
});

describe("cenários e as outras ações", () => {
  it("mexer num slider de peso não mexe na lista de cenários", () => {
    const antes  = comCenarios([{ id: "a", name: "A", groupWeights: equalGroupWeights() }]);
    const depois = mmsReducer(antes, { type: "SET_MCDM_GROUP_WEIGHT", group: GEOMETRY, value: 0.6 });
    expect(depois.mcdmScenarios).toBe(antes.mcdmScenarios);
  });

  it("preencher o formulário não mexe na lista de cenários", () => {
    const antes  = comCenarios([{ id: "a", name: "A", groupWeights: equalGroupWeights() }]);
    const depois = mmsReducer(antes, { type: "SET_FORM_FIELD", section: "geometry", field: "shape", value: "Massivo" });
    expect(depois.mcdmScenarios).toBe(antes.mcdmScenarios);
  });

  it("RESET_ALL limpa os cenários e mantém a chave presente", () => {
    // A chave precisa continuar existindo: `state.mcdmScenarios` indefinido
    // quebraria a aba de comparação no primeiro render depois do reset.
    const depois = mmsReducer(
      comCenarios([{ id: "a", name: "A", groupWeights: equalGroupWeights() }]),
      { type: "RESET_ALL" },
    );
    expect(depois.mcdmScenarios).toEqual([]);
  });

  it("ação desconhecida devolve o estado como está", () => {
    const antes = comCenarios([{ id: "a", name: "A", groupWeights: equalGroupWeights() }]);
    expect(mmsReducer(antes, { type: "NAO_EXISTE" })).toBe(antes);
  });
});

// ---------------------------------------------------------------------------
// PERSISTÊNCIA
// ---------------------------------------------------------------------------
// O que volta do localStorage não é confiável: pode vir de uma versão anterior
// do app (sem a chave), ou de um JSON que alguém editou na mão. Um cenário
// torto não pode deixar a aba de comparação permanentemente quebrada — a tela
// não oferece jeito de apagá-lo se ela nem chega a renderizar.

describe("normalizeScenarios — lista persistida", () => {
  it("devolve lista vazia quando não há nada gravado", () => {
    expect(normalizeScenarios(undefined)).toEqual([]);
    expect(normalizeScenarios(null)).toEqual([]);
  });

  it("devolve lista vazia quando o gravado não é lista", () => {
    for (const lixo of [{}, "cenarios", 42, true]) {
      expect(normalizeScenarios(lixo)).toEqual([]);
    }
  });

  it("preserva cenário bem formado, com os pesos intactos", () => {
    const salvos = [{ id: "a", name: "Economia", method: "ubc", mode: "enfoque", groupWeights: PESOS_ECONOMIA }];
    expect(normalizeScenarios(salvos)).toEqual(salvos);
  });

  it("preserva a ordem gravada", () => {
    const salvos = ["c", "a", "b"].map((id) => ({ id, name: id, groupWeights: equalGroupWeights() }));
    expect(normalizeScenarios(salvos).map((c) => c.id)).toEqual(["c", "a", "b"]);
  });

  it("descarta cenário sem id", () => {
    expect(normalizeScenarios([{ name: "sem id", groupWeights: equalGroupWeights() }])).toEqual([]);
  });

  it("descarta cenário cujos pesos não somam 1, em vez de consertá-los", () => {
    // Peso inventado no lugar do gravado seria uma comparação silenciosamente
    // falsa — pior que um cenário a menos.
    const torto = { [GEOMETRY]: 0.9, [GEOMECHANICS]: 0.9, [TECHNICAL]: 0.9, [ECONOMIC]: 0.9 };
    expect(normalizeScenarios([{ id: "a", name: "A", groupWeights: torto }])).toEqual([]);
  });

  it("descarta cenário sem pesos", () => {
    expect(normalizeScenarios([{ id: "a", name: "A" }])).toEqual([]);
  });

  it("descarta os tortos e mantém os bons na mesma passada", () => {
    const salvos = [
      { id: "bom1",  name: "Bom 1", groupWeights: equalGroupWeights() },
      { id: "torto", name: "Torto", groupWeights: { [GEOMETRY]: 5 } },
      { id: "bom2",  name: "Bom 2", groupWeights: PESOS_ECONOMIA },
    ];
    expect(normalizeScenarios(salvos).map((c) => c.id)).toEqual(["bom1", "bom2"]);
  });

  it("aceita cenário sem nome, trocando-o por vazio", () => {
    // Nome ausente não invalida a comparação — a coluna sai sem título, o que é
    // visível e corrigível pela tela. Peso ausente invalida, e por isso descarta.
    const [c] = normalizeScenarios([{ id: "a", groupWeights: equalGroupWeights() }]);
    expect(c.name).toBe("");
  });

  it("descarta chave desconhecida gravada junto dos pesos", () => {
    const salvos = [{ id: "a", name: "A", groupWeights: { ...equalGroupWeights(), lixo: 1 } }];
    expect(normalizeScenarios(salvos)[0].groupWeights).not.toHaveProperty("lixo");
  });

  it("ignora entrada nula no meio da lista", () => {
    const salvos = [null, { id: "a", name: "A", groupWeights: equalGroupWeights() }, undefined];
    expect(normalizeScenarios(salvos).map((c) => c.id)).toEqual(["a"]);
  });

  it("o que sai da normalização é aceito de volta sem mudar", () => {
    // Idempotência: salvar, recarregar e salvar de novo não pode degradar a
    // lista a cada ciclo.
    const salvos = [
      { id: "a", name: "A", groupWeights: equalGroupWeights() },
      { id: "b", name: "B", groupWeights: PESOS_ECONOMIA },
    ];
    const uma  = normalizeScenarios(salvos);
    const duas = normalizeScenarios(uma);
    expect(duas).toEqual(uma);
  });

  it("sobrevive a uma ida e volta por JSON, como no localStorage", () => {
    const salvos = [{ id: "a", name: "A", method: "shb", mode: "enfoque", groupWeights: PESOS_ECONOMIA }];
    const daStorage = JSON.parse(JSON.stringify({ mcdmScenarios: salvos })).mcdmScenarios;
    expect(normalizeScenarios(daStorage)).toEqual(salvos);
  });
});

// ---------------------------------------------------------------------------
// MÉTODO E MODO DENTRO DO CENÁRIO
// ---------------------------------------------------------------------------
// O cenário deixou de ser method-agnóstico: cada um guarda com que método de
// seleção e em que modo de ponderação foi salvo, e é com eles que a coluna é
// recalculada na comparação. É o que permite ver Nicholas e UBC lado a lado.
//
// Em modo 'entropy' NÃO HÁ PESO A GUARDAR — eles saem da dispersão dos dados —
// e `groupWeights` fica `null`. Guardar os pesos "por via das dúvidas" faria a
// coluna carregar uma repartição que o cálculo dela ignora.
describe("ADD_MCDM_SCENARIO — método e modo", () => {
  const salvar = (state, extra) =>
    mmsReducer(state, { type: "ADD_MCDM_SCENARIO", name: "X", groupWeights: equalGroupWeights(), ...extra });

  it("grava o método e o modo que vieram na ação", () => {
    const depois = salvar(comCenarios([]), { method: "ubc", mode: "enfoque" });
    expect(depois.mcdmScenarios[0].method).toBe("ubc");
    expect(depois.mcdmScenarios[0].mode).toBe("enfoque");
  });

  it("em Entropy não grava peso nenhum", () => {
    const depois = salvar(comCenarios([]), { method: "shb", mode: "entropy" });
    expect(depois.mcdmScenarios[0].mode).toBe("entropy");
    expect(depois.mcdmScenarios[0].groupWeights).toBeNull();
  });

  it("em Enfoque grava os quatro pesos, como sempre gravou", () => {
    const depois = salvar(comCenarios([]), { method: "nicholas", mode: "enfoque", groupWeights: PESOS_ECONOMIA });
    expect(depois.mcdmScenarios[0].groupWeights).toEqual(PESOS_ECONOMIA);
  });

  it("modo desconhecido cai em Enfoque — a porta de escrita não inventa modo", () => {
    // A tela só oferece dois modos; qualquer outra coisa chegando aqui é bug de
    // chamada, e o lado seguro é o modo que guarda os pesos.
    const depois = salvar(comCenarios([]), { method: "ubc", mode: "quantico" });
    expect(depois.mcdmScenarios[0].mode).toBe("enfoque");
  });
});

// ---------------------------------------------------------------------------
// MIGRAÇÃO DOS CENÁRIOS SALVOS ANTES DE method/mode EXISTIREM
// ---------------------------------------------------------------------------
// O modelo antigo era {id, name, groupWeights}. Descartar esses cenários
// apagaria a lista de quem já usava a comparação, então eles são migrados.
//
// `mode: 'enfoque'` é FATO — era a única opção que existia, porque o botão de
// salvar só aparecia nesse modo. `method: 'nicholas'` é PALPITE: o modelo antigo
// era method-agnóstico de propósito e a informação nunca foi gravada. Ver
// SCENARIO_MIGRATION_DEFAULTS em MmsContext.jsx.
describe("normalizeScenarios — migração do modelo antigo", () => {
  const ANTIGO = { id: "velho", name: "Economia", groupWeights: PESOS_ECONOMIA };

  it("cenário sem mode vira Enfoque — a única opção que existia", () => {
    expect(normalizeScenarios([ANTIGO])[0].mode).toBe("enfoque");
  });

  it("cenário sem method vira Nicholas — palpite de migração, não fato", () => {
    expect(normalizeScenarios([{ ...ANTIGO, mode: "enfoque" }])[0].method).toBe("nicholas");
  });

  it("os dois campos ausentes são migrados na mesma passada, e os pesos ficam", () => {
    expect(normalizeScenarios([ANTIGO])[0]).toEqual({
      id: "velho", name: "Economia", method: "nicholas", mode: "enfoque", groupWeights: PESOS_ECONOMIA,
    });
  });

  it("method PRESENTE é respeitado — a migração só preenche ausência", () => {
    expect(normalizeScenarios([{ ...ANTIGO, method: "shb" }])[0].method).toBe("shb");
  });

  it("cenário de Entropy sobrevive à releitura sem pesos", () => {
    // A armadilha concreta: validar os pesos de um cenário que não tem pesos
    // apagaria todos os cenários de Entropy na primeira releitura.
    const salvo = { id: "e", name: "Sem opinião", method: "ubc", mode: "entropy", groupWeights: null };
    expect(normalizeScenarios([salvo])).toEqual([salvo]);
  });

  it("descarta cenário com method que não existe, em vez de trocá-lo pelo default", () => {
    // Ausente é migração; presente e inválido é localStorage adulterado.
    // Substituí-lo por 'nicholas' inventaria uma comparação que ninguém pediu.
    expect(normalizeScenarios([{ ...ANTIGO, method: "topsis-9000" }])).toEqual([]);
  });

  it("descarta cenário com mode que a tela não oferece", () => {
    expect(normalizeScenarios([{ ...ANTIGO, mode: "quantico" }])).toEqual([]);
  });

  it("a migração é idempotente — o migrado volta igual", () => {
    const uma  = normalizeScenarios([ANTIGO]);
    const duas = normalizeScenarios(uma);
    expect(duas).toEqual(uma);
  });
});
