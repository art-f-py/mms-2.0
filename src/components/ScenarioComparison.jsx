import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useMms } from "../context/MmsContext";
import { MCDM_STATUS } from "../utils/mcdmRanking";
import { buildScenarioComparisonTable } from "../utils/scenarioComparison";

// ---------------------------------------------------------------------------
// COMPARAR CENÁRIOS
// ---------------------------------------------------------------------------
// Aba "Comparar cenários" de /statistics: uma coluna por repartição de pesos
// salva, uma linha por método de lavra, e em cada célula a colocação daquele
// método sob aqueles pesos.
//
// A pergunta que esta tela responde é a que um ranking sozinho não responde:
// "esta colocação é robusta ou é artefato dos pesos que escolhi?". Um método
// que fica em 1º em todos os cenários salvos é uma resposta; um que salta de 1º
// para 7º quando a economia ganha peso é outra, e é a mais útil das duas.
//
// TODA A LÓGICA ESTÁ EM buildScenarioComparisonTable — este arquivo só desenha.
// A separação não é estética: o projeto não tem infraestrutura de teste de
// componente React (vite.config.js roda em `environment: 'node'`, sem Testing
// Library), então o que ficar aqui dentro não é testável. Ver o mesmo raciocínio
// no topo de mcdmRanking.js e de mcdmMatrixLayout.js.

const colors = {
  primary:   "var(--color-primary)",
  primary50: "var(--color-primary-50)",
  border:    "var(--color-border)",
  text:      "var(--color-text)",
  muted:     "var(--color-muted)",
  bg:        "var(--color-bg)",
  white:     "var(--color-white)",
};

const panelStyle = {
  border:       `1px solid ${colors.border}`,
  padding:      "16px",
  borderRadius: "6px",
};

const panelTitleStyle = {
  marginTop:     0,
  fontSize:      "13px",
  color:         colors.muted,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const METHOD_COL_WIDTH   = 150;
const SCENARIO_COL_WIDTH = 130;

const baseCell = {
  padding:      "6px 8px",
  borderBottom: `1px solid ${colors.border}`,
  whiteSpace:   "nowrap",
};

// Mesma coluna de método fixada na rolagem da matriz de decisão, pelo mesmo
// motivo e com as mesmas duas condições (fundo opaco e border-collapse
// separate) — ver o comentário de stickyMethod em McdmBlock.jsx.
const stickyMethod = {
  position:     "sticky",
  left:         0,
  zIndex:       1,
  width:        `${METHOD_COL_WIDTH}px`,
  minWidth:     `${METHOD_COL_WIDTH}px`,
  maxWidth:     `${METHOD_COL_WIDTH}px`,
  textAlign:    "left",
  borderRight:  `1px solid ${colors.border}`,
  overflow:     "hidden",
  textOverflow: "ellipsis",
  backgroundColor: colors.white,
};

export default function ScenarioComparison() {
  const { t } = useTranslation();
  const { state, dispatch } = useMms();

  const scenarios = state.mcdmScenarios;

  // Um pipeline TOPSIS por cenário — só quando o formulário ou a lista mudam.
  const table = useMemo(
    () => buildScenarioComparisonTable(scenarios, state.formData),
    [scenarios, state.formData],
  );

  const remove = (id) => dispatch({ type: "REMOVE_MCDM_SCENARIO", id });

  const header = (
    <div style={{ borderLeft: `4px solid ${colors.primary}`, paddingLeft: "12px", marginBottom: "16px" }}>
      <h3 style={{ margin: 0, color: colors.primary }}>{t("results.mcdm.scenarios.title")}</h3>
      <p style={{ margin: "4px 0 0", color: colors.muted, fontSize: "14px" }}>
        {t("results.mcdm.scenarios.subtitle")}
      </p>
    </div>
  );

  // ESTADO VAZIO EXPLICATIVO, e não uma tabela de dez linhas em branco. Sem
  // nenhum cenário salvo a tabela não tem nada a dizer, e quem chega aqui
  // primeiro precisa saber onde fica o botão de salvar — que está na outra aba.
  if (scenarios.length === 0) {
    return (
      <div style={{ marginTop: "28px" }}>
        {header}
        <div style={{ ...panelStyle, backgroundColor: colors.primary50, borderStyle: "dashed" }}>
          <h4 style={panelTitleStyle}>{t("results.mcdm.scenarios.emptyTitle")}</h4>
          <p style={{ fontSize: "14px", color: colors.muted, margin: 0 }}>
            {t("results.mcdm.scenarios.empty")}
          </p>
        </div>
      </div>
    );
  }

  // Indisponibilidade é do formData, então vale para a tabela inteira — nunca
  // para uma coluna só. Ver buildScenarioComparisonTable.
  if (table.status !== MCDM_STATUS.OK) {
    return (
      <div style={{ marginTop: "28px" }}>
        {header}
        <div style={panelStyle}>
          <p style={{ fontSize: "14px", color: colors.muted, margin: 0 }}>
            {t("results.mcdm.unavailable")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: "28px" }}>
      {header}

      <div style={panelStyle}>
        <p style={{ fontSize: "13px", color: colors.muted, margin: "0 0 14px" }}>
          {t("results.mcdm.scenarios.hint")}
        </p>

        {/* Rola dentro do próprio contêiner: com muitos cenários salvos a
            tabela fica larga, e a página não deve ganhar rolagem horizontal. */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "separate", borderSpacing: 0, fontSize: "12px", color: colors.text }}>
            <thead>
              <tr>
                <th style={{ ...baseCell, ...stickyMethod, borderBottom: `2px solid ${colors.border}`, fontSize: "11px", color: colors.muted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {t("results.mcdm.matrix.method")}
                </th>
                {table.scenarios.map((scenario) => (
                  <th
                    key={scenario.id}
                    title={scenario.name}
                    style={{ ...baseCell, width: `${SCENARIO_COL_WIDTH}px`, minWidth: `${SCENARIO_COL_WIDTH}px`, maxWidth: `${SCENARIO_COL_WIDTH}px`, textAlign: "center", borderBottom: `2px solid ${colors.border}` }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", justifyContent: "space-between" }}>
                      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", fontSize: "12px", fontWeight: "700" }}>
                        {scenario.name}
                      </span>
                      <button
                        onClick={() => remove(scenario.id)}
                        title={t("results.mcdm.scenarios.remove", { name: scenario.name })}
                        aria-label={t("results.mcdm.scenarios.remove", { name: scenario.name })}
                        style={{
                          flexShrink: 0, width: "22px", height: "22px", lineHeight: 1, padding: 0,
                          border: `1px solid ${colors.border}`, borderRadius: "4px",
                          backgroundColor: colors.white, color: colors.muted,
                          cursor: "pointer", fontSize: "12px",
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {table.rows.map((row) => (
                <tr key={row.code}>
                  <th
                    scope="row"
                    title={row.label}
                    style={{ ...baseCell, ...stickyMethod, fontWeight: "500", color: colors.text }}
                  >
                    {row.label}
                  </th>
                  {row.cells.map((cell) => (
                    <td
                      key={cell.scenarioId}
                      style={{
                        ...baseCell,
                        textAlign:          "center",
                        fontWeight:         "700",
                        fontVariantNumeric: "tabular-nums",
                        backgroundColor:    cell.color,
                        color:              colors.text,
                      }}
                    >
                      {/* MESMA chave i18n dos cartões de ranking, e não um "º"
                          escrito à mão aqui: assim a colocação sai com a mesma
                          forma nos dois lugares em cada idioma, em vez de duas
                          convenções que divergem na primeira tradução. */}
                      {t("results.rank", { n: cell.rank })}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
