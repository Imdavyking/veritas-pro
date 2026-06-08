// src/components/ui.jsx
// ─────────────────────────────────────────────────────────────
//  Shared UI primitives
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";

// ── Button ────────────────────────────────────────────────────
export function Button({ children, variant = "primary", disabled, loading, onClick, style, ...rest }) {
  const base = {
    border: "none", borderRadius: "var(--radius-sm)", padding: "9px 18px",
    fontSize: "12px", fontFamily: "var(--mono)", cursor: disabled || loading ? "not-allowed" : "pointer",
    opacity: disabled || loading ? 0.4 : 1, transition: "background .15s, opacity .15s",
    display: "inline-flex", alignItems: "center", gap: "6px",
  };
  const variants = {
    primary:   { background: "var(--purple)", color: "#fff" },
    secondary: { background: "transparent", color: "var(--text2)", border: "1px solid var(--border2)" },
    ghost:     { background: "transparent", color: "var(--text3)", border: "none" },
    danger:    { background: "var(--red-dim)", color: "var(--red)", border: "1px solid #3a1010" },
  };
  return (
    <button style={{ ...base, ...variants[variant], ...style }}
      disabled={disabled || loading} onClick={onClick} {...rest}>
      {loading && <Spinner size={12} />}
      {children}
    </button>
  );
}

// ── Input ─────────────────────────────────────────────────────
export function Input({ label, hint, ...props }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      {label && <label style={{ fontSize: "10px", color: "var(--text3)", letterSpacing: ".05em" }}>{label}</label>}
      <input style={{
        background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
        padding: "9px 12px", color: "var(--text)", fontSize: "12px", outline: "none",
        width: "100%", transition: "border-color .15s",
      }}
        onFocus={e  => e.target.style.borderColor = "var(--purple)"}
        onBlur={e   => e.target.style.borderColor = "var(--border)"}
        {...props}
      />
      {hint && <div style={{ fontSize: "10px", color: "var(--text3)" }}>{hint}</div>}
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────
export function Card({ children, style, onClick, hover = true }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{
        background: "var(--bg2)", border: `1px solid ${hovered && hover && onClick ? "var(--border2)" : "var(--border)"}`,
        borderRadius: "var(--radius)", padding: "20px",
        cursor: onClick ? "pointer" : "default",
        transition: "border-color .2s",
        ...style,
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </div>
  );
}

// ── Tag / Badge ───────────────────────────────────────────────
export function Tag({ children, color = "#6b7280", style }) {
  return (
    <span style={{
      display: "inline-block", fontSize: "10px", padding: "2px 8px",
      borderRadius: "4px", letterSpacing: ".05em",
      background: color + "22", color,
      ...style,
    }}>
      {children}
    </span>
  );
}

// ── Pool bar ──────────────────────────────────────────────────
export function PoolBar({ yesPct, height = 4 }) {
  return (
    <div style={{ height, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
      <div style={{
        height: "100%", width: `${yesPct}%`,
        background: "linear-gradient(90deg, var(--purple), var(--green))",
        borderRadius: 2, transition: "width .5s",
      }} />
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────
export function Spinner({ size = 16, color = "currentColor" }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      border: `2px solid transparent`,
      borderTopColor: color,
      animation: "spin 0.7s linear infinite",
      flexShrink: 0,
    }} />
  );
}

// ── Divider ───────────────────────────────────────────────────
export function Divider({ style }) {
  return <hr style={{ border: "none", borderTop: "1px solid var(--border)", ...style }} />;
}

// ── Toast ─────────────────────────────────────────────────────
export function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [message, onDone]);

  return (
    <div style={{
      position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
      background: "#131320", border: "1px solid var(--border2)", borderRadius: "var(--radius)",
      padding: "10px 18px", fontSize: "12px", color: "#a78bfa",
      animation: "fadeUp .2s ease", zIndex: 999,
      maxWidth: 420, textAlign: "center", whiteSpace: "pre-wrap",
    }}>
      {message}
    </div>
  );
}

// ── SectionLabel ─────────────────────────────────────────────
export function SectionLabel({ children, style }) {
  return (
    <div style={{ fontSize: "10px", color: "var(--text3)", letterSpacing: ".07em", marginBottom: 12, ...style }}>
      {children}
    </div>
  );
}

// ── LiveDot ───────────────────────────────────────────────────
export function LiveDot({ color = "var(--green)" }) {
  return (
    <span style={{
      display: "inline-block", width: 5, height: 5, borderRadius: "50%",
      background: color, animation: "pulse 2s infinite",
    }} />
  );
}
