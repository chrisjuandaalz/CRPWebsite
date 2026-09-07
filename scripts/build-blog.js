// Generates static blog pages from content/blog/*.json (written by Sveltia CMS)
// so each article ships with real, crawlable <title>/meta tags instead of
// relying on client-side JavaScript to fill them in after the page loads.
//
// Bilingual: Indonesian is the default and lives at the site root
// (blog.html, blog/<slug>.html); English lives under /en/ (en/blog.html,
// en/blog/<slug>.html). Each post JSON carries English fields (title,
// summary, body, category) plus optional Indonesian overrides (title_id,
// summary_id, body_id, category_id) — if an _id field is missing, the
// Indonesian page falls back to the English one so new articles never break.
//
// Run automatically by .github/workflows/build-blog.yml on every publish.

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const ROOT = path.resolve(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content', 'blog');
const SITE_URL = 'https://crplegacy.biz.id';

const CATEGORY_ID = {
  'Policy Audit': 'Audit Polis',
  'Succession Planning': 'Perencanaan Suksesi',
  'Estate Liquidity': 'Likuiditas Warisan',
  'Claim Advisory': 'Advisory Klaim',
};

const STATIC_PAGES = [
  { loc: 'index.html', priority: '1.0' },
  { loc: 'about.html', priority: '0.8' },
  { loc: 'services.html', priority: '0.8' },
  { loc: 'blog.html', priority: '0.7' },
  { loc: 'contact.html', priority: '0.6' },
  { loc: 'privconsul.html', priority: '0.9' },
];

const LANGS = {
  id: {
    dir: ROOT,
    urlPrefix: '',
    htmlLang: 'id',
    dateLocale: 'id-ID',
    strings: {
      home: 'Beranda', about: 'Tentang Kami', services: 'Layanan Kami', blog: 'Blog', contact: 'Kontak Kami',
      privateConsultation: 'Konsultasi Pribadi',
      byAuthor: 'Oleh Christian Juanda',
      readArticle: 'Baca Artikel',
      backToArticles: 'Kembali ke semua artikel',
      switchTo: 'Switch to', switchToLang: 'English', switchHref: (slug) => `/en/${slug}`,
      langSwitcherOther: 'EN', langSwitcherOtherHref: (slug) => `/en/${slug}`,
      noArticles: 'Belum ada artikel yang dipublikasikan. Cek lagi nanti.',
    },
  },
  en: {
    dir: path.join(ROOT, 'en'),
    urlPrefix: 'en/',
    htmlLang: 'en',
    dateLocale: 'en-US',
    strings: {
      home: 'Home', about: 'About Us', services: 'Our Services', blog: 'Blog', contact: 'Contact Us',
      privateConsultation: 'Private Consultation',
      byAuthor: 'By Christian Juanda',
      readArticle: 'Read Article',
      backToArticles: 'Back to all articles',
      switchTo: 'Switch to', switchToLang: 'Bahasa Indonesia', switchHref: (slug) => `/${slug}`,
      langSwitcherOther: 'ID', langSwitcherOtherHref: (slug) => `/${slug}`,
      noArticles: 'No articles published yet. Check back soon.',
    },
  },
};

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function formatDate(dateStr, locale) {
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr || '';
  return d.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
}

function isoDate(dateStr) {
  const d = new Date(dateStr);
  return isNaN(d) ? '' : d.toISOString();
}

function localize(post, lang) {
  if (lang === 'en') {
    return { title: post.title, summary: post.summary, body: post.body, category: post.category };
  }
  return {
    title: post.title_id || post.title,
    summary: post.summary_id || post.summary,
    body: post.body_id || post.body,
    category: post.category_id || CATEGORY_ID[post.category] || post.category,
  };
}

function loadPosts() {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.json'));
  const posts = files.map((f) => {
    const data = JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, f), 'utf8'));
    return { ...data, slug: f.replace(/\.json$/, '') };
  });
  posts.sort((a, b) => new Date(b.date) - new Date(a.date));
  return posts;
}

