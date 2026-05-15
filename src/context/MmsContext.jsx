import { createContext, useContext, useReducer } from "react";
import { DEFAULT_MULTIPLIERS } from "../algorithms/nicholas92Weights";

const initialFormData = {
  selectedMethods: { ubc: true, nicholas81: false, nicholas92: false, shb: false },
  geometry:        { shape: "", thickness: "", grade: "" },
  dip:             "",
  depth:           { ore: "", hangingWall: "", footwall: "" },  // ← todos os domínios
  density:         { ore: "", hangingWall: "", footwall: "" },
  ucs:             { ore: "", hangingWall: "", footwall: "" },
  rss:             { ore: "", hangingWall: "", footwall: "" },
  rmr:             { ore: "", hangingWall: "", footwall: "" },
  jointSpacing:    { ore: "", hangingWall: "", footwall: "" },
  jointCondition:  { ore: "", hangingWall: "", footwall: "" },
  oreValue:        "",
  multipliers:     { ...DEFAULT_MULTIPLIERS },
};

const initialState = {
  formData: initialFormData,
  results: {
    ubc:        null,
    nicholas81: null,
    nicholas92: null,
    shb:        null,
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
    case "SET_MULTIPLIER":
      return {
        ...state,
        formData: {
          ...state.formData,
          multipliers: { ...state.formData.multipliers, [action.key]: action.value },
        },
      };
    case "RESET_MULTIPLIERS":
      return { ...state, formData: { ...state.formData, multipliers: { ...DEFAULT_MULTIPLIERS } } };
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

export function useMms() {
  const ctx = useContext(MmsContext);
  if (!ctx) throw new Error("useMms deve ser usado dentro de <MmsProvider>");
  return ctx;
}
