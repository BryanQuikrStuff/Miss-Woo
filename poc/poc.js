(function () {
  const statusEl = document.getElementById('status');
  const envEl = document.getElementById('env');
  const verEl = document.getElementById('ver');
  const logEl = document.getElementById('log');
  const emailsEl = document.getElementById('emails');
  const btnCopy = document.getElementById('btn-copy');
  const btnClear = document.getElementById('btn-clear');

  const seenEmails = new Set();
  const MAX_LOG = 5000;

  function setStatus(message) {
    statusEl.textContent = message;
  }

  function log(message, payload) {
    const ts = new Date().toISOString().slice(11, 19);
    let line = `[${ts}] ${message}`;
    if (payload) {
      try {
        const keys = Object.keys(payload);
        line += ` keys=${JSON.stringify(keys)}`;
        if (payload.id) line += ` id=${payload.id}`;
        if (payload.thread && payload.thread.id) line += ` thread.id=${payload.thread.id}`;
      } catch (_) {}
    }
    logEl.textContent += line + '\n';
    if (logEl.textContent.length > MAX_LOG) {
      logEl.textContent = logEl.textContent.slice(-MAX_LOG);
    }
    logEl.scrollTop = logEl.scrollHeight;
  }

  function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const lower = email.toLowerCase();
    if (lower.endsWith('@quikrstuff.com')) return false;
    return /[^@\s]+@[^@\s]+\.[^@\s]+/.test(lower);
  }

  function recordEmail(email, source) {
    if (!isValidEmail(email)) return false;
    if (seenEmails.has(email)) return false;
    seenEmails.add(email);
    const li = document.createElement('li');
    li.textContent = `${email}  (${source})`;
    emailsEl.appendChild(li);
    window.MissivePOC.emails = Array.from(seenEmails);
    btnCopy.disabled = seenEmails.size === 0;
    return true;
  }

  function extractFromArray(arr, source) {
    if (!Array.isArray(arr)) return false;
    for (const item of arr) {
      if (typeof item === 'string') {
        if (recordEmail(item, source)) return true;
      } else if (item && typeof item === 'object') {
        if (item.email && recordEmail(item.email, source)) return true;
        if (item.address && recordEmail(item.address, source)) return true;
        if (item.handle && recordEmail(item.handle, source)) return true;
      }
    }
    return false;
  }

  function extractEmail(payload) {
    try {
      if (!payload || typeof payload !== 'object') return false;

      if (payload.email && recordEmail(payload.email, 'payload.email')) return true;
      if (payload.recipient && payload.recipient.email && recordEmail(payload.recipient.email, 'recipient.email')) return true;

      if (payload.contact) {
        const c = payload.contact;
        if (Array.isArray(c.emails) && extractFromArray(c.emails, 'contact.emails')) return true;
        if (c.email && recordEmail(c.email, 'contact.email')) return true;
      }

      if (payload.message) {
        const m = payload.message;
        if (m.from && typeof m.from === 'string' && recordEmail(m.from, 'message.from')) return true;
        if (Array.isArray(m.from)) { if (extractFromArray(m.from, 'message.from[]')) return true; }
        if (Array.isArray(m.to)) { if (extractFromArray(m.to, 'message.to[]')) return true; }
        if (Array.isArray(m.cc)) { if (extractFromArray(m.cc, 'message.cc[]')) return true; }
        if (Array.isArray(m.bcc)) { if (extractFromArray(m.bcc, 'message.bcc[]')) return true; }
        if (m.headers && typeof m.headers === 'object') {
          const from = m.headers.From || m.headers.from;
          if (typeof from === 'string') {
            const match = from.match(/<([^>]+)>/);
            if (match && recordEmail(match[1], 'headers.From')) return true;
          }
        }
      }

      if (payload.thread && Array.isArray(payload.thread.participants)) {
        if (extractFromArray(payload.thread.participants, 'thread.participants')) return true;
      }
      if (Array.isArray(payload.participants)) {
        if (extractFromArray(payload.participants, 'participants')) return true;
      }

      for (const [key, value] of Object.entries(payload)) {
        if (typeof value === 'string' && /@/.test(value) && isValidEmail(value)) {
          if (recordEmail(value, `payload.${key}`)) return true;
        }
      }
    } catch (err) {
      log('extractEmail error', { error: String(err) });
    }
    return false;
  }

  function wireEvents() {
    const M = window.Missive;
    if (!M || !M.on) {
      envEl.textContent = 'env: no-window.Missive';
      setStatus('Missive API not available');
      log('Missive API not available');
      return;
    }
    envEl.textContent = 'env: missive';
    setStatus('Missive API detected');
    log('Missive API detected');

    M.on('ready', async () => {
      setStatus('Missive ready');
      log('event: ready');
      try {
        const convos = await M.fetchConversations({ limit: 1 });
        log('fetchConversations ok', { count: Array.isArray(convos) ? convos.length : 0 });
      } catch (e) {
        log('fetchConversations error', { error: String(e) });
      }
    });

    const handlers = [
      'change:conversations',
      'conversation:focus',
      'conversation:open',
      'email:focus',
      'email:open',
      'email:select',
      'thread:focus',
      'thread:select',
    ];

    for (const evt of handlers) {
      M.on(evt, (payload) => {
        log(`event: ${evt}`, payload || {});
        const got = extractEmail(payload || {});
        if (!got) setStatus(`${evt}: no email`);
        else setStatus(`${evt}: email captured`);
        try {
          window.parent && window.parent.postMessage({ type: 'missive-poc:event', evt, emails: Array.from(seenEmails) }, '*');
        } catch (_) {}
      });
    }
  }

  function init() {
    window.MissivePOC = {
      getEmails: () => Array.from(seenEmails),
      clear: () => { seenEmails.clear(); emailsEl.innerHTML = ''; btnCopy.disabled = true; },
    };

    btnCopy.addEventListener('click', async () => {
      const text = Array.from(seenEmails).join('\n');
      try {
        await navigator.clipboard.writeText(text);
        setStatus('Copied to clipboard');
      } catch (_) {
        setStatus('Copy failed');
      }
    });
    btnClear.addEventListener('click', () => {
      logEl.textContent = '';
      window.MissivePOC.clear();
      setStatus('Cleared');
    });

    fetch('../version.json').then(r => r.ok ? r.json() : { version: '0' }).then(v => {
      verEl.textContent = 'v' + (v.version || '0');
    }).catch(() => {});

    setStatus('Initializing…');
    if (window.Missive) wireEvents();
    else {
      setStatus('Waiting for Missive API…');
      const check = setInterval(() => {
        if (window.Missive) { clearInterval(check); wireEvents(); }
      }, 300);
      setTimeout(() => clearInterval(check), 15000);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();


