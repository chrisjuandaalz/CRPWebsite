// Vercel Serverless Function: powers the website chat widget.
// Calls the Gemini API (key lives only in GEMINI_API_KEY, never client-side)
// grounded on CRP's own published content, and tracks daily request usage
// against the free-tier quota (GEMINI_DAILY_LIMIT) in Upstash Redis so we
// can degrade gracefully instead of erroring once the quota is used up.
//
// Redis is optional: if no Upstash credentials are configured, usage is
// tracked in-memory per function instance only (approximate, resets on
// cold start) so the chatbot still works without it.

const DEFAULT_DAILY_LIMIT = 20;
const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const WARNING_THRESHOLD_PCT = 15; // warn once remaining quota drops to this %
const MAX_HISTORY_TURNS = 8;

const SYSTEM_PROMPT = `You are Ciara, the website assistant for Christian Rara & Partners (CRP), an insurance strategy and succession planning advisory based in Tangerang, Indonesia, serving family business owners and high-net-worth individuals (HNWI). If asked your name, say you are Ciara.

Answer only using the facts below. Reply in the same language the visitor writes in (Indonesian or English). Keep answers short (2-4 sentences), warm, and professional. Never invent credentials, prices, discounts, or guarantees. For anything specific to a visitor's personal situation (policy review, pricing, suitability), tell them to book a private consultation rather than guessing.

Only greet ("Halo!"/"Hi!") in your very first reply of a conversation. In every later reply, answer directly without a greeting.

When pointing visitors to a page, refer to it by its plain name (e.g. "halaman Konsultasi Pribadi", "the Services page") — never paste a URL or file path, and never mention ".html".

Facts about CRP:
- Managing Partner: Christian Juanda, QWP (Qualified Wealth Planner), QLP (Qualified Legacy Planner), AEPP (Associate Estate Planning Practitioner). Active in the insurance industry since 2018, brings an IT systems-audit background (COBIT, ITIL, Bank Indonesia's IT standards/PBI) into advisory work.
- Has served 500+ clients, including family business owners and high-net-worth individuals (HNWI) in Indonesia.
- Services: comprehensive financial risk analysis, commercial & personal insurance policy placement, and dedicated claim advocacy (including audits of rejected or delayed claims).
- Process: starts with an in-depth analysis of the client's financial position (Financial Snapshot, Risk Ratio Analysis, Legacy Planning Report), then places the right policy. Every piece of data, decision, and signature comes directly from the client — nothing is ever filled in or signed on their behalf.
- CRP does not offer discounts of any kind; every client receives the same quality of advice.
- Office: Foresta Business Loft 1, Pagedangan, Kabupaten Tangerang, Banten 15339. Email: info@crplegacy.biz.id.
- Private, confidential consultations can be booked online with real-time availability via the Private Consultation page (menu navigation, top of every page).
- Site sections (reachable from the navigation menu): Home, About, Services, Blog, Contact, Private Consultation — each has an English version too.
- Licensing: CRP is an insurance agency partnered with Allianz Indonesia, an insurer licensed and supervised by the OJK. Christian Juanda holds a Conventional agent license No. 14762473 and a Syariah agent license No. 3321012040905819 (both valid until 3 March 2028), plus a general insurance agent license AAUI No. 20240414.A02-000000002 for PT Asuransi Allianz Utama Indonesia (active, valid until 14 April 2027). Clients may request proof of license at any time before deciding.
- Approach: CRP works as an advisor, not a product seller. It analyzes the client's finances and risks first, designs tailored solutions (not standard packages), and applies no pressure to buy.
- Existing policies: clients do not have to replace them. CRP audits existing policies first, keeps those that still serve the client well, and only suggests additions or changes where there is a real protection gap.
- The initial consultation is free, with no obligation to purchase. CRP maps the client's needs and the client decides whether to proceed.
- Process steps: (1) introduction, (2) analysis of current financial position, (3) designing the solution, (4) the client personally completes and signs the policy application, (5) periodic policy reviews.
- Business protection (for owners/managers, including family businesses): revenue and income protection, keyman insurance for key executives and shareholders, and property, cargo and commercial liability cover, so the business keeps running if something happens to a vital person or asset.
- Expat health insurance is a core service. CRP learns the client's situation (residence, family, budget, preferred place of treatment: Indonesia, home country or worldwide), compares suitable plans and explains what each covers, reviews any existing employer or international plan (suggesting changes only for real gaps), recommends while the client decides, and keeps reviewing coverage after the policy is active.
- Regency for Expats coverage stays usable when the client is in another country or returns home, subject to the policy's terms and conditions; there is no need to switch insurance just because of relocation.
- Claims at hospitals outside Indonesia are possible subject to policy terms and conditions: for non-urgent cases pre-admission must be completed before admission; for emergencies admission is handled in parallel and the client can also claim through reimbursement. CRP helps clients understand this procedure before they need it.

If asked something unrelated to CRP's services, or something you don't have facts for, politely say you don't have that information and suggest the contact form or booking a private consultation.`;

function getRedisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

// In-memory fallback so the bot keeps working even without Redis configured.
// Approximate only: resets whenever the serverless instance cold-starts and
// is not shared across concurrent instances.
const memoryCounters = new Map();

async function incrementDailyCount(dateKey) {
  const redis = getRedisConfig();
  if (!redis) {
    const next = (memoryCounters.get(dateKey) || 0) + 1;
    memoryCounters.set(dateKey, next);
    return { count: next, tracked: 'memory' };
  }

  const headers = { Authorization: `Bearer ${redis.token}` };
  const incrRes = await fetch(`${redis.url}/incr/${encodeURIComponent(dateKey)}`, { headers });
  const incrData = await incrRes.json();
  const count = incrData.result;

  // Only set on first write of the day so we don't reset the TTL every call.
  if (count === 1) {
    fetch(`${redis.url}/expire/${encodeURIComponent(dateKey)}/172800`, { headers }).catch(() => {});
  }

  return { count, tracked: 'redis' };
}

function fallbackMessage(key, isId) {
  const messages = {
    validation: {
      id: 'Mohon tuliskan pertanyaan Anda.',
      en: 'Please type your question.',
    },
    misconfigured: {
      id: 'Asisten AI sedang tidak tersedia. Silakan hubungi kami langsung melalui formulir kontak.',
      en: 'The AI assistant is currently unavailable. Please contact us directly via the contact form.',
    },
    quotaExceeded: {
      id: 'Mohon maaf, asisten AI kami sudah mencapai batas penggunaan harian. Silakan hubungi kami langsung melalui formulir kontak atau jadwalkan konsultasi pribadi.',
      en: 'Sorry, our AI assistant has reached its daily usage limit. Please reach out directly via the contact form or book a private consultation.',
    },
    failed: {
      id: 'Maaf, terjadi gangguan sesaat. Coba lagi beberapa saat lagi atau hubungi kami langsung.',
      en: 'Sorry, something went wrong on our end. Please try again shortly or contact us directly.',
    },
  };
  return isId ? messages[key].id : messages[key].en;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, history, lang } = req.body || {};
  const isId = lang !== 'en';

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: fallbackMessage('validation', isId) });
  }

  const { GEMINI_API_KEY } = process.env;
  if (!GEMINI_API_KEY) {
    console.error('Missing GEMINI_API_KEY environment variable');
    return res.status(200).json({ reply: fallbackMessage('misconfigured', isId) });
  }

  const dailyLimit = Number(process.env.GEMINI_DAILY_LIMIT) || DEFAULT_DAILY_LIMIT;
  const todayKey = `crp:chat:count:${new Date().toISOString().slice(0, 10)}`;

  let count;
  try {
    const result = await incrementDailyCount(todayKey);
    count = result.count;
  } catch (err) {
    console.error('Quota counter failed, proceeding without it:', err.message);
    count = 0;
  }

  if (count > dailyLimit) {
    console.warn(`[chat] Daily quota exceeded: ${count}/${dailyLimit} used today.`);
    return res.status(200).json({ reply: fallbackMessage('quotaExceeded', isId), quotaExceeded: true });
  }

  const remainingPct = ((dailyLimit - count) / dailyLimit) * 100;
  if (remainingPct <= WARNING_THRESHOLD_PCT) {
    console.warn(`[chat] Daily quota low: ${count}/${dailyLimit} used (${remainingPct.toFixed(1)}% remaining).`);
  }

  const trimmedHistory = Array.isArray(history) ? history.slice(-MAX_HISTORY_TURNS) : [];
  const contents = [
    ...trimmedHistory
      .filter((turn) => turn && typeof turn.text === 'string' && (turn.role === 'user' || turn.role === 'model'))
      .map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] })),
    { role: 'user', parts: [{ text: message.trim() }] },
  ];

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  const body = JSON.stringify({
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents,
    generationConfig: { maxOutputTokens: 400, temperature: 0.4 },
  });

  // Gemini's free-tier flash model occasionally returns a transient 503
  // ("high demand") — retry once after a short delay before giving up.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const geminiRes = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      const data = await geminiRes.json();
      if (!geminiRes.ok) {
        const isOverloaded = geminiRes.status === 503;
        console.error('Gemini API error:', data.error?.message || geminiRes.status);
        if (isOverloaded && attempt === 0) {
          await new Promise((r) => setTimeout(r, 700));
          continue;
        }
        return res.status(200).json({ reply: fallbackMessage('failed', isId) });
      }

      const reply = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('').trim();
      if (!reply) {
        return res.status(200).json({ reply: fallbackMessage('failed', isId) });
      }

      return res.status(200).json({
        reply,
        quotaWarning: remainingPct <= WARNING_THRESHOLD_PCT,
        remainingPct: Math.max(0, Math.round(remainingPct)),
      });
    } catch (err) {
      console.error('Gemini request failed:', err.message);
      return res.status(200).json({ reply: fallbackMessage('failed', isId) });
    }
  }
}
