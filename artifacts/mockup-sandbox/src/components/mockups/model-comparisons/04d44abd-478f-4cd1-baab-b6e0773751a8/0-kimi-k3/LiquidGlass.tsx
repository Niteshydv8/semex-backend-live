import { useEffect, useRef, useState } from "react";

/* ============================================================
   SEMEX — Liquid Glass Toaster (v3 concept)
   Direction: static, professional, right-side slide-in.
   No bounce, no pop. Real glass: blur + saturate, specular top
   edge, inner refraction sheen, ambient colored shadow.
   Flow mirrors the reference: STRIPE Bypass fires first,
   then the response toast lands with a detail chart
   (GATEWAY / RESPONSE / CARD / TIME).
   ============================================================ */

type ToastKind = "bypass" | "charged" | "live" | "dead" | "ds3";

interface DetailRow {
  label: string;
  value: string;
  tone?: "default" | "good" | "bad" | "warn" | "monoGood" | "monoBad" | "monoWarn" | "mono";
}

interface ToastMeta {
  accent: string;
  glow: string;
  glyph: string;
  title: string;
  sub?: string;
  hitting?: boolean;
  rows?: DetailRow[];
}

interface ToastItem {
  id: number;
  kind: ToastKind;
  leaving: boolean;
}

const META: Record<ToastKind, ToastMeta> = {
  bypass: {
    accent: "#60a5fa",
    glow: "rgba(96,165,250,0.30)",
    glyph: "⚡",
    title: "STRIPE Bypass",
    sub: "Request Intercepted",
    hitting: true,
  },
  charged: {
    accent: "#34d399",
    glow: "rgba(52,211,153,0.28)",
    glyph: "✓",
    title: "CHARGED",
    rows: [
      { label: "GATEWAY", value: "Stripe Checkout" },
      { label: "RESPONSE", value: "Payment successful", tone: "good" },
      { label: "CARD", value: "4242424242424560|02|2029|599", tone: "monoGood" },
      { label: "TIME", value: "2.45s" },
    ],
  },
  live: {
    accent: "#fbbf24",
    glow: "rgba(251,191,36,0.26)",
    glyph: "●",
    title: "LIVE",
    rows: [
      { label: "GATEWAY", value: "Stripe Invoice" },
      { label: "RESPONSE", value: "Card live — CVV match", tone: "warn" },
      { label: "CARD", value: "5555553444441108|11|2030|314", tone: "monoWarn" },
      { label: "TIME", value: "1.87s" },
    ],
  },
  dead: {
    accent: "#f87171",
    glow: "rgba(248,113,113,0.24)",
    glyph: "✕",
    title: "DEAD",
    rows: [
      { label: "GATEWAY", value: "Stripe Checkout" },
      { label: "RESPONSE", value: "card_declined", tone: "bad" },
      { label: "CARD", value: "4242424242420002|04|2028|212", tone: "monoBad" },
      { label: "TIME", value: "3.12s" },
    ],
  },
  ds3: {
    accent: "#a78bfa",
    glow: "rgba(167,139,250,0.28)",
    glyph: "🛡",
    title: "3DS CHALLENGE",
    rows: [
      { label: "GATEWAY", value: "stripe.com" },
      { label: "RESPONSE", value: "Authentication window opened" },
      { label: "TIME", value: "0.94s" },
    ],
  },
};

const TONE_COLOR: Record<string, string> = {
  default: "rgba(255,255,255,0.88)",
  good: "#34d399",
  bad: "#f87171",
  warn: "#fbbf24",
  monoGood: "#34d399",
  monoBad: "#f87171",
  monoWarn: "#fbbf24",
  mono: "rgba(255,255,255,0.8)",
};

const HOLD_MS = 6200;

