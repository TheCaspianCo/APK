import * as E from "./engine.js";

// ------------------------------------------------------------------ icons
const IC = {
  open: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  save: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
  menu: '<circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/>',
  select: '<path d="M5 3l14 8-6 2-2 6z"/>',
  edit: '<path d="M4 20l4-1L19 8a2.1 2.1 0 0 0-3-3L5 16z"/><path d="M14 7l3 3"/>',
  text: '<path d="M4 4h16v16H4z"/><path d="M9 9h6M12 9v7"/>',
  image: '<path d="M4 5h16v14H4z"/><circle cx="9" cy="10" r="1.6"/><path d="m4 17 5-5 4 4 3-3 4 4"/>',
  shape: '<rect x="3.5" y="9" width="11" height="11" rx="1"/><circle cx="15.5" cy="8.5" r="5"/>',
  line: '<path d="M5 19 19 5"/>', rect: '<path d="M4 6h16v12H4z"/>', ellipse: '<ellipse cx="12" cy="12" rx="8.5" ry="6"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  cut: '<circle cx="6" cy="18" r="2.5"/><circle cx="6" cy="6" r="2.5"/><path d="M8 8l12 11M8 16 20 5"/>',
  paste: '<rect x="6" y="5" width="12" height="16" rx="2"/><path d="M9 5V3h6v2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-5-5"/>',
  up: '<path d="m6 15 6-6 6 6"/>', down: '<path d="m6 9 6 6 6-6"/>', close: '<path d="M6 6l12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
  pages: '<rect x="7" y="3" width="12" height="16" rx="1.5"/><path d="M4 7v13a1 1 0 0 0 1 1h11"/>',
  rot_cw: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>', rot_ccw: '<path d="M4 11a8 8 0 1 1 2.3 5.7"/><path d="M4 4v7h7"/>',
  left: '<path d="m15 6-6 6 6 6"/>', right: '<path d="m9 6 6 6-6 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>', theme: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/>',
  font: '<path d="M5 19 12 5l7 14M8 14h8"/>', fit: '<path d="M4 6v12M20 6v12M8 12h8M8 12l3-3M8 12l3 3M16 12l-3-3M16 12l-3 3"/>',
  file: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/>', bold: '<path d="M7 4h6a4 4 0 0 1 0 8H7zM7 12h7a4 4 0 0 1 0 8H7z"/>', italic: '<path d="M10 4h8M6 20h8M15 4 9 20"/>',
  para: '<path d="M4 6h16M4 11h16M4 16h10"/>', share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6"/>',
};
const ic = n => `<svg viewBox="0 0 24 24">${IC[n]}</svg>`;
const $ = s => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

// ------------------------------------------------------------------ state
const S = {
  doc: null, name: "document.pdf", password: null, hist: [], hpos: -1, saved: -1,
  s: 1, fit: true, tool: "select", paragraph: false, sel: null, clip: null,
  style: { family: "Liberation Sans", size: 12, bold: false, italic: false, color: [0, 0, 0] },
  shape: { stroke: [0, 0, 0], fill: null, width: 2 }, shapeKind: "rect",
  hits: [], hitI: -1, sizes: [], pageEls: [], rendered: new Set(), objCache: new Map(), lastTap: null, readOnly: false, cur: 0,
};
const MAX_HIST = 25;
const cap = window.Capacitor, plugins = cap && cap.Plugins ? cap.Plugins : {};
const isNative = !!(cap && cap.isNativePlatform && cap.isNativePlatform());

