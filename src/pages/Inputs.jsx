import { useState } from 'react';

function Inputs() {
    const [selectedMethod, setSelectedMethod] = useState("ubc");

    return (
        <div style={{ padding: "20px" }}>
            <h2>Entrada de Dados</h2>
            <select
                value={selectedMethod}
                onChange={(e) => setSelectedMethod(e.target.value)}
            >
                <option value="ubc">UBC</option>
                <option value="nicholas81">Nicholas 1981</option>
                <option value="nicholas92">Nicholas 1992</option>
                <option value="shb">SH&B</option>
            </select>

            {selectedMethod === "ubc" && <UBCForm />}
            {selectedMethod === "nicholas81" && <Nicholas81Form />}
            {selectedMethod === "nicholas92" && <Nicholas92Form />}
            {selectedMethod === "shb" && <SHBForm />}
        </div>
    );
}

export default Inputs;

function UBCForm() {
    const [formData, setFormData] = useState({
        geometry: {
            shape: "",
            dip: "",
            thickness: "",
            grade: "",
            depth: ""
        },
        density: {
            ore: "",
            hangingWall: "",
            footWall: ""
        },
        depth: {
            ore: "",
            hangingWall: "",
            footwall: ""
        },
        ucs: {
            ore: "",
            hangingWall: "",
            footWall: ""
        },
        rss: {
            ore: "",
            hangingWall: "",
            footWall: ""
        },
        rmr: {
            ore: "",
            hangingWall: "",
            footwall: ""
        }
    });

    const handleChange = (section, field, value) => {
        setFormData(prevData => ({
            ...prevData,
            [section]: {
                ...prevData[section],
                [field]: value
            }
        }));
    };

    return (
        <div style={{ marginTop: "20px" }}>
            <h3>Características Gerais</h3>

            <h4>Geometria do Depósito</h4>
                <select onChange={(e) => handleChange("geometry", "shape", e.target.value)}>
                    <option value="">Forma Geral</option>
                    <option>Massiva</option>
                    <option>Tabluar</option>
                    <option>Irregular</option>
                </select>

                <select onChange={(e) => handleChange("geometry", "dip", e.target.value)}>
                    <option value="">Mergulho </option>
                    <option>Plano</option>
                    <option>Intermediário</option>
                    <option>Inclinado</option>
                </select>

                <select onChange={(e) => handleChange("geometry", "thickness", e.target.value)}>
                    <option value="">Espessura</option>
                    <option>Muito estreito</option>
                    <option>Estreito</option>
                    <option>Intermediário</option>
                    <option>Espesso</option>
                    <option>Muito espesso</option>
                </select>

                <select onChange={(e) => handleChange("geometry", "grade", e.target.value)}>
                    <option value="">Distribuição de teores</option>
                    <option>Uniforme</option>
                    <option>Gradacional</option>
                    <option>Errática</option>
                </select>

                <select onChange={(e) => handleChange("geometry", "depth", e.target.value)}>
                    <option value="">Profundidade</option>
                    <option>Raso</option>
                    <option>Intermediário</option>
                    <option>Profundo</option>
                </select>

            <div>
                <h4>Densidade Média do Overburden(kg/m³)</h4>

                <input placeholder="Corpo de minério"
                    onChange={(e) => handleChange("density", "ore", e.target.value)} />
                <input placeholder="Hanging wall"
                    onChange={(e) => handleChange("density", "hangingWall", e.target.value)} />
                <input placeholder="Foot wall"
                    onChange={(e) => handleChange("density", "footwall", e.target.value)} />
            </div>

            <div>
                <h4>Profundidade (m)</h4>
                <input placeholder="Corpo de minério"
                    onChange={(e) => handleChange("depth", "ore", e.target.value)} />
                <input placeholder="Hanging wall"
                    onChange={(e) => handleChange("depth", "hangingWall", e.target.value)} />
                <input placeholder="Foot wall"
                    onChange={(e) => handleChange("depth", "footwall", e.target.value)} />
            </div>

            <div>
                <h4>Uniaxial Compressive Strength</h4>
                <input placeholder="Corpo de minério"
                    onChange={(e) => handleChange("ucs", "ore", e.target.value)} />
                <input placeholder="Hanging wall"
                    onChange={(e) => handleChange("ucs", "hangingWall", e.target.value)} />
                <input placeholder="Foot wall"
                    onChange={(e) => handleChange("ucs", "footWall", e.target.value)} />
            </div>

            <div>
                <h4>Rock Substance Strength</h4>

                {["ore", "hangingWall", "footwall"].map((zone) => (
                    <select key={zone} onChange={(e) => handleChange("rss", zone, e.target.value)}>
                        <option value="">{zone}</option>
                        <option>Muito fraca</option>
                        <option>Fraca</option>
                        <option>Moderada</option>
                        <option>Resistente</option>
                    </select>
                ))}
            </div>

            <div>
                <h4>Rock Mass Rating (RMR)</h4>
                {["ore", "hangingWall", "footwall"].map((zone) => (
                    <select key={zone} onChange={(e) => handleChange("rmr", zone, e.target.value)}>
                        <option value="">{zone}</option>
                        <option>Muito pobre</option>
                        <option>Pobre</option>
                        <option>Razoável</option>
                        <option>Boa</option>
                        <option>Muito boa</option>
                    </select>
                ))}
            </div>

            <button onClick={() => console.log(formData)}>
                Calcular
            </button>
        </div>
    );
}

