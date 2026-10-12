/* SEMEX overlay provenance — runs at document_start in the ISOLATED world,
   before any page script can build DOM. It CREATES the overlay root node
   itself and retains the reference: extension-owned provenance page JS cannot
   forge — a page-planted lookalike is a DIFFERENT node, and the containment
   check in content.js compares against this retained reference, never a
   selector. Because it is appended before the parser builds head/body, it is
   also first in document order, so overlay.js (MAIN world, document_idle)
   adopts THIS node via getElementById ahead of any static fake. Hidden and
   empty until populated, so non-checkout pages are unaffected; code that
   needs "is the overlay actually live" checks the data-semex-live attribute
   (set by overlay.js on populate), not mere existence. The write this guards
   only plants device-local BIN digits (cap 50, never synced) and additionally
   requires an unforgeable chrome.runtime message handled in the service
   worker. Globals here are shared with the extension's other isolated-world
   content scripts in this frame (not with page JS). */
var __semexPinnedOverlayRoot = null;
function __semexGetPinnedOverlayRoot() {
  try {
    if (__semexPinnedOverlayRoot && __semexPinnedOverlayRoot.isConnected) return __semexPinnedOverlayRoot;
  } catch (_0xePin) {}
  return null;
}
(function _semexCreateOverlayRoot() {
  try {
    if (window.top !== window) return; // the overlay renders in the top frame only
    if (document.getElementById("semex-overlay")) return; // never replace an existing node
    const _0xroot = document.createElement("div");
    _0xroot.id = "semex-overlay";
    _0xroot.style.display = "none";
    (document.documentElement || document).appendChild(_0xroot);
    __semexPinnedOverlayRoot = _0xroot;
  } catch (_0xeCreate) {}
})();
