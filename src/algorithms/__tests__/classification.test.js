import { describe, it, expect } from "vitest";
import {
  classifyRSS,
  classifyRSSNicholas,
  classifyDepthUBC,
  classifyDepthSHB,
  classifyDipUBC,
  classifyDipSHB,
} from "../algorithms";

// ---------------------------------------------------------------------------
// Fixtures de RSS
// ---------------------------------------------------------------------------
// RSS = UCS(MPa) x 1e6 / (densidade x profundidade x 9.81)
// Com densidade 2500 kg/m3 e profundidade 1000 m o denominador vale exatamente
// 24 525 000, entao os UCS abaixo caem *exatamente* sobre os limites de faixa
// (verificado em ponto flutuante — nao ha erro de arredondamento aqui).
const D = 2500;   // kg/m3
const P = 1000;   // m
const UCS_RATIO_5  = 122.625; // ratio === 5
const UCS_RATIO_8  = 196.2;   // ratio === 8
const UCS_RATIO_10 = 245.25;  // ratio === 10
const UCS_RATIO_15 = 367.875; // ratio === 15

describe("classifyDepthSHB — fronteiras 200 / 500 / 800", () => {
  it("200 m ainda e Rasa (limite inclusivo)", () => {
    expect(classifyDepthSHB(200)).toBe("Rasa");
  });
  it("201 m ja e Intermediaria", () => {
    expect(classifyDepthSHB(201)).toBe("Intermediária");
  });
  it("500 m ainda e Intermediaria (limite inclusivo)", () => {
    expect(classifyDepthSHB(500)).toBe("Intermediária");
  });
  it("501 m ja e Pouco profunda", () => {
    expect(classifyDepthSHB(501)).toBe("Pouco profunda");
  });
  it("800 m ainda e Pouco profunda (limite inclusivo)", () => {
    expect(classifyDepthSHB(800)).toBe("Pouco profunda");
  });
  it("801 m ja e Profunda", () => {
    expect(classifyDepthSHB(801)).toBe("Profunda");
  });
  it("aceita string (o formulario entrega string)", () => {
    expect(classifyDepthSHB("800")).toBe("Pouco profunda");
    expect(classifyDepthSHB("801")).toBe("Profunda");
  });
  it("retorna vazio para entrada nao numerica", () => {
    expect(classifyDepthSHB("")).toBe("");
    expect(classifyDepthSHB(undefined)).toBe("");
    expect(classifyDepthSHB(null)).toBe("");
    expect(classifyDepthSHB("abc")).toBe("");
  });
});

describe("classifyDepthUBC — fronteiras 100 / 600", () => {
  it("100 m ainda e Rasa (limite inclusivo)", () => {
    expect(classifyDepthUBC(100)).toBe("Rasa");
  });
  it("101 m ja e Intermediaria", () => {
    expect(classifyDepthUBC(101)).toBe("Intermediária");
  });
  it("600 m ainda e Intermediaria (limite inclusivo)", () => {
    expect(classifyDepthUBC(600)).toBe("Intermediária");
  });
  it("601 m ja e Profunda", () => {
    expect(classifyDepthUBC(601)).toBe("Profunda");
  });
  it("aceita string", () => {
    expect(classifyDepthUBC("600")).toBe("Intermediária");
    expect(classifyDepthUBC("601")).toBe("Profunda");
  });
  it("retorna vazio para entrada nao numerica", () => {
    expect(classifyDepthUBC("")).toBe("");
    expect(classifyDepthUBC(undefined)).toBe("");
    expect(classifyDepthUBC("abc")).toBe("");
  });
});

describe("classifyDipUBC — fronteiras 20 / 55", () => {
  it("19 graus e Plano", () => {
    expect(classifyDipUBC(19)).toBe("Plano");
  });
  it("20 graus ja e Intermediario (limite exclusivo em baixo)", () => {
    expect(classifyDipUBC(20)).toBe("Intermediário");
  });
  it("55 graus ainda e Intermediario (limite inclusivo em cima)", () => {
    expect(classifyDipUBC(55)).toBe("Intermediário");
  });
  it("56 graus ja e Inclinado", () => {
    expect(classifyDipUBC(56)).toBe("Inclinado");
  });
  it("aceita string", () => {
    expect(classifyDipUBC("55")).toBe("Intermediário");
    expect(classifyDipUBC("56")).toBe("Inclinado");
  });
  it("retorna vazio para entrada nao numerica", () => {
    expect(classifyDipUBC("")).toBe("");
    expect(classifyDipUBC(undefined)).toBe("");
    expect(classifyDipUBC("abc")).toBe("");
  });
});

describe("classifyDipSHB — fronteiras 15 / 30 / 45 / 60", () => {
  it("14 graus e Plano", () => {
    expect(classifyDipSHB(14)).toBe("Plano");
  });
  it("15 graus ja e Baixo", () => {
    expect(classifyDipSHB(15)).toBe("Baixo");
  });
  it("29 graus ainda e Baixo", () => {
    expect(classifyDipSHB(29)).toBe("Baixo");
  });
  it("30 graus ja e Intermediario", () => {
    expect(classifyDipSHB(30)).toBe("Intermediário");
  });
  it("44 graus ainda e Intermediario", () => {
    expect(classifyDipSHB(44)).toBe("Intermediário");
  });
  it("45 graus ja e Pouco inclinado", () => {
    expect(classifyDipSHB(45)).toBe("Pouco inclinado");
  });
  it("59 graus ainda e Pouco inclinado", () => {
    expect(classifyDipSHB(59)).toBe("Pouco inclinado");
  });
  it("60 graus ja e Inclinado", () => {
    expect(classifyDipSHB(60)).toBe("Inclinado");
  });
  it("aceita string", () => {
    expect(classifyDipSHB("59")).toBe("Pouco inclinado");
    expect(classifyDipSHB("60")).toBe("Inclinado");
  });
  it("retorna vazio para entrada nao numerica", () => {
    expect(classifyDipSHB("")).toBe("");
    expect(classifyDipSHB(undefined)).toBe("");
    expect(classifyDipSHB("abc")).toBe("");
  });
});

