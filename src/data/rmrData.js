// RMR — Bieniawski (1989): conversões auxiliares para a classe RMR.

export function rmrToClass(score) {
  if (score <= 20) return "Muito pobre";
  if (score <= 40) return "Pobre";
  if (score <= 60) return "Razoável";
  if (score <= 80) return "Boa";
  return "Muito boa";
}

// Converte GSI → RMR numérico (Bieniawski 1989 / correlação)
export function gsiToRmr(gsi) {
  return (parseFloat(gsi) + 11.63) / 1.13;
}

// Converte Q → RMR numérico
export function qToRmr(q) {
  return 9 * Math.log(parseFloat(q)) + 44;
}
