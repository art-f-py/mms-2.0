import { useState } from "react";
import { RMR_PARAMS, rmrToClass, gsiToRmr, qToRmr } from "../data/rmrData";

const C = {
  primary: "#1e3a5f",
  border:  "#e2e8f0",
  text:    "#1a202c",
  muted:   "#64748b",
  white:   "#ffffff",
  bg:      "#f8fafc",
};

const CLASS_COLORS = {
  "Muito pobre": { bg: "#fee2e2", text: "#991b1b" },
  "Pobre":       { bg: "#fef3c7", text: "#92400e" },
  "Razoável":    { bg: "#fef9c3", text: "#713f12" },
  "Boa":         { bg: "#d1fae5", text: "#065f46" },
  "Muito boa":   { bg: "#dbeafe", text: "#1e40af" },
};

const inp = {
  width: "100%", padding: "8px 10px", borderRadius: "6px",
  border: `1px solid #e2e8f0`, fontSize: "13px",
  color: "#1a202c", boxSizing: "border-box", backgroundColor: "#ffffff",
};

const zones = { ore: "Corpo de minério", hangingWall: "Hanging wall", footwall: "Foot wall" };

/**
 * Seletor RMR/GSI/Q com calculadora embutida.
 * 
 * O componente expõe três abas:
 *  - RMR direto (select)
 *  - GSI → converte e preenche RMR
 *  - Q   → converte e preenche RMR
 *  - Calculadora Bieniawski (abre popup separado)
 * 
 * Props:
 *   zone:     "ore" | "hangingWall" | "footwall"
 *   value:    classe RMR atual
 *   onChange: (classe: string) => void
 */
