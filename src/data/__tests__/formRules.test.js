import { describe, it, expect } from "vitest";
import {
  THICKNESS_OPTIONS,
  isNicholasOnly,
  thicknessOptionsFor,
  normalizeThickness,
  normalizeRss,
  hasManualRss,
  emptyRss,
  STEPS,
  missingFieldsForStep,
  isStepComplete,
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

// ---------------------------------------------------------------------------
// Validacao por etapa.
// Regra inegociavel: a exigencia acompanha EXATAMENTE a condicional de render
// do Inputs.jsx. Campo que nao aparece na tela nunca pode ser exigido — isso
// travaria o usuario sem saida visivel.
// ---------------------------------------------------------------------------

const zones = ["ore", "hangingWall", "footwall"];
const perZone = (prefix) => zones.map((z) => `${prefix}.${z}`);

// formData vazio, no formato do initialFormData do MmsContext.
const emptyForm = (methods) => ({
  selectedMethods: methods,
  geometry:       { shape: "", thickness: "", grade: "" },
  dip:            "",
  depth:          { ore: "", hangingWall: "", footwall: "" },
  density:        { ore: "", hangingWall: "", footwall: "" },
  ucs:            { ore: "", hangingWall: "", footwall: "" },
  rss:            { ore: "", hangingWall: "", footwall: "" },
  rmr:            { ore: "", hangingWall: "", footwall: "" },
  jointSpacing:   { ore: "", hangingWall: "", footwall: "" },
  jointCondition: { ore: "", hangingWall: "", footwall: "" },
  oreValue:       "",
});

const trio = (v) => ({ ore: v, hangingWall: v, footwall: v });

// formData com TODOS os campos de todos os metodos preenchidos.
const fullForm = (methods) => ({
  selectedMethods: methods,
  geometry:       { shape: "Tabular", thickness: "Espesso", grade: "Uniforme" },
  dip:            "65",
  depth:          trio("400"),
  density:        trio("2600"),
  ucs:            trio("185"),
  rss:            trio("Moderada"),
  rmr:            trio("Boa"),
  jointSpacing:   trio("Longe"),
  jointCondition: trio("Forte"),
  oreValue:       "Alto",
});

describe("missingFieldsForStep — etapa de metodos", () => {
  it("exige ao menos um metodo marcado", () => {
    const fd = emptyForm(sm(false, false, false));
    expect(missingFieldsForStep(STEPS.METHODS, fd)).toEqual(["selectedMethods"]);
    expect(isStepComplete(STEPS.METHODS, fd)).toBe(false);
  });

  it.each([
    ["so UBC",       sm(true,  false, false)],
    ["so Nicholas",  sm(false, true,  false)],
    ["so SH&B",      sm(false, false, true)],
    ["os tres",      sm(true,  true,  true)],
  ])("esta completa com %s", (_caso, methods) => {
    expect(isStepComplete(STEPS.METHODS, emptyForm(methods))).toBe(true);
  });
});

describe("missingFieldsForStep — geometria", () => {
  it("exige forma, espessura, mergulho e teor sempre", () => {
    const faltando = missingFieldsForStep(STEPS.GEOMETRY, emptyForm(sm(false, true, false)));
    expect(faltando).toEqual(
      expect.arrayContaining(["geometry.shape", "geometry.thickness", "dip", "geometry.grade"])
    );
  });

  it.each([
    ["UBC",        sm(true,  false, false)],
    ["SH&B",       sm(false, false, true)],
    ["UBC + SH&B", sm(true,  false, true)],
  ])("exige a profundidade com %s", (_caso, methods) => {
    expect(missingFieldsForStep(STEPS.GEOMETRY, emptyForm(methods))).toContain("depth.ore");
  });

  it("NAO exige a profundidade com o Nicholas sozinho — o campo nem renderiza", () => {
    expect(missingFieldsForStep(STEPS.GEOMETRY, emptyForm(sm(false, true, false))))
      .not.toContain("depth.ore");
  });

  it("aceita mergulho zero (horizontal) como preenchido", () => {
    const fd = { ...fullForm(sm(true, false, false)), dip: "0" };
    expect(missingFieldsForStep(STEPS.GEOMETRY, fd)).not.toContain("dip");
  });

  it("esta completa com tudo preenchido", () => {
    expect(isStepComplete(STEPS.GEOMETRY, fullForm(sm(true, true, true)))).toBe(true);
  });
});

describe("missingFieldsForStep — geotecnica", () => {
  it("Nicholas sozinho exige o RSS manual, nao o trio numerico", () => {
    const faltando = missingFieldsForStep(STEPS.GEOTECHNICAL, emptyForm(sm(false, true, false)));
    expect(faltando).toEqual(expect.arrayContaining(perZone("rss")));
    perZone("ucs").concat(perZone("density"), perZone("depth")).forEach((campo) => {
      expect(faltando).not.toContain(campo);
    });
  });

  it.each([
    ["UBC",        sm(true,  false, false)],
    ["SH&B",       sm(false, false, true)],
    ["UBC + SH&B", sm(true,  false, true)],
  ])("%s exige o trio UCS/densidade/profundidade, nao o RSS manual", (_caso, methods) => {
    const faltando = missingFieldsForStep(STEPS.GEOTECHNICAL, emptyForm(methods));
    expect(faltando).toEqual(
      expect.arrayContaining(perZone("ucs").concat(perZone("density"), perZone("depth")))
    );
    perZone("rss").forEach((campo) => expect(faltando).not.toContain(campo));
  });

  it("UBC + Nicholas exige o trio numerico — o select manual sai da tela", () => {
    const faltando = missingFieldsForStep(STEPS.GEOTECHNICAL, emptyForm(sm(true, true, false)));
    expect(faltando).toEqual(expect.arrayContaining(perZone("ucs")));
    perZone("rss").forEach((campo) => expect(faltando).not.toContain(campo));
  });

  it("Nicholas sozinho NAO exige RMR", () => {
    const faltando = missingFieldsForStep(STEPS.GEOTECHNICAL, emptyForm(sm(false, true, false)));
    perZone("rmr").forEach((campo) => expect(faltando).not.toContain(campo));
  });

  it.each([
    ["UBC",  sm(true,  false, false)],
    ["SH&B", sm(false, false, true)],
  ])("%s exige RMR", (_caso, methods) => {
    expect(missingFieldsForStep(STEPS.GEOTECHNICAL, emptyForm(methods)))
      .toEqual(expect.arrayContaining(perZone("rmr")));
  });

  it("SH&B sozinho NAO exige espacamento nem condicao de fraturas", () => {
    const faltando = missingFieldsForStep(STEPS.GEOTECHNICAL, emptyForm(sm(false, false, true)));
    perZone("jointSpacing").concat(perZone("jointCondition")).forEach((campo) => {
      expect(faltando).not.toContain(campo);
    });
  });

  it.each([
    ["Nicholas sozinho", sm(false, true, false)],
    ["UBC + Nicholas",   sm(true,  true, false)],
  ])("%s exige espacamento e condicao de fraturas", (_caso, methods) => {
    expect(missingFieldsForStep(STEPS.GEOTECHNICAL, emptyForm(methods))).toEqual(
      expect.arrayContaining(perZone("jointSpacing").concat(perZone("jointCondition")))
    );
  });

  it("os tres juntos exigem a uniao do que cada um precisa", () => {
    const faltando = missingFieldsForStep(STEPS.GEOTECHNICAL, emptyForm(sm(true, true, true)));
    expect(faltando).toEqual(
      expect.arrayContaining(
        perZone("ucs").concat(
          perZone("density"), perZone("depth"), perZone("rmr"),
          perZone("jointSpacing"), perZone("jointCondition")
        )
      )
    );
    // O RSS manual continua de fora: com UBC/SH&B o select nao renderiza.
    perZone("rss").forEach((campo) => expect(faltando).not.toContain(campo));
  });

  it("esta completa com tudo preenchido, em qualquer combinacao", () => {
    [
      sm(true, false, false), sm(false, true, false), sm(false, false, true),
      sm(true, true, false),  sm(false, true, true),  sm(true, true, true),
    ].forEach((methods) => {
      expect(isStepComplete(STEPS.GEOTECHNICAL, fullForm(methods))).toBe(true);
    });
  });

  it("aponta so a zona que falta", () => {
    const fd = fullForm(sm(true, false, false));
    fd.rmr = { ...fd.rmr, hangingWall: "" };
    expect(missingFieldsForStep(STEPS.GEOTECHNICAL, fd)).toEqual(["rmr.hangingWall"]);
  });
});

// A etapa EESG deixou de existir: o valor do minerio, unico campo dela, passou
// para o inicio da etapa complementar. A EXIGENCIA E A MESMA — so mudou o id da
// etapa que a carrega —, e e isso que estes casos travam.
describe("missingFieldsForStep — complementar (valor do minerio)", () => {
  it("SH&B exige o valor do minerio na etapa complementar", () => {
    expect(missingFieldsForStep(STEPS.COMPLEMENTARY, emptyForm(sm(false, false, true)))).toEqual(["oreValue"]);
  });

  it.each([
    ["Nicholas sozinho", sm(false, true,  false)],
    ["UBC sozinho",      sm(true,  false, false)],
    ["UBC + Nicholas",   sm(true,  true,  false)],
  ])("%s NAO exige o valor do minerio — o campo nem aparece", (_caso, methods) => {
    expect(missingFieldsForStep(STEPS.COMPLEMENTARY, emptyForm(methods))).toEqual([]);
    expect(isStepComplete(STEPS.COMPLEMENTARY, emptyForm(methods))).toBe(true);
  });

  it("os sliders de peso da etapa continuam sem exigir nada", () => {
    // Com o SH&B marcado e o valor do minerio preenchido, a etapa libera: os
    // pesos ja vem com padrao e nunca entram na lista.
    const fd = { ...emptyForm(sm(true, true, true)), oreValue: "Medio" };
    expect(missingFieldsForStep(STEPS.COMPLEMENTARY, fd)).toEqual([]);
  });

  it("a etapa EESG nao existe mais em STEPS", () => {
    expect(STEPS.EESG).toBeUndefined();
    expect(Object.values(STEPS)).not.toContain("eesg");
  });
});

describe("missingFieldsForStep — etapas sem campo obrigatorio", () => {
  it("a etapa revisar nunca bloqueia", () => {
    expect(missingFieldsForStep(STEPS.REVIEW, emptyForm(sm(true, true, true)))).toEqual([]);
    expect(isStepComplete(STEPS.REVIEW, emptyForm(sm(true, true, true)))).toBe(true);
  });

  it("etapa desconhecida nao inventa exigencia", () => {
    expect(missingFieldsForStep("inexistente", emptyForm(sm(true, false, false)))).toEqual([]);
  });
});

describe("isStepComplete — estado vazio e estado restaurado", () => {
  it("com o formulario em branco so a etapa de metodos esta completa", () => {
    const fd = emptyForm(sm(true, true, true));
    expect(isStepComplete(STEPS.METHODS, fd)).toBe(true);
    expect(isStepComplete(STEPS.GEOMETRY, fd)).toBe(false);
    expect(isStepComplete(STEPS.GEOTECHNICAL, fd)).toBe(false);
    expect(isStepComplete(STEPS.COMPLEMENTARY, fd)).toBe(false);
  });

  it("sem metodo marcado, nem a etapa de metodos esta completa", () => {
    expect(isStepComplete(STEPS.METHODS, emptyForm(sm(false, false, false)))).toBe(false);
  });

  // Item 4: o formData vem do localStorage — quem ja preencheu nao pode ser
  // obrigado a refazer. A validacao e derivada do estado, entao a volta e
  // reconhecida sem nenhum passo extra.
  it("estado restaurado completo reconhece todas as etapas como completas", () => {
    const restaurado = JSON.parse(JSON.stringify(fullForm(sm(true, true, true))));
    Object.values(STEPS).forEach((stepId) => {
      expect(isStepComplete(stepId, restaurado)).toBe(true);
    });
  });

  it("estado restaurado parcial aponta so o que ficou faltando", () => {
    const restaurado = { ...fullForm(sm(false, false, true)), oreValue: "" };
    expect(isStepComplete(STEPS.GEOMETRY, restaurado)).toBe(true);
    expect(isStepComplete(STEPS.GEOTECHNICAL, restaurado)).toBe(true);
    expect(isStepComplete(STEPS.COMPLEMENTARY, restaurado)).toBe(false);
  });

  it("aceita a selecao vinda por parametro, sem depender do formData", () => {
    const fd = emptyForm(sm(true, false, false));
    // Explicito vence o gravado: sem UBC/SH&B, a profundidade deixa de ser exigida.
    expect(missingFieldsForStep(STEPS.GEOMETRY, fd, sm(false, true, false)))
      .not.toContain("depth.ore");
  });

  it("nao quebra com campos ausentes no formData", () => {
    expect(() => missingFieldsForStep(STEPS.GEOTECHNICAL, { selectedMethods: sm(true, true, true) }))
      .not.toThrow();
  });
});
