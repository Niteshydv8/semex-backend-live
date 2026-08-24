/**
 * SEMEX Overlay V4 — Visual Design Preview
 * Shows the redesigned compact overlay: settings panel, type badge,
 * 2-col detail grid. For review before shipping.
 */

export default function SemexOverlayPreview() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0a0a12 0%, #130c20 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 32,
      padding: 32,
      fontFamily: "ui-sans-serif, system-ui, 'Segoe UI', sans-serif",
    }}>
      {/* Full state (default) */}
      <div>
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", textAlign: "center", marginBottom: 10 }}>
          Full State (Active fill)
        </div>
        <OverlayFull showSettings={false} />
      </div>

      {/* Settings panel open */}
      <div>
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", textAlign: "center", marginBottom: 10 }}>
          Settings Panel Open
        </div>
        <OverlayFull showSettings={true} />
      </div>

      {/* Pill (minimized) */}
      <div>
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", textAlign: "center", marginBottom: 10 }}>
          Pill (Minimized)
        </div>
        <OverlayPill />
      </div>
    </div>
  );
}

const PURPLE = "#a855f7";
const PINK = "#ec4899";
const GREEN = "#34d399";
const BLUE = "#60a5fa";
const RED = "#f87171";
const BORDER = "rgba(200,120,255,0.18)";
const BORDER_HI = "rgba(200,120,255,0.42)";
const GLASS = "rgba(20,18,32,0.88)";
const SURFACE = "rgba(30,26,46,0.75)";

