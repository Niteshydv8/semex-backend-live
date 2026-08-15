// SEMEX v4.0.11 PC PROPORTION PASS — visual verification
// Renders the real overlay CSS + HTML in all states inside iframes
// so what you see is pixel-identical to what renders on a checkout page.

export function OverlayVerify() {
  return (
    <iframe
      src="/__mockup/overlay-verify/index.html"
      title="SEMEX Overlay v4.0.11 Visual Verification"
      style={{
        width: "100%",
        height: "100vh",
        border: 0,
        display: "block",
        background: "#08080e",
      }}
    />
  );
}

export default OverlayVerify;
