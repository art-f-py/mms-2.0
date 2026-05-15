import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMms } from "../context/MmsContext";
import {
  calculateUBC, calculateNicholas81, calculateNicholas92, calculateSHB,
  classifyRSS, classifyRSSNicholas,
} from "../algorithms/algorithms";

// ---------------------------------------------------------------------------
// TOKENS DE DESIGN
// ---------------------------------------------------------------------------
const C = {
  primary:   "#1e3a5f",
  primary50: "#e8eef5",
  border:    "#e2e8f0",
  text:      "#1a202c",
  muted:     "#64748b",
  bg:        "#f8fafc",
  white:     "#ffffff",
  success:   "#0f766e",
  warning:   "#b45309",
};

const S = {
  page:  { minHeight: "100vh", backgroundColor: C.bg, padding: "32px 24px" },
  wrap:  { maxWidth: "780px", margin: "0 auto" },
  card:  { backgroundColor: C.white, border: `1px solid ${C.border}`, borderRadius: "10px", padding: "28px", marginTop: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" },
  label: { fontSize: "13px", fontWeight: "600", color: C.text, marginBottom: "6px", display: "block" },
  hint:  { fontSize: "12px", color: C.muted, marginTop: "4px" },
  inp:   { width: "100%", padding: "9px 12px", borderRadius: "6px", border: `1px solid ${C.border}`, fontSize: "14px", color: C.text, boxSizing: "border-box", backgroundColor: C.white },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" },
  grid3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px" },
  sec:   { marginBottom: "24px" },
  div:   { borderTop: `1px solid ${C.border}`, margin: "24px 0" },
  btnPrimary:   { padding: "10px 24px", backgroundColor: C.primary, color: C.white, border: "none", borderRadius: "6px", fontWeight: "600", fontSize: "14px", cursor: "pointer" },
  btnSecondary: { padding: "10px 24px", backgroundColor: C.white, color: C.text, border: `1px solid ${C.border}`, borderRadius: "6px", fontWeight: "600", fontSize: "14px", cursor: "pointer" },
  btnGhost:     { padding: "6px 14px", backgroundColor: "transparent", color: C.muted, border: `1px solid ${C.border}`, borderRadius: "6px", fontSize: "13px", cursor: "pointer" },
};

const zones = { ore: "Corpo de minério", hangingWall: "Hanging wall", footwall: "Foot wall" };

const RSS_COLORS = {
  "Muito fraca": { bg: "#fee2e2", text: "#991b1b" },
  "Fraca":       { bg: "#fef3c7", text: "#92400e" },
  "Moderada":    { bg: "#d1fae5", text: "#065f46" },
  "Resistente":  { bg: "#dbeafe", text: "#1e40af" },
};

// ---------------------------------------------------------------------------
// COMPONENTES AUXILIARES
// ---------------------------------------------------------------------------
function Field({ label, hint, children }) {
  return (
    <div style={S.sec}>
      <label style={S.label}>{label}</label>
      {children}
      {hint && <p style={S.hint}>{hint}</p>}
    </div>
  );
}

function Sel({ value, onChange, options }) {
  return (
    <select style={S.inp} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Selecione</option>
      {options.map((o) => <option key={o}>{o}</option>)}
    </select>
  );
}

function Num({ value, onChange, placeholder }) {
  return (
    <input type="number" min="0" style={S.inp} placeholder={placeholder} value={value}
      onChange={(e) => onChange(e.target.value)} />
  );
}

function SecTitle({ children }) {
  return <p style={{ fontSize: "11px", fontWeight: "700", color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 16px" }}>{children}</p>;
}

function RSSBadge({ value }) {
  if (!value) return <span style={{ fontSize: "12px", color: C.muted, fontStyle: "italic" }}>preencha UCS, densidade e profundidade</span>;
  const col = RSS_COLORS[value] || { bg: "#f3f4f6", text: "#374151" };
  return (
    <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: "12px", fontSize: "12px", fontWeight: "700", backgroundColor: col.bg, color: col.text }}>
      {value}
    </span>
  );
}

function ReviewRow({ label, value }) {
  if (!value || value === "") return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}`, fontSize: "13px" }}>
      <span style={{ color: C.muted }}>{label}</span>
      <span style={{ fontWeight: "600", color: C.text }}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// STEPPER
// ---------------------------------------------------------------------------
const STEPS = [
  { id: 1, label: "Métodos" },
  { id: 2, label: "Geometria" },
  { id: 3, label: "Geotécnica" },
  { id: 4, label: "Complementar" },
  { id: 5, label: "Revisar" },
];

function StepperHeader({ current }) {
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: "8px" }}>
      {STEPS.map((step, i) => {
        const done   = step.id < current;
        const active = step.id === current;
        return (
          <div key={step.id} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "none" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "700", backgroundColor: done ? C.success : active ? C.primary : C.border, color: done || active ? C.white : C.muted, flexShrink: 0 }}>
                {done ? "✓" : step.id}
              </div>
              <span style={{ fontSize: "11px", fontWeight: active ? "700" : "400", color: active ? C.primary : C.muted, whiteSpace: "nowrap" }}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: "2px", backgroundColor: done ? C.success : C.border, margin: "0 8px", marginBottom: "20px" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ---------------------------------------------------------------------------
function Inputs() {
  const { state, dispatch } = useMms();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  const fd = state.formData;
  const sm = fd.selectedMethods;
  const showUBC  = sm.ubc;
  const showN81  = sm.nicholas81;
  const showN92  = sm.nicholas92;
  const showSHB  = sm.shb;
  const showNich = showN81 || showN92;
  const anyMethod = Object.values(sm).some(Boolean);

  const set = (section, field, value) =>
    dispatch({ type: "SET_FORM_FIELD", section, field, value });

  const toggleMethod = (key) =>
    dispatch({ type: "SET_FORM_FIELD", section: "selectedMethods", field: key, value: !fd.selectedMethods[key] });

  // RSS calculado em tempo real — fórmula: UCS×1e6 / (densidade × profundidade × 9.81)
  const rssLive = {
    ore:         classifyRSS(fd.ucs?.ore,         fd.density?.ore,         fd.depth?.ore),
    hangingWall: classifyRSS(fd.ucs?.hangingWall, fd.density?.hangingWall, fd.depth?.hangingWall),
    footwall:    classifyRSS(fd.ucs?.footwall,    fd.density?.footwall,    fd.depth?.footwall),
  };
  const rssNichLive = {
    ore:         classifyRSSNicholas(fd.ucs?.ore,         fd.density?.ore,         fd.depth?.ore),
    hangingWall: classifyRSSNicholas(fd.ucs?.hangingWall, fd.density?.hangingWall, fd.depth?.hangingWall),
    footwall:    classifyRSSNicholas(fd.ucs?.footwall,    fd.density?.footwall,    fd.depth?.footwall),
  };

  const handleCalculate = () => {
    if (showUBC)  dispatch({ type: "SET_RESULT", method: "ubc",        payload: calculateUBC(fd) });
    else          dispatch({ type: "SET_RESULT", method: "ubc",        payload: null });
    if (showN81)  dispatch({ type: "SET_RESULT", method: "nicholas81", payload: calculateNicholas81(fd) });
    else          dispatch({ type: "SET_RESULT", method: "nicholas81", payload: null });
    if (showN92)  dispatch({ type: "SET_RESULT", method: "nicholas92", payload: calculateNicholas92(fd, fd.multipliers) });
    else          dispatch({ type: "SET_RESULT", method: "nicholas92", payload: null });
    if (showSHB)  dispatch({ type: "SET_RESULT", method: "shb",        payload: calculateSHB(fd) });
    else          dispatch({ type: "SET_RESULT", method: "shb",        payload: null });
    navigate("/statistics");
  };

  const next = () => setStep((s) => Math.min(s + 1, 5));
  const prev = () => setStep((s) => Math.max(s - 1, 1));

  // ---------------------------------------------------------------------------
  // ETAPA 1 — MÉTODOS
  // ---------------------------------------------------------------------------
  const Step1 = (
    <div style={S.card}>
      <SecTitle>Selecione os métodos de seleção</SecTitle>
      <p style={{ fontSize: "14px", color: C.muted, marginTop: 0, marginBottom: "20px" }}>
        O formulário se ajustará automaticamente aos campos necessários.
      </p>
      <div style={S.grid2}>
        {[
          { key: "ubc",        label: "UBC 1995",      desc: "Miller-Tait, Pakalnis & Poulin" },
          { key: "nicholas81", label: "Nicholas 1981",  desc: "Nicholas, D.E. — SME-AIME" },
          { key: "nicholas92", label: "Nicholas 1992",  desc: "Nicholas, D.E. — SME Handbook" },
          { key: "shb",        label: "SH&B 2007",      desc: "Shahriar, Bakhtavar et al." },
        ].map(({ key, label, desc }) => {
          const active = fd.selectedMethods[key];
          return (
            <div key={key} onClick={() => toggleMethod(key)} style={{ padding: "16px", borderRadius: "8px", cursor: "pointer", border: `2px solid ${active ? C.primary : C.border}`, backgroundColor: active ? C.primary50 : C.white, transition: "all 0.15s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "18px", height: "18px", borderRadius: "4px", flexShrink: 0, border: `2px solid ${active ? C.primary : C.border}`, backgroundColor: active ? C.primary : C.white, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {active && <span style={{ color: C.white, fontSize: "11px", fontWeight: "700" }}>✓</span>}
                </div>
                <div>
                  <div style={{ fontWeight: "700", fontSize: "14px", color: C.text }}>{label}</div>
                  <div style={{ fontSize: "12px", color: C.muted }}>{desc}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {!anyMethod && <p style={{ marginTop: "16px", fontSize: "13px", color: C.warning, fontWeight: "600" }}>⚠ Selecione pelo menos um método para continuar.</p>}
    </div>
  );

  // ---------------------------------------------------------------------------
  // ETAPA 2 — GEOMETRIA
  // ---------------------------------------------------------------------------
  const Step2 = (
    <div style={S.card}>
      <SecTitle>Geometria do depósito</SecTitle>
      <div style={S.grid2}>
        <Field label="Forma geral">
          <Sel value={fd.geometry.shape} onChange={(v) => set("geometry", "shape", v)}
            options={["Massivo", "Tabular", "Irregular"]} />
        </Field>
        <Field label="Espessura">
          <Sel value={fd.geometry.thickness} onChange={(v) => set("geometry", "thickness", v)}
            options={["Muito estreito", "Estreito", "Intermediário", "Espesso", "Muito espesso"]} />
        </Field>
        <Field label="Mergulho (°)" hint="UBC/Nicholas: Plano <20° | Interm. 20–55° | Inclinado >55°. SH&B: faixas de 15°.">
          <Num value={fd.dip} onChange={(v) => set("dip", null, v)} placeholder="ex: 65" />
        </Field>
        <Field label="Distribuição de teores">
          <Sel value={fd.geometry.grade} onChange={(v) => set("geometry", "grade", v)}
            options={["Uniforme", "Gradacional", "Errático"]} />
        </Field>
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // ETAPA 3 — GEOTÉCNICA
  // ---------------------------------------------------------------------------
  const Step3 = (
    <div style={S.card}>

      {/* RSS calculado — UBC e/ou SH&B */}
      {(showUBC || showSHB) && (
        <>
          <SecTitle>Rock Substance Strength (RSS)</SecTitle>
          <p style={{ ...S.hint, marginBottom: "20px" }}>
            RSS = UCS × 10⁶ / (Densidade × Profundidade × 9,81). Preencha os três campos por domínio.
          </p>
          <div style={S.grid3}>
            {["ore", "hangingWall", "footwall"].map((z) => (
              <div key={z} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <span style={{ fontWeight: "700", fontSize: "13px", color: C.text, borderBottom: `2px solid ${C.primary}`, paddingBottom: "4px" }}>
                  {zones[z]}
                </span>
                <div>
                  <label style={S.label}>UCS (MPa)</label>
                  <Num value={fd.ucs[z]} onChange={(v) => set("ucs", z, v)} placeholder="ex: 185" />
                </div>
                <div>
                  <label style={S.label}>Densidade (kg/m³)</label>
                  <Num value={fd.density[z]} onChange={(v) => set("density", z, v)} placeholder="ex: 2600" />
                </div>
                <div>
                  <label style={S.label}>Profundidade (m)</label>
                  <Num value={fd.depth[z]} onChange={(v) => set("depth", z, v)} placeholder="ex: 600" />
                </div>
                <div>
                  <label style={S.label}>RSS</label>
                  <RSSBadge value={rssLive[z]} />
                  {showNich && rssNichLive[z] && (
                    <p style={{ ...S.hint, marginTop: "4px" }}>Nicholas: {rssNichLive[z]}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div style={S.div} />
        </>
      )}

      {/* RSS manual — Nicholas sem UBC/SHB */}
      {showNich && !showUBC && !showSHB && (
        <>
          <SecTitle>Rock Substance Strength (RSS)</SecTitle>
          <div style={S.grid3}>
            {["ore", "hangingWall", "footwall"].map((z) => (
              <Field key={z} label={zones[z]}>
                <Sel value={fd.rss[z]} onChange={(v) => set("rss", z, v)}
                  options={["Fraca", "Moderada", "Resistente"]} />
              </Field>
            ))}
          </div>
          <div style={S.div} />
        </>
      )}

      {/* RMR */}
      {(showUBC || showSHB) && (
        <>
          <SecTitle>Rock Mass Rating (RMR)</SecTitle>
          <div style={S.grid3}>
            {["ore", "hangingWall", "footwall"].map((z) => (
              <Field key={z} label={zones[z]}>
                <Sel value={fd.rmr[z]} onChange={(v) => set("rmr", z, v)}
                  options={["Muito fraca", "Fraca", "Média", "Forte", "Muito forte"]} />
              </Field>
            ))}
          </div>
        </>
      )}

      {/* Fraturas — Nicholas */}
      {showNich && (
        <>
          <div style={S.div} />
          <SecTitle>Fraturas</SecTitle>
          <p style={{ fontSize: "13px", fontWeight: "600", color: C.text, marginBottom: "12px" }}>Espaçamento das fraturas</p>
          <div style={S.grid3}>
            {["ore", "hangingWall", "footwall"].map((z) => (
              <Field key={z} label={zones[z]}>
                <Sel value={fd.jointSpacing[z]} onChange={(v) => set("jointSpacing", z, v)}
                  options={["Muito Perto", "Perto", "Longe", "Muito Longe"]} />
              </Field>
            ))}
          </div>
          <p style={{ fontSize: "13px", fontWeight: "600", color: C.text, margin: "20px 0 12px" }}>Características das interfraturas</p>
          <div style={S.grid3}>
            {["ore", "hangingWall", "footwall"].map((z) => (
              <Field key={z} label={zones[z]}>
                <Sel value={fd.jointCondition[z]} onChange={(v) => set("jointCondition", z, v)}
                  options={["Fraca", "Média", "Forte"]} />
              </Field>
            ))}
          </div>
        </>
      )}
    </div>
  );

  // ---------------------------------------------------------------------------
  // ETAPA 4 — COMPLEMENTAR
  // ---------------------------------------------------------------------------
  const step4Relevant = showSHB || showN92;

  const Step4 = (
    <div style={S.card}>
      {showSHB && (
        <>
          <SecTitle>Valor do Minério (SH&B)</SecTitle>
          <div style={{ maxWidth: "280px" }}>
            <Sel value={fd.oreValue} onChange={(v) => set("oreValue", null, v)}
              options={["Baixo", "Médio", "Alto"]} />
          </div>
        </>
      )}

      {showN92 && (
        <>
          {showSHB && <div style={S.div} />}
          <SecTitle>Multiplicadores — Nicholas 1992</SecTitle>
          <p style={{ ...S.hint, marginBottom: "20px" }}>Padrão: Geometria=1.00, Orebody=1.33, HW=1.33, FW=1.33.</p>
          <div style={S.grid2}>
            {[["geometry","Geometria"],["orebody","Corpo de minério"],["hangingWall","Hanging wall"],["footwall","Foot wall"]].map(([key, label]) => (
              <div key={key}>
                <label style={S.label}>{label} — <span style={{ color: C.primary }}>{fd.multipliers[key].toFixed(2)}</span></label>
                <input type="range" min="0" max="3" step="0.01"
                  style={{ width: "100%", accentColor: C.primary }}
                  value={fd.multipliers[key]}
                  onChange={(e) => dispatch({ type: "SET_MULTIPLIER", key, value: parseFloat(e.target.value) })} />
              </div>
            ))}
          </div>
          <button style={{ ...S.btnGhost, marginTop: "12px" }}
            onClick={() => dispatch({ type: "RESET_MULTIPLIERS" })}>
            Restaurar padrão
          </button>
        </>
      )}

      {!step4Relevant && (
        <p style={{ color: C.muted, fontSize: "14px" }}>Nenhum campo complementar necessário para os métodos selecionados.</p>
      )}
    </div>
  );

  // ---------------------------------------------------------------------------
  // ETAPA 5 — REVISAR
  // ---------------------------------------------------------------------------
  const selectedLabels = [
    sm.ubc && "UBC 1995", sm.nicholas81 && "Nicholas 1981",
    sm.nicholas92 && "Nicholas 1992", sm.shb && "SH&B 2007",
  ].filter(Boolean).join(", ");

  const Step5 = (
    <div style={S.card}>
      <SecTitle>Resumo dos parâmetros</SecTitle>

      <p style={{ fontSize: "13px", fontWeight: "700", color: C.text, margin: "0 0 8px" }}>Métodos</p>
      <p style={{ fontSize: "14px", color: C.primary, fontWeight: "600", margin: "0 0 20px" }}>{selectedLabels || "—"}</p>

      <p style={{ fontSize: "13px", fontWeight: "700", color: C.text, margin: "0 0 8px" }}>Geometria</p>
      <ReviewRow label="Forma"        value={fd.geometry.shape} />
      <ReviewRow label="Espessura"    value={fd.geometry.thickness} />
      <ReviewRow label="Mergulho"     value={fd.dip ? `${fd.dip}°` : ""} />
      <ReviewRow label="Distribuição" value={fd.geometry.grade} />

      <p style={{ fontSize: "13px", fontWeight: "700", color: C.text, margin: "20px 0 8px" }}>Geotécnica</p>
      {["ore","hangingWall","footwall"].map((z) => (
        <ReviewRow key={`ucs-${z}`} label={`UCS — ${zones[z]}`}       value={fd.ucs[z] ? `${fd.ucs[z]} MPa` : ""} />
      ))}
      {["ore","hangingWall","footwall"].map((z) => (
        <ReviewRow key={`den-${z}`} label={`Densidade — ${zones[z]}`} value={fd.density[z] ? `${fd.density[z]} kg/m³` : ""} />
      ))}
      {["ore","hangingWall","footwall"].map((z) => (
        <ReviewRow key={`dep-${z}`} label={`Profundidade — ${zones[z]}`} value={fd.depth[z] ? `${fd.depth[z]} m` : ""} />
      ))}
      {["ore","hangingWall","footwall"].map((z) => (
        <ReviewRow key={`rss-${z}`} label={`RSS — ${zones[z]}`} value={rssLive[z] || fd.rss[z]} />
      ))}
      {["ore","hangingWall","footwall"].map((z) => (
        <ReviewRow key={`rmr-${z}`} label={`RMR — ${zones[z]}`} value={fd.rmr[z]} />
      ))}
      {["ore","hangingWall","footwall"].map((z) => (
        <ReviewRow key={`js-${z}`}  label={`Espaç. fraturas — ${zones[z]}`} value={fd.jointSpacing[z]} />
      ))}
      {["ore","hangingWall","footwall"].map((z) => (
        <ReviewRow key={`jc-${z}`}  label={`Interfraturas — ${zones[z]}`}   value={fd.jointCondition[z]} />
      ))}

      {(showSHB || showN92) && (
        <>
          <p style={{ fontSize: "13px", fontWeight: "700", color: C.text, margin: "20px 0 8px" }}>Complementar</p>
          <ReviewRow label="Valor do minério" value={fd.oreValue} />
          {showN92 && (
            <ReviewRow label="Multiplicadores N92"
              value={`Geo=${fd.multipliers.geometry.toFixed(2)} | Ore=${fd.multipliers.orebody.toFixed(2)} | HW=${fd.multipliers.hangingWall.toFixed(2)} | FW=${fd.multipliers.footwall.toFixed(2)}`} />
          )}
        </>
      )}

      <button onClick={handleCalculate}
        style={{ ...S.btnPrimary, width: "100%", padding: "14px", fontSize: "15px", marginTop: "28px" }}>
        CALCULAR
      </button>
    </div>
  );

  const STEP_CONTENT = [Step1, Step2, Step3, Step4, Step5];

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{ marginBottom: "28px" }}>
          <h2 style={{ margin: "0 0 4px", color: C.text, fontSize: "22px" }}>Parâmetros do Depósito</h2>
          <p style={{ margin: 0, color: C.muted, fontSize: "14px" }}>MMS 2.0 — Mining Method Selection</p>
        </div>

        <StepperHeader current={step} />
        {STEP_CONTENT[step - 1]}

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "20px" }}>
          <button style={S.btnSecondary} onClick={prev} disabled={step === 1}>← Anterior</button>
          {step < 5 && (
            <button style={{ ...S.btnPrimary, opacity: step === 1 && !anyMethod ? 0.5 : 1 }}
              onClick={next} disabled={step === 1 && !anyMethod}>
              Próximo →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default Inputs;
