import { useEffect } from "react";

// Casca genérica de modal — overlay + cartão centralizado, ciente do tema
export default function Modal({ title, onClose, children, maxWidth = "480px" }) {
  // Fecha com Esc
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "clamp(12px, 4vw, 24px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          width: `min(${maxWidth}, calc(100vw - 32px))`,
          maxHeight: "85vh", overflowY: "auto",
          backgroundColor: "var(--bg-card)",
          color: "var(--text)",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        }}
      >
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px clamp(16px, 5vw, 24px)", borderBottom: "1px solid var(--border)",
          position: "sticky", top: 0, backgroundColor: "var(--bg-card)", borderTopLeftRadius: "12px", borderTopRightRadius: "12px",
        }}>
          <h3 style={{ fontSize: "17px", fontWeight: 700, color: "var(--text)" }}>{title}</h3>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{
              border: "none", background: "transparent", color: "var(--muted)",
              fontSize: "22px", lineHeight: 1, cursor: "pointer", padding: "2px 6px",
            }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: "clamp(16px, 5vw, 24px)" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
