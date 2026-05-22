/* ===========================================================================
   stack-diagram.js — clean isometric stack diagram
   ---------------------------------------------------------------------------
   True 2:1 isometric rhombi, stacked vertically. Three top layers
   (State / Industry / Grassroots). Click a layer to expand its three
   sublayers, stacked vertically beside it, each with a small note card to
   the right. Single lilac accent. Flat, minimal, modern.

   Labels/notes come from content.json (passed in as `model`).
   Requires: three (bundled by Rollup).
   =========================================================================== */

   import * as THREE from 'three';

   /* live CSS var read (so the diagram tracks light/dark theme) */
   const css = (n, f) => {
     try { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || f; }
     catch { return f; }
   };
   const lerp = (a, b, t) => a + (b - a) * t;
   
   /* ---- isometric projection ------------------------------------------------
      We work in a simple 2D "world" (x right, y up) and draw flat. A diamond is
      just a rhombus with width:height = 2:1 — the canonical isometric square.   */
   const ISO_W = 1.0;   // half-width  of a unit diamond
   const ISO_H = 0.5;   // half-height of a unit diamond  (2:1 ratio = isometric)
   
   /* a flat isometric diamond: filled face + thin outline on top.
      Fill mesh always present (so we can darken the active node's body). */
   function diamond(scale, color, fill) {
     const g = new THREE.Group();
     const w = ISO_W * scale, h = ISO_H * scale;
     const pts = [
       new THREE.Vector3(0,  h, 0),
       new THREE.Vector3(w,  0, 0),
       new THREE.Vector3(0, -h, 0),
       new THREE.Vector3(-w, 0, 0),
     ];
   
     const shape = new THREE.Shape();
     shape.moveTo(0, h); shape.lineTo(w, 0); shape.lineTo(0, -h); shape.lineTo(-w, 0); shape.lineTo(0, h);
     const fm = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: fill, depthWrite: false });
     const fillMesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), fm);
     fillMesh.position.z = -0.01;            // keep fill just behind the outline
     g.add(fillMesh);
     g.userData.fillMat = fm;
   
     const om = new THREE.LineBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 1 });
     g.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), om));
     g.userData.outMat = om;
     g.userData.hw = w; g.userData.hh = h;
     return g;
   }
   
   export class StackDiagram {
     /**
      * @param {HTMLElement} mount  position:relative element with a height
      * @param {Object} opts
      *   opts.model : [{label, subs:[{label,note}|string, …]}, …] for current lang
      *   opts.lang  : 'en' | 'zh'
      */
     constructor(mount, opts = {}) {
       if (!mount) throw new Error('StackDiagram: mount element required');
       this.mount = mount;
       this.model = normalize(opts.model || DEFAULT_MODEL);
       this.lang = (opts.lang || 'en').startsWith('zh') ? 'zh' : 'en';
       // Which root starts expanded. Default: the middle one (Industry).
       const defIdx = (opts.defaultOpen != null)
         ? opts.defaultOpen
         : Math.floor((this.model.length - 1) / 2);
       this.open = defIdx;
       // When false, clicking the open root won't collapse it (it stays expanded);
       // clicking another root still switches focus to that one.
       this.collapsible = opts.collapsible ?? false;
       this.hover = -1;
       this.layers = [];
   
       this._scene();
       this._build();
       this._labels();
       this._events();
       this._resize();
       this._tick = this._tick.bind(this);
       this._raf = requestAnimationFrame(this._tick);
     }
   
     _scene() {
       this.scene = new THREE.Scene();
       // straight orthographic, looking down -Z. No 3D tilt — the 2:1 rhombus
       // shape itself carries the isometric reading, dead clean.
       this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
       this.cam.position.set(0, 0, 5);
       this.cam.lookAt(0, 0, 0);
   
       this.gl = new THREE.WebGLRenderer({ antialias: true, alpha: true });
       this.gl.setClearColor(0x000000, 0);
       this.gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
       const cv = this.gl.domElement;
       cv.style.cssText = 'display:block;width:100%;height:100%;';
   
       // Defensive: the mount must be positioned (for the absolute label overlay).
       // We do NOT impose a height — that's the page CSS's job (#stack-mount /
       // .fig-inner min-height). Imposing one here fights the page and inflates
       // the canvas. We only wait (via ResizeObserver) until it has real size.
       const ms = getComputedStyle(this.mount);
       if (ms.position === 'static') this.mount.style.position = 'relative';
   
       this.mount.appendChild(cv);
   
       this.root = new THREE.Group();         // no rotation — flat 2D world
       this.scene.add(this.root);
   
       this.ray = new THREE.Raycaster();
       this.ptr = new THREE.Vector2();
       this.connectors = new THREE.Group();
       this.root.add(this.connectors);
     }
   
     _build() {
       const accent = css('--lilac', '#7a55cf');
       const ink = css('--fg', '#1c1b1a');
       this._accent = accent; this._ink = ink;
   
       /* three-column cascade, left → right:
            STACK_X : the unified stack (one pile of layers)
            ROOT_X  : the three clickable root nodes, spread vertically
            LEAF_X  : a root's three leaves, appear on click, centred on that root */
       const STACK_X = -4.6;
       const ROOT_X  = -1.4;
       const LEAF_X  =  2.2;
       const GAP     =  1.5;     // vertical gap between root nodes
       const top     = (this.model.length - 1) * GAP / 2;
       this._stackX = STACK_X; this._rootX = ROOT_X; this._leafX = LEAF_X;
       this._gap = GAP; this._top = top;
   
       /* --- the UNIFIED STACK (left): a tight pile of diamonds that the three
          root nodes branch off of. One bold object. --------------------------- */
       const body = new THREE.Group();
       const PACK = 0.40;
       const N = 5;                                  // diamonds in the pile
       for (let k = 0; k < N; k++) {
         const d = diamond(1.06, accent, 0.10);
         d.position.set(STACK_X, ((N - 1) / 2 - k) * PACK, 0);
         // crisp, present lines — front of pile strongest, fading gently back
         d.userData.outMat.opacity = 0.55 + 0.45 * (1 - k / (N - 1));
         d.userData.fillMat.opacity = 0.10;
         body.add(d);
       }
       this.root.add(body);
       this.stackBody = body;
       this._stackY = 0;                             // pile is centred on y=0
   
       /* --- the three ROOT NODES (middle) ----------------------------------- */
       this.model.forEach((d, i) => {
         const homeY = top - i * GAP;
   
         const layer = diamond(1.0, accent, 0.14);   // bolder resting fill
         layer.position.set(ROOT_X, homeY, 0);
         layer.userData.i = i;
         layer.userData.homeY = homeY;
         layer.userData.mix = 0;                     // 0 rest → 1 active emphasis
         const hit = new THREE.Mesh(
           new THREE.PlaneGeometry(ISO_W * 2, ISO_H * 2),
           new THREE.MeshBasicMaterial({ visible: false })
         );
         hit.userData.i = i;
         layer.add(hit);
         layer.userData.hit = hit;
   
         // leaves: branch right of the root, centred on the root's live Y.
         const LEAF_GAP = 1.5;
         const subs = d.subs.map((sub, j) => {
           const sd = diamond(0.8, accent, 0.14);
           sd.visible = false;
           sd.userData.label = sub.label;
           sd.userData.note = sub.note || '';
           sd.userData.j = j;
           sd.userData.leafGap = LEAF_GAP;
           sd.userData.mid = (d.subs.length - 1) / 2;
           sd.userData.home = new THREE.Vector3(ROOT_X, homeY, 0);
           sd.position.copy(sd.userData.home);
           sd.scale.setScalar(0.001);
           this.root.add(sd);
           return sd;
         });
         layer.userData.subs = subs;
   
         this.root.add(layer);
         this.layers.push(layer);
       });
     }
   
     _labels() {
       const wrap = document.createElement('div');
       wrap.style.cssText = `position:absolute;inset:0;pointer-events:none;font-family:var(--mono,'IBM Plex Mono',monospace);`;
       this.mount.appendChild(wrap);
       this.labelWrap = wrap;
   
       // top layer labels — one word, sit centered under each layer
       this.layerLabels = this.layers.map((_, i) => {
         const el = document.createElement('div');
         el.style.cssText =
           `position:absolute;transform:translate(-50%,-50%);font-size:11px;font-weight:600;` +
           `letter-spacing:.16em;text-transform:uppercase;white-space:nowrap;color:var(--fg,#1c1b1a);` +
           `cursor:pointer;pointer-events:auto;transition:opacity .3s ease,color .3s ease;`;
         el.textContent = this.model[i].label;
         el.addEventListener('click', () => this.toggle(i));
         wrap.appendChild(el);
         return el;
       });
   
       // leaf note cards — a small bordered box (title + note) right of each sub.
       // Internal balance: [lilac tick · TITLE] / hairline / note prose.
       this.subCards = this.layers.map((layer) =>
         layer.userData.subs.map((s) => {
           const card = document.createElement('div');
           card.style.cssText =
             `position:absolute;transform:translateY(-50%);width:max-content;min-width:148px;max-width:200px;` +
             `padding:11px 14px 12px;border:1.5px solid var(--line,#1c1b1a);background:var(--bg,#eeece3);` +
             `opacity:0;transition:opacity .3s ease;pointer-events:none;box-sizing:border-box;`;
   
           const head = document.createElement('div');
           head.style.cssText = `display:flex;align-items:center;gap:8px;`;
           const tick = document.createElement('span');
           tick.style.cssText = `width:6px;height:6px;flex:0 0 auto;background:var(--lilac,#7a55cf);`;
           const t = document.createElement('div');
           t.style.cssText = `font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;line-height:1.2;color:var(--fg,#1c1b1a);`;
           t.textContent = s.userData.label;
           head.append(tick, t);
   
           const hr = document.createElement('div');
           hr.style.cssText = `height:1px;background:var(--hair,#c4c1b7);margin:9px 0;`;
   
           const n = document.createElement('div');
           n.style.cssText = `font-size:11px;line-height:1.5;letter-spacing:.01em;color:var(--muted,#7e7b72);`;
           n.textContent = s.userData.note;
           n.className = 'sd-note';
   
           card.append(head, hr, n);
           wrap.appendChild(card);
           card.userData = { titleEl: t, noteEl: n };
           return card;
         })
       );
     }
   
     _events() {
       const cv = this.gl.domElement;
       this._move = (e) => {
         const r = cv.getBoundingClientRect();
         this.ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1;
         this.ptr.y = -((e.clientY - r.top) / r.height) * 2 + 1;
         this.ray.setFromCamera(this.ptr, this.cam);
         const hits = this.ray.intersectObjects(this.layers.map(l => l.userData.hit), false);
         let idx = -1;
         if (hits.length) idx = hits[0].object.userData.i;
         this.hover = idx;
         cv.style.cursor = idx >= 0 ? 'pointer' : 'default';
       };
       this._clk = () => { if (this.hover >= 0) this.toggle(this.hover); };
       this._rsz = () => this._resize();
       cv.addEventListener('pointermove', this._move);
       cv.addEventListener('click', this._clk);
       window.addEventListener('resize', this._rsz);
   
       // The mount may have zero height at construction (figure not laid out yet),
       // which would pin the canvas top-left. Observe the mount and re-frame the
       // moment it gets real dimensions, and on every subsequent size change.
       if (typeof ResizeObserver !== 'undefined') {
         this._ro = new ResizeObserver(() => this._resize());
         this._ro.observe(this.mount);
       }
     }
   
     toggle(i) {
       if (this.open === i) {
         // clicking the already-open root: only collapse if explicitly allowed
         if (this.collapsible) this.open = -1;
       } else {
         this.open = i;
       }
     }
   
     setModel(model, lang) {
       this.model = normalize(model);
       if (lang) this.lang = lang.startsWith('zh') ? 'zh' : 'en';
       this.layerLabels.forEach((el, i) => (el.textContent = this.model[i].label));
       this.layers.forEach((l, i) =>
         l.userData.subs.forEach((s, j) => {
           s.userData.label = this.model[i].subs[j].label;
           s.userData.note = this.model[i].subs[j].note || '';
           const card = this.subCards[i][j];
           card.userData.titleEl.textContent = s.userData.label;
           card.userData.noteEl.textContent = s.userData.note;
         }));
     }
   
     _project(x, y) {
       const v = new THREE.Vector3(x, y, 0).applyMatrix4(this.root.matrixWorld).project(this.cam);
       const r = this.gl.domElement.getBoundingClientRect();
       return { x: (v.x * 0.5 + 0.5) * r.width, y: (-v.y * 0.5 + 0.5) * r.height };
     }
   
     _tick() {
       this._raf = requestAnimationFrame(this._tick);
       const accent = new THREE.Color(this._accent || '#7a55cf');
       const deep = new THREE.Color(css('--lilac-deep', '#5d3db4'));
   
       this.layers.forEach((layer, i) => {
         const open = this.open === i;
         const active = open || this.hover === i;
         const ud = layer.userData;
   
         // emphasis stays in the lilac family (no black): active = deeper, bolder
         // fill + full line; resting = clean lilac; others recede but stay present.
         ud.mix = lerp(ud.mix, active ? 1 : 0, 0.16);
         const recede = (this.open >= 0 && !open) ? 0.55 : 1;   // others stay visible
   
         if (ud.outMat) {
           ud.outMat.color.copy(accent).lerp(deep, ud.mix);
           ud.outMat.opacity = lerp(0.9, 1, ud.mix) * recede;
         }
         if (ud.fillMat) {
           ud.fillMat.color.copy(accent).lerp(deep, ud.mix);
           ud.fillMat.opacity = lerp(0.14, 0.30, ud.mix) * recede;
         }
   
         // leaves branch right (LEAF_X), centred on the root's CURRENT y.
         ud.subs.forEach((s) => {
           const sd = s.userData;
           const leafY = layer.position.y + (sd.mid - sd.j) * sd.leafGap;
           const tx = open ? this._leafX : this._rootX;
           const ty = open ? leafY : layer.position.y;
           const target = open ? 1 : 0.001;
           if (open) s.visible = true;
           s.scale.x = lerp(s.scale.x, target, 0.18);
           s.scale.y = lerp(s.scale.y, target, 0.18);
           s.position.x = lerp(s.position.x, tx, 0.18);
           s.position.y = lerp(s.position.y, ty, 0.18);
           if (!open && s.scale.x < 0.02) s.visible = false;
           if (s.userData.outMat) s.userData.outMat.opacity = lerp(s.userData.outMat.opacity, open ? 1 : 0, 0.18);
           if (s.userData.fillMat) s.userData.fillMat.opacity = lerp(s.userData.fillMat.opacity, open ? 0.16 : 0, 0.18);
         });
       });
   
       // the unified stack stays bold; dims only slightly when a root is open
       if (this.stackBody) {
         const bodyT = this.open >= 0 ? 0.7 : 1;
         const N = this.stackBody.children.length;
         this.stackBody.children.forEach((d, k) => {
           const baseO = 0.55 + 0.45 * (1 - k / (N - 1));
           if (d.userData.outMat) d.userData.outMat.opacity = lerp(d.userData.outMat.opacity, baseO * bodyT, 0.12);
         });
       }
   
       // smoothly pan AND zoom between collapsed and open framings so each state
       // is centred and fully in-frame (open is wider: stack → leaves → cards).
       const targetCx = this.open >= 0 ? this._openCx() : this._collapsedCx();
       const targetHW = this.open >= 0 ? this._openHalfW() : this._collapsedHalfW();
       if (this._camCx === undefined) this._camCx = targetCx;
       if (this._halfWLive === undefined) this._halfWLive = targetHW;
       this._camCx = lerp(this._camCx, targetCx, 0.1);
       this._halfWLive = lerp(this._halfWLive, targetHW, 0.1);
       this._applyCam();
   
       this._connectors();
       this._placeLabels();
       this.gl.render(this.scene, this.cam);
     }
   
     _connectors() {
       while (this.connectors.children.length) {
         const c = this.connectors.children.pop(); c.geometry?.dispose(); this.connectors.remove(c);
       }
       const accentHex = css('--lilac', '#7a55cf');
       const line = (pts, opacity) =>
         this.connectors.add(new THREE.Line(
           new THREE.BufferGeometry().setFromPoints(pts),
           new THREE.LineBasicMaterial({ color: new THREE.Color(accentHex), transparent: true, opacity })
         ));
   
       /* STACK → ROOTS : a right-angle bracket from the unified stack out to each
          of the three root nodes. Always visible — this is the branching. */
       const stackRight = this._stackX + ISO_W;
       const sy = this._stackY;
       const trunkX = (stackRight + (this._rootX - ISO_W)) / 2;   // vertical trunk x
       line([new THREE.Vector3(stackRight, sy, 0), new THREE.Vector3(trunkX, sy, 0)], 0.85);
       // vertical trunk spanning the roots
       const ys = this.layers.map(l => l.position.y);
       line([new THREE.Vector3(trunkX, Math.min(...ys), 0), new THREE.Vector3(trunkX, Math.max(...ys), 0)], 0.85);
       // trunk → each root
       this.layers.forEach((layer) => {
         const open = this.open === layer.userData.i;
         const rx = layer.position.x - ISO_W, ry = layer.position.y;
         line([new THREE.Vector3(trunkX, ry, 0), new THREE.Vector3(rx, ry, 0)],
              (this.open >= 0 && !open) ? 0.45 : 0.85);
       });
   
       /* ROOT → LEAVES : bracket from the open root out to its leaves. */
       if (this.open >= 0) {
         const layer = this.layers[this.open];
         const lx = layer.position.x + ISO_W, ly = layer.position.y;
         const midX = (lx + (this._leafX - ISO_W * 0.8)) / 2;
         layer.userData.subs.forEach((s) => {
           if (s.scale.x < 0.3) return;
           const lfx = s.position.x - ISO_W * 0.8, lfy = s.position.y;
           line([
             new THREE.Vector3(lx, ly, 0), new THREE.Vector3(midX, ly, 0),
             new THREE.Vector3(midX, lfy, 0), new THREE.Vector3(lfx, lfy, 0),
           ], 0.9);
         });
       }
     }
   
     _placeLabels() {
       this.layers.forEach((layer, i) => {
         const open = this.open === i;
         // label sits just under each diamond
         const p = this._project(layer.position.x, layer.position.y - ISO_H - 0.34);
         const el = this.layerLabels[i];
         el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
         el.style.opacity = (this.open >= 0 && !open) ? '0.3' : '1';
         el.style.color = open ? 'var(--lilac-deep,#5d3db4)' : 'var(--fg,#1c1b1a)';
   
         layer.userData.subs.forEach((s, j) => {
           const card = this.subCards[i][j];
           if (open && s.scale.x > 0.4) {
             // card sits well clear to the right of the leaf's right vertex
             const sp = this._project(s.position.x + ISO_W * 0.74 + 0.55, s.position.y);
             card.style.left = sp.x + 'px';
             card.style.top = sp.y + 'px';
             card.style.opacity = '1';
           } else {
             card.style.opacity = '0';
           }
         });
       });
     }
   
     _resize() {
        const w = this.mount.clientWidth, h0 = this.mount.clientHeight;
        if (!w || !h0) return;                

        // FIX: Remove the MAX_H and ratio clamp to allow it to fill the div
        const h = h0; 

        this.gl.setSize(w, h, false);
        const cv = this.gl.domElement;
        cv.style.height = h + 'px';
        cv.style.position = 'absolute';
        cv.style.top = '50%';
        cv.style.left = '0';
        cv.style.transform = 'translateY(-50%)';

        if (this.labelWrap) {
        this.labelWrap.style.height = h + 'px';
        this.labelWrap.style.top = '50%';
        this.labelWrap.style.transform = 'translateY(-50%)';
        this.labelWrap.style.bottom = 'auto';
        }

        this._w = w; this._h = h;
        this._aspect = w / h;
        this._narrow = w < 720;
        if (this._camCx === undefined) {
        this._camCx = this.open >= 0 ? this._openCx() : this._collapsedCx();
        this._halfWLive = this.open >= 0 ? this._openHalfW() : this._collapsedHalfW();
        }
        this._applyCam();
     }
   
     _applyCam() {
       const halfW = this._halfWLive ?? this._halfW, aspect = this._aspect || 1;
       const cx = this._camCx ?? this._collapsedCx();
       const cy = this._camCy ?? 0;
       this.cam.left = cx - halfW;
       this.cam.right = cx + halfW;
       this.cam.top = cy + halfW / aspect;
       this.cam.bottom = cy - halfW / aspect;
       this.cam.updateProjectionMatrix();
     }
   
     // --- per-state framing -----------------------------------------------------
     // We fit the content box [spanX] × [spanY] into the canvas, taking the LARGER
     // of the width- and height-derived half-widths so BOTH axes fit — but no more.
     // This makes the content fill its tight dimension instead of leaving big
     // top/bottom margins on short, wide figures.
     _spanCollapsed() {
        const lo = (this._stackX ?? -4.6) - ISO_W;
        const hi = (this._rootX ?? -1.4) + ISO_W;
        // FIX: Use the actual Y-coordinate of the top node (this._top)
        const halfH = (this._top ?? 1.6) + ISO_H + 0.5;          
        return { lo, hi, halfH };
      }
    
      _spanOpen() {
        const lo = (this._stackX ?? -4.6) - ISO_W;
        const leafRight = (this._leafX ?? 2.2) + ISO_W * 0.8;
        const cardGap = 1.0;
        const cardW = 200 * (this._halfWLive ? (2 * this._halfWLive) / (this._w || 900) : 0.012);
        const hi = leafRight + cardGap + cardW;
        const leafGap = 2.0;
        // FIX: Add this._top so the camera accounts for the highest/lowest root nodes
        const halfH = (this._top ?? 1.6) + leafGap + ISO_H + 0.45;     
        return { lo, hi, halfH };
      }
     _collapsedCx() { const { lo, hi } = this._spanCollapsed(); return (lo + hi) / 2; }
     _openCx()      { const { lo, hi } = this._spanOpen();      return (lo + hi) / 2; }
   
     // half-width that fits the box on both axes (× margin). The height term is
     // converted to an equivalent half-width via aspect.
     _fitHalfW(span, margin) {
       const aspect = this._aspect || 1.6;
       const wByX = (span.hi - span.lo) / 2 * margin;
       const wByY = span.halfH * margin * aspect;     // height → half-width
       return Math.max(wByX, wByY);
     }
     _collapsedHalfW() { return this._fitHalfW(this._spanCollapsed(), 1.00); }
     _openHalfW()      { return this._fitHalfW(this._spanOpen(), 1.00); }
   
     destroy() {
       cancelAnimationFrame(this._raf);
       const cv = this.gl.domElement;
       cv.removeEventListener('pointermove', this._move);
       cv.removeEventListener('click', this._clk);
       window.removeEventListener('resize', this._rsz);
       if (this._ro) this._ro.disconnect();
       this.scene.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
       this.gl.dispose();
       cv.remove(); this.labelWrap.remove();
     }
   }
   
   /* allow subs to be plain strings or {label, note} — normalize to objects */
   function normalize(model) {
     return model.map((layer) => ({
       label: layer.label,
       subs: (layer.subs || []).map((s) => (typeof s === 'string' ? { label: s, note: '' } : { label: s.label, note: s.note || '' })),
     }));
   }
   
   const DEFAULT_MODEL = [
     { label: 'State',      subs: [
       { label: 'Regulatory Design',     note: 'Rules, mandates, and the levers of compliance.' },
       { label: 'Institutional Strategy',note: 'How agencies and bodies actually move.' },
       { label: 'Standards & Norms',     note: 'The soft architecture that hardens over time.' } ] },
     { label: 'Industry',   subs: [
       { label: 'Commercial ML',         note: 'Where capability is built and shipped.' },
       { label: 'Deployment & Safety',   note: 'Getting systems into the world responsibly.' },
       { label: 'Procurement',           note: 'The contracts that shape what gets made.' } ] },
     { label: 'Grassroots', subs: [
       { label: 'Community Convening',   note: 'Bringing the right people to the table.' },
       { label: 'Field-Building',        note: 'Growing the talent the work requires.' },
       { label: 'Public Interest',       note: 'Keeping the public in public policy.' } ] },
   ];