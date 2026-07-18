import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMms, DOMAIN_PRESETS } from "../context/MmsContext";
import {
  calculateUBC, calculateNicholas, calculateSHB,
  classifyRSS, classifyRSSNicholas,
} from "../algorithms/algorithms";
import DepositSketch from "./DepositSketch";
import RockTooltip  from "../components/RockTooltip";
import { rmrToClass, gsiToRmr, qToRmr } from "../data/rmrData";

// ---------------------------------------------------------------------------
// TOKENS DE DESIGN
// ---------------------------------------------------------------------------
// Tokens semânticos → variáveis CSS centralizadas em index.css
const C = {
  primary:   "var(--color-primary)",
  primary50: "var(--color-primary-50)",
  border:    "var(--color-border)",
  text:      "var(--color-text)",
  muted:     "var(--color-muted)",
  bg:        "var(--color-bg)",
  white:     "var(--color-white)",
  success:   "var(--color-success)",
  warning:   "var(--color-warning)",
};

const S = {
  page:  { minHeight: "100vh", backgroundColor: C.bg, padding: "32px clamp(12px, 4vw, 24px) 180px" },
  wrap:  { maxWidth: "1100px", margin: "0 auto" },
  card:  { backgroundColor: C.white, border: `1px solid ${C.border}`, borderRadius: "10px", padding: "clamp(16px, 5vw, 32px)", marginTop: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" },
  label: { fontSize: "15px", fontWeight: "600", color: C.text, marginBottom: "6px", display: "block" },
  hint:  { fontSize: "13px", color: C.muted, marginTop: "4px" },
  inp:   { width: "100%", minHeight: "44px", padding: "11px 14px", borderRadius: "6px", border: `1px solid ${C.border}`, fontSize: "16px", color: C.text, boxSizing: "border-box", backgroundColor: C.white },
  grid3: { display: "flex", flexWrap: "wrap", gap: "24px" },
  sec:   { marginBottom: "28px" },
  div:   { borderTop: `1px solid ${C.border}`, margin: "32px 0" },
  btnPrimary:   { padding: "12px clamp(16px, 6vw, 28px)", minHeight: "44px", backgroundColor: C.primary, color: C.white, border: "none", borderRadius: "6px", fontWeight: "600", fontSize: "16px", cursor: "pointer" },
  btnSecondary: { padding: "12px clamp(16px, 6vw, 28px)", minHeight: "44px", backgroundColor: C.white, color: C.text, border: `1px solid ${C.border}`, borderRadius: "6px", fontWeight: "600", fontSize: "16px", cursor: "pointer" },
  btnGhost:     { padding: "6px 14px", minHeight: "44px", backgroundColor: "transparent", color: C.muted, border: `1px solid ${C.border}`, borderRadius: "6px", fontSize: "13px", cursor: "pointer" },
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
function Field({ label, hint, children, style }) {
  return (
    <div style={{ ...S.sec, ...style }}>
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

// Título de seção com fonte maior
function SecTitle({ children }) {
  return (
    <p style={{
      fontSize: "15px", fontWeight: "800", color: C.primary,
      textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 16px",
    }}>
      {children}
    </p>
  );
}

const RMR_CLASS_COLORS = {
  "Muito pobre": { bg: "#fee2e2", text: "#991b1b" },
  "Pobre":       { bg: "#fef3c7", text: "#92400e" },
  "Razoável":    { bg: "#fef9c3", text: "#713f12" },
  "Boa":         { bg: "#d1fae5", text: "#065f46" },
  "Muito boa":   { bg: "#dbeafe", text: "#1e40af" },
};

const rmrBtn = { padding: "0 14px", height: "100%", backgroundColor: C.primary, color: C.white, border: "none", borderRadius: "6px", fontWeight: "600", fontSize: "14px", cursor: "pointer" };

function RmrField({ value, onChange }) {
  const [mode, setMode] = useState("rmr");
  const [gsi, setGsi]   = useState("");
  const [q, setQ]       = useState("");
  const col = value ? (RMR_CLASS_COLORS[value] || {}) : {};

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {/* Seletor de modo RMR / GSI / Q */}
      <div style={{ display: "flex", borderRadius: "6px", overflow: "hidden", border: `1px solid ${C.border}` }}>
        {[["rmr","RMR"],["gsi","GSI"],["q","Q"]].map(([m, lbl]) => (
          <button key={m} onClick={() => setMode(m)} style={{ flex: 1, padding: "7px 4px", minHeight: "44px", fontSize: "13px", fontWeight: mode === m ? "700" : "400", backgroundColor: mode === m ? C.primary : C.white, color: mode === m ? C.white : C.muted, border: "none", cursor: "pointer" }}>{lbl}</button>
        ))}
      </div>

      {mode === "rmr" && (
        <select style={S.inp} value={value || ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">Selecione</option>
          <option>Muito pobre</option>
          <option>Pobre</option>
          <option>Razoável</option>
          <option>Boa</option>
          <option>Muito boa</option>
        </select>
      )}

      {mode === "gsi" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <p style={{ ...S.hint, margin: 0 }}>RMR = (GSI + 11,63) / 1,13</p>
          <div style={{ display: "flex", gap: "6px", height: "44px" }}>
            <input type="number" min="0" max="100" style={{ ...S.inp }} placeholder="ex: 55"
              value={gsi} onChange={(e) => setGsi(e.target.value)} />
            <button style={rmrBtn}
              onClick={() => { const v = parseFloat(gsi); if (!isNaN(v)) onChange(rmrToClass(gsiToRmr(v))); }}>
              Aplicar
            </button>
          </div>
          {gsi && !isNaN(parseFloat(gsi)) && (
            <p style={{ ...S.hint, color: C.primary, fontWeight: "600", margin: 0 }}>
              → RMR ≈ {gsiToRmr(parseFloat(gsi)).toFixed(1)} ({rmrToClass(gsiToRmr(parseFloat(gsi)))})
            </p>
          )}
        </div>
      )}

      {mode === "q" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <p style={{ ...S.hint, margin: 0 }}>RMR = 9 × ln(Q) + 44</p>
          <div style={{ display: "flex", gap: "6px", height: "44px" }}>
            <input type="number" min="0.001" style={{ ...S.inp }} placeholder="ex: 5.0"
              value={q} onChange={(e) => setQ(e.target.value)} />
            <button style={rmrBtn}
              onClick={() => { const v = parseFloat(q); if (!isNaN(v) && v > 0) onChange(rmrToClass(qToRmr(v))); }}>
              Aplicar
            </button>
          </div>
          {q && !isNaN(parseFloat(q)) && parseFloat(q) > 0 && (
            <p style={{ ...S.hint, color: C.primary, fontWeight: "600", margin: 0 }}>
              → RMR ≈ {qToRmr(parseFloat(q)).toFixed(1)} ({rmrToClass(qToRmr(parseFloat(q)))})
            </p>
          )}
        </div>
      )}

      {value && (
        <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: "12px", fontSize: "13px", fontWeight: "700", backgroundColor: col.bg, color: col.text, alignSelf: "flex-start" }}>
          {value}
        </span>
      )}
    </div>
  );
}