describe("classifyRSS (UBC / SH&B) — fronteiras 5 / 10 / 15", () => {
  it("razao logo abaixo de 5 e Muito fraca", () => {
    expect(classifyRSS(122.6, D, P)).toBe("Muito fraca");
  });
  it("razao exatamente 5 ja e Fraca (limite exclusivo em baixo)", () => {
    expect(classifyRSS(UCS_RATIO_5, D, P)).toBe("Fraca");
  });
  it("razao logo abaixo de 10 ainda e Fraca", () => {
    expect(classifyRSS(245.2, D, P)).toBe("Fraca");
  });
  it("razao exatamente 10 ja e Moderada", () => {
    expect(classifyRSS(UCS_RATIO_10, D, P)).toBe("Moderada");
  });
  it("razao logo abaixo de 15 ainda e Moderada", () => {
    expect(classifyRSS(367.8, D, P)).toBe("Moderada");
  });
  it("razao exatamente 15 ja e Resistente", () => {
    expect(classifyRSS(UCS_RATIO_15, D, P)).toBe("Resistente");
  });
  it("aceita strings (o formulario entrega strings)", () => {
    expect(classifyRSS(String(UCS_RATIO_15), String(D), String(P))).toBe("Resistente");
  });

  describe("entradas invalidas retornam vazio sem quebrar", () => {
    it("string vazia em qualquer campo", () => {
      expect(classifyRSS("", D, P)).toBe("");
      expect(classifyRSS(UCS_RATIO_10, "", P)).toBe("");
      expect(classifyRSS(UCS_RATIO_10, D, "")).toBe("");
      expect(classifyRSS("", "", "")).toBe("");
    });
    it("undefined / null / texto", () => {
      expect(classifyRSS(undefined, undefined, undefined)).toBe("");
      expect(classifyRSS(null, null, null)).toBe("");
      expect(classifyRSS("abc", D, P)).toBe("");
    });
    it("densidade zero ou negativa (evita divisao por zero)", () => {
      expect(classifyRSS(UCS_RATIO_10, 0, P)).toBe("");
      expect(classifyRSS(UCS_RATIO_10, -2500, P)).toBe("");
    });
    it("profundidade zero ou negativa", () => {
      expect(classifyRSS(UCS_RATIO_10, D, 0)).toBe("");
      expect(classifyRSS(UCS_RATIO_10, D, -1000)).toBe("");
    });
  });

  // Comportamento atual documentado, NAO validado como especificacao:
  // o guard cobre apenas densidade e profundidade. UCS <= 0 passa e cai na
  // faixa mais baixa. Ver relatorio da suite.
  it("UCS zero ou negativo NAO e barrado — cai em Muito fraca", () => {
    expect(classifyRSS(0, D, P)).toBe("Muito fraca");
    expect(classifyRSS(-10, D, P)).toBe("Muito fraca");
  });
});

describe("classifyRSSNicholas — fronteiras 8 / 15", () => {
  it("razao logo abaixo de 8 e Fraca", () => {
    expect(classifyRSSNicholas(196.1, D, P)).toBe("Fraca");
  });
  it("razao exatamente 8 ja e Moderada", () => {
    expect(classifyRSSNicholas(UCS_RATIO_8, D, P)).toBe("Moderada");
  });
  it("razao exatamente 15 AINDA e Moderada (limite inclusivo — difere do classifyRSS)", () => {
    expect(classifyRSSNicholas(UCS_RATIO_15, D, P)).toBe("Moderada");
    // mesma entrada, faixa UBC/SH&B: ja e Resistente
    expect(classifyRSS(UCS_RATIO_15, D, P)).toBe("Resistente");
  });
  it("razao logo acima de 15 e Resistente", () => {
    expect(classifyRSSNicholas(367.9, D, P)).toBe("Resistente");
  });
  it("nunca retorna Muito fraca (faixa inexistente no Nicholas)", () => {
    expect(classifyRSSNicholas(1, D, P)).toBe("Fraca");
    expect(classifyRSSNicholas(0.001, D, P)).toBe("Fraca");
  });

  describe("entradas invalidas retornam vazio sem quebrar", () => {
    it("string vazia em qualquer campo", () => {
      expect(classifyRSSNicholas("", D, P)).toBe("");
      expect(classifyRSSNicholas(UCS_RATIO_10, "", P)).toBe("");
      expect(classifyRSSNicholas(UCS_RATIO_10, D, "")).toBe("");
    });
    it("undefined / null / texto", () => {
      expect(classifyRSSNicholas(undefined, undefined, undefined)).toBe("");
      expect(classifyRSSNicholas(null, null, null)).toBe("");
      expect(classifyRSSNicholas("abc", D, P)).toBe("");
    });
    it("densidade / profundidade zero ou negativa", () => {
      expect(classifyRSSNicholas(UCS_RATIO_10, 0, P)).toBe("");
      expect(classifyRSSNicholas(UCS_RATIO_10, -2500, P)).toBe("");
      expect(classifyRSSNicholas(UCS_RATIO_10, D, 0)).toBe("");
      expect(classifyRSSNicholas(UCS_RATIO_10, D, -1000)).toBe("");
    });
  });
});
