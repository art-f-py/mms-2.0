import { useState } from "react";
import Modal from "./Modal";

const ENDPOINT = "https://formcarry.com/s/lVe6Ba2CKVq";

const labelStyle = { fontSize: "14px", fontWeight: 600, color: "var(--text)", marginBottom: "6px", display: "block" };
const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: "6px",
  border: "1px solid var(--border)", fontSize: "15px",
  color: "var(--text)", backgroundColor: "var(--bg)",
  boxSizing: "border-box", fontFamily: "inherit",
};

export default function ReportModal({ onClose, onSuccess }) {
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError]     = useState("");

  const submit = async () => {
    setError("");
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError("Preencha todos os campos.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      const data = await res.json();
      if (data.code === 200) {
        onSuccess();
      } else {
        setError(data.message || "Não foi possível enviar. Tente novamente.");
      }
    } catch {
      setError("Falha de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal title="Reportar erro" onClose={onClose}>
      <div role="form" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <label style={labelStyle}>Nome completo</label>
          <input
            style={inputStyle}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome"
          />
        </div>
        <div>
          <label style={labelStyle}>Email</label>
          <input
            type="email"
            style={inputStyle}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@exemplo.com"
          />
        </div>
        <div>
          <label style={labelStyle}>Descrição do erro</label>
          <textarea
            style={{ ...inputStyle, minHeight: "120px", resize: "vertical" }}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Descreva o que aconteceu, em qual etapa, e o que esperava."
          />
        </div>

        {error && (
          <p style={{ fontSize: "13px", color: "#dc2626", margin: 0 }}>{error}</p>
        )}

        <button
          onClick={submit}
          disabled={sending}
          style={{
            padding: "12px", borderRadius: "6px", border: "none",
            backgroundColor: "var(--primary)", color: "#ffffff",
            fontSize: "15px", fontWeight: 700,
            cursor: sending ? "default" : "pointer",
            opacity: sending ? 0.6 : 1,
          }}
        >
          {sending ? "Enviando…" : "Enviar"}
        </button>
      </div>
    </Modal>
  );
}
