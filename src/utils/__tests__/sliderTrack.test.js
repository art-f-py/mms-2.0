import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { weightSliderStyle } from "../sliderTrack";

// ---------------------------------------------------------------------------
// TRILHO DO SLIDER DE PESO — FUNÇÃO PURA E GUARDA DE REGRESSÃO
// ---------------------------------------------------------------------------
// A segunda metade deste arquivo não testa comportamento de runtime: testa o
// CONTRATO DE ESTILO que corrigiu o slider preto do grupo Técnico-Operacional.
//
// Por que não basta conferir a cor. A cor SEMPRE esteve certa — o token certo
// chegava ao elemento certo, e o quadradinho ao lado do slider provava isso. O
// bug estava no que o Chromium fazia DEPOIS de receber a cor via
// `accent-color`: acima de ~0.25 de luminância ele escurece o trecho não
// preenchido do trilho para quase preto. Um teste que afirmasse
// `accentColor === "var(--color-mcdm-technical)"` passaria com o bug na tela.
//
// O que de fato pega a regressão são as duas condições juntas: existe um token
// acima do limiar E o trilho é nosso (classe + CSS próprio, sem accent-color).
// Reintroduzir `accent-color` no slider de peso derruba isto mesmo que a cor
// continue correta. Ver src/utils/sliderTrack.js para o raciocínio completo.

const lerFonte = (relativo) =>
  readFileSync(fileURLToPath(new URL(relativo, import.meta.url)), "utf8");

const CSS         = lerFonte("../../index.css");
const MCDM_BLOCK  = lerFonte("../../components/McdmBlock.jsx");

/** Limiar de luminância acima do qual o Chromium escurece o trilho derivado de
 *  `accent-color` (medido no Chrome 152). É o número que causava o bug. */
const LIMIAR_TRILHO_ESCURO = 0.25;

/** Luminância relativa (WCAG 2.x) de um hex #RRGGBB. */
function luminancia(hex) {
  const canais = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = canais.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Os quatro tokens de cor de grupo, lidos do CSS — não de uma cópia aqui, que
 *  envelheceria em silêncio se a paleta mudasse. */
function tokensDeGrupo() {
  const encontrados = {};
  for (const [, nome, hex] of CSS.matchAll(/--color-mcdm-([a-z]+):\s*(#[0-9A-Fa-f]{6});/g)) {
    encontrados[nome] = hex;
  }
  return encontrados;
}

/** Só o corpo de GroupSlider — a guarda é sobre ESTE slider, não sobre qualquer
 *  input do arquivo. */
function corpoDoGroupSlider() {
  const inicio = MCDM_BLOCK.indexOf("function GroupSlider");
  expect(inicio, "GroupSlider sumiu de McdmBlock.jsx").toBeGreaterThan(-1);
  const fim = MCDM_BLOCK.indexOf("\nfunction ", inicio + 1);
  return MCDM_BLOCK.slice(inicio, fim === -1 ? undefined : fim);
}

describe("weightSliderStyle", () => {
  it("entrega cor e posição como custom properties", () => {
    expect(weightSliderStyle("var(--color-mcdm-geometry)", 0.25)).toEqual({
      "--mms-slider-fill": "var(--color-mcdm-geometry)",
      "--mms-slider-pct":  "25%",
    });
  });

  it("limita ao intervalo [0, 1]", () => {
    expect(weightSliderStyle("red", 1.8)["--mms-slider-pct"]).toBe("100%");
    expect(weightSliderStyle("red", -0.4)["--mms-slider-pct"]).toBe("0%");
  });

  it("valor não numérico vira 0% em vez de lançar — é caminho de renderização", () => {
    for (const ruim of [undefined, null, NaN, "0.5"]) {
      expect(weightSliderStyle("red", ruim)["--mms-slider-pct"]).toBe("0%");
    }
  });
});

describe("regressão do slider preto — trilho próprio, sem accent-color", () => {
  it("os quatro tokens de grupo estão no CSS", () => {
    expect(Object.keys(tokensDeGrupo()).sort()).toEqual(
      ["economic", "geomechanics", "geometry", "technical"],
    );
  });

  it("pelo menos um token cruza o limiar que escurecia o trilho", () => {
    // Fixa a PREMISSA da guarda abaixo. Se um dia todos os tokens ficarem
    // abaixo do limiar, este teste cai — e é o aviso certo: quem escureceu a
    // paleta escondeu o sintoma sem tirar a dependência da heurística do
    // Chromium, e a guarda seguinte passa a não provar nada.
    const acima = Object.entries(tokensDeGrupo())
      .filter(([, hex]) => luminancia(hex) > LIMIAR_TRILHO_ESCURO)
      .map(([nome]) => nome);
    expect(acima).toContain("technical");
  });

  it("o slider de peso usa a classe do trilho próprio, e não accent-color", () => {
    // A guarda em si: com um token claro em uso, voltar para `accent-color`
    // traz o slider preto de volta.
    const corpo = corpoDoGroupSlider();
    expect(corpo).toMatch(/className="mms-weight-slider"/);
    expect(corpo).toMatch(/weightSliderStyle\(/);
    expect(corpo, "accent-color de volta no slider de peso — ver sliderTrack.js")
      .not.toMatch(/accentColor/);
  });

  it("o CSS do trilho próprio existe e consome as duas custom properties", () => {
    // Sem estas regras a classe seria só um nome: `appearance: none` sem trilho
    // desenhado deixaria o slider invisível, e sem elas o gradiente não lê a
    // cor nem a posição que weightSliderStyle entrega.
    expect(CSS).toMatch(/\.mms-weight-slider::-webkit-slider-runnable-track/);
    expect(CSS).toMatch(/\.mms-weight-slider::-moz-range-progress/);
    expect(CSS).toMatch(/var\(--mms-slider-fill\)/);
    expect(CSS).toMatch(/var\(--mms-slider-pct\)/);
  });

  it("o foco visível volta à mão, já que appearance: none o levou", () => {
    expect(CSS).toMatch(/\.mms-weight-slider:focus-visible/);
  });
});
