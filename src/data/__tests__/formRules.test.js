import { describe, it, expect } from "vitest";
import {
  THICKNESS_OPTIONS,
  isNicholasOnly,
  thicknessOptionsFor,
  normalizeThickness,
  normalizeRss,
  hasManualRss,
  emptyRss,
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

// ---------------------------------------------------------------------------
// RSS manual orfao: o <select> de RSS so e renderizado com o Nicholas sozinho,
// e so calculateNicholas ainda le fd.rss (como fallback). Marcar UBC/SH&B tira
// o campo da tela — o valor gravado nao pode seguir pontuando escondido.
// ---------------------------------------------------------------------------

const rssFilled = { ore: "Fraca", hangingWall: "Moderada", footwall: "Resistente" };

describe("hasManualRss", () => {
  it("e verdadeiro com qualquer dominio preenchido", () => {
    expect(hasManualRss(rssFilled)).toBe(true);
    expect(hasManualRss({ ore: "", hangingWall: "Moderada", footwall: "" })).toBe(true);
  });

  it("e falso com os tres dominios vazios", () => {
    expect(hasManualRss(emptyRss())).toBe(false);
  });

  it("nao quebra com o campo ausente", () => {
    expect(hasManualRss(undefined)).toBe(false);
  });
});

describe("normalizeRss — estado orfao", () => {
  it("preserva o RSS manual com o Nicholas sozinho", () => {
    const fd = { selectedMethods: sm(false, true, false), rss: { ...rssFilled } };
    expect(normalizeRss(fd).rss).toEqual(rssFilled);
  });

  it.each([
    ["marca UBC",       sm(true,  true,  false)],
    ["marca SH&B",      sm(false, true,  true)],
    ["marca os dois",   sm(true,  true,  true)],
  ])("limpa os tres dominios quando %s", (_caso, methods) => {
    const fd = { selectedMethods: methods, rss: { ...rssFilled } };
    expect(normalizeRss(fd).rss).toEqual(emptyRss());
  });

  it("limpa tambem quando o Nicholas e desmarcado", () => {
    const fd = { selectedMethods: sm(true, false, false), rss: { ...rssFilled } };
    expect(normalizeRss(fd).rss).toEqual(emptyRss());
  });

  it("limpa os dominios vizinhos, nao so o preenchido", () => {
    const fd = {
      selectedMethods: sm(true, true, false),
      rss: { ore: "", hangingWall: "Moderada", footwall: "" },
    };
    expect(normalizeRss(fd).rss).toEqual(emptyRss());
  });

  it("nao ressuscita o valor antigo ao voltar para o Nicholas sozinho", () => {
    const comUbc = normalizeRss({ selectedMethods: sm(true, true, false), rss: { ...rssFilled } });
    const soNich = normalizeRss({ ...comUbc, selectedMethods: sm(false, true, false) });
    expect(soNich.rss).toEqual(emptyRss());
  });

  it("preserva os outros campos do formulario", () => {
    const fd = {
      selectedMethods: sm(true, true, false),
      rss: { ...rssFilled },
      ucs: { ore: "100", hangingWall: "80", footwall: "90" },
      geometry: { thickness: "Espesso" },
    };
    const out = normalizeRss(fd);
    expect(out.ucs).toEqual({ ore: "100", hangingWall: "80", footwall: "90" });
    expect(out.geometry.thickness).toBe("Espesso");
  });

  it("nao muta o formData original", () => {
    const fd = { selectedMethods: sm(true, true, false), rss: { ...rssFilled } };
    normalizeRss(fd);
    expect(fd.rss).toEqual(rssFilled);
  });

  it("devolve o mesmo objeto quando nao ha o que corrigir", () => {
    const fd = { selectedMethods: sm(true, false, false), rss: emptyRss() };
    expect(normalizeRss(fd)).toBe(fd);
  });

  it("nao quebra com o campo rss ausente", () => {
    const fd = { selectedMethods: sm(true, false, false) };
    expect(() => normalizeRss(fd)).not.toThrow();
  });
});

describe("sanitizacao do estado persistido", () => {
  // loadInitialState (MmsContext) encadeia as duas normalizacoes na carga —
  // estado salvo antes destas regras pode trazer as duas combinacoes orfas.
  const load = (formData) => normalizeRss(normalizeThickness(formData));

  it("limpa o RSS manual salvo junto com UBC marcado", () => {
    const out = load({
      selectedMethods: sm(true, true, false),
      geometry: { thickness: "Espesso" },
      rss: { ...rssFilled },
    });
    expect(out.rss).toEqual(emptyRss());
  });

  it("mantem o RSS manual salvo com o Nicholas sozinho", () => {
    const out = load({
      selectedMethods: sm(false, true, false),
      geometry: { thickness: "Espesso" },
      rss: { ...rssFilled },
    });
    expect(out.rss).toEqual(rssFilled);
  });

  it("corrige espessura e RSS na mesma carga", () => {
    // Nicholas sozinho: a espessura reverte e o RSS manual segue valido.
    const orfaoNich = load({
      selectedMethods: sm(false, true, false),
      geometry: { thickness: "Muito estreito" },
      rss: { ...rssFilled },
    });
    expect(orfaoNich.geometry.thickness).toBe("Estreito");
    expect(orfaoNich.rss).toEqual(rssFilled);

    // Com UBC junto: a espessura e valida e o RSS manual e que fica orfao.
    const orfaoRss = load({
      selectedMethods: sm(true, true, false),
      geometry: { thickness: "Muito estreito" },
      rss: { ...rssFilled },
    });
    expect(orfaoRss.geometry.thickness).toBe("Muito estreito");
    expect(orfaoRss.rss).toEqual(emptyRss());
  });
});
