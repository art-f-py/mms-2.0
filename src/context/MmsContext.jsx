import { createContext, useContext, useReducer, useEffect } from "react";
import { normalizeThickness, normalizeRss } from "../data/formRules";
import { ENFOQUE_GROUP_IDS, WEIGHTING_MODES, equalGroupWeights, validateGroupWeights } from "../algorithms/enfoque";
import { REBALANCE_MODES, equalizeOtherGroups, rebalanceGroupWeights } from "../algorithms/enfoqueRebalance";
import { MCDM_SUPPORTED_METHODS } from "../algorithms/mcdmPipeline";

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
//
// `mode` escolhe QUEM decide os pesos: 'enfoque' (o usuário reparte 1.0 entre os
// quatro grupos) ou 'entropy' (a dispersão dos dados decide, sem controle
// manual — ver algorithms/entropyWeights.js). O default é 'enfoque', que é o
// comportamento que existia antes de o campo existir.
//
// OS groupWeights CONTINUAM GUARDADOS EM MODO 'entropy', ignorados em vez de
// descartados. Zerá-los ao trocar de modo faria o usuário perder a repartição
// que ajustou, e a perda só apareceria ao voltar para Enfoque e encontrar os
// sliders no uniforme. São quatro números; guardá-los custa nada e é o que
// torna a troca de modo reversível.
//
// `rebalanceMode` escolhe COMO os outros três grupos reagem quando um slider se
// move: 'proportional' preserva a proporção entre eles, 'equalize' os iguala
// (ver enfoqueRebalance.js). É preferência de INTERAÇÃO, não parte do modelo de
// pesos: nada no cálculo do TOPSIS a lê, e ela não viaja para dentro de um
// cenário salvo — um cenário guarda o resultado (os quatro pesos), não o
// caminho usado para chegar a ele. O default é 'proportional', o comportamento
// que existia antes de o campo existir.
const defaultMcdmWeights = () => ({
  mode:          WEIGHTING_MODES.ENFOQUE,
  rebalanceMode: REBALANCE_MODES.PROPORTIONAL,
  groupWeights:  equalGroupWeights(),
});

/** Os dois modos que a tela oferece hoje. 'none' existe em enfoque.js mas não é
 *  oferecido: é o modo sem ponderação declarada, que a UI não expõe. */
const MCDM_UI_MODES = [WEIGHTING_MODES.ENFOQUE, WEIGHTING_MODES.ENTROPY];

/** As duas políticas de rebalanceamento oferecidas pela tela. */
const MCDM_REBALANCE_MODES = Object.values(REBALANCE_MODES);

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
// Um cenário é uma CONFIGURAÇÃO DE PONDERAÇÃO COM NOME —
// {id, name, method, mode, groupWeights} — e nada mais. Deliberadamente NÃO
// guarda cópia congelada de ranking nem de formData.
//
// O motivo é o que a comparação precisa responder: "com os dados que tenho
// AGORA, o que muda se eu privilegiar economia em vez de geometria?". Um
// ranking congelado responderia outra pergunta — o que teria acontecido com os
// dados de ontem — e as duas dariam a mesma cara na tela, o que é a pior forma
// de errar. Guardando só a configuração, cada cenário recalcula contra o
// formData atual a cada render, e corrigir um RMR na etapa de geotecnia
// atualiza todas as colunas da comparação de uma vez.
//
// O CENÁRIO PASSOU A CARREGAR `method` E `mode`. Antes ele era method-agnóstico
// de propósito — a ideia era que uma repartição ("70% em Geometria") é uma
// POSTURA DE DECISÃO que faz o mesmo sentido em qualquer método, e a tabela a
// reaplicava contra o método selecionado na tela. Isso tinha um custo que só
// aparece quando se quer usar a tabela para valer: era impossível comparar
// Nicholas com UBC, porque TODAS as colunas mudavam de método juntas. Com o
// método dentro do cenário, cada coluna é uma pergunta completa e a tabela
// compara o que antes só dava para ver em duas telas separadas.
//
// `mode` entrou pelo mesmo raciocínio, um degrau adiante: Entropy não tem peso
// ajustável (os pesos saem da dispersão dos dados), então antes não havia o que
// salvar e o botão só existia em Enfoque. Mas o que se quer comparar não é a
// repartição — é o RANKING que ela produz —, e "Nicholas com pesos de Entropy"
// é um ranking tão legítimo quanto os outros. Em modo 'entropy' o cenário é
// nome + método + modo, e `groupWeights` fica `null`: não é campo faltando, é a
// ausência sendo dita explicitamente.
//
// Fica na RAIZ do estado, irmão de formData e results, e não dentro de
// criteriaWeights.mcdm: aquilo é a repartição em uso, uma só; isto é uma lista
// de configurações guardadas, com ciclo de vida próprio.
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

