// ---------------------------------------------------------------------------
// LEITOR DE ARQUIVOS DE CASO
// ---------------------------------------------------------------------------
// Único módulo desta pasta que toca o disco. O resto (caseSchema, mapper,
// harness) é puro e recebe objetos já carregados — é o que permite testar tudo
// sem fixture em arquivo, e o que mantém o leitor trocável se um dia os casos
// vierem de outro lugar (Drive, banco, API).
//
// RODA EM NODE, NÃO NO NAVEGADOR. Importa node:fs e é usado por testes e por
// scripts de linha de comando. Nada do app importa daqui — se um dia algo no
// app precisar, o import de node:fs quebraria o build, e é exatamente o aviso
// que se quer nesse momento.

import { readFileSync, readdirSync } from "node:fs";
import { basename, extname, join } from "node:path";

import { validateCase, CaseIncompleteError } from "./caseSchema";

/** Erro de leitura/parse — separado de CaseIncompleteError, que é sobre conteúdo. */
export class CaseFileError extends Error {
  constructor(caminho, motivo, causa) {
    super(`[MMS/validation] não foi possível ler o caso em "${caminho}": ${motivo}`);
    this.name  = "CaseFileError";
    this.path  = caminho;
    this.cause = causa;
  }
}

/**
 * Carrega um arquivo de caso e valida a completude, SEM lançar por incompletude.
 *
 * Lança só quando o arquivo não existe ou não é JSON válido — isso é defeito de
 * arquivo, não estado esperado. Caso incompleto é estado ESPERADO (os dois casos
 * reais de hoje são assim), então volta como dado: `ready: false` mais a lista do
 * que falta. Quem precisa da falha ruidosa chama loadReadyCase.
 *
 * @param {string} caminho
 * @param {object} [options] repassado a validateCase ({ methods, requireProvenance })
 * @returns {{path: string, case: object, ready: boolean, validation: object}}
 * @throws {CaseFileError}
 */
export function loadCase(caminho, options) {
  let bruto;
  try {
    bruto = readFileSync(caminho, "utf8");
  } catch (erro) {
    throw new CaseFileError(caminho, "arquivo não encontrado ou ilegível", erro);
  }

  let caso;
  try {
    caso = JSON.parse(bruto);
  } catch (erro) {
    throw new CaseFileError(caminho, `JSON inválido — ${erro.message}`, erro);
  }

  // O nome do arquivo é a identidade de fato do caso na pasta; divergir do
  // case_id gravado dentro é o tipo de coisa que passa despercebida até alguém
  // procurar um caso pelo nome errado.
  const esperado = basename(caminho, extname(caminho));
  const validacao = validateCase(caso, options);
  if (caso?.case_id && caso.case_id !== esperado) {
    validacao.warnings.push({
      path: "case_id",
      reason: `"${caso.case_id}" diverge do nome do arquivo ("${esperado}")`,
    });
  }

  return { path: caminho, case: caso, ready: validacao.ok, validation: validacao };
}

/**
 * Carrega um caso e EXIGE que esteja pronto.
 *
 * @throws {CaseFileError | CaseIncompleteError}
 */
export function loadReadyCase(caminho, options) {
  const { case: caso, validation } = loadCase(caminho, options);
  if (!validation.ok) throw new CaseIncompleteError(validation.caseId, validation.missing);
  return caso;
}

/**
 * Carrega todos os .json de um diretório, em ordem de nome.
 *
 * Não lança por caso incompleto nem por caso inválido individual: devolve a
 * lista inteira com o diagnóstico de cada um. Um lote em que um arquivo
 * derruba os outros é inútil para revisar extração.
 *
 * @returns {Array<{path, case, ready, validation} | {path, error}>}
 */
export function loadCaseDir(diretorio, options) {
  const arquivos = readdirSync(diretorio)
    .filter((nome) => extname(nome).toLowerCase() === ".json")
    .sort();

  return arquivos.map((nome) => {
    const caminho = join(diretorio, nome);
    try {
      return loadCase(caminho, options);
    } catch (erro) {
      return { path: caminho, error: erro };
    }
  });
}