function InfoTooltip({ text }) {
  const [hovered, setHovered] = useState(false); // aberto por hover (mouse)
  const [pinned, setPinned]   = useState(false); // aberto por toque/clique
  const [shift, setShift]     = useState(0);
  const anchorRef             = useRef(null);

  // Desloca o popup para que fique inteiro dentro do viewport
  // (mesma estratégia de medição do RockTooltip).
  const place = () => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    const w = Math.min(270, window.innerWidth - 32);
    const desired = Math.min(
      Math.max(rect.left + rect.width / 2 - w / 2, 16),
      window.innerWidth - 16 - w
    );
    setShift(desired - rect.left);
  };

  const visible = hovered || pinned;
  return (
    <span ref={anchorRef} style={{ position: "relative", display: "inline-block", lineHeight: 1 }}>
      {pinned && (
        <span
          onClick={() => setPinned(false)}
          style={{ position: "fixed", inset: 0, zIndex: 199 }}
        />
      )}
      <span
        onPointerEnter={(e) => { if (e.pointerType === "mouse") { place(); setHovered(true); } }}
        onPointerLeave={(e) => { if (e.pointerType === "mouse") setHovered(false); }}
        onClick={() => { if (!pinned) place(); setPinned((v) => !v); }}
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "17px", height: "17px", borderRadius: "50%", backgroundColor: C.primary, color: "#fff", fontSize: "11px", fontWeight: "700", cursor: "help", flexShrink: 0 }}
      >i</span>
      {visible && (
        <div style={{ position: "absolute", bottom: "calc(100% + 6px)", left: `${shift}px`, backgroundColor: "#1e293b", color: "#f1f5f9", fontSize: "12px", lineHeight: "1.55", padding: "8px 12px", borderRadius: "6px", width: "min(270px, calc(100vw - 32px))", zIndex: 200, boxShadow: "0 4px 12px rgba(0,0,0,0.25)", pointerEvents: "none" }}>
          {text}
        </div>
      )}
    </span>
  );
}

const DIP_RANGES = [
  { key: "ubc",      label: "UBC",      text: "Plano <20° | Intermediário 20–55° | Inclinado >55°" },
  { key: "nicholas", label: "Nicholas", text: "Plano <20° | Intermediário 20–55° | Inclinado >55°" },
  { key: "shb",      label: "SH&B",     text: "Plano <15° | Baixo 15–30° | Intermediário 30–45° | Pouco inclinado 45–60° | Inclinado >60°" },
];

