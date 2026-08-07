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
function leaves(node, prefix = "") {
  const out = {};
  for (const [key, value] of Object.entries(node)) {
    if (isMetaKey(key)) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(value)) Object.assign(out, leaves(value, path));
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
