import Modal from "./Modal";

const groupTitle = {
  fontSize: "12px", fontWeight: 700, color: "var(--muted)",
  textTransform: "uppercase", letterSpacing: "0.08em",
  margin: "0 0 4px",
};
const personName = { fontSize: "15px", color: "var(--text)", lineHeight: 1.5 };

function Group({ title, people }) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <p style={groupTitle}>{title}</p>
      {people.map((p) => (
        <div key={p} style={personName}>{p}</div>
      ))}
    </div>
  );
}

export default function CreditsModal({ onClose }) {
  return (
    <Modal title="Créditos" onClose={onClose} maxWidth="440px">
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--text)" }}>
          MMS 2.0 — Mining Method Selection Tool
        </div>
        <div style={{ fontSize: "13px", color: "var(--muted)", letterSpacing: "0.06em", marginTop: "4px" }}>
          LAPROM · UFRGS
        </div>
      </div>

      <Group title="Desenvolvimento" people={["Artur Feijó"]} />
      <Group title="Orientação" people={["Higor Campos"]} />
      <Group title="Colaboradores" people={["Fernando Cardozo", "Carlos Petter", "Renato Petter"]} />

      <div style={{
        borderTop: "1px solid var(--border)", paddingTop: "16px", marginTop: "4px",
        fontSize: "13px", color: "var(--muted)", lineHeight: 1.6,
      }}>
        Universidade Federal do Rio Grande do Sul<br />
        Laboratório de Processos Minerais — LAPROM
      </div>
    </Modal>
  );
}
