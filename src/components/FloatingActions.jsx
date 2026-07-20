import { useState } from "react";
import { useTranslation } from "react-i18next";
import ReportModal     from "./modals/ReportModal";
import ReferencesModal from "./modals/ReferencesModal";
import CreditsModal    from "./modals/CreditsModal";

// Rótulos resolvidos por i18n em tempo de render (ver floating.* nos locales).
const ACTIONS = [
  { key: "report",     icon: "🚩" },
  { key: "references", icon: "📖" },
  { key: "credits",    icon: "ℹ️" },
];

function FloatingButton({ icon, label, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      style={{ position: "relative", display: "flex", justifyContent: "flex-end", alignItems: "center" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {hover && (
        <span style={{
          position: "absolute", right: "52px", whiteSpace: "nowrap",
          backgroundColor: "var(--color-bg)", color: "var(--color-text)",
          border: "1px solid var(--color-border)", borderRadius: "6px",
          padding: "5px 10px", fontSize: "12px", fontWeight: 600,
          boxShadow: "0 2px 8px rgba(0,0,0,0.18)", pointerEvents: "none",
        }}>
          {label}
        </span>
      )}
      <button
        onClick={onClick}
        aria-label={label}
        style={{
          width: "44px", height: "44px", borderRadius: "50%",
          backgroundColor: "var(--color-bg)", border: "1px solid var(--color-border)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
          cursor: "pointer", fontSize: "16px", lineHeight: 1,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 0, flexShrink: 0,
        }}
      >
        {icon}
      </button>
    </div>
  );
}

export default function FloatingActions() {
  const { t } = useTranslation();
  const [open, setOpen]   = useState(null);
  const [toast, setToast] = useState(false);

  const handleSuccess = () => {
    setOpen(null);
    setToast(true);
    setTimeout(() => setToast(false), 3000);
  };

  return (
    <>
      <div style={{
        position: "fixed", right: "clamp(10px, 4vw, 20px)", bottom: "clamp(10px, 4vw, 20px)", zIndex: 500,
        display: "flex", flexDirection: "column", gap: "10px",
      }}>
        {ACTIONS.map((a) => (
          <FloatingButton key={a.key} icon={a.icon} label={t(`floating.${a.key}`)} onClick={() => setOpen(a.key)} />
        ))}
      </div>

      {open === "report"     && <ReportModal     onClose={() => setOpen(null)} onSuccess={handleSuccess} />}
      {open === "references" && <ReferencesModal onClose={() => setOpen(null)} />}
      {open === "credits"    && <CreditsModal    onClose={() => setOpen(null)} />}

      {toast && (
        <div style={{
          position: "fixed", bottom: "20px", left: "50%", transform: "translateX(-50%)",
          zIndex: 1100, backgroundColor: "var(--color-success)", color: "var(--color-white)",
          padding: "12px 22px", borderRadius: "8px", fontSize: "14px", fontWeight: 600,
          boxShadow: "0 6px 20px rgba(0,0,0,0.3)",
        }}>
          {t("floating.toast")}
        </div>
      )}
    </>
  );
}
