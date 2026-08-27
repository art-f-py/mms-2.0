import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMms } from "../context/MmsContext";
import { ENFOQUE_GROUP_IDS } from "../algorithms/enfoque";
import { CRITERION_GROUPS, FIXED_CRITERIA_BY_ID } from "../algorithms/mcdmCriteria";
import { MCDM_PENDING_METHODS } from "../algorithms/mcdmPipeline";
import { deriveMcdmRanking, MCDM_STATUS } from "../utils/mcdmRanking";
import { buildMatrixColumns } from "../utils/mcdmMatrixLayout";
import { uiMethodLabel } from "../utils/methodLabel";
import { parseWeightInput } from "../utils/weightInput";

// ---------------------------------------------------------------------------
// BLOCO MCDM — ENFOQUE (PESO POR GRUPO) + TOPSIS, SÓ NICHOLAS
// ---------------------------------------------------------------------------
// Conteúdo da aba "Decisão multicritério" de /statistics. O ranking daqui é
// DERIVADO a cada render a partir do formulário e dos pesos de grupo — nunca
// passa por state.results, que segue com os três slots fixos (ubc/nicholas/shb)
// dos métodos clássicos e não foi tocado.
//
// A consequência boa disso é que mexer num slider atualiza o ranking na hora,
// sem "recalcular": não há resultado congelado a invalidar. O useMemo existe
// para o pipeline não rodar de novo a cada render que não mudou nem o
// formulário nem os pesos.

// Tokens semânticos → variáveis CSS centralizadas em index.css.
// Mesmo conjunto que Statistics.jsx usa, para o bloco não destoar dos vizinhos.
const colors = {
  primary:   "var(--color-primary)",
  primary50: "var(--color-primary-50)",
  border:    "var(--color-border)",
  text:      "var(--color-text)",
  muted:     "var(--color-muted)",
  bg:        "var(--color-bg)",
  white:     "var(--color-white)",
};

// Uma cor por grupo de critérios. Os tokens são novos e vivem em index.css
// junto dos demais --color-* — ver lá o porquê de terem virado matizes próprios
// em vez de quatro opacidades da primária, que era a versão anterior.
//
// Chaveado por CRITERION_GROUPS, e não pelas strings soltas: se um id de grupo
// mudar lá na camada de algoritmo, isto quebra no import em vez de devolver
// `undefined` e pintar quatro segmentos transparentes.
const GROUP_COLORS = {
  [CRITERION_GROUPS.GEOMETRY]:     "var(--color-mcdm-geometry)",
  [CRITERION_GROUPS.GEOMECHANICS]: "var(--color-mcdm-geomechanics)",
  [CRITERION_GROUPS.TECHNICAL]:    "var(--color-mcdm-technical)",
  [CRITERION_GROUPS.ECONOMIC]:     "var(--color-mcdm-economic)",
};

// Critério sem grupo não deveria existir, mas buildMatrixColumns o mantém em vez
// de descartá-lo (ver lá o porquê). Se aparecer, sai no cinza de borda — visível
// como "algo fora do lugar", que é exatamente o efeito desejado.
const groupColor = (groupId) => GROUP_COLORS[groupId] ?? colors.border;

const panelStyle = {
  border:       `1px solid ${colors.border}`,
  padding:      "16px",
  borderRadius: "6px",
};

