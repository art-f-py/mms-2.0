import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();
  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, var(--color-primary) 0%, var(--color-primary-lt) 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      padding: "32px 24px",
    }}>
      <h1 style={{
        fontSize: "clamp(28px, 9vw, 42px)",
        fontWeight: 700,
        color: "var(--color-white)",
        letterSpacing: "0.02em",
        margin: 0,
        lineHeight: 1.15,
      }}>
        Mining Method Selection Tool
      </h1>
      <p style={{
        fontSize: "clamp(12px, 3.5vw, 15px)",
        color: "#93c5fd",
        letterSpacing: "0.08em",
        marginTop: "16px",
        marginBottom: "48px",
      }}>
        UFRGS · LAPROM · MMS 2.0
      </p>
      <button
        onClick={() => navigate("/inputs")}
        style={{
          padding: "14px clamp(28px, 10vw, 48px)",
          minHeight: "44px",
          backgroundColor: "var(--color-white)",
          color: "var(--color-primary)",
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
