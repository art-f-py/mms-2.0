import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMms } from "../context/MmsContext";
import { METHODS, METHOD_LABELS } from "../algorithms/ubcWeights";
import { normalizeScores } from "../algorithms/ubcAlgorithm";
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";

const colors = {
  primary:    "#2f3e4e",
  border:     "#000000",
  text:       "#000000",
  background: "#ffffff",
};

function Statistics() {
  const { state } = useMms();
  const navigate  = useNavigate();

  const [activeTab, setActiveTab] = useState("general");
  const [filters, setFilters]     = useState({ ubc: true, nicholas: true, shb: true });

  const toggleFilter = (key) =>
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));

  const ubcResult = state.results.ubc;

  // Fallback — sem resultados ainda
  if (!ubcResult) {
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

  // Dados para barra — todos os métodos, ordenados por score
  const barData = [...METHODS]
    .map((m) => ({ method: m, score: ubcResult.scores[m] }))
    .sort((a, b) => b.score - a.score);

  const bestMethod = barData[0]?.method;

  // Dados para radar — scores normalizados 0-100
  const normalized = normalizeScores(ubcResult.scores);
  const radarData  = METHODS.map((m) => ({
    method: METHOD_LABELS[m] || m,
    value:  normalized[m],
  }));

  return (
    <div style={{ maxWidth: "1400px", width: "95%", margin: "0 auto", padding: "20px", backgroundColor: colors.background, color: colors.text }}>

      {/* HEADER */}
      <div style={{ background: colors.primary, color: "#fff", padding: "10px", borderRadius: "6px", textAlign: "center" }}>
        <h2>SELEÇÃO DE MÉTODOS DE LAVRA</h2>
      </div>

      {/* PILLS */}
      <div style={{ marginTop: "20px", display: "flex", gap: "20px" }}>
        {["ubc", "nicholas", "shb"].map((key) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "14px" }}>{key.toUpperCase()}</span>
            <div
              onClick={() => toggleFilter(key)}
              style={{ width: "50px", height: "26px", borderRadius: "20px", backgroundColor: filters[key] ? colors.primary : "#ccc", position: "relative", cursor: "pointer", transition: "background-color 0.3s" }}
            >
              <div style={{ width: "22px", height: "22px", borderRadius: "50%", backgroundColor: "#fff", position: "absolute", top: "2px", left: filters[key] ? "26px" : "2px", transition: "left 0.3s" }} />
            </div>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
        {[["general", "Visão Geral"], ["radar", "Radar"]].map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{ padding: "10px 20px", border: `1px solid ${colors.border}`, backgroundColor: activeTab === tab ? colors.primary : "#fff", color: activeTab === tab ? "#fff" : colors.text, cursor: "pointer", borderRadius: "4px" }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ABA — VISÃO GERAL */}
      {activeTab === "general" && (
        <>
          {/* GRÁFICO DE BARRAS — ResponsiveContainer ocupa 100% da largura disponível */}
          {filters.ubc && (
            <div style={{ border: `1px solid ${colors.border}`, padding: "20px", marginTop: "20px" }}>
              <h3>COMPARAÇÃO ENTRE MÉTODOS — UBC</h3>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={barData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="method" />
                  <YAxis />
                  <Tooltip
                    formatter={(v) => v.toFixed(0)}
                    labelFormatter={(label) => METHOD_LABELS[label] || label}
                  />
                  <Bar dataKey="score">
                    {barData.map((entry) => (
                      <Cell
                        key={entry.method}
                        fill={entry.method === bestMethod ? colors.primary : "#9ca3af"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* RANKING */}
          {filters.ubc && (
            <div style={{ border: `1px solid ${colors.border}`, padding: "20px", marginTop: "20px" }}>
              <h3>RANKING — UBC</h3>
              {ubcResult.ranking.map((m, i) => (
                <p key={m} style={{ fontWeight: m === bestMethod ? "bold" : "normal", margin: "6px 0" }}>
                  {i + 1}. {METHOD_LABELS[m] || m}: {ubcResult.scores[m]}
                </p>
              ))}
            </div>
          )}
        </>
      )}

      {/* ABA — RADAR */}
      {activeTab === "radar" && (
        <div style={{ border: `1px solid ${colors.border}`, padding: "20px", marginTop: "20px" }}>
          {filters.ubc ? (
            <>
              <h3>GRÁFICO RADAR — UBC (scores normalizados 0–100)</h3>
              <ResponsiveContainer width="100%" height={420}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="method" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Radar name="UBC" dataKey="value" stroke={colors.primary} fill={colors.primary} fillOpacity={0.4} />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </>
          ) : (
            <p style={{ color: "#6b7280" }}>Ative o filtro UBC para visualizar o radar.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default Statistics;