function OverlayFull({ showSettings }: { showSettings: boolean }) {
  return (
    <div style={{
      width: 320,
      background: "linear-gradient(160deg, rgba(20,20,28,0.95), rgba(12,12,18,0.98))",
      backdropFilter: "blur(28px) saturate(140%)",
      border: `1px solid ${BORDER}`,
      borderRadius: 18,
      boxShadow: "0 24px 64px -16px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.02) inset",
      overflow: "hidden",
      position: "relative",
    }}>
      {/* Ambient gradient */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `radial-gradient(600px 200px at -5% -5%, rgba(168,85,247,0.14), transparent 60%),
                     radial-gradient(600px 200px at 110% 110%, rgba(236,72,153,0.12), transparent 60%)`,
        zIndex: 0,
      }} />

      {/* Header */}
      <div style={{
        position: "relative", zIndex: 1,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px",
        borderBottom: `1px solid ${BORDER}`,
        background: "rgba(255,255,255,0.03)",
        cursor: "move",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 7,
            background: `linear-gradient(135deg, ${PURPLE}, ${PINK})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px rgba(168,85,247,0.4)",
            fontSize: 10, fontWeight: 800, color: "#fff",
          }}>S</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
            <span style={{
              fontWeight: 800, fontSize: 12, letterSpacing: "0.14em",
              background: `linear-gradient(90deg, #fff, #e9d5ff 60%, #fbcfe8)`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>SEMEX</span>
            <span style={{ fontSize: 8, color: "rgba(255,255,255,0.38)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Automation</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 5 }}>
          <HeaderBtn active={showSettings}>⚙</HeaderBtn>
          <HeaderBtn>−</HeaderBtn>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div style={{
          position: "relative", zIndex: 1,
          padding: "8px 14px 10px",
          borderBottom: `1px solid ${BORDER}`,
          background: "rgba(255,255,255,0.015)",
        }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgba(255,255,255,0.40)", marginBottom: 7 }}>
            Address Mode
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            <AddrBtn label="BIN" active />
            <AddrBtn label="IP / Proxy" />
            <AddrBtn label="Random" />
          </div>
        </div>
      )}

      {/* Body */}
      <div style={{ position: "relative", zIndex: 1, padding: "10px 12px 12px", display: "flex", flexDirection: "column", gap: 8 }}>

        {/* Status row */}
        <div style={{
          display: "flex", alignItems: "center", gap: 7,
          padding: "8px 11px", borderRadius: 10,
          background: "rgba(255,255,255,0.03)",
          border: `1px solid ${BORDER}`,
        }}>
          <span style={{ fontSize: 14 }}>⚡</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.88)", flex: "1 1 auto", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            Filling form...
          </span>
          {/* Type badge */}
          <span style={{
            flexShrink: 0,
            padding: "2px 7px", borderRadius: 5,
            background: "rgba(168,85,247,0.14)",
            border: "1px solid rgba(200,120,255,0.24)",
            color: "#c4b5fd", fontSize: 9, fontWeight: 700,
            letterSpacing: "0.08em", textTransform: "uppercase",
          }}>CHECKOUT</span>
        </div>

        {/* Stats grid */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6,
          padding: 8, background: "rgba(255,255,255,0.03)",
          border: `1px solid ${BORDER}`, borderRadius: 10,
        }}>
          <StatBox label="ATT" value="12" color="#fff" />
          <StatBox label="CHG" value="3" color={GREEN} />
          <StatBox label="LIVE" value="2" color={BLUE} />
          <StatBox label="DEAD" value="7" color={RED} />
        </div>

        {/* BIN switcher (compact) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ display: "flex", gap: 4 }}>
            <SegBtn label="BIN" active />
            <SegBtn label="CC" />
          </div>
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <div style={{
              flex: 1, display: "flex", alignItems: "center", gap: 7,
              padding: "7px 10px", borderRadius: 9,
              background: "rgba(20,18,32,0.72)", border: `1px solid ${BORDER}`,
              color: "#e9d5ff", fontSize: 11, fontWeight: 600,
              fontFamily: "'Courier New', monospace",
            }}>
              <span style={{ fontSize: 13 }}>💳</span>
              <span style={{ flex: 1 }}>411111 — Visa Credit</span>
              <span style={{ fontSize: 10, color: "rgba(200,120,255,0.65)" }}>▾</span>
            </div>
            <div style={{
              width: 34, height: 34, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(20,18,32,0.72)", border: `1px solid ${BORDER}`,
              borderRadius: 9, color: "rgba(200,120,255,0.8)", fontSize: 14, cursor: "pointer",
            }}>⇄</div>
          </div>
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <input
              readOnly
              placeholder="add new BIN (e.g. 424242)"
              style={{
                flex: 1, padding: "6px 10px",
                background: "rgba(10,8,18,0.65)", border: `1px solid rgba(200,120,255,0.18)`,
                borderRadius: 8, color: "#e9d5ff", fontSize: 11,
                fontFamily: "'Courier New', monospace", outline: "none",
              }}
            />
            <div style={{
              width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
              background: "linear-gradient(135deg, rgba(168,85,247,0.30), rgba(236,72,153,0.22))",
              border: "1px solid rgba(200,120,255,0.38)", borderRadius: 8,
              color: "#e9d5ff", fontSize: 15, cursor: "pointer",
            }}>＋</div>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: 6 }}>
          <button style={{
            flex: 1, padding: "9px 10px", border: "none", borderRadius: 9,
            background: `linear-gradient(135deg, ${GREEN}, #10b981)`,
            color: "#05130d", fontWeight: 700, fontSize: 12, cursor: "pointer",
            boxShadow: "0 6px 16px rgba(52,211,153,0.3)",
          }}>▶ Start</button>
          <CtrlBtn icon="⏸" color="rgba(251,191,36,0.14)" textColor="#fbbf24" border="rgba(251,191,36,0.28)" />
          <CtrlBtn icon="⏹" color="rgba(248,113,113,0.14)" textColor={RED} border="rgba(248,113,113,0.28)" />
          <CtrlBtn icon="🔒" color="rgba(255,255,255,0.06)" textColor="rgba(255,255,255,0.7)" border={BORDER} />
        </div>

        {/* Details section (at bottom after BIN switcher in real usage) */}
        <div style={{
          background: "rgba(0,0,0,0.22)", border: `1px solid ${BORDER}`,
          borderRadius: 10, padding: "8px 11px", fontSize: 11,
        }}>
          {/* Card row */}
          <DetailRow label="Card" value="4111 •••• •••• 1234" />
          {/* BIN row (shown when BIN lookup returns) */}
          <DetailRow label="BIN" value="VISA · CREDIT · US · JPMORGAN" />
          {/* 2-col grid */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr",
            gap: "1px 8px", marginTop: 4,
          }}>
            <GridCell label="Atts" value="4" />
            <GridCell label="Speed" value="6.8/min" />
            <GridCell label="Time" value="00:35" />
            <GridCell label="IP" value="45.xx.xx.12 · US" />
          </div>
        </div>
      </div>
    </div>
  );
}

