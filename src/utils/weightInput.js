// TEXTO DIGITADO -> PESO DE GRUPO, OU NADA
//
// O campo numérico ao lado de cada slider do Enfoque (GroupSlider, em
// McdmBlock.jsx) precisa decidir, a cada tecla, se o que está escrito já é um
// peso válido. Só quando é o valor segue para o MESMO dispatch que o slider
// usa; enquanto não é, o texto fica visível no campo e o estado não se mexe.
//
// POR QUE ISTO É UMA FUNÇÃO, E NÃO TRÊS LINHAS DENTRO DO onChange. Porque é a
// única parte do campo numérico que tem comportamento a garantir, e o projeto
// não tem infraestrutura de teste de componente React (vite.config.js roda em
// `environment: 'node'`, sem Testing Library) — dentro do JSX, isto não seria
// testável. Mesmo motivo de mcdmRanking.js e mcdmMatrixLayout.js existirem
// fora dos componentes.
//
// O QUE ESTÁ EM JOGO SE ELA ERRAR: rebalanceGroupWeights LANÇA RangeError para
// valor não finito ou fora de [0, 1]. Um "abc" ou um 5 que escapem daqui não
// dão um peso errado — derrubam o reducer, e com ele a tela inteira. A guarda
// não é polimento, é o que mantém o campo de texto incapaz de quebrar o app.
//
// Puro: não lê estado global, não toca no DOM.

/**
 * Converte o conteúdo do campo numérico em peso de grupo.
 *
 * `parseFloat` é deliberadamente o mesmo do slider, para que os dois controles
 * não possam divergir na conversão. O que muda é o que vem depois: o slider só
 * produz texto que já é número, o teclado não.
 *
 * REJEITA O QUE parseFloat ACEITARIA DE MAIS. "0.5abc" vira 0.5 no parseFloat,
 * e aceitar isso faria o campo engolir texto que a pessoa não terminou de
 * apagar. A checagem de formato completo (`Number(text)`) recusa o resto —
 * exceto o espaço em volta, que é irrelevante e cai no trim.
 *
 * @param {string} text  conteúdo bruto do campo
 * @returns {number|null} o peso, ou null se o texto ainda não é um peso válido
 */
export function parseWeightInput(text) {
  if (typeof text !== "string") return null;

  const trimmed = text.trim();
  // Campo vazio é estado normal de digitação (apagar antes de escrever), não
  // erro — e Number("") é 0, que entraria como peso zero sem que ninguém tenha
  // pedido zero.
  if (trimmed === "") return null;

  const value = Number(trimmed);
  if (!Number.isFinite(value)) return null;
  if (value < 0 || value > 1) return null;

  return value;
}
