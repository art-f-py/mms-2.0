// ---------------------------------------------------------------------------
// ÍCONE DE INFORMAÇÃO — TEXTO DE APOIO SOB DEMANDA
// ---------------------------------------------------------------------------
// Um "ⓘ" ao lado de um título ou rótulo, com a explicação no atributo `title`
// nativo do HTML.
//
// O QUE ELE RESOLVE. O bloco MCDM acumulou parágrafos de apoio — como o
// rebalanceamento funciona, por que as células da matriz não acompanham o
// slider, o que a cor da comparação significa. Cada um é útil na primeira vez e
// ruído em todas as outras, e juntos empurravam para baixo justamente os
// controles e as tabelas que a pessoa veio usar. Aqui eles continuam
// acessíveis, mas param de disputar espaço com o que a tela faz.
//
// O CRITÉRIO DO QUE VIRA ⓘ. Só texto EXPLICATIVO — o "como funciona" e o "por
// quê". TÍTULO, RÓTULO, BOTÃO e MENSAGEM DE ESTADO (formulário incompleto,
// ranking indisponível, nenhum cenário salvo) continuam na tela: eles dizem o
// que está acontecendo AGORA, e esconder isso atrás de um hover deixaria a
// pessoa sem saber por que a tela está como está.
//
// POR QUE O `title` NATIVO, e não um tooltip próprio. Ele já é o mecanismo
// usado nos rótulos truncados deste mesmo bloco (nomes de grupo, de método, de
// cenário), então o gesto é o mesmo em toda a tela. Um tooltip customizado
// traria posicionamento, z-index e fechamento por foco/ESC — três problemas
// novos para exibir uma frase. Ele tem limites conhecidos (não abre por toque e
// demora a aparecer), e por isso NADA que a pessoa precise para operar a tela
// pode morar aqui: é texto de apoio, por definição dispensável.
//
// `role="note"` com `aria-label` porque um <span> sem papel não expõe o rótulo
// a leitor de tela — o `title` sozinho é inconsistente entre eles.
const infoStyle = {
  marginLeft: "6px",
  flexShrink: 0,
  fontSize:   "12px",
  fontWeight: "400",
  color:      "var(--color-muted)",
  cursor:     "help",
  // O ⓘ é texto, não emoji: sem variante de cor, ele herda o cinza dos demais
  // rótulos de apoio em vez de abrir um ponto colorido na paleta neutra.
  textTransform: "none",
  letterSpacing: "normal",
};

export default function InfoTip({ text }) {
  if (!text) return null;
  return (
    <span role="note" aria-label={text} title={text} style={infoStyle}>
      ⓘ
    </span>
  );
}
