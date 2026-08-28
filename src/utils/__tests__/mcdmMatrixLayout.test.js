import { describe, it, expect } from "vitest";
import { buildMatrixColumns, buildOriginSpans } from "../mcdmMatrixLayout";
import { ENFOQUE_GROUP_IDS, groupOfCriterion } from "../../algorithms/enfoque";
import { CRITERION_GROUPS, FIXED_CRITERIA } from "../../algorithms/mcdmCriteria";
import { CLASSIC_CRITERIA } from "../../algorithms/classicCriteria";

// ---------------------------------------------------------------------------
// ORDENAÇÃO DAS COLUNAS DA MATRIZ DE DECISÃO
// ---------------------------------------------------------------------------
// O contrato: reagrupar SEM perder e SEM trocar nada de lugar. O `index` que
// cada coluna carrega é o que a tela usa para buscar o peso e as células, então
// um índice errado aqui não quebra nada visivelmente — só mostra o dado da
// coluna vizinha, que é o pior tipo de defeito nesta tabela.

const { GEOMETRY, GEOMECHANICS, TECHNICAL, ECONOMIC } = CRITERION_GROUPS;

// Os 19 critérios na ordem em que o pipeline os produz: 13 clássicos e depois
// os 6 fixos. É essa ordem — com Técnico e Economia misturados no fim — que a
// função existe para desfazer.
const IDS_19 = [...CLASSIC_CRITERIA.map((c) => c.id), ...FIXED_CRITERIA.map((c) => c.id)];

describe("agrupamento das 19 colunas reais", () => {
  it("não perde nem inventa coluna", () => {
    const { columns } = buildMatrixColumns(IDS_19);
    expect(columns).toHaveLength(IDS_19.length);
    expect([...columns].map((c) => c.id).sort()).toEqual([...IDS_19].sort());
  });

  it("cada coluna aponta para o índice que ela ocupa na aba original", () => {
    const { columns } = buildMatrixColumns(IDS_19);
    for (const { index, id } of columns) {
      expect(IDS_19[index]).toBe(id);
    }
  });

  it("os índices são únicos — nenhuma coluna é lida duas vezes", () => {
    const { columns } = buildMatrixColumns(IDS_19);
    expect(new Set(columns.map((c) => c.index)).size).toBe(IDS_19.length);
  });

  it("sai na ordem canônica dos grupos", () => {
    const { groups } = buildMatrixColumns(IDS_19);
    expect(groups.map((g) => g.groupId)).toEqual([...ENFOQUE_GROUP_IDS]);
  });

  it("os spans somam o total de colunas", () => {
    const { columns, groups } = buildMatrixColumns(IDS_19);
    expect(groups.reduce((acc, g) => acc + g.span, 0)).toBe(columns.length);
  });

  it("os spans batem com o tamanho real de cada grupo", () => {
    const { groups } = buildMatrixColumns(IDS_19);
    for (const { groupId, span } of groups) {
      const esperado = IDS_19.filter((id) => groupOfCriterion(id) === groupId).length;
      expect(span).toBe(esperado);
    }
  });

  it("as colunas de um grupo saem contíguas, na fatia que o span descreve", () => {
    // É o que permite a linha de cabeçalho usar colSpan: se as colunas de um
    // grupo não fossem contíguas, o colSpan cobriria coluna de outro grupo.
    const { columns, groups } = buildMatrixColumns(IDS_19);
    let cursor = 0;
    for (const { groupId, span } of groups) {
      const fatia = columns.slice(cursor, cursor + span);
      expect(fatia.every((c) => c.groupId === groupId)).toBe(true);
      cursor += span;
    }
    expect(cursor).toBe(columns.length);
  });

  it("Geometria vem primeiro e Economia por último", () => {
    const { columns } = buildMatrixColumns(IDS_19);
    expect(columns[0].groupId).toBe(GEOMETRY);
    expect(columns[columns.length - 1].groupId).toBe(ECONOMIC);
  });

  it("reagrupa de fato — os critérios fixos deixam de estar todos no fim", () => {
    // Na aba, capitalInvestment/comparativeCosts (Economia) vêm depois dos
    // técnicos. Reagrupado, os técnicos ficam antes e a Economia fecha.
    const { columns } = buildMatrixColumns(IDS_19);
    const posicao = (id) => columns.findIndex((c) => c.id === id);
    expect(posicao("dilution")).toBeLessThan(posicao("capitalInvestment"));
    expect(posicao("shape")).toBeLessThan(posicao("rss_ob"));
  });

  it("não muta a lista recebida", () => {
    const entrada = [...IDS_19];
    buildMatrixColumns(entrada);
    expect(entrada).toEqual(IDS_19);
  });
});

