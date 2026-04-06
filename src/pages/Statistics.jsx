import { methodsData } from "../data/methodsData"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from "recharts";

function Statistics() {
  //encontra o método com a maior pontuação
  const bestMethod = methodsData.reduce((prev, current) => 
    prev.score > current.score ? prev : current);

  //ordena os métodos por score (maior -> menor) para gerar o ranking
  const sortedMethods = [...methodsData].sort((a, b) => 
    b.score - a.score);

  return (
    <div>
      <h1>MMS 2.0</h1>
      <p>Página de Estatísticas</p>

      {sortedMethods.map((item, index) => (
        <p key = {item.method}>
          {index + 1}. {item.method}: {item.score}
        </p>
      ))}
      <h2>Melhor Método: {bestMethod.method} com pontuação {bestMethod.score}</h2>

      <h2>Gráfico de Pontuação</h2>
      <BarChart
        width={500}
        height={300}
        data={sortedMethods}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="method" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="score" fill="#8884d8" />
      </BarChart>
    </div>
  );
}

export default Statistics;