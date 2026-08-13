import { useEffect, useRef, useState } from "react";

/**
 * SEMEX — Liquid Glass toaster.
 *
 * A premium, restrained reimagining of the extension's real right-side toaster
 * (the one from toast-notifier-v2.js), grounded in the WEBSHARE reference:
 * dark frosted panels that slide in from the right, a colored icon tile, a
 * status title, a monospace detail line, and a small status badge. No cartoon
 * bounce — this is "liquid glass": layered translucency, a bright specular
 * top edge, soft inner light, and a subtle status-tinted glow.
 *
 * The sequence mirrors a real flow: STRIPE Bypass fires first, then the
 * CHARGED response toast lands underneath it.
 */

type ToastType =
  | "bypass"
  | "charged"
  | "live"
  | "dead"
  | "threeds"
  | "security";

interface ToastDef {
  id: number;
  type: ToastType;
  title: string;
  detail: string;
  detailMono?: boolean;
  badge: string;
  icon: string;
  /** base status hue used for tint, badge, icon tile, glow */
  rgb: string;
}

const TOASTS: ToastDef[] = [
  {
    id: 1,
    type: "bypass",
    title: "Stripe Bypass",
    detail: "Security · Header + 3DS",
    badge: "Bypass",
    icon: "bolt",
    rgb: "96, 165, 250",
  },
  {
    id: 2,
    type: "charged",
    title: "Charged — Stripe",
    detail: "sei_1U406TKecAf7OIPYmR0JmXLf",
    detailMono: true,
    badge: "Charged",
    icon: "check",
    rgb: "52, 211, 153",
  },
  {
    id: 3,
    type: "live",
    title: "Live — Stripe Invoice",
    detail: "Card approved · CVV match",
    badge: "Live",
    icon: "flame",
    rgb: "251, 191, 36",
  },
  {
    id: 4,
    type: "dead",
    title: "Dead — Stripe",
    detail: "card_declined · do_not_honor",
    detailMono: true,
    badge: "Dead",
    icon: "close",
    rgb: "248, 113, 113",
  },
];

function Glyph({ name, color }: { name: string; color: string }) {
  const common = {
    width: 17,
    height: 17,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: 2.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "bolt":
      return (
        <svg {...common} fill={color} stroke="none">
          <path d="M13 2 4.5 13.2c-.4.5 0 1.3.7 1.3H11l-1 7.5c-.1.7.8 1.1 1.3.5L19.5 10.8c.4-.5 0-1.3-.7-1.3H13l1-7.4c.1-.7-.8-1.1-1.3-.5Z" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <path d="m20 6-11 11-5-5" />
        </svg>
      );
    case "flame":
      return (
        <svg {...common}>
          <path d="M12 2c1 3.5-2 4.5-2 7a2 2 0 0 0 4 0c0-.6-.1-1.1-.3-1.6C16 9 18 11.5 18 15a6 6 0 0 1-12 0c0-4 3-6 6-13Z" />
        </svg>
      );
    case "close":
      return (
        <svg {...common}>
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 3 5 6v5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" />
        </svg>
      );
    default:
      return null;
  }
}

