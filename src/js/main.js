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
   import '../styles/article.css';
   
   const { ui, work, contact, siteTitle, metaDescription, social } = content;
   
   /* current language — starts in English */
   let lang = 'en';
   
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
      Hero animation: the whole headline rises and fades in as one unit. No text
      splitting — the <h2> simply gets the `ready` class, which the CSS animates.
      This is language-agnostic (English, Chinese, anything) and can't be broken by
      edits, resizing, or punctuation, because it never touches the text content.
      --------------------------------------------------------------------------- */
   function revealHero() {
     const h = document.getElementById('heroH2');
     if (!h) return;
     // next frame so the transition runs from the hidden start state
     requestAnimationFrame(() => h.classList.add('ready'));
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
   function setLang(next) {
     lang = next;
   
     document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
     document.body.classList.toggle('lang-zh', lang === 'zh');
     document.title = siteTitle[lang];
   
     // keep all the head metadata in sync with the current language + content.json.
     // (the HTML ships with English fallbacks for crawlers that don't run JS.)
     const setMeta = (selector, value) => {
       const el = document.querySelector(selector);
       if (el && value != null) el.setAttribute('content', value);
     };
     const title = siteTitle[lang];
     const desc = metaDescription[lang];
     setMeta('meta[name="description"]', desc);
     setMeta('meta[property="og:title"]', title);
     setMeta('meta[property="og:description"]', desc);
     setMeta('meta[name="twitter:title"]', title);
     setMeta('meta[name="twitter:description"]', desc);
     if (social) {
       setMeta('meta[property="og:url"]', social.url);
       setMeta('meta[property="og:image"]', social.image);
       setMeta('meta[name="twitter:image"]', social.image);
     }
   
     // swap every element tagged with a UI key
     document.querySelectorAll('[data-i18n]').forEach((el) => {
       const key = el.getAttribute('data-i18n');
       if (ui[key] && ui[key][lang] != null) el.innerHTML = ui[key][lang];
     });
   
     // city sits under contact (per-language) rather than ui
     document.querySelectorAll('[data-city]').forEach((el) => {
       el.textContent = contact.city[lang];
     });
   
     document.getElementById('langToggle').setAttribute('data-lang', lang);
   
     renderWork();
     revealHero();
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
   
     // Set up the page text first.
     setLang('en');
   
     // revealHero() was just called inside setLang. If fonts are still loading,
     // the headline is already rising — that's fine, the whole-element fade isn't
     // affected by a font swap the way per-word measuring would be. Nothing else
     // to coordinate.
   }
   
   if (document.readyState === 'loading') {
     document.addEventListener('DOMContentLoaded', init);
   } else {
     init();
   }