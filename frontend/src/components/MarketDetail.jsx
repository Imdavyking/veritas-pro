// src/components/MarketDetail.jsx
import { useState, useEffect, useRef } from "react";
import { Button, Input, Divider, PoolBar, Tag, SectionLabel } from "./ui.jsx";

function parseError(e) {
  const isInsufficientFunds =
    e?.code === "INSUFFICIENT_FUNDS" ||
    e?.error?.code === -32000 ||
    e?.info?.error?.code === -32000 ||
    e?.message?.toLowerCase().includes("insufficient funds");

  if (isInsufficientFunds) {
    return "Insufficient STT balance to cover this transaction + gas";
  }
  return e?.reason || e?.shortMessage || e?.message || "Transaction failed";
}

const STATUS_COLOR = {
  Open: "var(--green)",
  PendingResolve: "var(--amber)",
  Resolved: "var(--blue)",
  Disputed: "var(--red)",
  Cancelled: "#6b7280",
};

const AGENT_STEPS = [
  "Dispatching LLM Parse Website agent…",
  "Agent searching resolution source…",
  "Validator subcommittee executing (3/3)…",
  "Validators reaching consensus…",
  "Receipt hash committed on-chain…",
  "handleResponse() callback firing…",
  "Outcome written to contract storage ✓",
];