// ---------------------------------------------------------------------------
// DEFAULTS DE MIGRAÇÃO DOS CENÁRIOS SALVOS
// ---------------------------------------------------------------------------
// Cenários gravados no localStorage ANTES de o cenário carregar método e modo.
// Eles trazem só {id, name, groupWeights} e precisam de um valor para os dois
// campos novos — descartá-los apagaria a lista de quem já usava a comparação.
//
// `mode` é um FATO: 'enfoque' era a única opção que existia, porque o botão de
// salvar só aparecia nesse modo. Todo cenário antigo é de Enfoque, sem exceção.
//
// `method` É UM PALPITE, E ISTO PRECISA FICAR REGISTRADO: não há como saber com
// que método aquele cenário foi pensado. O modelo antigo era method-agnóstico DE
// PROPÓSITO — a repartição era reaplicada contra o método que estivesse
// selecionado na tela —, então a informação nunca foi gravada em lugar nenhum,
// e nenhum outro campo do estado a insinua. 'nicholas' é escolhido por ser o
// primeiro dos métodos suportados, não por evidência.
//
// A CONSEQUÊNCIA PRÁTICA, para quem for ler um cenário migrado: a coluna dele
// aparece rotulada "Nicholas" e é recalculada como Nicholas. Se o usuário
// pensava aquele cenário em UBC, o rótulo está errado e ele não tem como saber
// só de olhar. O remédio é do usuário e existe: apagar a coluna e salvar de
// novo com o método certo em foco, que é uma interação de dois cliques.
// Adivinhar melhor não é possível; o que é possível é não esconder o palpite.
const SCENARIO_MIGRATION_DEFAULTS = Object.freeze({
  mode:   WEIGHTING_MODES.ENFOQUE,
  method: "nicholas",
});

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
      //
      // DUAS POLÍTICAS, UMA PORTA. Qual das duas funções roda é decidido AQUI,
      // pelo `rebalanceMode` do estado, e não pela tela: o componente continua
      // despachando a mesma ação com grupo e valor, sem saber que existe
      // escolha. Trocar de modo não é um caso a mais no caminho de escrita — é
      // uma função diferente na mesma posição.
      const { group, value } = action;
      const mcdm = state.formData.criteriaWeights.mcdm;
      const rebalance = mcdm?.rebalanceMode === REBALANCE_MODES.EQUALIZE
        ? equalizeOtherGroups
        : rebalanceGroupWeights;
      return {
        ...state,
        formData: {
          ...state.formData,
          criteriaWeights: {
            ...state.formData.criteriaWeights,
            mcdm: { ...mcdm, groupWeights: rebalance(mcdm?.groupWeights, group, value) },
          },
        },
      };
    }
    case "SET_MCDM_REBALANCE_MODE": {
      // Só a preferência muda. Os pesos ficam onde estão de propósito: trocar a
      // política não é um ajuste de peso, e re-igualar os quatro na hora da
      // troca descartaria a repartição atual sem que ninguém tenha mexido em
      // slider nenhum. A nova política vale do próximo arraste em diante.
      const mcdm = state.formData.criteriaWeights.mcdm;
      return {
        ...state,
        formData: {
          ...state.formData,
          criteriaWeights: {
            ...state.formData.criteriaWeights,
            mcdm: { ...mcdm, rebalanceMode: action.rebalanceMode },
          },
        },
      };
    }
    case "SET_MCDM_MODE": {
      // Só o modo muda. `groupWeights` viaja intacto de propósito — ver o
      // comentário em defaultMcdmWeights sobre a troca de modo ser reversível.
      const mcdm = state.formData.criteriaWeights.mcdm;
      return {
        ...state,
        formData: {
          ...state.formData,
          criteriaWeights: {
            ...state.formData.criteriaWeights,
            mcdm: { ...mcdm, mode: action.mode },
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
      //
      // MÉTODO E MODO VÊM DA AÇÃO, e não são lidos do estado aqui: o método em
      // foco é estado da TELA (vive em Statistics.jsx, ver lá o porquê) e não
      // existe no reducer. O modo existe — em criteriaWeights.mcdm.mode —, mas
      // lê-lo daqui criaria duas fontes para a mesma decisão; o componente já
      // sabe em que modo o usuário clicou em salvar, e é esse o modo do
      // cenário.
      const entropia = action.mode === WEIGHTING_MODES.ENTROPY;
      const scenario = {
        id:     makeScenarioId(),
        name:   action.name,
        method: action.method,
        mode:   entropia ? WEIGHTING_MODES.ENTROPY : WEIGHTING_MODES.ENFOQUE,
        // `null` em Entropy, e não os pesos atuais "por via das dúvidas":
        // guardá-los faria a coluna carregar uma repartição que o cálculo dela
        // ignora, e que passaria a divergir do que a tela mostra assim que o
        // usuário mexesse num slider. Nada a guardar é nada a guardar.
        groupWeights: entropia ? null : pickGroupWeights(action.groupWeights),
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
  const mcdm            = criteriaWeights?.mcdm;
  const groupWeights    = mcdm?.groupWeights;

  if (groupWeights) {
    try {
      validateGroupWeights(groupWeights);

      // Pesos válidos, mas `mode` e `rebalanceMode` podem faltar (estado
      // gravado por uma versão anterior a cada um deles) ou não ser um dos
      // valores que a tela oferece. Em todos os casos os PESOS são bons e
      // ficam — só o campo torto é reposto. Trocar a sub-árvore inteira aqui
      // descartaria uma repartição legítima por causa de um campo que aquela
      // versão nem tinha como gravar.
      //
      // Os dois defaults repõem o comportamento anterior à existência do
      // campo, e não o "melhor" valor: Enfoque era o único modo, e o
      // rebalanceamento era sempre proporcional.
      const modeOk      = MCDM_UI_MODES.includes(mcdm.mode);
      const rebalanceOk = MCDM_REBALANCE_MODES.includes(mcdm.rebalanceMode);
      if (modeOk && rebalanceOk) return formData;

      return {
        ...formData,
        criteriaWeights: {
          ...criteriaWeights,
          mcdm: {
            ...mcdm,
            mode:          modeOk      ? mcdm.mode          : WEIGHTING_MODES.ENFOQUE,
            rebalanceMode: rebalanceOk ? mcdm.rebalanceMode : REBALANCE_MODES.PROPORTIONAL,
          },
        },
      };
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
 *
 * DUAS COISAS DIFERENTES ACONTECEM COM `method` E `mode`, e a distinção é o
 * ponto:
 *
 *   AUSENTE  -> migração. O cenário foi gravado por uma versão que não tinha o
 *               campo, e recebe o default de SCENARIO_MIGRATION_DEFAULTS (ver
 *               lá, inclusive a ressalva de que o `method` é palpite).
 *   PRESENTE E INVÁLIDO -> descarte, junto com o cenário. Um método que não
 *               existe, ou um modo que a tela não oferece, só chega aqui por
 *               localStorage adulterado. Substituí-lo por um default seria
 *               inventar uma comparação que ninguém pediu — o mesmo erro que a
 *               regra dos pesos já recusa a cometer.
 *
 * E `groupWeights` é validado SÓ EM ENFOQUE. Em Entropy o cenário guarda `null`
 * de propósito, e exigir quatro pesos somando 1 de um cenário que não tem pesos
 * apagaria justamente os cenários de Entropy na primeira releitura.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function normalizeScenarios(saved) {
  if (!Array.isArray(saved)) return emptyScenarios();

  return saved.flatMap((scenario) => {
    if (!scenario || typeof scenario.id !== "string") return [];

    const mode = scenario.mode === undefined || scenario.mode === null
      ? SCENARIO_MIGRATION_DEFAULTS.mode
      : scenario.mode;
    if (!MCDM_UI_MODES.includes(mode)) return [];

    const method = scenario.method === undefined || scenario.method === null
      ? SCENARIO_MIGRATION_DEFAULTS.method
      : scenario.method;
    if (!MCDM_SUPPORTED_METHODS.includes(method)) return [];

    if (mode === WEIGHTING_MODES.ENTROPY) {
      return [{
        id:   scenario.id,
        name: typeof scenario.name === "string" ? scenario.name : "",
        method,
        mode,
        groupWeights: null,
      }];
    }

    const groupWeights = pickGroupWeights(scenario.groupWeights);
    try {
      validateGroupWeights(groupWeights);
    } catch {
      return [];
    }
    return [{
      id:   scenario.id,
      name: typeof scenario.name === "string" ? scenario.name : "",
      method,
      mode,
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
