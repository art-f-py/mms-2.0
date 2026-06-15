import { createContext, useContext, useReducer } from "react";

// Presets de multiplicadores de domínio do Nicholas 92
// eslint-disable-next-line react-refresh/only-export-components
export const DOMAIN_PRESETS = {
  default: { geo: 1.0, ob: 1.0,  hw: 1.0,  fw: 1.0  },
  preset1: { geo: 1.0, ob: 1.33, hw: 1.33, fw: 1.33 },
  preset2: { geo: 1.0, ob: 0.75, hw: 0.6,  fw: 0.38 },
  preset3: { geo: 1.0, ob: 1.0,  hw: 0.8,  fw: 0.5  },
};

// Critérios neutros (1.00) do UBC, agrupados por domínio geológico
const neutralUbcCriteria = () => ({
  geo: { shape: 1, thickness: 1, dip: 1, grade: 1, depth: 1 },
  ob:  { rss: 1, rmr: 1 },
  hw:  { rss: 1, rmr: 1 },
  fw:  { rss: 1, rmr: 1 },
});

// Critérios neutros (1.00) do SH&B, agrupados por domínio geológico/econômico
const neutralShbCriteria = () => ({
  geo:  { shape: 1, thickness: 1, dip: 1, grade: 1, depth: 1 },
  econ: { oreValue: 1 },
  ob:   { rss: 1, rmr: 1 },
  hw:   { rss: 1, rmr: 1 },
  fw:   { rss: 1, rmr: 1 },
});

// Pesos individualizados por método de seleção
const makeDefaultCriteriaWeights = () => ({
  ubc: neutralUbcCriteria(),
  nicholas: {
    geo: { shape: 1, thickness: 1, dip: 1, grade: 1 },
    ob:  { rss: 1, jointSpacing: 1, jointCondition: 1 },
    hw:  { rss: 1, jointSpacing: 1, jointCondition: 1 },
    fw:  { rss: 1, jointSpacing: 1, jointCondition: 1 },
    domain: { ...DOMAIN_PRESETS.default },
  },
  shb: neutralShbCriteria(),
});

const initialFormData = {
  selectedMethods: { ubc: true, nicholas: false, shb: false },
  geometry:        { shape: "", thickness: "", grade: "" },
  dip:             "",
  depth:           { ore: "", hangingWall: "", footwall: "" },
  density:         { ore: "", hangingWall: "", footwall: "" },
  ucs:             { ore: "", hangingWall: "", footwall: "" },
  rss:             { ore: "", hangingWall: "", footwall: "" },
  rmr:             { ore: "", hangingWall: "", footwall: "" },
  jointSpacing:    { ore: "", hangingWall: "", footwall: "" },
  jointCondition:  { ore: "", hangingWall: "", footwall: "" },
  oreValue:        "",
  criteriaWeights: makeDefaultCriteriaWeights(),
};

// Critérios neutros (1.00) do Nicholas, agrupados por domínio geológico
const neutralNicholasCriteria = () => ({
  geo: { shape: 1, thickness: 1, dip: 1, grade: 1 },
  ob:  { rss: 1, jointSpacing: 1, jointCondition: 1 },
  hw:  { rss: 1, jointSpacing: 1, jointCondition: 1 },
  fw:  { rss: 1, jointSpacing: 1, jointCondition: 1 },
});

const initialState = {
  formData: initialFormData,
  results: {
    ubc:      null,
    nicholas: null,
    shb:      null,
  },
};

