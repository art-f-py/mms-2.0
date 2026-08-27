import { createContext, useContext, useReducer, useEffect } from "react";
import { normalizeThickness, normalizeRss } from "../data/formRules";
import { ENFOQUE_GROUP_IDS, equalGroupWeights, validateGroupWeights } from "../algorithms/enfoque";
import { rebalanceGroupWeights } from "../algorithms/enfoqueRebalance";

const STORAGE_KEY = "mms2-state";

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

// Pesos do Enfoque (MCDM/TOPSIS) — os quatro grupos de critérios, somando 1.
//
// Sub-árvore própria, e não mais um domínio dentro de `nicholas`, porque não é
// a mesma coisa: `nicholas` guarda os multiplicadores das TABELAS do Nicholas
// (0–2, neutro em 1), que entram no cálculo clássico exibido pelos MethodBlock.
// Isto aqui é a ponderação por GRUPO do pipeline MCDM (0–1, somando 1), que
// roda em paralelo e não toca no resultado clássico.
//
// Uniforme (0.25 em cada grupo) é o único ponto de partida que não embute uma
// preferência — ver equalGroupWeights em algorithms/enfoque.js, inclusive a
// ressalva de que uniforme entre GRUPOS não é uniforme entre CRITÉRIOS.
const defaultMcdmWeights = () => ({ groupWeights: equalGroupWeights() });

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
  mcdm: defaultMcdmWeights(),
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

// ---------------------------------------------------------------------------
// CENÁRIOS DO MCDM
// ---------------------------------------------------------------------------
// Um cenário é uma REPARTIÇÃO DE PESOS COM NOME — {id, name, groupWeights} — e
// nada mais. Deliberadamente NÃO guarda cópia congelada de ranking nem de
// formData.
//
// O motivo é o que a comparação precisa responder: "com os dados que tenho
// AGORA, o que muda se eu privilegiar economia em vez de geometria?". Um
// ranking congelado responderia outra pergunta — o que teria acontecido com os
// dados de ontem — e as duas dariam a mesma cara na tela, o que é a pior forma
// de errar. Guardando só os pesos, cada cenário recalcula contra o formData
// atual a cada render, e corrigir um RMR na etapa de geotecnia atualiza todas
// as colunas da comparação de uma vez.
//
// Fica na RAIZ do estado, irmão de formData e results, e não dentro de
// criteriaWeights.mcdm: aquilo é a repartição em uso, uma só; isto é uma lista
// de repartições guardadas, com ciclo de vida próprio.
const emptyScenarios = () => [];

/**
 * Id de cenário. Só precisa ser único dentro da lista do usuário — não é chave
 * de banco nem trafega para lugar nenhum. `crypto.randomUUID` quando existe (é
 * o caso de todo navegador que roda este app e do Node dos testes); o fallback
 * cobre contextos não seguros, onde a API não é exposta.
 */
function makeScenarioId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Cópia dos quatro pesos nomeados, e só deles.
 *
 * Copiar chave a chave em vez de espalhar o objeto recebido é o que impede um
 * cenário de carregar lixo: chave desconhecida vinda de estado adulterado não
 * entra, e o objeto guardado não compartilha referência com o do formulário —
 * um cenário salvo não pode mudar sozinho quando o slider se mexe depois.
 */
const pickGroupWeights = (weights) =>
  Object.fromEntries(ENFOQUE_GROUP_IDS.map((id) => [id, weights?.[id] ?? 0]));

const initialState = {
  formData: initialFormData,
  results: {
    ubc:      null,
    nicholas: null,
    shb:      null,
  },
  mcdmScenarios: emptyScenarios(),
};

// eslint-disable-next-line react-refresh/only-export-components
export function mmsReducer(state, action) {
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
    case "SET_MCDM_GROUP_WEIGHT": {
      // O rebalanceamento mora AQUI, e não no componente, para que não exista
      // caminho pelo qual um vetor de pesos inválido chegue ao estado. O
      // reducer é a única porta de entrada; fechá-la torna a soma 1 um
      // invariante do estado, não uma convenção que a tela precisa lembrar.
      const { group, value } = action;
      const mcdm = state.formData.criteriaWeights.mcdm;
      return {
        ...state,
        formData: {
          ...state.formData,
          criteriaWeights: {
            ...state.formData.criteriaWeights,
            mcdm: { ...mcdm, groupWeights: rebalanceGroupWeights(mcdm?.groupWeights, group, value) },
          },
        },
      };
    }
    case "ADD_MCDM_SCENARIO": {
      // O id nasce AQUI, e não no componente, para que a tela não precise
      // conhecer a regra de unicidade da lista. É a única coisa não
      // determinística do reducer, e é assumida: a alternativa seria o
      // componente gerar o id e passá-lo na ação, o que só move o mesmo efeito
      // para um lugar onde ele fica mais fácil de esquecer.
      const scenario = {
        id:           makeScenarioId(),
        name:         action.name,
        groupWeights: pickGroupWeights(action.groupWeights),
      };
      return { ...state, mcdmScenarios: [...state.mcdmScenarios, scenario] };
    }
    case "REMOVE_MCDM_SCENARIO":
      return { ...state, mcdmScenarios: state.mcdmScenarios.filter((s) => s.id !== action.id) };
    case "RESET_CRITERIA_WEIGHTS":
      return { ...state, formData: { ...state.formData, criteriaWeights: makeDefaultCriteriaWeights() } };
    case "SET_RESULT":
      return { ...state, results: { ...state.results, [action.method]: action.payload } };
    case "CLEAR_RESULTS":
      return { ...state, results: initialState.results };
    case "RESET_ALL":
      // Volta ao estado inicial com objetos frescos (formData + resultados limpos).
      //
      // Os cenários salvos vão junto. Eles são pesos guardados PARA COMPARAR
      // contra um depósito; sobrevivendo a um "limpar tudo", reapareceriam na
      // comparação do próximo depósito com nomes que se referem ao anterior —
      // e a comparação recalcula ao vivo, então eles nem estariam errados, só
      // sem sentido. Além disso, omitir a chave aqui a apagaria do estado.
      return {
        formData:      { ...initialFormData, criteriaWeights: makeDefaultCriteriaWeights() },
        results:       { ubc: null, nicholas: null, shb: null },
        mcdmScenarios: emptyScenarios(),
      };
    default:
      return state;
  }
}