// ------------------------------------------------------------------ helpers
let toastT;
function toast(msg, ms = 3200) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), ms); }
function rgbToHex(c) { return "#" + c.map(v => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0")).join(""); }
function hexToRgb(h) { return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255); }
const dirty = () => S.doc && S.hpos !== S.saved;
function baseName() { return S.name.replace(/\.pdf$/i, ""); }
function updateTitle() { $("#title").textContent = S.doc ? (dirty() ? "• " : "") + S.name : "PDF Editor"; }

let sheetCloseCb = null;
function openSheet(node, onClose) { $("#toast").hidden = true; const sh = $("#sheet"); sh.innerHTML = ""; sh.append(node); sh.hidden = false; $("#scrim").hidden = false; sheetCloseCb = onClose || null; sh.scrollTop = 0; }
function closeSheet() { $("#sheet").hidden = true; $("#scrim").hidden = true; const cb = sheetCloseCb; sheetCloseCb = null; if (cb) cb(); }
$("#scrim").addEventListener("click", closeSheet);
const sheetOpen = () => !$("#sheet").hidden;

function askText(title, value = "", type = "text", okLabel = "OK") {
  return new Promise(res => {
    const w = el("div"); w.append(el("h2", null, title));
    const inp = el("input"); inp.type = type; inp.value = value; inp.autocomplete = "off"; w.append(inp);
    const r = el("div", "row"); const c = el("button", "btn", "Cancel"), o = el("button", "btn primary", okLabel); r.append(c, o); w.append(r);
    let done = false; const fin = v => { if (done) return; done = true; closeSheet(); res(v); };
    c.onclick = () => fin(null); o.onclick = () => fin(inp.value);
    inp.addEventListener("keydown", e => { if (e.key === "Enter") fin(inp.value); });
    openSheet(w, () => fin(null)); setTimeout(() => inp.focus(), 50);
  });
}
function confirmBox(title, msg, okLabel = "OK", danger = false) {
  return new Promise(res => {
    const w = el("div"); w.append(el("h2", null, title)); if (msg) w.append(el("p", null, msg));
    const r = el("div", "row"); const c = el("button", "btn", "Cancel"), o = el("button", "btn " + (danger ? "danger" : "primary"), okLabel); r.append(c, o); w.append(r);
    let done = false; const fin = v => { if (done) return; done = true; closeSheet(); res(v); };
    c.onclick = () => fin(false); o.onclick = () => fin(true); openSheet(w, () => fin(false));
  });
}
function pickFile(input) { return new Promise(res => { input.value = ""; input.onchange = () => res(input.files[0] || null); input.click(); }); }
const readBytes = async f => new Uint8Array(await f.arrayBuffer());

// ------------------------------------------------------------------ layout & rendering
const scroller = $("#scroller"), pagesEl = $("#pages");
const dpr = () => Math.min(window.devicePixelRatio || 1, 2.5);

function fitScale() { if (!S.sizes.length) return 1; const w = Math.max(...S.sizes.map(z => z[0])); return Math.max(0.2, (scroller.clientWidth - 16) / w); }

function buildPages(keepScroll = true) {
  const sl = scroller.scrollLeft, st = scroller.scrollTop;
  pagesEl.innerHTML = ""; S.pageEls = []; S.rendered.clear(); S.objCache.clear();
  if (!S.doc) return;
  S.sizes = []; for (let i = 0; i < S.doc.countPages(); i++) S.sizes.push(E.pageSize(S.doc, i));
  if (S.fit) S.s = fitScale();
  S.sizes.forEach((z, i) => {
    const p = el("div", "page"); p.style.width = z[0] * S.s + "px"; p.style.height = z[1] * S.s + "px"; p.dataset.i = i;
    const cv = el("canvas"); const ov = el("div", "ov"); ov.style.touchAction = S.tool === "shape" ? "none" : ""; p.append(cv, ov); pagesEl.append(p); S.pageEls.push({ p, cv, ov });
    ov.addEventListener("pointerdown", e => onPointerDown(e, i));
    io.observe(p);
  });
  if (keepScroll) { scroller.scrollLeft = sl; scroller.scrollTop = st; }
  drawOverlays(); updatePill();
}

const renderQueue = []; let rendering = false;
const io = new IntersectionObserver(entries => {
  for (const en of entries) {
    const i = +en.target.dataset.i;
    if (en.isIntersecting) { if (!S.rendered.has(i) && !renderQueue.includes(i)) renderQueue.push(i); }
  }
  pump();
}, { root: scroller, rootMargin: "700px 0px" });
async function pump() {
  if (rendering) return; rendering = true;
  while (renderQueue.length) {
    const i = renderQueue.shift(); if (!S.doc || !S.pageEls[i]) continue;
    renderPageNow(i); await new Promise(r => setTimeout(r, 0));
  }
  rendering = false; evict();
}
function renderPageNow(i) {
  const pe = S.pageEls[i]; if (!pe) return;
  let sc = S.s * dpr(); const z = S.sizes[i];
  const maxPx = 14e6; if (z[0] * sc * z[1] * sc > maxPx) sc = Math.sqrt(maxPx / (z[0] * z[1]));
  try {
    const r = E.renderPage(S.doc, i, sc);
    pe.cv.width = r.w; pe.cv.height = r.h;
    pe.cv.getContext("2d").putImageData(new ImageData(r.rgba, r.w, r.h), 0, 0);
    S.rendered.add(i);
  } catch (e) { console.error(e); toast("Could not render page " + (i + 1)); }
}
function evict() {
  if (S.rendered.size <= 7) return; const c = currentPage();
  [...S.rendered].sort((a, b) => Math.abs(b - c) - Math.abs(a - c)).slice(0, S.rendered.size - 7).forEach(i => { const pe = S.pageEls[i]; if (pe) { pe.cv.width = 1; pe.cv.height = 1; } S.rendered.delete(i); });
}
function currentPage() {
  const mid = scroller.scrollTop + scroller.clientHeight * 0.35; let best = 0;
  for (let i = 0; i < S.pageEls.length; i++) { if (S.pageEls[i].p.offsetTop - 7 <= mid) best = i; else break; }
  return best;
}
function updatePill() { const n = S.pageEls.length; $("#pill").hidden = !n; S.cur = currentPage(); $("#pill").textContent = `${S.cur + 1} / ${n}`; }
scroller.addEventListener("scroll", () => { updatePill(); }, { passive: true });
function goTo(i) { const pe = S.pageEls[Math.max(0, Math.min(S.pageEls.length - 1, i))]; if (pe) scroller.scrollTo({ top: pe.p.offsetTop - 8, behavior: "auto" }); }
$("#pill").onclick = async () => { const n = S.pageEls.length; const v = await askText(`Go to page (1–${n})`, String(S.cur + 1), "number", "Go"); if (v) goTo((parseInt(v) || 1) - 1); };

function setZoom(newS, cx, cy) {
  newS = Math.max(0.15, Math.min(8, newS)); if (!S.doc) return;
  const k = newS / S.s;
  const px = scroller.scrollLeft + cx, py = scroller.scrollTop + cy;
  S.fit = false; S.s = newS; buildPages(false);
  scroller.scrollLeft = px * k - cx; scroller.scrollTop = py * k - cy;
}

// pinch zoom (two fingers)
(() => {
  let d0 = 0, s0 = 1, c = null, k = 1, active = false;
  const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  scroller.addEventListener("touchstart", e => {
    if (e.touches.length === 2 && S.doc) {
      active = true; d0 = dist(e.touches); s0 = S.s; k = 1;
      const r = scroller.getBoundingClientRect();
      c = { x: (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left, y: (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top };
      pagesEl.style.transformOrigin = `${scroller.scrollLeft + c.x}px ${scroller.scrollTop + c.y}px`;
    }
  }, { passive: true });
  scroller.addEventListener("touchmove", e => {
    if (active && e.touches.length === 2) { e.preventDefault(); k = Math.max(0.15 / s0, Math.min(8 / s0, dist(e.touches) / d0)); pagesEl.style.transform = `scale(${k})`; }
  }, { passive: false });
  const end = () => { if (!active) return; active = false; pagesEl.style.transform = ""; pagesEl.style.transformOrigin = "0 0"; if (Math.abs(k - 1) > 0.02) setZoom(s0 * k, c.x, c.y); };
  scroller.addEventListener("touchend", e => { if (e.touches.length < 2) end(); }, { passive: true });
  scroller.addEventListener("touchcancel", end, { passive: true });
  scroller.addEventListener("wheel", e => { if (e.ctrlKey) { e.preventDefault(); const r = scroller.getBoundingClientRect(); setZoom(S.s * (e.deltaY < 0 ? 1.1 : 1 / 1.1), e.clientX - r.left, e.clientY - r.top); } }, { passive: false });
})();

// ------------------------------------------------------------------ objects & overlays
function objects(i) {
  const key = i + "|" + S.paragraph;
  if (!S.objCache.has(key)) { let o = []; try { o = E.getObjects(S.doc, i, S.paragraph); } catch (e) { console.error(e); } S.objCache.set(key, o); }
  return S.objCache.get(key);
}
function pt(e, i) { const r = S.pageEls[i].ov.getBoundingClientRect(); return [(e.clientX - r.left) / S.s, (e.clientY - r.top) / S.s]; }

function drawOverlays() {
  S.pageEls.forEach(pe => { pe.ov.querySelectorAll(".hit,.selbox").forEach(n => n.remove()); });
  S.hits.forEach((h, k) => {
    const pe = S.pageEls[h.page]; if (!pe) return; const d = el("div", "hit" + (k === S.hitI ? " cur" : ""));
    Object.assign(d.style, { left: h.rect[0] * S.s + "px", top: h.rect[1] * S.s + "px", width: (h.rect[2] - h.rect[0]) * S.s + "px", height: (h.rect[3] - h.rect[1]) * S.s + "px" }); pe.ov.append(d);
  });
  if (S.sel) {
    const pe = S.pageEls[S.sel.page]; if (!pe) return; const r = S.sel.obj.rect;
    const d = el("div", "selbox", "<i></i><i></i><i></i><i></i>");
    Object.assign(d.style, { left: r[0] * S.s + "px", top: r[1] * S.s + "px", width: (r[2] - r[0]) * S.s + "px", height: (r[3] - r[1]) * S.s + "px" });
    d.addEventListener("pointerdown", e => startMove(e, d)); pe.ov.append(d); S.sel.el = d;
  }
}
function select(page, obj) {
  S.sel = obj ? { page, obj } : null;
  if (obj && obj.kind === "text") { S.style = { family: obj.family, size: obj.size, bold: obj.bold, italic: obj.italic, color: obj.color }; }
  drawOverlays(); renderActionBar();
}

function startMove(e, box) {
  e.stopPropagation(); e.preventDefault();
  const sel = S.sel; if (!sel) return; box.setPointerCapture(e.pointerId);
  const x0 = e.clientX, y0 = e.clientY, l0 = parseFloat(box.style.left), t0 = parseFloat(box.style.top); let moved = false;
  const mv = ev => { const dx = ev.clientX - x0, dy = ev.clientY - y0; if (Math.hypot(dx, dy) > 5) moved = true; box.style.left = l0 + dx + "px"; box.style.top = t0 + dy + "px"; };
  const up = ev => {
    box.removeEventListener("pointermove", mv); box.removeEventListener("pointerup", up); box.removeEventListener("pointercancel", up);
    const dx = (ev.clientX - x0) / S.s, dy = (ev.clientY - y0) / S.s;
    if (!moved) { if (sel.obj.kind === "text") { const now = Date.now(); if (S.lastTap && now - S.lastTap < 400) openEditor(sel.page, sel.obj); S.lastTap = now; } return; }
    commit("Move", d => E.moveObject(d, sel.page, sel.obj, dx, dy), sel.page, (nd, i) => reselectAt(i, sel.obj.rect[0] + dx + 2, sel.obj.rect[1] + dy + 2));
  };
  box.addEventListener("pointermove", mv); box.addEventListener("pointerup", up); box.addEventListener("pointercancel", up);
}
function reselectAt(i, x, y) { const o = E.hitObject(objects(i), x, y); if (o) select(i, o); }

// ------------------------------------------------------------------ pointer handling on pages
let drag = null;
function onPointerDown(e, i) {
  if (!S.doc || e.target.closest(".selbox")) return;
  const [x, y] = pt(e, i); S.lastTap = S.lastTap; S.last = { page: i, x, y };
  if (S.tool === "shape") {
    if (S.readOnly) return toast("This document does not allow editing.");
    startDraw(e, i, x, y); return;
  }
  const t0 = { x: e.clientX, y: e.clientY, t: Date.now() }; const ov = S.pageEls[i].ov;
  const up = ev => {
    ov.removeEventListener("pointerup", up);
    if (Math.hypot(ev.clientX - t0.x, ev.clientY - t0.y) > 10 || Date.now() - t0.t > 600) return;
    onTap(i, x, y);
  };
  ov.addEventListener("pointerup", up);
}
function startDraw(e, i, x, y) {
  const ov = S.pageEls[i].ov; ov.setPointerCapture(e.pointerId);
  const rb = el("div", "rubber"); ov.append(rb); let cx = x, cy = y;
  const place = () => { const l = Math.min(x, cx) * S.s, t = Math.min(y, cy) * S.s; Object.assign(rb.style, { left: l + "px", top: t + "px", width: Math.abs(cx - x) * S.s + "px", height: Math.abs(cy - y) * S.s + "px" }); if (S.shapeKind === "line") { rb.style.height = "2px"; rb.style.width = Math.hypot(cx - x, cy - y) * S.s + "px"; rb.style.left = x * S.s + "px"; rb.style.top = y * S.s + "px"; rb.style.transformOrigin = "0 0"; rb.style.transform = `rotate(${Math.atan2(cy - y, cx - x)}rad)`; } };
  const mv = ev => { [cx, cy] = pt(ev, i); place(); };
  const up = ev => {
    ov.removeEventListener("pointermove", mv); ov.removeEventListener("pointerup", up); ov.removeEventListener("pointercancel", cancel); rb.remove();
    [cx, cy] = pt(ev, i); if (Math.hypot(cx - x, cy - y) * S.s < 8) return;
    commit("Add " + S.shapeKind, d => E.addShape(d, i, S.shapeKind, [x, y], [cx, cy], S.shape), i); setTool("select");
  };
  const cancel = () => { ov.removeEventListener("pointermove", mv); ov.removeEventListener("pointerup", up); rb.remove(); };
  ov.addEventListener("pointermove", mv); ov.addEventListener("pointerup", up); ov.addEventListener("pointercancel", cancel);
}
async function onTap(i, x, y) {
  const t = S.tool;
  if (t === "select") {
    const o = E.hitObject(objects(i), x, y, 4); const now = Date.now();
    if (o && S.sel && S.sel.page === i && S.sel.obj.rect.join() === o.rect.join() && o.kind === "text" && S.lastTap && now - S.lastTap < 450) { openEditor(i, o); S.lastTap = 0; return; }
    S.lastTap = now; select(i, o);
  } else if (t === "edit") {
    const o = E.hitObject(objects(i).filter(o => o.kind === "text"), x, y, 4);
    if (o) { select(i, o); openEditor(i, o); } else toast("No text here — use Add Text to place new text.");
  } else if (t === "text") { if (S.readOnly) return toast("This document does not allow editing."); openEditor(i, null, x, y); }
  else if (t === "image") { if (S.readOnly) return toast("This document does not allow editing."); addImageAt(i, x, y); }
}

// ------------------------------------------------------------------ history / commit
function commit(label, fn, page, after) {
  if (!S.doc) return; if (S.readOnly) return toast("This document does not allow editing.");
  let res;
  try { res = fn(S.doc); } catch (e) { console.error(e); toast("Could not apply: " + (e.message || e)); return; }
  let nd, data;
  try { ({ doc: nd, data } = E.reload(S.doc)); } catch (e) { console.error(e); toast("Could not update the document."); return; }
  S.doc = nd; S.hist.splice(S.hpos + 1); S.hist.push(data); S.hpos = S.hist.length - 1;
  if (S.hist.length > MAX_HIST) { S.hist.shift(); S.hpos--; S.saved--; }
  S.objCache.clear(); S.sel = null;
  if (page != null && S.pageEls[page] && S.doc.countPages() === S.pageEls.length) { S.rendered.delete(page); renderQueue.unshift(page); pump(); }
  else buildPages(true);
  drawOverlays(); renderActionBar(); updateUndo(); updateTitle();
  if (after) after(nd, page);
  if (Array.isArray(res) && res.length) toast(`Some characters (${res.slice(0, 8).join(" ")}) aren't in this font. Pick another font (menu → Import font).`, 6000);
  else if (label) toast(label, 1400);
  return res;
}
function restore(pos) {
  try { S.doc = E.openDocument(S.hist[pos], S.password); } catch (e) { return toast("Could not restore that state."); }
  S.hpos = pos; S.sel = null; buildPages(true); renderActionBar(); updateUndo(); updateTitle();
}
function updateUndo() { $("#b-undo").disabled = !(S.doc && S.hpos > 0); $("#b-redo").disabled = !(S.doc && S.hpos < S.hist.length - 1); $("#b-save").disabled = !S.doc; }
$("#b-undo").onclick = () => { if (S.hpos > 0) { restore(S.hpos - 1); toast("Undo", 1000); } };
$("#b-redo").onclick = () => { if (S.hpos < S.hist.length - 1) { restore(S.hpos + 1); toast("Redo", 1000); } };

// ------------------------------------------------------------------ text editor sheet
function openEditor(page, obj, x, y) {
  if (S.readOnly) return toast("This document does not allow editing.");
  const st = { ...S.style }; if (obj) { st.family = obj.family; st.size = obj.size; st.bold = obj.bold; st.italic = obj.italic; st.color = obj.color; }
  const w = el("div"); w.append(el("h2", null, obj ? "Edit text" : "Add text"));
  const ta = el("textarea"); ta.id = "txt"; ta.value = obj ? obj.text : ""; ta.setAttribute("autocapitalize", "off"); w.append(ta);
  const warn = el("div", "warn"); w.append(warn);
  const r1 = el("div", "row"); const fam = el("select", "grow");
  E.fontFamilies().forEach(f => { const o = el("option", null, f); o.value = f; fam.append(o); });
  if (![...fam.options].some(o => o.value === st.family)) st.family = fam.options[0].value; fam.value = st.family; r1.append(fam); w.append(r1);
  const r2 = el("div", "row");
  const stp = el("div", "stepper"); const mi = el("button", "sq", ic("minus")), pl = el("button", "sq", ic("plus")), sz = el("input"); sz.type = "number"; sz.step = "0.5"; sz.value = st.size; stp.append(mi, sz, pl);
  const b = el("button", "sq" + (st.bold ? " on" : ""), ic("bold")), it = el("button", "sq" + (st.italic ? " on" : ""), ic("italic"));
  const col = el("input"); col.type = "color"; col.value = rgbToHex(st.color);
  r2.append(stp, b, it, col); w.append(r2);
  const check = () => { const f = chooseFam(); const m = E.missingChars(f, st.bold, st.italic, ta.value); warn.textContent = m.length ? `Not in this font: ${m.slice(0, 8).join(" ")} — pick another font.` : ""; };
  const chooseFam = () => E.chooseFamily(fam.value, st.bold, st.italic, ta.value);
  mi.onclick = () => { sz.value = Math.max(4, (+sz.value || 12) - 1); }; pl.onclick = () => { sz.value = (+sz.value || 12) + 1; };
  b.onclick = () => { st.bold = !st.bold; b.classList.toggle("on", st.bold); check(); }; it.onclick = () => { st.italic = !st.italic; it.classList.toggle("on", st.italic); check(); };
  fam.onchange = check; ta.oninput = check;
  const r3 = el("div", "row"); const cancel = el("button", "btn", "Cancel"), ok = el("button", "btn primary", "Apply"); r3.append(cancel);
  if (obj) { const del = el("button", "btn danger", "Delete"); del.onclick = () => { closeSheet(); commit("Deleted", d => E.deleteObject(d, page, obj), page); }; r3.append(del); }
  r3.append(ok); w.append(r3);
  cancel.onclick = closeSheet;
  ok.onclick = () => {
    const text = ta.value; const ns = { family: fam.value, size: Math.max(2, +sz.value || 12), bold: st.bold, italic: st.italic, color: hexToRgb(col.value) };
    S.style = { ...ns }; closeSheet();
    if (obj) {
      if (!text.trim()) return commit("Deleted", d => E.deleteObject(d, page, obj), page);
      const same = text === obj.text && ns.family === obj.family && Math.abs(ns.size - obj.size) < 0.01 && ns.bold === obj.bold && ns.italic === obj.italic && ns.color.every((v, k) => Math.abs(v - obj.color[k]) < 0.01);
      if (same) return;
      commit("Text updated", d => E.editTextObject(d, page, obj, text, ns), page);
    } else {
      if (!text.trim()) return;
      commit("Text added", d => E.addText(d, page, x, y, text, ns), page); setTool("select");
    }
  };
  check(); openSheet(w); setTimeout(() => { ta.focus(); if (obj) ta.setSelectionRange(ta.value.length, ta.value.length); }, 60);
}

// ------------------------------------------------------------------ images
async function addImageAt(page, x, y) {
  const f = await pickFile($("#f-img")); if (!f) return;
  try {
    const bytes = await readBytes(f); const [iw, ih] = E.imageSize(bytes);
    const w = Math.min(220, iw * 0.75), h = w * ih / iw;
    commit("Image added", d => E.placeImage(d, page, [x, y, x + w, y + h], bytes), page); setTool("select");
  } catch (e) { console.error(e); toast("That image could not be read."); }
}
function resizeSel(factor) {
  const s = S.sel; if (!s) return; const o = s.obj, r = o.rect, w = (r[2] - r[0]) * factor, h = (r[3] - r[1]) * factor;
  if (o.kind === "image") { const png = E.imagePng(o); commit("Resized", d => { E.deleteObject(d, s.page, o); E.placeImage(d, s.page, [r[0], r[1], r[0] + w, r[1] + h], png); }, s.page, (nd, i) => reselectAt(i, r[0] + 2, r[1] + 2)); }
  else if (o.kind === "annot") commit("Resized", d => { o.annot.setRect([r[0], r[1], r[0] + w, r[1] + h]); o.annot.update(); }, s.page, (nd, i) => reselectAt(i, r[0] + 2, r[1] + 2));
  else if (o.kind === "text") { const ns = { family: o.family, size: Math.max(4, o.size * factor), bold: o.bold, italic: o.italic, color: o.color }; commit("Resized", d => E.editTextObject(d, s.page, o, o.text, ns), s.page, (nd, i) => reselectAt(i, r[0] + 2, r[1] + 2)); }
}

// ------------------------------------------------------------------ action bar / toolbar
function renderActionBar() {
  const ab = $("#actionbar"); ab.innerHTML = ""; const s = S.sel;
  const add = (icon, label, fn, cls) => { const b = el("button", "ab" + (cls ? " " + cls : ""), ic(icon) + `<span>${label}</span>`); b.onclick = fn; ab.append(b); };
  if (s) {
    if (s.obj.kind === "text") add("edit", "Edit", () => openEditor(s.page, s.obj));
    if (s.obj.kind !== "annot" || true) { add("minus", "Smaller", () => resizeSel(0.9)); add("plus", "Larger", () => resizeSel(1.1)); }
    if (s.obj.kind !== "annot") { add("copy", "Copy", copySel); add("cut", "Cut", () => { copySel(); commit("Cut", d => E.deleteObject(d, s.page, s.obj), s.page); }); }
    add("trash", "Delete", () => commit("Deleted", d => E.deleteObject(d, s.page, s.obj), s.page), "danger");
  }
  if (S.clip) add("paste", "Paste", pasteClip);
  ab.hidden = !ab.children.length;
}
function copySel() {
  const s = S.sel; if (!s) return;
  if (s.obj.kind === "text") S.clip = { kind: "text", obj: s.obj }; else if (s.obj.kind === "image") S.clip = { kind: "image", png: E.imagePng(s.obj), w: s.obj.rect[2] - s.obj.rect[0], h: s.obj.rect[3] - s.obj.rect[1] };
  toast("Copied", 1200); renderActionBar();
}
function pasteClip() {
  if (!S.clip) return; const p = S.last || { page: S.cur, x: 72, y: 72 }; const x = p.x + 12, y = p.y + 12; S.last = { page: p.page, x, y };
  if (S.clip.kind === "text") commit("Pasted", d => E.pasteText(d, p.page, S.clip.obj, x, y), p.page);
  else commit("Pasted", d => E.placeImage(d, p.page, [x, y, x + S.clip.w, y + S.clip.h], S.clip.png), p.page);
}

const TOOLS = [["select", "select", "Select"], ["edit", "edit", "Edit text"], ["text", "text", "Add text"], ["image", "image", "Image"], ["shape", "shape", "Shapes"]];
function buildToolbar() {
  const tb = $("#toolbar"); tb.innerHTML = "";
  TOOLS.forEach(([id, icon, label]) => { const b = el("button", "tb", ic(icon) + `<span>${label}</span>`); b.dataset.t = id; b.onclick = () => { if (id === "shape") toggleShapePop(); else setTool(id); }; tb.append(b); });
  const pop = $("#shapepop"); pop.innerHTML = "";
  [["rect", "Rectangle"], ["ellipse", "Ellipse"], ["line", "Line"]].forEach(([k, label]) => { const b = el("button", "ab", ic(k) + `<span>${label}</span>`); b.onclick = () => { S.shapeKind = k; pop.hidden = true; setTool("shape"); toast(label + ": drag on the page to draw"); }; pop.append(b); });
  const col = el("input"); col.type = "color"; col.value = rgbToHex(S.shape.stroke); col.title = "Line color"; col.oninput = () => (S.shape.stroke = hexToRgb(col.value));
  const fl = el("input"); fl.type = "color"; fl.value = "#ffeb8c"; fl.title = "Fill color"; const fc = el("button", "ab", "<span>Fill</span>"); let fillOn = false; fc.onclick = () => { fillOn = !fillOn; S.shape.fill = fillOn ? hexToRgb(fl.value) : null; fc.style.background = fillOn ? "var(--accent)" : ""; fc.style.color = fillOn ? "var(--accent-t)" : ""; }; fl.oninput = () => { if (fillOn) S.shape.fill = hexToRgb(fl.value); };
  pop.append(col, fl, fc);
}
function toggleShapePop() { const p = $("#shapepop"); p.hidden = !p.hidden; }
function setTool(t) {
  S.tool = t; $("#shapepop").hidden = true; document.querySelectorAll(".tb").forEach(b => b.classList.toggle("on", b.dataset.t === t));
  document.querySelectorAll(".ov").forEach(o => (o.style.touchAction = t === "shape" ? "none" : ""));
  if (t !== "select") { S.sel = null; drawOverlays(); renderActionBar(); }
  const hints = { select: "", edit: "Tap a line of text to edit it", text: "Tap where the text should go", image: "Tap where the image should go", shape: "Drag on the page to draw" };
  if (hints[t]) toast(hints[t], 2200);
}

// ------------------------------------------------------------------ document load / save
async function loadBytes(bytes, name) {
  if (dirty() && !(await confirmBox("Discard changes?", "You have unsaved changes in the current document.", "Discard", true))) return;
  let pw = null, doc = null;
  for (let tries = 0; tries < 4; tries++) {
    try { doc = E.openDocument(bytes, pw); break; }
    catch (e) { if (e.code === "PASSWORD") { pw = await askText(tries ? "Wrong password — try again" : "This PDF is password protected", "", "password", "Open"); if (pw == null) return; } else { console.error(e); return toast("That file is not a valid PDF."); } }
  }
  if (!doc) return;
  S.doc = doc; S.name = name || "document.pdf"; S.password = pw; S.hist = [E.snapshot(doc)]; S.hpos = 0; S.saved = 0; S.sel = null; S.hits = []; S.fit = true; S.tool = "select";
  S.readOnly = E.isReadOnly(doc); $("#welcome").hidden = true; scroller.scrollTop = 0; scroller.scrollLeft = 0;
  buildPages(false); setTool("select"); renderActionBar(); updateUndo(); updateTitle();
  if (S.readOnly) toast("This PDF's owner does not allow editing. Opened read-only.", 5000);
}
async function openPdf() { const f = await pickFile($("#f-pdf")); if (f) loadBytes(await readBytes(f), f.name); }
function newPdf() { const d = E.newDocument(); const b = E.snapshot(d); loadBytes(b, "Untitled.pdf").then(() => { S.saved = -1; updateTitle(); }); }
$("#w-open").onclick = openPdf; $("#w-new").onclick = newPdf;

async function saveBytesOut(bytes, filename) {
  if (isNative && plugins.Filesystem && plugins.Share) {
    try {
      let bin = ""; const CH = 0x8000; for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
      const r = await plugins.Filesystem.writeFile({ path: filename, data: btoa(bin), directory: "CACHE" });
      await plugins.Share.share({ title: filename, text: filename, url: r.uri, dialogTitle: "Save or share PDF" });
      return true;
    } catch (e) { if (String(e && e.message || e).toLowerCase().includes("cancel")) return false; console.error(e); toast("Sharing failed — trying a direct download."); }
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })); a.download = filename; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); return true;
}
async function save() {
  if (!S.doc) return;
  let bytes; try { bytes = E.saveBytes(S.doc, false, S.password); } catch (e) { console.error(e); return toast("Could not save the document."); }
  const fn = baseName() + (S.hpos === 0 && S.saved === 0 ? "" : "_edited") + ".pdf";
  if (await saveBytesOut(bytes, fn)) { S.saved = S.hpos; updateTitle(); toast("Saved " + fn, 2500); }
}
$("#b-save").onclick = save;