// Mesmo cabeçalho de painel dos blocos clássicos (Statistics.jsx), com a cor
// vindo do token em vez do hex inline de lá.
const panelTitleStyle = {
  marginTop:     0,
  fontSize:      "13px",
  color:         colors.muted,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

// ---------------------------------------------------------------------------
// BARRA DE PROPORÇÃO
// ---------------------------------------------------------------------------
// Quatro segmentos com flexGrow igual ao peso e flexBasis 0: a largura de cada
// um é exatamente a fração que ele representa, porque os pesos somam 1. Peso
// zero vira segmento de largura zero e desaparece sozinho, sem caso especial.
function ProportionBar({ groups }) {
  return (
    <div style={{ display: "flex", width: "100%", height: "20px", borderRadius: "4px", overflow: "hidden", border: `1px solid ${colors.border}` }}>
      {groups.map(({ id, label, value, color }) => (
        <div
          key={id}
          title={`${label} — ${(value * 100).toFixed(0)}%`}
          style={{ flexGrow: value, flexBasis: 0, minWidth: 0, backgroundColor: color }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SLIDER DE GRUPO
// ---------------------------------------------------------------------------
// Adaptação local do WeightSlider de Inputs.jsx — cópia deliberada, não
// descuido. Aquele é 0–2 com neutro em 1 (multiplicador de tabela); este é 0–1
// somando 1 entre os quatro (repartição), e traz o quadradinho na cor do grupo
// que o liga ao segmento da barra e ao cabeçalho da coluna na matriz.
// Extrair um componente comum obrigaria a mexer em Inputs.jsx, fora do escopo;
// se um terceiro tipo de slider aparecer, aí a extração se paga.
//
// O rótulo trunca e o campo numérico é empurrado para a direita por
// marginLeft:auto: na coluna estreita ao lado da matriz, "Técnico-Operacional"
// não cabe inteiro, e sem isso o número seria o primeiro a ser cortado — justo
// o que não pode sumir.
//
// DOIS CONTROLES, UM CAMINHO SÓ. O campo numérico não é uma via paralela de
// escrita: ele chama o MESMO `onChange` do slider, que vira o mesmo
// SET_MCDM_GROUP_WEIGHT e passa pelo mesmo rebalanceGroupWeights. Arrastar e
// digitar 0.40 produzem estado idêntico, porque são literalmente a mesma
// chamada com o mesmo número.
//
// O RASCUNHO (`draft`) existe porque digitar é diferente de arrastar. O slider
// só produz valores válidos; o teclado passa por estados intermediários que não
// são números ("", "0.", "-") a caminho de um que é. Sem um rascunho local, o
// campo teria de ser controlado pelo peso do estado, e cada tecla seria
// reescrita pelo valor de volta — apagar o "0.25" para digitar "0.4" seria
// impossível, porque o campo se recusaria a ficar vazio no meio do caminho.
// Enquanto `draft` não é null o campo mostra o que a pessoa escreveu; quando
// ela sai, ele volta a espelhar o estado (que o rebalanceamento pode ter
// arredondado) e os dois controles voltam a concordar.
//
// ENTRADA INVÁLIDA NÃO CHEGA AO DISPATCH, e isso não é zelo excessivo:
// rebalanceGroupWeights LANÇA RangeError para valor fora de [0, 1] ou não
// finito. Despachar "abc" ou 5 derrubaria o reducer e, com ele, a tela. Aqui o
// texto inválido fica visível no campo, sem virar estado — o usuário vê o que
// digitou, o peso não se mexe, e nada quebra.
function GroupSlider({ label, value, color, onChange }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(null);

  const handleTyped = (text) => {
    setDraft(text);
    const parsed = parseWeightInput(text);
    if (parsed !== null) onChange(parsed);
  };

  // Fora de edição o campo mostra o peso do estado com duas casas — as mesmas
  // do passo do slider. Sem o arredondamento, um rebalanceamento devolveria
  // 0.19999999999999998 para dentro de um campo de step 0.01.
  const shown = draft ?? value.toFixed(2);

  return (
    <div>
      <label style={{ fontSize: "14px", fontWeight: "600", color: colors.text, marginBottom: "6px", display: "flex", alignItems: "center", gap: "8px" }}>
        <span
          aria-hidden="true"
          style={{ width: "12px", height: "12px", borderRadius: "3px", flexShrink: 0, backgroundColor: color }}
        />
        <span title={label} style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <input
          type="range" min={0} max={1} step="0.01"
          style={{ flex: 1, minWidth: 0, accentColor: color }}
          value={value}
          aria-label={label}
          onChange={(e) => {
            // Arrastar encerra qualquer edição pendente: os dois controles
            // mostram o mesmo peso, e um rascunho sobrevivente congelaria o
            // campo num número que o slider acabou de deixar para trás.
            setDraft(null);
            onChange(parseFloat(e.target.value));
          }}
        />
        <input
          type="number" min={0} max={1} step="0.01"
          style={{
            width:            "68px",
            flexShrink:       0,
            padding:          "4px 6px",
            fontSize:         "13px",
            fontWeight:       "700",
            color:            colors.primary,
            border:           `1px solid ${colors.border}`,
            borderRadius:     "4px",
            backgroundColor:  colors.white,
            fontVariantNumeric: "tabular-nums",
          }}
          value={shown}
          aria-label={`${label} — ${t("results.mcdm.matrix.weight")}`}
          onChange={(e) => handleTyped(e.target.value)}
          onBlur={() => setDraft(null)}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PAINEL DE PESOS
// ---------------------------------------------------------------------------
// UM painel só, renderizado em dois lugares diferentes conforme a matriz esteja
// aberta ou fechada — não duas cópias, e sem estado próprio. `stacked` é a
// única diferença entre os dois casos: na coluna estreita ao lado da matriz os
// quatro sliders empilham, porque duas colunas de slider dentro de 260px não
// caberiam.
function WeightsPanel({ groups, stacked, onChange, onSaveScenario }) {
  const { t } = useTranslation();

  // Nome do cenário em digitação. Estado LOCAL, e não no contexto: é rascunho
  // de formulário, some quando o cenário é salvo e não interessa a mais
  // ninguém. Mandá-lo para o reducer faria cada tecla reescrever o estado
  // global — e o formData persistido junto.
  const [name, setName] = useState("");

  // Nome em branco não vira cenário: a coluna sairia sem cabeçalho e não
  // haveria como distingui-la das outras na comparação. `trim` porque " " é
  // exatamente o mesmo problema com aparência de nome.
  const trimmed  = name.trim();
  const canSave  = trimmed.length > 0;

  const save = () => {
    if (!canSave) return;
    onSaveScenario(trimmed);
    setName("");
  };

  return (
    <div style={panelStyle}>
      <h4 style={panelTitleStyle}>{t("results.mcdm.weightsTitle")}</h4>
      <p style={{ fontSize: "13px", color: colors.muted, margin: "0 0 14px" }}>
        {t("results.mcdm.weightsHint")}
      </p>

      <p style={{ ...panelTitleStyle, fontSize: "11px", marginBottom: "6px" }}>
        {t("results.mcdm.proportionTitle")}
      </p>
      <ProportionBar groups={groups} />

      <div
        className={stacked ? undefined : "mms-grid2"}
        style={stacked ? { display: "grid", gap: "14px", marginTop: "18px" } : { marginTop: "18px" }}
      >
        {groups.map(({ id, label, value, color }) => (
          <GroupSlider key={id} label={label} value={value} color={color} onChange={(v) => onChange(id, v)} />
        ))}
      </div>

      {/* SALVAR CENÁRIO — campo inline, não window.prompt(). O prompt do
          navegador bloqueia a página inteira, não é estilizável e some do fluxo
          de teclado; e aqui ele esconderia justamente os sliders que a pessoa
          acabou de ajustar e está tentando batizar. O campo fica ao lado dos
          pesos que ele vai guardar.

          Envolve um <form> para que Enter no campo salve — é o que se espera de
          um campo de texto com um botão do lado, e sai de graça. */}
      <form
        onSubmit={(e) => { e.preventDefault(); save(); }}
        style={{ marginTop: "18px", paddingTop: "14px", borderTop: `1px solid ${colors.border}`, display: "flex", flexWrap: "wrap", gap: "8px" }}
      >
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("results.mcdm.scenarios.namePlaceholder")}
          aria-label={t("results.mcdm.scenarios.namePlaceholder")}
          style={{
            flex: "1 1 120px", minWidth: 0, padding: "8px 10px", minHeight: "44px",
            fontSize: "13px", color: colors.text, backgroundColor: colors.white,
            border: `1px solid ${colors.border}`, borderRadius: "6px",
          }}
        />
        <button
          type="submit"
          disabled={!canSave}
          style={{
            flex: "0 1 auto", padding: "8px 14px", minHeight: "44px", fontSize: "13px", fontWeight: "700",
            borderRadius: "6px", cursor: canSave ? "pointer" : "not-allowed",
            backgroundColor: canSave ? colors.primary : colors.bg,
            color:           canSave ? colors.white : colors.muted,
            border:          `1px solid ${canSave ? colors.primary : colors.border}`,
          }}
        >
          {t("results.mcdm.scenarios.save")}
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ACORDEÃO
// ---------------------------------------------------------------------------
// Mesmo padrão (e mesmo visual) do Collapsible de Inputs.jsx, reescrito aqui
// pelo mesmo motivo do GroupSlider: aquele é local do Inputs e não é exportado.
//
// `{open && children}` em vez de esconder por CSS não é detalhe: com o acordeão
// fechado a tabela não existe no DOM, então arrastar um slider não paga nada por
// ela. É o que dispensa qualquer debounce no caso comum.
function Collapsible({ title, open, onToggle, children }) {
  return (
    <div style={{ border: `1px solid ${colors.border}`, borderRadius: "8px", overflow: "hidden" }}>
      <button
        onClick={onToggle}
        aria-expanded={open}
        style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", minHeight: "44px", backgroundColor: colors.primary50, border: "none", cursor: "pointer", fontSize: "15px", fontWeight: "700", color: colors.primary }}
      >
        <span>{title}</span>
        <span style={{ fontSize: "13px" }} aria-hidden="true">{open ? "▾" : "▸"}</span>
      </button>
      {open && <div style={{ padding: "18px" }}>{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MATRIZ DE DECISÃO AO VIVO
// ---------------------------------------------------------------------------
// A matriz que o TOPSIS de fato leu, TRANSPOSTA em relação à aba: um método de
// lavra por LINHA, um critério por COLUNA.
//
// A transposição é o que torna a tabela legível. Na orientação da aba (critério
// por linha) as dez colunas de método se repetiam ao longo de 19 linhas, e a
// comparação natural — "como este método se sai em tudo" — exigia uma leitura
// vertical saltando de linha em linha. Assim, cada método é uma linha só, e são
// dez linhas em vez de vinte e três.
//
// A ORDEM DAS LINHAS É FIXA — a ordem de METHODS, que `sheet.rows` já traz. NÃO
// é reordenada por colocação: com o ranking mudando a cada centésimo de slider,
// as linhas trocariam de lugar durante o arraste e seria impossível seguir uma
// delas com os olhos. Quem quer a ordem por colocação tem os cartões de ranking
// logo acima, que existem exatamente para isso.
//
// DUAS VELOCIDADES DIFERENTES NA MESMA TABELA, e isso é fácil de ler errado.
// O PESO no cabeçalho de cada coluna muda ao vivo a cada slider: ele é
// `weights`, a repartição do Enfoque. As células de método × critério NÃO mudam
// com os sliders — são os valores da aba, os scores das tabelas do Nicholas (já
// convertidos para Saaty) e dos seis critérios fixos, e só o FORMULÁRIO os
// altera. É a distinção entre "quanto este critério importa" (peso, escolha do
// usuário) e "quanto este método pontua neste critério" (dado da publicação).
// Quem espera a célula acompanhar o slider vai achar que a tabela travou; ela
// não travou.

// Largura fixa por coluna: 19 colunas não cabem em tela nenhuma, e deixar o
// navegador distribuir produziria colunas de larguras diferentes conforme o
// tamanho do rótulo — o que atrapalha justamente a comparação horizontal que a
// transposição veio favorecer.
const CRIT_COL_WIDTH   = 96;
const METHOD_COL_WIDTH = 150;

function DecisionMatrixTable({ sheet, weights, criterionIds }) {
  const { t } = useTranslation();

  // Sem useMemo de propósito: `criterionIds` é um array novo a cada execução do
  // pipeline, então uma memoização por identidade nunca acertaria o cache — e
  // reagrupar 19 itens custa menos que a comparação que evitaria fazê-lo.
  const { columns, groups } = buildMatrixColumns(criterionIds);

  // Rótulo do critério. Os 13 clássicos já têm chave em results.criteria (a
  // mesma que o radar de breakdown dos blocos clássicos usa); os 6 fixos são
  // novos e entram em results.mcdm.fixedCriteria. O rótulo de exportação da
  // própria aba (inglês) fica como último recurso — se aparecer na tela, é
  // sinal de critério novo sem chave, não de tradução pendente.
  const criterionLabel = (id, fallback) =>
    id in FIXED_CRITERIA_BY_ID
      ? t(`results.mcdm.fixedCriteria.${id}`, fallback)
      : t(`results.criteria.${id}`, fallback);

  // Inteiro sai sem casas (a escala de Saaty e os critérios técnicos são
  // inteiros); o resto com duas, para o índice de custo não virar um número
  // redondo que ele não é.
  const cell = (v) =>
    typeof v !== "number" || Number.isNaN(v) ? "—" : Number.isInteger(v) ? String(v) : v.toFixed(2);

  const baseCell = {
    padding:      "6px 8px",
    borderBottom: `1px solid ${colors.border}`,
    whiteSpace:   "nowrap",
  };

  // A coluna de método acompanha a rolagem horizontal. Sem isso, dez colunas
  // adiante o usuário não sabe mais de que método é a linha que está lendo.
  //
  // Duas condições que parecem detalhe e não são: o fundo precisa ser OPACO (as
  // demais células passariam por baixo) e a tabela precisa de
  // `border-collapse: separate` (com as bordas colapsadas o navegador as
  // descarta na célula fixada, e a coluna de método fica sem separação visual
  // enquanto a tabela rola). Daí borderSpacing zero e bordas célula a célula.
  const stickyMethod = {
    position:    "sticky",
    left:        0,
    zIndex:      1,
    width:       `${METHOD_COL_WIDTH}px`,
    minWidth:    `${METHOD_COL_WIDTH}px`,
    maxWidth:    `${METHOD_COL_WIDTH}px`,
    textAlign:   "left",
    borderRight: `1px solid ${colors.border}`,
    overflow:    "hidden",
    textOverflow: "ellipsis",
  };

  return (
    // A tabela é larga por natureza. Rola dentro do próprio contêiner para que
    // a página não ganhe rolagem horizontal.
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "separate", borderSpacing: 0, fontSize: "12px", color: colors.text }}>
        <thead>
          {/* Linha dos grupos — o colSpan só fecha porque buildMatrixColumns
              garante que as colunas de um grupo saem contíguas. */}
          <tr>
            <th style={{ ...baseCell, ...stickyMethod, backgroundColor: colors.white, borderBottom: "none" }} />
            {groups.map(({ groupId, span }) => (
              <th
                key={groupId ?? "sem-grupo"}
                colSpan={span}
                style={{ ...baseCell, textAlign: "center", borderBottom: "none", paddingBottom: "2px", fontSize: "11px", fontWeight: "700", letterSpacing: "0.04em", textTransform: "uppercase", color: groupColor(groupId) }}
              >
                {groupId ? t(`results.mcdm.groups.${groupId}`) : "—"}
              </th>
            ))}
          </tr>

          {/* Linha dos critérios — rótulo em cima, peso ao vivo embaixo. A cor
              do grupo entra como borda superior de cada coluna, formando um
              traço contínuo logo abaixo do nome do grupo. */}
          <tr>
            <th style={{ ...baseCell, ...stickyMethod, backgroundColor: colors.white, borderBottom: `2px solid ${colors.border}`, fontSize: "11px", color: colors.muted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {t("results.mcdm.matrix.method")}
            </th>
            {columns.map(({ index, id, groupId }) => {
              const label = criterionLabel(id, sheet.columns[index]);
              return (
                <th
                  key={id}
                  title={label}
                  style={{ ...baseCell, width: `${CRIT_COL_WIDTH}px`, minWidth: `${CRIT_COL_WIDTH}px`, maxWidth: `${CRIT_COL_WIDTH}px`, textAlign: "center", verticalAlign: "bottom", borderTop: `3px solid ${groupColor(groupId)}`, borderBottom: `2px solid ${colors.border}` }}
                >
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "11px", fontWeight: "600", color: colors.text }}>
                    {label}
                  </div>
                  <div style={{ fontSize: "10px", fontWeight: "700", color: colors.muted, fontVariantNumeric: "tabular-nums" }}>
                    {weights[index].toFixed(4)}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {/* NENHUMA LINHA É REALÇADA. Havia aqui um destaque da melhor
              colocação atual; ele saiu porque a matriz não é a tela do ranking.
              Esta tabela existe para comparar método com método critério a
              critério, e pintar uma das dez linhas empurra o olho para ela
              antes de qualquer comparação começar — respondendo a pergunta
              errada, já que a resposta "quem ganhou" já está nos cartões logo
              acima. Todas as linhas têm o mesmo peso visual de propósito. */}
          {sheet.rows.map((row) => {
            const label = uiMethodLabel(row.code);
            return (
              <tr key={row.code}>
                <th
                  scope="row"
                  title={label}
                  style={{ ...baseCell, ...stickyMethod, backgroundColor: colors.white, fontWeight: "500", color: colors.text }}
                >
                  {label}
                </th>
                {columns.map(({ index, id }) => (
                  <td key={id} style={{ ...baseCell, backgroundColor: colors.white, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
                    {cell(row.values[index])}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ---------------------------------------------------------------------------
export default function McdmBlock() {
  const { t } = useTranslation();
  const { state, dispatch } = useMms();

  const [matrixOpen, setMatrixOpen] = useState(false);

  const groupWeights = state.formData.criteriaWeights.mcdm.groupWeights;

  // Só reroda o pipeline quando o formulário ou os pesos mudam. Sem isto, cada
  // render de /statistics (um toggle de pill, por exemplo) refaria matriz,
  // conversão de Saaty e TOPSIS à toa.
  const derived = useMemo(
    () => deriveMcdmRanking(state.formData, groupWeights),
    [state.formData, groupWeights],
  );

  // Ordem, rótulo e cor de cada grupo — ENFOQUE_GROUP_IDS é a ordem canônica em
  // que a UI deve apresentá-los (ver ENFOQUE_GROUPS em algorithms/enfoque.js), e
  // é a mesma ordem em que a matriz de decisão agrupa as colunas.
  //
  // Os rótulos vêm do i18n, e NÃO de CRITERION_GROUP_LABELS. São dois públicos:
  // aquela constante serve a camada de algoritmo e ao arquivo exportado, este
  // texto serve a tela e um dia será traduzido. Mesmo texto hoje, ciclos de
  // vida diferentes — juntar os dois obrigaria a traduzir o que vai para o
  // .xlsx ou a congelar a tela em português.
  const groups = ENFOQUE_GROUP_IDS.map((id) => ({
    id,
    label: t(`results.mcdm.groups.${id}`),
    value: groupWeights[id],
    color: GROUP_COLORS[id],
  }));

  const setGroupWeight = (group, value) =>
    dispatch({ type: "SET_MCDM_GROUP_WEIGHT", group, value });

  // Salva a repartição ATUAL com um nome. Só os pesos vão — nem ranking nem
  // formData —, e é por isso que o cenário continua fazendo sentido depois de o
  // formulário mudar: ele é recalculado, não relembrado. Ver o bloco de
  // cenários em MmsContext.jsx.
  const saveScenario = (name) =>
    dispatch({ type: "ADD_MCDM_SCENARIO", name, groupWeights });

  const ok = derived.status === MCDM_STATUS.OK;

  // -------------------------------------------------------------------------
  // PAINÉIS
  // -------------------------------------------------------------------------
  // Montados uma vez e posicionados de dois jeitos conforme a matriz esteja
  // aberta. É o MESMO painel de pesos nos dois arranjos — não há um segundo
  // conjunto de sliders, e o único estado envolvido é o `matrixOpen` que já
  // controlava o acordeão.
  //
  // Nenhum dos três guarda estado interno (os sliders são controlados pelo
  // contexto), então a remontagem que a mudança de posição provoca não perde
  // nada — só o foco do teclado, e quem alternou acabou de clicar no botão do
  // acordeão, onde o foco já está.

  const weightsPanel = (
    <WeightsPanel
      groups={groups}
      stacked={matrixOpen}
      onChange={setGroupWeight}
      onSaveScenario={saveScenario}
    />
  );

  const rankingPanel = (
    // RANKING — mesmo grid de cartões dos blocos clássicos, com a proximidade
    // em 3 casas: os valores de TOPSIS costumam se separar na terceira, e 1
    // casa (como nos scores clássicos) empataria a metade da lista na tela sem
    // empate nenhum no cálculo.
    <div style={panelStyle}>
      <h4 style={panelTitleStyle}>{t("results.ranking")}</h4>

      {ok ? (
        <>
          {/* TODOS OS CARTÕES COM O MESMO ESTILO. O 1º lugar era pintado na cor
              primária; o destaque saiu. A ordem dos cartões já diz quem ganhou
              — é a única coisa que este painel faz — e pintar o primeiro somava
              ênfase a uma informação que a posição já carregava, com o efeito
              colateral de sugerir uma distância entre 1º e 2º que a proximidade
              de TOPSIS logo abaixo frequentemente desmente (a terceira casa é
              onde esses valores costumam se separar). */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "6px" }}>
            {derived.result.ranking.map((entry) => (
              <div
                key={entry.code}
                style={{
                  padding:         "8px 6px",
                  borderRadius:    "4px",
                  backgroundColor: colors.bg,
                  color:           colors.text,
                  border:          `1px solid ${colors.border}`,
                  textAlign:       "center",
                  fontSize:        "12px",
                  minHeight:       "44px",
                  display:         "flex",
                  flexDirection:   "column",
                  justifyContent:  "center",
                }}
              >
                <div style={{ fontWeight: "700" }}>{t("results.rank", { n: entry.rank })}</div>
                <div style={{ fontWeight: "600" }}>{uiMethodLabel(entry.code)}</div>
                <div style={{ opacity: 0.8 }}>{entry.closeness.toFixed(3)}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: "13px", color: colors.muted, margin: "12px 0 0" }}>
            {t("results.mcdm.closenessHint")}
          </p>
        </>
      ) : (
        <p style={{ fontSize: "14px", color: colors.muted, margin: 0 }}>
          {t("results.mcdm.unavailable")}
        </p>
      )}
    </div>
  );

  // MATRIZ DE DECISÃO — fechada por padrão. É a mesma aba que o motor leu, já
  // estendida com os seis critérios fixos e já convertida para Saaty; nada é
  // recalculado para exibi-la.
  const matrixSection = ok ? (
    <Collapsible
      title={t("results.mcdm.matrix.title")}
      open={matrixOpen}
      onToggle={() => setMatrixOpen((o) => !o)}
    >
      <p style={{ fontSize: "13px", color: colors.muted, margin: "0 0 14px" }}>
        {t("results.mcdm.matrix.hint")}
      </p>
      <DecisionMatrixTable
        sheet={derived.result.sheet}
        weights={derived.result.weights}
        criterionIds={derived.result.criterionIds}
      />
    </Collapsible>
  ) : null;

  return (
    <div style={{ marginTop: "28px" }}>
      {/* Título do bloco — mesma faixa lateral dos blocos por método */}
      <div style={{ borderLeft: `4px solid ${colors.primary}`, paddingLeft: "12px", marginBottom: "16px" }}>
        <h3 style={{ margin: 0, color: colors.primary }}>{t("results.mcdm.title")}</h3>
        <p style={{ margin: "4px 0 0", color: colors.muted, fontSize: "14px" }}>
          {t("results.mcdm.subtitle")}
        </p>
      </div>

      {matrixOpen ? (
        // Matriz aberta: os pesos viram a coluna estreita à esquerda da tabela.
        // O ranking sobe para cima do par, mantendo a posição que já ocupava em
        // relação à matriz — quem ajusta sliders com a matriz aberta quer o
        // ranking à vista, que é o resultado do que está mexendo.
        <div style={{ display: "grid", gap: "12px" }}>
          {rankingPanel}
          <div className="mms-mcdm-split">
            {weightsPanel}
            {matrixSection}
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          {weightsPanel}
          {rankingPanel}
          {matrixSection}
        </div>
      )}

      {/* MÉTODOS AINDA FORA DO PIPELINE — quais são vem de MCDM_PENDING_METHODS
          (fonte única, em mcdmPipeline.js), mas o TEXTO do motivo vem do i18n.
          O `reason` da constante é português cru, escrito para a mensagem de
          exceção e nomeando de quem a pendência depende — não é frase de tela
          nem passa pelo sistema de tradução. */}
      <div style={{ ...panelStyle, marginTop: "12px", backgroundColor: colors.primary50, borderStyle: "dashed" }}>
        <h4 style={panelTitleStyle}>{t("results.mcdm.pendingTitle")}</h4>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
          {Object.entries(MCDM_PENDING_METHODS).map(([key, { label }]) => (
            <span
              key={key}
              style={{
                padding:         "4px 12px",
                borderRadius:    "20px",
                border:          `1px dashed ${colors.border}`,
                backgroundColor: colors.white,
                color:           colors.muted,
                fontSize:        "13px",
                fontWeight:      "600",
              }}
            >
              {label}
            </span>
          ))}
        </div>
        <p style={{ fontSize: "13px", color: colors.muted, margin: 0 }}>
          {t("results.mcdm.pendingReason")}
        </p>
      </div>
    </div>
  );
}
