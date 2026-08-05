import { describe, it, expect } from "vitest";
import { calculateSHB, classifyRSS } from "../algorithms";
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
// Observacao sobre RSS: o SH&B obtem a classe exclusivamente do calculo
// (o campo manual fd.rss e exclusivo do Nicholas, que usa outra escala).
// O cenario traz UCS/densidade/profundidade fisicos de uma camada de carvao,
// escolhidos para cair em "Muito fraca" (<5) nos 3 dominios — a mesma classe
// que o MMS 1.0 usou, entao os 10 scores esperados nao mudam.
//
//   RSS = UCS x 1e6 / (densidade x profundidade x 9.81)
//   minerio (carvao):   25 MPa / 1400 kg/m3 / 900 m -> 2.02
//   capa (folhelho):    40 MPa / 2400 kg/m3 / 900 m -> 1.89
//   lapa (arenito):     50 MPa / 2500 kg/m3 / 900 m -> 2.27

const COAL_SCENARIO = {
  geometry: { shape: "Tabular", thickness: "Intermediário", grade: "Uniforme" },
  dip:      "8",
  depth:    { ore: "900", hangingWall: "900", footwall: "900" },
  density:  { ore: "1400", hangingWall: "2400", footwall: "2500" },
  ucs:      { ore: "25",   hangingWall: "40",   footwall: "50" },
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

  it("o RSS vem do calculo (UCS/densidade/profundidade) nos 3 dominios", () => {
    expect(result.breakdown).toHaveProperty("rss_ob__Muito fraca");
    expect(result.breakdown).toHaveProperty("rss_hw__Muito fraca");
    expect(result.breakdown).toHaveProperty("rss_fw__Muito fraca");
  });

  // Trava a premissa do cenario: se algum UCS/densidade mudar a ponto de sair
  // da faixa "Muito fraca", os 10 scores acima deixam de valer.
  it("o cenario classifica os 3 dominios como Muito fraca", () => {
    expect(classifyRSS(COAL_SCENARIO.ucs.ore, COAL_SCENARIO.density.ore, COAL_SCENARIO.depth.ore)).toBe("Muito fraca");
    expect(classifyRSS(COAL_SCENARIO.ucs.hangingWall, COAL_SCENARIO.density.hangingWall, COAL_SCENARIO.depth.hangingWall)).toBe("Muito fraca");
    expect(classifyRSS(COAL_SCENARIO.ucs.footwall, COAL_SCENARIO.density.footwall, COAL_SCENARIO.depth.footwall)).toBe("Muito fraca");
  });

  // O campo manual pertence ao Nicholas: preenche-lo com outra classe nao pode
  // mexer no SH&B (era o vazamento entre escalas que a Parte 1 fechou).
  it("fd.rss manual nao altera o resultado do SH&B", () => {
    const comManual = calculateSHB({
      ...COAL_SCENARIO,
      rss: { ore: "Resistente", hangingWall: "Resistente", footwall: "Resistente" },
    });
    expect(comManual.scores).toEqual(result.scores);
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
