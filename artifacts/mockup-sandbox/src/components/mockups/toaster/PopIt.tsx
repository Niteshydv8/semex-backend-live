import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ToastKind =
  | "bypass"
  | "charged"
  | "live"
  | "ccn_live"
  | "3d_live"
  | "dead"
  | "3ds"
  | "security"
  | "expired"
  | "info"
  | "warning"
  | "subscription";

type ToastItem = {
  id: number;
  kind: ToastKind;
};

const TOASTS: Record<
  ToastKind,
  { title: string; subtitle?: string; icon: string; background: string; panel: string; glow: string }
> = {
  bypass: { title: "STRIPE Bypass", subtitle: "Header + 3DS Activated", icon: "⚡", background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)", panel: "#3b82f6", glow: "rgba(59,130,246,.4)" },
  charged: { title: "CHARGED - STRIPE CHECKOUT", subtitle: "$129.99", icon: "✅", background: "linear-gradient(135deg, #064e3b 0%, #065f46 100%)", panel: "#10b981", glow: "rgba(16,185,129,.35)" },
  live: { title: "LIVE - STRIPE INVOICE", icon: "🔥", background: "linear-gradient(135deg, #451a03 0%, #78350f 100%)", panel: "#f59e0b", glow: "rgba(245,158,11,.3)" },
  ccn_live: { title: "LIVE - CARD DETAILS", subtitle: "CCN gateway ready", icon: "🔥", background: "linear-gradient(135deg, #451a03 0%, #78350f 100%)", panel: "#f59e0b", glow: "rgba(245,158,11,.3)" },
  "3d_live": { title: "3D LIVE - STRIPE", subtitle: "Authenticated session", icon: "🔐🔥", background: "linear-gradient(135deg, #451a03 0%, #78350f 100%)", panel: "#f59e0b", glow: "rgba(245,158,11,.3)" },
  dead: { title: "DEAD - STRIPE CHECKOUT", subtitle: "card_declined", icon: "✕", background: "linear-gradient(135deg, #1f0a0a 0%, #3b0f0f 100%)", panel: "#ef4444", glow: "rgba(239,68,68,.2)" },
  "3ds": { title: "3DS CHALLENGE", subtitle: "stripe.com", icon: "🛡", background: "linear-gradient(135deg, #1e1040 0%, #2e1065 100%)", panel: "#8b5cf6", glow: "rgba(139,92,246,.35)" },
  security: { title: "Security Check", subtitle: "Cloudflare detected", icon: "🔐", background: "linear-gradient(135deg, #1e1040 0%, #2e1065 100%)", panel: "#8b5cf6", glow: "rgba(139,92,246,.35)" },
  expired: { title: "SESSION EXPIRED", subtitle: "Please try again", icon: "○", background: "#111111", panel: "#6b7280", glow: "rgba(107,114,128,.22)" },
  info: { title: "Gateway updated", subtitle: "New route available", icon: "i", background: "linear-gradient(135deg, #102a43 0%, #164e63 100%)", panel: "#22d3ee", glow: "rgba(34,211,238,.3)" },
  warning: { title: "Proxy warning", subtitle: "Slow response detected", icon: "!", background: "linear-gradient(135deg, #422006 0%, #713f12 100%)", panel: "#facc15", glow: "rgba(250,204,21,.3)" },
  subscription: { title: "Subscription active", subtitle: "SEMEX Pro is ready", icon: "★", background: "linear-gradient(135deg, #2e1065 0%, #4c1d95 100%)", panel: "#a78bfa", glow: "rgba(167,139,250,.35)" },
};

const SEQUENCE: ToastKind[] = ["bypass", "charged", "live", "dead", "3ds", "security"];

function Particles({ id }: { id: number }) {
  const colors = ["#34d399", "#a7f3d0", "#fbbf24", "#f472b6", "#60a5fa", "#ffffff"];
  return (
    <div className="pointer-events-none absolute left-6 top-1/2 z-10 h-2 w-2">
      {Array.from({ length: 30 }, (_, index) => {
        const angle = (index / 30) * Math.PI * 2;
        const distance = 28 + ((index * 17) % 42);
        return (
          <i
            key={`${id}-${index}`}
            className="pop-particle absolute block rounded-full"
            style={{
              width: `${3 + (index % 4)}px`,
              height: `${3 + (index % 3)}px`,
              background: colors[index % colors.length],
              ["--x" as string]: `${Math.cos(angle) * distance}px`,
              ["--y" as string]: `${Math.sin(angle) * distance}px`,
              animationDelay: `${(index % 6) * 22}ms`,
            }}
          />
        );
      })}
    </div>
  );
}

