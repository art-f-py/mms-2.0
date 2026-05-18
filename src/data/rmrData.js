// RMR - Bieniawski (1989)
// Cada parâmetro tem faixas com pesos. A soma define a classe RMR.

export const RMR_PARAMS = [
  {
    id: "ucs",
    label: "Resistência da Rocha Intacta",
    sublabel: "UCS (MPa)",
    options: [
      { label: "> 250 MPa",    weight: 15 },
      { label: "100–250 MPa",  weight: 12 },
      { label: "50–100 MPa",   weight: 7  },
      { label: "25–50 MPa",    weight: 4  },
      { label: "5–25 MPa",     weight: 2  },
      { label: "1–5 MPa",      weight: 1  },
      { label: "< 1 MPa",      weight: 0  },
    ],
  },
  {
    id: "rqd",
    label: "RQD",
    sublabel: "Rock Quality Designation",
    options: [
      { label: "90–100%", weight: 20 },
      { label: "75–90%",  weight: 17 },
      { label: "50–75%",  weight: 13 },
      { label: "25–50%",  weight: 8  },
      { label: "< 25%",   weight: 3  },
    ],
  },
  {
    id: "spacing",
    label: "Espaçamento das Descontinuidades",
    sublabel: "",
    options: [
      { label: "> 2 m",       weight: 20 },
      { label: "0,6–2 m",     weight: 15 },
      { label: "200–600 mm",  weight: 10 },
      { label: "60–200 mm",   weight: 8  },
      { label: "< 60 mm",     weight: 5  },
    ],
  },
  {
    id: "persistence",
    label: "Persistência / Continuidade",
    sublabel: "Condicionamento das descontinuidades",
    options: [
      { label: "< 1 m",   weight: 6 },
      { label: "1–3 m",   weight: 4 },
      { label: "3–10 m",  weight: 2 },
      { label: "10–20 m", weight: 1 },
      { label: "> 20 m",  weight: 0 },
    ],
  },
  {
    id: "aperture",
    label: "Abertura (Separação)",
    sublabel: "",
    options: [
      { label: "Nenhuma",    weight: 6 },
      { label: "< 0,1 mm",  weight: 5 },
      { label: "0,1–1 mm",  weight: 4 },
      { label: "1–5 mm",    weight: 1 },
      { label: "> 5 mm",    weight: 0 },
    ],
  },
  {
    id: "roughness",
    label: "Rugosidade",
    sublabel: "",
    options: [
      { label: "Muito rugosa",      weight: 6 },
      { label: "Rugosa",            weight: 5 },
      { label: "Levemente rugosa",  weight: 3 },
      { label: "Lisa",              weight: 1 },
      { label: "Escorregadia",      weight: 0 },
    ],
  },
  {
    id: "infilling",
    label: "Preenchimento",
    sublabel: "",
    options: [
      { label: "Nenhum",        weight: 6 },
      { label: "Duro < 5 mm",   weight: 4 },
      { label: "Duro > 5 mm",   weight: 2 },
      { label: "Macio < 5 mm",  weight: 2 },
      { label: "Macio > 5 mm",  weight: 0 },
    ],
  },
  {
    id: "weathering",
    label: "Grau de Alteração",
    sublabel: "",
    options: [
      { label: "Sem alteração", weight: 6 },
      { label: "Baixo",         weight: 5 },
      { label: "Moderado",      weight: 3 },
      { label: "Alto",          weight: 1 },
      { label: "Muito alto",    weight: 0 },
    ],
  },
  {
    id: "groundwater",
    label: "Água Subterrânea",
    sublabel: "Condições gerais",
    options: [
      { label: "Seco",        weight: 15 },
      { label: "Úmido",       weight: 10 },
      { label: "Molhado",     weight: 7  },
      { label: "Gotejando",   weight: 4  },
      { label: "Vertendo",    weight: 0  },
    ],
  },
];

// Converte score RMR numérico para classe UBC/SH&B
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
