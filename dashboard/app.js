const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8000'
  : 'https://api.shubhanmehrotra.com';

let lastResponseMs = null;

// ── Theme ─────────────────────────────────────────────────────────────────────

(function initTheme() {
  const toggle = document.getElementById('theme-toggle');
  const body = document.body;

  function applyTheme(dark) {
    dark ? body.classList.add('dark') : body.classList.remove('dark');
    toggle.textContent = dark ? '☀️' : '🌙';
  }

  applyTheme(localStorage.getItem('theme') === 'dark');

  toggle.addEventListener('click', () => {
    const dark = !body.classList.contains('dark');
    applyTheme(dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  });
})();

// ── Fetch helper ──────────────────────────────────────────────────────────────

async function apiFetch(path, timeoutMs = 6000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  const start = performance.now();
  try {
    const res = await fetch(`${API_BASE}${path}`, { signal: controller.signal });
    clearTimeout(id);
    lastResponseMs = Math.round(performance.now() - start);
    updateFooterResponseTime();
    return res.ok ? res.json() : null;
  } catch {
    clearTimeout(id);
    return null;
  }
}

function timeAgo(isoStr) {
  const diff = (Date.now() - new Date(isoStr).getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

// ── Hero ──────────────────────────────────────────────────────────────────────

async function updateHero() {
  const data = await apiFetch('/v1/cv');
  if (!data) return;

  const ageEl = document.getElementById('hero-age');
  if (ageEl && data.age) ageEl.textContent = data.age;

  const ghData = await apiFetch('/v1/github');
  if (!ghData) return;

  const pfp = document.getElementById('hero-pfp');
  const initials = document.getElementById('hero-initials');
  if (pfp && ghData.avatar_url) {
    pfp.src = ghData.avatar_url;
    pfp.onload = () => {
      pfp.style.display = 'block';
      if (initials) initials.style.display = 'none';
    };
  }
}

// ── Server strip ──────────────────────────────────────────────────────────────

async function updateServerStrip() {
  const pill = document.getElementById('strip-pill');
  const stats = document.getElementById('strip-stats');

  const data = await apiFetch('/v1/server');
  if (data) {
    if (pill) {
      pill.className = 'live-pill strip-pill';
      pill.innerHTML = '<span class="live-dot"></span> Live';
    }
    if (stats) {
      stats.textContent = `CPU ${data.cpu_percent?.toFixed(1)}% · Uptime ${data.uptime_human}`;
    }
  } else {
    if (pill) {
      pill.className = 'live-pill strip-pill offline';
      pill.innerHTML = '<span class="live-dot"></span> Offline';
    }
    if (stats) stats.textContent = '';
  }
}

// ── Status pill ───────────────────────────────────────────────────────────────

async function updateStatusPill() {
  const pill = document.getElementById('status-pill');
  if (!pill) return;
  const data = await apiFetch('/v1/ping');
  if (data) {
    pill.className = 'live-pill';
    pill.innerHTML = `<span class="live-dot"></span> Server online`;
  } else {
    pill.className = 'live-pill offline';
    pill.innerHTML = `<span class="live-dot"></span> Offline`;
  }
}

// ── Currently working on ──────────────────────────────────────────────────────

async function updateNow() {
  const data = await apiFetch('/v1/now');
  if (!data) return;

  const el = document.getElementById('now-content');
  if (!el) return;

  el.innerHTML = `
    <div class="now-card">
      <div class="now-label">Currently building</div>
      <div class="now-project">${data.project}</div>
      <div class="now-desc">${data.description}</div>
      <div class="now-tags">
        ${(data.tags || []).map(t => `<span>${t}</span>`).join('')}
      </div>
    </div>
  `;
}

// ── GitHub activity ───────────────────────────────────────────────────────────

async function updateGithub() {
  const data = await apiFetch('/v1/github');
  const el = document.getElementById('github-commits');
  const meta = document.getElementById('github-meta');
  if (!el) return;

  if (!data) {
    el.innerHTML = '<p style="color:#888;font-size:0.9rem;grid-column:1/-1">GitHub data unavailable</p>';
    return;
  }

  if (meta) meta.textContent = `${data.public_repos} repos · ${data.followers} followers`;

  el.innerHTML = (data.recent_commits || []).map(c => `
    <div class="commit-item">
      <div class="commit-repo">${c.repo}</div>
      <div class="commit-msg">${c.message}</div>
      <div class="commit-time">${timeAgo(c.date)}</div>
    </div>
  `).join('');
}

// ── Footer response time ──────────────────────────────────────────────────────

function updateFooterResponseTime() {
  const el = document.getElementById('footer-response');
  if (el && lastResponseMs !== null) {
    el.textContent = `Last API call: ${lastResponseMs}ms`;
  }
}

// ── Tabs (experience) ─────────────────────────────────────────────────────────

function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.panel;
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.timeline-panel').forEach(p => {
        p.style.display = p.id === target ? 'block' : 'none';
      });
    });
  });
  if (tabs.length) tabs[0].click();
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initTabs();

  updateHero();
  updateStatusPill();
  updateServerStrip();
  updateNow();
  updateGithub();

  setInterval(updateServerStrip, 10000);
  setInterval(updateStatusPill,  30000);
  setInterval(updateGithub,     300000);
});
