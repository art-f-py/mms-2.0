import { createContext, useContext, useReducer } from "react";

const initialState = {
  results: {
    ubc:        null,
    nicholas81: null,
    nicholas92: null,
    shb:        null,
  },
};

function mmsReducer(state, action) {
  switch (action.type) {
    case "SET_RESULT":
      return {
        ...state,
        results: { ...state.results, [action.method]: action.payload },
      };
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
