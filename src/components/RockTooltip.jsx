import { useState } from "react";
import { DENSITY_DATA, UCS_DATA } from "../data/rockData";

const C = {
  primary: "#1e3a5f",
  border:  "#e2e8f0",
  text:    "#1a202c",
  muted:   "#64748b",
  white:   "#ffffff",
  bg:      "#f8fafc",
};

/**
 * Botão que abre um popup com tabela de valores típicos por tipo de rocha.
 * 
 * Props:
 *   type: "density" | "ucs"
 *   onSelect: (value: number) => void  — chamado quando o usuário clica em um valor
 */
export default function RockTooltip({ type, onSelect }) {
  const [open, setOpen]         = useState(false);
  const [family, setFamily]     = useState("Ígneas");

  const data   = type === "density" ? DENSITY_DATA : UCS_DATA;
  const unit   = type === "density" ? "kg/m³" : "MPa";
  const title  = type === "density" ? "Massa Específica" : "UCS";
  const families = Object.keys(data);

  const handleSelect = (min, max) => {
    const avg = Math.round((min + max) / 2);
    onSelect(avg);
    setOpen(false);
  };

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {/* Botão calculadora */}
      <button
        onClick={() => setOpen((v) => !v)}
        title={`Consultar ${title} por tipo de rocha`}
        style={{
          width: "28px", height: "28px", borderRadius: "6px",
          border: `1px solid ${C.border}`, backgroundColor: C.white,
          cursor: "pointer", display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: "14px",
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
            position: "absolute", top: "34px", left: 0, zIndex: 201,
            backgroundColor: C.white, border: `1px solid ${C.border}`,
            borderRadius: "10px", boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            width: "340px", overflow: "hidden",
          }}>
            {/* Header */}
            <div style={{ backgroundColor: C.primary, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: C.white, fontWeight: "700", fontSize: "13px" }}>{title} por tipo de rocha ({unit})</span>
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: C.white, cursor: "pointer", fontSize: "16px", lineHeight: 1 }}>×</button>
            </div>

            {/* Tabs de família */}
            <div style={{ display: "flex", borderBottom: `1px solid ${C.border}` }}>
              {families.map((f) => (
                <button
                  key={f}
                  onClick={() => setFamily(f)}
                  style={{
                    flex: 1, padding: "8px 4px", fontSize: "12px", fontWeight: family === f ? "700" : "400",
                    color: family === f ? C.primary : C.muted,
                    borderBottom: family === f ? `2px solid ${C.primary}` : "2px solid transparent",
                    background: "none", border: "none", cursor: "pointer",
                  }}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Tabela */}
            <div style={{ maxHeight: "280px", overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ backgroundColor: C.bg }}>
                    <th style={{ padding: "8px 12px", textAlign: "left", color: C.muted, fontWeight: "600", borderBottom: `1px solid ${C.border}` }}>Rocha</th>
                    <th style={{ padding: "8px 12px", textAlign: "center", color: C.muted, fontWeight: "600", borderBottom: `1px solid ${C.border}` }}>Mín ({unit})</th>
                    <th style={{ padding: "8px 12px", textAlign: "center", color: C.muted, fontWeight: "600", borderBottom: `1px solid ${C.border}` }}>Máx ({unit})</th>
                    <th style={{ padding: "8px 12px", textAlign: "center", color: C.muted, fontWeight: "600", borderBottom: `1px solid ${C.border}` }}>Usar média</th>
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
                            padding: "3px 10px", backgroundColor: C.primary, color: C.white,
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
              Clique em um valor para preenchê-lo automaticamente no campo.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
