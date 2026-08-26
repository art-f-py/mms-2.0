import { Fragment, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMms } from "../context/MmsContext";
import { ENFOQUE_GROUP_IDS, groupOfCriterion } from "../algorithms/enfoque";
import { CRITERION_GROUPS, FIXED_CRITERIA_BY_ID } from "../algorithms/mcdmCriteria";
import { MCDM_PENDING_METHODS } from "../algorithms/mcdmPipeline";
import { deriveMcdmRanking, MCDM_STATUS } from "../utils/mcdmRanking";

// ---------------------------------------------------------------------------
// BLOCO MCDM — ENFOQUE (PESO POR GRUPO) + TOPSIS, SÓ NICHOLAS
// ---------------------------------------------------------------------------
// Conteúdo da aba "Decisão multicritério" de /statistics. O ranking daqui é
// DERIVADO a cada render a partir do formulário e dos pesos de grupo — nunca
// passa por state.results, que segue com os três slots fixos (ubc/nicholas/shb)
// dos métodos clássicos e não foi tocado.
//
// A consequência boa disso é que mexer num slider atualiza o ranking na hora,
// sem "recalcular": não há resultado congelado a invalidar. O useMemo existe
// para o pipeline não rodar de novo a cada render que não mudou nem o
// formulário nem os pesos.

// Tokens semânticos → variáveis CSS centralizadas em index.css.
// Mesmo conjunto que Statistics.jsx usa, para o bloco não destoar dos vizinhos.
const colors = {
  primary:   "var(--color-primary)",
  primary50: "var(--color-primary-50)",
  border:    "var(--color-border)",
  text:      "var(--color-text)",
  muted:     "var(--color-muted)",
  bg:        "var(--color-bg)",
  white:     "var(--color-white)",
};

// Uma cor por grupo de critérios. Os tokens são novos e vivem em index.css
// junto dos demais --color-* — ver lá o porquê de terem virado matizes próprios
// em vez de quatro opacidades da primária, que era a versão anterior.
//
// Chaveado por CRITERION_GROUPS, e não pelas strings soltas: se um id de grupo
// mudar lá na camada de algoritmo, isto quebra no import em vez de devolver
// `undefined` e pintar quatro segmentos transparentes.
const GROUP_COLORS = {
  [CRITERION_GROUPS.GEOMETRY]:     "var(--color-mcdm-geometry)",
  [CRITERION_GROUPS.GEOMECHANICS]: "var(--color-mcdm-geomechanics)",
  [CRITERION_GROUPS.TECHNICAL]:    "var(--color-mcdm-technical)",
  [CRITERION_GROUPS.ECONOMIC]:     "var(--color-mcdm-economic)",
};

const panelStyle = {
  border:       `1px solid ${colors.border}`,
  padding:      "16px",
  borderRadius: "6px",
};

