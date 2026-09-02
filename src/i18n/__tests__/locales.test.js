import { describe, it, expect } from "vitest";

import ptBR from "../locales/pt-BR.json";
import en from "../locales/en.json";
import es from "../locales/es.json";
import fr from "../locales/fr.json";

// pt-BR é a referência: é o idioma-base do projeto e o fallbackLng do i18next.
// Todo locale novo tem que bater chave por chave com ele — sem isso, um idioma
// incompleto entra e o usuário vê texto em português no meio da tela (ou, pior,
// a própria chave crua) sem que ninguém perceba.
const REFERENCE = "pt-BR";
const LOCALES = { "pt-BR": ptBR, en, es, fr };

// Chaves iniciadas por "_" são metadados do arquivo (ex.: "_comment", a nota de
// terminologia no topo de es.json/fr.json). Não são traduções e existem só nos
// locales que precisam delas, então ficam fora da comparação de paridade.
const isMetaKey = (key) => key.startsWith("_");

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

// Achata em { "caminho.pontilhado": valor da folha }. Só folhas entram aqui.
// Arrays são percorridos por índice (ex.: "tips.shape.sections[0].items[1].desc").
// O conteúdo dos tooltips vive dentro de sections[]/items[]: sem descer nos arrays,
// esses textos ficariam fora da paridade e o array cru chegaria aqui como "folha" —
// quebrando tanto a checagem de folha-string quanto a de placeholders.
function leaves(node, prefix = "") {
  const out = {};
  const entries = Array.isArray(node)
    ? node.map((value, index) => [`${prefix}[${index}]`, value])
    : Object.entries(node)
        .filter(([key]) => !isMetaKey(key))
        .map(([key, value]) => [prefix ? `${prefix}.${key}` : key, value]);
  for (const [path, value] of entries) {
    if (isPlainObject(value) || Array.isArray(value)) Object.assign(out, leaves(value, path));
    else out[path] = value;
  }
  return out;
}

// Caminhos dos nós INTERMEDIÁRIOS (os objetos aninhados). Comparar esse conjunto
// é o que trava a estrutura de verdade: se um locale trocar um grupo aninhado por
// uma string solta — ou inventar um nível a mais —, o conjunto diverge aqui.
function containers(node, prefix = "") {
  const out = [];
  for (const [key, value] of Object.entries(node)) {
    if (isMetaKey(key) || !isPlainObject(value)) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    out.push(path, ...containers(value, path));
  }
  return out;
}

const LEAVES = Object.fromEntries(
  Object.entries(LOCALES).map(([code, data]) => [code, leaves(data)]),
);

const ALL = Object.keys(LOCALES);
const OTHERS = ALL.filter((code) => code !== REFERENCE);

const placeholdersOf = (s) =>
  (s.match(/{{\s*\w+\s*}}/g) || []).map((p) => p.replace(/\s/g, "")).sort().join("|");

