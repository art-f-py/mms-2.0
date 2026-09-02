import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// ESTRUTURA DE ABAS E SELETOR DE MÉTODO — REGRESSÃO DE FONTE
// ---------------------------------------------------------------------------
// Três mudanças de tela que não têm como ser cobertas por renderização (o
// projeto roda em `environment: 'node'`, sem Testing Library — ver o comentário
// no topo de mcdmNoBestHighlight.test.js, que segue o mesmo padrão):
//
//   1. os pills de FILTRO só aparecem na aba clássica
//   2. o seletor de método é <input type="radio">, não mais uma fileira de pills
//   5. "Comparar cenários" virou SUB-visão da aba multicritério
//
// O QUE ESTE ARQUIVO PROVA, E O QUE NÃO PROVA. Ele lê o fonte e confere que os
// mecanismos estão escritos como se decidiu. Não prova que a tela renderiza
// certo — prova que ninguém desfez a estrutura sem perceber, que é o mais forte
// que se consegue sem infraestrutura de componente. Se um dia houver Testing
// Library, estes casos devem virar testes de renderização de verdade.

const leia = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const STATISTICS = leia("../../pages/Statistics.jsx");
const MCDM_BLOCK = leia("../McdmBlock.jsx");

// ---------------------------------------------------------------------------
// ITEM 1 — PILLS DE FILTRO SÓ NA ABA CLÁSSICA
// ---------------------------------------------------------------------------
describe("pills de filtro fora da aba multicritério", () => {
  it("o bloco de <Pill> está condicionado à visão clássica", () => {
    // A condição precisa envolver o map de SELECTION_METHODS que monta os
    // pills. Sem ela, os pills voltam a aparecer nas duas abas.
    const trecho = STATISTICS.slice(
      STATISTICS.indexOf("PILLS DE FILTRO"),
      STATISTICS.indexOf("activeMethods.length === 0"),
    );
    expect(trecho).toMatch(/safeView === VIEWS\.CLASSIC && \(/);
    expect(trecho).toMatch(/<Pill/);
  });

  it("o ESTADO do filtro não é resetado ao trocar de aba", () => {
    // Esconder o controle e zerar a escolha seriam coisas diferentes; esta
    // mudança é a primeira. `setFilters` só pode ser chamado de um lugar — o
    // toggle da própria pill —, então aparece exatamente duas vezes no arquivo:
    // a desestruturação do useState e a chamada dentro de toggleFilter.
    const ocorrencias = STATISTICS.match(/setFilters/g) ?? [];
    expect(ocorrencias).toHaveLength(2);
    expect(STATISTICS).toMatch(/const toggleFilter = \(key\) => setFilters\(/);

    // E `filters` segue sendo a única fonte de activeMethods, com ou sem os
    // pills na tela.
    expect(STATISTICS).toMatch(/const activeMethods = SELECTION_METHODS\.filter\(\s*\(m\) => filters\[m\.key\]/);
  });
});

// ---------------------------------------------------------------------------
// ITEM 2 — SELETOR DE MÉTODO EM RADIO NATIVO
// ---------------------------------------------------------------------------
describe("seletor de método é radio nativo", () => {
  it("usa <input type=\"radio\"> com name compartilhado", () => {
    expect(MCDM_BLOCK).toMatch(/type="radio"/);
    // O `name` é o que garante exclusividade — é ele que faz o navegador
    // desmarcar o irmão. Sem name compartilhado, dois radios podem ficar
    // marcados ao mesmo tempo.
    expect(MCDM_BLOCK).toMatch(/name="mcdm-metodo"/);
  });

  it("o marcado é o método atual, e trocar dispara onMethodChange", () => {
    expect(MCDM_BLOCK).toMatch(/checked=\{sm\.key === method\}/);
    expect(MCDM_BLOCK).toMatch(/onChange=\{\(\) => onMethodChange\?\.\(sm\.key\)\}/);
  });

  it("cada bolinha tem <label> associada por htmlFor", () => {
    expect(MCDM_BLOCK).toMatch(/htmlFor=\{id\}/);
  });

  it("o radiogroup manual saiu — a semântica agora é nativa", () => {
    // Só o ATRIBUTO importa: a palavra ainda aparece no comentário que explica
    // por que ele saiu, e um teste que casasse com isso proibiria documentar a
    // decisão. Aqui se procura a forma JSX, `role={"} radiogroup{"}`.
    expect(MCDM_BLOCK).not.toMatch(/role=["'{]\s*["']?radiogroup/);
    expect(MCDM_BLOCK).toMatch(/<fieldset/);
    expect(MCDM_BLOCK).toMatch(/<legend/);
  });

  it("continua condicionado a mais de um método disponível", () => {
    // Regressão do comportamento já verificado: com um método só, nada aparece.
    expect(MCDM_BLOCK).toMatch(/\{available\.length > 1 && \(/);
  });

  it("McdmBlock não importa mais o componente Pill", () => {
    expect(MCDM_BLOCK).not.toMatch(/from "\.\/Pill"/);
  });
});

// ---------------------------------------------------------------------------
// ITEM 5 — CENÁRIOS COMO SUB-VISÃO
// ---------------------------------------------------------------------------
describe("comparar cenários é sub-visão da aba multicritério", () => {
  it("VIEWS tem duas abas de topo, sem SCENARIOS", () => {
    const views = STATISTICS.match(/const VIEWS = \{[^}]*\}/)[0];
    expect(views).toMatch(/CLASSIC/);
    expect(views).toMatch(/MCDM/);
    expect(views).not.toMatch(/SCENARIOS/);
  });

  it("a sub-navegação tem as duas visões, com pesos como padrão", () => {
    expect(STATISTICS).toMatch(/const MCDM_SUBVIEWS = \{[^}]*WEIGHTS[^}]*SCENARIOS[^}]*\}/);
    expect(STATISTICS).toMatch(/useState\(MCDM_SUBVIEWS\.WEIGHTS\)/);
  });

  it("as duas sub-visões vivem dentro da aba MCDM, não ao lado dela", () => {
    // ScenarioComparison só pode ser renderizado sob mcdmView — se voltasse a
    // depender de `safeView`, seria de novo uma aba irmã.
    expect(STATISTICS).toMatch(/mcdmView === MCDM_SUBVIEWS\.SCENARIOS && <ScenarioComparison/);
    expect(STATISTICS).not.toMatch(/safeView === VIEWS\.SCENARIOS/);
  });

  it("só o bloco MCDM recebe o método em foco; a comparação não recebe método", () => {
    // Era o contrário: as duas liam `safeMethod`, porque o cenário era
    // method-agnóstico e a tabela o reaplicava contra o método da tela. Com o
    // método DENTRO de cada cenário, passar um método aqui voltaria a prender
    // todas as colunas ao mesmo — que é exatamente o que a mudança desfez.
    const abaMcdm = STATISTICS.slice(STATISTICS.indexOf("safeView === VIEWS.MCDM &&"));
    expect(abaMcdm).toMatch(/<McdmBlock[\s\S]{0,200}method=\{safeMethod\}/);
    expect(abaMcdm).toMatch(/<ScenarioComparison \/>/);
    expect(abaMcdm).not.toMatch(/<ScenarioComparison[^/>]*method=/);
  });

  it("o estado do método e da sub-visão fica na página, que não desmonta", () => {
    // Se descessem para um componente montado só com a aba MCDM aberta, a
    // escolha se perderia ao passar pela aba clássica e voltar.
    expect(STATISTICS).toMatch(/const \[mcdmMethod, setMcdmMethod\] = useState\(null\)/);
    expect(STATISTICS).toMatch(/const \[mcdmView, setMcdmView\] = useState\(/);
  });

  it("a sub-aba tem estilo próprio, subordinado ao da aba de topo", () => {
    expect(STATISTICS).toMatch(/const subTabButtonStyle = \(on\) =>/);
    expect(STATISTICS).toMatch(/style=\{subTabButtonStyle\(mcdmView === id\)\}/);
  });
});