// Mesmo cabeçalho de painel dos blocos clássicos (Statistics.jsx), com a cor
// vindo do token em vez do hex inline de lá.
const panelTitleStyle = {
  marginTop:     0,
  fontSize:      "13px",
  color:         colors.muted,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

// ---------------------------------------------------------------------------
// BARRA DE PROPORÇÃO
// ---------------------------------------------------------------------------
// Quatro segmentos com flexGrow igual ao peso e flexBasis 0: a largura de cada
// um é exatamente a fração que ele representa, porque os pesos somam 1. Peso
// zero vira segmento de largura zero e desaparece sozinho, sem caso especial.
function ProportionBar({ groups }) {
  return (
    <div style={{ display: "flex", width: "100%", height: "20px", borderRadius: "4px", overflow: "hidden", border: `1px solid ${colors.border}` }}>
      {groups.map(({ id, label, value, color }) => (
        <div
          key={id}
          title={`${label} — ${(value * 100).toFixed(0)}%`}
          style={{ flexGrow: value, flexBasis: 0, minWidth: 0, backgroundColor: color }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SLIDER DE GRUPO
// ---------------------------------------------------------------------------
// Adaptação local do WeightSlider de Inputs.jsx — cópia deliberada, não
// descuido. Aquele é 0–2 com neutro em 1 (multiplicador de tabela); este é 0–1
// somando 1 entre os quatro (repartição), e traz o quadradinho na cor do grupo
// que o liga ao segmento da barra e à borda da linha na matriz de decisão.
// Extrair um componente comum obrigaria a mexer em Inputs.jsx, fora do escopo;
// se um terceiro tipo de slider aparecer, aí a extração se paga.
function GroupSlider({ label, value, color, onChange }) {
  return (
    <div>
      <label style={{ fontSize: "14px", fontWeight: "600", color: colors.text, marginBottom: "6px", display: "flex", alignItems: "center", gap: "8px" }}>
        <span
          aria-hidden="true"
          style={{ width: "12px", height: "12px", borderRadius: "3px", flexShrink: 0, backgroundColor: color }}
        />
        <span>{label}</span>
        <span style={{ color: colors.primary, fontWeight: "700" }}>{value.toFixed(2)}</span>
      </label>
      <input
        type="range" min={0} max={1} step="0.01"
        style={{ width: "100%", accentColor: color }}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ACORDEÃO
// ---------------------------------------------------------------------------
// Mesmo padrão (e mesmo visual) do Collapsible de Inputs.jsx, reescrito aqui
// pelo mesmo motivo do GroupSlider: aquele é local do Inputs e não é exportado.
//
// `{open && children}` em vez de esconder por CSS não é detalhe: com o acordeão
// fechado a tabela de 19×12 não existe no DOM, então arrastar um slider não
// paga nada por ela. É o que dispensa qualquer debounce no caso comum.
function Collapsible({ title, open, onToggle, children }) {
  return (
    <div style={{ border: `1px solid ${colors.border}`, borderRadius: "8px", marginTop: "12px", overflow: "hidden" }}>
      <button
        onClick={onToggle}
        aria-expanded={open}
        style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", minHeight: "44px", backgroundColor: colors.primary50, border: "none", cursor: "pointer", fontSize: "15px", fontWeight: "700", color: colors.primary }}
      >
        <span>{title}</span>
        <span style={{ fontSize: "13px" }} aria-hidden="true">{open ? "▾" : "▸"}</span>
      </button>
      {open && <div style={{ padding: "18px" }}>{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MATRIZ DE DECISÃO AO VIVO
// ---------------------------------------------------------------------------
// A matriz que o TOPSIS de fato leu: 19 critérios em linha, 10 métodos de lavra
// em coluna, mais a coluna de peso.
//
// DUAS VELOCIDADES DIFERENTES NA MESMA TABELA, e isso é fácil de ler errado.
// A coluna PESO muda ao vivo a cada slider: ela é `weights`, a repartição do
// Enfoque. As células de método × critério NÃO mudam com os sliders — são
// `sheet.values`, os scores das tabelas do Nicholas (já convertidos para Saaty)
// e dos seis critérios fixos, e só o FORMULÁRIO os altera. É a distinção entre
// "quanto este critério importa" (peso, escolha do usuário) e "quanto este
// método pontua neste critério" (dado da publicação). Quem espera a célula
// acompanhar o slider vai achar que a tabela travou; ela não travou.
//
// As linhas saem reordenadas por grupo, na ordem de ENFOQUE_GROUP_IDS — que não
// é a ordem das colunas na aba (lá os 13 clássicos vêm primeiro, os 6 fixos
// depois, e Técnico/Economia ficam misturados no fim). O índice `j` original é
// carregado junto para que peso e células continuem vindo da coluna certa.
function DecisionMatrixTable({ sheet, weights, criterionIds }) {
  const { t } = useTranslation();

  // Rótulo do critério. Os 13 clássicos já têm chave em results.criteria (a
  // mesma que o radar de breakdown dos blocos clássicos usa); os 6 fixos são
  // novos e entram em results.mcdm.fixedCriteria. O rótulo de exportação da
  // própria aba (inglês) fica como último recurso — se aparecer na tela, é
  // sinal de critério novo sem chave, não de tradução pendente.
  const criterionLabel = (id, fallback) =>
    id in FIXED_CRITERIA_BY_ID
      ? t(`results.mcdm.fixedCriteria.${id}`, fallback)
      : t(`results.criteria.${id}`, fallback);

  // Inteiro sai sem casas (a escala de Saaty e os critérios técnicos são
  // inteiros); o resto com duas, para o índice de custo não virar um número
  // redondo que ele não é.
  const cell = (v) =>
    typeof v !== "number" || Number.isNaN(v) ? "—" : Number.isInteger(v) ? String(v) : v.toFixed(2);

  // Nenhum critério pode ficar de fora: resolveWeights (enfoque.js) já teria
  // lançado antes daqui se algum não pertencesse a grupo nenhum, então este
  // agrupamento cobre necessariamente as 19 colunas.
  const grupos = ENFOQUE_GROUP_IDS.map((groupId) => ({
    groupId,
    color:   GROUP_COLORS[groupId],
    label:   t(`results.mcdm.groups.${groupId}`),
    indices: criterionIds.reduce((acc, id, j) => (groupOfCriterion(id) === groupId ? [...acc, j] : acc), []),
  }));

  const th = { padding: "6px 8px", borderBottom: `2px solid ${colors.border}`, fontSize: "11px", color: colors.muted, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap", textAlign: "right" };
  const td = { padding: "5px 8px", borderBottom: `1px solid ${colors.border}`, textAlign: "right", whiteSpace: "nowrap" };

  return (
    // A tabela é larga por natureza (12 colunas). Rola dentro do próprio
    // contêiner para que a página não ganhe rolagem horizontal.
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", fontSize: "12px", color: colors.text, minWidth: "100%" }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: "left" }}>{t("results.mcdm.matrix.criterion")}</th>
            <th style={th}>{t("results.mcdm.matrix.weight")}</th>
            {/* Mesmo rótulo dos cartões de ranking — os dois vêm de
                `sheet.rows[].method`, então não há como divergirem. */}
            {sheet.rows.map((row) => (
              <th key={row.code} style={th} title={row.method}>{row.method}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grupos.map(({ groupId, color, label, indices }) => (
            <Fragment key={groupId}>
              <tr>
                <td
                  colSpan={2 + sheet.rows.length}
                  style={{ padding: "10px 8px 4px", borderLeft: `4px solid ${color}`, fontSize: "12px", fontWeight: "700", color, textTransform: "uppercase", letterSpacing: "0.04em" }}
                >
                  {label}
                </td>
              </tr>
              {indices.map((j) => (
                <tr key={criterionIds[j]}>
                  <th
                    scope="row"
                    style={{ ...td, textAlign: "left", fontWeight: "500", borderLeft: `4px solid ${color}`, paddingLeft: "12px" }}
                  >
                    {criterionLabel(criterionIds[j], sheet.columns[j])}
                  </th>
                  {/* A única coluna que responde aos sliders. */}
                  <td style={{ ...td, color: colors.primary, fontWeight: "700", fontVariantNumeric: "tabular-nums" }}>
                    {weights[j].toFixed(4)}
                  </td>
                  {sheet.rows.map((row) => (
                    <td key={row.code} style={{ ...td, fontVariantNumeric: "tabular-nums" }}>
                      {cell(row.values[j])}
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ---------------------------------------------------------------------------
export default function McdmBlock() {
  const { t } = useTranslation();
  const { state, dispatch } = useMms();

  const [matrixOpen, setMatrixOpen] = useState(false);

  const groupWeights = state.formData.criteriaWeights.mcdm.groupWeights;

  // Só reroda o pipeline quando o formulário ou os pesos mudam. Sem isto, cada
  // render de /statistics (um toggle de pill, por exemplo) refaria matriz,
  // conversão de Saaty e TOPSIS à toa.
  const derived = useMemo(
    () => deriveMcdmRanking(state.formData, groupWeights),
    [state.formData, groupWeights],
  );

  // Ordem, rótulo e cor de cada grupo — ENFOQUE_GROUP_IDS é a ordem canônica em
  // que a UI deve apresentá-los (ver ENFOQUE_GROUPS em algorithms/enfoque.js), e
  // é a mesma ordem em que a matriz de decisão agrupa as linhas.
  //
  // Os rótulos vêm do i18n, e NÃO de CRITERION_GROUP_LABELS. São dois públicos:
  // aquela constante serve a camada de algoritmo e ao arquivo exportado, este
  // texto serve a tela e um dia será traduzido. Mesmo texto hoje, ciclos de
  // vida diferentes — juntar os dois obrigaria a traduzir o que vai para o
  // .xlsx ou a congelar a tela em português.
  const groups = ENFOQUE_GROUP_IDS.map((id) => ({
    id,
    label: t(`results.mcdm.groups.${id}`),
    value: groupWeights[id],
    color: GROUP_COLORS[id],
  }));

  const setGroupWeight = (group, value) =>
    dispatch({ type: "SET_MCDM_GROUP_WEIGHT", group, value });

  const ok = derived.status === MCDM_STATUS.OK;

  return (
    <div style={{ marginTop: "28px" }}>
      {/* Título do bloco — mesma faixa lateral dos blocos por método */}
      <div style={{ borderLeft: `4px solid ${colors.primary}`, paddingLeft: "12px", marginBottom: "16px" }}>
        <h3 style={{ margin: 0, color: colors.primary }}>{t("results.mcdm.title")}</h3>
        <p style={{ margin: "4px 0 0", color: colors.muted, fontSize: "14px" }}>
          {t("results.mcdm.subtitle")}
        </p>
      </div>

      {/* PESOS POR GRUPO — barra de proporção + os quatro sliders */}
      <div style={panelStyle}>
        <h4 style={panelTitleStyle}>{t("results.mcdm.weightsTitle")}</h4>
        <p style={{ fontSize: "13px", color: colors.muted, margin: "0 0 14px" }}>
          {t("results.mcdm.weightsHint")}
        </p>

        <p style={{ ...panelTitleStyle, fontSize: "11px", marginBottom: "6px" }}>
          {t("results.mcdm.proportionTitle")}
        </p>
        <ProportionBar groups={groups} />

        <div className="mms-grid2" style={{ marginTop: "18px" }}>
          {groups.map(({ id, label, value, color }) => (
            <GroupSlider
              key={id}
              label={label}
              value={value}
              color={color}
              onChange={(v) => setGroupWeight(id, v)}
            />
          ))}
        </div>
      </div>

      {/* RANKING — mesmo grid de cartões dos blocos clássicos, com a
          proximidade em 3 casas: os valores de TOPSIS costumam se separar na
          terceira, e 1 casa (como nos scores clássicos) empataria a metade da
          lista na tela sem empate nenhum no cálculo. */}
      <div style={{ ...panelStyle, marginTop: "12px" }}>
        <h4 style={panelTitleStyle}>{t("results.ranking")}</h4>

        {ok ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "6px" }}>
              {derived.result.ranking.map((entry) => {
                const first = entry.rank === 1;
                return (
                  <div
                    key={entry.code}
                    style={{
                      padding:         "8px 6px",
                      borderRadius:    "4px",
                      backgroundColor: first ? colors.primary : colors.bg,
                      color:           first ? colors.white : colors.text,
                      border:          `1px solid ${first ? colors.primary : colors.border}`,
                      textAlign:       "center",
                      fontSize:        "12px",
                      minHeight:       "44px",
                      display:         "flex",
                      flexDirection:   "column",
                      justifyContent:  "center",
                    }}
                  >
                    <div style={{ fontWeight: "700" }}>{t("results.rank", { n: entry.rank })}</div>
                    <div style={{ fontWeight: "600" }}>{entry.label}</div>
                    <div style={{ opacity: 0.8 }}>{entry.closeness.toFixed(3)}</div>
                  </div>
                );
              })}
            </div>
            <p style={{ fontSize: "13px", color: colors.muted, margin: "12px 0 0" }}>
              {t("results.mcdm.closenessHint")}
            </p>
          </>
        ) : (
          <p style={{ fontSize: "14px", color: colors.muted, margin: 0 }}>
            {t("results.mcdm.unavailable")}
          </p>
        )}
      </div>

      {/* MATRIZ DE DECISÃO — fechada por padrão. É a mesma `sheet` que o motor
          leu, já estendida com os seis critérios fixos e já convertida para
          Saaty; nada é recalculado para exibi-la. */}
      {ok && (
        <Collapsible
          title={t("results.mcdm.matrix.title")}
          open={matrixOpen}
          onToggle={() => setMatrixOpen((o) => !o)}
        >
          <p style={{ fontSize: "13px", color: colors.muted, margin: "0 0 14px" }}>
            {t("results.mcdm.matrix.hint")}
          </p>
          <DecisionMatrixTable
            sheet={derived.result.sheet}
            weights={derived.result.weights}
            criterionIds={derived.result.criterionIds}
          />
        </Collapsible>
      )}

      {/* MÉTODOS AINDA FORA DO PIPELINE — quais são vem de MCDM_PENDING_METHODS
          (fonte única, em mcdmPipeline.js), mas o TEXTO do motivo vem do i18n.
          O `reason` da constante é português cru, escrito para a mensagem de
          exceção e nomeando de quem a pendência depende — não é frase de tela
          nem passa pelo sistema de tradução. */}
      <div style={{ ...panelStyle, marginTop: "12px", backgroundColor: colors.primary50, borderStyle: "dashed" }}>
        <h4 style={panelTitleStyle}>{t("results.mcdm.pendingTitle")}</h4>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
          {Object.entries(MCDM_PENDING_METHODS).map(([key, { label }]) => (
            <span
              key={key}
              style={{
                padding:         "4px 12px",
                borderRadius:    "20px",
                border:          `1px dashed ${colors.border}`,
                backgroundColor: colors.white,
                color:           colors.muted,
                fontSize:        "13px",
                fontWeight:      "600",
              }}
            >
              {label}
            </span>
          ))}
        </div>
        <p style={{ fontSize: "13px", color: colors.muted, margin: 0 }}>
          {t("results.mcdm.pendingReason")}
        </p>
      </div>
    </div>
  );
}
