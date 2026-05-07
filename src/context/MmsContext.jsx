import { createContext, useContext, useReducer } from "react";

// ---------------------------------------------------------------------------
// Estado inicial
// ---------------------------------------------------------------------------
const initialState = {
  selectedMethod: "ubc",   // método de seleção ativo na página de inputs
  results: {
    ubc:       null,   // { scores, ranking, eliminatedList, breakdown }
    nicholas81: null,
    nicholas92: null,
    shb:        null,
  },
};

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------
function mmsReducer(state, action) {
  switch (action.type) {
    case "SET_METHOD":
      return { ...state, selectedMethod: action.payload };

    case "SET_RESULT":
      return {
        ...state,
        results: {
          ...state.results,
          [action.method]: action.payload,   // ex: action.method = "ubc"
        },
      };

    case "CLEAR_RESULTS":
      return { ...state, results: initialState.results };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context + Provider
// ---------------------------------------------------------------------------
const MmsContext = createContext(null);

export function MmsProvider({ children }) {
  const [state, dispatch] = useReducer(mmsReducer, initialState);
  return (
    <MmsContext.Provider value={{ state, dispatch }}>
      {children}
    </MmsContext.Provider>
  );
}

// Hook de conveniência
export function useMms() {
  const ctx = useContext(MmsContext);
  if (!ctx) throw new Error("useMms deve ser usado dentro de <MmsProvider>");
  return ctx;
}
