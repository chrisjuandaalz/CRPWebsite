// Vercel Serverless Function: lets CJ check today's Gemini quota usage for
// the chat widget from a browser/phone, without needing an email service.
// Protected by a shared secret (CHAT_STATUS_KEY) passed as ?key=... so the
// number isn't publicly exposed.

const DEFAULT_DAILY_LIMIT = 20;
const WARNING_THRESHOLD_PCT = 15;

function getRedisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

export default async function handler(req, res) {
  const { CHAT_STATUS_KEY } = process.env;
  if (!CHAT_STATUS_KEY || req.query.key !== CHAT_STATUS_KEY) {
    return res.status(404).json({ error: 'Not found' });
  }

  const dailyLimit = Number(process.env.GEMINI_DAILY_LIMIT) || DEFAULT_DAILY_LIMIT;
  const todayKey = `crp:chat:count:${new Date().toISOString().slice(0, 10)}`;
  const redis = getRedisConfig();

  let used = 0;
  let tracked = 'memory (not shared across server instances — set up Upstash Redis for an accurate count)';
  if (redis) {
    try {
      const r = await fetch(`${redis.url}/get/${encodeURIComponent(todayKey)}`, {
        headers: { Authorization: `Bearer ${redis.token}` },
      });
      const data = await r.json();
      used = Number(data.result) || 0;
      tracked = 'redis';
    } catch (err) {
      return res.status(500).json({ error: 'Could not read usage from Redis', detail: err.message });
    }
  }

  const remaining = Math.max(0, dailyLimit - used);
  const remainingPct = Math.round((remaining / dailyLimit) * 100);

  return res.status(200).json({
    date: todayKey.replace('crp:chat:count:', ''),
    used,
    dailyLimit,
    remaining,
    remainingPct,
    warning: remainingPct <= WARNING_THRESHOLD_PCT,
    quotaExceeded: used > dailyLimit,
    tracked,
  });
}
