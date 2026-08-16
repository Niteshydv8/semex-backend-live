// SEMEX v4.0.14 MOBILE FIT PASS — visual verification harness
// Renders the real overlay CSS + HTML at phone widths (360, 375, 412px)
// and the real toast notifier at those widths in iframes so what you
// see is pixel-identical to what renders on a checkout page at those
// viewport sizes.  Verifies:
//   • Speed "3.6 cards/min" visible, IPv6/BIN ellipsize inside panel
//   • BIN/CC seg-btn + binswitch controls ≥ 40px tap targets
//   • DEAD toast ≤ 236px wide; long decline text ellipsized
//   • Desktop (≥ 641px) rendering unchanged

export function MobileVerify() {
  return (
    <iframe
      src="/__mockup/mobile-verify/index.html"
      title="SEMEX v4.0.14 Mobile Fit Verification"
      style={{
        width: "100%",
        height: "100vh",
        border: 0,
        display: "block",
        background: "#07070d",
      }}
    />
  );
}

export default MobileVerify;