// ------------------------------------------------------------------ search
function openSearch() { $("#searchbar").hidden = false; $("#scroller").style.top = "calc(var(--bar) + var(--safe-t) + 52px)"; $("#q").focus(); }
function closeSearch() { $("#searchbar").hidden = true; $("#scroller").style.top = ""; S.hits = []; S.hitI = -1; $("#qcount").textContent = ""; drawOverlays(); }
function runSearch() {
  const q = $("#q").value.trim(); if (!q || !S.doc) return;
  S.hits = E.search(S.doc, q); S.hitI = S.hits.length ? 0 : -1; $("#qcount").textContent = S.hits.length ? `1 / ${S.hits.length}` : "No results"; drawOverlays(); showHit();
}
function stepHit(d) { if (!S.hits.length) return; S.hitI = (S.hitI + d + S.hits.length) % S.hits.length; $("#qcount").textContent = `${S.hitI + 1} / ${S.hits.length}`; drawOverlays(); showHit(); }
function showHit() { const h = S.hits[S.hitI]; if (!h) return; const pe = S.pageEls[h.page]; scroller.scrollTo({ top: pe.p.offsetTop + h.rect[1] * S.s - scroller.clientHeight / 3, behavior: "auto" }); }
$("#q").addEventListener("keydown", e => { if (e.key === "Enter") { if (S.hits.length && $("#q").dataset.last === $("#q").value) stepHit(1); else { $("#q").dataset.last = $("#q").value; runSearch(); } } });
$("#q-next").onclick = () => stepHit(1); $("#q-prev").onclick = () => stepHit(-1); $("#q-close").onclick = closeSearch;

