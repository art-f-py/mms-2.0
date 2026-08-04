import { describe, it, expect } from "vitest";
import { calculateSHB } from "../algorithms";
import { METHODS } from "../ubcWeights";

// ---------------------------------------------------------------------------
// GOLDEN TEST — cenario do carvao (SH&B)
// ---------------------------------------------------------------------------
// Cenario validado manualmente contra o MMS 1.0. Os valores esperados abaixo
// batem 100% com a versao anterior; qualquer divergencia aqui e regressao no
// nucleo de calculo, nao ruido de teste.
//
// Entradas:
//   forma Tabular | espessura Intermediaria | mergulho 8 graus (-> Plano)
//   teor Uniforme | profundidade 900 m (-> Profunda) | valor do minerio Baixo
//   RSS Muito fraca nos 3 dominios
//   RMR Pobre (ob) / Razoavel (hw) / Razoavel (fw)
//   todos os pesos neutros (1.00)
//
// Observacao sobre RSS: densidade e UCS ficam vazios de proposito. Com eles
// vazios classifyRSS devolve "" e o algoritmo cai no valor manual de fd.rss,
// que e como o cenario foi montado no MMS 1.0.

const COAL_SCENARIO = {
  geometry: { shape: "Tabular", thickness: "Intermediário", grade: "Uniforme" },
  dip:      "8",
  depth:    { ore: "900", hangingWall: "900", footwall: "900" },
  density:  { ore: "", hangingWall: "", footwall: "" },
  ucs:      { ore: "", hangingWall: "", footwall: "" },
  rss:      { ore: "Muito fraca", hangingWall: "Muito fraca", footwall: "Muito fraca" },
  rmr:      { ore: "Pobre", hangingWall: "Razoável", footwall: "Razoável" },
  oreValue: "Baixo",
};

const EXPECTED_SCORES = {
  "LW":  23.42,
  "C&F": 22.19,
  "SQS": 20.17,
  "TS":  17.10,
  "SLC": 13.69,
  "BC":  12.96,
  "SLS": 10.21,
  "R&P": -1.22,
  "OP":  -21.36,
  "SKS": -35.44,
};

const EXPECTED_RANKING = ["LW", "C&F", "SQS", "TS", "SLC", "BC", "SLS", "R&P", "OP", "SKS"];

describe("Golden test SH&B — cenario do carvao (paridade com MMS 1.0)", () => {
  const result = calculateSHB(COAL_SCENARIO);

  it("pontua os 10 metodos", () => {
    expect(Object.keys(result.scores).sort()).toEqual([...METHODS].sort());
  });

  describe("scores individuais (tolerancia 0.01)", () => {
    for (const [method, expected] of Object.entries(EXPECTED_SCORES)) {
      it(`${method} = ${expected.toFixed(2)}`, () => {
        expect(result.scores[method]).toBeCloseTo(expected, 2);
      });
    }
  });

  it("ordem do ranking bate com o MMS 1.0", () => {
    expect(result.ranking).toEqual(EXPECTED_RANKING);
  });

  it("o ranking e consistente com os proprios scores (ordem decrescente)", () => {
    for (let i = 1; i < result.ranking.length; i++) {
      const prev = result.scores[result.ranking[i - 1]];
      const curr = result.scores[result.ranking[i]];
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });

  it("pesos neutros explicitos dao o mesmo resultado que omitir pesos", () => {
    const neutral = {
      geo:  { shape: 1, thickness: 1, dip: 1, grade: 1, depth: 1 },
      econ: { oreValue: 1 },
      ob:   { rss: 1, rmr: 1 },
      hw:   { rss: 1, rmr: 1 },
      fw:   { rss: 1, rmr: 1 },
    };
    const weighted = calculateSHB(COAL_SCENARIO, neutral);
    for (const m of METHODS) {
      expect(weighted.scores[m]).toBeCloseTo(result.scores[m], 10);
    }
    expect(weighted.ranking).toEqual(result.ranking);
  });

  it("as 12 classificacoes do cenario entram no breakdown", () => {
    // 5 geometria + 1 economico + 2 ob + 2 hw + 2 fw
    expect(Object.keys(result.breakdown)).toHaveLength(12);
  });

  it("classifica mergulho 8 graus como Plano e profundidade 900 m como Profunda", () => {
    expect(result.breakdown).toHaveProperty("dip__Plano");
    expect(result.breakdown).toHaveProperty("depth__Profunda");
  });

  it("o RSS manual e usado quando densidade/UCS estao vazios", () => {
    expect(result.breakdown).toHaveProperty("rss_ob__Muito fraca");
    expect(result.breakdown).toHaveProperty("rss_hw__Muito fraca");
    expect(result.breakdown).toHaveProperty("rss_fw__Muito fraca");
  });

  it("o RMR do formulario e traduzido para a nomenclatura SH&B", () => {
    // Pobre -> Fraca, Razoavel -> Media
    expect(result.breakdown).toHaveProperty("rmr_ob__Fraca");
    expect(result.breakdown).toHaveProperty("rmr_hw__Média");
    expect(result.breakdown).toHaveProperty("rmr_fw__Média");
  });

  it("a soma do breakdown reproduz o score de cada metodo", () => {
    for (const m of METHODS) {
      const sum = Object.values(result.breakdown)
        .reduce((acc, row) => acc + (row[m] ?? 0), 0);
      expect(sum).toBeCloseTo(result.scores[m], 10);
    }
  });
});
