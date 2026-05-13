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
// ESTILOS BASE
// ---------------------------------------------------------------------------
const card   = { border: "1px solid #e5e7eb", borderRadius: "8px", padding: "20px", marginTop: "20px", backgroundColor: "#fff", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" };
const grid2  = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" };
const grid3  = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "15px" };
const inp    = { width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #d1d5db", boxSizing: "border-box" };
const lbl    = { fontSize: "13px", marginBottom: "5px", display: "block", color: "#374151" };
const sublbl = { fontSize: "12px", color: "#6b7280", marginTop: 0, marginBottom: "12px" };
const zones  = { ore: "Corpo de minério", hangingWall: "Hanging wall", footwall: "Foot wall" };

const ALL_METHODS = [
  { key: "ubc",        label: "UBC 1995" },
  { key: "nicholas81", label: "Nicholas 1981" },
  { key: "nicholas92", label: "Nicholas 1992" },
  { key: "shb",        label: "SH&B 2007" },
];

// ---------------------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ---------------------------------------------------------------------------
function Inputs() {
  const { dispatch } = useMms();
  const navigate     = useNavigate();

  const [selectedMethods, setSelectedMethods] = useState({
    ubc: true, nicholas81: false, nicholas92: false, shb: false,
  });

  const [formData, setFormData] = useState({
    geometry:       { shape: "", thickness: "", grade: "" },
    dip:            "",
    depth:          { ore: "" },
    density:        { ore: "", hangingWall: "", footwall: "" },
    ucs:            { ore: "", hangingWall: "", footwall: "" },
    rss:            { ore: "", hangingWall: "", footwall: "" },
    rmr:            { ore: "", hangingWall: "", footwall: "" },
    jointSpacing:   { ore: "", hangingWall: "", footwall: "" },
    jointCondition: { ore: "", hangingWall: "", footwall: "" },
    oreValue:       "",
  });

  const [multipliers, setMultipliers] = useState({ ...DEFAULT_MULTIPLIERS });

  // Atalhos de visibilidade
  const any     = (keys) => keys.some((k) => selectedMethods[k]);
  const showUBC       = selectedMethods.ubc;
  const showN81       = selectedMethods.nicholas81;
  const showN92       = selectedMethods.nicholas92;
  const showNicholas  = showN81 || showN92;
  const showSHB       = selectedMethods.shb;
  const showDepth     = showUBC || showSHB;
  const showRMR       = showUBC || showSHB;
  const showFractures = showNicholas;
  const showOreValue  = showSHB;
  const showMultipliers = showN92;
  const anySelected   = any(["ubc", "nicholas81", "nicholas92", "shb"]);

  const handleChange = (section, field, value) => {
    if (field === null) {
      setFormData((prev) => ({ ...prev, [section]: value }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [section]: { ...prev[section], [field]: value },
      }));
    }
  };

  const toggleMethod = (key) => {
    setSelectedMethods((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleMultiplier = (key, value) => {
    setMultipliers((prev) => ({ ...prev, [key]: parseFloat(value) }));
  };

  const handleCalculate = () => {
    if (showUBC)  dispatch({ type: "SET_RESULT", method: "ubc",        payload: calculateUBC(formData) });
    else          dispatch({ type: "SET_RESULT", method: "ubc",        payload: null });

    if (showN81)  dispatch({ type: "SET_RESULT", method: "nicholas81", payload: calculateNicholas81(formData) });
    else          dispatch({ type: "SET_RESULT", method: "nicholas81", payload: null });

    if (showN92)  dispatch({ type: "SET_RESULT", method: "nicholas92", payload: calculateNicholas92(formData, multipliers) });
    else          dispatch({ type: "SET_RESULT", method: "nicholas92", payload: null });

    if (showSHB)  dispatch({ type: "SET_RESULT", method: "shb",        payload: calculateSHB(formData) });
    else          dispatch({ type: "SET_RESULT", method: "shb",        payload: null });

    navigate("/statistics");
  };

  return (
    <div style={{ padding: "20px", maxWidth: "960px", margin: "0 auto" }}>
      <h2>Parâmetros do Depósito</h2>

      {/* SELEÇÃO DE MÉTODOS */}
      <div style={card}>
        <h4 style={{ marginTop: 0 }}>Métodos de Seleção</h4>
        <p style={sublbl}>Selecione os métodos que deseja aplicar. O formulário se ajustará automaticamente.</p>
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
          {ALL_METHODS.map(({ key, label }) => (
            <label key={key} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px" }}>
              <input
                type="checkbox"
                checked={selectedMethods[key]}
                onChange={() => toggleMethod(key)}
                style={{ width: "16px", height: "16px", cursor: "pointer" }}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {!anySelected && (
        <div style={{ ...card, backgroundColor: "#fef9c3", border: "1px solid #fde047" }}>
          <p style={{ margin: 0, fontSize: "14px", color: "#854d0e" }}>Selecione pelo menos um método para continuar.</p>
        </div>
      )}

      {anySelected && (
        <>
          {/* 1. GEOMETRIA */}
          <div style={card}>
            <h4 style={{ marginTop: 0 }}>1. Geometria do Depósito</h4>
            <div style={grid2}>
              <div>
                <label style={lbl}>Forma geral</label>
                <select style={inp} value={formData.geometry.shape} onChange={(e) => handleChange("geometry", "shape", e.target.value)}>
                  <option value="">Selecione</option>
                  <option>Massivo</option>
                  <option>Tabular</option>
                  <option>Irregular</option>
                </select>
              </div>

              <div>
                <label style={lbl}>Espessura</label>
                <select style={inp} value={formData.geometry.thickness} onChange={(e) => handleChange("geometry", "thickness", e.target.value)}>
                  <option value="">Selecione</option>
                  <option>Muito estreito</option>
                  <option>Estreito</option>
                  <option>Intermediário</option>
                  <option>Espesso</option>
                  <option>Muito espesso</option>
                </select>
              </div>

              <div>
                <label style={lbl}>Mergulho (°)</label>
                <input type="number" min="0" max="90" style={inp} placeholder="ex: 65"
                  value={formData.dip}
                  onChange={(e) => handleChange("dip", null, e.target.value)} />
              </div>

              <div>
                <label style={lbl}>Distribuição de teores</label>
                <select style={inp} value={formData.geometry.grade} onChange={(e) => handleChange("geometry", "grade", e.target.value)}>
                  <option value="">Selecione</option>
                  <option>Uniforme</option>
                  <option>Gradacional</option>
                  <option>Errático</option>
                </select>
              </div>

              {showDepth && (
                <div>
                  <label style={lbl}>Profundidade do corpo de minério (m)</label>
                  <input type="number" min="0" style={inp} placeholder="ex: 400"
                    value={formData.depth.ore}
                    onChange={(e) => handleChange("depth", "ore", e.target.value)} />
                </div>
              )}
            </div>
          </div>

          {/* 2. DENSIDADE */}
          {showUBC && (
            <div style={card}>
              <h4 style={{ marginTop: 0 }}>2. Densidade (kg/m³)</h4>
              <div style={grid3}>
                {["ore", "hangingWall", "footwall"].map((z) => (
                  <div key={z}>
                    <label style={lbl}>{zones[z]}</label>
                    <input type="number" style={inp} placeholder="ex: 2800"
                      value={formData.density[z]}
                      onChange={(e) => handleChange("density", z, e.target.value)} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. UCS */}
          {showUBC && (
            <div style={card}>
              <h4 style={{ marginTop: 0 }}>3. Uniaxial Compressive Strength (UCS) (MPa)</h4>
              <div style={grid3}>
                {["ore", "hangingWall", "footwall"].map((z) => (
                  <div key={z}>
                    <label style={lbl}>{zones[z]}</label>
                    <input type="number" style={inp} placeholder="ex: 80"
                      value={formData.ucs[z]}
                      onChange={(e) => handleChange("ucs", z, e.target.value)} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. RSS */}
          <div style={card}>
            <h4 style={{ marginTop: 0 }}>4. Rock Substance Strength (RSS)</h4>
            {showNicholas && !showUBC && !showSHB && (
              <p style={sublbl}>Nicholas usa 3 classes (Fraca / Moderada / Resistente).</p>
            )}
            <div style={grid3}>
              {["ore", "hangingWall", "footwall"].map((z) => (
                <div key={z}>
                  <label style={lbl}>{zones[z]}</label>
                  <select style={inp} value={formData.rss[z]} onChange={(e) => handleChange("rss", z, e.target.value)}>
                    <option value="">Selecione</option>
                    {(showUBC || showSHB) && <option>Muito fraca</option>}
                    <option>Fraca</option>
                    <option>Moderada</option>
                    <option>Resistente</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* 5. RMR */}
          {showRMR && (
            <div style={card}>
              <h4 style={{ marginTop: 0 }}>5. Rock Mass Rating (RMR)</h4>
              <div style={grid3}>
                {["ore", "hangingWall", "footwall"].map((z) => (
                  <div key={z}>
                    <label style={lbl}>{zones[z]}</label>
                    <select style={inp} value={formData.rmr[z]} onChange={(e) => handleChange("rmr", z, e.target.value)}>
                      <option value="">Selecione</option>
                      <option>Muito fraca</option>
                      <option>Fraca</option>
                      <option>Média</option>
                      <option>Forte</option>
                      <option>Muito forte</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6. FRATURAS */}
          {showFractures && (
            <div style={card}>
              <h4 style={{ marginTop: 0 }}>6. Fraturas</h4>

              <p style={{ fontWeight: "600", fontSize: "13px", marginBottom: "8px" }}>Espaçamento das fraturas</p>
              <div style={grid3}>
                {["ore", "hangingWall", "footwall"].map((z) => (
                  <div key={z}>
                    <label style={lbl}>{zones[z]}</label>
                    <select style={inp} value={formData.jointSpacing[z]} onChange={(e) => handleChange("jointSpacing", z, e.target.value)}>
                      <option value="">Selecione</option>
                      <option>Muito Perto</option>
                      <option>Perto</option>
                      <option>Longe</option>
                      <option>Muito Longe</option>
                    </select>
                  </div>
                ))}
              </div>

              <p style={{ fontWeight: "600", fontSize: "13px", margin: "16px 0 8px" }}>Características das interfraturas</p>
              <div style={grid3}>
                {["ore", "hangingWall", "footwall"].map((z) => (
                  <div key={z}>
                    <label style={lbl}>{zones[z]}</label>
                    <select style={inp} value={formData.jointCondition[z]} onChange={(e) => handleChange("jointCondition", z, e.target.value)}>
                      <option value="">Selecione</option>
                      <option>Fraca</option>
                      <option>Média</option>
                      <option>Forte</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 7. VALOR DO MINÉRIO */}
          {showOreValue && (
            <div style={card}>
              <h4 style={{ marginTop: 0 }}>7. Valor do Minério (SH&B)</h4>
              <div style={{ maxWidth: "300px" }}>
                <select style={inp} value={formData.oreValue} onChange={(e) => handleChange("oreValue", null, e.target.value)}>
                  <option value="">Selecione</option>
                  <option>Baixo</option>
                  <option>Médio</option>
                  <option>Alto</option>
                </select>
              </div>
            </div>
          )}

          {/* 8. MULTIPLICADORES NICHOLAS 92 */}
          {showMultipliers && (
            <div style={card}>
              <h4 style={{ marginTop: 0 }}>8. Multiplicadores — Nicholas 1992</h4>
              <p style={sublbl}>Ajuste os pesos relativos de cada domínio. Padrão: Geometria=1.00, Orebody=1.33, HW=1.33, FW=1.33.</p>
              <div style={grid2}>
                {[
                  ["geometry",    "Geometria"],
                  ["orebody",     "Corpo de minério"],
                  ["hangingWall", "Hanging wall"],
                  ["footwall",    "Foot wall"],
                ].map(([key, label]) => (
                  <div key={key}>
                    <label style={lbl}>{label}: <strong>{multipliers[key].toFixed(2)}</strong></label>
                    <input type="range" min="0" max="3" step="0.01" style={{ width: "100%" }}
                      value={multipliers[key]}
                      onChange={(e) => handleMultiplier(key, e.target.value)} />
                  </div>
                ))}
              </div>
              <button
                style={{ marginTop: "12px", padding: "6px 16px", backgroundColor: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: "4px", cursor: "pointer", fontSize: "13px" }}
                onClick={() => setMultipliers({ ...DEFAULT_MULTIPLIERS })}
              >
                Restaurar padrão
              </button>
            </div>
          )}

          {/* CALCULAR */}
          <div style={card}>
            <button
              style={{ width: "100%", padding: "14px", backgroundColor: "#2f3e4e", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "15px" }}
              onClick={handleCalculate}
            >
              CALCULAR
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default Inputs;
