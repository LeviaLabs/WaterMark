// Watermark: floating data panel that can be dragged, stowed to an edge tab, or closed.
// Drag by the gauge strip in the header (mouse, touch or arrow keys). Double-click it to reset.

export function setupPanel({ panel, handle, stowBtn, closeBtn, stowTab, reopenBtn }) {
  const KEY = "wm-panel";
  const mobile = () => matchMedia("(max-width: 700px)").matches;
  let state = { mode: "open", x: null, y: null };
  try { state = { ...state, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };

  function clamp() {
    if (mobile() || state.x == null) return;
    const r = panel.getBoundingClientRect();
    const maxX = innerWidth - Math.min(r.width, innerWidth) ;
    const maxY = innerHeight - 48; // keep the header reachable
    state.x = Math.max(0, Math.min(state.x, maxX));
    state.y = Math.max(0, Math.min(state.y, maxY));
  }
  function place() {
    if (mobile() || state.x == null) {
      panel.style.left = ""; panel.style.top = ""; panel.style.right = "";
      return;
    }
    clamp();
    panel.style.left = state.x + "px";
    panel.style.top = state.y + "px";
    panel.style.right = "auto";
  }
  function setMode(mode) {
    state.mode = mode;
    panel.hidden = mode !== "open";
    stowTab.hidden = mode !== "stowed";
    reopenBtn.hidden = mode !== "closed";
    reopenBtn.setAttribute("aria-pressed", "false");
    save();
    if (mode === "open") { place(); panel.querySelector(".panel-handle").focus({ preventScroll: true }); }
    if (mode === "stowed") stowTab.focus({ preventScroll: true });
    if (mode === "closed") reopenBtn.focus({ preventScroll: true });
  }

  // Pointer drag
  let drag = null;
  handle.addEventListener("pointerdown", (e) => {
    if (mobile() || e.button !== 0) return;
    const r = panel.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener("pointermove", (e) => {
    if (!drag) return;
    state.x = e.clientX - drag.dx;
    state.y = e.clientY - drag.dy;
    place();
  });
  const end = () => { if (drag) { drag = null; save(); } };
  handle.addEventListener("pointerup", end);
  handle.addEventListener("pointercancel", end);
  handle.addEventListener("dblclick", () => { state.x = state.y = null; place(); save(); });

  // Keyboard drag
  handle.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 60 : 20;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d || mobile()) return;
    e.preventDefault();
    const r = panel.getBoundingClientRect();
    state.x = (state.x ?? r.left) + d[0];
    state.y = (state.y ?? r.top) + d[1];
    place(); save();
  });

  stowBtn.addEventListener("click", () => setMode("stowed"));
  closeBtn.addEventListener("click", () => setMode("closed"));
  stowTab.addEventListener("click", () => setMode("open"));
  reopenBtn.addEventListener("click", () => setMode("open"));
  addEventListener("resize", place);

  // Restore without stealing focus on load.
  panel.hidden = state.mode !== "open";
  stowTab.hidden = state.mode !== "stowed";
  reopenBtn.hidden = state.mode !== "closed";
  place();

  return { open: () => { if (state.mode !== "open") setMode("open"); } };
}
