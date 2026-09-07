// Vercel Serverless Function: receives the Contact page form submission and
// creates a lead in Odoo CRM via JSON-RPC. Odoo credentials live only in
// Vercel environment variables (ODOO_URL, ODOO_DB, ODOO_USERNAME,
// ODOO_API_KEY) — never in client-side code — so the browser never sees them.

async function odooCall(odooUrl, service, method, args) {
  const res = await fetch(`${odooUrl}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { service, method, args } }),
  });
  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.data?.message || data.error.message || 'Odoo request failed');
  }
  return data.result;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, phone, subject, message, website, lang } = req.body || {};
  const isId = lang === 'id';

  const messages = {
    validation: isId
      ? 'Mohon isi nama, email yang valid, dan pesan Anda.'
      : 'Please fill in your name, a valid email, and a message.',
    misconfigured: isId
      ? 'Server bermasalah. Silakan hubungi kami lewat telepon.'
      : 'Server misconfigured. Please contact us by phone instead.',
    failed: isId
      ? 'Pesan tidak bisa terkirim saat ini. Silakan coba lagi sebentar lagi atau hubungi kami lewat telepon.'
      : 'Could not send your message right now. Please try again shortly or reach us by phone.',
  };

  // Honeypot: real visitors never fill this hidden field. Bots usually do.
  // Pretend success so bots don't learn to look for a different signal.
  if (website) {
    return res.status(200).json({ success: true });
  }

  if (!name || !email || !message || !isValidEmail(email)) {
    return res.status(400).json({ error: messages.validation });
  }

  const { ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_API_KEY } = process.env;
  if (!ODOO_URL || !ODOO_DB || !ODOO_USERNAME || !ODOO_API_KEY) {
    console.error('Missing Odoo environment variables');
    return res.status(500).json({ error: messages.misconfigured });
  }

  try {
    const uid = await odooCall(ODOO_URL, 'common', 'authenticate', [ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, {}]);
    if (!uid) throw new Error('Odoo authentication failed');

    await odooCall(ODOO_URL, 'object', 'execute_kw', [
      ODOO_DB, uid, ODOO_API_KEY,
      'crm.lead', 'create',
      [{
        name: subject?.trim() || `Website inquiry from ${name}`,
        contact_name: String(name).trim(),
        email_from: String(email).trim(),
        phone: phone ? String(phone).trim() : '',
        description: `${message}\n\n(Submitted via crplegacy.biz.id contact form)`,
      }],
    ]);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Odoo lead creation failed:', err.message);
    return res.status(502).json({ error: messages.failed });
  }
}
