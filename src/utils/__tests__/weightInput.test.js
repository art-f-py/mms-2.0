import { describe, it, expect } from "vitest";
import { parseWeightInput } from "../weightInput";
import { mmsReducer } from "../../context/MmsContext";
import { equalGroupWeights, ENFOQUE_GROUP_IDS, validateGroupWeights } from "../../algorithms/enfoque";
import { CRITERION_GROUPS } from "../../algorithms/mcdmCriteria";

// ---------------------------------------------------------------------------
// CAMPO NUMÉRICO DE PESO — DIGITAR EM VEZ DE ARRASTAR
// ---------------------------------------------------------------------------
// Duas coisas a provar, e a segunda é a que justifica o campo existir.
//
// A primeira: texto que ainda não é um peso NÃO vira peso. Não é preciosismo de
// validação — rebalanceGroupWeights lança RangeError para valor não finito ou
// fora de [0, 1], então um "abc" que escapasse daqui derrubaria o reducer e a
// tela junto.
//
// A segunda: digitar e arrastar produzem o MESMO estado. O campo numérico não
// pode ser um segundo caminho de escrita com regras próprias; ele é o mesmo
// dispatch, com o mesmo número. É por isso que a segunda metade deste arquivo
// compara os dois lado a lado no reducer, em vez de testar só o parser.

const { GEOMETRY, TECHNICAL } = CRITERION_GROUPS;

