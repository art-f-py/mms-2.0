export const METHODS = ["OP", "BC", "SLS", "SLC", "LW", "R&P", "SKS", "C&F", "TS", "SQS"];

export const METHOD_LABELS = {
  "OP":  "Open Pit",
  "BC":  "Block Caving",
  "SLS": "Sublevel Stoping",
  "SLC": "Sublevel Caving",
  "LW":  "Longwall",
  "R&P": "Room & Pillar",
  "SKS": "Shrinkage Stoping",
  "C&F": "Cut & Fill",
  "TS":  "Top Slicing",
  "SQS": "Square Set",
};

export const UBC_GEOMETRY = {
  shape: {
    options: {
      "Massiva":   [4, 4, 3, 3, -49, 0, 0, 1, 1, 0],
      "Tabular":   [2, 2, 4, 4,   4, 4, 4, 4, 2, 1],
      "Irregular": [3, 0, 1, 1, -49, 2, 2, 4, 0, 4],
    },
  },
  thickness: {
    options: {
      "Muito estreito": [1, -49, -10, -49,   4,   4,   4, 3, 1, 4],
      "Estreito":       [2, -49,   1, -49,   3,   3,   4, 4, 1, 3],
      "Intermediário":  [3,   0,   3,   0,   0,   1,   0, 4, 0, 2],
      "Espesso":        [4,   3,   4,   4, -49, -49, -49, 1, 2, 0],
      "Muito espesso":  [4,   4,   3,   4, -49, -49, -49, 0, 1, 0],
    },
  },
  dip: {
    options: {
      "Plano":         [3, 3, 2, 1,   4,   4, -49, 1, 4, 2],
      "Intermediário": [3, 2, 1, 1,   0,   0,   0, 3, 2, 3],
      "Inclinado":     [1, 4, 4, 4, -49, -49,   4, 4, 0, 2],
    },
  },
  grade: {
    options: {
      "Uniforme":    [3, 3, 4, 3, 4, 4, 3, 2, 2, 0],
      "Gradacional": [3, 2, 4, 2, 1, 2, 2, 3, 1, 1],
      "Errática":    [2, 2, 3, 2, 0, 0, 2, 4, 1, 3],
    },
  },
  depth: {
    options: {
      "Rasa":          [  4, 2, 3, 3, 2, 3, 3, 2, 2, 1],
      "Intermediária": [  0, 3, 4, 2, 2, 3, 3, 3, 1, 1],
      "Profunda":      [-49, 3, 2, 2, 3, 2, 2, 4, 1, 2],
    },
  },
};

export const UBC_OREBODY = {
  rss: {
    options: {
      "Muito fraca": [4, 4, 0, 2, 6, 0, 0, 0, 3, 4],
      "Fraca":       [3, 2, 2, 3, 5, 0, 1, 1, 2, 3],
      "Moderada":    [3, 1, 4, 3, 2, 3, 3, 3, 1, 1],
      "Resistente":  [3, 0, 4, 2, 1, 6, 4, 3, 0, 0],
    },
  },
  rmr: {
    options: {
      "Muito pobre": [3,   4, 1, 3, 6, -49, 0, 0, 3, 4],
      "Pobre":       [3,   3, 3, 4, 6,   0, 1, 1, 2, 4],
      "Razoável":    [3,   2, 4, 3, 4,   3, 3, 2, 1, 1],
      "Boa":         [3,   0, 4, 1, 2,   5, 3, 3, 1, 0],
      "Muito boa":   [3, -49, 4, 0, 2,   6, 3, 3, 0, 0],
    },
  },
};

export const UBC_HANGINGWALL = {
  rss: {
    options: {
      "Muito fraca": [3, 4, 0, 4, 6, 0, 0, 3, 3, 4],
      "Fraca":       [3, 3, 1, 3, 5, 0, 1, 5, 2, 2],
      "Moderada":    [4, 2, 4, 2, 2, 2, 3, 4, 2, 1],
      "Resistente":  [4, 0, 5, 1, 2, 6, 4, 2, 2, 0],
    },
  },
  rmr: {
    options: {
      "Muito pobre": [2,  3, -49, 4, 6, -49, 0, 3, 0, 4],
      "Pobre":       [3,  3,   0, 4, 5,   0, 0, 5, 0, 4],
      "Razoável":    [4,  3,   3, 3, 4,   3, 2, 4, 2, 1],
      "Boa":         [4,  2,   4, 2, 3,   5, 4, 3, 3, 0],
      "Muito boa":   [4,  2,   4, 2, 3,   6, 4, 3, 3, 0],
    },
  },
};

// LW e R&P não têm scores para footwall (null = não se aplica)
export const UBC_FOOTWALL = {
  rss: {
    options: {
      "Muito fraca": [3, 4, 0, 1, null, null, 0, 1, 2, 3],
      "Fraca":       [3, 3, 1, 2, null, null, 2, 3, 2, 2],
      "Moderada":    [4, 2, 3, 2, null, null, 3, 2, 1, 0],
      "Resistente":  [4, 1, 3, 2, null, null, 3, 2, 1, 0],
    },
  },
  rmr: {
    options: {
      "Muito pobre": [2, 3, 0, 1, null, null, 0, 3, 0, 3],
      "Pobre":       [3, 3, 0, 2, null, null, 0, 3, 0, 1],
      "Razoável":    [4, 3, 2, 3, null, null, 2, 2, 1, 0],
      "Boa":         [4, 2, 3, 3, null, null, 3, 2, 2, 0],
      "Muito boa":   [4, 2, 3, 3, null, null, 3, 2, 2, 0],
    },
  },
};