// ------------------------------------------------------------------ pages manager
let pvSel = new Set(), thumbTimer = null;
function openPages() {
  if (!S.doc) return; pvSel = new Set(); const pv = $("#pagesview"); pv.hidden = false; renderPages();
}
function renderPages() {
  const pv = $("#pagesview"); pv.innerHTML = "";
  const top = el("div"); top.id = "pv-top"; top.append(el("div", "grow", "Pages"), (() => { const b = el("button", "ib", ic("close")); b.onclick = closePages; return b; })()); pv.append(top);
  const grid = el("div"); grid.id = "pv-grid"; pv.append(grid);
  const n = S.doc.countPages(); const queue = [];
  for (let i = 0; i < n; i++) {
    const t = el("div", "th" + (pvSel.has(i) ? " sel" : "")); const cv = el("canvas"); t.append(cv, el("div", null, String(i + 1)));
    t.onclick = () => { pvSel.has(i) ? pvSel.delete(i) : pvSel.add(i); t.classList.toggle("sel", pvSel.has(i)); }; grid.append(t); queue.push([i, cv]);
  }
  clearInterval(thumbTimer); thumbTimer = setInterval(() => {
    for (let k = 0; k < 2; k++) { const q = queue.shift(); if (!q) { clearInterval(thumbTimer); return; } const [i, cv] = q; try { const z = E.pageSize(S.doc, i); const r = E.renderPage(S.doc, i, Math.min(1, 240 / z[0])); cv.width = r.w; cv.height = r.h; cv.getContext("2d").putImageData(new ImageData(r.rgba, r.w, r.h), 0, 0); } catch (e) { /* skip */ } }
  }, 20);
  const bar = el("div"); bar.id = "pv-bar";
  const tgt = () => (pvSel.size ? [...pvSel].sort((a, b) => a - b) : [S.cur]);
  const btn = (icon, label, fn, cls) => { const b = el("button", "ab" + (cls ? " " + cls : ""), ic(icon) + `<span>${label}</span>`); b.onclick = fn; bar.append(b); };
  btn("rot_ccw", "Rotate L", () => pageOp("Rotated", d => E.rotatePages(d, tgt(), -90)));
  btn("rot_cw", "Rotate R", () => pageOp("Rotated", d => E.rotatePages(d, tgt(), 90)));
  btn("plus", "Blank", () => pageOp("Page added", d => E.insertBlankPage(d, Math.max(...tgt()) + 1, Math.max(...tgt()))));
  btn("left", "Move up", () => { const t = tgt(); if (t.length !== 1 || t[0] === 0) return toast("Select one page (not the first)"); pvSel = new Set([t[0] - 1]); pageOp("Moved", d => E.movePage(d, t[0], t[0] - 1)); });
  btn("right", "Move down", () => { const t = tgt(); if (t.length !== 1 || t[0] >= S.doc.countPages() - 1) return toast("Select one page (not the last)"); pvSel = new Set([t[0] + 1]); pageOp("Moved", d => E.movePage(d, t[0], t[0] + 1)); });
  btn("file", "Import", importPages);
  btn("share", "Extract", async () => { const t = tgt(); const out = E.extractPages(S.doc, t); await saveBytesOut(out, `${baseName()}_pages.pdf`); });
  btn("trash", "Delete", async () => { const t = tgt(); if (t.length >= S.doc.countPages()) return toast("A document must keep at least one page."); if (await confirmBox("Delete pages?", t.length === 1 ? `Delete page ${t[0] + 1}?` : `Delete ${t.length} pages?`, "Delete", true)) { pvSel = new Set(); pageOp("Deleted", d => E.deletePages(d, t)); } }, "danger");
  pv.append(bar);
}
function closePages() { clearInterval(thumbTimer); $("#pagesview").hidden = true; }
function pageOp(label, fn) {
  if (S.readOnly) return toast("This document does not allow editing.");
  commit(label, fn, null); if (!$("#pagesview").hidden) renderPages();
}
async function importPages() {
  const f = await pickFile($("#f-import")); if (!f) return; const bytes = await readBytes(f); const at = (pvSel.size ? Math.max(...pvSel) : S.cur) + 1;
  let pw = null; for (let k = 0; k < 3; k++) { try { pageOp("Pages imported", d => E.importPages(d, bytes, at, pw)); return; } catch (e) { if (e.code === "PASSWORD") { pw = await askText("Password for the imported file", "", "password"); if (pw == null) return; } else return toast("Could not import that file."); } }
}

