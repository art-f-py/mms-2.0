import { useLocation } from "react-router-dom";
import brasao    from "../assets/brasao.png";
import mineracao from "../assets/mineracao.png";
import { useTheme } from "../context/ThemeContext";

const C = {
  primary: "#1e3a5f",
  white:   "#ffffff",
  muted:   "#93c5fd",
};

export default function AppHeader() {
  const { pathname } = useLocation();
  const { theme, toggleTheme } = useTheme();
  if (pathname === "/") return null;

  return (
    <header style={{
      backgroundColor: C.primary,
      padding: "12px 28px",
      display: "grid",
      gridTemplateColumns: "1fr auto 1fr",
      alignItems: "center",
      boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
      position: "sticky",
      top: 0,
      zIndex: 100,
    }}>

      {/* Coluna esquerda — brasão */}
      <div style={{ display: "flex", alignItems: "center" }}>
        <img
          src={brasao}
          alt="Brasão UFRGS"
          style={{ height: "52px", width: "auto" }}
        />
      </div>

      {/* Coluna central — título */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "18px", fontWeight: "700", color: C.white, letterSpacing: "0.02em", lineHeight: 1.2 }}>
          Mining Method Selection Tool
        </div>
        <div style={{ fontSize: "11px", color: C.muted, letterSpacing: "0.06em", marginTop: "2px" }}>
          UFRGS · LAPROM · MMS 2.0
        </div>
      </div>

      {/* Coluna direita — toggle de tema + ícone mineração */}
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "16px" }}>
        <button
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
          title={theme === "dark" ? "Modo claro" : "Modo escuro"}
          style={{
            width: "34px", height: "34px", borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.3)",
            backgroundColor: "rgba(255,255,255,0.08)",
            color: C.white, fontSize: "16px", lineHeight: 1,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            padding: 0,
          }}
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
        <img
          src={mineracao}
          alt="Ícone mineração"
          style={{ height: "40px", width: "auto", filter: "brightness(0) invert(1)", opacity: 0.7 }}
        />
      </div>

    </header>
  );
}
