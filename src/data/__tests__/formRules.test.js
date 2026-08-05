import { describe, it, expect } from "vitest";
import {
  THICKNESS_OPTIONS,
  isNicholasOnly,
  thicknessOptionsFor,
  normalizeThickness,
} from "../formRules";

// ---------------------------------------------------------------------------
// Regras de formulario que dependem dos metodos selecionados.
// A faixa "Muito estreito" (<3 m) e uma extensao do UBC 1995: a publicacao do
// Nicholas comeca em "Estreito" (<10 m). Com o Nicholas sozinho a opcao sai do
// select; acompanhado de UBC/SH&B ela volta, e o Nicholas a trata pelo
// mapeamento em calculateNicholas.
// ---------------------------------------------------------------------------

const sm = (ubc, nicholas, shb) => ({ ubc, nicholas, shb });

describe("isNicholasOnly", () => {
  it("e verdadeiro so com o Nicholas sozinho", () => {
    expect(isNicholasOnly(sm(false, true, false))).toBe(true);
  });

  it.each([
    ["UBC + Nicholas",        sm(true,  true,  false)],
    ["Nicholas + SH&B",       sm(false, true,  true)],
    ["os tres",               sm(true,  true,  true)],
    ["so UBC",                sm(true,  false, false)],
    ["so SH&B",               sm(false, false, true)],
    ["nenhum metodo",         sm(false, false, false)],
  ])("e falso com %s", (_caso, methods) => {
    expect(isNicholasOnly(methods)).toBe(false);
  });

  it("nao quebra com selecao ausente", () => {
    expect(isNicholasOnly(undefined)).toBe(false);
  });
});

describe("thicknessOptionsFor", () => {
  it("esconde \"Muito estreito\" com o Nicholas sozinho", () => {
    const options = thicknessOptionsFor(sm(false, true, false));
    expect(options).not.toContain("Muito estreito");
    expect(options).toEqual(["Estreito", "Intermediário", "Espesso", "Muito espesso"]);
  });

  it.each([
    ["UBC + Nicholas",  sm(true,  true,  false)],
    ["Nicholas + SH&B", sm(false, true,  true)],
    ["os tres",         sm(true,  true,  true)],
    ["so UBC",          sm(true,  false, false)],
  ])("oferece as 5 faixas com %s", (_caso, methods) => {
    expect(thicknessOptionsFor(methods)).toEqual(THICKNESS_OPTIONS);
  });

  it("nao muta a lista canonica", () => {
    thicknessOptionsFor(sm(false, true, false));
    expect(THICKNESS_OPTIONS).toHaveLength(5);
    expect(THICKNESS_OPTIONS[0]).toBe("Muito estreito");
  });
});

describe("normalizeThickness — estado orfao", () => {
  // O <select> e controlado: sem a correcao ele exibiria o placeholder
  // enquanto o estado seguiria em "Muito estreito".
  it("reverte para \"Estreito\" quando o Nicholas fica sozinho", () => {
    const fd = {
      selectedMethods: sm(false, true, false),
      geometry: { shape: "Tabular", thickness: "Muito estreito", grade: "Uniforme" },
    };
    expect(normalizeThickness(fd).geometry.thickness).toBe("Estreito");
  });

  it("preserva os outros campos da geometria", () => {
    const fd = {
      selectedMethods: sm(false, true, false),
      geometry: { shape: "Tabular", thickness: "Muito estreito", grade: "Uniforme" },
      dip: "65",
    };
    const out = normalizeThickness(fd);
    expect(out.geometry.shape).toBe("Tabular");
    expect(out.geometry.grade).toBe("Uniforme");
    expect(out.dip).toBe("65");
  });

  it("nao muta o formData original", () => {
    const fd = {
      selectedMethods: sm(false, true, false),
      geometry: { thickness: "Muito estreito" },
    };
    normalizeThickness(fd);
    expect(fd.geometry.thickness).toBe("Muito estreito");
  });

  it.each([
    ["UBC + Nicholas",  sm(true,  true,  false)],
    ["Nicholas + SH&B", sm(false, true,  true)],
    ["so UBC",          sm(true,  false, false)],
  ])("mantem \"Muito estreito\" com %s", (_caso, methods) => {
    const fd = { selectedMethods: methods, geometry: { thickness: "Muito estreito" } };
    expect(normalizeThickness(fd).geometry.thickness).toBe("Muito estreito");
  });

  it.each(["Estreito", "Intermediário", "Espesso", "Muito espesso", ""])(
    "nao mexe na espessura \"%s\" com o Nicholas sozinho",
    (thickness) => {
      const fd = { selectedMethods: sm(false, true, false), geometry: { thickness } };
      expect(normalizeThickness(fd).geometry.thickness).toBe(thickness);
    }
  );

  it("nao quebra com geometria ausente", () => {
    const fd = { selectedMethods: sm(false, true, false) };
    expect(() => normalizeThickness(fd)).not.toThrow();
  });
});
