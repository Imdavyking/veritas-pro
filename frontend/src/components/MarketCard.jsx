// src/components/MarketCard.jsx
import { Tag, PoolBar } from "./ui.jsx";

const STATUS_COLOR = {
  Open: "var(--green)",
  PendingResolve: "var(--amber)",
  Resolved: "var(--blue)",
  Disputed: "var(--red)",
  Cancelled: "#6b7280",
};

function formatDeadline(ts) {
  const now = Date.now() / 1000;
  const diff = ts - now;

  if (diff <= 0) {
    // already expired — show how long ago
    const ago = Math.abs(diff);
    if (ago < 3600) return `ended ${Math.floor(ago / 60)}m ago`;
    if (ago < 86400) return `ended ${Math.floor(ago / 3600)}h ago`;
    return `ended ${Math.floor(ago / 86400)}d ago`;
  }

  // still live — show countdown
  if (diff < 3600) return `closes in ${Math.floor(diff / 60)}m`;
  if (diff < 86400)
    return `closes in ${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
  return `closes in ${Math.floor(diff / 86400)}d ${Math.floor((diff % 86400) / 3600)}h`;
}

export function MarketCard({ market, onClick }) {
  const {
    question,
    resolutionSource,
    yesPool,
    noPool,
    status,
    outcome,
    deadline,
  } = market;
  const totalPool = parseFloat(yesPool) + parseFloat(noPool);
  const yesPct = totalPool > 0 ? (parseFloat(yesPool) / totalPool) * 100 : 50;
  const isExpired = Date.now() / 1000 >= deadline;

  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--bg2)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "18px 20px",
        cursor: "pointer",
        transition: "border-color .2s",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.borderColor = "var(--border2)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.borderColor = "var(--border)")
      }
    >
      {/* Header row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          marginBottom: 8,
        }}
      >
        <div style={{ fontSize: 13.5, lineHeight: 1.5, flex: 1 }}>
          {question}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 4,
            flexShrink: 0,
          }}
        >
          <Tag color={STATUS_COLOR[status]}>{status.toLowerCase()}</Tag>
          {outcome && outcome !== "Unset" && (
            <Tag color={outcome === "Yes" ? "var(--green)" : "var(--red)"}>
              {outcome.toUpperCase()}
            </Tag>
          )}
          {status === "Open" && isExpired && (
            <Tag color="var(--amber)">needs resolve</Tag>
          )}
        </div>
      </div>

      {/* Meta — source · deadline · pool */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 11,
          color: "var(--text3)",
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <span>
          via <span style={{ color: "#7c6aad" }}>{resolutionSource}</span>
        </span>
        <span style={{ color: "var(--border2)" }}>·</span>
        <span
          style={{
            color: isExpired ? "var(--text3)" : "var(--amber)",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {!isExpired && (
            <span
              style={{
                display: "inline-block",
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "var(--amber)",
                animation: "pulse 2s infinite",
              }}
            />
          )}
          {formatDeadline(deadline)}
        </span>
        <span style={{ color: "var(--border2)" }}>·</span>
        <span>{totalPool.toFixed(2)} STT pool</span>
      </div>

      {/* Pool bar */}
      <PoolBar yesPct={yesPct} />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 6,
          fontSize: 10,
        }}
      >
        <span style={{ color: "var(--green)" }}>
          {yesPct.toFixed(0)}% YES — {parseFloat(yesPool).toFixed(2)} STT
        </span>
        <span style={{ color: "var(--red)" }}>
          {(100 - yesPct).toFixed(0)}% NO — {parseFloat(noPool).toFixed(2)} STT
        </span>
      </div>
    </div>
  );
}
