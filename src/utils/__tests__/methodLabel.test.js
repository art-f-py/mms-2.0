import { describe, it, expect } from "vitest";
import { uiMethodLabel } from "../methodLabel";
import { METHODS, METHOD_LABELS } from "../../algorithms/ubcWeights";
import { EXPORT_METHOD_LABELS, buildDecisionMatrix, sheetToAoa } from "../../algorithms/decisionMatrix";

// ---------------------------------------------------------------------------
// DOIS RÓTULOS, DOIS DESTINOS — REGRESSÃO
// ---------------------------------------------------------------------------
// O bug: a tela mostrava "Square Set Stoping", o nome longo que existe para o
// arquivo exportado. Ele chegava lá de carona — buildDecisionMatrix carimba o
// rótulo de EXPORTAÇÃO em `sheet.rows[].method`, o pipeline o copia para
// `ranking[].label`, e quem exibisse essas estruturas herdava o nome errado sem
// perceber.
//
// A correção precisa valer nas DUAS direções ao mesmo tempo, e é por isso que
// este arquivo testa as duas juntas em vez de só a da tela: encurtar o rótulo
// do .xlsx "resolveria" o sintoma visível e quebraria silenciosamente o arquivo
// que outro software lê. Um teste que só olhasse a tela não veria isso.

describe("uiMethodLabel — o rótulo que vai para a tela", () => {
  it("abrevia SQS, que é o caso que motivou tudo isto", () => {
    expect(uiMethodLabel("SQS")).toBe("Square Set");
    expect(uiMethodLabel("SQS")).not.toBe("Square Set Stoping");
  });

  it("resolve os dez métodos, sem cair no código para nenhum deles", () => {
    for (const code of METHODS) {
      expect(uiMethodLabel(code)).toBe(METHOD_LABELS[code]);
      expect(uiMethodLabel(code)).not.toBe(code);
    }
  });

  it("nunca devolve um rótulo de exportação", () => {
    // A checagem que pega o erro de fonte diretamente: se algum dia alguém
    // apontar esta função para EXPORT_METHOD_LABELS, cai aqui.
    for (const code of METHODS) {
      const exportado = EXPORT_METHOD_LABELS[code];
      if (exportado !== METHOD_LABELS[code]) {
        expect(uiMethodLabel(code)).not.toBe(exportado);
      }
    }
  });

  it("devolve o próprio código quando não há rótulo, em vez de nada", () => {
    // Fallback deliberado: "XYZ" na tela é visivelmente um código e alguém
    // corrige. O fallback que NÃO existe — para row.method / entry.label —
    // reintroduziria o rótulo de exportação sem ninguém notar.
    expect(uiMethodLabel("XYZ")).toBe("XYZ");
    expect(uiMethodLabel("")).toBe("");
  });
});

describe("o arquivo exportado continua com o nome longo", () => {
  it("EXPORT_METHOD_LABELS não foi encurtado junto", () => {
    expect(EXPORT_METHOD_LABELS.SQS).toBe("Square Set Stoping");
  });

  it("os dois conjuntos discordam de propósito para SQS", () => {
    expect(METHOD_LABELS.SQS).not.toBe(EXPORT_METHOD_LABELS.SQS);
  });

  it("a planilha gerada ainda escreve \"Square Set Stoping\"", () => {
    // Vai até o AoA, que é o que de fato vira .xlsx — não basta a constante
    // estar certa se o caminho até a planilha mudar de fonte.
    const matrix = buildDecisionMatrix(
      {
        selectedMethods: { ubc: true, nicholas: true, shb: false },
        geometry: { shape: "Tabular", thickness: "Intermediário", grade: "Uniforme" },
        dip:      "45",
        depth:    { ore: "300", hangingWall: "300", footwall: "300" },
        density:  { ore: "2500", hangingWall: "2600", footwall: "2700" },
        ucs:      { ore: "120",  hangingWall: "100",  footwall: "110" },
        rmr:      { ore: "Boa",  hangingWall: "Razoável", footwall: "Razoável" },
        jointSpacing:   { ore: "Perto", hangingWall: "Longe", footwall: "Perto" },
        jointCondition: { ore: "Média", hangingWall: "Forte", footwall: "Fraca" },
        oreValue: "Médio",
      },
      { nicholas: true },
    );

    const aoa      = sheetToAoa(matrix.sheets[0]);
    const primeira = aoa.map((linha) => linha[0]);

    expect(primeira).toContain("Square Set Stoping");
    expect(primeira).not.toContain("Square Set");
  });
});
