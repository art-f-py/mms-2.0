import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMms } from "../context/MmsContext";
import { ENFOQUE_GROUP_IDS, WEIGHTING_MODES } from "../algorithms/enfoque";
import { REBALANCE_MODES } from "../algorithms/enfoqueRebalance";
import { CRITERION_GROUPS, FIXED_CRITERIA_BY_ID } from "../algorithms/mcdmCriteria";
import { MCDM_PENDING_METHODS } from "../algorithms/mcdmPipeline";
import { deriveMcdmRanking, MCDM_STATUS } from "../utils/mcdmRanking";
import { buildMatrixColumns, buildOriginSpans } from "../utils/mcdmMatrixLayout";
import { uiMethodLabel } from "../utils/methodLabel";
import { parseWeightInput } from "../utils/weightInput";
import { weightSliderStyle } from "../utils/sliderTrack";
import InfoTip from "./InfoTip";

// ---------------------------------------------------------------------------
// BLOCO MCDM — ENFOQUE (PESO POR GRUPO) + TOPSIS
// ---------------------------------------------------------------------------
// Conteúdo da aba "Decisão multicritério" de /statistics. O ranking daqui é
// DERIVADO a cada render a partir do formulário e dos pesos de grupo — nunca
// passa por state.results, que segue com os três slots fixos (ubc/nicholas/shb)
// dos métodos clássicos e não foi tocado.
//
// A consequência boa disso é que mexer num slider atualiza o ranking na hora,
// sem "recalcular": não há resultado congelado a invalidar. O useMemo existe
// para o pipeline não rodar de novo a cada render que não mudou nem o
// formulário, nem os pesos, nem o método.
//
// O MÉTODO DE SELEÇÃO VEM DE FORA, por prop. Quem o guarda é Statistics.jsx —
// ver lá o porquê: a aba de cenários é irmã deste bloco, e as duas precisam
// concordar sobre qual método está em foco.

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
  // O ⓘ entra como irmão do texto dentro do próprio <h4>: em flex ele fica na
  // linha do título sem herdar o caixa-alta nem o espaçamento de letra.
  display:       "flex",
  alignItems:    "center",
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
          className="mms-weight-slider"
          // Sem accent-color de propósito: o Chromium deriva dela a cor do
          // trecho não preenchido e escurece o trilho inteiro para cores claras,
          // o que deixava o slider do Técnico-Operacional preto. O trilho é
          // nosso; ver src/utils/sliderTrack.js.
          style={{ flex: 1, minWidth: 0, ...weightSliderStyle(color, value) }}
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
// Botão-aba do seletor de modo. Mesmo visual do seletor domínio/critério do
// Nicholas em Inputs.jsx e das abas de Statistics.jsx — o objeto de estilo de
// lá é local daqueles arquivos e não é exportado, daí a reescrita.
const modeButtonStyle = (on) => ({
  flex:            "1 1 0",
  padding:         "6px 12px",
  minHeight:       "44px",
  borderRadius:    "6px",
  fontSize:        "13px",
  cursor:          "pointer",
  backgroundColor: on ? colors.primary : "transparent",
  color:           on ? colors.white : colors.muted,
  border:          `1px solid ${on ? colors.primary : colors.border}`,
  fontWeight:      on ? "700" : "400",
});

