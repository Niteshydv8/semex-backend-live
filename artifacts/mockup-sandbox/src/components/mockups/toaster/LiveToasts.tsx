// SEMEX toaster preview — wraps the REAL content script (public/toast/toast-notifier-v2.js)
// so what renders here is pixel-identical to what users see on checkout pages.
export function LiveToasts() {
  return (
    <iframe
      src="/__mockup/toast/preview.html"
      title="SEMEX toaster live preview"
      style={{
        width: "100%",
        height: "100vh",
        border: 0,
        display: "block",
        background: "#0b0714",
      }}
    />
  );
}