function OverlayPill() {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 10,
      padding: "7px 13px 7px 7px", borderRadius: 999,
      background: "rgba(20,18,32,0.90)", backdropFilter: "blur(24px)",
      border: `1px solid ${BORDER}`,
      boxShadow: "0 12px 34px rgba(0,0,0,0.55)",
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: "50%",
        background: `linear-gradient(135deg, ${PURPLE}, ${PINK})`,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 4px 14px rgba(168,85,247,0.4)",
        fontSize: 11, fontWeight: 800, color: "#fff",
      }}>S</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{
          width: 7, height: 7, borderRadius: "50%",
          background: `linear-gradient(135deg, ${GREEN}, #6bffb8)`,
          boxShadow: "0 0 10px rgba(52,211,153,0.65)",
          animation: "pulse 1.5s infinite",
        }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: "#f5f5f7", whiteSpace: "nowrap" }}>Filling form #4</span>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        <PillBtn color={`linear-gradient(135deg, ${GREEN}, #10b981)`} textColor="#05130d">▶</PillBtn>
        <PillBtn color="rgba(248,113,113,0.18)" textColor={RED}>⏹</PillBtn>
        <PillBtn color="rgba(255,255,255,0.10)" textColor="rgba(255,255,255,0.8)">⤢</PillBtn>
      </div>
    </div>
  );
}

function HeaderBtn({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <div style={{
      width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center",
      borderRadius: 7, cursor: "pointer", fontSize: 11,
      background: active ? "rgba(168,85,247,0.18)" : "rgba(255,255,255,0.06)",
      border: `1px solid ${active ? "rgba(200,120,255,0.5)" : BORDER}`,
      color: active ? "#c4b5fd" : "rgba(255,255,255,0.7)",
    }}>{children}</div>
  );
}

function AddrBtn({ label, active }: { label: string; active?: boolean }) {
  return (
    <div style={{
      flex: 1, padding: "5px 0", textAlign: "center",
      border: `1px solid ${active ? "rgba(200,120,255,0.58)" : "rgba(200,120,255,0.20)"}`,
      borderRadius: 7, cursor: "pointer",
      background: active
        ? "linear-gradient(135deg, rgba(168,85,247,0.28), rgba(236,72,153,0.18))"
        : "rgba(20,18,32,0.50)",
      color: active ? "#e9d5ff" : "rgba(255,255,255,0.55)",
      fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
    }}>{label}</div>
  );
}

function SegBtn({ label, active }: { label: string; active?: boolean }) {
  return (
    <div style={{
      flex: 1, padding: "5px 0", textAlign: "center",
      border: `1px solid ${active ? "rgba(200,120,255,0.55)" : "rgba(200,120,255,0.20)"}`,
      borderRadius: 8, cursor: "pointer",
      background: active
        ? "linear-gradient(135deg, rgba(168,85,247,0.28), rgba(236,72,153,0.20))"
        : "rgba(20,18,32,0.55)",
      color: active ? "#e9d5ff" : "rgba(255,255,255,0.55)",
      fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const,
    }}>{label}</div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
      background: "rgba(0,0,0,0.28)", borderRadius: 8, padding: "5px 4px",
    }}>
      <span style={{ fontSize: 15, fontWeight: 700, color, fontFamily: "'SF Mono', ui-monospace, monospace" }}>{value}</span>
      <span style={{ fontSize: 8.5, color: "rgba(255,255,255,0.48)", letterSpacing: "0.06em", textTransform: "uppercase" as const }}>{label}</span>
    </div>
  );
}

function CtrlBtn({ icon, color, textColor, border }: { icon: string; color: string; textColor: string; border: string }) {
  return (
    <button style={{
      width: 36, height: 36, border: `1px solid ${border}`, borderRadius: 9,
      background: color, color: textColor, fontSize: 13, cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>{icon}</button>
  );
}

function PillBtn({ children, color, textColor }: { children: React.ReactNode; color: string; textColor: string }) {
  return (
    <div style={{
      width: 24, height: 24, borderRadius: "50%",
      background: color, color: textColor,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 10, cursor: "pointer",
    }}>{children}</div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "4px 0", borderBottom: "1px dashed rgba(200,120,255,0.09)",
      fontSize: 11,
    }}>
      <span style={{ color: "rgba(255,255,255,0.45)", textTransform: "uppercase" as const, fontSize: 10, letterSpacing: "0.05em" }}>{label}</span>
      <span style={{ color: "#fff", fontFamily: "'SF Mono', ui-monospace, monospace", fontSize: 10.5 }}>{value}</span>
    </div>
  );
}

function GridCell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "3px 0", borderBottom: "1px dashed rgba(200,120,255,0.07)",
      fontSize: 11,
    }}>
      <span style={{ color: "rgba(255,255,255,0.43)", textTransform: "uppercase" as const, fontSize: 9.5, letterSpacing: "0.05em" }}>{label}</span>
      <span style={{ color: "#e2e8f0", fontFamily: "'SF Mono', ui-monospace, monospace", fontSize: 10 }}>{value}</span>
    </div>
  );
}