describe("casos de borda", () => {
  it("lista vazia devolve nada, sem grupo fantasma", () => {
    expect(buildMatrixColumns([])).toEqual({ columns: [], groups: [] });
  });

  it("sem argumento devolve nada", () => {
    expect(buildMatrixColumns()).toEqual({ columns: [], groups: [] });
  });

  it("grupo sem nenhum critério não vira colSpan zero", () => {
    const { groups } = buildMatrixColumns(["shape", "thickness"]);
    expect(groups).toEqual([{ groupId: GEOMETRY, span: 2 }]);
  });

  it("critério sem grupo NÃO é descartado — vai para um bloco final", () => {
    const { columns, groups } = buildMatrixColumns(["shape", "criterioInventado", "dilution"]);
    expect(columns).toHaveLength(3);
    expect(columns.map((c) => c.id)).toContain("criterioInventado");
    expect(groups[groups.length - 1]).toEqual({ groupId: null, span: 1 });
  });

  it("o critério sem grupo mantém o índice original", () => {
    const { columns } = buildMatrixColumns(["shape", "criterioInventado", "dilution"]);
    const orfao = columns.find((c) => c.id === "criterioInventado");
    expect(orfao.index).toBe(1);
    expect(orfao.groupId).toBeNull();
  });

  it("só critérios sem grupo ainda produz uma tabela renderizável", () => {
    const { columns, groups } = buildMatrixColumns(["a", "b"]);
    expect(columns).toHaveLength(2);
    expect(groups).toEqual([{ groupId: null, span: 2 }]);
  });

  it("um único critério por grupo produz quatro blocos de span 1", () => {
    const um = { [GEOMETRY]: "shape", [GEOMECHANICS]: "rss_ob", [TECHNICAL]: "dilution", [ECONOMIC]: "comparativeCosts" };
    const { groups } = buildMatrixColumns(ENFOQUE_GROUP_IDS.map((g) => um[g]));
    expect(groups).toEqual(ENFOQUE_GROUP_IDS.map((groupId) => ({ groupId, span: 1 })));
  });
});

// ---------------------------------------------------------------------------
// FAIXAS DE ORIGEM — CLÁSSICOS x OS SEIS DO FRANCISCO
// ---------------------------------------------------------------------------
// A linha de cabeçalho que diz de onde cada bloco de colunas veio. O contrato é
// o mesmo de `groups`: faixas contíguas, na ordem de exibição, cada uma virando
// um colSpan.

describe("buildOriginSpans", () => {
  const colunasDe = (ids) => buildMatrixColumns(ids).columns;

  it("separa as colunas em duas faixas: clássicas primeiro, fixas depois", () => {
    // Os spans saem de CLASSIC_CRITERIA/FIXED_CRITERIA, e não de números
    // escritos à mão: CLASSIC_CRITERIA já cresceu de 13 para 17 quando o UBC
    // entrou, e um literal aqui teria virado dívida na mesma hora.
    expect(buildOriginSpans(colunasDe(IDS_19))).toEqual([
      { fixed: false, span: CLASSIC_CRITERIA.length },
      { fixed: true,  span: FIXED_CRITERIA.length },
    ]);
  });

  it("os spans somam exatamente o número de colunas — nenhuma fica sem cobertura", () => {
    // Se somassem menos, o cabeçalho deixaria colunas órfãs à direita; se
    // somassem mais, o colSpan estouraria a tabela. As duas falhas são visuais
    // e silenciosas, daí a asserção explícita.
    const colunas = colunasDe(IDS_19);
    const total = buildOriginSpans(colunas).reduce((a, f) => a + f.span, 0);
    expect(total).toBe(colunas.length);
  });

  it("classifica como fixo exatamente os seis do Francisco, e ninguém mais", () => {
    const colunas = colunasDe(IDS_19);
    const faixas  = buildOriginSpans(colunas);

    // Reconstrói a marcação coluna a coluna a partir das faixas e confere
    // contra FIXED_CRITERIA — a fonte única de quem é fixo.
    const marcados = [];
    let i = 0;
    for (const { fixed, span } of faixas) {
      for (let n = 0; n < span; n++) marcados.push({ id: colunas[i++].id, fixed });
    }
    const idsFixos = new Set(FIXED_CRITERIA.map((c) => c.id));
    for (const { id, fixed } of marcados) expect(fixed).toBe(idsFixos.has(id));
  });

  it("funciona igual na matriz do UBC, que tem outras colunas clássicas", () => {
    // 11 clássicas + 6 fixas. O número muda com o método; a separação não.
    const idsUbc = ["shape", "thickness", "dip", "grade", "depth",
                    "rss_ob", "rmr_ob", "rss_hw", "rmr_hw", "rss_fw", "rmr_fw",
                    ...FIXED_CRITERIA.map((c) => c.id)];
    expect(buildOriginSpans(colunasDe(idsUbc))).toEqual([
      { fixed: false, span: 11 },
      { fixed: true,  span: 6 },
    ]);
  });

  it("só fixos, ou só clássicos, dá uma faixa só", () => {
    expect(buildOriginSpans(colunasDe(FIXED_CRITERIA.map((c) => c.id))))
      .toEqual([{ fixed: true, span: 6 }]);
    expect(buildOriginSpans(colunasDe(["shape", "thickness"])))
      .toEqual([{ fixed: false, span: 2 }]);
  });

  it("origens intercaladas viram mais faixas, em vez de uma marcação errada", () => {
    // O caso que o cálculo protege: se um critério fixo passasse a cair num
    // grupo cercado de clássicos, o colSpan chumbado de "dois últimos grupos"
    // cobriria a coluna errada em silêncio. Aqui saem três faixas honestas.
    // (Não é o layout de hoje — é a garantia de que a função não presume.)
    const colunas = [
      { index: 0, id: "shape",       groupId: GEOMETRY },
      { index: 1, id: "performance", groupId: TECHNICAL },
      { index: 2, id: "dip",         groupId: GEOMETRY },
    ];
    expect(buildOriginSpans(colunas)).toEqual([
      { fixed: false, span: 1 },
      { fixed: true,  span: 1 },
      { fixed: false, span: 1 },
    ]);
  });

  it("sem colunas devolve lista vazia, e sem lançar", () => {
    expect(buildOriginSpans([])).toEqual([]);
    expect(buildOriginSpans()).toEqual([]);
  });
});