function ToastCard({ toast, onClose }: { toast: ToastItem; onClose: (id: number) => void }) {
  const m = META[toast.kind];
  const isMono = (t?: string) => t && t.startsWith("mono");
  return (
    <div
      className={`tlg-toast ${toast.leaving ? "tlg-leaving" : ""}`}
      style={{ ["--tlg-accent" as string]: m.accent, ["--tlg-glow" as string]: m.glow }}
      role="status"
    >
      {/* refraction sheen */}
      <div className="tlg-sheen" aria-hidden="true" />
      {/* icon plate */}
      <div className="tlg-icon" aria-hidden="true">
        <span>{m.glyph}</span>
      </div>
      {/* body */}
      <div className="tlg-body">
        <div className="tlg-titleRow">
          <span className="tlg-dot" />
          <span className="tlg-title">{m.title}</span>
        </div>
        {m.sub && <div className="tlg-sub">{m.sub}</div>}
        {m.hitting && (
          <div className="tlg-hitting">
            Hitting
            <span className="tlg-ell"><i>.</i><i>.</i><i>.</i></span>
          </div>
        )}
        {m.rows && (
          <div className="tlg-chart">
            {m.rows.map((r) => (
              <div className="tlg-row" key={r.label}>
                <span className="tlg-label">{r.label}</span>
                <span
                  className="tlg-value"
                  style={{
                    color: TONE_COLOR[r.tone || "default"],
                    fontFamily: isMono(r.tone) ? "ui-monospace, SFMono-Regular, Menlo, monospace" : undefined,
                    fontSize: isMono(r.tone) ? 11.5 : 12.5,
                    letterSpacing: isMono(r.tone) ? "0.2px" : undefined,
                  }}
                >
                  {r.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* close */}
      <button className="tlg-close" aria-label="Dismiss" onClick={() => onClose(toast.id)}>
        ×
      </button>
      {/* brand watermark */}
      <span className="tlg-brand" aria-hidden="true">SX</span>
      {/* progress */}
      <div className="tlg-barTrack">
        <div className="tlg-bar" style={{ animationDuration: `${HOLD_MS}ms` }} />
      </div>
    </div>
  );
}

export function LiquidGlass() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const dismiss = (id: number) => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 340);
    };
    const push = (kind: ToastKind, delay: number) => {
      const t = window.setTimeout(() => {
        const id = ++idRef.current;
        setToasts((prev) => [...prev, { id, kind, leaving: false }].slice(-3));
        const d = window.setTimeout(() => dismiss(id), HOLD_MS);
        timers.current.push(d);
      }, delay);
      timers.current.push(t);
    };

    const cycles: [ToastKind, ToastKind][] = [
      ["bypass", "charged"],
      ["bypass", "live"],
      ["bypass", "dead"],
      ["ds3", "charged"],
    ];
    let i = 0;
    const run = () => {
      const [first, second] = cycles[i % cycles.length];
      push(first, 500);
      push(second, 1900); // response lands after the bypass — the reference flow
      i++;
    };
    run();
    const loop = window.setInterval(run, 11000);
    return () => {
      window.clearInterval(loop);
      timers.current.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  const close = (id: number) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 340);
  };

  return (
    <div className="tlg-stage">
      <style>{CSS}</style>

      {/* ---- fake checkout backdrop for context ---- */}
      <div className="tlg-bgGlow1" aria-hidden="true" />
      <div className="tlg-bgGlow2" aria-hidden="true" />

      <div className="tlg-checkout" aria-hidden="true">
        <div className="tlg-coBrand">
          <div className="tlg-coLogo">S</div>
          <div>
            <div className="tlg-coName">Aurelia Studio</div>
            <div className="tlg-coSub">Subscription — Pro Plan</div>
          </div>
        </div>
        <div className="tlg-coAmount">$129.99</div>
        <div className="tlg-coField">
          <label>Email</label>
          <div className="tlg-coInput tlg-coFilled">r.mercer@protonmail.com</div>
        </div>
        <div className="tlg-coField">
          <label>Card information</label>
          <div className="tlg-coInput tlg-coFilled tlg-coMono">4242 4242 4242 4560</div>
          <div className="tlg-coSplit">
            <div className="tlg-coInput tlg-coFilled tlg-coMono">02 / 29</div>
            <div className="tlg-coInput tlg-coFilled tlg-coMono">599</div>
          </div>
        </div>
        <div className="tlg-coField">
          <label>Name on card</label>
          <div className="tlg-coInput tlg-coFilled">Rowan Mercer</div>
        </div>
        <div className="tlg-coPay">Pay $129.99</div>
        <div className="tlg-coFoot">Powered by <b>stripe</b></div>
      </div>

      {/* ---- toast stack: top-right, static slide from the right ---- */}
      <div className="tlg-stack">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onClose={close} />
        ))}
      </div>

      <div className="tlg-caption">
        SEMEX · Liquid Glass toaster — bypass fires first, response lands with the full chart · replays every 11s
      </div>
    </div>
  );
}

