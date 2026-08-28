import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMms } from "../context/MmsContext";
import { METHODS, METHOD_LABELS } from "../algorithms/ubcWeights";
import { normalizeScores } from "../algorithms/algorithms";
import McdmBlock from "../components/McdmBlock";
import Pill from "../components/Pill";
import ScenarioComparison from "../components/ScenarioComparison";
import { availableMcdmMethods, safeMcdmMethod } from "../utils/mcdmMethods";
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";

// ---------------------------------------------------------------------------
// PALETA — tons de azul coerentes
// ---------------------------------------------------------------------------
const SELECTION_METHODS = [
  { key: "ubc",      label: "UBC 1995",           color: "#1e3a5f" },
  { key: "nicholas", label: "Nicholas 1981/1992",  color: "#1d6fa4" },
  { key: "shb",      label: "SH&B 2007",           color: "#5bc0de" },
];

// Tokens semânticos → variáveis CSS centralizadas em index.css
const colors = {
  primary:    "var(--color-primary)",
  // `primary50` é o fundo esmaecido da sub-aba ativa; `muted` já era usado por
  // tabButtonStyle abaixo sem estar declarado aqui — o `color` saía `undefined`
  // e herdava, em vez do cinza de apoio que o estilo pedia. Mesmos tokens que
  // McdmBlock.jsx usa, para as duas telas não divergirem de paleta.
  primary50:  "var(--color-primary-50)",
  border:     "var(--color-border)",
  text:       "var(--color-text)",
  muted:      "var(--color-muted)",
  background: "var(--color-bg-card)",
};