export function PopIt() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const styleRef = useRef<HTMLStyleElement | null>(null);
  const sequenceIndex = useRef(0);
  const sequenceTimer = useRef<number | undefined>(undefined);

  const fire = useCallback((kind: ToastKind) => {
    const id = nextId.current++;
    setItems((current) => [...current.slice(-2), { id, kind }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    const run = () => {
      fire(SEQUENCE[sequenceIndex.current % SEQUENCE.length]);
      sequenceIndex.current += 1;
    };
    run();
    sequenceTimer.current = window.setInterval(run, 900);
    const reset = window.setInterval(() => {
      sequenceIndex.current = 0;
      setItems([]);
      run();
    }, 10000);
    return () => {
      window.clearInterval(sequenceTimer.current);
      window.clearInterval(reset);
    };
  }, [fire]);

  const renderedItems = useMemo(() => items.slice(-3), [items]);

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#0c0a14] text-white" style={{ backgroundImage: "radial-gradient(circle at 86% 12%, rgba(86,43,145,.16), transparent 30%), radial-gradient(circle at 12% 88%, rgba(14,116,144,.08), transparent 28%)" }}>
      <style ref={styleRef}>{`
        @keyframes popIn { 0% { opacity:0; transform:translate3d(24px,0,0) scale(.6) } 62% { opacity:1; transform:translate3d(0,0,0) scale(1.12) } 100% { opacity:1; transform:translate3d(0,0,0) scale(1) } }
        @keyframes popOut { to { opacity:0; transform:translate3d(40px,0,0) scale(.9) } }
        @keyframes progress { from { transform:scaleX(1) } to { transform:scaleX(0) } }
        @keyframes dashPulse { 0%,100% { opacity:1 } 50% { opacity:.4 } }
        @keyframes iconPulse { 0%,100% { transform:scale(1) } 50% { transform:scale(1.13) } }
        @keyframes particle { 0% { opacity:0; transform:translate(0,0) rotate(0deg) scale(.5) } 18% { opacity:1 } 100% { opacity:0; transform:translate(var(--x),var(--y)) rotate(150deg) scale(1) } }
        .pop-toast { animation: popIn 380ms cubic-bezier(.34,1.56,.64,1) both; }
        .pop-toast.is-bypass { border:2px dashed #3b82f6; animation: popIn 380ms cubic-bezier(.34,1.56,.64,1) both, dashPulse 1.2s ease-in-out 380ms infinite; }
        .pop-progress { animation:progress 3.8s linear both; transform-origin:right center; }
        .pop-particle { animation:particle .8s cubic-bezier(.2,.8,.3,1) both; }
        .pop-security { animation:iconPulse 1.35s ease-in-out infinite; }
      `}</style>

      <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
      <section className="relative mx-auto flex min-h-[100dvh] max-w-6xl flex-col justify-center px-6 py-16 sm:px-10">
        <div className="max-w-xl">
          <div className="mb-7 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[.28em] text-violet-300/75"><span className="h-2 w-2 rounded-full bg-violet-400 shadow-[0_0_18px_#8b5cf6]" /> SEMEX v3 / notification lab</div>
          <h1 className="text-5xl font-black leading-[.9] tracking-[-.06em] text-violet-50 sm:text-7xl">Small signal.<br /><span className="text-violet-400">Big pop.</span></h1>
          <p className="mt-7 max-w-sm text-sm leading-6 text-slate-400">A live preview of the extension’s new status language. Every event lands with a little momentum.</p>
          <div className="mt-12 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[.22em] text-slate-500"><span className="h-px w-10 bg-violet-500/50" /> live animation / 10s loop</div>
        </div>
      </section>

      <aside className="fixed right-4 top-4 z-20 flex w-[min(390px,calc(100vw-32px))] flex-col gap-3 sm:right-7 sm:top-7">
        {renderedItems.map((item) => {
          const data = TOASTS[item.kind];
          const isSecurity = item.kind === "security";
          return (
            <div key={item.id} className={`pop-toast relative isolate min-h-[76px] overflow-hidden rounded-[18px] border border-white/10 shadow-2xl ${item.kind === "bypass" ? "is-bypass" : ""}`} style={{ background: data.background, boxShadow: `0 18px 45px rgba(0,0,0,.34), 0 0 26px ${data.glow}` }}>
              {item.kind === "charged" && <Particles id={item.id} />}
              <div className="absolute inset-y-0 left-0 flex w-16 items-center justify-center" style={{ background: `linear-gradient(90deg, ${data.panel}, ${data.panel}d9)`, boxShadow: `8px 0 24px ${data.glow}` }}>
                <span className={`flex h-10 w-10 items-center justify-center rounded-[13px] bg-black/10 text-[20px] leading-none ${isSecurity ? "pop-security" : ""}`}>{data.icon}</span>
              </div>
              <div className="relative flex min-h-[76px] items-center pl-[84px] pr-10">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-black uppercase tracking-[.035em] text-white">{data.title}</p>
                  {data.subtitle && <p className="mt-1 truncate text-[12px] font-medium text-white/60">{data.subtitle}</p>}
                </div>
                <button onClick={() => dismiss(item.id)} aria-label="Dismiss notification" className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full text-sm leading-none text-white/45 transition hover:bg-white/10 hover:text-white">×</button>
                <span className="absolute bottom-[4px] right-[4px] text-[10px] font-black leading-none tracking-wider text-violet-300/70">SX</span>
              </div>
              <div className="pop-progress absolute bottom-0 left-0 h-[3px] w-full" style={{ background: data.panel }} />
            </div>
          );
        })}
      </aside>
    </main>
  );
}