const CSS = `
  .tlg-stage {
    position: relative;
    width: 100%;
    height: 100vh;
    overflow: hidden;
    background:
      radial-gradient(1100px 620px at 82% -10%, rgba(139,92,246,0.16), transparent 62%),
      radial-gradient(820px 560px at 4% 108%, rgba(96,165,250,0.10), transparent 60%),
      #0b0912;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .tlg-stage * { box-sizing: border-box; margin: 0; padding: 0; }

  .tlg-bgGlow1 {
    position: absolute; width: 560px; height: 560px; border-radius: 50%;
    right: -140px; top: -160px; filter: blur(10px);
    background: radial-gradient(circle, rgba(139,92,246,0.14), transparent 65%);
    pointer-events: none;
  }
  .tlg-bgGlow2 {
    position: absolute; width: 480px; height: 480px; border-radius: 50%;
    left: -160px; bottom: -180px;
    background: radial-gradient(circle, rgba(52,211,153,0.07), transparent 65%);
    pointer-events: none;
  }

  /* ---------- fake checkout ---------- */
  .tlg-checkout {
    position: absolute; left: 7%; top: 50%; transform: translateY(-50%);
    width: 380px; border-radius: 18px; padding: 26px 26px 20px;
    background: rgba(255,255,255,0.035);
    border: 1px solid rgba(255,255,255,0.08);
    opacity: 0.8;
  }
  .tlg-coBrand { display: flex; align-items: center; gap: 12px; margin-bottom: 4px; }
  .tlg-coLogo {
    width: 34px; height: 34px; border-radius: 9px; display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, #7c3aed, #4f46e5); color: #fff; font-weight: 700; font-size: 16px;
  }
  .tlg-coName { color: rgba(255,255,255,0.9); font-size: 13.5px; font-weight: 600; }
  .tlg-coSub { color: rgba(255,255,255,0.4); font-size: 11.5px; margin-top: 1px; }
  .tlg-coAmount { color: #fff; font-size: 30px; font-weight: 650; margin: 14px 0 20px; letter-spacing: -0.5px; }
  .tlg-coField { margin-bottom: 14px; }
  .tlg-coField label { display: block; color: rgba(255,255,255,0.45); font-size: 11.5px; margin-bottom: 6px; }
  .tlg-coInput {
    border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 10px 12px;
    color: rgba(255,255,255,0.85); font-size: 13px; background: rgba(255,255,255,0.03);
  }
  .tlg-coMono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; }
  .tlg-coSplit { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
  .tlg-coSplit .tlg-coInput:first-child { border-radius: 0 0 0 8px; border-top: none; }
  .tlg-coSplit .tlg-coInput:last-child { border-radius: 0 0 8px 0; border-top: none; border-left: none; }
  .tlg-coField .tlg-coInput.tlg-coMono:first-of-type { border-radius: 8px 8px 0 0; }
  .tlg-coPay {
    margin-top: 18px; border-radius: 9px; padding: 12px; text-align: center;
    background: #635bff; color: #fff; font-size: 13.5px; font-weight: 600;
  }
  .tlg-coFoot { text-align: center; color: rgba(255,255,255,0.3); font-size: 11px; margin-top: 14px; }
  .tlg-coFoot b { color: rgba(255,255,255,0.5); font-weight: 600; }

  /* ---------- toast stack ---------- */
  .tlg-stack {
    position: absolute; top: 22px; right: 22px;
    display: flex; flex-direction: column; gap: 12px;
    width: 352px; max-width: calc(100vw - 44px);
  }

  /* ---------- the liquid glass toast ---------- */
  .tlg-toast {
    position: relative;
    display: flex; align-items: flex-start; gap: 12px;
    padding: 14px 16px 16px 14px;
    border-radius: 16px;
    overflow: hidden;
    cursor: default;

    /* liquid glass body */
    background:
      linear-gradient(165deg, rgba(255,255,255,0.105) 0%, rgba(255,255,255,0.045) 42%, rgba(255,255,255,0.02) 100%),
      rgba(16,14,24,0.55);
    backdrop-filter: blur(22px) saturate(170%);
    -webkit-backdrop-filter: blur(22px) saturate(170%);
    border: 1px solid rgba(255,255,255,0.13);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.22),
      inset 0 -1px 0 rgba(0,0,0,0.3),
      inset 1px 0 0 rgba(255,255,255,0.05),
      0 22px 44px -14px rgba(0,0,0,0.7),
      0 4px 14px -4px rgba(0,0,0,0.5),
      0 0 36px -8px var(--tlg-glow);

    animation: tlg-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .tlg-toast.tlg-leaving {
    animation: tlg-out 0.32s cubic-bezier(0.4, 0, 0.6, 1) both;
  }
  /* diagonal refraction band */
  .tlg-sheen {
    position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.055) 44%, rgba(255,255,255,0.015) 52%, transparent 62%);
  }
  /* ambient accent wash from the left edge */
  .tlg-toast::before {
    content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
    background: linear-gradient(180deg, var(--tlg-accent), color-mix(in srgb, var(--tlg-accent) 35%, transparent));
    box-shadow: 0 0 14px var(--tlg-glow);
    border-radius: 3px 0 0 3px;
  }

  .tlg-icon {
    flex: 0 0 auto;
    width: 34px; height: 34px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px;
    color: var(--tlg-accent);
    background: color-mix(in srgb, var(--tlg-accent) 14%, rgba(255,255,255,0.03));
    border: 1px solid color-mix(in srgb, var(--tlg-accent) 30%, transparent);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.14),
      0 0 16px -4px var(--tlg-glow);
  }

  .tlg-body { flex: 1; min-width: 0; }
  .tlg-titleRow { display: flex; align-items: center; gap: 8px; }
  .tlg-dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--tlg-accent);
    box-shadow: 0 0 10px var(--tlg-accent);
  }
  .tlg-title {
    color: #fff; font-size: 13.5px; font-weight: 650; letter-spacing: 0.35px;
  }
  .tlg-sub { color: rgba(255,255,255,0.5); font-size: 12px; margin-top: 3px; }
  .tlg-hitting {
    color: #60a5fa; font-size: 11px; margin-top: 7px;
    display: flex; align-items: baseline; gap: 2px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    animation: tlg-hitpulse 1.6s ease-in-out infinite;
  }
  @keyframes tlg-hitpulse { 0%, 100% { opacity: 0.45; } 50% { opacity: 1; } }
  .tlg-ell i { font-style: normal; animation: tlg-dot 1.4s infinite; }
  .tlg-ell i:nth-child(2) { animation-delay: 0.2s; }
  .tlg-ell i:nth-child(3) { animation-delay: 0.4s; }
  @keyframes tlg-dot { 0%, 60%, 100% { opacity: 0.2; } 30% { opacity: 1; } }

  /* ---------- detail chart ---------- */
  .tlg-chart {
    margin-top: 10px; padding-top: 9px;
    border-top: 1px solid rgba(255,255,255,0.09);
    display: flex; flex-direction: column; gap: 5px;
  }
  .tlg-row { display: flex; align-items: baseline; gap: 10px; }
  .tlg-label {
    flex: 0 0 74px;
    color: rgba(255,255,255,0.38);
    font-size: 9.5px; font-weight: 650; letter-spacing: 1.2px;
  }
  .tlg-value { font-size: 12.5px; font-weight: 500; word-break: break-all; }

  /* ---------- close / brand / progress ---------- */
  .tlg-close {
    position: absolute; top: 9px; right: 10px;
    width: 20px; height: 20px; border: none; border-radius: 6px;
    background: transparent; color: rgba(255,255,255,0.35);
    font-size: 14px; line-height: 1; cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .tlg-close:hover { background: rgba(255,255,255,0.09); color: #fff; }

  .tlg-brand {
    position: absolute; right: 12px; bottom: 8px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 8.5px; font-weight: 700; letter-spacing: 1.6px;
    color: rgba(167,139,250,0.55);
    pointer-events: none;
  }

  .tlg-barTrack {
    position: absolute; left: 0; right: 0; bottom: 0; height: 2.5px;
    background: rgba(255,255,255,0.05);
  }
  .tlg-bar {
    height: 100%; width: 100%;
    background: linear-gradient(90deg, var(--tlg-accent), color-mix(in srgb, var(--tlg-accent) 60%, #fff));
    transform-origin: left;
    animation: tlg-bar linear forwards;
    box-shadow: 0 0 8px var(--tlg-glow);
  }

  /* ---------- motion: static, no bounce ---------- */
  @keyframes tlg-in {
    from { opacity: 0; transform: translateX(56px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes tlg-out {
    to { opacity: 0; transform: translateX(32px); }
  }
  @keyframes tlg-bar {
    from { transform: scaleX(1); }
    to   { transform: scaleX(0); }
  }

  .tlg-caption {
    position: absolute; left: 24px; bottom: 18px;
    color: rgba(255,255,255,0.3); font-size: 11px; letter-spacing: 0.3px;
  }

  @media (max-width: 900px) {
    .tlg-checkout { display: none; }
  }
  @media (max-width: 480px) {
    .tlg-stack { left: 50%; right: auto; transform: translateX(-50%); top: 14px; width: min(352px, calc(100vw - 24px)); }
    .tlg-caption { display: none; }
  }
`;
