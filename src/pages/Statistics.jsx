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
  { key: "ubc",        label: "UBC 1995",      color: "#1e3a5f" },
  { key: "nicholas81", label: "Nicholas 1981", color: "#1d6fa4" },
  { key: "nicholas92", label: "Nicholas 1992", color: "#2596be" },
  { key: "shb",        label: "SH&B 2007",     color: "#5bc0de" },
];

const colors = {
  primary:    "#1e3a5f",
  border:     "#d1d5db",
  text:       "#111827",
  background: "#ffffff",
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
  const barData    = [...METHODS].map((m) => ({ method: m, score: result.scores[m] })).sort((a, b) => b.score - a.score);
  const bestMethod = barData[0]?.method;
  const normalized = normalizeScores(result.scores);
  const radarData  = METHODS.map((m) => ({ method: METHOD_LABELS[m] || m, value: normalized[m] }));

  return (
    <div style={{ marginTop: "28px" }}>
      {/* Título do método */}
      <div style={{ borderLeft: `4px solid ${sm.color}`, paddingLeft: "12px", marginBottom: "16px" }}>
        <h3 style={{ margin: 0, color: sm.color }}>{sm.label}</h3>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>

        {/* GRÁFICO DE BARRAS */}
        <div style={{ border: `1px solid ${colors.border}`, padding: "16px", borderRadius: "6px" }}>
          <h4 style={{ marginTop: 0, fontSize: "13px", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Comparação</h4>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="method" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => v.toFixed(1)} labelFormatter={(l) => METHOD_LABELS[l] || l} />
              <Bar dataKey="score">
                {barData.map((entry) => (
                  <Cell key={entry.method} fill={entry.method === bestMethod ? sm.color : "#cbd5e1"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* RADAR */}
        <div style={{ border: `1px solid ${colors.border}`, padding: "16px", borderRadius: "6px" }}>
          <h4 style={{ marginTop: 0, fontSize: "13px", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Radar (normalizado)</h4>
          <ResponsiveContainer width="100%" height={260}>
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
              style={{
                padding: "8px 6px",
                borderRadius: "4px",
                backgroundColor: m === bestMethod ? sm.color : "#f1f5f9",
                color: m === bestMethod ? "#fff" : colors.text,
                textAlign: "center",
                fontSize: "12px",
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

  const [filters, setFilters] = useState({ ubc: true, nicholas81: true, nicholas92: true, shb: true });

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
    <div style={{ maxWidth: "1400px", width: "95%", margin: "0 auto", padding: "20px", backgroundColor: colors.background, color: colors.text }}>

      {/* HEADER */}
      <div style={{ background: colors.primary, color: "#fff", padding: "12px 20px", borderRadius: "6px", textAlign: "center" }}>
        <h2 style={{ margin: 0 }}>SELEÇÃO DE MÉTODOS DE LAVRA</h2>
      </div>

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

      {/* BOTÃO VOLTAR */}
      <div style={{ marginTop: "32px", textAlign: "center" }}>
        <button
          onClick={() => navigate("/inputs")}
          style={{ padding: "10px 28px", backgroundColor: "#f1f5f9", border: `1px solid ${colors.border}`, borderRadius: "6px", cursor: "pointer", fontSize: "14px" }}
        >
          ← Voltar para Inputs
        </button>
      </div>
    </div>
  );
}

export default Statistics;
