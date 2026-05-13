// Nicholas (1992) Mining Method Selection
// Nicholas, D.E. (1992). SME Mining Engineering Handbook, 2nd ed., pp. 2090-2106.
// Ordem dos métodos (índice fixo):
// 0:OP  1:BC  2:SLS  3:SLC  4:LW  5:R&P  6:SKS  7:C&F  8:TS  9:SQS
//
// Nicholas 92 é estruturalmente idêntico ao 81, mas introduz multiplicadores
// por domínio que o usuário pode ajustar via sliders.

// ---------------------------------------------------------------------------
// MULTIPLICADORES PADRÃO (Nicholas 1992, Tabela de multiplicadores sugeridos)
// O usuário pode ajustar esses valores via sliders na interface.
// ---------------------------------------------------------------------------
export const DEFAULT_MULTIPLIERS = {
  geometry:    1.00,
  orebody:     1.33,
  hangingWall: 1.33,
  footwall:    1.33,
};

// Linha alternativa da tabela (segundo conjunto de multiplicadores sugeridos)
export const ALTERNATIVE_MULTIPLIERS = {
  geometry:    1.00,
  orebody:     0.75,
  hangingWall: 0.60,
  footwall:    0.38,
};

// ---------------------------------------------------------------------------
// TABELAS DE PESOS — idênticas ao Nicholas 81
// ---------------------------------------------------------------------------

export const NICHOLAS92_GEOMETRY = {
  shape: {
    options: {
      "Massivo":   [3, 4, 2, 3, -49, 0, 2, 0, 3, 0],
      "Tabular":   [2, 2, 2, 4,   4, 4, 2, 4, 3, 2],
      "Irregular": [3, 0, 1, 1, -49, 2, 1, 2, 0, 4],
    },
  },
  thickness: {
    options: {
      "Estreito":      [2, -49, 1, -49,   4,   4, 1, 4, -49, 4],
      "Intermediário": [3,   0, 2,   0,   0,   2, 2, 4,   0, 4],
      "Espesso":       [4,   2, 4,   4, -49, -49, 4, 0,   3, 1],
      "Muito espesso": [4,   4, 3,   4, -49, -49, 3, 0,   4, 1],
    },
  },
  dip: {
    options: {
      "Plano":         [3, 3, 2, 1,   4, 4, 2, 0, 4, 2],
      "Intermediário": [3, 2, 1, 1,   0, 1, 1, 3, 1, 3],
      "Inclinado":     [4, 4, 4, 4, -49, 0, 4, 4, 2, 3],
    },
  },
  grade: {
    options: {
      "Uniforme":    [3, 4, 3, 4, 4, 3, 3, 3, 4, 3],
      "Gradacional": [3, 2, 3, 2, 2, 3, 2, 3, 2, 3],
      "Errático":    [3, 0, 1, 0, 0, 3, 1, 3, 0, 3],
    },
  },
};

export const NICHOLAS92_OREBODY = {
  rss: {
    options: {
      "Fraca":      [3, 4, -49, 0, 4, 0, 1, 3, 2, 4],
      "Moderada":   [4, 1,   3, 3, 1, 3, 3, 2, 3, 1],
      "Resistente": [4, 1,   4, 3, 0, 4, 4, 2, 3, 1],
    },
  },
  jointSpacing: {
    label: "Espaçamento das fraturas",
    options: {
      "Muito Perto": [2, 4, 0, 0, 4, 0, 0, 3, 1, 4],
      "Perto":       [3, 4, 0, 2, 4, 1, 1, 3, 1, 4],
      "Longe":       [4, 3, 1, 4, 0, 2, 3, 2, 2, 2],
      "Muito Longe": [4, 0, 4, 4, 0, 4, 4, 2, 4, 1],
    },
  },
  jointCondition: {
    label: "Características das interfraturas",
    options: {
      "Fraca":  [2, 4, 0, 0, 4, 0, 0, 3, 1, 4],
      "Média":  [3, 3, 2, 2, 3, 2, 2, 3, 2, 3],
      "Forte":  [4, 0, 4, 2, 0, 4, 4, 2, 4, 2],
    },
  },
};

export const NICHOLAS92_HANGINGWALL = {
  rss: {
    options: {
      "Fraca":      [3, 4, -49, 3, 4, 0, 4, 3, 4, 3],
      "Moderada":   [4, 2,   3, 2, 2, 3, 2, 2, 2, 2],
      "Resistente": [4, 1,   4, 1, 0, 4, 1, 2, 1, 2],
    },
  },
  jointSpacing: {
    label: "Espaçamento das fraturas",
    options: {
      "Muito Perto": [2, 3, -49, 3, 4, 0, 4, 3, 3, 3],
      "Perto":       [3, 4,   0, 4, 4, 1, 4, 3, 3, 3],
      "Longe":       [4, 3,   1, 3, 3, 2, 3, 2, 3, 2],
      "Muito Longe": [4, 3,   1, 3, 3, 2, 3, 2, 3, 2],
    },
  },
  jointCondition: {
    label: "Características das interfraturas",
    options: {
      "Fraca":  [2, 4, 0, 4, 4, 0, 4, 4, 4, 4],
      "Média":  [3, 2, 2, 2, 2, 2, 2, 3, 2, 3],
      "Forte":  [4, 0, 4, 0, 0, 4, 0, 2, 0, 2],
    },
  },
};

export const NICHOLAS92_FOOTWALL = {
  rss: {
    options: {
      "Fraca":      [3, 2, 0, 0, 2, 0, 2, 4, 2, 4],
      "Moderada":   [4, 3, 2, 2, 3, 2, 3, 2, 3, 2],
      "Resistente": [4, 3, 4, 4, 3, 4, 3, 2, 3, 2],
    },
  },
  jointSpacing: {
    label: "Espaçamento das fraturas",
    options: {
      "Muito Perto": [2, 1, 0, 0, 1, 0, 2, 4, 1, 4],
      "Perto":       [3, 3, 0, 1, 2, 1, 3, 4, 3, 4],
      "Longe":       [4, 3, 2, 3, 4, 3, 3, 2, 3, 2],
      "Muito Longe": [4, 3, 4, 4, 3, 3, 2, 2, 3, 2],
    },
  },
  jointCondition: {
    label: "Características das interfraturas",
    options: {
      "Fraca":  [2, 1, 0, 0, 1, 0, 2, 4, 1, 4],
      "Média":  [3, 3, 1, 2, 3, 3, 2, 4, 2, 4],
      "Forte":  [4, 3, 4, 4, 3, 3, 3, 2, 3, 2],
    },
  },
};