export function MarketDetail({
  market,
  signer,
  address,
  onBack,
  actions,
  onToast,
}) {
  const [betSide, setBetSide] = useState(null);
  const [betAmount, setBetAmount] = useState("");
  const [betLoading, setBetLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [logLines, setLogLines] = useState([]);
  const [claimLoading, setClaimLoading] = useState(false);
  const [disputeLoading, setDisputeLoading] = useState(false);
  const pollRef = useRef(null);
  const {
    question,
    resolutionSource,
    yesPool,
    noPool,
    status,
    outcome,
    disputeDeadline,
  } = market;

  // Poll every 4s while PendingResolve or Disputed — stop when resolved
  useEffect(() => {
    if (status === "PendingResolve" || status === "Disputed") {
      pollRef.current = setInterval(() => {
        actions.refreshMarket(market.id);
      }, 4000);
    }
    return () => clearInterval(pollRef.current);
  }, [status, market.id]); // eslint-disable-line

  const totalPool = parseFloat(yesPool) + parseFloat(noPool);
  const yesPct = totalPool > 0 ? (parseFloat(yesPool) / totalPool) * 100 : 50;
  const isExpired = Date.now() / 1000 >= market.deadline;
  const disputeOpen = Date.now() / 1000 <= disputeDeadline;

  async function handleBet() {
    if (!signer) {
      onToast("Connect your wallet first");
      return;
    }
    if (!betSide || !betAmount || parseFloat(betAmount) <= 0) {
      onToast("Pick a side and enter an amount");
      return;
    }
    setBetLoading(true);
    try {
      await actions.bet(signer, market.id, betSide === "yes", betAmount);
      setBetAmount("");
      setBetSide(null);
      onToast(`Bet placed: ${betAmount} STT on ${betSide.toUpperCase()} ✓`);
    } catch (e) {
      onToast(parseError(e));
    } finally {
      setBetLoading(false);
    }
  }

  async function handleResolve() {
    if (!signer) {
      onToast("Connect your wallet first");
      return;
    }
    setResolving(true);
    setLogLines([]);
    try {
      console.log("Triggering resolution for market ID:", market.id);
      await actions.triggerResolution(signer, market.id);
      // tx confirmed — market is now PendingResolve, agent callback comes async
      // polling (useEffect above) will auto-refresh until Resolved
      onToast("Agent dispatched ✓ Polling for result every 4s…");
    } catch (e) {
      console.log(e);
      onToast(parseError(e));
    } finally {
      setResolving(false);
      // keep logLines empty — status badge + polling message is enough
    }
  }

  async function handleClaim() {
    if (!signer) {
      onToast("Connect your wallet first");
      return;
    }
    setClaimLoading(true);
    try {
      await actions.claimPayout(signer, market.id);
      onToast("Payout claimed ✓ STT sent to your wallet");
    } catch (e) {
      onToast(parseError(e));
    } finally {
      setClaimLoading(false);
    }
  }

  async function handleDispute() {
    if (!signer) {
      onToast("Connect your wallet first");
      return;
    }
    setDisputeLoading(true);
    try {
      await actions.raiseDispute(signer, market.id);
      onToast("Dispute raised — LLM Inference agent re-examining verdict");
    } catch (e) {
      onToast(parseError(e));
    } finally {
      setDisputeLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={onBack}
        style={{
          background: "none",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)",
          padding: "5px 12px",
          color: "var(--text3)",
          fontSize: "11px",
          cursor: "pointer",
          marginBottom: 16,
          transition: "border-color .15s",
        }}
      >
        ← all markets
      </button>

      {/* Main card */}
      <div
        style={{
          background: "var(--bg2)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: 24,
          marginBottom: 10,
        }}
      >
        {/* Title + status */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            marginBottom: 10,
          }}
        >
          <div
            style={{
              fontFamily: "var(--sans)",
              fontSize: 18,
              fontWeight: 500,
              lineHeight: 1.4,
              flex: 1,
            }}
          >
            {question}
          </div>
          <Tag color={STATUS_COLOR[status]}>{status.toLowerCase()}</Tag>
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            fontSize: 11,
            color: "var(--text3)",
            marginBottom: 16,
            alignItems: "center",
          }}
        >
          <span>
            agent reads{" "}
            <span style={{ color: "#7c6aad" }}>{resolutionSource}</span>
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
            {(() => {
              const diff = market.deadline - Date.now() / 1000;
              if (diff <= 0) {
                const ago = Math.abs(diff);
                if (ago < 3600) return `ended ${Math.floor(ago / 60)}m ago`;
                if (ago < 86400) return `ended ${Math.floor(ago / 3600)}h ago`;
                return `ended ${Math.floor(ago / 86400)}d ago`;
              }
              if (diff < 3600) return `closes in ${Math.floor(diff / 60)}m`;
              if (diff < 86400)
                return `closes in ${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
              return `closes in ${Math.floor(diff / 86400)}d ${Math.floor((diff % 86400) / 3600)}h`;
            })()}
          </span>
          <span style={{ color: "var(--border2)" }}>·</span>
          <span>
            by {market.creator?.slice(0, 6)}…{market.creator?.slice(-4)}
          </span>
        </div>

        {/* Pools */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            marginBottom: 14,
          }}
        >
          {[
            ["YES", yesPool, yesPct, "var(--green)", "var(--green-dim)"],
            ["NO", noPool, 100 - yesPct, "var(--red)", "var(--red-dim)"],
          ].map(([side, pool, pct, color, bg]) => (
            <div
              key={side}
              style={{
                background: "var(--bg3)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                padding: "12px 14px",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color,
                  letterSpacing: ".06em",
                  marginBottom: 4,
                }}
              >
                {side} POOL
              </div>
              <div
                style={{
                  fontFamily: "var(--sans)",
                  fontSize: 20,
                  fontWeight: 600,
                  color,
                }}
              >
                {parseFloat(pool).toFixed(2)}{" "}
                <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.5 }}>
                  STT
                </span>
              </div>
              <div
                style={{ fontSize: 10, color: "var(--text3)", marginTop: 3 }}
              >
                {pct.toFixed(1)}% of pool
              </div>
            </div>
          ))}
        </div>

        <PoolBar yesPct={yesPct} height={5} />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 6,
            fontSize: 10,
            marginBottom: 4,
          }}
        >
          <span style={{ color: "var(--green)" }}>
            {yesPct.toFixed(0)}% YES
          </span>
          <span style={{ color: "var(--text3)" }}>
            {totalPool.toFixed(2)} STT total
          </span>
          <span style={{ color: "var(--red)" }}>
            {(100 - yesPct).toFixed(0)}% NO
          </span>
        </div>

        {/* ── Bet UI ── */}
        {status === "Open" && !isExpired && (
          <>
            <Divider style={{ margin: "16px 0" }} />
            <SectionLabel>PLACE A BET</SectionLabel>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              {["yes", "no"].map((side) => (
                <button
                  key={side}
                  onClick={() => setBetSide(side)}
                  style={{
                    flex: 1,
                    padding: 9,
                    border: `1px solid ${betSide === side ? (side === "yes" ? "var(--green)" : "var(--red)") : "var(--border2)"}`,
                    borderRadius: "var(--radius-sm)",
                    fontFamily: "var(--mono)",
                    fontSize: 12,
                    cursor: "pointer",
                    background:
                      betSide === side
                        ? side === "yes"
                          ? "var(--green-dim)"
                          : "var(--red-dim)"
                        : "transparent",
                    color:
                      betSide === side
                        ? side === "yes"
                          ? "var(--green)"
                          : "var(--red)"
                        : "var(--text3)",
                    transition: "all .15s",
                  }}
                >
                  {side.toUpperCase()}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="number"
                placeholder="amount in STT"
                min="0.01"
                step="0.01"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                style={{
                  flex: 1,
                  background: "var(--bg3)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "9px 12px",
                  color: "var(--text)",
                  fontSize: 12,
                  outline: "none",
                }}
              />
              <Button
                onClick={handleBet}
                loading={betLoading}
                disabled={!betSide || !betAmount}
              >
                bet {betSide ? betSide.toUpperCase() : ""}
              </Button>
            </div>
          </>
        )}

        {/* ── Resolve UI ── */}
        {status === "Open" && isExpired && (
          <>
            <Divider style={{ margin: "16px 0" }} />
            <SectionLabel>
              DEADLINE PASSED — TRIGGER AGENT RESOLUTION
            </SectionLabel>
            <Button onClick={handleResolve} loading={resolving}>
              {resolving ? "agent running…" : "trigger resolution"}
            </Button>
            <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 8 }}>
              Pays ~0.33 STT agent fee · LLM Parse Website reads{" "}
              {resolutionSource}
            </div>
            {logLines.length > 0 && (
              <div
                style={{
                  background: "var(--bg3)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "12px 14px",
                  marginTop: 12,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--text3)",
                    letterSpacing: ".06em",
                    marginBottom: 8,
                  }}
                >
                  AGENT LOG
                </div>
                {logLines.map((line, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: 11,
                      color: "var(--purple)",
                      padding: "3px 0",
                      animation: "slideIn .25s ease",
                    }}
                  >
                    <span style={{ color: "var(--text3)", marginRight: 8 }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {line}
                  </div>
                ))}
                {resolving && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text3)",
                      marginTop: 4,
                      animation: "pulse 1s infinite",
                    }}
                  >
                    ▪ waiting for callback…
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Pending resolve ── */}
        {(status === "PendingResolve" || status === "Disputed") && (
          <>
            <Divider style={{ margin: "16px 0" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  color: "var(--text2)",
                }}
              >
                <div
                  style={{
                    width: 12,
                    height: 12,
                    border: "2px solid var(--amber)",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    animation: "spin .7s linear infinite",
                    flexShrink: 0,
                  }}
                />
                {status === "Disputed"
                  ? "Dispute agent re-examining verdict…"
                  : "Agent resolution in-flight — waiting for callback…"}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text3)",
                  background: "var(--bg3)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "8px 12px",
                  lineHeight: 1.6,
                }}
              >
                ↻ Polling chain every 4s for result. This page will update
                automatically when the agent callback fires. Typically takes{" "}
                <span style={{ color: "var(--amber)" }}>15–60 seconds</span> on
                testnet.
              </div>
            </div>
          </>
        )}

        {/* ── Resolved UI ── */}
        {status === "Resolved" && (
          <>
            <Divider style={{ margin: "16px 0" }} />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 10,
              }}
            >
              <div style={{ fontSize: 12, color: "var(--text3)" }}>outcome</div>
              <span
                style={{
                  fontFamily: "var(--sans)",
                  fontSize: 15,
                  fontWeight: 600,
                  padding: "4px 12px",
                  borderRadius: "var(--radius-sm)",
                  background:
                    outcome === "Yes" ? "var(--green-dim)" : "var(--red-dim)",
                  color: outcome === "Yes" ? "var(--green)" : "var(--red)",
                  border: `1px solid ${outcome === "Yes" ? "#16a34a" : "#dc2626"}`,
                }}
              >
                {outcome?.toUpperCase()}
              </span>
            </div>
            <div
              style={{ fontSize: 11, color: "var(--text3)", marginBottom: 14 }}
            >
              {disputeOpen
                ? `Dispute window closes in ${Math.ceil((disputeDeadline - Date.now() / 1000) / 60)} min`
                : "Dispute window closed — payouts available"}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {!disputeOpen && (
                <Button onClick={handleClaim} loading={claimLoading}>
                  claim payout
                </Button>
              )}
              {disputeOpen && (
                <Button
                  variant="secondary"
                  onClick={handleDispute}
                  loading={disputeLoading}
                >
                  raise dispute (0.24 STT)
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      {/* How it resolves */}
      <div
        style={{
          background: "var(--bg3)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: 18,
        }}
      >
        <SectionLabel>HOW THIS MARKET RESOLVES</SectionLabel>
        {[
          [
            "01",
            "Trigger",
            `Anyone calls triggerResolution() after the deadline. Pays ~0.33 STT.`,
          ],
          [
            "02",
            "Parse agent",
            `LLM Parse Website (search mode) queries ${resolutionSource} for the outcome.`,
          ],
          [
            "03",
            "Consensus",
            "3-validator subcommittee independently runs the agent — majority rules.",
          ],
          [
            "04",
            "Receipt",
            "Exact URL scraped + model output committed as receiptHash on-chain. Permanently auditable.",
          ],
          [
            "05",
            "Callback",
            "handleResponse() fires, writes outcome to storage, opens 2h dispute window.",
          ],
          [
            "06",
            "Payout",
            "After dispute window, winners call claimPayout() for their proportional share (minus 1% fee).",
          ],
        ].map(([n, title, desc]) => (
          <div key={n} style={{ display: "flex", gap: 12, marginBottom: 10 }}>
            <div
              style={{
                fontSize: 10,
                color: "var(--purple)",
                minWidth: 18,
                paddingTop: 2,
              }}
            >
              {n}
            </div>
            <div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text2)",
                  fontWeight: 500,
                  marginBottom: 2,
                }}
              >
                {title}
              </div>
              <div
                style={{ fontSize: 11, color: "var(--text3)", lineHeight: 1.5 }}
              >
                {desc}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