function mmsReducer(state, action) {
  switch (action.type) {
    case "SET_FORM_FIELD": {
      if (action.field === null) {
        return { ...state, formData: { ...state.formData, [action.section]: action.value } };
      }
      return {
        ...state,
        formData: {
          ...state.formData,
          [action.section]: { ...state.formData[action.section], [action.field]: action.value },
        },
      };
    }
    case "SET_UBC_CRITERION": {
      const { domain, key, value } = action;
      const ubc = state.formData.criteriaWeights.ubc;
      return {
        ...state,
        formData: {
          ...state.formData,
          criteriaWeights: {
            ...state.formData.criteriaWeights,
            ubc: { ...ubc, [domain]: { ...ubc[domain], [key]: value } },
          },
        },
      };
    }
    case "SET_SHB_CRITERION": {
      const { domain, key, value } = action;
      const shb = state.formData.criteriaWeights.shb;
      return {
        ...state,
        formData: {
          ...state.formData,
          criteriaWeights: {
            ...state.formData.criteriaWeights,
            shb: { ...shb, [domain]: { ...shb[domain], [key]: value } },
          },
        },
      };
    }
    case "RESET_UBC_CRITERIA":
      return {
        ...state,
        formData: {
          ...state.formData,
          criteriaWeights: { ...state.formData.criteriaWeights, ubc: neutralUbcCriteria() },
        },
      };
    case "RESET_SHB_CRITERIA":
      return {
        ...state,
        formData: {
          ...state.formData,
          criteriaWeights: { ...state.formData.criteriaWeights, shb: neutralShbCriteria() },
        },
      };
    case "SET_NICHOLAS_CRITERION": {
      const { domain, key, value } = action;
      const nich = state.formData.criteriaWeights.nicholas;
      return {
        ...state,
        formData: {
          ...state.formData,
          criteriaWeights: {
            ...state.formData.criteriaWeights,
            nicholas: { ...nich, [domain]: { ...nich[domain], [key]: value } },
          },
        },
      };
    }
    case "SET_DOMAIN_WEIGHT": {
      const nich = state.formData.criteriaWeights.nicholas;
      return {
        ...state,
        formData: {
          ...state.formData,
          criteriaWeights: {
            ...state.formData.criteriaWeights,
            nicholas: { ...nich, domain: { ...nich.domain, [action.key]: action.value } },
          },
        },
      };
    }
    case "SET_DOMAIN_PRESET": {
      const preset = DOMAIN_PRESETS[action.preset] || DOMAIN_PRESETS.default;
      const nich   = state.formData.criteriaWeights.nicholas;
      return {
        ...state,
        formData: {
          ...state.formData,
          criteriaWeights: {
            ...state.formData.criteriaWeights,
            nicholas: { ...nich, domain: { ...preset } },
          },
        },
      };
    }
    case "RESET_NICHOLAS_CRITERIA": {
      // Todos os 13 critérios por domínio voltam a 1.00; multiplicadores de domínio intactos
      const nich = state.formData.criteriaWeights.nicholas;
      return {
        ...state,
        formData: {
          ...state.formData,
          criteriaWeights: {
            ...state.formData.criteriaWeights,
            nicholas: { ...nich, ...neutralNicholasCriteria() },
          },
        },
      };
    }
    case "RESET_NICHOLAS_DOMAIN": {
      // Multiplicadores de domínio (geo/ob/hw/fw) voltam a 1.00; critérios intactos
      const nich = state.formData.criteriaWeights.nicholas;
      return {
        ...state,
        formData: {
          ...state.formData,
          criteriaWeights: {
            ...state.formData.criteriaWeights,
            nicholas: { ...nich, domain: { ...DOMAIN_PRESETS.default } },
          },
        },
      };
    }
    case "RESET_CRITERIA_WEIGHTS":
      return { ...state, formData: { ...state.formData, criteriaWeights: makeDefaultCriteriaWeights() } };
    case "SET_RESULT":
      return { ...state, results: { ...state.results, [action.method]: action.payload } };
    case "CLEAR_RESULTS":
      return { ...state, results: initialState.results };
    default:
      return state;
  }
}

const MmsContext = createContext(null);

export function MmsProvider({ children }) {
  const [state, dispatch] = useReducer(mmsReducer, initialState);
  return (
    <MmsContext.Provider value={{ state, dispatch }}>
      {children}
    </MmsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMms() {
  const ctx = useContext(MmsContext);
  if (!ctx) throw new Error("useMms deve ser usado dentro de <MmsProvider>");
  return ctx;
}
