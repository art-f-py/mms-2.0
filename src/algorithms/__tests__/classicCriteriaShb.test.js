import { describe, it, expect } from "vitest";
import { CLASSIC_CRITERIA } from "../classicCriteria";
import { CRITERION_GROUPS, FIXED_CRITERIA } from "../mcdmCriteria";
import { groupOfCriterion, ENFOQUE_GROUPS_BY_ID } from "../enfoque";

// ---------------------------------------------------------------------------
// COBERTURA DE GRUPO DOS 12 CRITÉRIOS CLÁSSICOS DO SH&B
// ---------------------------------------------------------------------------
// O SH&B trouxe um único id novo para CLASSIC_CRITERIA — `oreValue` —, e os
// outros onze vieram de graça do Nicholas e do UBC. "De graça" é a afirmação
// que este arquivo VERIFICA em vez de presumir: um id que resolvesse para o
// grupo errado repartiria peso na família errada, e o ranking sairia plausível
// e torto, sem nenhum erro no caminho.

// Os 12, na ordem em que calculateSHB monta as colunas (algorithms.js).
const CLASSICOS_SHB = [
  "shape", "thickness", "dip", "grade", "depth", "oreValue",
  "rss_ob", "rmr_ob", "rss_hw", "rmr_hw", "rss_fw", "rmr_fw",
];

const { GEOMETRY, GEOMECHANICS, TECHNICAL, ECONOMIC } = CRITERION_GROUPS;

describe("os 12 clássicos do SH&B estão todos declarados", () => {
  it("cada um resolve para exatamente um grupo — nenhum órfão", () => {
    for (const id of CLASSICOS_SHB) {
      expect(groupOfCriterion(id)).toBeDefined();
    }
  });

  it("cada um aparece UMA vez só em CLASSIC_CRITERIA — sem sobreposição", () => {
    for (const id of CLASSICOS_SHB) {
      expect(CLASSIC_CRITERIA.filter((c) => c.id === id)).toHaveLength(1);
    }
  });

  it("a distribuição é 5 Geometria / 6 Geomecânica / 1 Economia", () => {
    const conta = (g) => CLASSICOS_SHB.filter((id) => groupOfCriterion(id) === g).length;

    expect(conta(GEOMETRY)).toBe(5);
    expect(conta(GEOMECHANICS)).toBe(6);
    expect(conta(ECONOMIC)).toBe(1);
    // Nenhum critério clássico do SH&B é técnico-operacional: aquele grupo
    // segue sendo só os quatro fixos do Francisco.
    expect(conta(TECHNICAL)).toBe(0);
    expect(conta(GEOMETRY) + conta(GEOMECHANICS) + conta(ECONOMIC)).toBe(CLASSICOS_SHB.length);
  });

  it("os grupos são os esperados, id a id", () => {
    // Explícito de propósito: as contagens acima fechariam mesmo com dois ids
    // trocados entre si dentro do mesmo grupo.
    expect(CLASSICOS_SHB.map(groupOfCriterion)).toEqual([
      GEOMETRY, GEOMETRY, GEOMETRY, GEOMETRY, GEOMETRY,  // shape..depth
      ECONOMIC,                                          // oreValue
      GEOMECHANICS, GEOMECHANICS, GEOMECHANICS,          // rss/rmr ore body
      GEOMECHANICS, GEOMECHANICS, GEOMECHANICS,          // hanging wall, foot wall
    ]);
  });

  it("onze dos doze já vinham de Nicholas/UBC — só oreValue é novo", () => {
    // A afirmação do cabeçalho de classicCriteria.js, conferida contra a ordem
    // da tabela: `oreValue` é a última entrada, acrescentada com o SH&B.
    expect(CLASSIC_CRITERIA[CLASSIC_CRITERIA.length - 1].id).toBe("oreValue");
    const anteriores = CLASSIC_CRITERIA.slice(0, -1).map((c) => c.id);
    const novosDoShb = CLASSICOS_SHB.filter((id) => !anteriores.includes(id));
    expect(novosDoShb).toEqual(["oreValue"]);
  });
});

describe("Economia depois do SH&B", () => {
  it("passa a ter três critérios: oreValue mais os dois fixos", () => {
    expect(ENFOQUE_GROUPS_BY_ID[ECONOMIC].criterionIds)
      .toEqual(["oreValue", "capitalInvestment", "comparativeCosts"]);
  });

  it("oreValue é CLÁSSICO, não um sétimo critério fixo", () => {
    // A distinção importa para a matriz na tela: os fixos passam intactos pela
    // conversão de escala, os clássicos não. Confundir os dois faria o
    // oreValue do SH&B atravessar sem converter.
    const idsFixos = FIXED_CRITERIA.map((c) => c.id);
    expect(idsFixos).not.toContain("oreValue");
    expect(idsFixos).toHaveLength(6);
    expect(CLASSIC_CRITERIA.map((c) => c.id)).toContain("oreValue");
  });
});

describe("contagens de coluna não viram número mágico", () => {
  it("os totais por método são derivados, não escritos na lógica", () => {
    // 19 (Nicholas), 17 (UBC) e 18 (SH&B) aparecem em teste e em comentário,
    // que é onde devem estar. Este caso existe para registrar que os três
    // números são DIFERENTES — qualquer contagem fixa embutida na lógica geral
    // do pipeline acertaria no máximo um método e falharia nos outros dois.
    const totalShb = CLASSICOS_SHB.length + FIXED_CRITERIA.length;
    expect(totalShb).toBe(18);
    expect(new Set([19, 17, totalShb]).size).toBe(3);
  });
});
