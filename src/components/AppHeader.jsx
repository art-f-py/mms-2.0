import { useLocation, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import brasao    from "../assets/brasao.png";
import mineracao from "../assets/mineracao.png";
import { LANGUAGES } from "../i18n/index.js";

// Seletor de idioma — grupo segmentado PT · EN · ES, consistente com o header.
function LanguageSelector() {
  const { t, i18n } = useTranslation();
  const current = i18n.resolvedLanguage || i18n.language;

  return (
    <div
      role="group"
      aria-label={t("header.language")}
      style={{
        display: "flex", alignItems: "center",
        border: "1px solid rgba(255,255,255,0.35)", borderRadius: "6px",
        overflow: "hidden", flexShrink: 0,
      }}
    >
      {LANGUAGES.map(({ code, label }) => {
        const active = current === code;
        return (
          <button
            key={code}
            onClick={() => i18n.changeLanguage(code)}
            aria-pressed={active}
            style={{
              padding: "5px clamp(6px, 2vw, 10px)", minHeight: "30px",
              border: "none", cursor: "pointer",
              fontSize: "clamp(10px, 2.4vw, 12px)", fontWeight: 700, letterSpacing: "0.04em",
              backgroundColor: active ? "var(--color-white)" : "transparent",
              color: active ? "var(--color-primary)" : "var(--color-white)",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export default function AppHeader() {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  if (pathname === "/") return null;

  return (
    <header style={{
      backgroundColor: "var(--color-primary)",
      padding: "clamp(8px, 3vw, 12px) clamp(12px, 4vw, 28px)",
      display: "grid",
      // Coluna central em minmax(0, auto): permite o título encolher abaixo do
      // seu conteúdo (min = 0) e truncar, em vez de transbordar por cima do
      // seletor de idioma em telas estreitas. As colunas laterais (1fr) mantêm
      // o título centralizado quando há espaço.
      gridTemplateColumns: "1fr minmax(0, auto) 1fr",
      // Espaço garantido entre título e colunas laterais: evita que o título
      // encoste no brasão/seletor em telas estreitas.
      columnGap: "clamp(8px, 2vw, 16px)",
      alignItems: "center",
      boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
      position: "sticky",
      top: 0,
      zIndex: 100,
    }}>

      {/* Coluna esquerda — brasão (link para Home).
          flexShrink: 0 impede que a coluna encolha abaixo do brasão em telas
          estreitas — sem isso, o logo transbordava por cima do título. */}
      <Link to="/" style={{ display: "flex", alignItems: "center", textDecoration: "none", flexShrink: 0 }}>
        <img
          src={brasao}
          alt={t("header.brasaoAlt")}
          style={{ height: "clamp(34px, 9vw, 52px)", width: "auto", flexShrink: 0 }}
        />
      </Link>

      {/* Coluna central — título (link para Home).
          minWidth/overflow no Link + nowrap/ellipsis nos textos garantem que o
          título nunca invada a coluna do seletor: a fonte reduz progressivamente
          via clamp() e, no limite, trunca com reticências. */}
      <Link to="/" style={{ display: "block", textAlign: "center", textDecoration: "none", minWidth: 0, overflow: "hidden" }}>
        <div style={{ fontSize: "clamp(12px, 3.4vw, 18px)", fontWeight: "700", color: "var(--color-white)", letterSpacing: "0.02em", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          Mining Method Selection Tool
        </div>
        <div style={{ fontSize: "clamp(8px, 2.4vw, 11px)", color: "#93c5fd", letterSpacing: "0.06em", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          UFRGS · LAPROM · MMS 2.0
        </div>
      </Link>

      {/* Coluna direita — seletor de idioma + ícone mineração.
          flexShrink: 0 no contêiner e nos filhos dá prioridade ao seletor: ele
          nunca encolhe nem é cortado — o título cede espaço antes. */}
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "clamp(8px, 2.5vw, 14px)", flexShrink: 0 }}>
        <LanguageSelector />
        <img
          src={mineracao}
          alt={t("header.miningIconAlt")}
          style={{ height: "clamp(26px, 7vw, 40px)", width: "auto", filter: "brightness(0) invert(1)", opacity: 0.7, flexShrink: 0 }}
        />
      </div>

    </header>
  );
}
