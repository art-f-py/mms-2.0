// COR DE COLOCAÇÃO — GRADIENTE CONTÍNUO, NÃO PALETA
//
// A célula que mostra a colocação de um método é pintada por interpolação, não
// escolhendo numa lista de cores prontas. A diferença importa: uma paleta fixa
// obriga a decidir quantas faixas existem ("as três melhores são verdes"), e
// essa decisão é arbitrária — o 3º e o 4º lugar não são separados por nada além
// da borda que alguém desenhou. No gradiente, a distância entre duas cores é a
// distância entre as duas colocações, e mais nada.
//
// SÓ O MATIZ VARIA. Saturação e luminosidade são constantes ao longo de toda a
// curva. Variar os três juntos é o erro clássico aqui: o olho lê mudança de
// luminosidade como mudança de importância, então uma ponta do gradiente ficaria
// parecendo "mais forte" que a outra por um motivo que não é a colocação. Com S
// e L travados, a única coisa que muda de célula para célula é a informação.
//
// Esta é cor COMPUTADA, e por isso não vira token em index.css. Os quatro
// --color-mcdm-* de lá são identidade fixa: aquele azul É o grupo Geometria,
// nas três telas em que ele aparece. Aqui não existe "a cor do 4º lugar" — o 4º
// de dez e o 4º de quatro são cores diferentes, e devem ser.
//
// Puro: não lê estado global, não toca no DOM, devolve string.

// 120° é verde puro e 0° é vermelho puro; o caminho entre eles no círculo de
// matizes passa exatamente por 60° (amarelo), que é o meio esperado. Não há
// escolha de rota a fazer — é o arco direto, sem tocar em ciano ou magenta.
const HUE_BEST  = 120;
const HUE_WORST = 0;

const SATURATION = 65;

// 62%, e não um número redondo, porque é o menor valor em que TODO ponto do
// gradiente ainda passa em WCAG AA (4.5:1) contra o texto da célula
// (--color-text, #1a202c). O vermelho é o ponto crítico: a 55% ele dá 3.68:1 e
// a 60% ainda dá 4.28:1; a 62% dá 4.57:1. O verde sobra em qualquer um deles
// (9.3:1 aqui), mas subir a luminosidade só do vermelho quebraria a regra de S
// e L constantes — então o gradiente inteiro é fixado pelo seu pior ponto.
const LIGHTNESS = 62;

/**
 * Cor da célula de uma colocação, no gradiente verde → amarelo → vermelho.
 *
 * @param {number} rank        colocação, 1 = melhor
 * @param {number} totalRanks  quantas colocações existem — vem do tamanho da
 *                             lista exibida, nunca de uma constante. Hoje são
 *                             sempre dez métodos, mas o dez não é uma verdade
 *                             sobre cores: é uma verdade sobre METHODS, e ela
 *                             muda no dia em que alguém acrescentar um método.
 * @returns {string} cor HSL pronta para backgroundColor
 */
export function rankToColor(rank, totalRanks) {
  // Uma colocação só: não há gradiente a percorrer, e (rank-1)/(totalRanks-1)
  // seria 0/0. Ela recebe a ponta boa — sendo a única, é de fato a melhor.
  const span = totalRanks > 1 ? (rank - 1) / (totalRanks - 1) : 0;

  // O clamp não é defesa contra o improvável, é escolha de como falhar. Sem
  // ele, um rank fora da faixa produz matiz fora de [0, 120] e o círculo de
  // cores dá a volta: rank 0 viraria magenta, rank 11 de 10 viraria azul. Uma
  // cor de outra família parece uma categoria nova e alguém tenta interpretá-la;
  // saturar na ponta parece o que é — o extremo.
  const t = Math.min(1, Math.max(0, span));

  // toFixed(2) só apara o ruído de ponto flutuante da divisão (106.666…°); nas
  // pontas os valores continuam exatos, e a resolução de 0.01° só empataria
  // dois ranks vizinhos numa lista de mais de doze mil.
  const hue = Number((HUE_BEST - t * (HUE_BEST - HUE_WORST)).toFixed(2));

  return `hsl(${hue}, ${SATURATION}%, ${LIGHTNESS}%)`;
}
