import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { DENSITY_DATA, UCS_DATA } from "../data/rockData";

// Tokens semânticos → variáveis CSS centralizadas em index.css
const C = {
  primary: "var(--color-primary)",
  border:  "var(--color-border)",
  text:    "var(--color-text)",
  muted:   "var(--color-muted)",
  white:   "var(--color-white)",
  bg:      "var(--color-bg)",
};

/**
 * Botão que abre um popup com tabela de valores típicos por tipo de rocha.
 * 
 * Props:
 *   type: "density" | "ucs"
 *   onSelect: (value: number) => void  — chamado quando o usuário clica em um valor
 */
export default function RockTooltip({ type, onSelect }) {
  const { t } = useTranslation();
  const [open, setOpen]         = useState(false);
  const [family, setFamily]     = useState("Ígneas");
  const [align, setAlign]       = useState("left");
  const btnRef                  = useRef(null);

  const data   = type === "density" ? DENSITY_DATA : UCS_DATA;
  const unit   = type === "density" ? "kg/m³" : "MPa";
  const title  = type === "density" ? t("rockTooltip.density") : t("rockTooltip.ucs");
  const families = Object.keys(data);

  const handleSelect = (min, max) => {
    const avg = Math.round((min + max) / 2);
    onSelect(avg);
    setOpen(false);
  };

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const rect       = btnRef.current.getBoundingClientRect();
      const popupWidth = Math.min(340, window.innerWidth - 32);
      setAlign(rect.left + popupWidth > window.innerWidth - 16 ? "right" : "left");
    }
    setOpen((v) => !v);
  };

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {/* Botão calculadora */}
      <button
        ref={btnRef}
        onClick={handleToggle}
        title={t("rockTooltip.consult", { title })}
        style={{
          width: "44px", height: "44px", borderRadius: "6px",
          border: `1px solid ${C.border}`, backgroundColor: C.white,
          cursor: "pointer", display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: "16px",
          color: C.primary, flexShrink: 0,
        }}
      >
        🪨
      </button>

      {/* Popup */}
      {open && (
        <>
          {/* Overlay para fechar clicando fora */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 200 }}
          />

          <div style={{
            position: "absolute", top: "50px",
            left: align === "left" ? 0 : "auto",
            right: align === "right" ? 0 : "auto",
            zIndex: 201,
            backgroundColor: C.white, border: `1px solid ${C.border}`,
            borderRadius: "10px", boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            width: "min(340px, calc(100vw - 32px))", overflow: "hidden",
          }}>
            {/* Header */}
            <div style={{ backgroundColor: C.primary, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: C.white, fontWeight: "700", fontSize: "13px" }}>{t("rockTooltip.header", { title, unit })}</span>
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: C.white, cursor: "pointer", fontSize: "16px", lineHeight: 1 }}>×</button>
            </div>

            {/* Tabs de família */}
            <div style={{ display: "flex", borderBottom: `1px solid ${C.border}` }}>
              {families.map((f) => (
                <button
                  key={f}
                  onClick={() => setFamily(f)}
                  style={{
                    flex: 1, padding: "8px 4px", minHeight: "44px", fontSize: "12px", fontWeight: family === f ? "700" : "400",
                    color: family === f ? C.primary : C.muted,
                    borderBottom: family === f ? `2px solid ${C.primary}` : "2px solid transparent",
                    background: "none", border: "none", cursor: "pointer",
                  }}
                >
                  {t(`enums.rockFamily.${f}`)}
                </button>
              ))}
            </div>

            {/* Tabela */}
            <div style={{ maxHeight: "280px", overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ backgroundColor: C.bg }}>
                    <th style={{ padding: "8px 12px", textAlign: "left", color: C.muted, fontWeight: "600", borderBottom: `1px solid ${C.border}` }}>{t("rockTooltip.rock")}</th>
                    <th style={{ padding: "8px 12px", textAlign: "center", color: C.muted, fontWeight: "600", borderBottom: `1px solid ${C.border}` }}>{t("rockTooltip.min", { unit })}</th>
                    <th style={{ padding: "8px 12px", textAlign: "center", color: C.muted, fontWeight: "600", borderBottom: `1px solid ${C.border}` }}>{t("rockTooltip.max", { unit })}</th>
                    <th style={{ padding: "8px 12px", textAlign: "center", color: C.muted, fontWeight: "600", borderBottom: `1px solid ${C.border}` }}>{t("rockTooltip.useAvg")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data[family].map((row, i) => (
                    <tr key={row.rock} style={{ backgroundColor: i % 2 === 0 ? C.white : C.bg }}>
                      <td style={{ padding: "7px 12px", color: C.text, borderBottom: `1px solid ${C.border}` }}>{row.rock}</td>
                      <td style={{ padding: "7px 12px", textAlign: "center", color: C.muted, borderBottom: `1px solid ${C.border}` }}>{row.min}</td>
                      <td style={{ padding: "7px 12px", textAlign: "center", color: C.muted, borderBottom: `1px solid ${C.border}` }}>{row.max}</td>
                      <td style={{ padding: "7px 12px", textAlign: "center", borderBottom: `1px solid ${C.border}` }}>
                        <button
                          onClick={() => handleSelect(row.min, row.max)}
                          style={{
                            padding: "3px 10px", minWidth: "44px", minHeight: "44px",
                            backgroundColor: C.primary, color: C.white,
                            border: "none", borderRadius: "4px", fontSize: "11px",
                            cursor: "pointer", fontWeight: "600",
                          }}
                        >
                          {Math.round((row.min + row.max) / 2)}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ padding: "8px 14px", backgroundColor: C.bg, fontSize: "11px", color: C.muted, borderTop: `1px solid ${C.border}` }}>
              {t("rockTooltip.clickHint")}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