// ---------------------------------------------------------------------------
// SELETOR DE REBALANCEAMENTO
// ---------------------------------------------------------------------------
// DELIBERADAMENTE MENOR que os botões Enfoque/Entropy logo acima, e a diferença
// de tamanho é a informação: aquele seletor troca QUEM decide os pesos e muda o
// painel inteiro; este é uma preferência de como os outros três sliders reagem
// ao que a pessoa arrasta. Dar aos dois o mesmo peso visual sugeriria duas
// decisões da mesma ordem, e a segunda passaria a competir com a primeira pela
// atenção de quem chega.
//
// Só existe em modo Enfoque: em Entropy não há slider para arrastar, e um
// controle sobre o que acontece ao arrastar não teria sobre o que agir.
//
// A explicação de cada modo mora no `title` do próprio botão, e não numa frase
// ao lado: o botão É o alvo natural do hover, e são duas frases que ninguém
// precisa reler depois de escolher uma vez.
//
// COMPACTO NO DESENHO, 44px NO TOQUE. A primeira versão comprou o tamanho
// pequeno tirando o minHeight de 44px que todo controle do app tem, e isso
// estava errado: quem usa no celular não vê a diferença de hierarquia, vê um
// alvo que erra. Os dois requisitos não conflitam — é a mesma técnica que os
// sliders já usam em index.css (ver "Área de toque confortável"): o ELEMENTO
// clicável tem 44px de altura e é transparente; o que se vê é uma peça menor
// desenhada dentro dele. Lá o trilho fino é um pseudo-elemento; aqui é o
// <span> interno, que é o único jeito de ter borda e fundo próprios já que um
// pseudo-elemento não é alcançável por estilo inline.
//
// O botão perde padding vertical (a altura vem do minHeight) e mantém uma
// folga horizontal de 2px, para que a área de toque de dois vizinhos com 6px
// de gap não se encoste.
const rebalanceButtonStyle = {
  flex:            "0 1 auto",
  minHeight:       "44px",
  display:         "flex",
  alignItems:      "center",
  padding:         "0 2px",
  border:          "none",
  backgroundColor: "transparent",
  cursor:          "pointer",
};

// A peça visível. Tudo o que era estilo do botão veio para cá — borda, fundo,
// padding e fonte —, e é ela que fica visualmente menor que os botões
// Enfoque/Entropy. `pointer-events` fica no padrão: o clique atravessa o span e
// chega ao botão, que é quem escuta.
const rebalanceChipStyle = (on) => ({
  padding:         "4px 10px",
  borderRadius:    "5px",
  fontSize:        "12px",
  lineHeight:      1.4,
  backgroundColor: on ? colors.primary50 : "transparent",
  color:           on ? colors.primary : colors.muted,
  border:          `1px solid ${on ? colors.primary : colors.border}`,
  fontWeight:      on ? "700" : "400",
});

// A margem inferior do grupo é 8px, e não os 14px do resto do painel: a área de
// toque de 44px já traz ~9px de espaço transparente abaixo do chip visível, e
// somar os dois abriria um buraco entre o seletor e a barra de proporção.
function RebalanceSelector({ value, onChange }) {
  const { t } = useTranslation();
  const active = value === REBALANCE_MODES.EQUALIZE
    ? REBALANCE_MODES.EQUALIZE
    : REBALANCE_MODES.PROPORTIONAL;

  return (
    <div
      role="group"
      aria-label={t("results.mcdm.rebalance.legend")}
      style={{ display: "flex", gap: "6px", marginBottom: "8px" }}
    >
      {[
        [REBALANCE_MODES.PROPORTIONAL, "proportional"],
        [REBALANCE_MODES.EQUALIZE,     "equalize"],
      ].map(([id, chave]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-pressed={id === active}
          title={t(`results.mcdm.rebalance.${chave}Hint`)}
          style={rebalanceButtonStyle}
        >
          <span style={rebalanceChipStyle(id === active)}>
            {t(`results.mcdm.rebalance.${chave}`)}
          </span>
        </button>
      ))}
    </div>
  );
}

