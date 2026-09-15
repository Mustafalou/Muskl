#!/usr/bin/env node
/**
 * Builds the showcase site in every language the app supports:
 *
 *   node site/build.js
 *
 * `site/pages/*.html` are templates and `site/locales/<lang>.json` their text, the same way the
 * app keeps `src/i18n/locales`. French is written at the root of `docs/`, so the site's original
 * URLs (including the privacy policy linked from the stores) keep working; every other language
 * gets its own folder, e.g. `docs/en/installation.html`. Assets stay shared in `docs/assets/`.
 *
 * Template syntax:
 *   {{t:key.path}}     translated text, inserted as HTML — translations may contain markup
 *   {{json:key.path}}  a translated object as JSON, for inline scripts
 *   {{root}} {{lang}} {{canonical}} {{alternates}} {{langSwitcher}} {{langRedirect}}
 *
 * A missing key fails the build instead of shipping a page with a hole in it.
 */
const fs = require('fs');
const path = require('path');

const SITE_URL = 'https://muskl.mynextgen.be';
const OUT = path.join(__dirname, '..', 'docs');
const PAGES = ['index.html', 'installation.html', 'privacy.html'];

// Same languages and flags as the app's language picker (Portuguese is Brazilian there too).
const LANGUAGES = [
  { code: 'fr', htmlLang: 'fr', dir: '', flag: '🇫🇷', name: 'Français' },
  { code: 'en', htmlLang: 'en', dir: 'en/', flag: '🇬🇧', name: 'English' },
  { code: 'es', htmlLang: 'es', dir: 'es/', flag: '🇪🇸', name: 'Español' },
  { code: 'de', htmlLang: 'de', dir: 'de/', flag: '🇩🇪', name: 'Deutsch' },
  { code: 'nl', htmlLang: 'nl', dir: 'nl/', flag: '🇳🇱', name: 'Nederlands' },
  { code: 'pt', htmlLang: 'pt-BR', dir: 'pt/', flag: '🇧🇷', name: 'Português' },
  { code: 'tr', htmlLang: 'tr', dir: 'tr/', flag: '🇹🇷', name: 'Türkçe' },
];
const DEFAULT_LANGUAGE = LANGUAGES[0];

function lookup(dictionary, keyPath) {
  return keyPath.split('.').reduce((node, part) => (node == null ? undefined : node[part]), dictionary);
}

function escapeAttribute(text) {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function pageUrl(language, page) {
  // index.html is linked as the folder itself: that's the URL people type and share.
  return `${SITE_URL}/${language.dir}${page === 'index.html' ? '' : page}`;
}

function alternates(page) {
  return [
    ...LANGUAGES.map((language) => `<link rel="alternate" hreflang="${language.htmlLang}" href="${pageUrl(language, page)}" />`),
    `<link rel="alternate" hreflang="x-default" href="${pageUrl(DEFAULT_LANGUAGE, page)}" />`,
  ].join('\n');
}

// A <details> dropdown: works without JavaScript. The script only remembers an explicit choice.
function langSwitcher(current, page, dictionary) {
  const root = current.dir ? '../' : '';
  const links = LANGUAGES.map((language) => {
    const isCurrent = language.code === current.code ? ' aria-current="true"' : '';
    return `      <a href="${root}${language.dir}${page}" hreflang="${language.htmlLang}" lang="${language.htmlLang}" data-lang="${language.code}"${isCurrent}><span class="flag">${language.flag}</span>${language.name}</a>`;
  }).join('\n');

  return `<details class="lang-switch">
    <summary aria-label="${escapeAttribute(lookup(dictionary, 'common.language'))}"><span class="flag">${current.flag}</span><span class="lang-name">${current.name}</span></summary>
    <div class="lang-menu">
${links}
    </div>
  </details>
  <script>
    // An explicit choice beats the browser's language on later visits to the French pages.
    document.querySelectorAll('[data-lang]').forEach(function (link) {
      link.addEventListener('click', function () {
        try { localStorage.setItem('muskl-lang', link.getAttribute('data-lang')); } catch (e) {}
      });
    });
  </script>`;
}

// Only the French pages (the site root) redirect, and only once per choice, like the app picking
// the phone's language. Crawlers are left alone so every language version stays indexable.
function langRedirect(current) {
  if (current.dir) return '';
  const available = LANGUAGES.filter((language) => language.dir).map((language) => language.code);
  return `<script>
  (function () {
    try {
      if (/bot|crawl|spider|slurp|lighthouse/i.test(navigator.userAgent)) return;
      var available = ${JSON.stringify(available)};
      var preferred = localStorage.getItem('muskl-lang') ||
        ((navigator.languages && navigator.languages[0]) || navigator.language || '').slice(0, 2).toLowerCase();
      if (available.indexOf(preferred) === -1) return;
      var page = location.pathname.split('/').pop() || 'index.html';
      location.replace(preferred + '/' + page + location.search + location.hash);
    } catch (e) {}
  })();
</script>`;
}

function render(template, language, page, dictionary) {
  const variables = {
    root: language.dir ? '../' : '',
    lang: language.htmlLang,
    canonical: pageUrl(language, page),
    alternates: alternates(page),
    langSwitcher: langSwitcher(language, page, dictionary),
    langRedirect: langRedirect(language),
  };
  const missing = new Set();

  const html = template.replace(/\{\{(?:(t|json):([\w.]+)|(\w+))\}\}/g, (match, kind, keyPath, variable) => {
    if (variable) {
      if (!(variable in variables)) missing.add(match);
      return variables[variable] ?? match;
    }
    const value = lookup(dictionary, keyPath);
    if (value === undefined) {
      missing.add(match);
      return match;
    }
    if (kind === 'json') return JSON.stringify(value).replace(/</g, '\\u003c');
    // Meta tags are attributes: a stray quote in a translation would break the whole tag.
    return keyPath.includes('.meta.') ? escapeAttribute(String(value)) : String(value);
  });

  return { html, missing: [...missing] };
}

const locales = Object.fromEntries(
  LANGUAGES.map((language) => [
    language.code,
    JSON.parse(fs.readFileSync(path.join(__dirname, 'locales', `${language.code}.json`), 'utf8')),
  ]),
);

const errors = [];
let written = 0;

for (const page of PAGES) {
  const template = fs.readFileSync(path.join(__dirname, 'pages', page), 'utf8');
  for (const language of LANGUAGES) {
    const { html, missing } = render(template, language, page, locales[language.code]);
    if (missing.length > 0) {
      errors.push(`${language.code}/${page} : ${missing.join(', ')}`);
      continue;
    }
    const directory = path.join(OUT, language.dir);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, page), html);
    written += 1;
  }
}

if (errors.length > 0) {
  console.error('Clés manquantes :\n' + errors.join('\n'));
  process.exit(1);
}

console.log(`${written} pages générées dans docs/ (${LANGUAGES.length} langues × ${PAGES.length} pages).`);
