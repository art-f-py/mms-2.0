import { describe, it, expect } from "vitest";
import { ELIMINATION_SCORE_BY_METHOD, eliminatingCriteriaFor } from "../eliminationMarker";
import { buildDecisionMatrix } from "../../algorithms/decisionMatrix";
import { calculateNicholas, calculateUBC, calculateSHB } from "../../algorithms/algorithms";

// ---------------------------------------------------------------------------
// MARCADOR DE ELIMINAÇÃO NOS RESULTADOS CLÁSSICOS
// ---------------------------------------------------------------------------
// O que precisa estar certo, e o que quebraria em silêncio se não estivesse:
//
//   1. o marcador é POR MÉTODO DE SELEÇÃO (−49 / −49 / −50), não um número
//      global. Um único marcador deixaria os cartões do SH&B sempre limpos.
//   2. o −25 do SH&B é penalidade parcial e NÃO elimina — se entrasse, o Open
//      Pit apareceria eliminado a 600 m, o que a publicação não diz.
//   3. mais de um critério eliminando o mesmo método devolve TODOS: o hover
//      existe para dizer quais foram, e um só já seria uma meia-verdade.
//   4. cartão sem eliminação nenhuma devolve lista vazia (é o caso comum, e é
//      ele que decide que o cartão NÃO fica vermelho).
//   5. **os pesos do Complementar não têm voz nenhuma nisto.** Ver o describe
//      dedicado no fim do arquivo — é a regressão do bug que a função tinha.
//
// A FONTE É UMA ABA DE buildDecisionMatrix, não o `breakdown` do resultado. Os
// casos rodam contra a matriz de verdade, e não contra abas escritas à mão: o
// que interessa é a forma que `sheet` REALMENTE tem, que um objeto forjado aqui
// poderia contradizer sem ninguém notar.

