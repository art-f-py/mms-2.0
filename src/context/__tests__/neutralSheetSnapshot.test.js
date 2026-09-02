import { describe, it, expect } from "vitest";
import { mmsReducer } from "../MmsContext";
import { buildDecisionMatrix } from "../../algorithms/decisionMatrix";
import { calculateUBC, calculateNicholas, calculateSHB } from "../../algorithms/algorithms";
import { eliminatingCriteriaFor } from "../../utils/eliminationMarker";

// ---------------------------------------------------------------------------
// RETRATO NEUTRO — CONGELADO JUNTO COM O RESULTADO
// ---------------------------------------------------------------------------
// A marcação de eliminação dos cartões clássicos precisa dos scores SEM os
// pesos da etapa complementar, senão o marcador −49/−50 não sobrevive à
// multiplicação. Esse dado passou por dois desenhos, e este arquivo trava o
// segundo:
//
//   ANTES  a tela derivava a matriz por useMemo, contra o formData do MOMENTO.
//          Como os scores exibidos vêm CONGELADOS do clique em Calcular, abria
//          uma janela: calcular, editar o formulário, voltar pelo botão do
//          navegador, e o cartão mostrava o score de um depósito com a borda
//          vermelha de outro.
//   AGORA  o retrato é tirado no mesmo instante que o resultado e viaja DENTRO
//          dele. Os dois descrevem o mesmo formulário por construção.
//
// O QUE ESTE ARQUIVO SIMULA, E O QUE ELE NÃO PROVA. `handleCalculate` é uma
// função de componente e o projeto não tem Testing Library (ver o comentário no
// topo de mcdmRanking.js), então `calcular()` abaixo é um ESPELHO do que ele
// faz. O espelho poderia divergir do original sem ninguém notar — quem trava
// isso é eliminationHighlight.test.js, que lê o fonte de Inputs.jsx e confere
// que ele monta o payload exatamente assim. Os dois arquivos se completam.

const FORM_BASE = {
  selectedMethods: { ubc: true, nicholas: true, shb: true },
  geometry: { shape: "Massivo", thickness: "Muito espesso", grade: "Uniforme" },
  dip:      "70",
  depth:    { ore: "700", hangingWall: "700", footwall: "700" },
  density:  { ore: "2500", hangingWall: "2600", footwall: "2700" },
  ucs:      { ore: "120",  hangingWall: "100",  footwall: "110" },
  rmr:      { ore: "Boa",  hangingWall: "Razoável", footwall: "Razoável" },
  jointSpacing:   { ore: "Perto", hangingWall: "Longe", footwall: "Perto" },
  jointCondition: { ore: "Média", hangingWall: "Forte", footwall: "Fraca" },
  oreValue: "Médio",
};

const METODOS = ["ubc", "nicholas", "shb"];
const CALC = { ubc: calculateUBC, nicholas: calculateNicholas, shb: calculateSHB };

const retratoDe = (formData, method) =>
  buildDecisionMatrix(formData, { [method]: true }).sheets.find((s) => s.key === method) ?? null;

/** Espelho de handleCalculate: calcula os três e despacha SET_RESULT. */
const calcular = (state) => {
  const fd = state.formData;
  return METODOS.reduce((acc, method) => {
    const ativo   = Boolean(fd.selectedMethods?.[method]);
    const payload = ativo ? CALC[method](fd, fd.criteriaWeights?.[method]) : null;
    return mmsReducer(acc, {
      type: "SET_RESULT",
      method,
      payload: payload === null ? null : { ...payload, neutralSheet: retratoDe(fd, method) },
    });
  }, state);
};

const estadoCom = (formData) => ({
  formData,
  results: { ubc: null, nicholas: null, shb: null },
  mcdmScenarios: [],
});

const editarForma = (state, valor) =>
  mmsReducer(state, { type: "SET_FORM_FIELD", section: "geometry", field: "shape", value: valor });