// ------------------------------------------------------------------ menu / properties
function openMenu() {
  const w = el("div"); const item = (icon, label, fn, sub) => { const b = el("button", "mi", ic(icon) + `<span>${label}</span>` + (sub ? `<span class="sub">${sub}</span>` : "")); b.onclick = () => { closeSheet(); setTimeout(fn, 30); }; w.append(b); };
  const has = !!S.doc;
  item("open", "Open PDF", openPdf); item("file", "New blank PDF", newPdf);
  if (has) {
    item("search", "Find in document", openSearch); item("pages", "Pages (rotate, move, delete…)", openPages);
    item("paste", "Paste", pasteClip, S.clip ? "" : "nothing copied");
    item("fit", "Fit to width", () => { S.fit = true; buildPages(false); });
    item("para", "Edit by " + (S.paragraph ? "line" : "paragraph"), () => { S.paragraph = !S.paragraph; S.objCache.clear(); toast(S.paragraph ? "Editing whole paragraphs" : "Editing single lines"); });
    item("info", "Document properties", openProps);
    item("save", "Optimize file size", () => { const before = S.hist[S.hpos].length; commit("", d => { const b = E.saveBytes(d, true); const nd = E.openDocument(b); S.doc = nd; return null; }); const after = S.hist[S.hpos].length; toast(`Optimized: ${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB`, 3500); });
  }
  item("font", "Import font (.ttf / .otf)", importFont);
  item("theme", "Switch light / dark theme", toggleTheme);
  item("info", "About", openAbout);
  openSheet(w);
}
async function importFont() {
  const f = await pickFile($("#f-font")); if (!f) return;
  try { const bytes = await readBytes(f); const name = f.name.replace(/\.(ttf|otf)$/i, ""); const ab = E.toAB(bytes); new E.mupdf.Font("T", ab); E.addUserFont(name, ab); S.style.family = name; toast(`Font “${name}” imported for this session. Choose it in the text editor.`, 4500); }
  catch (e) { toast("That font file could not be loaded."); }
}
function openProps() {
  const m = E.getMeta(S.doc); const w = el("div"); w.append(el("h2", null, "Document properties"));
  const inputs = {}; for (const [k, label] of [["title", "Title"], ["author", "Author"], ["subject", "Subject"], ["keywords", "Keywords"]]) { w.append(el("div", "muted", label)); const i = el("input"); i.type = "text"; i.value = m[k]; inputs[k] = i; w.append(i); }
  const info = el("p", null, `${S.doc.countPages()} pages · ${(S.hist[S.hpos].length / 1024).toFixed(0)} KB`); info.style.color = "var(--muted)"; w.append(info);
  const r = el("div", "row"), c = el("button", "btn", "Cancel"), o = el("button", "btn primary", "Save"); r.append(c, o); w.append(r); c.onclick = closeSheet;
  o.onclick = () => { const nv = Object.fromEntries(Object.entries(inputs).map(([k, i]) => [k, i.value])); closeSheet(); if (Object.keys(nv).some(k => nv[k] !== m[k])) commit("Properties saved", d => E.setMeta(d, nv), null); };
  openSheet(w);
}
function openAbout() {
  const w = el("div"); w.append(el("h2", null, "PDF Editor 3.0 (Android)"));
  w.append(el("p", null, "Edited text is always written with a complete embedded Unicode font, so every letter, number and symbol the font contains can be typed, displayed and saved."));
  const p = el("p", null, "Engine: MuPDF (AGPL-3.0). Fonts: Liberation (SIL OFL) and DejaVu. Files never leave your device."); p.style.color = "var(--muted)"; w.append(p);
  const c = el("button", "btn primary", "Close"); c.onclick = closeSheet; w.append(c); openSheet(w);
}
function toggleTheme() { const light = document.body.classList.toggle("light"); document.body.classList.toggle("dark", !light); try { localStorage.setItem("theme", light ? "light" : "dark"); } catch (e) { /* ignore */ } }
$("#b-menu").onclick = openMenu;

