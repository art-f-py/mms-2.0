import { describe, it, expect } from "vitest";
import { SCALE_FLOOR_VALUE, floorCriteriaBySheet } from "../scaleFloorCriteria";
import { deriveMcdmRanking, MCDM_STATUS } from "../mcdmRanking";
import { equalGroupWeights } from "../../algorithms/enfoque";
import { FIXED_CRITERIA } from "../../algorithms/mcdmCriteria";
import { METHODS } from "../../algorithms/ubcWeights";

// ---------------------------------------------------------------------------
// CRITÉRIOS NO PISO DA ESCALA, NA ABA QUE O TOPSIS LEU
// ---------------------------------------------------------------------------
// Quatro coisas precisam estar certas, e duas delas são sobre NÃO fazer:
//
//   1. um método com 0 numa coluna CLÁSSICA é apontado, com os ids certos;
//   2. um método sem nenhum 0 devolve lista vazia — é ele que decide que o
//      cartão NÃO fica vermelho, e é o caso comum;
//   3. coluna FIXA nunca dispara, nem quando o dado traz um 0 lá. Hoje nenhuma
//      das seis tem zero, então o teste PLANTA um para provar que o filtro é
//      ativo e não uma coincidência do dado atual;
//   4. o Map responde pelo código do método de lavra, para os TRÊS métodos de
//      seleção — a função é method-agnóstica pela natureza da aba, mas isso é
//      verificado rodando os três, não deduzido do Nicholas.
//
// Os casos de 1, 2 e 4 rodam contra o PIPELINE DE VERDADE, não contra abas
// escritas à mão: o que interessa é a forma que `result.sheet` realmente tem
// depois da conversão de escala. Só o caso 3 usa aba sintética, porque o dado
// real não oferece o cenário que ele precisa cobrir.

