import { describe, it, expect } from "vitest";
import { availableMcdmMethods, safeMcdmMethod } from "../mcdmMethods";
import { MCDM_SUPPORTED_METHODS } from "../../algorithms/mcdmPipeline";

// ---------------------------------------------------------------------------
// QUAIS MÉTODOS A ABA MCDM OFERECE, E QUAL ELA USA
// ---------------------------------------------------------------------------
// Duas regras que decidem se o seletor de método aparece e o que ele mostra.
// Vivem em função pura justamente para caberem aqui: o projeto não tem teste de
// componente React (ver o topo de mcdmRanking.js), então uma regra deixada
// dentro de Statistics.jsx ficaria descoberta.

// Os mesmos objetos de SELECTION_METHODS em Statistics.jsx — { key, label,
// color }. A forma importa: é ela que o seletor de pills renderiza direto.
const UBC      = { key: "ubc",      label: "UBC 1995",            color: "#1e3a5f" };
const NICHOLAS = { key: "nicholas", label: "Nicholas 1981/1992",  color: "#1d6fa4" };
const SHB      = { key: "shb",      label: "SH&B 2007",           color: "#5bc0de" };

describe("availableMcdmMethods", () => {
  it("mantém os métodos suportados e descarta o resto", () => {
    // OS TRÊS ESTÃO LIBERADOS desde que o SH&B entrou no pipeline, então hoje
    // nada é descartado. O descarte em si continua coberto pelo caso do método
    // não suportado logo abaixo.
    expect(availableMcdmMethods([UBC, NICHOLAS, SHB])).toEqual([UBC, NICHOLAS, SHB]);
  });

  it("o SH&B entrou — e o teste que guardava a entrada dele mudou de lado", () => {
    // Este caso afirmava o contrário até o SH&B ser liberado, amarrado à fonte
    // única de propósito, para falhar exatamente quando a expectativa mudasse.
    // Falhou, e é esta a nova verdade.
    expect(MCDM_SUPPORTED_METHODS).toContain("shb");
    expect(availableMcdmMethods([SHB])).toEqual([SHB]);
  });

  it("descarta método que o pipeline não conhece", () => {
    const INVENTADO = { key: "outro", label: "Outro", color: "#000" };
    expect(availableMcdmMethods([NICHOLAS, INVENTADO])).toEqual([NICHOLAS]);
  });

  it("com um método suportado só, devolve só ele — é o caso do seletor sumir", () => {
    const INVENTADO = { key: "outro", label: "Outro", color: "#000" };
    expect(availableMcdmMethods([NICHOLAS, INVENTADO])).toEqual([NICHOLAS]);
    expect(availableMcdmMethods([NICHOLAS, INVENTADO])).toHaveLength(1);
  });

  it("preserva a ordem de entrada, e não a de MCDM_SUPPORTED_METHODS", () => {
    // A fileira de pills de /statistics lista UBC antes de Nicholas. Se esta
    // função reordenasse, o seletor da aba MCDM contradiria a fileira logo acima.
    expect(availableMcdmMethods([UBC, NICHOLAS]).map((m) => m.key)).toEqual(["ubc", "nicholas"]);
    expect(availableMcdmMethods([NICHOLAS, UBC]).map((m) => m.key)).toEqual(["nicholas", "ubc"]);
  });

  it("lista vazia devolve lista vazia — nenhum método ativo, nenhuma aba", () => {
    expect(availableMcdmMethods([])).toEqual([]);
  });

  it("não muta o que recebe", () => {
    const entrada = [UBC, NICHOLAS, SHB];
    availableMcdmMethods(entrada);
    expect(entrada).toHaveLength(3);
  });

  it("aguenta entrada inválida sem lançar", () => {
    // /statistics chama isto no corpo do render: uma exceção aqui derrubaria a
    // página inteira, inclusive os três blocos clássicos, que nada têm com o MCDM.
    expect(availableMcdmMethods(undefined)).toEqual([]);
    expect(availableMcdmMethods(null)).toEqual([]);
    expect(availableMcdmMethods("nicholas")).toEqual([]);
    expect(availableMcdmMethods([null, undefined, {}])).toEqual([]);
  });
});

