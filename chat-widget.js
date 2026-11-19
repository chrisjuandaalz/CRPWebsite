// CRP website chat widget. Vanilla JS, no dependencies. Talks to /api/chat,
// which calls Gemini and is grounded on CRP's published content. Styled with
// the same Tailwind utility classes used across the site (the Tailwind CDN
// script already on every page compiles classes found in this injected
// markup too).
(function () {
  const isId = document.documentElement.lang !== 'en';
  const strings = isId
    ? {
        launcherLabel: 'Tanya kami',
        title: 'Ciara',
        subtitle: 'Asisten AI Christian Rara & Partners',
        placeholder: 'Tulis pertanyaan Anda…',
        send: 'Kirim',
        greeting: 'Halo! Saya Ciara, asisten AI Christian Rara & Partners. Ada yang bisa saya bantu seputar layanan advisory asuransi atau suksesi kami?',
        thinking: 'Mengetik…',
        disclaimer: 'Jawaban bersifat umum, bukan nasihat personal. Untuk kebutuhan spesifik, jadwalkan konsultasi pribadi.',
      }
    : {
        launcherLabel: 'Ask us',
        title: 'Ciara',
        subtitle: "Christian Rara & Partners' AI assistant",
        placeholder: 'Type your question…',
        send: 'Send',
        greeting: "Hi! I'm Ciara, Christian Rara & Partners' AI assistant. What would you like to know about our insurance or succession advisory services?",
        thinking: 'Typing…',
        disclaimer: 'Answers are general information, not personal advice. For specific needs, please book a private consultation.',
      };

  const history = [];
  let open = false;
  let sending = false;

  const launcher = document.createElement('button');
  launcher.setAttribute('aria-label', strings.launcherLabel);
  launcher.className =
    'fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-gradient-to-r from-[#C5A880] to-[#D4AF37] text-[#0A192F] shadow-lg shadow-[#C5A880]/30 flex items-center justify-center hover:brightness-110 transition-all';
  launcher.innerHTML =
    '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>';

  const panel = document.createElement('div');
  panel.className =
    'fixed bottom-24 right-6 z-50 hidden w-[90vw] max-w-sm h-[70vh] max-h-[520px] flex-col rounded-2xl border border-[#1E2D4A] bg-[#0A192F] shadow-2xl overflow-hidden';
  panel.innerHTML = `
    <div class="flex items-center justify-between px-5 py-4 border-b border-[#1E2D4A] bg-gradient-to-r from-[#112240] to-[#0A192F]">
      <div>
        <div class="text-white font-bold text-sm">${strings.title}</div>
        <div class="text-slate-400 text-xs">${strings.subtitle}</div>
      </div>
      <button type="button" aria-label="Close" class="crp-chat-close text-slate-400 hover:text-white p-1">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="crp-chat-messages flex-1 overflow-y-auto px-4 py-4 space-y-3 text-sm"></div>
    <form class="crp-chat-form flex items-center gap-2 border-t border-[#1E2D4A] p-3">
      <input type="text" class="crp-chat-input flex-1 bg-[#112240] border border-[#1E2D4A] rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#C5A880]" placeholder="${strings.placeholder}" autocomplete="off">
      <button type="submit" class="crp-chat-send bg-gradient-to-r from-[#C5A880] to-[#D4AF37] text-[#0A192F] text-sm font-bold px-4 py-2.5 rounded-xl hover:brightness-110 transition-all">${strings.send}</button>
    </form>
    <div class="px-4 pb-3 text-[10px] text-slate-500">${strings.disclaimer}</div>
  `;

  document.body.appendChild(launcher);
  document.body.appendChild(panel);

  const messagesEl = panel.querySelector('.crp-chat-messages');
  const formEl = panel.querySelector('.crp-chat-form');
  const inputEl = panel.querySelector('.crp-chat-input');
  const closeEl = panel.querySelector('.crp-chat-close');

  function addBubble(text, role) {
    const bubble = document.createElement('div');
    const isUser = role === 'user';
    bubble.className = isUser
      ? 'ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-[#C5A880] text-[#0A192F] px-3.5 py-2.5 font-medium'
      : 'mr-auto max-w-[85%] rounded-2xl rounded-tl-sm bg-[#112240] text-slate-200 px-3.5 py-2.5';
    bubble.textContent = text;
    messagesEl.appendChild(bubble);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return bubble;
  }

  function toggle(forceOpen) {
    open = typeof forceOpen === 'boolean' ? forceOpen : !open;
    panel.classList.toggle('hidden', !open);
    panel.classList.toggle('flex', open);
    if (open && !messagesEl.childElementCount) {
      addBubble(strings.greeting, 'model');
    }
    if (open) inputEl.focus();
  }

  launcher.addEventListener('click', () => toggle());
  closeEl.addEventListener('click', () => toggle(false));

  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = inputEl.value.trim();
    if (!text || sending) return;

    sending = true;
    inputEl.value = '';
    addBubble(text, 'user');
    const thinkingBubble = addBubble(strings.thinking, 'model');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: history.slice(-8),
          lang: isId ? 'id' : 'en',
        }),
      });
      const data = await res.json();
      thinkingBubble.textContent = data.reply;
      history.push({ role: 'user', text });
      history.push({ role: 'model', text: data.reply });
    } catch (err) {
      thinkingBubble.textContent = isId
        ? 'Maaf, terjadi gangguan koneksi. Coba lagi sebentar.'
        : 'Sorry, a connection error occurred. Please try again shortly.';
    } finally {
      sending = false;
    }
  });
})();
