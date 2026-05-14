import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMms } from "../context/MmsContext";
import {
  calculateUBC,
  calculateNicholas81,
  calculateNicholas92,
  calculateSHB,
} from "../algorithms/algorithms";
import { DEFAULT_MULTIPLIERS } from "../algorithms/nicholas92Weights";

// ---------------------------------------------------------------------------
// TOKENS DE DESIGN
// ---------------------------------------------------------------------------
const C = {
  primary:   "#1e3a5f",
  primary50: "#e8eef5",
  primary100:"#c5d4e8",
  border:    "#e2e8f0",
  text:      "#1a202c",
  muted:     "#64748b",
  bg:        "#f8fafc",
  white:     "#ffffff",
  success:   "#0f766e",
  warning:   "#b45309",
};

const S = {
  page:    { minHeight: "100vh", backgroundColor: C.bg, padding: "32px 24px" },
  wrap:    { maxWidth: "780px", margin: "0 auto" },
  card:    { backgroundColor: C.white, border: `1px solid ${C.border}`, borderRadius: "10px", padding: "28px", marginTop: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" },
  label:   { fontSize: "13px", fontWeight: "600", color: C.text, marginBottom: "6px", display: "block" },
  hint:    { fontSize: "12px", color: C.muted, marginTop: "4px" },
  inp:     { width: "100%", padding: "9px 12px", borderRadius: "6px", border: `1px solid ${C.border}`, fontSize: "14px", color: C.text, boxSizing: "border-box", backgroundColor: C.white, outline: "none" },
  grid2:   { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" },
  grid3:   { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px" },
  section: { marginBottom: "24px" },
  divider: { borderTop: `1px solid ${C.border}`, margin: "24px 0" },
  btnPrimary: {
    padding: "10px 24px", backgroundColor: C.primary, color: C.white,
    border: "none", borderRadius: "6px", fontWeight: "600", fontSize: "14px",
    cursor: "pointer",
  },
  btnSecondary: {
    padding: "10px 24px", backgroundColor: C.white, color: C.text,
    border: `1px solid ${C.border}`, borderRadius: "6px", fontWeight: "600",
    fontSize: "14px", cursor: "pointer",
  },
  btnGhost: {
    padding: "6px 14px", backgroundColor: "transparent", color: C.muted,
    border: `1px solid ${C.border}`, borderRadius: "6px", fontSize: "13px",
    cursor: "pointer",
  },
};

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------
const zones = { ore: "Corpo de minério", hangingWall: "Hanging wall", footwall: "Foot wall" };

function Field({ label, hint, children }) {
  return (
    <div style={S.section}>
      <label style={S.label}>{label}</label>
      {children}
      {hint && <p style={S.hint}>{hint}</p>}
    </div>
  );
}

function Select({ value, onChange, options, placeholder = "Selecione" }) {
  return (
    <select style={S.inp} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
      ))}
    </select>
  );
}

