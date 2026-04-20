import { methodsData } from "../data/methodsData";
  import { useState } from "react";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from "recharts";

function Statistics() {
  const [activeTab, setActiveTab] = useState("general");
  // encontra o método com a maior pontuação
  const bestMethod = methodsData.reduce((prev, current) =>
    prev.score > current.score ? prev : current
  );

  // ordena os métodos por score (maior -> menor)
  const sortedMethods = [...methodsData].sort(
    (a, b) => b.score - a.score
  );

  const top3 = sortedMethods.slice(0,3);

  const methodNames = {
    "C&F": "Cut & Fill",
    "SQS": "Square Set",
    "TS": "Top Slicing",
    "LW": "Longwall",
    "OP": "Open Pit",
    "BC": "Block Caving",
    "SLC": "Sublevel Caving",
    "SKS": "Shrinkage Stoping",
    "SLS": "Sublevel Stoping",
    "R&P": "Room & Pillar"
  };

  const colors = {
    primary: "#2f3e4e",
    secondary: "#e5e7eb",
    border: "#000000",
    text: "#000000",
    background: "#ffffff"
  };

  return (
    <div
      style={{
        maxWidth: "1400px",
        width: "95%",
        margin: "0 auto",
        padding: "20px",
        backgroundColor: colors.background,
        color: colors.text
      }}
    >
      {/* HEADER */}
      <div
        style={{
          background: colors.primary,
          color: "#fff",
          padding: "10px",
          borderRadius: "6px",
          textAlign: "center"
        }}
      >
        <h2>SELEÇÃO DE MÉTODOS DE LAVRA</h2>
      </div>

      {/* TABS */}
      <div
        style = {{
          display: "flex",
          gap: "10px",
          marginTop: "20px"
        }}
      >
        <button
          onClick={() => setActiveTab("general")}
          style = {{
            padding: "10px 20px",
            border: `1px solid ${colors.border}`,
            backgroundColor: 
              activeTab === "general" ? colors.primary : "#ffffff",
            color: activeTab === "general" ? "#ffffff" : colors.text,
            cursor: "pointer",
            borderRadius: "4px"
          }}
        >
          Visão Geral
        </button>
        <button
          onClick={() => setActiveTab("result")}
          style={{
            padding: "10px 20px",
            border: `1px solid ${colors.border}`,
            backgroundColor:
              activeTab === "result" ? colors.primary : "#ffffff",
            color: activeTab === "result" ? "#ffffff" : colors.text,
            cursor: "pointer",
            borderRadius: "4px"
          }}
        >
          Resultado
        </button>
      </div>

      {/* ABA VISÃO GERAL */}
{/* ABA VISÃO GERAL */}
{activeTab === "general" && (
  <>
    {/* RESULTADO PRINCIPAL */}
    <div
      style={{
        border: `1px solid ${colors.border}`,
        padding: "20px",
        marginTop: "20px"
      }}
    >
      <h3 style={{ marginBottom: "10px" }}>RESULTADO PRINCIPAL</h3>

      <p style={{ fontSize: "20px", fontWeight: "bold" }}>
        {bestMethod.method}
      </p>

      <p>Pontuação: {bestMethod.score.toFixed(2)}</p>
    </div>

    {/* GRÁFICO */}
    <div
      style={{
        border: `1px solid ${colors.border}`,
        padding: "20px",
        marginTop: "20px"
      }}
    >
      <h3>COMPARAÇÃO ENTRE MÉTODOS</h3>

      <BarChart width={900} height={300} data={sortedMethods}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="method" />
        <YAxis domain={["auto", "auto"]} />
        <Tooltip 
          formatter={(value) => value.toFixed(2)}
          labelFormatter = {(label) => methodNames[label] || label} />
        <Bar dataKey="score">
          {sortedMethods.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={
                entry.method === bestMethod.method
                  ? colors.primary
                  : "#9ca3af"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </div>

    {/* RANKING */}
    <div
      style={{
        border: `1px solid ${colors.border}`,
        padding: "20px",
        marginTop: "20px"
      }}
    >
      <h3>PREFERÊNCIAS</h3>

      {sortedMethods.map((item, index) => (
        <p
          key={item.method}
          style={{
            fontWeight:
              item.method === bestMethod.method ? "bold" : "normal"
          }}
        >
          <span style={{ display: "inline-block", width: "30px" }}>
            {index + 1}.
          </span>
          <span style={{ display: "inline-block", width: "100px" }}>
            {item.method}
          </span>
          {item.score.toFixed(2)}
        </p>
      ))}
    </div>
  </>
)}
      {/* ABA RESULTADO */}
      {activeTab === "result" && (
        <div
          style={{
            border: `1px solid ${colors.border}`,
            padding: "20px",
            marginTop: "20px"
          }}
        >
          <h3>PÓDIO DOS MÉTODOS</h3>

          {top3.map((item, index) => (
  <div
    key={item.method}
    style={{
      border: `1px solid ${colors.border}`,
      padding: "25px",
      marginTop: "20px",
      backgroundColor:
        index === 0 ? "#dbeafe" : "#f3f4f6",
      textAlign: "center",
      minHeight: index === 0 ? "180px" : "140px",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center"
    }}
  >
    <p
      style={{
        fontSize: index === 0 ? "32px" : "24px",
        fontWeight: "bold",
        margin: "0"
      }}
    >
      {index === 0 ? "1º Lugar" : index === 1 ? "2º Lugar" : "3º Lugar"}
    </p>

    <h2
      style={{
        margin: "10px 0",
        fontSize: index === 0 ? "32px" : "24px",
        color: "#000000"
      }}
    >
      {methodNames[item.method] || item.method}
    </h2>

    <p
      style={{
        margin: "0",
        fontSize: index === 0 ? "20px" : "16px"
      }}
    >
      Pontuação: {item.score.toFixed(2)}
    </p>
  </div>
))}
        </div>
      )}
    </div>
  );
}

export default Statistics;