describe("safeMcdmMethod", () => {
  const disponiveis = [UBC, NICHOLAS];

  it("respeita a escolha do usuário quando ela continua disponível", () => {
    expect(safeMcdmMethod("nicholas", disponiveis)).toBe("nicholas");
    expect(safeMcdmMethod("ubc", disponiveis)).toBe("ubc");
  });

  it("sem escolha ainda, cai no primeiro disponível", () => {
    // O default da tela: `null` é o estado inicial do useState em Statistics.jsx.
    expect(safeMcdmMethod(null, disponiveis)).toBe("ubc");
    expect(safeMcdmMethod(undefined, disponiveis)).toBe("ubc");
  });

  it("clampa quando o método escolhido deixa de estar disponível", () => {
    // O caso que motivou a função: a aba estava no UBC e o usuário desligou a
    // pill do UBC. Sem o clamp, a tela ficaria presa num método inativo.
    expect(safeMcdmMethod("ubc", [NICHOLAS])).toBe("nicholas");
  });

  it("clampa também um método que o pipeline nunca aceitou", () => {
    expect(safeMcdmMethod("topsis-9000", disponiveis)).toBe("ubc");
    // `shb` hoje É suportado, mas segue clampado quando não está DISPONÍVEL
    // (isto é, quando não está entre os métodos ativos na tela).
    expect(safeMcdmMethod("shb", disponiveis)).toBe("ubc");
  });

  it("sem nenhum método disponível devolve null, e não uma chave inventada", () => {
    // Nesse estado a aba MCDM nem aparece (showMcdmTab é false), então o null
    // não chega a virar ranking — mas mentir uma chave aqui esconderia o caso.
    expect(safeMcdmMethod("nicholas", [])).toBeNull();
    expect(safeMcdmMethod(null, [])).toBeNull();
  });

  it("aguenta entrada inválida sem lançar", () => {
    expect(safeMcdmMethod("nicholas", undefined)).toBeNull();
    expect(safeMcdmMethod("nicholas", null)).toBeNull();
  });
});

describe("as duas juntas — o caminho que Statistics.jsx percorre", () => {
  it("Nicholas sozinho: um disponível, seletor não aparece, e é ele que roda", () => {
    const disponiveis = availableMcdmMethods([NICHOLAS]);
    expect(disponiveis).toHaveLength(1);          // length > 1 é o que mostra o seletor
    expect(safeMcdmMethod(null, disponiveis)).toBe("nicholas");
  });

  it("os TRÊS ativos: três disponíveis, seletor aparece com três opções", () => {
    // O caso novo do SH&B: a interseção é genérica, então o terceiro método
    // entra no seletor sem nenhuma mudança na regra.
    const disponiveis = availableMcdmMethods([UBC, NICHOLAS, SHB]);
    expect(disponiveis).toHaveLength(3);
    expect(disponiveis.map((m) => m.key)).toEqual(["ubc", "nicholas", "shb"]);
    expect(safeMcdmMethod(null, disponiveis)).toBe("ubc");
    expect(safeMcdmMethod("shb", disponiveis)).toBe("shb");
  });

  it("só SH&B ativo: ele é o disponível, e a aba aparece com ele", () => {
    const disponiveis = availableMcdmMethods([SHB]);
    expect(disponiveis).toHaveLength(1);
    expect(safeMcdmMethod(null, disponiveis)).toBe("shb");
  });

  it("nenhum método reconhecido ativo: nada disponível, e a aba não aparece", () => {
    const disponiveis = availableMcdmMethods([{ key: "outro", label: "Outro", color: "#000" }]);
    expect(disponiveis).toHaveLength(0);
    expect(safeMcdmMethod(null, disponiveis)).toBeNull();
  });
});
