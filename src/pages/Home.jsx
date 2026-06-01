import { useNavigate } from "react-router-dom";
 
const C = {
  primary:   "#1e3a5f",
  primaryLt: "#2c5282",
  white:     "#ffffff",
  muted:     "#93c5fd",
};
 
export default function Home() {
  const navigate = useNavigate();
  return (
    <div style={{
      minHeight: "100vh",
      background: `linear-gradient(160deg, ${C.primary} 0%, ${C.primaryLt} 100%)`,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      padding: "32px 24px",
    }}>
      <h1 style={{
        fontSize: "42px",
        fontWeight: 700,
        color: C.white,
        letterSpacing: "0.02em",
        margin: 0,
        lineHeight: 1.15,
      }}>
        Mining Method Selection Tool
      </h1>
      <p style={{
        fontSize: "15px",
        color: C.muted,
        letterSpacing: "0.08em",
        marginTop: "16px",
        marginBottom: "48px",
      }}>
        UFRGS · LAPROM · MMS 2.0
      </p>
      <button
        onClick={() => navigate("/inputs")}
        style={{
          padding: "14px 48px",
          backgroundColor: C.white,
          color: C.primary,
          border: "none",
          borderRadius: "8px",
          fontWeight: 700,
          fontSize: "17px",
          cursor: "pointer",
          boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
        }}
      >
        Iniciar
      </button>
    </div>
  );
}
