// PILL — interruptor rotulado, o controle de método de /statistics
//
// Vivia dentro de Statistics.jsx, onde nasceu para ligar e desligar cada método
// de seleção na fileira de filtros. Saiu para cá quando a aba MCDM passou a
// precisar do MESMO controle, com os MESMOS rótulos e as MESMAS cores, para
// escolher entre os métodos que o pipeline multicritério aceita.
//
// POR QUE UM MÓDULO PRÓPRIO, E NÃO UM EXPORT DE Statistics.jsx: Statistics.jsx
// importa McdmBlock.jsx, então McdmBlock importar de volta de Statistics.jsx
// fecharia um ciclo. ESM resolve ciclos, mas a ordem de inicialização passa a
// depender de quem foi carregado primeiro — fragilidade gratuita para o que é,
// no fim, um componente de apresentação sem estado.
//
// DOIS USOS, UMA APARÊNCIA, SEMÂNTICAS DIFERENTES. Na fileira de filtros os
// pills são independentes (vários ligados ao mesmo tempo); no seletor da aba
// MCDM são mutuamente exclusivos (um só ligado, e clicar em outro troca). Quem
// chama é que decide isso, pelo que passa em `active` e faz em `onClick` — o
// componente não sabe a diferença e não precisa saber.

export default function Pill({ label, color, active, onClick, ariaLabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      // O estado ligado/desligado precisa chegar a quem usa leitor de tela: sem
      // isto, o pill se anuncia só pelo rótulo, e "UBC 1995" soa igual ligado e
      // desligado. A cor sozinha nunca foi informação acessível.
      aria-pressed={Boolean(active)}
      aria-label={ariaLabel}
      style={{
        display:         "flex",
        alignItems:      "center",
        gap:             "8px",
        minHeight:       "44px",
        cursor:          "pointer",
        // Zera a aparência de <button> — o visual é o do interruptor abaixo, e
        // era o de uma <div> antes desta extração. Trocar por <button> foi de
        // propósito: o controle é clicável e precisa de foco e de teclado.
        padding:         0,
        border:          "none",
        background:      "none",
        color:           "inherit",
        font:            "inherit",
        textAlign:       "left",
      }}
    >
      <span style={{ fontSize: "14px", fontWeight: "500" }}>{label}</span>
      <div
        style={{ width: "50px", height: "26px", borderRadius: "20px", backgroundColor: active ? color : "#d1d5db", position: "relative", transition: "background-color 0.3s", flexShrink: 0 }}
      >
        <div style={{ width: "22px", height: "22px", borderRadius: "50%", backgroundColor: "#fff", position: "absolute", top: "2px", left: active ? "26px" : "2px", transition: "left 0.3s" }} />
      </div>
    </button>
  );
}
