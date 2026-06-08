// src/components/CreateMarket.jsx
import { useState } from "react";
import { Button, Input } from "./ui.jsx";

export function CreateMarket({ signer, actions, onSuccess, onToast }) {
  const [question,  setQuestion]  = useState("");
  const [source,    setSource]    = useState("");
  const [deadline,  setDeadline]  = useState("");
  const [loading,   setLoading]   = useState(false);

  async function handleSubmit() {
    if (!signer) { onToast("Connect your wallet first"); return; }
    if (!question.trim()) { onToast("Enter a question"); return; }
    if (!source.trim())   { onToast("Enter a resolution source"); return; }
    if (!deadline)        { onToast("Pick a deadline"); return; }

    const deadlineTs = Math.floor(new Date(deadline).getTime() / 1000);
    if (deadlineTs <= Math.floor(Date.now() / 1000)) {
      onToast("Deadline must be in the future");
      return;
    }

    setLoading(true);
    try {
      await actions.createMarket(signer, question.trim(), source.trim(), deadlineTs);
      setQuestion(""); setSource(""); setDeadline("");
      onToast("Market deployed on-chain ✓");
      onSuccess();
    } catch (e) {
      onToast(e.reason || e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ fontSize: 10, color: "var(--text3)", letterSpacing: ".07em", marginBottom: 24 }}>NEW MARKET</div>
      <div style={{
        background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)",
        padding: 28, maxWidth: 520, display: "flex", flexDirection: "column", gap: 16,
      }}>
        <Input
          label="PREDICTION QUESTION"
          placeholder="Will ETH close above $3,500 today (UTC)?"
          value={question}
          onChange={e => setQuestion(e.target.value)}
        />
        <Input
          label="RESOLUTION SOURCE DOMAIN"
          placeholder="coinmarketcap.com"
          value={source}
          onChange={e => setSource(e.target.value)}
          hint="The LLM Parse Website agent will search this domain to determine the outcome."
        />
        <Input
          label="RESOLUTION DEADLINE"
          type="datetime-local"
          value={deadline}
          onChange={e => setDeadline(e.target.value)}
        />

        <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
          <Button onClick={handleSubmit} loading={loading} style={{ flex: 1 }}>
            {loading ? "deploying…" : "deploy market"}
          </Button>
          <Button variant="secondary" onClick={onSuccess}>cancel</Button>
        </div>

        <div style={{
          fontSize: 11, color: "var(--text3)", borderTop: "1px solid var(--border)", paddingTop: 14,
          lineHeight: 1.6, background: "#0d0d16", borderRadius: "var(--radius-sm)", padding: "10px 14px",
          marginTop: 4,
        }}>
          ⚡ After the deadline, anyone pays ~0.33 STT to trigger resolution.
          The LLM Parse Website agent searches{" "}
          <span style={{ color: "#7c6aad" }}>{source || "your domain"}</span>,
          3 validators reach consensus, and the outcome is committed on-chain
          with a permanent receipt hash.
        </div>
      </div>
    </div>
  );
}