const MmsContext = createContext(null);

/**
 * Repõe a sub-árvore de pesos do MCDM no estado vindo do localStorage.
 *
 * Necessária porque o merge de loadInitialState é RASO: `criteriaWeights` do
 * estado salvo substitui o objeto inteiro do default, e não se funde com ele.
 * Um usuário que já tinha estado persistido antes desta versão traria um
 * `criteriaWeights` sem a chave `mcdm`, e a tela leria `mcdm.groupWeights` de
 * `undefined`. Mesma família dos normalizadores de formRules (normalizeThickness
 * /normalizeRss): consertar o que uma versão anterior do app deixou gravado.
 *
 * Pesos gravados que não passam na validação também são descartados — a única
 * origem legítima deles é rebalanceGroupWeights, que nunca produz vetor
 * inválido, então um vetor torto aqui é localStorage adulterado ou corrompido.
 * Cair no uniforme é melhor que deixar o bloco permanentemente indisponível
 * por causa de um valor que o usuário não tem como consertar pela tela.
 *
 * Devolve o mesmo objeto quando não há nada a corrigir.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function normalizeMcdmWeights(formData) {
  const criteriaWeights = formData.criteriaWeights;
  const groupWeights    = criteriaWeights?.mcdm?.groupWeights;

  if (groupWeights) {
    try {
      validateGroupWeights(groupWeights);
      return formData;
    } catch {
      // Cai para a reposição abaixo.
    }
  }

  return {
    ...formData,
    criteriaWeights: { ...(criteriaWeights || {}), mcdm: defaultMcdmWeights() },
  };
}

/**
 * Sanea a lista de cenários vinda do localStorage.
 *
 * Mesmo espírito de normalizeMcdmWeights, e pela mesma razão: o que está
 * gravado veio de uma versão anterior do app ou de um JSON que alguém editou
 * na mão, e um cenário torto não pode deixar a aba de comparação
 * permanentemente quebrada — a tela não oferece jeito de apagá-lo se ela nem
 * chega a renderizar.
 *
 * Cenário sem id ou sem pesos válidos é DESCARTADO, não consertado: um peso
 * inventado no lugar do que estava gravado seria uma comparação silenciosamente
 * falsa, pior que um cenário a menos. Os pesos passam por pickGroupWeights e
 * por validateGroupWeights — as mesmas regras da entrada pela tela.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function normalizeScenarios(saved) {
  if (!Array.isArray(saved)) return emptyScenarios();

  return saved.flatMap((scenario) => {
    if (!scenario || typeof scenario.id !== "string") return [];
    const groupWeights = pickGroupWeights(scenario.groupWeights);
    try {
      validateGroupWeights(groupWeights);
    } catch {
      return [];
    }
    return [{
      id:   scenario.id,
      name: typeof scenario.name === "string" ? scenario.name : "",
      groupWeights,
    }];
  });
}

// Carrega o formData e os cenários persistidos; os resultados NÃO são
// restaurados — ao reabrir, o usuário revê os inputs mas precisa recalcular.
//
// Os cenários entram no grupo do que É restaurado, e não no dos resultados, por
// serem entrada do usuário e não saída de cálculo: são quatro números que
// alguém escolheu e batizou. Restaurá-los não congela conclusão nenhuma, já que
// o ranking de cada um é recalculado ao vivo contra o formData do momento.
function loadInitialState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return initialState;
    const parsed = JSON.parse(saved);
    return {
      ...initialState,
      // Estado salvo antes destas regras pode trazer as combinações órfãs
      // (espessura fora do select, RSS manual sem UI de origem) ou vir sem a
      // sub-árvore de pesos do MCDM, acrescentada depois.
      formData: normalizeMcdmWeights(
        normalizeRss(normalizeThickness({ ...initialFormData, ...(parsed.formData || {}) })),
      ),
      // Ausente no estado gravado por versões anteriores a esta — vira lista vazia.
      mcdmScenarios: normalizeScenarios(parsed.mcdmScenarios),
    };
  } catch {
    return initialState;
  }
}

export function MmsProvider({ children }) {
  const [state, dispatch] = useReducer(mmsReducer, undefined, loadInitialState);

  // Persiste formData e cenários a cada mudança (resultados ficam de fora de
  // propósito). As duas dependências são separadas porque mudam em ritmos bem
  // diferentes: o formulário a cada tecla, os cenários só quando o usuário
  // salva ou remove um.
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ formData: state.formData, mcdmScenarios: state.mcdmScenarios }),
      );
    } catch {
      // localStorage indisponível ou cota excedida — ignora
    }
  }, [state.formData, state.mcdmScenarios]);

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
