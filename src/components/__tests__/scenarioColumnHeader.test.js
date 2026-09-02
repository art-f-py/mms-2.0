import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { uiSelectionMethodLabel } from "../../utils/methodLabel";

// ---------------------------------------------------------------------------
// CABEÇALHO DE COLUNA DA COMPARAÇÃO DE CENÁRIOS — REGRESSÃO DE FONTE
// ---------------------------------------------------------------------------
// A tabela em si é testada em utils/__tests__/scenarioComparison.test.js, que é
// onde a lógica mora. Sobra o que só existe no componente: o cabeçalho passou a
// identificar a coluna por MÉTODO · MODO · NOME, e a célula indisponível passou
// a ser da coluna, não da tabela. As duas coisas são fáceis de desfazer sem que
// nenhum teste de lógica reclame — a tabela continuaria devolvendo os campos
// certos e a tela simplesmente não os mostraria.
//
// Leitura de fonte pelo motivo de sempre: o projeto roda em
// `environment: 'node'`, sem Testing Library. Ver o comentário no topo de
// mcdmNoBestHighlight.test.js.

const SRC = readFileSync(
  fileURLToPath(new URL("../ScenarioComparison.jsx", import.meta.url)),
  "utf8",
);

describe("rótulo curto do método de seleção", () => {
  it("é o nome próprio da publicação, sem o ano da forma longa", () => {
    // A forma longa ("Nicholas 1981/1992") é a das pills de filtro e não cabe
    // num cabeçalho de 130px.
    expect(uiSelectionMethodLabel("nicholas")).toBe("Nicholas");
    expect(uiSelectionMethodLabel("ubc")).toBe("UBC");
    expect(uiSelectionMethodLabel("shb")).toBe("SH&B");
  });

  it("chave desconhecida sai como a própria chave", () => {
    // Mesma política de uiMethodLabel: um código visível que alguém corrige é
    // melhor que um rótulo errado que ninguém percebe.
    expect(uiSelectionMethodLabel("topsis-9000")).toBe("topsis-9000");
  });
});

describe("o cabeçalho identifica método, modo e nome", () => {
  it("a legenda compõe método e modo, cada um da sua fonte", () => {
    expect(SRC).toMatch(/import \{ uiSelectionMethodLabel \} from "\.\.\/utils\/methodLabel"/);
    expect(SRC).toMatch(/uiSelectionMethodLabel\(s\.method\)/);
    // O modo vem do i18n — são os mesmos dois rótulos do seletor de modo no
    // bloco MCDM, e não um segundo par escrito aqui.
    expect(SRC).toMatch(/results\.mcdm\.modes\.\$\{s\.mode\}/);
  });

  it("o nome do cenário continua no cabeçalho, junto da legenda", () => {
    expect(SRC).toMatch(/columnCaption\(scenario\)/);
    expect(SRC).toMatch(/\{scenario\.name\}/);
  });

  it("o hover traz os três: método, modo e nome", () => {
    expect(SRC).toMatch(/title=\{`\$\{columnCaption\(scenario\)\} · \$\{scenario\.name\}`\}/);
  });
});

describe("indisponibilidade é da célula, não da tabela", () => {
  it("cada célula decide sozinha pelo próprio status", () => {
    expect(SRC).toMatch(/const vazia = cell\.status !== MCDM_STATUS\.OK/);
  });

  it("célula vazia sai sem cor de gradiente — cor sugeriria colocação", () => {
    expect(SRC).toMatch(/backgroundColor:\s*vazia \? "transparent" : cell\.color/);
  });

  it("a comparação não recebe mais um método da tela", () => {
    expect(SRC).toMatch(/export default function ScenarioComparison\(\)/);
    expect(SRC).toMatch(/buildScenarioComparisonTable\(scenarios, state\.formData\)/);
  });
});