function siteHeader(lang, activeBlog) {
  const s = LANGS[lang].strings;
  const p = LANGS[lang].urlPrefix;
  const otherHref = LANGS[lang].strings.langSwitcherOtherHref('blog.html');
  const blogClass = activeBlog ? 'text-[#C5A880] font-semibold' : 'hover:text-[#C5A880] transition-colors';
  return `  <header class="sticky top-0 z-50 bg-[#0A192F]/90 backdrop-blur-md border-b border-[#1E2D4A]">
    <div class="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
      <a href="/${p}index.html" class="flex items-center gap-3 group">
        <img src="/cr-partners-logo.png" alt="CR & Partners Logo" class="h-10 w-auto object-contain rounded-md">
        <div class="flex flex-col">
          <span class="font-extrabold text-base md:text-lg tracking-tight text-white leading-none group-hover:text-[#C5A880] transition-colors">
            CHRISTIAN RARA & PARTNERS
          </span>
          <span class="text-[#C5A880] text-[10px] uppercase tracking-[0.2em] font-medium mt-1">
            Insurance Strategist
          </span>
        </div>
      </a>
      <nav class="hidden lg:flex space-x-8 text-sm font-medium text-slate-300">
        <a href="/${p}index.html" class="hover:text-[#C5A880] transition-colors">${s.home}</a>
        <a href="/${p}about.html" class="hover:text-[#C5A880] transition-colors">${s.about}</a>
        <a href="/${p}services.html" class="hover:text-[#C5A880] transition-colors">${s.services}</a>
        <a href="/${p}blog.html" class="${blogClass}">${s.blog}</a>
        <a href="/${p}contact.html" class="hover:text-[#C5A880] transition-colors">${s.contact}</a>
      </nav>

      <div class="hidden lg:flex items-center gap-1 text-xs font-bold">
        ${lang === 'id'
          ? `<span class="px-2 py-1 rounded text-[#C5A880]">ID</span><span class="text-slate-600">/</span><a href="/${otherHref}" class="px-2 py-1 rounded text-slate-400 hover:text-white transition-colors">EN</a>`
          : `<a href="/${otherHref}" class="px-2 py-1 rounded text-slate-400 hover:text-white transition-colors">ID</a><span class="text-slate-600">/</span><span class="px-2 py-1 rounded text-[#C5A880]">EN</span>`}
      </div>

      <a href="/${p}privconsul.html" class="hidden lg:inline-flex bg-gradient-to-r from-[#C5A880] to-[#D4AF37] text-[#0A192F] text-sm font-bold px-6 py-2.5 rounded-md hover:brightness-110 transition-all duration-300 shadow-lg shadow-[#C5A880]/20">
        ${s.privateConsultation}
      </a>

      <!-- Mobile menu toggle -->
      <button id="mobile-menu-btn" class="lg:hidden text-white p-2 -mr-2" aria-label="Toggle menu" aria-expanded="false">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
          <path id="mobile-menu-icon-open" stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
          <path id="mobile-menu-icon-close" class="hidden" stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>

    <!-- Mobile menu panel -->
    <nav id="mobile-menu" class="hidden lg:hidden border-t border-[#1E2D4A] bg-[#0A192F] px-6 py-4 flex flex-col space-y-4 text-sm font-medium text-slate-300">
      <a href="/${otherHref}" class="flex items-center gap-2 text-xs font-bold text-slate-400">${s.switchTo} <span class="text-white">${s.switchToLang}</span></a>
      <a href="/${p}index.html" class="hover:text-[#C5A880] transition-colors">${s.home}</a>
      <a href="/${p}about.html" class="hover:text-[#C5A880] transition-colors">${s.about}</a>
      <a href="/${p}services.html" class="hover:text-[#C5A880] transition-colors">${s.services}</a>
      <a href="/${p}blog.html" class="${blogClass}">${s.blog}</a>
      <a href="/${p}contact.html" class="hover:text-[#C5A880] transition-colors">${s.contact}</a>
      <a href="/${p}privconsul.html" class="mt-2 inline-flex justify-center items-center bg-gradient-to-r from-[#C5A880] to-[#D4AF37] text-[#0A192F] text-sm font-bold px-6 py-2.5 rounded-md">${s.privateConsultation}</a>
    </nav>
  </header>

  <!-- Mobile menu toggle script -->
  <script>
    (function() {
      var btn = document.getElementById('mobile-menu-btn');
      var menu = document.getElementById('mobile-menu');
      var iconOpen = document.getElementById('mobile-menu-icon-open');
      var iconClose = document.getElementById('mobile-menu-icon-close');
      if (!btn || !menu) return;
      btn.addEventListener('click', function() {
        var isHidden = menu.classList.toggle('hidden');
        btn.setAttribute('aria-expanded', String(!isHidden));
        iconOpen.classList.toggle('hidden', !isHidden);
        iconClose.classList.toggle('hidden', isHidden);
      });
    })();
  </script>`;
}