// Formulário que produz eliminação em vários métodos de lavra, nos três métodos
// de seleção: corpo massivo, muito espesso, mergulho 70° e 700 m de
// profundidade. É o mesmo cenário usado para conferir a marcação da aba
// clássica; aqui ele serve para o outro lado da mesma moeda.
const FORM_COM_ELIMINACAO = {
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

const abaDe = (method, formData = FORM_COM_ELIMINACAO) => {
  const derivado = deriveMcdmRanking(formData, equalGroupWeights(), { method });
  expect(derivado.status).toBe(MCDM_STATUS.OK);
  return derivado.result.sheet;
};

const METODOS_DE_SELECAO = ["nicholas", "ubc", "shb"];

describe("SCALE_FLOOR_VALUE", () => {
  it("é 0 — o valor que as três conversões dão ao marcador de eliminação", () => {
    expect(SCALE_FLOOR_VALUE).toBe(0);
  });
});

describe.each(METODOS_DE_SELECAO)("aba do %s", (method) => {
  it("aponta os critérios no piso, e eles batem com os zeros da aba", () => {
    const sheet = abaDe(method);
    const mapa  = floorCriteriaBySheet(sheet);

    // A conferência independente: varre a aba à mão e compara com o que a
    // função devolveu, linha a linha. Se ela errasse o índice de uma coluna,
    // as duas listas divergiriam aqui.
    for (const row of sheet.rows) {
      const esperado = sheet.criterionKeys.filter(
        (id, i) => row.values[i] === 0 && !FIXED_CRITERIA.some((c) => c.id === id),
      );
      expect(mapa.get(row.code)).toEqual(esperado);
    }
  });

  it("marca o Longwall, que é eliminado por forma, espessura e mergulho", () => {
    // O cenário foi escolhido para eliminar o LW nos três métodos de seleção —
    // é o caso que faz o cartão ficar vermelho.
    const ids = floorCriteriaBySheet(abaDe(method)).get("LW");
    expect(ids).toContain("shape");
    expect(ids).toContain("thickness");
    expect(ids).toContain("dip");
    expect(ids.length).toBeGreaterThan(1);
  });

  it("há método sem piso nenhum — é ele que fica SEM marca", () => {
    const mapa   = floorCriteriaBySheet(abaDe(method));
    const limpos = [...mapa].filter(([, ids]) => ids.length === 0);
    expect(limpos.length).toBeGreaterThan(0);
  });

  it("o Map responde por TODOS os dez métodos de lavra, inclusive os limpos", () => {
    // Método sem piso devolve `[]`, não `undefined`: a tela pergunta pelo
    // código e lê `.length` sem se defender do caso comum.
    const mapa = floorCriteriaBySheet(abaDe(method));
    expect([...mapa.keys()].sort()).toEqual([...METHODS].sort());
    for (const code of METHODS) expect(Array.isArray(mapa.get(code))).toBe(true);
  });

  it("nenhum id devolvido é de critério fixo", () => {
    const mapa    = floorCriteriaBySheet(abaDe(method));
    const fixos   = FIXED_CRITERIA.map((c) => c.id);
    for (const ids of mapa.values()) {
      for (const id of ids) expect(fixos).not.toContain(id);
    }
  });

  it("os ids saem na ordem das colunas da aba", () => {
    // A lista do hover se lê na mesma direção que a matriz logo abaixo.
    const sheet = abaDe(method);
    for (const [code, ids] of floorCriteriaBySheet(sheet)) {
      const posicoes = ids.map((id) => sheet.criterionKeys.indexOf(id));
      expect(posicoes).toEqual([...posicoes].sort((a, b) => a - b));
      expect(code).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// O FILTRO POR COLUNA CLÁSSICA É ATIVO
// ---------------------------------------------------------------------------
// Os seis critérios fixos do Francisco atravessam o pipeline SEM conversão de
// escala, então um 0 numa coluna dessas não seria piso de escala — seria o
// score 0 da tabela dele, um valor legítimo. Nenhuma das seis tem zero hoje, e
// é exatamente por isso que estes casos plantam um: sem o dado sintético, um
// filtro quebrado passaria despercebido para sempre.
describe("colunas fixas nunca disparam a marcação", () => {
  const abaSintetica = (criterionKeys, values) => ({
    criterionKeys,
    rows: [{ code: "OP", method: "Open Pit", values }],
  });

  it("um 0 PLANTADO numa coluna fixa é ignorado", () => {
    const sheet = abaSintetica(["shape", "performance"], [5, 0]);
    expect(floorCriteriaBySheet(sheet).get("OP")).toEqual([]);
  });

  it("com 0 nas duas, só a clássica sai", () => {
    const sheet = abaSintetica(["shape", "performance"], [0, 0]);
    expect(floorCriteriaBySheet(sheet).get("OP")).toEqual(["shape"]);
  });

  it("vale para os SEIS critérios fixos, não só para um", () => {
    const ids    = FIXED_CRITERIA.map((c) => c.id);
    const sheet  = abaSintetica(ids, ids.map(() => 0));
    expect(floorCriteriaBySheet(sheet).get("OP")).toEqual([]);
  });

  it("o índice não se desloca quando uma fixa é pulada", () => {
    // O erro que este caso pega: filtrar as colunas fixas ANTES de casar índice
    // com valor deslocaria todas as colunas seguintes, e a função apontaria o
    // critério errado — plausível e errado.
    const sheet = abaSintetica(
      ["shape", "performance", "thickness", "dilution", "dip"],
      [9, 0, 0, 0, 7],
    );
    expect(floorCriteriaBySheet(sheet).get("OP")).toEqual(["thickness"]);
  });
});

describe("bordas", () => {
  it("aba sem linhas devolve Map vazio", () => {
    expect(floorCriteriaBySheet({ criterionKeys: ["shape"], rows: [] }).size).toBe(0);
  });

  it("aba sem critérios devolve lista vazia para cada linha", () => {
    const sheet = { criterionKeys: [], rows: [{ code: "OP", values: [] }] };
    expect(floorCriteriaBySheet(sheet).get("OP")).toEqual([]);
  });

  it("aguenta receber algo que não é aba", () => {
    for (const lixo of [null, undefined, {}, "aba", 42]) {
      expect(floorCriteriaBySheet(lixo).size).toBe(0);
    }
  });

  it("célula vazia (null) não conta como piso", () => {
    // `null == 0` é verdadeiro com ==; a comparação precisa ser estrita. Uma
    // célula sem valor não é uma pontuação mínima.
    const sheet = { criterionKeys: ["shape", "dip"], rows: [{ code: "OP", values: [null, undefined] }] };
    expect(floorCriteriaBySheet(sheet).get("OP")).toEqual([]);
  });

  it("não muta a aba que recebe", () => {
    const sheet = { criterionKeys: ["shape", "performance"], rows: [{ code: "OP", values: [0, 0] }] };
    const copia = JSON.parse(JSON.stringify(sheet));
    floorCriteriaBySheet(sheet);
    expect(sheet).toEqual(copia);
  });
});