function ToastCard({
  t,
  index,
  visible,
}: {
  t: ToastDef;
  index: number;
  visible: boolean;
}) {
  return (
    <div
      style={{
        position: "relative",
        width: 372,
        borderRadius: 20,
        padding: "15px 16px",
        display: "flex",
        alignItems: "center",
        gap: 13,
        overflow: "hidden",
        // Liquid glass base: deep translucent charcoal with a status tint,
        // heavy blur, layered depth shadows + a faint status glow.
        background: `
          linear-gradient(135deg, rgba(${t.rgb}, 0.14) 0%, rgba(${t.rgb}, 0.02) 42%, rgba(18, 19, 26, 0) 100%),
          linear-gradient(180deg, rgba(24, 25, 33, 0.82) 0%, rgba(14, 15, 21, 0.9) 100%)
        `,
        backdropFilter: "blur(22px) saturate(160%)",
        WebkitBackdropFilter: "blur(22px) saturate(160%)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: `
          0 1px 0 0 rgba(255, 255, 255, 0.09) inset,
          0 18px 44px -18px rgba(0, 0, 0, 0.85),
          0 0 34px -14px rgba(${t.rgb}, 0.5)
        `,
        transform: visible ? "translateX(0)" : "translateX(26px)",
        opacity: visible ? 1 : 0,
        transition: `transform 0.5s cubic-bezier(0.22, 1, 0.36, 1) ${index * 110}ms, opacity 0.42s ease ${index * 110}ms`,
        cursor: "default",
      }}
    >
      {/* Specular top-left sheen — the liquid-glass highlight */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 20,
          background:
            "linear-gradient(115deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.03) 18%, rgba(255,255,255,0) 40%)",
          pointerEvents: "none",
          mixBlendMode: "screen",
        }}
      />

      {/* Icon tile */}
      <div
        style={{
          position: "relative",
          width: 40,
          height: 40,
          flex: "0 0 40px",
          borderRadius: 13,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `linear-gradient(160deg, rgba(${t.rgb}, 0.34), rgba(${t.rgb}, 0.12))`,
          border: `1px solid rgba(${t.rgb}, 0.4)`,
          boxShadow: `0 4px 14px -6px rgba(${t.rgb}, 0.8), 0 1px 0 0 rgba(255,255,255,0.14) inset`,
        }}
      >
        <Glyph name={t.icon} color={`rgb(${t.rgb})`} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 650,
            letterSpacing: "-0.01em",
            color: "rgba(255,255,255,0.96)",
            lineHeight: 1.25,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {t.title}
        </div>
        <div
          style={{
            marginTop: 3,
            fontSize: 11.5,
            fontWeight: 400,
            color: "rgba(255,255,255,0.5)",
            lineHeight: 1.3,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            fontFamily: t.detailMono
              ? "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, monospace"
              : "inherit",
            letterSpacing: t.detailMono ? "-0.02em" : "0",
          }}
        >
          {t.detail}
        </div>
      </div>

      {/* Status badge */}
      <div
        style={{
          flex: "0 0 auto",
          alignSelf: "flex-start",
          marginTop: 1,
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          color: `rgb(${t.rgb})`,
          padding: "3px 8px",
          borderRadius: 7,
          background: `rgba(${t.rgb}, 0.13)`,
          border: `1px solid rgba(${t.rgb}, 0.28)`,
        }}
      >
        {t.badge}
      </div>

      {/* SEMEX watermark */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          right: 11,
          bottom: 7,
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: "0.18em",
          color: "rgba(255,255,255,0.16)",
          fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
        }}
      >
        SEMEX
      </div>

      {/* Progress rail — thin, status colored */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 2,
          background: `linear-gradient(90deg, rgba(${t.rgb}, 0.85), rgba(${t.rgb}, 0.1))`,
          opacity: visible ? 1 : 0,
          transformOrigin: "left",
          animation: visible
            ? `sxrail 5.5s linear ${index * 130 + 400}ms forwards`
            : "none",
        }}
      />
    </div>
  );
}

export function LiquidGlassToasts() {
  const [visible, setVisible] = useState(false);
  const styleRef = useRef<HTMLStyleElement | null>(null);

  useEffect(() => {
    if (!styleRef.current) {
      const el = document.createElement("style");
      el.textContent = `@keyframes sxrail { from { transform: scaleX(1); } to { transform: scaleX(0); } }`;
      document.head.appendChild(el);
      styleRef.current = el;
    }
    const t = setTimeout(() => setVisible(true), 350);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        position: "relative",
        overflow: "hidden",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, system-ui, sans-serif",
        background: `
          radial-gradient(1100px 620px at 82% -6%, rgba(96,165,250,0.10), transparent 55%),
          radial-gradient(900px 640px at 4% 108%, rgba(52,211,153,0.06), transparent 55%),
          linear-gradient(160deg, #0b0c11 0%, #101118 55%, #0a0b0f 100%)
        `,
      }}
    >
      {/* faint grid texture */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
          backgroundSize: "46px 46px",
          maskImage:
            "radial-gradient(900px 600px at 70% 20%, black, transparent 80%)",
          pointerEvents: "none",
        }}
      />

      {/* Editorial label */}
      <div style={{ position: "absolute", left: 56, top: 92 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.42)",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#60a5fa",
              boxShadow: "0 0 10px 1px rgba(96,165,250,0.9)",
            }}
          />
          SEMEX · Liquid Glass
        </div>
        <h1
          style={{
            margin: "18px 0 0",
            fontSize: 52,
            lineHeight: 1.02,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            color: "#fff",
          }}
        >
          Every hit,
          <br />
          <span style={{ color: "rgba(255,255,255,0.42)" }}>
            crystal clear.
          </span>
        </h1>
        <p
          style={{
            margin: "20px 0 0",
            maxWidth: 340,
            fontSize: 14,
            lineHeight: 1.55,
            color: "rgba(255,255,255,0.5)",
          }}
        >
          Frosted status cards slide in from the right — the bypass confirms,
          the charge lands. Quiet, premium, unmistakable.
        </p>
      </div>

      {/* Toast stack — top right, matches the real extension anchor */}
      <div
        style={{
          position: "absolute",
          top: 22,
          right: 22,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          alignItems: "flex-end",
        }}
      >
        {TOASTS.map((t, i) => (
          <ToastCard key={t.id} t={t} index={i} visible={visible} />
        ))}
      </div>
    </div>
  );
}

export default LiquidGlassToasts;