describe("paridade entre os arquivos de locale", () => {
  it("registra os quatro idiomas esperados", () => {
    expect(ALL.sort()).toEqual(["en", "es", "fr", "pt-BR"]);
  });

  it.each(OTHERS)("%s não tem chaves faltando em relação ao pt-BR", (code) => {
    const missing = Object.keys(LEAVES[REFERENCE]).filter((path) => !(path in LEAVES[code]));
    expect(missing).toEqual([]);
  });

  it.each(OTHERS)("%s não tem chaves sobrando em relação ao pt-BR", (code) => {
    const extra = Object.keys(LEAVES[code]).filter((path) => !(path in LEAVES[REFERENCE]));
    expect(extra).toEqual([]);
  });

  it.each(OTHERS)("%s tem a mesma estrutura aninhada do pt-BR", (code) => {
    expect(containers(LOCALES[code]).sort()).toEqual(containers(ptBR).sort());
  });

  it.each(ALL)("%s só tem strings como valores de folha", (code) => {
    const nonString = Object.entries(LEAVES[code])
      .filter(([, value]) => typeof value !== "string")
      .map(([path, value]) => `${path}: ${Array.isArray(value) ? "array" : typeof value}`);
    expect(nonString).toEqual([]);
  });

  it.each(ALL)("%s não tem nenhum valor vazio", (code) => {
    const empty = Object.entries(LEAVES[code])
      .filter(([, value]) => typeof value === "string" && value.trim() === "")
      .map(([path]) => path);
    expect(empty).toEqual([]);
  });

  it.each(OTHERS)("%s preserva os placeholders de interpolação do pt-BR", (code) => {
    // Uma tradução que perde ou renomeia um {{placeholder}} não quebra o build,
    // mas some com o dado em tela (ex.: "Etapa {{current}} de {{total}}").
    const broken = Object.entries(LEAVES[REFERENCE])
      .filter(([path]) => path in LEAVES[code])
      .filter(([path, value]) => placeholdersOf(value) !== placeholdersOf(LEAVES[code][path]))
      .map(([path]) => path);
    expect(broken).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// OS SEIS CRITÉRIOS DO FRANCISCO — ESTRUTURA PRONTA, TEXTO PENDENTE
// ---------------------------------------------------------------------------
// O ⓘ de cada um dos seis critérios fixos no cabeçalho da matriz já está na
// tela; o texto conceitual ainda não foi escrito. Estes testes guardam as duas
// pontas: que a estrutura existe nos quatro idiomas (para o texto real ser só
// uma edição de string, sem tocar em código) e que o que está lá HOJE é
// visivelmente um placeholder — para ninguém confundir com conteúdo revisado.

const IDS_FIXOS = [
  "performance", "productivity", "recovery", "dilution",
  "capitalInvestment", "comparativeCosts",
];

describe("hints dos critérios fixos", () => {
  it.each(ALL)("%s tem um hint para cada um dos seis critérios", (code) => {
    const hints = LOCALES[code].results.mcdm.fixedCriteriaHints;
    expect(Object.keys(hints).sort()).toEqual([...IDS_FIXOS].sort());
  });

  it.each(ALL)("%s tem um rótulo para cada hint — os dois conjuntos batem", (code) => {
    // O ⓘ só faz sentido ao lado de um rótulo. Um hint órfão (ou um rótulo sem
    // hint) seria uma coluna explicada pela metade.
    const mcdm = LOCALES[code].results.mcdm;
    expect(Object.keys(mcdm.fixedCriteriaHints).sort())
      .toEqual(Object.keys(mcdm.fixedCriteria).sort());
  });

  it.each(ALL)("%s ainda traz o placeholder, e não texto conceitual inventado", (code) => {
    // ESTE TESTE DEVE FALHAR quando o texto real chegar — é o lembrete de que a
    // troca é intencional. Quem escrever a descrição de verdade apaga este caso
    // (ou o inverte), e isso é a confirmação de que passou por aqui de propósito.
    const hints = LOCALES[code].results.mcdm.fixedCriteriaHints;
    for (const id of IDS_FIXOS) {
      expect(hints[id]).toMatch(/pendente/i);
    }
  });

  it.each(ALL)("%s identifica a origem dos seis no cabeçalho da matriz", (code) => {
    const origem = LOCALES[code].results.mcdm.matrixOrigin;
    expect(Object.keys(origem).sort()).toEqual(["classic", "classicHint", "fixed", "fixedHint"]);
    for (const v of Object.values(origem)) expect(v.trim().length).toBeGreaterThan(0);
  });

  it.each(ALL)("%s tem o rótulo da sub-aba de pesos", (code) => {
    // A sub-navegação da aba multicritério: cenários já existia, pesos entrou.
    const tabs = LOCALES[code].results.mcdm.tabs;
    expect(tabs.weights.trim().length).toBeGreaterThan(0);
    expect(tabs.scenarios.trim().length).toBeGreaterThan(0);
  });
});