function DipTooltipContent({ showUBC, showNich, showSHB }) {
  const shown = { ubc: showUBC, nicholas: showNich, shb: showSHB };
  const selected = DIP_RANGES.filter((m) => shown[m.key]);
  const list = selected.length ? selected : DIP_RANGES;
  return (
    <>
      {list.map((m, i) => (
        <div key={m.key} style={{ marginTop: i > 0 ? "6px" : 0, paddingTop: i > 0 ? "6px" : 0, borderTop: i > 0 ? "1px solid rgba(241,245,249,0.2)" : "none" }}>
          <strong>{m.label}:</strong> {m.text}
        </div>
      ))}
    </>
  );
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
    <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", padding: "6px 0", borderBottom: `1px solid ${C.border}`, fontSize: "14px" }}>
      <span style={{ color: C.muted }}>{label}</span>
      <span style={{ fontWeight: "600", color: C.text, textAlign: "right" }}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PESOS POR CRITÉRIO — config por método
// ---------------------------------------------------------------------------
// UBC — critérios individualizados, agrupados por domínio geológico
const UBC_CRITERIA_GROUPS = [
  { domain: "geo", title: "Geometria", items: [
    { key: "shape",     label: "Forma" },
    { key: "thickness", label: "Espessura" },
    { key: "dip",       label: "Mergulho" },
    { key: "grade",     label: "Teores" },
    { key: "depth",     label: "Profundidade" },
  ] },
  { domain: "ob", title: "Corpo de minério", items: [
    { key: "rss", label: "RSS" },
    { key: "rmr", label: "RMR" },
  ] },
  { domain: "hw", title: "Hanging wall", items: [
    { key: "rss", label: "RSS" },
    { key: "rmr", label: "RMR" },
  ] },
  { domain: "fw", title: "Foot wall", items: [
    { key: "rss", label: "RSS" },
    { key: "rmr", label: "RMR" },
  ] },
];

// Nicholas — 13 critérios individualizados, agrupados por domínio geológico
const NICHOLAS_CRITERIA_GROUPS = [
  { domain: "geo", title: "Geometria", items: [
    { key: "shape",     label: "Forma" },
    { key: "thickness", label: "Espessura" },
    { key: "dip",       label: "Mergulho" },
    { key: "grade",     label: "Teores" },
  ] },
  { domain: "ob", title: "Corpo de minério", items: [
    { key: "rss",            label: "RSS" },
    { key: "jointSpacing",   label: "Espaçamento" },
    { key: "jointCondition", label: "Interfraturas" },
  ] },
  { domain: "hw", title: "Hanging wall", items: [
    { key: "rss",            label: "RSS" },
    { key: "jointSpacing",   label: "Espaçamento" },
    { key: "jointCondition", label: "Interfraturas" },
  ] },
  { domain: "fw", title: "Foot wall", items: [
    { key: "rss",            label: "RSS" },
    { key: "jointSpacing",   label: "Espaçamento" },
    { key: "jointCondition", label: "Interfraturas" },
  ] },
];

// SH&B — critérios individualizados, agrupados por domínio geológico/econômico
const SHB_CRITERIA_GROUPS = [
  { domain: "geo", title: "Geometria", items: [
    { key: "shape",     label: "Forma" },
    { key: "thickness", label: "Espessura" },
    { key: "dip",       label: "Mergulho" },
    { key: "grade",     label: "Teores" },
    { key: "depth",     label: "Profundidade" },
  ] },
  { domain: "econ", title: "Econômico", items: [
    { key: "oreValue", label: "Valor do minério" },
  ] },
  { domain: "ob", title: "Corpo de minério", items: [
    { key: "rss", label: "RSS" },
    { key: "rmr", label: "RMR" },
  ] },
  { domain: "hw", title: "Hanging wall", items: [
    { key: "rss", label: "RSS" },
    { key: "rmr", label: "RMR" },
  ] },
  { domain: "fw", title: "Foot wall", items: [
    { key: "rss", label: "RSS" },
    { key: "rmr", label: "RMR" },
  ] },
];

const DOMAIN_CRITERIA = [
  { key: "geo", label: "Geometria (geo)" },
  { key: "ob",  label: "Corpo de minério (ob)" },
  { key: "hw",  label: "Hanging wall (hw)" },
  { key: "fw",  label: "Foot wall (fw)" },
];

const DOMAIN_PRESET_LABELS = {
  default: "Padrão",
  preset1: "Preset 1",
  preset2: "Preset 2",
  preset3: "Preset 3",
};

function WeightSlider({ label, value, min, max, onChange }) {
  const v = value ?? 1;
  return (
    <div>
      <label style={S.label}>
        {label} — <span style={{ color: C.primary }}>{v.toFixed(2)}</span>
      </label>
      <input type="range" min={min} max={max} step="0.01"
        style={{ width: "100%", accentColor: C.primary }}
        value={v}
        onChange={(e) => onChange(parseFloat(e.target.value))} />
    </div>
  );
}

function Collapsible({ title, open, onToggle, children }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: "8px", marginBottom: "16px", overflow: "hidden" }}>
      <button onClick={onToggle}
        style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", backgroundColor: C.primary50, border: "none", cursor: "pointer", fontSize: "15px", fontWeight: "700", color: C.primary }}>
        <span>{title}</span>
        <span style={{ fontSize: "13px" }}>{open ? "▾" : "▸"}</span>
      </button>
      {open && <div style={{ padding: "18px" }}>{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// STEPPER
// ---------------------------------------------------------------------------
function StepperHeader({ current, steps }) {
  const currentLabel = steps.find((s) => s.id === current)?.label || "";
  return (
    <>
      <p className="mms-stepper-current">Etapa {current} de {steps.length} — {currentLabel}</p>
      <div style={{ display: "flex", alignItems: "center", marginBottom: "8px" }}>
        {steps.map((step, i) => {
          const done   = step.id < current;
          const active = step.id === current;
          return (
            <div key={step.id} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "none" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                <div title={step.label} aria-label={step.label} style={{ width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "700", backgroundColor: done ? C.success : active ? C.primary : C.border, color: done || active ? C.white : C.muted, flexShrink: 0 }}>
                  {done ? "✓" : step.id}
                </div>
                <span className="mms-stepper-label" style={{ fontSize: "11px", fontWeight: active ? "700" : "400", color: active ? C.primary : C.muted, whiteSpace: "nowrap" }}>
                  {step.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div style={{ flex: 1, height: "2px", backgroundColor: done ? C.success : C.border, margin: "0 8px", marginBottom: "20px" }} />
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ---------------------------------------------------------------------------
function Inputs() {
  const { state, dispatch } = useMms();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [openBlocks, setOpenBlocks] = useState({ ubc: true, nicholas: true, shb: true });
  const toggleBlock = (k) => setOpenBlocks((p) => ({ ...p, [k]: !p[k] }));

  // Nicholas: camadas mutuamente exclusivas — critério OU domínio, nunca ambos
  const [nicholasMode, setNicholasMode] = useState("criteria");

  // Entra no modo critério: multiplicadores de domínio voltam a ser neutros (1.00)
  const enterCriteriaMode = () => {
    setNicholasMode("criteria");
    dispatch({ type: "RESET_NICHOLAS_DOMAIN" });
  };
  // Entra no modo domínio: os 13 pesos por critério voltam a ser neutros (1.00)
  const enterDomainMode = () => {
    setNicholasMode("domain");
    dispatch({ type: "RESET_NICHOLAS_CRITERIA" });
  };
  // Mexer num slider de critério garante o modo critério (e reseta domínio)
  const handleNicholasCriteria = (domain, key, value) => {
    if (nicholasMode !== "criteria") enterCriteriaMode();
    dispatch({ type: "SET_NICHOLAS_CRITERION", domain, key, value });
  };
  // Aplicar um preset garante o modo domínio (e reseta os critérios)
  const handleDomainPreset = (preset) => {
    if (nicholasMode !== "domain") setNicholasMode("domain");
    dispatch({ type: "RESET_NICHOLAS_CRITERIA" });
    dispatch({ type: "SET_DOMAIN_PRESET", preset });
  };

  const fd = state.formData;
  const sm = fd.selectedMethods;
  const showUBC  = sm.ubc;
  const showNich = sm.nicholas;
  const showSHB  = sm.shb;
  const anyMethod = Object.values(sm).some(Boolean);

  const set = (section, field, value) =>
    dispatch({ type: "SET_FORM_FIELD", section, field, value });

  const toggleMethod = (key) =>
    dispatch({ type: "SET_FORM_FIELD", section: "selectedMethods", field: key, value: !fd.selectedMethods[key] });

  // Reseta todo o formulário e limpa o estado persistido no localStorage
  const clearForm = () => {
    if (!window.confirm("Limpar todos os campos do formulário? Esta ação não pode ser desfeita.")) return;
    localStorage.removeItem("mms2-state");
    dispatch({ type: "RESET_ALL" });
    setStep(1);
  };

  // RSS em tempo real
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
    const w = fd.criteriaWeights;
    if (showUBC)  dispatch({ type: "SET_RESULT", method: "ubc",      payload: calculateUBC(fd, w.ubc) });
    else          dispatch({ type: "SET_RESULT", method: "ubc",      payload: null });
    if (showNich) dispatch({ type: "SET_RESULT", method: "nicholas", payload: calculateNicholas(fd, w.nicholas) });
    else          dispatch({ type: "SET_RESULT", method: "nicholas", payload: null });
    if (showSHB)  dispatch({ type: "SET_RESULT", method: "shb",      payload: calculateSHB(fd, w.shb) });
    else          dispatch({ type: "SET_RESULT", method: "shb",      payload: null });
    navigate("/statistics");
  };

  const next = () => setStep((s) => Math.min(s + 1, totalSteps));
  const prev = () => setStep((s) => Math.max(s - 1, 1));

  // ---------------------------------------------------------------------------
  // ETAPA 1 — MÉTODOS
  // ---------------------------------------------------------------------------
  const Step1 = (
    <div style={S.card}>
      <SecTitle>Selecione os métodos de seleção</SecTitle>
      <p style={{ fontSize: "16px", color: C.muted, marginTop: 0, marginBottom: "20px" }}>
        O formulário se ajustará automaticamente aos campos necessários.
      </p>
      <div className="mms-grid2">
        {[
          { key: "ubc",        label: "UBC 1995",      desc: "Miller-Tait, Pakalnis & Poulin" },
          { key: "nicholas",   label: "Nicholas",           desc: "Nicholas, D.E. — SME (1981/1992)" },
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
                  <div style={{ fontWeight: "700", fontSize: "16px", color: C.text }}>{label}</div>
                  <div style={{ fontSize: "14px", color: C.muted }}>{desc}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {!anyMethod && <p style={{ marginTop: "16px", fontSize: "15px", color: C.warning, fontWeight: "600" }}>⚠ Selecione pelo menos um método para continuar.</p>}
      <div style={{ marginTop: "24px", borderTop: `1px solid ${C.border}`, paddingTop: "16px", display: "flex", justifyContent: "flex-end" }}>
        <button style={S.btnGhost} onClick={clearForm}>Limpar formulário</button>
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // ETAPA 2 — GEOMETRIA
  // ---------------------------------------------------------------------------
  const Step2 = (
    <div style={S.card}>
      <SecTitle>Geometria do depósito</SecTitle>
      <div className="mms-grid2">
        <Field label="Forma geral">
          <Sel value={fd.geometry.shape} onChange={(v) => set("geometry", "shape", v)}
            options={["Massivo", "Tabular", "Irregular"]} />
        </Field>
        <Field label="Espessura">
          <Sel value={fd.geometry.thickness} onChange={(v) => set("geometry", "thickness", v)}
            options={["Muito estreito", "Estreito", "Intermediário", "Espesso", "Muito espesso"]} />
        </Field>
        <div style={S.sec}>
          <label style={{ ...S.label, display: "flex", alignItems: "center", gap: "6px" }}>
            Mergulho (°)
            <InfoTooltip text={<DipTooltipContent showUBC={showUBC} showNich={showNich} showSHB={showSHB} />} />
          </label>
          <Num value={fd.dip} onChange={(v) => set("dip", null, v)} placeholder="ex: 65" />
        </div>
        <Field label="Distribuição de teores">
          <Sel value={fd.geometry.grade} onChange={(v) => set("geometry", "grade", v)}
            options={["Uniforme", "Gradacional", "Errático"]} />
        </Field>
        {(showUBC || showSHB) && (
          <Field label="Profundidade do corpo de minério (m)" hint="UBC: Rasa ≤100m | Interm. 100–600m | Profunda >600m">
            <Num value={fd.depth.ore} onChange={(v) => set("depth", "ore", v)} placeholder="ex: 400" />
          </Field>
        )}
      </div>

      <div style={{ marginTop: "24px", borderTop: `1px solid ${C.border}`, paddingTop: "20px" }}>
        <SecTitle>Seção transversal</SecTitle>
        <DepositSketch
          shape={fd.geometry.shape}
          thickness={fd.geometry.thickness}
          dip={fd.dip}
          depth={fd.depth.ore}
          grade={fd.geometry.grade}
        />
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // ETAPA 3 — GEOTÉCNICA
  // ---------------------------------------------------------------------------
  const Step3 = (
    <div style={S.card}>

      {(showUBC || showSHB) && (
        <>
          <SecTitle>Rock Substance Strength (RSS)</SecTitle>
          <p style={{ ...S.hint, marginBottom: "20px", display: "flex", alignItems: "center", gap: "6px" }}>
            Preencha os três campos por domínio.
            <InfoTooltip text="RSS = UCS × 10⁶ / (Densidade × Profundidade × 9,81)." />
          </p>
          <div style={S.grid3}>
            {["ore", "hangingWall", "footwall"].map((z) => (
              <div key={z} style={{ display: "flex", flexDirection: "column", gap: "12px", flex: "1 1 280px" }}>
                <span style={{ fontWeight: "700", fontSize: "15px", color: C.text, borderBottom: `2px solid ${C.primary}`, paddingBottom: "4px" }}>
                  {zones[z]}
                </span>
                <div>
                  <label style={S.label}>UCS (MPa)</label>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <Num value={fd.ucs[z]} onChange={(v) => set("ucs", z, v)} placeholder="ex: 185" />
                    <RockTooltip type="ucs" onSelect={(v) => set("ucs", z, String(v))} />
                  </div>
                </div>
                <div>
                  <label style={{ ...S.label, display: "flex", alignItems: "center", gap: "6px" }}>
                    {z === "ore" ? "Densidade (kg/m³)" : "Densidade média do overburden (kg/m³)"}
                    {z === "hangingWall" && (
                      <InfoTooltip text="Para o cálculo do RSS, considere a densidade média de todos os materiais desde a superfície até o topo do corpo de minério (overburden completo), não apenas a rocha imediatamente adjacente." />
                    )}
                    {z === "footwall" && (
                      <InfoTooltip text="Para o cálculo do RSS, considere a densidade média de todos os materiais desde a superfície até a base do corpo de minério." />
                    )}
                  </label>
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

      {showNich && !showUBC && !showSHB && (
        <>
          <SecTitle>Rock Substance Strength (RSS)</SecTitle>
          <div style={S.grid3}>
            {["ore", "hangingWall", "footwall"].map((z) => (
              <Field key={z} label={zones[z]} style={{ flex: "1 1 280px" }}>
                <Sel value={fd.rss[z]} onChange={(v) => set("rss", z, v)}
                  options={["Fraca", "Moderada", "Resistente"]} />
              </Field>
            ))}
          </div>
          <div style={S.div} />
        </>
      )}

      {(showUBC || showSHB) && (
        <>
          <SecTitle>Rock Mass Rating (RMR)</SecTitle>
          <p style={{ ...S.hint, marginBottom: "16px" }}>
            Selecione diretamente, ou converta a partir de GSI ou Q-System.
          </p>
          <div style={S.grid3}>
            {["ore", "hangingWall", "footwall"].map((z) => (
              <div key={z} style={{ display: "flex", flexDirection: "column", gap: "6px", flex: "1 1 280px" }}>
                <label style={S.label}>{zones[z]}</label>
                <RmrField value={fd.rmr[z]} onChange={(v) => set("rmr", z, v)} />
              </div>
            ))}
          </div>
        </>
      )}

      {showNich && (
        <>
          <div style={S.div} />
          <SecTitle>Fraturas</SecTitle>
          <p style={{ fontSize: "15px", fontWeight: "600", color: C.text, marginBottom: "12px" }}>Espaçamento das fraturas</p>
          <div style={S.grid3}>
            {["ore", "hangingWall", "footwall"].map((z) => (
              <Field key={z} label={zones[z]} style={{ flex: "1 1 280px" }}>
                <Sel value={fd.jointSpacing[z]} onChange={(v) => set("jointSpacing", z, v)}
                  options={["Muito Perto", "Perto", "Longe", "Muito Longe"]} />
              </Field>
            ))}
          </div>
          <p style={{ fontSize: "15px", fontWeight: "600", color: C.text, margin: "28px 0 12px" }}>Características das interfraturas</p>
          <div style={S.grid3}>
            {["ore", "hangingWall", "footwall"].map((z) => (
              <Field key={z} label={zones[z]} style={{ flex: "1 1 280px" }}>
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
  // ETAPA — EESG (Economic Environmental Social Governance)
  // ---------------------------------------------------------------------------
  const StepEESG = showSHB ? (
    <div style={S.card}>
      <SecTitle>EESG — Economic Environmental Social Governance</SecTitle>
      <p style={{ ...S.hint, marginBottom: "20px" }}>
        Critérios econômicos, ambientais, sociais e de governança.
      </p>
      <Field label="Valor do minério">
        <div style={{ maxWidth: "280px" }}>
          <Sel value={fd.oreValue} onChange={(v) => set("oreValue", null, v)}
            options={["Baixo", "Médio", "Alto"]} />
        </div>
      </Field>
    </div>
  ) : null;

  // ---------------------------------------------------------------------------
  // ETAPA — COMPLEMENTAR
  // ---------------------------------------------------------------------------
  const cw = fd.criteriaWeights;

  // Detecta qual preset de domínio está ativo (null se houver ajuste manual)
  const activeDomainPreset = Object.keys(DOMAIN_PRESETS).find((p) =>
    DOMAIN_CRITERIA.every(({ key }) =>
      Math.abs((cw.nicholas.domain[key] ?? 1) - DOMAIN_PRESETS[p][key]) < 1e-9
    )
  ) || null;

  const Step4 = anyMethod ? (
    <div style={S.card}>
      <SecTitle>Pesos por Critério</SecTitle>
      <p style={{ ...S.hint, marginBottom: "20px" }}>
        Ajuste a importância de cada critério por método. Padrão: 1.0. Cada método tem pesos independentes.
      </p>

      {showUBC && (
        <Collapsible title="UBC 1995" open={openBlocks.ubc} onToggle={() => toggleBlock("ubc")}>
          <p style={{ ...S.hint, marginTop: 0, marginBottom: "16px" }}>
            Cada critério é ponderado individualmente dentro do seu domínio geológico (0.00–2.00).
          </p>
          {UBC_CRITERIA_GROUPS.map(({ domain, title, items }) => (
            <div key={domain} style={{ marginBottom: "18px" }}>
              <p style={{ fontSize: "14px", fontWeight: "700", color: C.primary, margin: "0 0 10px" }}>{title}</p>
              <div className="mms-grid2">
                {items.map(({ key, label }) => (
                  <WeightSlider key={key} label={label} min={0} max={2}
                    value={cw.ubc[domain][key]}
                    onChange={(v) => dispatch({ type: "SET_UBC_CRITERION", domain, key, value: v })} />
                ))}
              </div>
            </div>
          ))}
          <div style={{ marginTop: "8px" }}>
            <button style={S.btnGhost} onClick={() => dispatch({ type: "RESET_UBC_CRITERIA" })}>
              Restaurar padrão
            </button>
          </div>
        </Collapsible>
      )}

      {showNich && (
        <Collapsible title="Nicholas" open={openBlocks.nicholas} onToggle={() => toggleBlock("nicholas")}>
          {/* Seletor de camada — critério OU domínio, nunca ambos */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "18px" }}>
            {[
              ["domain",   "Presets de domínio (Nicholas 92)"],
              ["criteria", "Individualização por critério"],
            ].map(([m, lbl]) => {
              const on = nicholasMode === m;
              return (
                <button key={m}
                  onClick={() => (m === "criteria" ? enterCriteriaMode() : enterDomainMode())}
                  style={{ ...S.btnGhost, backgroundColor: on ? C.primary : "transparent", color: on ? C.white : C.muted, borderColor: on ? C.primary : C.border, fontWeight: on ? "700" : "400" }}>
                  {lbl}
                </button>
              );
            })}
          </div>

          {/* Camada de critério — granular, desativada quando em modo domínio */}
          <div style={nicholasMode === "domain" ? { opacity: 0.4, pointerEvents: "none" } : undefined}>
            <p style={{ fontSize: "15px", fontWeight: "700", color: C.text, margin: "0 0 6px" }}>
              Individualização por critério
            </p>
            <p style={{ ...S.hint, marginTop: 0, marginBottom: "16px" }}>
              Cada critério é ponderado individualmente dentro do seu domínio geológico (0.00–2.00).
            </p>
            {NICHOLAS_CRITERIA_GROUPS.map(({ domain, title, items }) => (
              <div key={domain} style={{ marginBottom: "18px" }}>
                <p style={{ fontSize: "14px", fontWeight: "700", color: C.primary, margin: "0 0 10px" }}>{title}</p>
                <div className="mms-grid2">
                  {items.map(({ key, label }) => (
                    <WeightSlider key={key} label={label} min={0} max={2}
                      value={cw.nicholas[domain][key]}
                      onChange={(v) => handleNicholasCriteria(domain, key, v)} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={S.div} />

          {/* Camada de domínio — desativada quando em modo critério */}
          <div style={nicholasMode === "criteria" ? { opacity: 0.4, pointerEvents: "none" } : undefined}>
            <p style={{ fontSize: "15px", fontWeight: "700", color: C.text, margin: "0 0 6px" }}>
              Multiplicadores de domínio (Nicholas 92)
            </p>
            <p style={{ ...S.hint, marginTop: 0, marginBottom: "14px" }}>
              Ponderam cada domínio geotécnico. Aplique um preset ou ajuste manualmente.
            </p>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "18px" }}>
              {Object.entries(DOMAIN_PRESET_LABELS).map(([p, lbl]) => {
                const on = nicholasMode === "domain" && activeDomainPreset === p;
                return (
                  <button key={p}
                    onClick={() => handleDomainPreset(p)}
                    style={{ ...S.btnGhost, backgroundColor: on ? C.primary : "transparent", color: on ? C.white : C.muted, borderColor: on ? C.primary : C.border, fontWeight: on ? "700" : "400" }}>
                    {lbl}
                  </button>
                );
              })}
            </div>
            <div className="mms-grid2">
              {DOMAIN_CRITERIA.map(({ key, label }) => (
                <WeightSlider key={key} label={label} min={0} max={2}
                  value={cw.nicholas.domain[key]}
                  onChange={(v) => dispatch({ type: "SET_DOMAIN_WEIGHT", key, value: v })} />
              ))}
            </div>
          </div>

          <div style={{ marginTop: "16px" }}>
            <button style={S.btnGhost}
              onClick={() => {
                dispatch({ type: "RESET_NICHOLAS_CRITERIA" });
                dispatch({ type: "RESET_NICHOLAS_DOMAIN" });
                setNicholasMode("criteria");
              }}>
              Restaurar padrão
            </button>
          </div>
        </Collapsible>
      )}

      {showSHB && (
        <Collapsible title="SH&B 2007" open={openBlocks.shb} onToggle={() => toggleBlock("shb")}>
          <p style={{ ...S.hint, marginTop: 0, marginBottom: "16px" }}>
            Cada critério é ponderado individualmente dentro do seu domínio geológico/econômico (0.00–2.00).
          </p>
          {SHB_CRITERIA_GROUPS.map(({ domain, title, items }) => (
            <div key={domain} style={{ marginBottom: "18px" }}>
              <p style={{ fontSize: "14px", fontWeight: "700", color: C.primary, margin: "0 0 10px" }}>{title}</p>
              <div className="mms-grid2">
                {items.map(({ key, label }) => (
                  <WeightSlider key={key} label={label} min={0} max={2}
                    value={cw.shb[domain][key]}
                    onChange={(v) => dispatch({ type: "SET_SHB_CRITERION", domain, key, value: v })} />
                ))}
              </div>
            </div>
          ))}
          <div style={{ marginTop: "8px" }}>
            <button style={S.btnGhost} onClick={() => dispatch({ type: "RESET_SHB_CRITERIA" })}>
              Restaurar padrão
            </button>
          </div>
        </Collapsible>
      )}
    </div>
  ) : null;

  // ---------------------------------------------------------------------------
  // ETAPA 5 (ou 4 se sem complementar) — REVISAR
  // ---------------------------------------------------------------------------
  const selectedLabels = [
    sm.ubc && "UBC 1995", sm.nicholas && "Nicholas 1981/1992", sm.shb && "SH&B 2007",
  ].filter(Boolean).join(", ");

  const StepReview = (
    <div style={S.card}>
      <SecTitle>Resumo dos parâmetros</SecTitle>

      <p style={{ fontSize: "15px", fontWeight: "700", color: C.text, margin: "0 0 8px" }}>Métodos</p>
      <p style={{ fontSize: "16px", color: C.primary, fontWeight: "600", margin: "0 0 20px" }}>{selectedLabels || "—"}</p>

      <p style={{ fontSize: "15px", fontWeight: "700", color: C.text, margin: "0 0 8px" }}>Geometria</p>
      <ReviewRow label="Forma"        value={fd.geometry.shape} />
      <ReviewRow label="Espessura"    value={fd.geometry.thickness} />
      <ReviewRow label="Mergulho"     value={fd.dip ? `${fd.dip}°` : ""} />
      <ReviewRow label="Distribuição" value={fd.geometry.grade} />

      <p style={{ fontSize: "15px", fontWeight: "700", color: C.text, margin: "20px 0 8px" }}>Geotécnica</p>
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
        <ReviewRow key={`rss-${z}`} label={`RSS — ${zones[z]}`}       value={rssLive[z] || fd.rss[z]} />
      ))}
      {["ore","hangingWall","footwall"].map((z) => (
        <ReviewRow key={`rmr-${z}`} label={`RMR — ${zones[z]}`}       value={fd.rmr[z]} />
      ))}
      {["ore","hangingWall","footwall"].map((z) => (
        <ReviewRow key={`js-${z}`}  label={`Espaç. fraturas — ${zones[z]}`} value={fd.jointSpacing[z]} />
      ))}
      {["ore","hangingWall","footwall"].map((z) => (
        <ReviewRow key={`jc-${z}`}  label={`Interfraturas — ${zones[z]}`}   value={fd.jointCondition[z]} />
      ))}

      {showSHB && (
        <>
          <p style={{ fontSize: "15px", fontWeight: "700", color: C.text, margin: "20px 0 8px" }}>EESG</p>
          <ReviewRow label="Valor do minério" value={fd.oreValue} />
        </>
      )}

      <button onClick={handleCalculate}
        style={{ ...S.btnPrimary, width: "100%", padding: "14px", fontSize: "17px", marginTop: "28px" }}>
        CALCULAR
      </button>
    </div>
  );

  // Monta etapas visíveis dinamicamente: EESG só aparece com SH&B selecionado,
  // Complementar só aparece com algum método selecionado.
  const stepDefs = [
    { label: "Métodos",      show: true,      content: Step1 },
    { label: "Geometria",    show: true,      content: Step2 },
    { label: "Geotécnica",   show: true,      content: Step3 },
    { label: "EESG",         show: showSHB,   content: StepEESG },
    { label: "Complementar", show: anyMethod, content: Step4 },
    { label: "Revisar",      show: true,      content: StepReview },
  ];
  const visibleStepDefs = stepDefs.filter((s) => s.show).map((s, i) => ({ ...s, id: i + 1 }));
  const visibleSteps    = visibleStepDefs.map(({ id, label }) => ({ id, label }));
  const totalSteps      = visibleStepDefs.length;
  const stepContents    = visibleStepDefs.map((s) => s.content);

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{ marginBottom: "28px" }}>
          <h2 style={{ margin: "0 0 4px", color: C.text, fontSize: "24px" }}>Parâmetros do Depósito</h2>
          <p style={{ margin: 0, color: C.muted, fontSize: "16px" }}>MMS 2.0 — Mining Method Selection</p>
        </div>

        <StepperHeader current={step} steps={visibleSteps} />
        {stepContents[step - 1]}

        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginTop: "20px" }}>
          <button style={S.btnSecondary} onClick={prev} disabled={step === 1}>← Anterior</button>
          {step < totalSteps && (
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
