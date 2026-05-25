/* ===========================================================================
   Josephine Shen — site behaviour
   ---------------------------------------------------------------------------
   All visible text lives in ../content/content.json. This file reads from that
   JSON and wires the interactions: language toggle, key-areas grid, work
   accordion, practice capsules, hero reveal, scroll reveals, and the
   interactive stack diagram. To change wording, edit content.json.
   =========================================================================== */

   import content from '../content/content.json';
   import '../styles/main.css';
   import { StackDiagram } from './stack-diagram.js';
   
   const { ui, work, areas, contact, siteTitle, metaDescription } = content;
   
   const SPARK = '<svg class="spark"><use href="#spark"/></svg>';
   
   let lang = 'en';
   let stackDiagram = null;
   let heroRevealed = false;
   
   /* ---------- scroll reveal ---------- */
   const revealObserver = new IntersectionObserver((entries) => {
     entries.forEach((entry) => {
       if (entry.isIntersecting) {
         entry.target.classList.add('in');
         revealObserver.unobserve(entry.target);
       }
     });
   }, { threshold: 0.12 });
   
   function observeReveals(root = document) {
     root.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));
   }
   
   /* ---------- KEY AREAS: four-up grid, expand on click (one open at a time) ---------- */
   function renderAreas() {
     const grid = document.getElementById('areasGrid');
     const items = areas[lang];
     grid.innerHTML = items.map((a, i) => {
       const no = String(i + 1).padStart(2, '0');
       return `
         <div class="area" data-i="${i}">
           <div class="area-mark">
             ${SPARK}
             <span class="area-no">${no}</span>
           </div>
           <div class="area-title">${a.title}</div>
           <div class="area-body">${a.body}</div>
         </div>`;
     }).join('');
   
     grid.querySelectorAll('.area').forEach((el) => {
       el.addEventListener('click', () => {
         const open = el.classList.contains('active');
         grid.querySelectorAll('.area.active').forEach((o) => o.classList.remove('active'));
         if (!open) el.classList.add('active');
       });
     });
   }
   
   /* ---------- PRACTICE capsules ---------- */
   function renderCapsules() {
     const wrap = document.getElementById('capsules');
     const roles = ui.roles_list[lang].split('/').map((s) => s.trim()).filter(Boolean);
     wrap.innerHTML = roles.map((r) =>
       `<span class="capsule">${SPARK}<span>${r}</span></span>`
     ).join('');
   }
   
   /* ---------- WORK accordion ---------- */
   function renderWork() {
     const list = document.getElementById('workList');
     list.innerHTML = work.map((entry, i) => {
       const no = String(i + 1).padStart(2, '0');
       const paragraphs = entry.body[lang].map((p) => `<p>${p}</p>`).join('');
       return `
         <div class="w-item reveal" data-i="${i}">
           <button class="w-row" type="button" aria-expanded="false">
             ${SPARK.replace('class="spark"', 'class="spark w-spark"')}
             <span class="w-title">${entry.title[lang]}</span>
             <span class="w-meta">
               ${entry.tag ? `<span class="w-tag">${entry.tag}</span>` : ''}
               <span class="w-yr">${entry.yr}</span>
             </span>
           </button>
           <div class="w-panel">
             <div class="w-panel-in">
               <div class="w-side"><span>${no}</span></div>
               <div class="w-body">
                 ${paragraphs}
                 <a class="w-readmore" href="${entry.readMoreUrl || '#'}">
                   ${SPARK}<span class="lab">${ui.read_more[lang]}</span>
                 </a>
               </div>
             </div>
           </div>
         </div>`;
     }).join('');
   
     list.querySelectorAll('.w-item').forEach((item) => {
       const row = item.querySelector('.w-row');
       const panel = item.querySelector('.w-panel');
       row.addEventListener('click', () => {
         const isOpen = item.classList.contains('open');
         list.querySelectorAll('.w-item.open').forEach((open) => {
           open.classList.remove('open');
           open.querySelector('.w-panel').style.maxHeight = '0px';
           open.querySelector('.w-row').setAttribute('aria-expanded', 'false');
         });
         if (!isOpen) {
           item.classList.add('open');
           panel.style.maxHeight = `${panel.scrollHeight}px`;
           row.setAttribute('aria-expanded', 'true');
         }
       });
     });
   
     observeReveals(list);
   }
   
   /* ---------- HERO line-clip reveal ---------- */
   function splitHero(reveal = true) {
     const h = document.getElementById('heroH1');
     if (!h) return;
   
     if (!h.dataset.heroText) h.dataset.heroText = h.textContent.trim();
     const text = h.dataset.heroText;
     const isCJK = /[\u4e00-\u9fff]/.test(text);
     const atoms = isCJK ? Array.from(text) : text.split(/(\s+)/).filter((t) => t !== '');
   
     h.innerHTML = atoms.map((a) => {
       if (/^\s+$/.test(a)) return a;
       return `<span class="probe" style="display:inline-block">${a}</span>`;
     }).join(isCJK ? '' : ' ');
   
     const probes = Array.from(h.querySelectorAll('.probe'));
     const lines = [];
     let current = null, lastTop = null;
     probes.forEach((p) => {
       const top = p.offsetTop;
       if (lastTop === null || Math.abs(top - lastTop) > 4) {
         current = []; lines.push(current); lastTop = top;
       }
       current.push(p.textContent);
     });
   
     h.innerHTML = lines.map((words) => {
       let str = isCJK ? words.join('') : words.join(' ');
       str = str.replace(/([.。])\s*$/, '<span class="em">$1</span>');
       return `<span class="line"><span class="inner">${str}</span></span>`;
     }).join('');
   
     const lineEls = h.querySelectorAll('.line');
     if (reveal) {
       heroRevealed = true;
       lineEls.forEach((el, i) => setTimeout(() => el.classList.add('in'), 100 + i * 130));
     } else if (heroRevealed) {
       lineEls.forEach((el) => el.classList.add('in'));
     }
   }
   
   /* ---------- static (non-i18n) content ---------- */
   function fillStatic() {
     document.querySelectorAll('[data-email]').forEach((el) => {
       el.textContent = contact.email;
       if (el.tagName === 'A') el.setAttribute('href', `mailto:${contact.email}`);
     });
     document.querySelectorAll('[data-linkedin]').forEach((el) => {
       el.textContent = contact.linkedinLabel;
       if (el.tagName === 'A') el.setAttribute('href', contact.linkedinUrl);
     });
     document.querySelectorAll('[data-languages]').forEach((el) => { el.textContent = contact.languages; });
     document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = contact.year; });
   }
   
   /* ---------- apply language ---------- */
   function setLang(next, revealHero = true) {
     lang = next;
     document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
     document.body.classList.toggle('lang-zh', lang === 'zh');
     document.title = siteTitle[lang];
   
     const meta = document.querySelector('meta[name="description"]');
     if (meta && metaDescription[lang]) meta.setAttribute('content', metaDescription[lang]);
   
     document.querySelectorAll('[data-i18n]').forEach((el) => {
       const key = el.getAttribute('data-i18n');
       if (!ui[key] || ui[key][lang] == null) return;
       // preserve the trailing spark inside the footer statement
       const keepSpark = el.querySelector('.spark') && el.classList.contains('footer-statement');
       if (keepSpark) {
         el.innerHTML = ui[key][lang] + ' ' + SPARK;
       } else {
         el.innerHTML = ui[key][lang];
       }
     });
   
     const heroEl = document.getElementById('heroH1');
     if (heroEl) delete heroEl.dataset.heroText;
   
     document.querySelectorAll('[data-city]').forEach((el) => { el.textContent = contact.city[lang]; });
     document.getElementById('langToggle').setAttribute('data-lang', lang);
   
     renderAreas();
     renderCapsules();
     renderWork();
     splitHero(revealHero);
   
     if (stackDiagram && content.diagram && content.diagram[lang]) {
       stackDiagram.setModel(content.diagram[lang], lang);
     }
   }
   
   /* ---------- boot ---------- */
   function init() {
     fillStatic();
     observeReveals();
   
     document.getElementById('langToggle').addEventListener('click', () => {
       setLang(lang === 'en' ? 'zh' : 'en');
     });
   
     setLang('en', false);
   
     const stackMount = document.getElementById('stack-mount');
     if (stackMount) {
       stackDiagram = new StackDiagram(stackMount, {
         model: (content.diagram && content.diagram[lang]) || undefined,
         lang,
       });
     }
   
     let revealed = false;
     const revealPage = () => {
       if (revealed) return;
       revealed = true;
       document.body.classList.remove('fonts-loading');
       splitHero(true);
     };
   
     if (document.fonts && document.fonts.ready) {
       Promise.all([
         document.fonts.load('600 4rem Archivo'),
         document.fonts.load('400 1rem "Space Mono"'),
       ]).catch(() => {});
       document.fonts.ready.then(revealPage);
     }
     setTimeout(revealPage, 2000);
   
     let resizeTimer;
     window.addEventListener('resize', () => {
       clearTimeout(resizeTimer);
       resizeTimer = setTimeout(() => splitHero(false), 200);
     });
   }
   
   if (document.readyState === 'loading') {
     document.addEventListener('DOMContentLoaded', init);
   } else {
     init();
   }