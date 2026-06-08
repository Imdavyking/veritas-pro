// src/App.jsx
import { useState, useEffect } from "react";
import { useWallet }    from "./hooks/useWallet.js";
import { useMarkets }   from "./hooks/useMarkets.js";
import { MarketCard }   from "./components/MarketCard.jsx";
import { MarketDetail } from "./components/MarketDetail.jsx";
import { CreateMarket } from "./components/CreateMarket.jsx";
import { Toast, Spinner, LiveDot } from "./components/ui.jsx";

export default function App() {
  const wallet  = useWallet();
  const markets = useMarkets();

  const [view,     setView]     = useState("markets"); // markets | create | detail
  const [selected, setSelected] = useState(null);
  const [toast,    setToast]    = useState(null);

  const showToast = (msg) => setToast(msg);

  // Initial load
  useEffect(() => { markets.fetchAll(); }, []); // eslint-disable-line

  // Refresh selected market when returning to it
  useEffect(() => {
    if (view === "detail" && selected !== null) {
      markets.refreshMarket(selected);
    }
  }, [view]); // eslint-disable-line

  const currentMarket = markets.markets.find(m => m.id === selected);

  const totalVol = markets.markets.reduce(
    (s, m) => s + parseFloat(m.yesPool) + parseFloat(m.noPool), 0
  );

  function goToMarkets() { setView("markets"); setSelected(null); }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>

      {/* ── Navbar ─────────────────────────────────────────── */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", height: 52,
        borderBottom: "1px solid var(--border)",
        position: "sticky", top: 0, zIndex: 10,
        background: "rgba(9,9,15,0.95)", backdropFilter: "blur(8px)",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
          onClick={goToMarkets}>
          <div style={{
            width: 26, height: 26, background: "var(--purple)", borderRadius: 5,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 0L12 6L6 12L0 6Z" stroke="white" strokeWidth="1.5"/>
            </svg>
          </div>
          <span style={{ fontFamily: "var(--sans)", fontWeight: 700, fontSize: 15, letterSpacing: "-.03em" }}>
            VERITAS
          </span>
          <span style={{ fontSize: 9, color: "#2a2a5a", marginLeft: 2, letterSpacing: ".04em" }}>
            autonomous markets
          </span>
        </div>

        {/* Nav links */}
        <div style={{ display: "flex", gap: 4 }}>
          {[["markets", "markets"], ["create", "+ create"]].map(([v, label]) => (
            <button key={v} onClick={() => setView(v)} style={{
              background: "none", border: "none", borderRadius: "var(--radius-sm)",
              padding: "6px 12px", fontSize: 12, cursor: "pointer",
              color: view === v ? "var(--text)" : "var(--text3)",
              background: view === v ? "var(--bg2)" : "transparent",
            }}>{label}</button>
          ))}
        </div>

        {/* Wallet + network */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 10, color: "var(--text3)", display: "flex", alignItems: "center", gap: 5 }}>
            somnia testnet <LiveDot />
          </div>
          {wallet.address ? (
            <div style={{
              background: "var(--bg2)", border: "1px solid var(--border2)",
              borderRadius: "var(--radius-sm)", padding: "5px 10px",
              fontSize: 11, color: "var(--text2)",
            }}>
              {wallet.address.slice(0, 6)}…{wallet.address.slice(-4)}
            </div>
          ) : (
            <button onClick={wallet.connect} disabled={wallet.connecting} style={{
              background: "var(--purple)", color: "#fff", border: "none",
              borderRadius: "var(--radius-sm)", padding: "6px 14px",
              fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
            }}>
              {wallet.connecting ? <><Spinner size={10} /> connecting…</> : "connect wallet"}
            </button>
          )}
        </div>
      </nav>

      {/* ── Main ─────────────────────────────────────────────── */}
      <main style={{ maxWidth: 860, margin: "0 auto", padding: "28px 24px" }}>

        {/* Stats strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 28 }}>
          {[
            { label: "MARKETS",              value: markets.markets.length },
            { label: "TOTAL VOLUME (STT)",   value: totalVol.toFixed(2) },
            { label: "RESOLVED BY AGENT",    value: markets.markets.filter(m => m.status === "Resolved").length },
          ].map(s => (
            <div key={s.label} style={{
              background: "var(--bg2)", border: "1px solid var(--border)",
              borderRadius: "var(--radius)", padding: "14px 16px",
            }}>
              <div style={{ fontSize: 10, color: "var(--text3)", letterSpacing: ".06em", marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontFamily: "var(--sans)", fontSize: 24, fontWeight: 600, color: "#a78bfa" }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Chain warning */}
        {wallet.address && !wallet.isCorrectChain && (
          <div style={{
            background: "#1a1500", border: "1px solid #3a2a00", borderRadius: "var(--radius)",
            padding: "10px 14px", fontSize: 12, color: "var(--amber)", marginBottom: 16,
          }}>
            ⚠ Wrong network — please switch to Somnia Testnet (chainId 50312)
          </div>
        )}

        {/* ── MARKETS VIEW ─────────────────────────────────── */}
        {view === "markets" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: "var(--text3)", letterSpacing: ".07em" }}>ALL MARKETS</div>
              <button onClick={() => markets.fetchAll()} style={{
                background: "none", border: "none", color: "var(--text3)", fontSize: 11,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
              }}>
                {markets.loading ? <Spinner size={10} /> : "↻"} refresh
              </button>
            </div>

            {markets.loading && markets.markets.length === 0 && (
              <div style={{ textAlign: "center", color: "var(--text3)", padding: "60px 0", fontSize: 12 }}>
                <Spinner size={20} /><br /><br />loading markets…
              </div>
            )}

            {!markets.loading && markets.markets.length === 0 && (
              <div style={{
                textAlign: "center", color: "var(--text3)", padding: "60px 0", fontSize: 12,
                background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)",
              }}>
                No markets yet.{" "}
                <span style={{ color: "var(--purple)", cursor: "pointer" }} onClick={() => setView("create")}>
                  Create the first one →
                </span>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {markets.markets.map(m => (
                <MarketCard key={m.id} market={m} onClick={() => { setSelected(m.id); setView("detail"); }} />
              ))}
            </div>
          </div>
        )}

        {/* ── DETAIL VIEW ──────────────────────────────────── */}
        {view === "detail" && currentMarket && (
          <MarketDetail
            market={currentMarket}
            signer={wallet.signer}
            address={wallet.address}
            onBack={goToMarkets}
            actions={markets}
            onToast={showToast}
          />
        )}

        {/* ── CREATE VIEW ──────────────────────────────────── */}
        {view === "create" && (
          <CreateMarket
            signer={wallet.signer}
            actions={markets}
            onSuccess={goToMarkets}
            onToast={showToast}
          />
        )}
      </main>

      {/* ── Toast ─────────────────────────────────────────── */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
