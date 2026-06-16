import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMms } from "../context/MmsContext";
import { METHODS, METHOD_LABELS } from "../algorithms/ubcWeights";
import { normalizeScores } from "../algorithms/algorithms";
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

const colors = {
  primary:    "#1e3a5f",
  border:     "#d1d5db",
  text:       "#111827",
  background: "#ffffff",
};

const CRITERIA_LABELS = {
  shape:          "Forma",
  thickness:      "Espessura",
  dip:            "Mergulho",
  grade:          "Teor",
  depth:          "Profundidade",
  rss:            "RSS",
  rmr:            "RMR",
  jointSpacing:   "Espaç. Juntas",
  jointCondition: "Cond. Juntas",
  oreValue:       "Valor Minério",
};

// ---------------------------------------------------------------------------
// PILL
// ---------------------------------------------------------------------------
function Pill({ label, color, active, onClick }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <span style={{ fontSize: "14px", fontWeight: "500" }}>{label}</span>
      <div
        onClick={onClick}
        style={{ width: "50px", height: "26px", borderRadius: "20px", backgroundColor: active ? color : "#d1d5db", position: "relative", cursor: "pointer", transition: "background-color 0.3s" }}
      >
        <div style={{ width: "22px", height: "22px", borderRadius: "50%", backgroundColor: "#fff", position: "absolute", top: "2px", left: active ? "26px" : "2px", transition: "left 0.3s" }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BLOCO DE RESULTADO (barra + ranking + radar) por método
// ---------------------------------------------------------------------------
function MethodBlock({ sm, result }) {
  const [selectedMethod, setSelectedMethod] = useState(null);

  const barData   = [...METHODS].map((m) => ({ method: m, score: result.scores[m] })).sort((a, b) => b.score - a.score);
  const normalized = normalizeScores(result.scores);
  const radarData  = METHODS.map((m) => ({ method: METHOD_LABELS[m] || m, value: normalized[m] }));

  const breakdownRadarData = selectedMethod
    ? Object.entries(result.breakdown).map(([key, scores]) => ({
        criteria: CRITERIA_LABELS[key.split("__")[0]] || key.split("__")[0],
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>

        {/* GRÁFICO DE BARRAS / RADAR DE BREAKDOWN */}
        <div style={{ border: `1px solid ${colors.border}`, padding: "16px", borderRadius: "6px" }}>
          {selectedMethod === null ? (
            <>
              <h4 style={{ marginTop: 0, fontSize: "13px", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Comparação</h4>
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={barData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="method" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => v.toFixed(1)} labelFormatter={(l) => METHOD_LABELS[l] || l} />
                  <Bar dataKey="score" fill={sm.color} />
                </BarChart>
              </ResponsiveContainer>
            </>
          ) : (
            <>
              <h4 style={{ marginTop: 0, fontSize: "13px", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Breakdown — {METHOD_LABELS[selectedMethod] || selectedMethod}
              </h4>
              <ResponsiveContainer width="100%" height={380}>
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

        {/* RADAR NORMALIZADO */}
        <div style={{ border: `1px solid ${colors.border}`, padding: "16px", borderRadius: "6px" }}>
          <h4 style={{ marginTop: 0, fontSize: "13px", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Radar (normalizado)</h4>
          <ResponsiveContainer width="100%" height={340}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="method" tick={{ fontSize: 9 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
              <Radar name={sm.label} dataKey="value" stroke={sm.color} fill={sm.color} fillOpacity={0.25} />
              <Tooltip formatter={(v) => `${v}`} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* RANKING */}
      <div style={{ border: `1px solid ${colors.border}`, padding: "16px", marginTop: "12px", borderRadius: "6px" }}>
        <h4 style={{ marginTop: 0, fontSize: "13px", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Ranking</h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "6px" }}>
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
              }}
            >
              <div style={{ fontWeight: "700" }}>{i + 1}º</div>
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
// COMPONENTE PRINCIPAL
// ---------------------------------------------------------------------------
function Statistics() {
  const { state } = useMms();
  const navigate  = useNavigate();

  const [filters, setFilters] = useState({ ubc: true, nicholas: true, shb: true });

  const toggleFilter = (key) => setFilters((prev) => ({ ...prev, [key]: !prev[key] }));

  const hasAnyResult = SELECTION_METHODS.some((m) => state.results[m.key]);

  if (!hasAnyResult) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <p>Nenhum resultado calculado ainda.</p>
        <button
          onClick={() => navigate("/inputs")}
          style={{ marginTop: "16px", padding: "10px 24px", cursor: "pointer", backgroundColor: colors.primary, color: "#fff", border: "none", borderRadius: "6px" }}
        >
          Ir para Inputs
        </button>
      </div>
    );
  }

  const activeMethods = SELECTION_METHODS.filter(
    (m) => filters[m.key] && state.results[m.key]
  );

  return (
    <div style={{ backgroundColor: "#ffffff", minHeight: "100vh", padding: "32px 24px" }}>
      <div style={{ maxWidth: "1400px", margin: "0 auto", width: "100%", color: colors.text }}>

      {/* PILLS */}
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

      {activeMethods.length === 0 && (
        <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>
          Ative pelo menos um método para visualizar os resultados.
        </div>
      )}

      {/* BLOCOS POR MÉTODO */}
      {activeMethods.map((sm) => (
        <MethodBlock key={sm.key} sm={sm} result={state.results[sm.key]} />
      ))}

      {/* BOTÃO VOLTAR — fixo na tela */}
      <button
        onClick={() => navigate("/inputs")}
        style={{ position: "fixed", bottom: "24px", left: "24px", color: "#1e3a5f", padding: "10px 28px", backgroundColor: "#f1f5f9", border: `1px solid ${colors.border}`, borderRadius: "6px", cursor: "pointer", fontSize: "14px", boxShadow: "0 2px 8px rgba(0,0,0,0.15)", zIndex: 100 }}
      >
        ← Voltar para Inputs
      </button>
      </div>
    </div>
  );
}

export default Statistics;
