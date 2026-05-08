import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMms } from "../context/MmsContext";
import { calculateUBC } from "../algorithms/ubcAlgorithm";

function Inputs() {
    const [selectedMethod, setSelectedMethod] = useState("ubc");

    return (
        <div style={{ padding: "20px" }}>
            <h2>Método de Seleção</h2>
            <select
                value={selectedMethod}
                onChange={(e) => setSelectedMethod(e.target.value)}
            >
                <option value="ubc">UBC</option>
                <option value="nicholas81">Nicholas 1981</option>
                <option value="nicholas92">Nicholas 1992</option>
                <option value="shb">SH&B</option>
            </select>

            {selectedMethod === "ubc"        && <UBCForm />}
            {selectedMethod === "nicholas81" && <Nicholas81Form />}
            {selectedMethod === "nicholas92" && <Nicholas92Form />}
            {selectedMethod === "shb"        && <SHBForm />}
        </div>
    );
}

export default Inputs;

function Nicholas81Form() {
    return <div style={{ marginTop: "20px" }}><h3>Nicholas 1981</h3><p>A ser implementado</p></div>;
}
function Nicholas92Form() {
    return <div style={{ marginTop: "20px" }}><h3>Nicholas 1992</h3><p>A ser implementado</p></div>;
}
function SHBForm() {
    return <div style={{ marginTop: "20px" }}><h3>SH&B</h3><p>A ser implementado</p></div>;
}

function UBCForm() {
    const { dispatch } = useMms();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        geometry: { shape: "", dip: "", thickness: "", grade: "", depth: "" },
        density:  { ore: "", hangingWall: "", footwall: "" },
        ucs:      { ore: "", hangingWall: "", footwall: "" },
        rss:      { ore: "", hangingWall: "", footwall: "" },
        rmr:      { ore: "", hangingWall: "", footwall: "" },
    });

    const handleChange = (section, field, value) => {
        setFormData((prev) => ({
            ...prev,
            [section]: { ...prev[section], [field]: value },
        }));
    };

    const handleCalculate = () => {
        const result = calculateUBC(formData);
        dispatch({ type: "SET_RESULT", method: "ubc", payload: result });
        navigate("/statistics");
    };

    const card  = { border: "1px solid #e5e7eb", borderRadius: "8px", padding: "20px", marginTop: "20px", backgroundColor: "#fff", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" };
    const grid2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" };
    const grid3 = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "15px" };
    const inp   = { width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #d1d5db", boxSizing: "border-box" };
    const lbl   = { fontSize: "13px", marginBottom: "5px", display: "block" };
    const zones = { ore: "Corpo de minério", hangingWall: "Hanging wall", footwall: "Foot wall" };

    return (
        <div style={{ marginTop: "20px" }}>
            <h3>UBC Method</h3>

            {/* GEOMETRIA */}
            <div style={card}>
                <h4>1. Geometria do Depósito</h4>
                <div style={grid2}>
                    <div>
                        <label style={lbl}>Forma geral</label>
                        <select style={inp} value={formData.geometry.shape} onChange={(e) => handleChange("geometry", "shape", e.target.value)}>
                            <option value="">Selecione</option>
                            <option>Massiva</option>
                            <option>Tabular</option>
                            <option>Irregular</option>
                        </select>
                    </div>
                    <div>
                        <label style={lbl}>Mergulho</label>
                        <select style={inp} value={formData.geometry.dip} onChange={(e) => handleChange("geometry", "dip", e.target.value)}>
                            <option value="">Selecione</option>
                            <option>Plano</option>
                            <option>Intermediário</option>
                            <option>Inclinado</option>
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
                        <label style={lbl}>Distribuição de teores</label>
                        <select style={inp} value={formData.geometry.grade} onChange={(e) => handleChange("geometry", "grade", e.target.value)}>
                            <option value="">Selecione</option>
                            <option>Uniforme</option>
                            <option>Gradacional</option>
                            <option>Errática</option>
                        </select>
                    </div>
                    <div>
                        <label style={lbl}>Profundidade</label>
                        <select style={inp} value={formData.geometry.depth} onChange={(e) => handleChange("geometry", "depth", e.target.value)}>
                            <option value="">Selecione</option>
                            <option>Raso</option>
                            <option>Intermediário</option>
                            <option>Profundo</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* DENSIDADE */}
            <div style={card}>
                <h4>2. Densidade média do overburden (kg/m³)</h4>
                <div style={grid3}>
                    {["ore", "hangingWall", "footwall"].map((z) => (
                        <div key={z}>
                            <label style={lbl}>{zones[z]}</label>
                            <input style={inp} placeholder="ex: 2800" value={formData.density[z]} onChange={(e) => handleChange("density", z, e.target.value)} />
                        </div>
                    ))}
                </div>
            </div>

            {/* UCS */}
            <div style={card}>
                <h4>3. Uniaxial Compressive Strength (MPa)</h4>
                <div style={grid3}>
                    {["ore", "hangingWall", "footwall"].map((z) => (
                        <div key={z}>
                            <label style={lbl}>{zones[z]}</label>
                            <input style={inp} placeholder="ex: 80" value={formData.ucs[z]} onChange={(e) => handleChange("ucs", z, e.target.value)} />
                        </div>
                    ))}
                </div>
            </div>

            {/* RSS */}
            <div style={card}>
                <h4>4. Rock Substance Strength</h4>
                <div style={grid3}>
                    {["ore", "hangingWall", "footwall"].map((z) => (
                        <div key={z}>
                            <label style={lbl}>{zones[z]}</label>
                            <select style={inp} value={formData.rss[z]} onChange={(e) => handleChange("rss", z, e.target.value)}>
                                <option value="">Selecione</option>
                                <option>Muito fraca</option>
                                <option>Fraca</option>
                                <option>Moderada</option>
                                <option>Resistente</option>
                            </select>
                        </div>
                    ))}
                </div>
            </div>

            {/* RMR */}
            <div style={card}>
                <h4>5. Rock Mass Rating (RMR)</h4>
                <div style={grid3}>
                    {["ore", "hangingWall", "footwall"].map((z) => (
                        <div key={z}>
                            <label style={lbl}>{zones[z]}</label>
                            <select style={inp} value={formData.rmr[z]} onChange={(e) => handleChange("rmr", z, e.target.value)}>
                                <option value="">Selecione</option>
                                <option>Muito pobre</option>
                                <option>Pobre</option>
                                <option>Razoável</option>
                                <option>Boa</option>
                                <option>Muito boa</option>
                            </select>
                        </div>
                    ))}
                </div>
            </div>

            {/* CALCULAR */}
            <div style={card}>
                <button
                    style={{ width: "100%", padding: "14px", backgroundColor: "#2f3e4e", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}
                    onClick={handleCalculate}
                >
                    CALCULAR
                </button>
            </div>
        </div>
    );
}
