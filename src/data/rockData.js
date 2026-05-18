// Massa específica por família de rochas (kg/m³)
// Fonte: valores típicos da literatura geotécnica
export const DENSITY_DATA = {
  "Ígneas": [
    { rock: "Granito",      min: 2600, max: 2800 },
    { rock: "Diorito",      min: 2700, max: 3000 },
    { rock: "Gabro",        min: 2850, max: 3150 },
    { rock: "Basalto",      min: 2700, max: 3100 },
    { rock: "Riolito",      min: 2300, max: 2700 },
    { rock: "Andesito",     min: 2400, max: 2800 },
    { rock: "Sienito",      min: 2600, max: 2900 },
    { rock: "Pegmatito",    min: 2500, max: 2800 },
    { rock: "Peridotito",   min: 3100, max: 3400 },
    { rock: "Dunito",       min: 3200, max: 3400 },
  ],
  "Sedimentares": [
    { rock: "Arenito",       min: 2000, max: 2650 },
    { rock: "Folhelho",      min: 2000, max: 2700 },
    { rock: "Calcário",      min: 2300, max: 2800 },
    { rock: "Dolomito",      min: 2500, max: 2900 },
    { rock: "Conglomerado",  min: 2200, max: 2700 },
    { rock: "Sílex",         min: 2500, max: 2700 },
    { rock: "Evaporito",     min: 2100, max: 2900 },
    { rock: "Carvão",        min: 1200, max: 1800 },
    { rock: "Sal-gema",      min: 2100, max: 2200 },
  ],
  "Metamórficas": [
    { rock: "Quartzito",    min: 2600, max: 2700 },
    { rock: "Mármore",      min: 2600, max: 2900 },
    { rock: "Ardósia",      min: 2700, max: 2900 },
    { rock: "Filito",       min: 2700, max: 2900 },
    { rock: "Xisto",        min: 2500, max: 2900 },
    { rock: "Gnaisse",      min: 2600, max: 3000 },
    { rock: "Anfibolito",   min: 2800, max: 3200 },
    { rock: "Eclogito",     min: 3200, max: 3500 },
    { rock: "Migmatito",    min: 2600, max: 2900 },
  ],
};

// UCS por tipo de rocha (MPa) — Bieniawski 1989 e literatura geomecânica
export const UCS_DATA = {
  "Ígneas": [
    { rock: "Granito",      min: 100, max: 250 },
    { rock: "Diorito",      min: 80,  max: 200 },
    { rock: "Gabro",        min: 150, max: 250 },
    { rock: "Basalto",      min: 100, max: 300 },
    { rock: "Riolito",      min: 80,  max: 200 },
    { rock: "Andesito",     min: 80,  max: 250 },
    { rock: "Sienito",      min: 100, max: 200 },
    { rock: "Peridotito",   min: 150, max: 300 },
  ],
  "Sedimentares": [
    { rock: "Arenito",       min: 20,  max: 170 },
    { rock: "Folhelho",      min: 5,   max: 100 },
    { rock: "Calcário",      min: 30,  max: 250 },
    { rock: "Dolomito",      min: 80,  max: 250 },
    { rock: "Conglomerado",  min: 20,  max: 150 },
    { rock: "Sílex",         min: 150, max: 300 },
    { rock: "Carvão",        min: 5,   max: 50  },
    { rock: "Sal-gema",      min: 15,  max: 40  },
  ],
  "Metamórficas": [
    { rock: "Quartzito",    min: 100, max: 300 },
    { rock: "Mármore",      min: 50,  max: 200 },
    { rock: "Ardósia",      min: 50,  max: 150 },
    { rock: "Filito",       min: 25,  max: 100 },
    { rock: "Xisto",        min: 10,  max: 100 },
    { rock: "Gnaisse",      min: 50,  max: 200 },
    { rock: "Anfibolito",   min: 80,  max: 250 },
    { rock: "Migmatito",    min: 50,  max: 180 },
  ],
};
