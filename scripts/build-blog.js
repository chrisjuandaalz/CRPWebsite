// Generates static blog pages from content/blog/*.json (written by Sveltia CMS)
// so each article ships with real, crawlable <title>/meta tags instead of
// relying on client-side JavaScript to fill them in after the page loads.
// Run automatically by .github/workflows/build-blog.yml on every publish.

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const ROOT = path.resolve(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content', 'blog');
const OUTPUT_DIR = path.join(ROOT, 'blog');
const BLOG_LISTING_PATH = path.join(ROOT, 'blog.html');
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');
const SITE_URL = 'https://crplegacy.biz.id';

const STATIC_PAGES = [
  { loc: '/index.html', priority: '1.0' },
  { loc: '/about.html', priority: '0.8' },
  { loc: '/services.html', priority: '0.8' },
  { loc: '/blog.html', priority: '0.7' },
  { loc: '/contact.html', priority: '0.6' },
  { loc: '/privconsul.html', priority: '0.9' },
];

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr || '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function isoDate(dateStr) {
  const d = new Date(dateStr);
  return isNaN(d) ? '' : d.toISOString();
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

function siteHeader(activeBlog) {
  return `  <header class="sticky top-0 z-50 bg-[#0A192F]/90 backdrop-blur-md border-b border-[#1E2D4A]">
    <div class="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
      <a href="/index.html" class="flex items-center gap-3 group">
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
        <a href="/index.html" class="hover:text-[#C5A880] transition-colors">Home</a>
        <a href="/about.html" class="hover:text-[#C5A880] transition-colors">About Us</a>
        <a href="/services.html" class="hover:text-[#C5A880] transition-colors">Our Services</a>
        <a href="/blog.html" class="${activeBlog ? 'text-[#C5A880] font-semibold' : 'hover:text-[#C5A880] transition-colors'}">Blog</a>
        <a href="/contact.html" class="hover:text-[#C5A880] transition-colors">Contact Us</a>
      </nav>
      <a href="/privconsul.html" class="bg-gradient-to-r from-[#C5A880] to-[#D4AF37] text-[#0A192F] text-sm font-bold px-6 py-2.5 rounded-md hover:brightness-110 transition-all duration-300 shadow-lg shadow-[#C5A880]/20">
        Private Consultation
      </a>
    </div>
  </header>`;
}

function siteFooter() {
  return `  <footer class="border-t border-[#1E2D4A] bg-[#0A192F] py-16">
    <div class="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-8 items-center justify-between">
      <div class="flex items-start gap-4">
        <img src="/cr-partners-logo.png" alt="CR & Partners Logo Footer" class="h-14 w-auto object-contain rounded-md">
        <div>
          <div class="font-extrabold text-lg text-white leading-tight">CHRISTIAN RARA & PARTNERS</div>
          <div class="text-[#C5A880] text-xs uppercase tracking-widest font-semibold mt-1 mb-2">Insurance Strategist</div>
          <p class="text-xs text-slate-400 max-w-sm">Strategic protection and insurance advisory designed around objective deliverables and authentic client trust.</p>
        </div>
      </div>
      <div class="text-left md:text-right text-xs text-slate-500 space-y-2">
        <p>&copy; 2026 Christian Rara & Partners. All rights reserved.</p>
        <p>Insurance Strategist & Executive Risk Advisory.</p>
      </div>
    </div>
  </footer>`;
}

function renderPostPage(post) {
  const title = post.title || 'Untitled';
  const description = post.summary || '';
  const url = `${SITE_URL}/blog/${post.slug}.html`;
  const image = post.image ? new URL(post.image, SITE_URL).href : `${SITE_URL}/cr-partners-logo.png`;
  const bodyHtml = marked.parse(post.body || '');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    image,
    datePublished: isoDate(post.date),
    author: { '@type': 'Person', name: 'Christian Juanda' },
    publisher: { '@type': 'Organization', name: 'Christian Rara & Partners' },
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | Christian Rara & Partners</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${url}">
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
  </style>
</head>
<body class="bg-[#0A192F] text-[#E2E8F0] antialiased selection:bg-[#C5A880] selection:text-[#0A192F]">

${siteHeader(true)}

  <main class="py-20 max-w-3xl mx-auto px-6">
    <a href="/blog.html" class="inline-flex items-center gap-2 text-xs text-[#C5A880] font-semibold hover:underline mb-10">&larr; Back to all articles</a>

    <span class="text-xs text-[#C5A880] font-semibold uppercase tracking-wider block mb-4">${escapeHtml(post.category)}</span>
    <h1 class="text-3xl md:text-4xl font-extrabold text-white mb-4 leading-tight">${escapeHtml(title)}</h1>
    <div class="text-xs text-slate-500 mb-8">By Christian Juanda &bull; ${formatDate(post.date)}</div>
    ${post.image ? `<img src="${escapeHtml(post.image)}" alt="${escapeHtml(title)}" class="w-full rounded-2xl mb-10 object-cover max-h-[420px]">` : ''}
    <div id="post-body" class="text-slate-300">${bodyHtml}</div>
  </main>

${siteFooter()}

</body>
</html>
`;
}

function renderCard(post) {
  return `          <article class="p-6 bg-bubble-gradient border border-[#1E2D4A] rounded-3xl hover-glow transition-all duration-500 flex flex-col justify-between">
            <div>
              <span class="text-xs text-[#C5A880] font-semibold uppercase tracking-wider block mb-2">${escapeHtml(post.category)}</span>
              <h2 class="text-xl font-bold text-white mb-3 hover:text-[#C5A880] transition-colors">
                <a href="/blog/${post.slug}.html">${escapeHtml(post.title)}</a>
              </h2>
              <p class="text-slate-400 text-xs leading-relaxed mb-6">${escapeHtml(post.summary)}</p>
            </div>
            <div class="flex items-center justify-between pt-4 border-t border-[#1E2D4A] text-[11px] text-slate-500">
              <span>By Christian Juanda &bull; ${formatDate(post.date)}</span>
              <a href="/blog/${post.slug}.html" class="text-[#C5A880] font-semibold hover:underline">Read Article &rarr;</a>
            </div>
          </article>`;
}

function updateBlogListing(posts) {
  const html = fs.readFileSync(BLOG_LISTING_PATH, 'utf8');
  const startMarker = '<!-- BLOG_CARDS_START -->';
  const endMarker = '<!-- BLOG_CARDS_END -->';
  const startIdx = html.indexOf(startMarker);
  const endIdx = html.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error(`blog.html is missing ${startMarker} / ${endMarker} markers`);
  }

  const cardsHtml = posts.length
    ? posts.map(renderCard).join('\n')
    : `          <div class="col-span-3 text-center py-16 text-slate-400"><p class="text-sm">No articles published yet. Check back soon.</p></div>`;

  const updated = html.slice(0, startIdx + startMarker.length) + '\n' + cardsHtml + '\n          ' + html.slice(endIdx);
  fs.writeFileSync(BLOG_LISTING_PATH, updated);
}

function writeSitemap(posts) {
  const staticUrls = STATIC_PAGES.map((p) => `  <url>\n    <loc>${SITE_URL}${p.loc}</loc>\n    <priority>${p.priority}</priority>\n  </url>`);
  const postUrls = posts.map((p) => `  <url>\n    <loc>${SITE_URL}/blog/${p.slug}.html</loc>\n    <priority>0.6</priority>\n  </url>`);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...staticUrls, ...postUrls].join('\n')}\n</urlset>\n`;
  fs.writeFileSync(SITEMAP_PATH, xml);
}

function main() {
  const posts = loadPosts();

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const existing = fs.existsSync(OUTPUT_DIR) ? fs.readdirSync(OUTPUT_DIR).filter((f) => f.endsWith('.html')) : [];
  const validSlugs = new Set(posts.map((p) => `${p.slug}.html`));
  for (const f of existing) {
    if (!validSlugs.has(f)) fs.unlinkSync(path.join(OUTPUT_DIR, f));
  }

  for (const post of posts) {
    fs.writeFileSync(path.join(OUTPUT_DIR, `${post.slug}.html`), renderPostPage(post));
  }

  updateBlogListing(posts);
  writeSitemap(posts);

  console.log(`Built ${posts.length} blog page(s).`);
}

main();
