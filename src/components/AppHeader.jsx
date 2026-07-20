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
      gridTemplateColumns: "1fr auto 1fr",
      alignItems: "center",
      boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
      position: "sticky",
      top: 0,
      zIndex: 100,
    }}>

      {/* Coluna esquerda — brasão (link para Home) */}
      <Link to="/" style={{ display: "flex", alignItems: "center", textDecoration: "none", minWidth: 0 }}>
        <img
          src={brasao}
          alt={t("header.brasaoAlt")}
          style={{ height: "clamp(34px, 9vw, 52px)", width: "auto" }}
        />
      </Link>

      {/* Coluna central — título (link para Home) */}
      <Link to="/" style={{ display: "block", textAlign: "center", textDecoration: "none", minWidth: 0 }}>
        <div style={{ fontSize: "clamp(13px, 4vw, 18px)", fontWeight: "700", color: "var(--color-white)", letterSpacing: "0.02em", lineHeight: 1.2 }}>
          Mining Method Selection Tool
        </div>
        <div style={{ fontSize: "clamp(8px, 2.4vw, 11px)", color: "#93c5fd", letterSpacing: "0.06em", marginTop: "2px" }}>
          UFRGS · LAPROM · MMS 2.0
        </div>
      </Link>

      {/* Coluna direita — seletor de idioma + ícone mineração */}
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "clamp(8px, 2.5vw, 14px)", minWidth: 0 }}>
        <LanguageSelector />
        <img
          src={mineracao}
          alt={t("header.miningIconAlt")}
          style={{ height: "clamp(26px, 7vw, 40px)", width: "auto", filter: "brightness(0) invert(1)", opacity: 0.7 }}
        />
      </div>

    </header>
  );
}