// Formulário completo o bastante para os três métodos pontuarem. Os valores são
// escolhidos por conveniência de teste, não por realismo geológico.
const FORM = {
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

const com = (extra) => ({ ...FORM, ...extra });

// A MESMA chamada que MethodBlock faz: a aba do método pedido, com os pesos
// neutros que buildDecisionMatrix impõe por contrato.
const abaDe = (method, formData = FORM) =>
  buildDecisionMatrix(formData, { [method]: true }).sheets.find((s) => s.key === method);

describe("ELIMINATION_SCORE_BY_METHOD", () => {
  it("é −49 no Nicholas e no UBC, −50 no SH&B", () => {
    expect(ELIMINATION_SCORE_BY_METHOD).toEqual({ nicholas: -49, ubc: -49, shb: -50 });
  });
});

describe("eliminatingCriteriaFor", () => {
  it("devolve vazio para método de lavra que nenhum critério elimina", () => {
    // Forma tabular, mergulho 45°: Sublevel Stoping não é eliminado por nada.
    expect(eliminatingCriteriaFor(abaDe("nicholas"), "nicholas", "SLS")).toEqual([]);
  });

  it("encontra o critério que elimina, pelo id da coluna", () => {
    // Forma "Massivo" pontua −49 para Longwall na tabela do Nicholas.
    const sheet = abaDe("nicholas", com({ geometry: { ...FORM.geometry, shape: "Massivo" } }));
    expect(eliminatingCriteriaFor(sheet, "nicholas", "LW")).toContain("shape");
    // O id sai limpo: nada de "shape__Massivo", que era a forma da chave do
    // breakdown quando ele era a fonte.
    for (const id of eliminatingCriteriaFor(sheet, "nicholas", "LW")) {
      expect(id).not.toContain("__");
    }
  });

  it("lista TODOS os critérios quando mais de um elimina o mesmo método", () => {
    // Espessura "Muito espesso" e mergulho inclinado eliminam Longwall no UBC
    // por critérios diferentes.
    const sheet = abaDe("ubc", com({
      geometry: { ...FORM.geometry, thickness: "Muito espesso" },
      dip: "80",
    }));
    const ids = eliminatingCriteriaFor(sheet, "ubc", "LW");
    expect(ids.length).toBeGreaterThan(1);
    expect(new Set(ids).size).toBe(ids.length); // sem id repetido
  });

  it("usa o marcador do método de seleção pedido, não um número global", () => {
    // A MESMA aba, lida com dois marcadores. O SH&B elimina com −50; se a
    // função procurasse −49 nele, a lista voltaria vazia.
    const sheet = abaDe("shb", com({ geometry: { ...FORM.geometry, shape: "Massivo" } }));
    expect(eliminatingCriteriaFor(sheet, "shb", "LW")).toContain("shape");
    expect(eliminatingCriteriaFor(sheet, "nicholas", "LW")).toEqual([]);
  });

  it("NÃO trata o −25 do SH&B como eliminação", () => {
    // depth "Pouco profunda" (500 < p <= 800) vale −25 para Open Pit: penalidade
    // parcial, não veto. Confere primeiro que o −25 está mesmo lá, para o teste
    // não passar por o critério ter sumido da aba.
    const sheet = abaDe("shb", com({ depth: { ore: "700", hangingWall: "700", footwall: "700" } }));
    const linhaOP = sheet.rows.find((r) => r.code === "OP");
    expect(linhaOP.values[sheet.criterionKeys.indexOf("depth")]).toBe(-25);
    expect(eliminatingCriteriaFor(sheet, "shb", "OP")).not.toContain("depth");
  });

  it("os ids saem na ordem das colunas da aba", () => {
    // A mesma ordem em que o `calculate*` montou os critérios, que é a do radar
    // de breakdown ao lado — a lista do hover se lê na mesma sequência.
    const sheet = abaDe("ubc", com({
      geometry: { ...FORM.geometry, shape: "Massivo", thickness: "Muito espesso" },
      dip: "80",
    }));
    const ids = eliminatingCriteriaFor(sheet, "ubc", "LW");
    const posicoes = ids.map((id) => sheet.criterionKeys.indexOf(id));
    expect(posicoes).toEqual([...posicoes].sort((a, b) => a - b));
  });

  it("devolve vazio para método de seleção desconhecido, aba ausente ou método de lavra fora da aba", () => {
    const sheet = abaDe("nicholas");
    expect(eliminatingCriteriaFor(sheet, "inexistente", "BC")).toEqual([]);
    expect(eliminatingCriteriaFor(null, "nicholas", "BC")).toEqual([]);
    expect(eliminatingCriteriaFor({}, "nicholas", "BC")).toEqual([]);
    expect(eliminatingCriteriaFor(sheet, "nicholas", "NAO_EXISTE")).toEqual([]);
  });

  it("célula vazia (null) não conta como eliminação", () => {
    // `null` aparece em `values` quando a tabela não pontua aquele método
    // naquele critério (ver buildSheet). Não é veto.
    const sheet = { criterionKeys: ["shape", "dip"], rows: [{ code: "OP", values: [null, undefined] }] };
    expect(eliminatingCriteriaFor(sheet, "nicholas", "OP")).toEqual([]);
  });

  it("não muta a aba que recebe", () => {
    const sheet = abaDe("nicholas");
    const copia = JSON.parse(JSON.stringify(sheet));
    eliminatingCriteriaFor(sheet, "nicholas", "LW");
    expect(sheet).toEqual(copia);
  });
});

// ---------------------------------------------------------------------------
// REGRESSÃO — OS PESOS DO COMPLEMENTAR NÃO DESLIGAM A MARCAÇÃO
// ---------------------------------------------------------------------------
// ESTE É O TESTE CENTRAL. A função lia `result.breakdown`, que guarda o score já
// MULTIPLICADO pelo peso por critério da etapa Complementar. Com os pesos no
// padrão (1.00) o valor gravado é o da tabela e a comparação exata acertava;
// bastava alguém arrastar um slider para −49 virar −73,5 e o cartão parar de
// ficar vermelho — falso negativo silencioso, com o método ainda eliminado pela
// publicação e a tela deixando de dizer.
//
// A correção trocou a FONTE: buildDecisionMatrix monta os scores com
// `neutralWeights()`, ignorando `formData.criteriaWeights` por contrato. Os
// casos abaixo provam as duas metades — que a marcação sobrevive ao peso
// alterado, e que ela é IDÊNTICA à de antes quando o peso está em 1.00.
describe("pesos do Complementar não afetam a marcação", () => {
  // Corpo massivo, muito espesso, mergulho 70°: elimina o Longwall nos três
  // métodos de seleção, por forma, espessura e mergulho.
  const CENARIO = com({
    geometry: { shape: "Massivo", thickness: "Muito espesso", grade: "Uniforme" },
    dip: "70",
  });

  // Pesos BEM diferentes de 1.00, nos exatos critérios que eliminam. É o
  // formulário de alguém que mexeu nos sliders da etapa complementar.
  const PESOS_MEXIDOS = {
    ubc:      { geo: { shape: 1.5, thickness: 0.5, dip: 1.75, grade: 1, depth: 1 } },
    nicholas: { geo: { shape: 1.5, thickness: 0.5, dip: 1.75, grade: 1 } },
    shb:      { geo: { shape: 1.5, thickness: 0.5, dip: 1.75, grade: 1, depth: 1 } },
  };

  const COM_PESOS = { ...CENARIO, criteriaWeights: PESOS_MEXIDOS };
  const CALCULADORES = { nicholas: calculateNicholas, ubc: calculateUBC, shb: calculateSHB };

  describe.each(["nicholas", "ubc", "shb"])("%s", (method) => {
    it("marca o Longwall mesmo com os pesos alterados", () => {
      const ids = eliminatingCriteriaFor(abaDe(method, COM_PESOS), method, "LW");
      expect(ids).toEqual(expect.arrayContaining(["shape", "thickness", "dip"]));
    });

    it("dá exatamente o mesmo resultado com peso 1.00 e com peso alterado", () => {
      // A garantia forte: não é só "continua marcando", é "marca a mesma coisa".
      // Os dez métodos de lavra, não só o Longwall.
      const semPesos = abaDe(method, CENARIO);
      const comPesos = abaDe(method, COM_PESOS);
      for (const { code } of semPesos.rows) {
        expect(eliminatingCriteriaFor(comPesos, method, code))
          .toEqual(eliminatingCriteriaFor(semPesos, method, code));
      }
    });

    it("a FONTE ANTIGA teria falhado aqui — é o bug que isto corrige", () => {
      // Reencena o caminho antigo: o breakdown calculado com os pesos do
      // usuário. O marcador não sobrevive à multiplicação, e a busca exata que
      // esta função faz não acharia nada. Se um dia alguém reapontar a função
      // para o breakdown, o caso acima quebra e este explica por quê.
      const marcador = ELIMINATION_SCORE_BY_METHOD[method];
      const pesado   = CALCULADORES[method](COM_PESOS, PESOS_MEXIDOS[method]);
      const achados  = Object.values(pesado.breakdown).filter((s) => s.LW === marcador);
      expect(achados).toHaveLength(0);

      // E o valor de fato virou outro número, não sumiu do breakdown.
      const chaveForma = Object.keys(pesado.breakdown).find((k) => k.startsWith("shape__"));
      expect(pesado.breakdown[chaveForma].LW).not.toBe(marcador);
    });
  });
});

// ---------------------------------------------------------------------------
// O QUE A TELA EXIBE NÃO MUDOU
// ---------------------------------------------------------------------------
// A aba neutra é ADITIVA: entrou para alimentar a marcação e não substituiu
// `state.results`. Scores, ranking e breakdown continuam vindo do cálculo com os
// pesos do usuário — e continuam RESPONDENDO a eles, que é o ponto dos sliders.
describe("o cálculo clássico exibido continua sensível aos pesos", () => {
  const CENARIO = com({ geometry: { shape: "Massivo", thickness: "Muito espesso", grade: "Uniforme" }, dip: "70" });
  const PESOS   = { geo: { shape: 2, thickness: 1, dip: 1, grade: 1, depth: 1 } };

  it.each([
    ["nicholas", calculateNicholas],
    ["ubc",      calculateUBC],
    ["shb",      calculateSHB],
  ])("%s: mexer no peso muda os scores exibidos", (_key, calc) => {
    const neutro = calc(CENARIO);
    const pesado = calc(CENARIO, PESOS);
    expect(pesado.scores).not.toEqual(neutro.scores);
  });
});