function siteFooter(lang) {
  const p = LANGS[lang].urlPrefix;
  const tagline = lang === 'id'
    ? 'Perlindungan strategis dan advisory asuransi yang dirancang berdasarkan hasil yang objektif dan kepercayaan klien yang otentik.'
    : 'Strategic protection and insurance advisory designed around objective deliverables and authentic client trust.';
  const copyright = lang === 'id'
    ? '&copy; 2026 Christian Rara & Partners. Hak cipta dilindungi.'
    : '&copy; 2026 Christian Rara & Partners. All rights reserved.';
  const subline = lang === 'id' ? 'Strategis Asuransi & Advisory Risiko Eksekutif.' : 'Insurance Strategist & Executive Risk Advisory.';
  return `  <footer class="border-t border-[#1E2D4A] bg-[#0A192F] py-16">
    <div class="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-8 items-center justify-between">
      <div class="flex items-start gap-4">
        <img src="/cr-partners-logo.png" alt="CR & Partners Logo Footer" class="h-14 w-auto object-contain rounded-md">
        <div>
          <div class="font-extrabold text-lg text-white leading-tight">CHRISTIAN RARA & PARTNERS</div>
          <div class="text-[#C5A880] text-xs uppercase tracking-widest font-semibold mt-1 mb-2">Insurance Strategist</div>
          <p class="text-xs text-slate-400 max-w-sm">${tagline}</p>
        </div>
      </div>
      <div class="text-left md:text-right text-xs text-slate-500 space-y-2">
        <p>${copyright}</p>
        <p>${subline}</p>
      </div>
    </div>
  </footer>`;
}

function renderPostPage(post, lang) {
  const s = LANGS[lang].strings;
  const p = LANGS[lang].urlPrefix;
  const loc = localize(post, lang);
  const title = loc.title || 'Untitled';
  const description = loc.summary || '';
  const url = `${SITE_URL}/${p}blog/${post.slug}.html`;
  const altUrl = lang === 'id' ? `${SITE_URL}/en/blog/${post.slug}.html` : `${SITE_URL}/blog/${post.slug}.html`;
  const image = post.image ? new URL(post.image, SITE_URL).href : `${SITE_URL}/cr-partners-logo.png`;
  // Wrap tables so they scroll horizontally on narrow screens instead of squeezing/wrapping every cell
  const bodyHtml = marked.parse(loc.body || '')
    .replace(/<table>/g, '<div class="table-scroll"><table>')
    .replace(/<\/table>/g, '</table></div>');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    image,
    datePublished: isoDate(post.date),
    inLanguage: lang,
    author: { '@type': 'Person', name: 'Christian Juanda' },
    publisher: { '@type': 'Organization', name: 'Christian Rara & Partners' },
  };

  return `<!DOCTYPE html>
<html lang="${LANGS[lang].htmlLang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-EDE3SMCPRT"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-EDE3SMCPRT');
  </script>
  <title>${escapeHtml(title)} | Christian Rara & Partners</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${url}">
  <link rel="alternate" hreflang="id" href="${lang === 'id' ? url : altUrl}">
  <link rel="alternate" hreflang="en" href="${lang === 'en' ? url : altUrl}">
  <link rel="alternate" hreflang="x-default" href="${lang === 'id' ? url : altUrl}">
  <link rel="icon" type="image/png" href="/cr-partners-logo.png">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${escapeHtml(title)} | Christian Rara & Partners">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)} | Christian Rara & Partners">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
    .bg-bubble-gradient { background: linear-gradient(135deg, rgba(17, 34, 64, 0.95) 0%, rgba(10, 25, 47, 0.98) 100%); }
    #post-body h2 { color: #fff; font-weight: 700; font-size: 1.5rem; margin: 2rem 0 1rem; }
    #post-body h3 { color: #fff; font-weight: 700; font-size: 1.25rem; margin: 1.5rem 0 0.75rem; }
    #post-body p { margin-bottom: 1.25rem; line-height: 1.75; }
    #post-body a { color: #C5A880; text-decoration: underline; }
    #post-body ul, #post-body ol { margin: 0 0 1.25rem 1.5rem; }
    #post-body ul { list-style: disc; }
    #post-body ol { list-style: decimal; }
    #post-body li { margin-bottom: 0.5rem; }
    #post-body blockquote { border-left: 3px solid #C5A880; padding-left: 1rem; color: #94A3B8; font-style: italic; margin: 1.5rem 0; }
    #post-body img { border-radius: 1rem; margin: 1.5rem 0; }
    #post-body .table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; margin: 1.5rem 0; border: 1px solid #1E2D4A; border-radius: 0.75rem; }
    #post-body table { width: 100%; min-width: 480px; border-collapse: collapse; font-size: 0.875rem; }
    #post-body th, #post-body td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid #1E2D4A; vertical-align: top; }
    #post-body th { color: #C5A880; font-weight: 700; white-space: nowrap; background: rgba(197, 168, 128, 0.08); }
    #post-body tbody tr:last-child td { border-bottom: none; }
  </style>
</head>
<body class="bg-[#0A192F] text-[#E2E8F0] antialiased selection:bg-[#C5A880] selection:text-[#0A192F]">

${siteHeader(lang, true)}

  <main class="py-20 max-w-3xl mx-auto px-6">
    <a href="/${p}blog.html" class="inline-flex items-center gap-2 text-xs text-[#C5A880] font-semibold hover:underline mb-10">&larr; ${s.backToArticles}</a>

    <span class="text-xs text-[#C5A880] font-semibold uppercase tracking-wider block mb-4">${escapeHtml(loc.category)}</span>
    <h1 class="text-3xl md:text-4xl font-extrabold text-white mb-4 leading-tight">${escapeHtml(title)}</h1>
    <div class="text-xs text-slate-500 mb-8">${s.byAuthor} &bull; ${formatDate(post.date, LANGS[lang].dateLocale)}</div>
    ${post.image ? `<img src="${escapeHtml(post.image)}" alt="${escapeHtml(title)}" class="w-full rounded-2xl mb-10 object-cover max-h-[420px]">` : ''}
    <div id="post-body" class="text-slate-300">${bodyHtml}</div>
  </main>

${siteFooter(lang)}

</body>
</html>
`;
}

