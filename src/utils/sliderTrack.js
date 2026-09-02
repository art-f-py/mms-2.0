// TRILHO DO SLIDER DE PESO — POR QUE NÃO USAMOS accent-color
//
// A forma curta de colorir um <input type="range"> é `accent-color`: uma
// propriedade, e o navegador pinta preenchimento e bolinha. Era o que este
// slider fazia, e produzia um bug visível em UM dos quatro grupos.
//
// O QUE ACONTECIA. Com `accent-color`, o Chromium não usa a cor só no
// preenchimento — ele DERIVA a cor do trecho não preenchido a partir dela, para
// garantir contraste entre as duas metades do trilho. Acima de um limiar de
// luminância (~0.25, medido no Chrome 152) ele considera a cor "clara demais" e
// escurece o resto do trilho para quase preto, em vez do cinza claro habitual.
//
// Dos quatro tokens de grupo, só um cruza esse limiar:
//
//   --color-mcdm-geometry      #3B7A9E   luminância 0.173   cinza claro
//   --color-mcdm-geomechanics  #7A5C99   luminância 0.141   cinza claro
//   --color-mcdm-economic      #B25353   luminância 0.163   cinza claro
//   --color-mcdm-technical     #C98A3B   luminância 0.309   TRILHO PRETO
//
// Daí o sintoma ter sido "o slider do Técnico-Operacional está preto" enquanto
// o quadradinho de cor ao lado dele estava certo: os dois sempre leram a MESMA
// variável, e ambos recebiam a cor certa. O que diferia era o que o navegador
// fazia depois de recebê-la. Não havia índice errado nem segunda fonte de cor.
//
// POR QUE A CORREÇÃO É ESTA, E NÃO ESCURECER O TOKEN. Escurecer
// --color-mcdm-technical até passar por baixo do limiar também apaga o sintoma,
// com uma linha. Mas deixa a tela dependendo de um número não documentado do
// Chromium: se o limiar mudar de versão, ou se alguém escolher um azul mais
// claro para outro grupo, o mesmo bug volta em silêncio — e volta como
// "problema de cor", que é o disfarce que já custou duas investigações. Tomando
// conta do trilho, a heurística deixa de existir para nós e qualquer cor
// futura funciona.
//
// O CUSTO: com `appearance: none` o navegador para de desenhar o controle, e
// preenchimento e bolinha passam a ser nossos (ver .mms-weight-slider em
// index.css). O preenchimento vira um gradiente de duas paradas, e é por isso
// que a POSIÇÃO precisa chegar ao CSS — é o que esta função entrega.
//
// Puro: não lê estado global, não toca no DOM.

/** Limita ao intervalo [0, 1] — o domínio do peso de grupo. */
const clampToUnit = (value) => Math.min(1, Math.max(0, value));

/**
 * Estilo inline do slider de peso: a cor do grupo e a posição do preenchimento.
 *
 * Sai como duas custom properties em vez de um `background` pronto porque o
 * gradiente vive nos pseudo-elementos do trilho (::-webkit-slider-runnable-track
 * e companhia), e pseudo-elemento não é alcançável por estilo inline. O CSS lê
 * as duas variáveis; o React só diz quanto e de que cor.
 *
 * VALOR NÃO NUMÉRICO VIRA ZERO, sem lançar. Este é caminho de renderização: um
 * peso indefinido vindo de um render intermediário deve dar um slider vazio, não
 * uma tela em branco. A validação de peso é do reducer, não daqui.
 *
 * @param {string} color  cor do grupo (aceita `var(--token)`)
 * @param {number} value  peso em [0, 1]
 * @returns {{"--mms-slider-fill": string, "--mms-slider-pct": string}}
 */
export function weightSliderStyle(color, value) {
  const safe = typeof value === "number" && Number.isFinite(value) ? clampToUnit(value) : 0;
  return {
    "--mms-slider-fill": color,
    "--mms-slider-pct":  `${safe * 100}%`,
  };
}
