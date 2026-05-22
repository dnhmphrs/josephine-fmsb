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
   
   /* a flat isometric diamond: thin outline + (optional) very faint fill */
   function diamond(scale, color, fill) {
     const g = new THREE.Group();
     const w = ISO_W * scale, h = ISO_H * scale;
     const pts = [
       new THREE.Vector3(0,  h, 0),
       new THREE.Vector3(w,  0, 0),
       new THREE.Vector3(0, -h, 0),
       new THREE.Vector3(-w, 0, 0),
     ];
   
     if (fill > 0) {
       const shape = new THREE.Shape();
       shape.moveTo(0, h); shape.lineTo(w, 0); shape.lineTo(0, -h); shape.lineTo(-w, 0); shape.lineTo(0, h);
       const fm = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: fill, depthWrite: false });
       g.add(new THREE.Mesh(new THREE.ShapeGeometry(shape), fm));
       g.userData.fillMat = fm;
     }
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
       this.open = -1;
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
       const STACK_X = -2.4;     // x of the main stacked column
       const GAP = 0.92;         // vertical gap between stacked layers
       const top = (this.model.length - 1) * GAP / 2;
   
       this.model.forEach((d, i) => {
         const homeY = top - i * GAP;
   
         // a layer = one clean diamond (single accent outline, whisper fill)
         const layer = diamond(1.0, accent, 0.04);
         layer.position.set(STACK_X, homeY, 0);
         layer.userData.i = i;
         layer.userData.homeY = homeY;
         layer.userData.emph = 0;
         // dedicated invisible hit-plane (bigger, easier to click than a line)
         const hit = new THREE.Mesh(
           new THREE.PlaneGeometry(ISO_W * 2, ISO_H * 2),
           new THREE.MeshBasicMaterial({ visible: false })
         );
         hit.userData.i = i;
         layer.add(hit);
         layer.userData.hit = hit;
   
         // sublayers: stacked vertically just to the right of the column when open
         const SUB_X = 0.9, SUB_GAP = 0.92;
         const subTop = (d.subs.length - 1) * SUB_GAP / 2;
         const subs = d.subs.map((sub, j) => {
           const sd = diamond(0.72, accent, 0.05);
           sd.visible = false;
           sd.userData.label = sub.label;
           sd.userData.note = sub.note || '';
           sd.userData.fan = new THREE.Vector3(SUB_X, subTop - j * SUB_GAP, 0);
           sd.userData.home = new THREE.Vector3(STACK_X, homeY, 0);
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
   
       // leaf note cards — a small bordered box (title + note) right of each sub
       this.subCards = this.layers.map((layer) =>
         layer.userData.subs.map((s) => {
           const card = document.createElement('div');
           card.style.cssText =
             `position:absolute;transform:translateY(-50%);min-width:120px;max-width:190px;` +
             `padding:8px 11px;border:1px solid var(--hair,#c4c1b7);background:var(--bg,#eeece3);` +
             `opacity:0;transition:opacity .3s ease;pointer-events:none;`;
           const t = document.createElement('div');
           t.style.cssText = `font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--fg,#1c1b1a);`;
           t.textContent = s.userData.label;
           const n = document.createElement('div');
           n.style.cssText = `margin-top:4px;font-size:10.5px;line-height:1.45;letter-spacing:.02em;color:var(--muted,#7e7b72);`;
           n.textContent = s.userData.note;
           n.className = 'sd-note';
           card.append(t, n);
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
     }
   
     toggle(i) { this.open = (this.open === i) ? -1 : i; }
   
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
   
       this.layers.forEach((layer, i) => {
         const open = this.open === i;
         const ud = layer.userData;
   
         // emphasis via outline opacity — kept simple and flat (no fill tweening).
         const emphT = (open || this.hover === i) ? 1 : 0;
         ud.emph = lerp(ud.emph, emphT, 0.18);
         // active layers read at full strength; when one is open the others
         // recede to a clear-but-quiet 0.5 (still crisp, just secondary).
         const base = (this.open < 0 || open) ? lerp(0.78, 1, ud.emph) : 0.5;
         if (ud.outMat) ud.outMat.opacity = base;
   
         ud.subs.forEach((s) => {
           const target = open ? 1 : 0.001;
           const tp = open ? s.userData.fan : s.userData.home;
           if (open) s.visible = true;
           s.scale.x = lerp(s.scale.x, target, 0.18);
           s.scale.y = lerp(s.scale.y, target, 0.18);
           s.position.x = lerp(s.position.x, tp.x, 0.18);
           s.position.y = lerp(s.position.y, tp.y, 0.18);
           if (!open && s.scale.x < 0.02) s.visible = false;
           if (s.userData.outMat) s.userData.outMat.opacity = lerp(s.userData.outMat.opacity, open ? 1 : 0, 0.18);
         });
       });
   
       this._connectors();
       this._placeLabels();
       this.gl.render(this.scene, this.cam);
     }
   
     _connectors() {
       while (this.connectors.children.length) {
         const c = this.connectors.children.pop(); c.geometry?.dispose(); this.connectors.remove(c);
       }
       if (this.open < 0) return;
       const layer = this.layers[this.open];
       const mat = new THREE.LineBasicMaterial({ color: new THREE.Color(css('--lilac', '#7a55cf')), transparent: true, opacity: 0.6 });
       const lx = layer.position.x + ISO_W, ly = layer.position.y, midX = 0.2;
       layer.userData.subs.forEach((s) => {
         if (s.scale.x < 0.3) return;
         const sx = s.position.x - ISO_W * 0.72, sy = s.position.y;
         const pts = [
           new THREE.Vector3(lx, ly, 0), new THREE.Vector3(midX, ly, 0),
           new THREE.Vector3(midX, sy, 0), new THREE.Vector3(sx, sy, 0),
         ];
         this.connectors.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
       });
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
             // card to the right of the leaf's right vertex
             const sp = this._project(s.position.x + ISO_W * 0.72 + 0.18, s.position.y);
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
       const w = this.mount.clientWidth || 600, h = this.mount.clientHeight || 480;
       this.gl.setSize(w, h, false);
       const aspect = w / h;
       // Frame a fixed WORLD WIDTH (so the column + cards always fit horizontally),
       // then derive the vertical span from aspect. Center on the content's middle
       // x (~0), nudged right a touch to leave the left margin tidy.
       const halfW = aspect < 1 ? 4.6 : 4.2;    // world half-width visible
       const cx = 0.55;                         // horizontal center of the framing
       this.cam.left = cx - halfW;
       this.cam.right = cx + halfW;
       this.cam.top = halfW / aspect;
       this.cam.bottom = -halfW / aspect;
       this.cam.updateProjectionMatrix();
     }
   
     destroy() {
       cancelAnimationFrame(this._raf);
       const cv = this.gl.domElement;
       cv.removeEventListener('pointermove', this._move);
       cv.removeEventListener('click', this._clk);
       window.removeEventListener('resize', this._rsz);
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