export default function RMRCalculator({ zone, value, onChange }) {
  const [inputMode, setInputMode] = useState("rmr"); // "rmr" | "gsi" | "q"
  const [calcOpen, setCalcOpen]   = useState(false);
  const [gsi, setGsi]             = useState("");
  const [q, setQ]                 = useState("");
  const [selections, setSel]      = useState({});

  const rmrScore = Object.values(selections).reduce((a, b) => a + b, 0);
  const rmrClass = rmrToClass(rmrScore);
  const allFilled = Object.keys(selections).length === RMR_PARAMS.length;

  const col = value ? (CLASS_COLORS[value] || {}) : {};

  const applyGsi = () => {
    const v = parseFloat(gsi);
    if (!isNaN(v)) onChange(rmrToClass(gsiToRmr(v)));
  };

  const applyQ = () => {
    const v = parseFloat(q);
    if (!isNaN(v) && v > 0) onChange(rmrToClass(qToRmr(v)));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>

      {/* Seletor de modo — RMR / GSI / Q */}
      <div style={{ display: "flex", gap: "0", borderRadius: "6px", overflow: "hidden", border: `1px solid ${C.border}` }}>
        {[["rmr","RMR"],["gsi","GSI"],["q","Q"]].map(([m, lbl]) => (
          <button
            key={m}
            onClick={() => setInputMode(m)}
            style={{
              flex: 1, padding: "6px 4px", fontSize: "12px", fontWeight: inputMode === m ? "700" : "400",
              backgroundColor: inputMode === m ? C.primary : C.white,
              color: inputMode === m ? C.white : C.muted,
              border: "none", cursor: "pointer",
            }}
          >
            {lbl}
          </button>
        ))}
      </div>

      {/* Modo RMR direto */}
      {inputMode === "rmr" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <select style={inp} value={value || ""} onChange={(e) => onChange(e.target.value)}>
            <option value="">Selecione</option>
            <option>Muito pobre</option>
            <option>Pobre</option>
            <option>Razoável</option>
            <option>Boa</option>
            <option>Muito boa</option>
          </select>
          {/* Botão para abrir calculadora Bieniawski */}
          <button
            onClick={() => setCalcOpen(true)}
            style={{ fontSize: "12px", color: C.primary, background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0, textDecoration: "underline" }}
          >
            Calcular via Bieniawski 1989 →
          </button>
        </div>
      )}

      {/* Modo GSI */}
      {inputMode === "gsi" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <p style={{ fontSize: "11px", color: C.muted, margin: 0 }}>RMR = (GSI + 11,63) / 1,13</p>
          <div style={{ display: "flex", gap: "6px" }}>
            <input type="number" min="0" max="100" style={{ ...inp, flex: 1 }}
              placeholder="ex: 55" value={gsi} onChange={(e) => setGsi(e.target.value)} />
            <button onClick={applyGsi} style={{ padding: "8px 12px", backgroundColor: C.primary, color: C.white, border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>
              Aplicar
            </button>
          </div>
          {gsi && !isNaN(parseFloat(gsi)) && (
            <p style={{ fontSize: "11px", color: C.primary, margin: 0, fontWeight: "600" }}>
              → RMR ≈ {gsiToRmr(parseFloat(gsi)).toFixed(1)} ({rmrToClass(gsiToRmr(parseFloat(gsi)))})
            </p>
          )}
        </div>
      )}

      {/* Modo Q */}
      {inputMode === "q" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <p style={{ fontSize: "11px", color: C.muted, margin: 0 }}>RMR = 9 × ln(Q) + 44</p>
          <div style={{ display: "flex", gap: "6px" }}>
            <input type="number" min="0.001" style={{ ...inp, flex: 1 }}
              placeholder="ex: 5.0" value={q} onChange={(e) => setQ(e.target.value)} />
            <button onClick={applyQ} style={{ padding: "8px 12px", backgroundColor: C.primary, color: C.white, border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>
              Aplicar
            </button>
          </div>
          {q && !isNaN(parseFloat(q)) && parseFloat(q) > 0 && (
            <p style={{ fontSize: "11px", color: C.primary, margin: 0, fontWeight: "600" }}>
              → RMR ≈ {qToRmr(parseFloat(q)).toFixed(1)} ({rmrToClass(qToRmr(parseFloat(q)))})
            </p>
          )}
        </div>
      )}

      {/* Badge do valor atual */}
      {value && (
        <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "700", backgroundColor: col.bg, color: col.text, alignSelf: "flex-start" }}>
          {value}
        </span>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* POPUP — Calculadora Bieniawski                                      */}
      {/* ------------------------------------------------------------------ */}
      {calcOpen && (
        <>
          <div onClick={() => setCalcOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 200, backgroundColor: "rgba(0,0,0,0.3)" }}/>
          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            zIndex: 201, backgroundColor: C.white, border: `1px solid ${C.border}`,
            borderRadius: "10px", boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
            width: "480px", maxHeight: "80vh", display: "flex", flexDirection: "column",
          }}>
            {/* Header */}
            <div style={{ backgroundColor: C.primary, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: "10px 10px 0 0", flexShrink: 0 }}>
              <span style={{ color: C.white, fontWeight: "700", fontSize: "14px" }}>
                Calculadora RMR — Bieniawski (1989) · {zones[zone]}
              </span>
              <button onClick={() => setCalcOpen(false)} style={{ background: "none", border: "none", color: C.white, cursor: "pointer", fontSize: "20px", lineHeight: 1 }}>×</button>
            </div>

            {/* Parâmetros — com selects */}
            <div style={{ overflowY: "auto", flex: 1, padding: "16px" }}>
              {RMR_PARAMS.map((param) => (
                <div key={param.id} style={{ marginBottom: "14px" }}>
                  <label style={{ fontSize: "13px", fontWeight: "600", color: C.text, marginBottom: "4px", display: "block" }}>
                    {param.label}
                    {param.sublabel && <span style={{ fontSize: "11px", color: C.muted, fontWeight: "400", marginLeft: "6px" }}>{param.sublabel}</span>}
                  </label>
                  <select
                    style={inp}
                    value={selections[param.id] !== undefined ? String(selections[param.id]) : ""}
                    onChange={(e) => {
                      const w = parseInt(e.target.value);
                      setSel((prev) => ({ ...prev, [param.id]: w }));
                    }}
                  >
                    <option value="">Selecione</option>
                    {param.options.map((opt) => (
                      <option key={opt.label} value={String(opt.weight)}>
                        {opt.label} — {opt.weight} pts
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* Footer com score */}
            <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: C.bg, borderRadius: "0 0 10px 10px", flexShrink: 0 }}>
              <div style={{ fontSize: "13px" }}>
                <span style={{ color: C.muted }}>Score: </span>
                <strong>{rmrScore}</strong>
                <span style={{ color: C.muted }}> → </span>
                <strong style={{ color: CLASS_COLORS[rmrClass]?.text || C.text }}>{rmrClass}</strong>
              </div>
              <button
                onClick={() => { onChange(rmrClass); setCalcOpen(false); }}
                disabled={!allFilled}
                style={{
                  padding: "8px 20px", backgroundColor: C.primary, color: C.white,
                  border: "none", borderRadius: "6px", fontWeight: "600", fontSize: "13px",
                  cursor: allFilled ? "pointer" : "not-allowed",
                  opacity: allFilled ? 1 : 0.5,
                }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
