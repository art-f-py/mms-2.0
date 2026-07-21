import { useState, useRef, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import brasao    from "../assets/brasao.png";
import mineracao from "../assets/mineracao.png";
import { LANGUAGES } from "../i18n/index.js";

// Bandeiras como SVG inline. Emoji de bandeira (🇧🇷/🇬🇧/🇪🇸) NÃO renderiza no
// Windows/Chrome — aparece como as letras "BR"/"GB"/"ES" —, então desenhamos
// versões simples e nítidas que funcionam em qualquer navegador, sem assets.
function FlagIcon({ code, size = 20 }) {
  const h = Math.round(size * 0.7);
  const common = { width: size, height: h, style: { display: "block" } };
  let svg;
  if (code === "pt-BR") {
    svg = (
      <svg {...common} viewBox="0 0 20 14" aria-hidden="true">
        <rect width="20" height="14" fill="#009C3B" />
        <polygon points="10,1.5 18.5,7 10,12.5 1.5,7" fill="#FFDF00" />
        <circle cx="10" cy="7" r="3" fill="#002776" />
      </svg>
    );
  } else if (code === "en") {
    // Union Jack simplificada (diagonais + cruz de São Jorge).
    svg = (
      <svg {...common} viewBox="0 0 60 30" aria-hidden="true">
        <rect width="60" height="30" fill="#012169" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth="2" />
        <rect x="25" width="10" height="30" fill="#fff" />
        <rect y="10" width="60" height="10" fill="#fff" />
        <rect x="27" width="6" height="30" fill="#C8102E" />
        <rect y="12" width="60" height="6" fill="#C8102E" />
      </svg>
    );
  } else {
    svg = (
      <svg {...common} viewBox="0 0 20 14" aria-hidden="true">
        <rect width="20" height="14" fill="#AA151B" />
        <rect y="3.5" width="20" height="7" fill="#F1BF00" />
      </svg>
    );
  }
  return (
    <span style={{ display: "inline-flex", borderRadius: "3px", overflow: "hidden", boxShadow: "0 0 0 1px rgba(0,0,0,0.15)", flexShrink: 0 }}>
      {svg}
    </span>
  );
}

// Seletor de idioma — botão único (bandeira + código do idioma atual) que abre
// um dropdown com as outras opções. Fecha ao selecionar, clicar fora ou Esc.
function LanguageSelector() {
  const { t, i18n } = useTranslation();
  const current = i18n.resolvedLanguage || i18n.language;
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Fecha o dropdown ao clicar fora ou com a tecla Esc.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") { setOpen(false); ref.current?.querySelector("button")?.focus(); } };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const currentLang = LANGUAGES.find((l) => l.code === current) || LANGUAGES[0];
  const others = LANGUAGES.filter((l) => l.code !== currentLang.code);

  const choose = (code) => { i18n.changeLanguage(code); setOpen(false); };

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      {/* Botão principal — bandeira + código do idioma atual */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${t("header.language")}: ${currentLang.label}`}
        style={{
          display: "flex", alignItems: "center", gap: "7px",
          minHeight: "44px", padding: "0 clamp(8px, 2vw, 12px)",
          border: "1px solid rgba(255,255,255,0.35)", borderRadius: "6px",
          backgroundColor: "transparent", color: "var(--color-white)",
          cursor: "pointer", fontSize: "clamp(11px, 2.4vw, 13px)", fontWeight: 700, letterSpacing: "0.04em",
        }}
      >
        <FlagIcon code={currentLang.code} />
        <span>{currentLang.label}</span>
        <span aria-hidden="true" style={{ fontSize: "8px", opacity: 0.85, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▼</span>
      </button>

      {/* Dropdown — alinhado à direita do botão para não estourar em mobile */}
      {open && (
        <ul
          role="listbox"
          aria-label={t("header.language")}
          style={{
            position: "absolute", top: "calc(100% + 6px)", right: 0,
            margin: 0, padding: "4px", listStyle: "none",
            backgroundColor: "var(--color-white)", borderRadius: "8px",
            boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
            minWidth: "100%", zIndex: 200,
          }}
        >
          {others.map((l) => (
            <li key={l.code} role="option" aria-selected="false">
              <button
                onClick={() => choose(l.code)}
                style={{
                  display: "flex", alignItems: "center", gap: "9px", width: "100%",
                  minHeight: "44px", padding: "0 12px",
                  border: "none", borderRadius: "6px", backgroundColor: "transparent",
                  color: "var(--color-primary)", cursor: "pointer",
                  fontSize: "13px", fontWeight: 700, letterSpacing: "0.04em", whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(30,58,95,0.08)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <FlagIcon code={l.code} />
                <span>{l.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
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