function renderCard(post, lang) {
  const s = LANGS[lang].strings;
  const p = LANGS[lang].urlPrefix;
  const loc = localize(post, lang);
  return `          <article class="p-6 bg-bubble-gradient border border-[#1E2D4A] rounded-3xl hover-glow transition-all duration-500 flex flex-col justify-between">
            <div>
              <span class="text-xs text-[#C5A880] font-semibold uppercase tracking-wider block mb-2">${escapeHtml(loc.category)}</span>
              <h2 class="text-xl font-bold text-white mb-3 hover:text-[#C5A880] transition-colors">
                <a href="/${p}blog/${post.slug}.html">${escapeHtml(loc.title)}</a>
              </h2>
              <p class="text-slate-400 text-xs leading-relaxed mb-6">${escapeHtml(loc.summary)}</p>
            </div>
            <div class="flex items-center justify-between pt-4 border-t border-[#1E2D4A] text-[11px] text-slate-500">
              <span>${s.byAuthor} &bull; ${formatDate(post.date, LANGS[lang].dateLocale)}</span>
              <a href="/${p}blog/${post.slug}.html" class="text-[#C5A880] font-semibold hover:underline">${s.readArticle} &rarr;</a>
            </div>
          </article>`;
}

function updateBlogListing(posts, lang) {
  const listingPath = path.join(LANGS[lang].dir, 'blog.html');
  const html = fs.readFileSync(listingPath, 'utf8');
  const startMarker = '<!-- BLOG_CARDS_START -->';
  const endMarker = '<!-- BLOG_CARDS_END -->';
  const startIdx = html.indexOf(startMarker);
  const endIdx = html.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error(`${listingPath} is missing ${startMarker} / ${endMarker} markers`);
  }

  const cardsHtml = posts.length
    ? posts.map((post) => renderCard(post, lang)).join('\n')
    : `          <div class="col-span-3 text-center py-16 text-slate-400"><p class="text-sm">${LANGS[lang].strings.noArticles}</p></div>`;

  const updated = html.slice(0, startIdx + startMarker.length) + '\n' + cardsHtml + '\n          ' + html.slice(endIdx);
  fs.writeFileSync(listingPath, updated);
}

function writeSitemap(posts) {
  const urls = [];
  for (const lang of ['id', 'en']) {
    const p = LANGS[lang].urlPrefix;
    for (const page of STATIC_PAGES) {
      urls.push(`  <url>\n    <loc>${SITE_URL}/${p}${page.loc}</loc>\n    <priority>${page.priority}</priority>\n  </url>`);
    }
    for (const post of posts) {
      urls.push(`  <url>\n    <loc>${SITE_URL}/${p}blog/${post.slug}.html</loc>\n    <priority>0.6</priority>\n  </url>`);
    }
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml);
}

function buildLang(posts, lang) {
  const outputDir = path.join(LANGS[lang].dir, 'blog');
  fs.mkdirSync(outputDir, { recursive: true });

  const existing = fs.readdirSync(outputDir).filter((f) => f.endsWith('.html'));
  const validSlugs = new Set(posts.map((p) => `${p.slug}.html`));
  for (const f of existing) {
    if (!validSlugs.has(f)) fs.unlinkSync(path.join(outputDir, f));
  }

  for (const post of posts) {
    fs.writeFileSync(path.join(outputDir, `${post.slug}.html`), renderPostPage(post, lang));
  }

  updateBlogListing(posts, lang);
}

function main() {
  const posts = loadPosts();

  buildLang(posts, 'id');
  buildLang(posts, 'en');
  writeSitemap(posts);

  console.log(`Built ${posts.length} blog page(s) in 2 languages.`);
}

main();