describe("parseWeightInput — o que vira peso", () => {
  it("aceita os valores que o campo produz normalmente", () => {
    expect(parseWeightInput("0")).toBe(0);
    expect(parseWeightInput("1")).toBe(1);
    expect(parseWeightInput("0.4")).toBe(0.4);
    expect(parseWeightInput("0.25")).toBe(0.25);
    expect(parseWeightInput("0.07")).toBe(0.07);
  });

  it("aceita as duas pontas do intervalo, que são pesos legítimos", () => {
    // Zerar um grupo é uma operação normal do Enfoque (os outros três
    // absorvem), e 1 é o extremo oposto. Nenhum dos dois é caso de borda a
    // recusar.
    expect(parseWeightInput("0")).toBe(0);
    expect(parseWeightInput("1.0")).toBe(1);
  });

  it("ignora espaço em volta", () => {
    expect(parseWeightInput("  0.5  ")).toBe(0.5);
  });

  it("recusa o campo vazio em vez de tratá-lo como zero", () => {
    // Number("") é 0. Aceitar isso zeraria o grupo no instante em que a pessoa
    // apagasse o conteúdo para digitar outro valor.
    expect(parseWeightInput("")).toBeNull();
    expect(parseWeightInput("   ")).toBeNull();
  });

  it("recusa texto não numérico", () => {
    for (const lixo of ["abc", "0,5", "--", "e", "Infinity", "NaN"]) {
      expect(parseWeightInput(lixo)).toBeNull();
    }
  });

  it("recusa número seguido de lixo, que parseFloat aceitaria", () => {
    // parseFloat("0.5abc") é 0.5. Engolir isso faria o campo aceitar texto que
    // a pessoa ainda não terminou de apagar.
    expect(parseWeightInput("0.5abc")).toBeNull();
    expect(parseWeightInput("0.5 0.6")).toBeNull();
  });

  it("recusa valores fora de [0, 1] — os que fariam o reducer lançar", () => {
    for (const fora of ["-0.1", "1.1", "5", "-1", "100"]) {
      expect(parseWeightInput(fora)).toBeNull();
    }
  });

  it("recusa estados intermediários de digitação sem quebrar", () => {
    // "-" e "0." aparecem a caminho de um número válido. O contrato é devolver
    // null, não lançar: o campo mostra o texto, o estado espera.
    for (const meio of ["-", ".", "0.", "-0."]) {
      expect(() => parseWeightInput(meio)).not.toThrow();
    }
  });

  it("recusa o que não é string", () => {
    for (const naoTexto of [null, undefined, 0.5, {}, []]) {
      expect(parseWeightInput(naoTexto)).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// DIGITAR = ARRASTAR
// ---------------------------------------------------------------------------
// O slider entrega `parseFloat(e.target.value)` ao mesmo onChange; o campo
// entrega `parseWeightInput(texto)`. Se os dois caminhos convergirem no mesmo
// número, o reducer não tem como distinguir a origem — que é exatamente a
// garantia pedida.

const SENTINELA_RESULTS = { ubc: null, nicholas: null, shb: null };

const estado = (groupWeights = equalGroupWeights()) => ({
  formData: {
    geometry: { shape: "Tabular" },
    criteriaWeights: {
      ubc:      { geo: { shape: 1 } },
      nicholas: { geo: { shape: 1 } },
      shb:      { econ: { oreValue: 1 } },
      mcdm:     { groupWeights },
    },
  },
  results:       SENTINELA_RESULTS,
  mcdmScenarios: [],
});

const pesosDe = (s) => s.formData.criteriaWeights.mcdm.groupWeights;

// O que o slider faz com o valor do input range.
const viaSlider = (texto) => parseFloat(texto);

describe("o campo numérico e o slider produzem o mesmo estado", () => {
  it("o mesmo texto dá o mesmo peso pelos dois caminhos", () => {
    for (const texto of ["0", "0.25", "0.4", "0.73", "1"]) {
      expect(parseWeightInput(texto)).toBe(viaSlider(texto));
    }
  });

  it("o estado resultante é idêntico, campo a campo", () => {
    const texto = "0.4";

    const digitado  = mmsReducer(estado(), { type: "SET_MCDM_GROUP_WEIGHT", group: GEOMETRY, value: parseWeightInput(texto) });
    const arrastado = mmsReducer(estado(), { type: "SET_MCDM_GROUP_WEIGHT", group: GEOMETRY, value: viaSlider(texto) });

    expect(pesosDe(digitado)).toEqual(pesosDe(arrastado));
  });

  it("vale para os quatro grupos e para vários valores", () => {
    for (const group of ENFOQUE_GROUP_IDS) {
      for (const texto of ["0", "0.1", "0.5", "0.99", "1"]) {
        const digitado  = mmsReducer(estado(), { type: "SET_MCDM_GROUP_WEIGHT", group, value: parseWeightInput(texto) });
        const arrastado = mmsReducer(estado(), { type: "SET_MCDM_GROUP_WEIGHT", group, value: viaSlider(texto) });
        expect(pesosDe(digitado)).toEqual(pesosDe(arrastado));
      }
    }
  });

  it("o peso digitado passa pelo mesmo rebalanceamento — o estado segue somando 1", () => {
    const depois = mmsReducer(estado(), { type: "SET_MCDM_GROUP_WEIGHT", group: TECHNICAL, value: parseWeightInput("0.7") });
    expect(pesosDe(depois)[TECHNICAL]).toBeCloseTo(0.7, 12);
    expect(() => validateGroupWeights(pesosDe(depois))).not.toThrow();
  });

  it("o texto inválido que derrubaria o reducer é recusado antes de chegar lá", () => {
    // As duas metades da garantia numa asserção só: o valor é recusado pelo
    // parser, e se não fosse, o dispatch derrubaria a tela.
    for (const invalido of ["abc", "5", "-1"]) {
      expect(parseWeightInput(invalido)).toBeNull();
      expect(() =>
        mmsReducer(estado(), { type: "SET_MCDM_GROUP_WEIGHT", group: GEOMETRY, value: Number(invalido) }),
      ).toThrow(RangeError);
    }
  });

  it("o campo vazio é recusado por corromper em silêncio, não por derrubar", () => {
    // Outro modo de falha, e mais traiçoeiro que a exceção: Number("") é 0, um
    // peso perfeitamente válido. O reducer aceitaria sem reclamar e zeraria o
    // grupo no instante em que a pessoa apagasse o campo para digitar outro
    // valor — sem erro nenhum na tela, só o peso errado.
    expect(parseWeightInput("")).toBeNull();

    const seTivesseEscapado = mmsReducer(
      estado(),
      { type: "SET_MCDM_GROUP_WEIGHT", group: GEOMETRY, value: Number("") },
    );
    expect(pesosDe(seTivesseEscapado)[GEOMETRY]).toBe(0);
  });
});