describe("o retrato é gravado junto com o resultado", () => {
  it.each(METODOS)("%s: o resultado carrega o retrato", (method) => {
    const depois = calcular(estadoCom(FORM_BASE));
    expect(depois.results[method].neutralSheet).toBeTruthy();
    expect(depois.results[method].neutralSheet.key).toBe(method);
  });

  it.each(METODOS)("%s: é ADITIVO — scores, ranking e breakdown seguem intactos", (method) => {
    const depois = calcular(estadoCom(FORM_BASE));
    const direto = CALC[method](FORM_BASE, FORM_BASE.criteriaWeights?.[method]);
    expect(depois.results[method].scores).toEqual(direto.scores);
    expect(depois.results[method].ranking).toEqual(direto.ranking);
    expect(depois.results[method].breakdown).toEqual(direto.breakdown);
  });

  it("método desmarcado continua recebendo null, sem retrato", () => {
    const soUbc = { ...FORM_BASE, selectedMethods: { ubc: true, nicholas: false, shb: false } };
    const depois = calcular(estadoCom(soUbc));
    expect(depois.results.ubc).toBeTruthy();
    expect(depois.results.nicholas).toBeNull();
    expect(depois.results.shb).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// TESTE CENTRAL — A JANELA ESTÁ FECHADA
// ---------------------------------------------------------------------------
// O cenário exato que a expunha: calcular com um formulário, editar o
// formulário SEM recalcular, e voltar à tela de resultados. Antes, o score
// exibido descrevia o formulário antigo e a marcação descrevia o novo.
describe("editar o formulário sem recalcular não mexe na marcação", () => {
  // "Massivo" elimina o Longwall pela FORMA nos três métodos; "Tabular" não
  // elimina ninguém por forma. A troca é o que faz a divergência aparecer.
  const calculado = calcular(estadoCom(FORM_BASE));
  const editado   = editarForma(calculado, "Tabular");

  it.each(METODOS)("%s: a marcação continua descrevendo o formulário calculado", (method) => {
    const ids = eliminatingCriteriaFor(editado.results[method].neutralSheet, method, "LW");
    expect(ids).toContain("shape");
  });

  it.each(METODOS)("%s: e os scores exibidos também — os dois concordam", (method) => {
    // A consistência é a questão toda: marcação e score têm de falar do MESMO
    // formulário. Os scores seguem sendo os do formulário calculado.
    const doCalculado = CALC[method](FORM_BASE, FORM_BASE.criteriaWeights?.[method]);
    expect(editado.results[method].scores).toEqual(doCalculado.scores);
  });

  it.each(METODOS)("%s: derivar AO VIVO daria outra resposta — é a janela que sumiu", (method) => {
    // Reencena o desenho antigo contra o formData EDITADO. Com "Tabular" o
    // Longwall não é mais eliminado por forma, então a marcação ao vivo
    // discordaria do score congelado ao lado dela. Se este caso um dia passar a
    // concordar com o de cima, é porque alguém voltou a derivar na tela.
    const aoVivo = eliminatingCriteriaFor(retratoDe(editado.formData, method), method, "LW");
    expect(aoVivo).not.toContain("shape");
  });

  it("o formData editado é mesmo o novo — o teste não passa por engano", () => {
    // Guarda do próprio teste: se a edição não tivesse pegado, os três casos
    // acima passariam sem provar nada.
    expect(editado.formData.geometry.shape).toBe("Tabular");
    expect(calculado.formData.geometry.shape).toBe("Massivo");
  });
});

// ---------------------------------------------------------------------------
// REGRESSÃO — OS PESOS DO COMPLEMENTAR CONTINUAM SEM VOZ NA MARCAÇÃO
// ---------------------------------------------------------------------------
// Conquista da tarefa anterior, que o congelamento não pode ter desfeito: o
// retrato sai de buildDecisionMatrix, que ignora `formData.criteriaWeights` por
// contrato, então a marcação é idêntica com peso 1.00 e com peso mexido.
describe("pesos do Complementar não afetam o retrato congelado", () => {
  const PESOS = { geo: { shape: 1.5, thickness: 0.5, dip: 1.75, grade: 1, depth: 1 } };
  const COM_PESOS = {
    ...FORM_BASE,
    criteriaWeights: { ubc: PESOS, nicholas: PESOS, shb: PESOS },
  };

  const padrao   = calcular(estadoCom(FORM_BASE));
  const mexido   = calcular(estadoCom(COM_PESOS));

  it.each(METODOS)("%s: a marcação é a mesma nos dez métodos de lavra", (method) => {
    for (const { code } of padrao.results[method].neutralSheet.rows) {
      expect(eliminatingCriteriaFor(mexido.results[method].neutralSheet, method, code))
        .toEqual(eliminatingCriteriaFor(padrao.results[method].neutralSheet, method, code));
    }
  });

  it.each(METODOS)("%s: mas os SCORES exibidos mudaram — os pesos seguem valendo", (method) => {
    expect(mexido.results[method].scores).not.toEqual(padrao.results[method].scores);
  });
});

// ---------------------------------------------------------------------------
// LIMPEZA — SEM RESÍDUO ÓRFÃO
// ---------------------------------------------------------------------------
// O retrato mora DENTRO do resultado, e não num bucket irmão, porque tem
// exatamente o mesmo ciclo de vida dele. A consequência boa aparece aqui: não
// há um segundo lugar para lembrar de limpar.
describe("CLEAR_RESULTS e RESET_ALL levam o retrato junto", () => {
  const calculado = calcular(estadoCom(FORM_BASE));

  it("CLEAR_RESULTS zera os três slots, retrato incluído", () => {
    const depois = mmsReducer(calculado, { type: "CLEAR_RESULTS" });
    for (const method of METODOS) expect(depois.results[method]).toBeNull();
  });

  it("RESET_ALL zera os três slots, retrato incluído", () => {
    const depois = mmsReducer(calculado, { type: "RESET_ALL" });
    for (const method of METODOS) expect(depois.results[method]).toBeNull();
  });

  it("não sobra nenhuma outra raiz de estado guardando retrato", () => {
    // A prova de que o retrato não vazou para um bucket irmão: as raízes do
    // estado continuam sendo as três de sempre.
    const depois = mmsReducer(calculado, { type: "CLEAR_RESULTS" });
    expect(Object.keys(depois).sort()).toEqual(["formData", "mcdmScenarios", "results"]);
    expect(JSON.stringify(depois.results)).not.toContain("neutralSheet");
  });

  it("CLEAR_RESULTS não encosta no formulário nem nos cenários", () => {
    const depois = mmsReducer(calculado, { type: "CLEAR_RESULTS" });
    expect(depois.formData).toBe(calculado.formData);
    expect(depois.mcdmScenarios).toBe(calculado.mcdmScenarios);
  });
});