// ---------------------------------------------------------------------------
// BLOCO DE RESULTADO (barra + ranking + radar) por método
// ---------------------------------------------------------------------------
function MethodBlock({ sm, result }) {
  const { t } = useTranslation();
  const [selectedMethod, setSelectedMethod] = useState(null);

  const barData   = [...METHODS].map((m) => ({ method: m, score: result.scores[m] })).sort((a, b) => b.score - a.score);
  const normalized = normalizeScores(result.scores);
  const radarData  = METHODS.map((m) => ({ method: METHOD_LABELS[m] || m, value: normalized[m] }));

  const breakdownRadarData = selectedMethod
    ? Object.entries(result.breakdown).map(([key, scores]) => ({
        criteria: t(`results.criteria.${key.split("__")[0]}`, key.split("__")[0]),
        value: scores[selectedMethod] ?? 0,
      }))
    : [];

  const handleCardClick = (m) => setSelectedMethod((prev) => (prev === m ? null : m));

  return (
    <div style={{ marginTop: "28px" }}>
      {/* Título do método */}
      <div style={{ borderLeft: `4px solid ${sm.color}`, paddingLeft: "12px", marginBottom: "16px" }}>
        <h3 style={{ margin: 0, color: sm.color }}>{sm.label}</h3>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: "20px" }}>

        {/* GRÁFICO DE BARRAS — sempre visível, nunca substituído */}
        <div style={{ border: `1px solid ${colors.border}`, padding: "16px", borderRadius: "6px" }}>
          <h4 style={{ marginTop: 0, fontSize: "13px", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("results.comparison")}</h4>
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={barData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="method" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => v.toFixed(1)} labelFormatter={(l) => METHOD_LABELS[l] || l} />
              <Bar dataKey="score">
                {barData.map((entry) => (
                  <Cell
                    key={entry.method}
                    fill={sm.color}
                    fillOpacity={selectedMethod === null || entry.method === selectedMethod ? 1 : 0.35}
                    stroke={entry.method === selectedMethod ? "#0f172a" : "none"}
                    strokeWidth={entry.method === selectedMethod ? 2 : 0}
                    cursor="pointer"
                    onClick={() => handleCardClick(entry.method)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* RADAR NORMALIZADO por padrão; vira BREAKDOWN ao selecionar um método */}
        <div style={{ border: `1px solid ${colors.border}`, padding: "16px", borderRadius: "6px" }}>
          {selectedMethod === null ? (
            <>
              <h4 style={{ marginTop: 0, fontSize: "13px", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("results.radarNormalized")}</h4>
              <ResponsiveContainer width="100%" height={340}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="method" tick={{ fontSize: 9 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
                  <Radar name={sm.label} dataKey="value" stroke={sm.color} fill={sm.color} fillOpacity={0.25} />
                  <Tooltip formatter={(v) => `${v}`} />
                </RadarChart>
              </ResponsiveContainer>
            </>
          ) : (
            <>
              <h4 style={{ marginTop: 0, fontSize: "13px", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {t("results.breakdown", { method: METHOD_LABELS[selectedMethod] || selectedMethod })}
              </h4>
              <ResponsiveContainer width="100%" height={340}>
                <RadarChart data={breakdownRadarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="criteria" tick={{ fontSize: 9 }} />
                  <PolarRadiusAxis tick={{ fontSize: 9 }} />
                  <Radar name={METHOD_LABELS[selectedMethod] || selectedMethod} dataKey="value" stroke={sm.color} fill={sm.color} fillOpacity={0.3} />
                  <Tooltip formatter={(v) => v.toFixed(1)} />
                </RadarChart>
              </ResponsiveContainer>
            </>
          )}
        </div>
      </div>

      {/* RANKING */}
      <div style={{ border: `1px solid ${colors.border}`, padding: "16px", marginTop: "12px", borderRadius: "6px" }}>
        <h4 style={{ marginTop: 0, fontSize: "13px", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("results.ranking")}</h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: "6px" }}>
          {result.ranking.map((m, i) => (
            <div
              key={m}
              onClick={() => handleCardClick(m)}
              style={{
                padding: "8px 6px",
                borderRadius: "4px",
                backgroundColor: m === selectedMethod ? sm.color : "#f1f5f9",
                color: m === selectedMethod ? "#fff" : colors.text,
                textAlign: "center",
                fontSize: "12px",
                cursor: "pointer",
                minHeight: "44px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <div style={{ fontWeight: "700" }}>{t("results.rank", { n: i + 1 })}</div>
              <div style={{ fontWeight: "600" }}>{METHOD_LABELS[m] || m}</div>
              <div style={{ opacity: 0.8 }}>{result.scores[m].toFixed(1)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ABAS — CLÁSSICO x MULTICRITÉRIO
// ---------------------------------------------------------------------------
// Duas visões alternáveis, não duas seções empilhadas: os blocos clássicos e o
// bloco MCDM respondem à mesma pergunta por caminhos diferentes, e vê-los
// juntos numa rolagem só convida a comparar ranking com ranking como se fossem
// a mesma escala (score de tabela x proximidade de TOPSIS, que não são).
const VIEWS = { CLASSIC: "classic", MCDM: "mcdm" };

// Sub-navegação DENTRO da aba multicritério. "Comparar cenários" era uma aba de
// topo irmã do bloco MCDM e desceu para cá: as duas visões partilham o método de
// seleção e os pesos, e lê-las como irmãs da aba clássica sugeria três assuntos
// independentes quando são dois — os resultados de tabela, e o multicritério
// visto de dois ângulos.
const MCDM_SUBVIEWS = { WEIGHTS: "weights", SCENARIOS: "scenarios" };

// Mesmo botão-aba do seletor domínio/critério do Nicholas (Inputs.jsx), com o
// S.btnGhost de lá reescrito aqui — aquele objeto de estilo é local do Inputs e
// não é exportado.
const tabButtonStyle = (on) => ({
  padding:         "6px 14px",
  minHeight:       "44px",
  borderRadius:    "6px",
  fontSize:        "13px",
  cursor:          "pointer",
  backgroundColor: on ? colors.primary : "transparent",
  color:           on ? "var(--color-white)" : colors.muted,
  border:          `1px solid ${on ? colors.primary : colors.border}`,
  fontWeight:      on ? "700" : "400",
});

// Sub-aba: o MESMO botão-aba, deliberadamente menor e mais leve. A hierarquia
// precisa ser visível sem legenda — se as duas fileiras tivessem o mesmo peso,
// voltaríamos ao problema que o item de cima resolve, com o usuário sem saber
// qual escolha manda na outra. Fundo esmaecido em vez de sólido, e altura de
// toque menor (36px, ainda confortável) contra os 44px da fileira de topo.
const subTabButtonStyle = (on) => ({
  padding:         "4px 12px",
  minHeight:       "36px",
  borderRadius:    "6px",
  fontSize:        "12px",
  cursor:          "pointer",
  backgroundColor: on ? colors.primary50 : "transparent",
  color:           on ? colors.primary : colors.muted,
  border:          `1px solid ${on ? colors.primary : colors.border}`,
  fontWeight:      on ? "700" : "400",
});

// ---------------------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ---------------------------------------------------------------------------
function Statistics() {
  const { t } = useTranslation();
  const { state } = useMms();
  const navigate  = useNavigate();

  const [filters, setFilters] = useState({ ubc: true, nicholas: true, shb: true });
  const [view, setView]       = useState(VIEWS.CLASSIC);
  // Método de seleção em foco na aba MCDM, compartilhado pelas DUAS sub-visões:
  // pesos/ranking/matriz e comparação de cenários mudam juntos ao trocá-lo.
  //
  // CONTINUA AQUI DEPOIS DE AS DUAS VIRAREM SUB-VISÕES DA MESMA ABA. O motivo
  // original — eram abas irmãs, e um useState em McdmBlock não alcançaria
  // ScenarioComparison — deixou de valer, e descer o estado para um componente
  // que agrupasse as duas passou a ser possível. Não desceu porque a troca sai
  // pior: esta página fica montada o tempo todo, enquanto um agrupador montaria
  // só com a aba MCDM aberta, e a escolha de método (e a de sub-visão) se
  // perderia a cada ida e volta pela aba clássica. Manter aqui preserva um
  // comportamento já verificado, sem nenhum ganho perdido — os dois estados
  // continuam privados desta página e descem só como prop.
  //
  // Começa em `null`, não numa chave: qual método está disponível depende dos
  // filtros e dos resultados calculados, que só se sabe abaixo. `null` significa
  // "o usuário ainda não escolheu", e safeMcdmMethod traduz isso no primeiro
  // disponível.
  const [mcdmMethod, setMcdmMethod] = useState(null);
  // Qual das duas visões multicritério está aberta. FICA AQUI, e não dentro de
  // um componente que agrupasse as duas, pela mesma razão que `mcdmMethod`
  // ficou: esta página segue montada ao trocar de aba, e um wrapper montado só
  // enquanto a aba MCDM está aberta perderia a escolha ao passar pela aba
  // clássica e voltar. Ver a nota sobre isso logo abaixo do return.
  const [mcdmView, setMcdmView] = useState(MCDM_SUBVIEWS.WEIGHTS);

  const toggleFilter = (key) => setFilters((prev) => ({ ...prev, [key]: !prev[key] }));

  const hasAnyResult = SELECTION_METHODS.some((m) => state.results[m.key]);

  if (!hasAnyResult) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <p>{t("results.noResult")}</p>
        <button
          onClick={() => navigate("/inputs")}
          style={{ marginTop: "16px", padding: "10px 24px", minHeight: "44px", cursor: "pointer", backgroundColor: colors.primary, color: "#fff", border: "none", borderRadius: "6px" }}
        >
          {t("results.goToInputs")}
        </button>
      </div>
    );
  }

  const activeMethods = SELECTION_METHODS.filter(
    (m) => filters[m.key] && state.results[m.key]
  );

  // Os métodos ativos que o pipeline multicritério aceita, e o que a aba de
  // fato usa depois de clampar a escolha do usuário no que sobrou disponível.
  // As duas regras são funções puras testáveis em utils/mcdmMethods.js.
  const mcdmAvailable = availableMcdmMethods(activeMethods);
  const safeMethod    = safeMcdmMethod(mcdmMethod, mcdmAvailable);

  // A aba MCDM SOME quando NENHUM método suportado está ativo — não fica
  // desabilitada. Aba morta que o usuário não tem como usar só ocupa espaço
  // explicando uma indisponibilidade que as pills logo acima já explicam.
  const showMcdmTab = mcdmAvailable.length > 0;

  // Desligar a pill do último método suportado enquanto a aba MCDM está aberta
  // tiraria a aba debaixo da visão atual. Clampa em vez de corrigir por efeito
  // colateral — mesma solução do `safeStep` do stepper em Inputs.jsx (e do
  // safeMethod acima), pelo mesmo motivo: um useState que só se conserta depois
  // do render mostraria um quadro vazio no meio do caminho.
  // Uma aba só depende do pipeline agora — a comparação de cenários virou
  // sub-visão dela e é clampada junto, de graça.
  const safeView = view === VIEWS.MCDM && !showMcdmTab ? VIEWS.CLASSIC : view;

  return (
    <div style={{ backgroundColor: "var(--color-bg)", minHeight: "100vh", padding: "32px clamp(12px, 4vw, 24px) 180px" }}>
      <div style={{ maxWidth: "1400px", margin: "0 auto", width: "100%", color: colors.text }}>

      <div style={{ marginBottom: "8px" }}>
        <h2 style={{ margin: "0 0 4px", color: "var(--color-text)", fontSize: "24px" }}>{t("results.title")}</h2>
        <p style={{ margin: 0, color: "var(--color-muted)", fontSize: "16px" }}>{t("results.subtitle")}</p>
      </div>

      {/* PILLS DE FILTRO — SÓ NA ABA CLÁSSICA.
          Elas ligam e desligam os métodos que os blocos clássicos mostram, e é
          lá que a ação é imediata e visível. Na aba multicritério o efeito
          delas é indireto (mexem em quais métodos o seletor de método OFERECE)
          e ficavam a um palmo do seletor, duas fileiras parecidas com
          semânticas diferentes — a mesma confusão que o seletor em radio
          resolve pelo outro lado.

          O ESTADO NÃO É RESETADO, só o controle sai da tela: `filters` continua
          valendo, `activeMethods` continua saindo dele, e voltar para a aba
          clássica reencontra exatamente os filtros de antes. Esconder o
          controle e zerar a escolha seriam coisas bem diferentes; esta é a
          primeira. */}
      {safeView === VIEWS.CLASSIC && (
        <div style={{ marginTop: "20px", display: "flex", gap: "24px", flexWrap: "wrap" }}>
          {SELECTION_METHODS.filter((m) => state.results[m.key]).map((m) => (
            <Pill
              key={m.key}
              label={m.label}
              color={m.color}
              active={filters[m.key]}
              onClick={() => toggleFilter(m.key)}
            />
          ))}
        </div>
      )}

      {activeMethods.length === 0 && (
        <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>
          {t("results.activateOne")}
        </div>
      )}

      {/* ABAS DE TOPO — DUAS. Só aparecem quando há uma segunda visão para
          onde ir: a do MCDM depende de haver ao menos um método suportado entre
          os ativos (ver MCDM_SUPPORTED_METHODS em algorithms/mcdmPipeline.js);
          qual deles ela usa é o seletor de método lá dentro. */}
      {showMcdmTab && activeMethods.length > 0 && (
        <div style={{ marginTop: "20px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {[
            [VIEWS.CLASSIC, t("results.mcdm.tabs.classic")],
            [VIEWS.MCDM,    t("results.mcdm.tabs.mcdm")],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setView(id)}
              aria-pressed={safeView === id}
              style={tabButtonStyle(safeView === id)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* CONTEÚDO DA ABA ATIVA.
          A visão inativa é DESMONTADA, não esmaecida. O Inputs.jsx usa os dois
          padrões: esmaecer no seletor domínio/critério do Nicholas, onde os
          dois lados são controles irmãos que vale a pena continuar vendo, e
          desmontar no stepper, onde cada etapa é uma tela inteira. Aqui são
          telas inteiras — três gráficos esmaecidos ao lado da matriz MCDM não
          informariam nada. Desmontar também evita o problema conhecido do
          ResponsiveContainer do recharts, que mede zero dentro de um contêiner
          escondido e volta desenhado errado.

          Efeito colateral aceito: o método destacado dentro de um MethodBlock
          (o breakdown do radar) volta ao estado neutro ao trocar de aba e
          voltar. Dentro da aba clássica nada mudou. */}
      {safeView === VIEWS.CLASSIC &&
        activeMethods.map((sm) => (
          <MethodBlock key={sm.key} sm={sm} result={state.results[sm.key]} />
        ))}

      {safeView === VIEWS.MCDM && (
        <>
          {/* SUB-ABAS — subordinadas à fileira de cima, e visivelmente menores
              (ver subTabButtonStyle). Ficam ACIMA do conteúdo das duas visões,
              e não dentro de McdmBlock, porque governam as duas: enfiá-las
              dentro de uma delas faria o controle sumir ao escolher a outra. */}
          <div style={{ marginTop: "16px", marginLeft: "12px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {[
              [MCDM_SUBVIEWS.WEIGHTS,   t("results.mcdm.tabs.weights")],
              [MCDM_SUBVIEWS.SCENARIOS, t("results.mcdm.tabs.scenarios")],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setMcdmView(id)}
                aria-pressed={mcdmView === id}
                style={subTabButtonStyle(mcdmView === id)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* O MESMO `safeMethod` nas duas: é o que faz trocar o método numa
              reordenar a outra, em vez de a comparação ficar presa a um método
              enquanto o ranking mostra outro.

              O seletor de método vive dentro de McdmBlock e some junto com ele
              na sub-visão de cenários. É intencional: a comparação é uma leitura
              da repartição de pesos que a outra sub-visão monta, e trocar o
              método é uma decisão que se toma lá, ao lado dos sliders que ele
              afeta. Quem quiser trocar volta uma sub-aba — o mesmo caminho que
              já faz para mexer nos pesos que a tabela compara. */}
          {mcdmView === MCDM_SUBVIEWS.WEIGHTS && (
            <McdmBlock
              method={safeMethod}
              available={mcdmAvailable}
              onMethodChange={setMcdmMethod}
            />
          )}

          {mcdmView === MCDM_SUBVIEWS.SCENARIOS && <ScenarioComparison method={safeMethod} />}
        </>
      )}

      {/* BOTÃO VOLTAR — fixo na tela */}
      <button
        onClick={() => navigate("/inputs")}
        style={{ position: "fixed", bottom: "clamp(12px, 4vw, 24px)", left: "clamp(12px, 4vw, 24px)", color: "var(--color-primary)", padding: "10px clamp(16px, 5vw, 28px)", minHeight: "44px", backgroundColor: "#f1f5f9", border: `1px solid ${colors.border}`, borderRadius: "6px", cursor: "pointer", fontSize: "14px", boxShadow: "0 2px 8px rgba(0,0,0,0.15)", zIndex: 100 }}
      >
        {t("results.backToInputs")}
      </button>
      </div>
    </div>
  );
}

export default Statistics;
