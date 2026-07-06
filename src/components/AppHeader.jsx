import { useLocation, Link } from "react-router-dom";
import brasao    from "../assets/brasao.png";
import mineracao from "../assets/mineracao.png";

export default function AppHeader() {
  const { pathname } = useLocation();
  if (pathname === "/") return null;

  return (
    <header style={{
      backgroundColor: "var(--color-primary)",
      padding: "12px 28px",
      display: "grid",
      gridTemplateColumns: "1fr auto 1fr",
      alignItems: "center",
      boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
      position: "sticky",
      top: 0,
      zIndex: 100,
    }}>

      {/* Coluna esquerda — brasão (link para Home) */}
      <Link to="/" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
        <img
          src={brasao}
          alt="Brasão UFRGS"
          style={{ height: "52px", width: "auto" }}
        />
      </Link>

      {/* Coluna central — título (link para Home) */}
      <Link to="/" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
        <div style={{ fontSize: "18px", fontWeight: "700", color: "var(--color-white)", letterSpacing: "0.02em", lineHeight: 1.2 }}>
          Mining Method Selection Tool
        </div>
        <div style={{ fontSize: "11px", color: "#93c5fd", letterSpacing: "0.06em", marginTop: "2px" }}>
          UFRGS · LAPROM · MMS 2.0
        </div>
      </Link>

      {/* Coluna direita — ícone mineração */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <img
          src={mineracao}
          alt="Ícone mineração"
          style={{ height: "40px", width: "auto", filter: "brightness(0) invert(1)", opacity: 0.7 }}
        />
      </div>

    </header>
  );
}