function NumberInput({ value, onChange, placeholder, min = 0 }) {
  return (
    <input
      type="number" min={min} style={S.inp}
      placeholder={placeholder} value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function ZoneGrid({ section, field, children }) {
  return (
    <div style={S.grid3}>
      {["ore", "hangingWall", "footwall"].map((z) => (
        <Field key={z} label={zones[z]}>
          {children(z)}
        </Field>
      ))}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <p style={{ fontSize: "11px", fontWeight: "700", color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 16px" }}>
      {children}
    </p>
  );
}

// ---------------------------------------------------------------------------
// STEPPER HEADER
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
        const done    = step.id < current;
        const active  = step.id === current;
        const future  = step.id > current;

        return (
          <div key={step.id} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "none" }}>
            {/* Círculo */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
              <div style={{
                width: "32px", height: "32px", borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "13px", fontWeight: "700",
                backgroundColor: done ? C.success : active ? C.primary : C.border,
                color: done || active ? C.white : C.muted,
                flexShrink: 0,
              }}>
                {done ? "✓" : step.id}
              </div>
              <span style={{ fontSize: "11px", fontWeight: active ? "700" : "400", color: active ? C.primary : C.muted, whiteSpace: "nowrap" }}>
                {step.label}
              </span>
            </div>

            {/* Linha conectora */}
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
// RESUMO (Etapa 5)
// ---------------------------------------------------------------------------
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
// COMPONENTE PRINCIPAL
// ---------------------------------------------------------------------------
function Inputs() {
  const { state, dispatch } = useMms();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  const fd = state.formData;

  // Atalhos de visibilidade
  const sm        = fd.selectedMethods;
  const showUBC   = sm.ubc;
  const showN81   = sm.nicholas81;
  const showN92   = sm.nicholas92;
  const showSHB   = sm.shb;
  const showNich  = showN81 || showN92;
  const anyMethod = Object.values(sm).some(Boolean);

  // Dispatch helpers
  const set = (section, field, value) =>
    dispatch({ type: "SET_FORM_FIELD", section, field, value });

  const toggleMethod = (key) =>
    dispatch({
      type: "SET_FORM_FIELD",
      section: "selectedMethods",
      field: key,
      value: !fd.selectedMethods[key],
    });

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
      <SectionTitle>Selecione os métodos de seleção</SectionTitle>
      <p style={{ fontSize: "14px", color: C.muted, marginTop: 0, marginBottom: "20px" }}>
        O formulário se ajustará automaticamente aos campos necessários para os métodos escolhidos.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        {[
          { key: "ubc",        label: "UBC 1995",      desc: "Miller-Tait, Pakalnis & Poulin" },
          { key: "nicholas81", label: "Nicholas 1981",  desc: "Nicholas, D.E. — SME-AIME" },
          { key: "nicholas92", label: "Nicholas 1992",  desc: "Nicholas, D.E. — SME Handbook" },
          { key: "shb",        label: "SH&B 2007",      desc: "Shahriar, Bakhtavar et al." },
        ].map(({ key, label, desc }) => {
          const active = fd.selectedMethods[key];
          return (
            <div
              key={key}
              onClick={() => toggleMethod(key)}
              style={{
                padding: "16px", borderRadius: "8px", cursor: "pointer",
                border: `2px solid ${active ? C.primary : C.border}`,
                backgroundColor: active ? C.primary50 : C.white,
                transition: "all 0.15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{
                  width: "18px", height: "18px", borderRadius: "4px", flexShrink: 0,
                  border: `2px solid ${active ? C.primary : C.border}`,
                  backgroundColor: active ? C.primary : C.white,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
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
      {!anyMethod && (
        <p style={{ marginTop: "16px", fontSize: "13px", color: C.warning, fontWeight: "600" }}>
          ⚠ Selecione pelo menos um método para continuar.
        </p>
      )}
    </div>
  );

  // ---------------------------------------------------------------------------
  // ETAPA 2 — GEOMETRIA
  // ---------------------------------------------------------------------------
  const Step2 = (
    <div style={S.card}>
      <SectionTitle>Geometria do depósito</SectionTitle>
      <div style={S.grid2}>
        <Field label="Forma geral">
          <Select value={fd.geometry.shape} onChange={(v) => set("geometry", "shape", v)}
            options={["Massivo", "Tabular", "Irregular"]} />
        </Field>

        <Field label="Espessura">
          <Select value={fd.geometry.thickness} onChange={(v) => set("geometry", "thickness", v)}
            options={["Muito estreito", "Estreito", "Intermediário", "Espesso", "Muito espesso"]} />
        </Field>

        <Field label="Mergulho (°)" hint="UBC/Nicholas: Plano <20° | Interm. 20–55° | Inclinado >55°. SH&B: 5 faixas de 15°.">
          <NumberInput value={fd.dip} onChange={(v) => set("dip", null, v)} placeholder="ex: 65" min={0} />
        </Field>

        <Field label="Distribuição de teores">
          <Select value={fd.geometry.grade} onChange={(v) => set("geometry", "grade", v)}
            options={["Uniforme", "Gradacional", "Errático"]} />
        </Field>

        {(showUBC || showSHB) && (
          <Field label="Profundidade do corpo de minério (m)"
            hint="UBC: Rasa ≤100m | Interm. 100–600m | Profunda >600m">
            <NumberInput value={fd.depth.ore} onChange={(v) => set("depth", "ore", v)} placeholder="ex: 400" />
          </Field>
        )}
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // ETAPA 3 — GEOTÉCNICA
  // ---------------------------------------------------------------------------
  const rssOptions = (showUBC || showSHB)
    ? ["Muito fraca", "Fraca", "Moderada", "Resistente"]
    : ["Fraca", "Moderada", "Resistente"];

  const Step3 = (
    <div style={S.card}>

      {/* RSS */}
      <SectionTitle>Rock Substance Strength (RSS)</SectionTitle>
      {showNich && (showUBC || showSHB) && (
        <p style={{ ...S.hint, marginBottom: "16px" }}>
          UBC e SH&B usam 4 classes; Nicholas usa 3 (Fraca / Moderada / Resistente).
        </p>
      )}
      <ZoneGrid>
        {(z) => (
          <Select value={fd.rss[z]} onChange={(v) => set("rss", z, v)} options={rssOptions} />
        )}
      </ZoneGrid>

      {(showUBC || showSHB) && (
        <>
          <div style={S.divider} />
          <SectionTitle>Rock Mass Rating (RMR)</SectionTitle>
          <ZoneGrid>
            {(z) => (
              <Select value={fd.rmr[z]} onChange={(v) => set("rmr", z, v)}
                options={["Muito fraca", "Fraca", "Média", "Forte", "Muito forte"]} />
            )}
          </ZoneGrid>
        </>
      )}

      {showNich && (
        <>
          <div style={S.divider} />
          <SectionTitle>Fraturas</SectionTitle>

          <p style={{ fontSize: "13px", fontWeight: "600", color: C.text, marginBottom: "12px" }}>Espaçamento das fraturas</p>
          <ZoneGrid>
            {(z) => (
              <Select value={fd.jointSpacing[z]} onChange={(v) => set("jointSpacing", z, v)}
                options={["Muito Perto", "Perto", "Longe", "Muito Longe"]} />
            )}
          </ZoneGrid>

          <p style={{ fontSize: "13px", fontWeight: "600", color: C.text, margin: "20px 0 12px" }}>Características das interfraturas</p>
          <ZoneGrid>
            {(z) => (
              <Select value={fd.jointCondition[z]} onChange={(v) => set("jointCondition", z, v)}
                options={["Fraca", "Média", "Forte"]} />
            )}
          </ZoneGrid>
        </>
      )}
    </div>
  );

  // ---------------------------------------------------------------------------
  // ETAPA 4 — COMPLEMENTAR
  // ---------------------------------------------------------------------------
  const Step4 = (
    <div style={S.card}>

      {showUBC && (
        <>
          <SectionTitle>Densidade (kg/m³)</SectionTitle>
          <ZoneGrid>
            {(z) => (
              <NumberInput value={fd.density[z]} onChange={(v) => set("density", z, v)} placeholder="ex: 2800" />
            )}
          </ZoneGrid>

          <div style={S.divider} />
          <SectionTitle>Uniaxial Compressive Strength (UCS) (MPa)</SectionTitle>
          <ZoneGrid>
            {(z) => (
              <NumberInput value={fd.ucs[z]} onChange={(v) => set("ucs", z, v)} placeholder="ex: 80" />
            )}
          </ZoneGrid>
        </>
      )}

      {showSHB && (
        <>
          {showUBC && <div style={S.divider} />}
          <SectionTitle>Valor do Minério (SH&B)</SectionTitle>
          <div style={{ maxWidth: "280px" }}>
            <Select value={fd.oreValue} onChange={(v) => set("oreValue", null, v)}
              options={["Baixo", "Médio", "Alto"]} />
          </div>
        </>
      )}

      {showN92 && (
        <>
          <div style={S.divider} />
          <SectionTitle>Multiplicadores — Nicholas 1992</SectionTitle>
          <p style={{ ...S.hint, marginBottom: "20px" }}>
            Ajuste os pesos relativos de cada domínio. Padrão: Geometria=1.00, Orebody=1.33, HW=1.33, FW=1.33.
          </p>
          <div style={S.grid2}>
            {[
              ["geometry",    "Geometria"],
              ["orebody",     "Corpo de minério"],
              ["hangingWall", "Hanging wall"],
              ["footwall",    "Foot wall"],
            ].map(([key, label]) => (
              <div key={key}>
                <label style={S.label}>
                  {label} — <span style={{ color: C.primary }}>{fd.multipliers[key].toFixed(2)}</span>
                </label>
                <input
                  type="range" min="0" max="3" step="0.01"
                  style={{ width: "100%", accentColor: C.primary }}
                  value={fd.multipliers[key]}
                  onChange={(e) => dispatch({ type: "SET_MULTIPLIER", key, value: parseFloat(e.target.value) })}
                />
              </div>
            ))}
          </div>
          <button style={{ ...S.btnGhost, marginTop: "12px" }}
            onClick={() => dispatch({ type: "RESET_MULTIPLIERS" })}>
            Restaurar padrão
          </button>
        </>
      )}

      {!showUBC && !showSHB && !showN92 && (
        <p style={{ color: C.muted, fontSize: "14px" }}>
          Nenhum campo complementar necessário para os métodos selecionados.
        </p>
      )}
    </div>
  );

  // ---------------------------------------------------------------------------
  // ETAPA 5 — REVISAR
  // ---------------------------------------------------------------------------
  const selectedLabels = [
    sm.ubc && "UBC 1995",
    sm.nicholas81 && "Nicholas 1981",
    sm.nicholas92 && "Nicholas 1992",
    sm.shb && "SH&B 2007",
  ].filter(Boolean).join(", ");

  const Step5 = (
    <div style={S.card}>
      <SectionTitle>Resumo dos parâmetros</SectionTitle>

      <p style={{ fontSize: "13px", fontWeight: "700", color: C.text, margin: "0 0 8px" }}>Métodos selecionados</p>
      <p style={{ fontSize: "14px", color: C.primary, fontWeight: "600", margin: "0 0 20px" }}>{selectedLabels || "—"}</p>

      <p style={{ fontSize: "13px", fontWeight: "700", color: C.text, margin: "0 0 8px" }}>Geometria</p>
      <ReviewRow label="Forma"            value={fd.geometry.shape} />
      <ReviewRow label="Espessura"        value={fd.geometry.thickness} />
      <ReviewRow label="Mergulho"         value={fd.dip ? `${fd.dip}°` : ""} />
      <ReviewRow label="Distribuição"     value={fd.geometry.grade} />
      <ReviewRow label="Profundidade"     value={fd.depth.ore ? `${fd.depth.ore} m` : ""} />

      <p style={{ fontSize: "13px", fontWeight: "700", color: C.text, margin: "20px 0 8px" }}>Geotécnica</p>
      {["ore","hangingWall","footwall"].map((z) => (
        <ReviewRow key={z} label={`RSS — ${zones[z]}`} value={fd.rss[z]} />
      ))}
      {["ore","hangingWall","footwall"].map((z) => (
        <ReviewRow key={z} label={`RMR — ${zones[z]}`} value={fd.rmr[z]} />
      ))}
      {["ore","hangingWall","footwall"].map((z) => (
        <ReviewRow key={z} label={`Espaç. fraturas — ${zones[z]}`} value={fd.jointSpacing[z]} />
      ))}
      {["ore","hangingWall","footwall"].map((z) => (
        <ReviewRow key={z} label={`Interfraturas — ${zones[z]}`} value={fd.jointCondition[z]} />
      ))}

      {(showUBC || showSHB || showN92) && (
        <>
          <p style={{ fontSize: "13px", fontWeight: "700", color: C.text, margin: "20px 0 8px" }}>Complementar</p>
          {["ore","hangingWall","footwall"].map((z) => (
            <ReviewRow key={z} label={`Densidade — ${zones[z]}`} value={fd.density[z] ? `${fd.density[z]} kg/m³` : ""} />
          ))}
          {["ore","hangingWall","footwall"].map((z) => (
            <ReviewRow key={z} label={`UCS — ${zones[z]}`}      value={fd.ucs[z] ? `${fd.ucs[z]} MPa` : ""} />
          ))}
          <ReviewRow label="Valor do minério" value={fd.oreValue} />
          {showN92 && (
            <ReviewRow
              label="Multiplicadores N92"
              value={`Geo=${fd.multipliers.geometry.toFixed(2)} | Ore=${fd.multipliers.orebody.toFixed(2)} | HW=${fd.multipliers.hangingWall.toFixed(2)} | FW=${fd.multipliers.footwall.toFixed(2)}`}
            />
          )}
        </>
      )}

      <button
        onClick={handleCalculate}
        style={{ ...S.btnPrimary, width: "100%", padding: "14px", fontSize: "15px", marginTop: "28px" }}
      >
        CALCULAR
      </button>
    </div>
  );

  const STEP_CONTENT = [Step1, Step2, Step3, Step4, Step5];

  // Etapa 4 só é relevante se houver campos complementares
  const step4Relevant = showUBC || showSHB || showN92;

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  return (
    <div style={S.page}>
      <div style={S.wrap}>

        {/* Título */}
        <div style={{ marginBottom: "28px" }}>
          <h2 style={{ margin: "0 0 4px", color: C.text, fontSize: "22px" }}>Parâmetros do Depósito</h2>
          <p style={{ margin: 0, color: C.muted, fontSize: "14px" }}>MMS 2.0 — Mining Method Selection</p>
        </div>

        {/* Stepper */}
        <StepperHeader current={step} />

        {/* Conteúdo da etapa */}
        {STEP_CONTENT[step - 1]}

        {/* Navegação */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "20px" }}>
          <button
            style={S.btnSecondary}
            onClick={prev}
            disabled={step === 1}
          >
            ← Anterior
          </button>

          {step < 5 && (
            <button
              style={{ ...S.btnPrimary, opacity: (step === 1 && !anyMethod) ? 0.5 : 1 }}
              onClick={next}
              disabled={step === 1 && !anyMethod}
            >
              Próximo →
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

export default Inputs;