// ------------------------------------------------------------------ boot
function icons() { const m = { "#b-undo": "undo", "#b-redo": "redo", "#b-save": "save", "#b-menu": "menu", "#q-prev": "up", "#q-next": "down", "#q-close": "close" }; for (const [s, n] of Object.entries(m)) $(s).innerHTML = ic(n); }
async function boot() {
  try { if (localStorage.getItem("theme") === "light") { document.body.classList.add("light"); document.body.classList.remove("dark"); } } catch (e) { /* ignore */ }
  icons(); buildToolbar(); setTool("select"); updateUndo();
  try {
    await E.loadFonts(async f => { const r = await fetch("fonts/" + f); if (!r.ok) throw new Error("font " + f); return await r.arrayBuffer(); });
  } catch (e) { console.error(e); $("#splash-s").textContent = "Could not load fonts: " + e.message; return; }
  $("#splash").classList.add("gone");
  window.__ready = true;
  if (plugins.App && plugins.App.addListener) {
    plugins.App.addListener("backButton", async () => {
      if (!$("#pagesview").hidden) return closePages();
      if (sheetOpen()) return closeSheet();
      if (!$("#searchbar").hidden) return closeSearch();
      if (S.sel) return select(0, null);
      if (dirty()) { if (!(await confirmBox("Leave without saving?", "Your changes will be lost.", "Leave", true))) return; }
      plugins.App.exitApp();
    });
  }
}
window.addEventListener("beforeunload", e => { if (dirty()) { e.preventDefault(); e.returnValue = ""; } });
window.addEventListener("resize", () => { if (S.doc && S.fit) { const sl = scroller.scrollTop; buildPages(false); scroller.scrollTop = sl; } });
window.__app = { S, E, loadBytes, goTo, setZoom, commit, openEditor, select, objects, setTool };   // used by automated tests
boot();
