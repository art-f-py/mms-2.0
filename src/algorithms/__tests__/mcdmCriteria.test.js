import { describe, it, expect } from "vitest";
import {
  DIRECTION,
  CRITERION_GROUPS,
  FIXED_CRITERIA,
  FIXED_CRITERIA_BY_ID,
  FIXED_CRITERION_SCORES,
  PENDING_CONFIRMATION,
  TS_PERFORMANCE_ESTIMATED,
  criteriaOfGroup,
  fixedScore,
  fixedCriteriaMatrix,
} from "../mcdmCriteria";
import { METHODS } from "../ubcWeights";

// ---------------------------------------------------------------------------
// CRITERIOS FIXOS
// ---------------------------------------------------------------------------
// A direcao de cada criterio e o dado mais perigoso desta tabela: inverter uma
// so inverte o ranking do TOPSIS sem produzir erro nenhum. Por isso as seis
// direcoes estao fixadas uma a uma, e nao verificadas por regra geral.

describe("FIXED_CRITERIA — composicao", () => {
  it("tem exatamente os seis criterios acordados", () => {
    expect(FIXED_CRITERIA.map((c) => c.id)).toEqual([
      "performance", "productivity", "recovery", "dilution",
      "capitalInvestment", "comparativeCosts",
    ]);
  });

  it("separa quatro tecnicos e dois economicos", () => {
    expect(criteriaOfGroup(CRITERION_GROUPS.TECHNICAL))
      .toEqual(["performance", "productivity", "recovery", "dilution"]);
    expect(criteriaOfGroup(CRITERION_GROUPS.ECONOMIC))
      .toEqual(["capitalInvestment", "comparativeCosts"]);
  });

  it("todo criterio tem rotulo, grupo e direcao", () => {
    FIXED_CRITERIA.forEach((c) => {
      expect(typeof c.label).toBe("string");
      expect(c.label.length).toBeGreaterThan(0);
      expect(Object.values(CRITERION_GROUPS)).toContain(c.group);
      expect(Object.values(DIRECTION)).toContain(c.direction);
    });
  });
});

describe("FIXED_CRITERIA — direcao de otimizacao", () => {
  const direction = (id) => FIXED_CRITERIA_BY_ID[id].direction;

  it("minimiza inversao de capital, custos comparativos e diluicao", () => {
    expect(direction("capitalInvestment")).toBe(DIRECTION.MIN);
    expect(direction("comparativeCosts")).toBe(DIRECTION.MIN);
    expect(direction("dilution")).toBe(DIRECTION.MIN);
  });

  it("maximiza desempenho, produtividade e recuperacao", () => {
    expect(direction("performance")).toBe(DIRECTION.MAX);
    expect(direction("productivity")).toBe(DIRECTION.MAX);
    expect(direction("recovery")).toBe(DIRECTION.MAX);
  });

  it("a direcao e dado declarado, nao inferido do nome em runtime", () => {
    // Guarda de arquitetura: se alguem trocar a constante por uma heuristica de
    // nome, um criterio novo cujo nome nao case com a regra passa a entrar com
    // direcao errada e em silencio. Aqui exigimos o campo presente na tabela.
    FIXED_CRITERIA.forEach((c) => {
      expect(Object.prototype.hasOwnProperty.call(c, "direction")).toBe(true);
    });
  });
});

describe("FIXED_CRITERION_SCORES — integridade da transcricao", () => {
  it("toda coluna cobre os 10 metodos", () => {
    FIXED_CRITERIA.forEach((c) => {
      expect(FIXED_CRITERION_SCORES[c.id]).toHaveLength(METHODS.length);
    });
  });

  it("nao tem celula vazia — todo valor e numero finito", () => {
    FIXED_CRITERIA.forEach((c) => {
      FIXED_CRITERION_SCORES[c.id].forEach((v) => {
        expect(Number.isFinite(v)).toBe(true);
      });
    });
  });

  it("le por codigo de metodo, nao por posicao (planilha lista SQS antes de TS)", () => {
    // A planilha de origem tem TS na ultima linha e SQS na penultima; METHODS
    // tem o inverso. Este teste morre se alguem recopiar a tabela sem reordenar.
    expect(fixedScore("comparativeCosts", "SQS")).toBe(100);
    expect(fixedScore("comparativeCosts", "TS")).toBe(70);
    expect(fixedScore("recovery", "SQS")).toBe(5);
    expect(fixedScore("productivity", "TS")).toBe(2);
  });

  it("reproduz a linha do Open Pit como na planilha", () => {
    expect(fixedScore("capitalInvestment", "OP")).toBe(4);
    expect(fixedScore("comparativeCosts",  "OP")).toBe(10);
    expect(fixedScore("performance",       "OP")).toBe(3);
    expect(fixedScore("productivity",      "OP")).toBe(4);
    expect(fixedScore("recovery",          "OP")).toBe(4);
    expect(fixedScore("dilution",          "OP")).toBe(3);
  });

  it("custos comparativos vivem numa escala nativa propria (10-100)", () => {
    // Justifica a normalizacao vetorial do TOPSIS: esta coluna e uma ordem de
    // grandeza maior que as outras cinco.
    const custos = FIXED_CRITERION_SCORES.comparativeCosts;
    expect(Math.min(...custos)).toBe(10);
    expect(Math.max(...custos)).toBe(100);

    const outras = FIXED_CRITERIA
      .filter((c) => c.id !== "comparativeCosts")
      .flatMap((c) => [...FIXED_CRITERION_SCORES[c.id]]);
    expect(Math.max(...outras)).toBeLessThanOrEqual(5);
  });

  it("rejeita criterio ou metodo desconhecido", () => {
    expect(() => fixedScore("naoExiste", "OP")).toThrow(/critério fixo desconhecido/);
    expect(() => fixedScore("recovery", "XX")).toThrow(/método de lavra desconhecido/);
  });
});

describe("pendencia do Top Slicing", () => {
  it("desempenho de TS vem da constante de estimativa, nao de um literal solto", () => {
    expect(fixedScore("performance", "TS")).toBe(TS_PERFORMANCE_ESTIMATED);
  });

  it("esta declarada como pendente de confirmacao do Francisco", () => {
    // Fixa o contrato de que a pendencia e legivel por maquina: a UI e a
    // exportacao conseguem marcar a celula sem ninguem lembrar de cabeca.
    expect(PENDING_CONFIRMATION).toHaveLength(1);
    expect(PENDING_CONFIRMATION[0]).toMatchObject({
      criterionId: "performance",
      method:      "TS",
      value:       TS_PERFORMANCE_ESTIMATED,
    });
    expect(PENDING_CONFIRMATION[0].reason).toMatch(/não confirmad/i);
  });
});

describe("fixedCriteriaMatrix", () => {
  it("monta 10 linhas na ordem de METHODS e 6 colunas na ordem de FIXED_CRITERIA", () => {
    const m = fixedCriteriaMatrix();
    expect(m).toHaveLength(METHODS.length);
    m.forEach((row) => expect(row).toHaveLength(FIXED_CRITERIA.length));

    const ts = m[METHODS.indexOf("TS")];
    expect(ts).toEqual([TS_PERFORMANCE_ESTIMATED, 2, 4, 4, 2, 70]);
  });

  it("e pura — chamadas sucessivas nao compartilham arrays", () => {
    const a = fixedCriteriaMatrix();
    const b = fixedCriteriaMatrix();
    expect(a).toEqual(b);
    a[0][0] = 999;
    expect(fixedCriteriaMatrix()[0][0]).not.toBe(999);
  });
});
