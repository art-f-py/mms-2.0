import { methodsData } from "../data/methodsData";
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
  // encontra o método com a maior pontuação
  const bestMethod = methodsData.reduce((prev, current) =>
    prev.score > current.score ? prev : current
  );

  // ordena os métodos por score (maior -> menor)
  const sortedMethods = [...methodsData].sort(
    (a, b) => b.score - a.score
  );

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
        maxWidth: "1200px",
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

      {/* RESULTADO PRINCIPAL */}
      <div
        style={{
          border: `1px solid ${colors.border}`,
          padding: "15px",
          marginTop: "20px"
        }}
      >
        <h3>RESULTADO PRINCIPAL</h3>
        <p>
          <strong>{bestMethod.method}</strong>
        </p>
        <p>Pontuação: {bestMethod.score}</p>
      </div>

      {/* GRÁFICO */}
      <div
        style={{
          border: `1px solid ${colors.border}`,
          padding: "15px",
          marginTop: "20px"
        }}
      >
        <h3>COMPARAÇÃO ENTRE MÉTODOS</h3>

        <BarChart width={900} height={300} data={sortedMethods}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="method" />
          <YAxis />
          <Tooltip />
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
          padding: "15px",
          marginTop: "20px"
        }}
      >
        <h3>PREFERÊNCIAS</h3>

        {sortedMethods.map((item, index) => (
          <p
            key={item.method}
            style={{
              fontWeight: item.method === bestMethod.method ? "bold" : "normal"
            }}
          >
            {index + 1}. {item.method} - {item.score.toFixed(2)}
          </p>
        ))}
      </div>
    </div>
  );
}

export default Statistics;