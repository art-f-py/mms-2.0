import { describe, it, expect } from "vitest";
import { ELIMINATION_SCORE_BY_METHOD, eliminatingCriteriaFor } from "../eliminationMarker";
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
//
// Os casos rodam contra os `calculate*` de verdade, e não contra breakdowns
// escritos à mão: o que interessa é a forma que o breakdown REALMENTE tem
// (`criterio__valor`), que um objeto forjado aqui poderia contradizer sem
// ninguém notar.

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

describe("ELIMINATION_SCORE_BY_METHOD", () => {
  it("é −49 no Nicholas e no UBC, −50 no SH&B", () => {
    expect(ELIMINATION_SCORE_BY_METHOD).toEqual({ nicholas: -49, ubc: -49, shb: -50 });
  });
});

describe("eliminatingCriteriaFor", () => {
  it("devolve vazio para método de lavra que nenhum critério elimina", () => {
    const resultado = calculateNicholas(FORM);
    // Forma tabular, mergulho 45°: Sublevel Stoping não é eliminado por nada.
    expect(eliminatingCriteriaFor(resultado, "nicholas", "SLS")).toEqual([]);
  });

  it("encontra o critério que elimina, pelo id (não pela chave do breakdown)", () => {
    // Forma "Massivo" pontua −49 para Longwall na tabela do Nicholas.
    const resultado = calculateNicholas(com({ geometry: { ...FORM.geometry, shape: "Massivo" } }));
    expect(eliminatingCriteriaFor(resultado, "nicholas", "LW")).toContain("shape");
    // O id sai limpo: nada de "shape__Massivo".
    for (const id of eliminatingCriteriaFor(resultado, "nicholas", "LW")) {
      expect(id).not.toContain("__");
    }
  });

  it("lista TODOS os critérios quando mais de um elimina o mesmo método", () => {
    // Espessura "Muito espesso" e mergulho inclinado eliminam Longwall no UBC
    // por critérios diferentes.
    const resultado = calculateUBC(com({
      geometry: { ...FORM.geometry, thickness: "Muito espesso" },
      dip: "80",
    }));
    const ids = eliminatingCriteriaFor(resultado, "ubc", "LW");
    expect(ids.length).toBeGreaterThan(1);
    expect(new Set(ids).size).toBe(ids.length); // sem id repetido
  });

  it("usa o marcador do método de seleção pedido, não um número global", () => {
    // O MESMO formulário, lido pelos dois métodos. O SH&B elimina com −50; se a
    // função procurasse −49 nele, a lista voltaria vazia.
    const shb = calculateSHB(com({ geometry: { ...FORM.geometry, shape: "Massivo" } }));
    expect(eliminatingCriteriaFor(shb, "shb", "LW")).toContain("shape");
    expect(eliminatingCriteriaFor(shb, "nicholas", "LW")).toEqual([]);
  });

  it("NÃO trata o −25 do SH&B como eliminação", () => {
    // depth "Pouco profunda" (500 < p <= 800) vale −25 para Open Pit: penalidade
    // parcial, não veto. Confere primeiro que o −25 está mesmo lá, para o teste
    // não passar por o critério ter sumido do breakdown.
    const resultado = calculateSHB(com({ depth: { ore: "700", hangingWall: "700", footwall: "700" } }));
    const chaveDepth = Object.keys(resultado.breakdown).find((k) => k.startsWith("depth__"));
    expect(resultado.breakdown[chaveDepth].OP).toBe(-25);
    expect(eliminatingCriteriaFor(resultado, "shb", "OP")).not.toContain("depth");
  });

  it("devolve vazio para método de seleção desconhecido ou resultado ausente", () => {
    const resultado = calculateNicholas(FORM);
    expect(eliminatingCriteriaFor(resultado, "inexistente", "BC")).toEqual([]);
    expect(eliminatingCriteriaFor(null, "nicholas", "BC")).toEqual([]);
    expect(eliminatingCriteriaFor({}, "nicholas", "BC")).toEqual([]);
  });
});