function WeightsPanel({ groups, stacked, mode, rebalanceMode, onChange, onModeChange, onRebalanceModeChange, onSaveScenario }) {
  const { t } = useTranslation();
  const enfoqueMode = mode !== WEIGHTING_MODES.ENTROPY;

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
      <h4 style={{ ...panelTitleStyle, marginBottom: "14px" }}>
        {t("results.mcdm.weightsTitle")}
        <InfoTip text={t("results.mcdm.weightsHint")} />
      </h4>

      {/* SELETOR DE MODO — quem decide os pesos. Dois botões, não um checkbox:
          são duas alternativas nomeadas e mutuamente exclusivas, e o nome de
          cada uma é a informação (ver o mesmo padrão em Inputs.jsx). */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        {[
          [WEIGHTING_MODES.ENFOQUE, t("results.mcdm.modes.enfoque")],
          [WEIGHTING_MODES.ENTROPY, t("results.mcdm.modes.entropy")],
        ].map(([id, rotulo]) => (
          <button
            key={id}
            onClick={() => onModeChange(id)}
            aria-pressed={(id === WEIGHTING_MODES.ENTROPY) === !enfoqueMode}
            style={modeButtonStyle((id === WEIGHTING_MODES.ENTROPY) === !enfoqueMode)}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {enfoqueMode ? (
        <>
          <RebalanceSelector value={rebalanceMode} onChange={onRebalanceModeChange} />

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
        </>
      ) : (
        // MODO ENTROPY — nada a ajustar, e é esse o ponto. Os quatro sliders
        // não somem por economia de espaço: em Entropy não existe "grupo", os
        // pesos são por CRITÉRIO e saem da dispersão dos dados. Deixá-los na
        // tela inertes sugeriria que ainda mandam em alguma coisa.
        //
        // Os pesos calculados não são repetidos aqui: eles já aparecem, um por
        // um, na linha de peso do cabeçalho de cada coluna da matriz de decisão
        // — que é onde ficam ao lado do critério a que pertencem. Uma segunda
        // lista dos mesmos 19 números, longe das colunas, seria mais difícil de
        // ler, não menos.
        // A frase curta é MENSAGEM DE ESTADO — diz por que não há slider
        // nenhum aqui — e por isso fica na tela; o parágrafo que explica COMO
        // a entropia chega aos pesos é apoio, e foi para o ⓘ.
        <p style={{ fontSize: "13px", color: colors.muted, margin: 0, display: "flex", alignItems: "center" }}>
          {t("results.mcdm.modes.entropyState")}
          <InfoTip text={t("results.mcdm.modes.entropyHint")} />
        </p>
      )}

      {/* SALVAR CENÁRIO — campo inline, não window.prompt(). O prompt do
          navegador bloqueia a página inteira, não é estilizável e some do fluxo
          de teclado; e aqui ele esconderia justamente os sliders que a pessoa
          acabou de ajustar e está tentando batizar. O campo fica ao lado dos
          pesos que ele vai guardar.

          Envolve um <form> para que Enter no campo salve — é o que se espera de
          um campo de texto com um botão do lado, e sai de graça.

          FUNCIONA NOS DOIS MODOS. Era só em Enfoque, pelo argumento de que um
          cenário É uma repartição de pesos com nome e Entropy não tem peso
          ajustável para nomear. O argumento descrevia certo o MODELO ANTIGO e
          errado o que a comparação serve para responder: o que se compara não é
          a repartição, é o RANKING que ela produz — e "este método com pesos de
          Entropy" é um ranking tão comparável quanto os outros, justamente por
          ser o que sai quando ninguém escolhe os pesos.

          Em Entropy não há sliders acima deste campo, e é a única diferença
          visível: o mesmo campo, o mesmo botão, o mesmo Enter. O que o cenário
          guarda é nome + método + modo, sem groupWeights — ver
          ADD_MCDM_SCENARIO em MmsContext.jsx. */}
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
function Collapsible({ title, info, open, onToggle, children }) {
  return (
    <div style={{ border: `1px solid ${colors.border}`, borderRadius: "8px", overflow: "hidden" }}>
      <button
        onClick={onToggle}
        aria-expanded={open}
        style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", minHeight: "44px", backgroundColor: colors.primary50, border: "none", cursor: "pointer", fontSize: "15px", fontWeight: "700", color: colors.primary }}
      >
        {/* O ⓘ fica DENTRO do botão de propósito: o cabeçalho inteiro é a
            área clicável do acordeão, e um ícone flutuando ao lado dela seria
            um alvo de clique que não abre nada. Passar por cima mostra o aviso;
            clicar abre a matriz, que é o que o cabeçalho sempre fez. */}
        <span style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
          {info ? <InfoTip text={info} /> : null}
        </span>
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
  // De onde cada bloco de colunas veio — clássicas do método x os seis fixos do
  // Francisco. Vira a primeira linha do cabeçalho (ver o comentário lá).
  const origens = buildOriginSpans(columns);

  // Rótulo do critério. Os 13 clássicos já têm chave em results.criteria (a
  // mesma que o radar de breakdown dos blocos clássicos usa); os 6 fixos são
  // novos e entram em results.mcdm.fixedCriteria. O rótulo de exportação da
  // própria aba (inglês) fica como último recurso — se aparecer na tela, é
  // sinal de critério novo sem chave, não de tradução pendente.
  const criterionLabel = (id, fallback) =>
    id in FIXED_CRITERIA_BY_ID
      ? t(`results.mcdm.fixedCriteria.${id}`, fallback)
      : t(`results.criteria.${id}`, fallback);

  // Texto conceitual dos SEIS FIXOS, e só deles. Os clássicos não ganham ⓘ
  // aqui: o que eles significam é a publicação do método que define, e o
  // formulário já os explica campo a campo na etapa em que são preenchidos.
  // Os seis do Francisco não têm essa outra tela — a matriz é o único lugar em
  // que aparecem, e até aqui apareciam sem nenhuma explicação.
  //
  // O SEGUNDO ARGUMENTO É O DEFAULT do i18next, e é o que mantém o ⓘ fora do ar
  // enquanto não houver chave: sem ele, um id novo renderizaria o caminho da
  // chave crua ("results.mcdm.fixedCriteriaHints.xyz") dentro do tooltip.
  const criterionHint = (id) =>
    id in FIXED_CRITERIA_BY_ID ? t(`results.mcdm.fixedCriteriaHints.${id}`, "") : "";

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
          {/* LINHA DE ORIGEM — de onde as colunas vêm.
              A matriz junta duas procedências que pareciam uma só: as colunas
              CLÁSSICAS, que o método de seleção pontua e mudam entre Nicholas e
              UBC, e os SEIS FIXOS do Francisco, que descrevem o método de lavra
              e valem igual nos dois. Até aqui nada dizia isso, e os seis liam-se
              como se fossem mais colunas da publicação do método.

              As faixas vêm de buildOriginSpans, que as CALCULA a partir das
              colunas em vez de presumir que os fixos são sempre os dois últimos
              grupos — ver o porquê lá. */}
          <tr>
            <th style={{ ...baseCell, ...stickyMethod, backgroundColor: colors.white, borderBottom: "none" }} />
            {origens.map(({ fixed, span }, i) => (
              <th
                key={`${fixed ? "fixos" : "classicos"}-${i}`}
                colSpan={span}
                style={{ ...baseCell, textAlign: "center", borderBottom: "none", paddingBottom: "2px", fontSize: "10px", fontWeight: "600", letterSpacing: "0.04em", textTransform: "uppercase", color: colors.muted }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  {t(`results.mcdm.matrixOrigin.${fixed ? "fixed" : "classic"}`)}
                  <InfoTip text={t(`results.mcdm.matrixOrigin.${fixed ? "fixedHint" : "classicHint"}`)} />
                </span>
              </th>
            ))}
          </tr>

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
              const hint  = criterionHint(id);
              return (
                <th
                  key={id}
                  title={label}
                  style={{ ...baseCell, width: `${CRIT_COL_WIDTH}px`, minWidth: `${CRIT_COL_WIDTH}px`, maxWidth: `${CRIT_COL_WIDTH}px`, textAlign: "center", verticalAlign: "bottom", borderTop: `3px solid ${groupColor(groupId)}`, borderBottom: `2px solid ${colors.border}` }}
                >
                  {/* O ⓘ é IRMÃO do texto, dentro de um flex, e não parte dele:
                      assim o `text-overflow: ellipsis` corta o nome do critério
                      e nunca o ícone, que de outro modo seria o primeiro a
                      sumir numa coluna de 96px — justo o que veio para ficar.
                      InfoTip devolve null sem texto, então os clássicos
                      continuam com o cabeçalho exatamente como estava. */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minWidth: 0 }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "11px", fontWeight: "600", color: colors.text }}>
                      {label}
                    </span>
                    <InfoTip text={hint} />
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
export default function McdmBlock({ method, available = [], onMethodChange }) {
  const { t } = useTranslation();
  const { state, dispatch } = useMms();

  const [matrixOpen, setMatrixOpen] = useState(false);

  const mcdm         = state.formData.criteriaWeights.mcdm;
  const groupWeights = mcdm.groupWeights;
  // Estado persistido por uma versão anterior a Entropy não tem `mode`.
  // normalizeMcdmWeights já repõe no carregamento; o default aqui cobre o
  // caminho em que o objeto chega por outra via.
  const mode = mcdm.mode ?? WEIGHTING_MODES.ENFOQUE;
  // Mesmo caso do `mode` acima: campo acrescentado depois, com default aqui
  // para o caminho em que o objeto não passou por normalizeMcdmWeights.
  const rebalanceMode = mcdm.rebalanceMode ?? REBALANCE_MODES.PROPORTIONAL;

  // Só reroda o pipeline quando o formulário, os pesos, o modo ou o MÉTODO
  // mudam. Sem isto, cada render de /statistics (um toggle de pill de filtro,
  // por exemplo) refaria matriz, conversão de escala e TOPSIS à toa.
  //
  // `method` nas dependências é o que faz trocar a pill do seletor recalcular de
  // verdade — sem ele, a matriz e o ranking ficariam congelados no método
  // anterior enquanto o pill já mostraria o novo.
  const derived = useMemo(
    () => deriveMcdmRanking(state.formData, groupWeights, { mode, method }),
    [state.formData, groupWeights, mode, method],
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

  const setMode = (novoModo) => dispatch({ type: "SET_MCDM_MODE", mode: novoModo });

  const setRebalanceMode = (novoModo) =>
    dispatch({ type: "SET_MCDM_REBALANCE_MODE", rebalanceMode: novoModo });

  // Salva a configuração ATUAL de ponderação com um nome: o método em foco, o
  // modo em foco e — só em Enfoque — os pesos. Nem ranking nem formData vão
  // junto, e é por isso que o cenário continua fazendo sentido depois de o
  // formulário mudar: ele é recalculado, não relembrado. Ver o bloco de
  // cenários em MmsContext.jsx.
  //
  // É CONTEXTUAL AO QUE ESTÁ NA TELA. O método e o modo não são perguntados ao
  // usuário num segundo controle — são os que ele já escolheu nos seletores
  // logo acima, e salvar é dizer "guarde esta tela com este nome". Um seletor
  // de método dentro do formulário de salvar permitiria guardar uma
  // configuração diferente da que está sendo mostrada, que é justamente o tipo
  // de divergência que a comparação existe para não ter.
  const saveScenario = (name) =>
    dispatch({ type: "ADD_MCDM_SCENARIO", name, method, mode, groupWeights });

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
      mode={mode}
      rebalanceMode={rebalanceMode}
      onChange={setGroupWeight}
      onModeChange={setMode}
      onRebalanceModeChange={setRebalanceMode}
      onSaveScenario={saveScenario}
    />
  );

  const rankingPanel = (
    // RANKING — mesmo grid de cartões dos blocos clássicos, com a proximidade
    // em 3 casas: os valores de TOPSIS costumam se separar na terceira, e 1
    // casa (como nos scores clássicos) empataria a metade da lista na tela sem
    // empate nenhum no cálculo.
    <div style={panelStyle}>
      <h4 style={panelTitleStyle}>
        {t("results.ranking")}
        {/* Só quando há ranking: sem ele o ⓘ explicaria uma escala que não está
            na tela. A mensagem de indisponibilidade continua visível. */}
        {ok ? <InfoTip text={t("results.mcdm.closenessHint")} /> : null}
      </h4>

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
  //
  // O aviso de que as células NÃO acompanham os sliders continua sendo a coisa
  // mais fácil de ler errado nesta tabela — por isso ele vai para o cabeçalho
  // da matriz (`info`), e não para junto das colunas. Sai da tela por padrão
  // porque só importa uma vez; quem estranhar a tabela "travada" acha a
  // resposta no ⓘ que está exatamente onde clicou para abri-la.
  const matrixSection = ok ? (
    <Collapsible
      title={t("results.mcdm.matrix.title")}
      info={t("results.mcdm.matrix.hint")}
      open={matrixOpen}
      onToggle={() => setMatrixOpen((o) => !o)}
    >
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
        <h3 style={{ margin: 0, color: colors.primary, display: "flex", alignItems: "center" }}>
          {t("results.mcdm.title")}
          <InfoTip text={t("results.mcdm.subtitle")} />
        </h3>
      </div>

      {/* SELETOR DE MÉTODO DE SELEÇÃO — RADIO NATIVO.
          SÓ COM MAIS DE UM DISPONÍVEL. Com um método só, o seletor não oferece
          escolha nenhuma — seria um controle que não faz nada, pedindo ao
          usuário que decida entre uma opção. A aba então mostra o método direto.

          ERA UMA FILEIRA DE PILLS, e virou <input type="radio"> por duas razões.
          A visual: os pills daqui eram idênticos aos pills de FILTRO de método
          logo acima, com semânticas diferentes — lá vários ligam ao mesmo tempo,
          aqui é um só —, e duas fileiras iguais que se comportam diferente é
          ambiguidade gratuita. (O item 1 desta leva também esconde os filtros
          fora da aba clássica, o que ataca o mesmo problema pelo outro lado.)
          A semântica: o papel de grupo-de-rádio declarado à mão, com
          aria-pressed em cada botão, era uma reconstrução do que o
          <fieldset>/<input type="radio"> já dá de graça —
          navegação por setas, exclusividade garantida pelo `name` compartilhado,
          rótulo associado por <label>. Menos código e mais acessível.

          O RÓTULO NÃO MUDA: continua vindo de SELECTION_METHODS (por prop), a
          mesma palavra da fileira de filtros e dos blocos clássicos. */}
      {available.length > 1 && (
        <fieldset
          style={{ border: "none", margin: "0 0 16px", padding: 0, display: "flex", gap: "20px", flexWrap: "wrap", alignItems: "center" }}
        >
          {/* O <legend> é o rótulo do grupo para leitor de tela. Fica fora da
              tela em vez de escondido com `display:none`, que o removeria
              também da árvore de acessibilidade — que é justamente onde ele
              precisa estar. O título do bloco logo acima já cumpre o papel
              visual, e repeti-lo na tela seria ruído. */}
          <legend className="mms-sr-only">{t("results.mcdm.methodSelector")}</legend>
          {available.map((sm) => {
            const id = `mcdm-metodo-${sm.key}`;
            return (
              <div key={sm.key} style={{ display: "flex", alignItems: "center", gap: "8px", minHeight: "44px" }}>
                <input
                  type="radio"
                  id={id}
                  // O `name` compartilhado é o que torna a escolha exclusiva —
                  // é ele que faz o navegador desmarcar o irmão sozinho.
                  name="mcdm-metodo"
                  value={sm.key}
                  checked={sm.key === method}
                  onChange={() => onMethodChange?.(sm.key)}
                  // accentColor pinta a bolinha na cor do método, o mesmo elo
                  // visual que a pill fazia com o bloco clássico correspondente.
                  style={{ width: "18px", height: "18px", accentColor: sm.color, cursor: "pointer", flexShrink: 0 }}
                />
                <label htmlFor={id} style={{ fontSize: "14px", fontWeight: "500", cursor: "pointer" }}>
                  {sm.label}
                </label>
              </div>
            );
          })}
        </fieldset>
      )}

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
          nem passa pelo sistema de tradução.

          SÓ RENDERIZA COM A LISTA NÃO VAZIA. Desde que o SH&B foi liberado,
          MCDM_PENDING_METHODS ficou `{}` e o painel aparecia com título,
          explicação e NENHUMA pastilha — um aviso sobre um conjunto vazio de
          métodos, que só sobrava espaço e dava a entender que algo continuava
          bloqueado.

          O MECANISMO INTEIRO FICA: a constante, o texto no i18n e este bloco de
          JSX estão prontos e ligados. Um quarto método de seleção que chegue
          bloqueado (e é assim que eles chegam — ver a nota em
          MCDM_PENDING_METHODS) faz o painel voltar sozinho, sem ninguém
          reescrever nada. Apagar o painel obrigaria a reinventá-lo nesse dia. */}
      {Object.keys(MCDM_PENDING_METHODS).length > 0 && (
      <div style={{ ...panelStyle, marginTop: "12px", backgroundColor: colors.primary50, borderStyle: "dashed" }}>
        {/* O título e as pastilhas são a MENSAGEM DE ESTADO — quais métodos
            ainda estão de fora — e ficam. O motivo da pendência é o "por quê",
            e foi para o ⓘ. */}
        <h4 style={panelTitleStyle}>
          {t("results.mcdm.pendingTitle")}
          <InfoTip text={t("results.mcdm.pendingReason")} />
        </h4>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
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
      </div>
      )}
    </div>
  );
}
