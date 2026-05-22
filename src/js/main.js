/* ===========================================================================
   Josephine Shen — site behaviour
   ---------------------------------------------------------------------------
   All visible text lives in ../content/content.json. Nothing here is
   hardcoded copy — this file only reads from that JSON and wires up the
   interactions (language toggle, work accordion, hero animation, scroll
   reveals). To change wording, edit content.json, not this file.
   =========================================================================== */

   import content from '../content/content.json';
   import '../styles/main.css';
   
   const { ui, work, contact, siteTitle, metaDescription } = content;
   
   /* current language — starts in English */
   let lang = 'en';
   
   /* becomes true once the hero clip-and-rise animation has played, so later
      re-layouts (resize, language toggle) snap into place instead of replaying */
   let heroRevealed = false;
   
   /* ---------------------------------------------------------------------------
      Scroll reveal: fade/slide elements in as they enter the viewport.
      --------------------------------------------------------------------------- */
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
   
   /* ---------------------------------------------------------------------------
      Work index: build the expanding accordion list from content.work.
      One panel open at a time.
      --------------------------------------------------------------------------- */
   function renderWork() {
     const list = document.getElementById('workList');
   
     list.innerHTML = work.map((entry, i) => {
       const no = String(i + 1).padStart(2, '0');
       const paragraphs = entry.body[lang].map((p) => `<p>${p}</p>`).join('');
       return `
         <div class="w-item reveal" data-i="${i}">
           <button class="w-row" type="button" aria-expanded="false">
             <span class="w-no mono-en-keep">${no}</span>
             <span class="w-title">${entry.title[lang]}</span>
             <span class="w-meta">
               <span class="w-yr mono-en-keep">${entry.yr}</span>
               <span class="w-sign" aria-hidden="true"></span>
             </span>
           </button>
           <div class="w-panel">
             <div class="w-panel-in">
               <div class="pad"></div>
               <div class="w-body">
                 ${paragraphs}
                 <a class="w-readmore" href="${entry.readMoreUrl || '#'}">${ui.read_more[lang]} &rarr;</a>
               </div>
             </div>
           </div>
         </div>`;
     }).join('');
   
     // wire the accordion behaviour (one open at a time)
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
   
   /* ---------------------------------------------------------------------------
      Hero animation: split the headline into lines and clip+rise each one.
      Works the same way for English (word atoms) and Chinese (character atoms).
      --------------------------------------------------------------------------- */
   function splitHero(reveal = true) {
     const h = document.getElementById('heroH2');
     if (!h) return;
   
     if (!h.dataset.heroText) {
       h.dataset.heroText = h.textContent.trim();
     }
     const text = h.dataset.heroText;
     const isCJK = /[\u4e00-\u9fff]/.test(text);
     const atoms = isCJK
       ? Array.from(text)
       : text.split(/(\s+)/).filter((t) => t !== '');
   
     // temporarily wrap each atom so we can measure which line it lands on
     h.innerHTML = atoms.map((a) => {
       if (/^\s+$/.test(a)) return a;
       return `<span class="probe" style="display:inline-block">${a}</span>`;
     }).join(isCJK ? '' : ' ');
   
     const probes = Array.from(h.querySelectorAll('.probe'));
     const lines = [];
     let current = null;
     let lastTop = null;
   
     probes.forEach((p) => {
       const top = p.offsetTop;
       if (lastTop === null || Math.abs(top - lastTop) > 4) {
         current = [];
         lines.push(current);
         lastTop = top;
       }
       current.push(p.textContent);
     });
   
     h.innerHTML = lines.map((words) => {
       let str = isCJK ? words.join('') : words.join(' ');
       str = str.replace(/([.。])\s*$/, '<span class="dot">$1</span>');
       return `<span class="line"><span class="inner">${str}</span></span>`;
     }).join('');
   
     h.classList.add('ready');
     const lineEls = h.querySelectorAll('.line');
     if (reveal) {
       // staggered clip-and-rise
       heroRevealed = true;
       lineEls.forEach((el, i) => {
         setTimeout(() => el.classList.add('in'), 120 + i * 140);
       });
     } else if (heroRevealed) {
       // re-layout (e.g. on resize) after the reveal already played:
       // snap lines into their final position with no animation
       lineEls.forEach((el) => el.classList.add('in'));
     }
     // if !reveal and not yet revealed, leave lines clipped — the font-ready
     // pass will call splitHero(true) to play the reveal.
   }
   
   /* ---------------------------------------------------------------------------
      Static (non-i18n) content pulled from content.json — emails, links, etc.
      Filled once on load; doesn't change with language.
      --------------------------------------------------------------------------- */
   function fillStatic() {
     document.querySelectorAll('[data-email]').forEach((el) => {
       el.textContent = contact.email;
       if (el.tagName === 'A') el.setAttribute('href', `mailto:${contact.email}`);
     });
     document.querySelectorAll('[data-linkedin]').forEach((el) => {
       el.textContent = contact.linkedinLabel;
       if (el.tagName === 'A') el.setAttribute('href', contact.linkedinUrl);
     });
     document.querySelectorAll('[data-languages]').forEach((el) => {
       el.textContent = contact.languages;
     });
     document.querySelectorAll('[data-year]').forEach((el) => {
       el.textContent = contact.year;
     });
   }
   
   /* ---------------------------------------------------------------------------
      Apply a language: swap all [data-i18n] text, the page title/meta, the
      toggle state, and re-render the work list + hero.
      --------------------------------------------------------------------------- */
   function setLang(next, revealHero = true) {
     lang = next;
   
     document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
     document.body.classList.toggle('lang-zh', lang === 'zh');
     document.title = siteTitle[lang];
   
     const meta = document.querySelector('meta[name="description"]');
     if (meta && metaDescription[lang]) meta.setAttribute('content', metaDescription[lang]);
   
     // swap every element tagged with a UI key
     document.querySelectorAll('[data-i18n]').forEach((el) => {
       const key = el.getAttribute('data-i18n');
       if (ui[key] && ui[key][lang] != null) el.innerHTML = ui[key][lang];
     });
   
     const heroEl = document.getElementById('heroH2');
     if (heroEl) delete heroEl.dataset.heroText;
   
     // city sits under contact (per-language) rather than ui
     document.querySelectorAll('[data-city]').forEach((el) => {
       el.textContent = contact.city[lang];
     });
   
     document.getElementById('langToggle').setAttribute('data-lang', lang);
   
     renderWork();
     splitHero(revealHero);
   }
   
   /* ---------------------------------------------------------------------------
      Boot.
      --------------------------------------------------------------------------- */
   function init() {
     fillStatic();
     observeReveals();
   
     document.getElementById('langToggle').addEventListener('click', () => {
       setLang(lang === 'en' ? 'zh' : 'en');
     });
   
     // Lay out the page (text, work list, hero) up front. It's still hidden by the
     // `fonts-loading` gate on <body>, so nothing is visible yet — which means the
     // user never sees the fallback-font layout. We don't play the hero reveal yet.
     setLang('en', false);
   
     // Reveal the page once the web fonts are ready: drop the gate so the content
     // fades in (already in the correct fonts, so no reflow/jump), then play the
     // hero animation now that everything is measured against the real fonts.
     let revealed = false;
     const revealPage = () => {
       if (revealed) return;
       revealed = true;
       document.body.classList.remove('fonts-loading');
       splitHero(true); // re-measure against real fonts + play the rise
     };
   
     const fontsReady = document.fonts && document.fonts.ready;
     if (fontsReady) {
       // nudge the browser to fetch the weights the hero actually uses
       Promise.all([
         document.fonts.load('700 4rem Inconsolata'),
         document.fonts.load('500 2rem Newsreader'),
       ]).catch(() => {});
       document.fonts.ready.then(revealPage);
     }
     // safety net: reveal anyway after 2s if fonts.ready never resolves
     // (or if the Font Loading API is unavailable)
     setTimeout(revealPage, 2000);
   
     // re-measure hero line breaks on resize (layout only, no re-animation)
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