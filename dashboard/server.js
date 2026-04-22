const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8000'
  : 'https://api.shubhanmehrotra.com';

// ── Theme ──────────────────────────────────────────────────────────────────

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

// ── Fetch ──────────────────────────────────────────────────────────────────

async function apiFetch(path, { timeout = 8000, format = 'json' } = {}) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeout);
  const t0 = performance.now();
  try {
    const res = await fetch(`${API_BASE}${path}`, { signal: ctrl.signal });
    clearTimeout(tid);
    const ms = Math.round(performance.now() - t0);
    const el = document.getElementById('footer-response');
    if (el) el.textContent = `Last response: ${ms}ms`;
    if (!res.ok) return null;
    return format === 'text' ? res.text() : res.json();
  } catch {
    clearTimeout(tid);
    return null;
  }
}

function timeAgo(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60)    return `${Math.round(s)}s ago`;
  if (s < 3600)  return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

// ── Status pill ────────────────────────────────────────────────────────────

async function updateStatusPill() {
  const pill = document.getElementById('status-pill');
  if (!pill) return;
  const data = await apiFetch('/v1/ping');
  pill.className = data ? 'live-pill' : 'live-pill offline';
  pill.innerHTML = data
    ? '<span class="live-dot"></span> Online'
    : '<span class="live-dot"></span> Offline';
}

// ── Stats ──────────────────────────────────────────────────────────────────

function setBar(id, pct) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.width = `${Math.min(100, pct)}%`;
  el.className = 'stat-bar-fill';
  if (pct > 85) el.classList.add('danger');
  else if (pct > 65) el.classList.add('warn');
}

async function updateStats() {
  const d = await apiFetch('/v1/server');
  if (!d) return;

  const uptime = document.getElementById('srv-uptime');
  if (uptime) uptime.textContent = d.uptime_human ?? '—';

  const cpu = document.getElementById('srv-cpu');
  if (cpu) cpu.textContent = `${(d.cpu_percent ?? 0).toFixed(1)}%`;
  setBar('srv-cpu-bar', d.cpu_percent ?? 0);

  if (d.memory) {
    const ram = document.getElementById('srv-ram');
    const ramNote = document.getElementById('srv-ram-note');
    if (ram) ram.textContent = `${(d.memory.used_gb ?? 0).toFixed(1)} GB`;
    if (ramNote) ramNote.textContent = `of ${(d.memory.total_gb ?? 0).toFixed(1)} GB`;
    setBar('srv-ram-bar', d.memory.percent_used ?? 0);
  }

  if (d.disk) {
    const disk = document.getElementById('srv-disk');
    const diskNote = document.getElementById('srv-disk-note');
    if (disk) disk.textContent = `${(d.disk.free_gb ?? 0).toFixed(0)} GB`;
    if (diskNote) diskNote.textContent = `of ${(d.disk.total_gb ?? 0).toFixed(0)} GB total`;
    const usedPct = d.disk.total_gb ? ((d.disk.total_gb - d.disk.free_gb) / d.disk.total_gb) * 100 : 0;
    setBar('srv-disk-bar', usedPct);
  }

  const load = d.load_avg ?? [0, 0, 0];
  const loadVal = document.getElementById('srv-load');
  if (loadVal) loadVal.textContent = load[0].toFixed(2);
  const chips = [
    ['srv-l1', load[0]],
    ['srv-l5', load[1]],
    ['srv-l15', load[2]],
  ];
  chips.forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = `${val.toFixed(2)}`;
  });
}

// ── Availability ───────────────────────────────────────────────────────────

async function updateAvailability() {
  const d = await apiFetch('/v1/availability');
  const grid = document.getElementById('srv-avail-grid');
  const badge = document.getElementById('srv-avail-pct');
  if (!grid) return;
  if (!d || !d.days) {
    grid.innerHTML = '<span style="font-size:0.82rem;color:var(--srv-muted)">No data yet</span>';
    return;
  }
  grid.innerHTML = d.days.map(day => {
    const tip = `${day.date}: ${day.uptime_percent}% uptime`;
    return `<div class="avail-day ${day.status}" title="${tip}"></div>`;
  }).join('');
  if (badge && d.summary?.last_30_days != null) {
    badge.textContent = `${d.summary.last_30_days}% avg`;
  }
}

// ── Response times ─────────────────────────────────────────────────────────

async function updateResponseTimes() {
  const d = await apiFetch('/v1/response-times');
  const el = document.getElementById('srv-resp-times');
  if (!el) return;
  if (!d || !d.endpoints || Object.keys(d.endpoints).length === 0) {
    el.innerHTML = '<div class="srv-loading">No data yet.</div>';
    return;
  }
  // endpoints is a dict: { "/v1/ping": { p50, p95, p99, count }, ... }
  const rows = Object.entries(d.endpoints)
    .map(([path, s]) => ({ path, avg: s.p50 ?? 0, p95: s.p95 ?? 0, count: s.count ?? 0 }))
    .filter(e => e.path.startsWith('/v1/'))
    .sort((a, b) => b.count - a.count)
    .slice(0, 9);
  const maxAvg = Math.max(...rows.map(e => e.avg), 1);
  el.innerHTML = rows.map(e => {
    const pct = Math.max(2, Math.min(100, (e.avg / maxAvg) * 100));
    return `
      <div class="resp-row">
        <code class="resp-path">${e.path}</code>
        <div class="resp-bar-wrap"><div class="resp-bar" style="width:${pct}%"></div></div>
        <span class="resp-val">${e.avg.toFixed(0)}ms</span>
        <span class="resp-count">${e.count}</span>
      </div>`;
  }).join('');
}

// ── Live feed ──────────────────────────────────────────────────────────────

async function updateFeed() {
  const d = await apiFetch('/v1/logs');
  const el = document.getElementById('srv-feed');
  if (!el) return;
  const logs = d?.logs;
  if (!logs || logs.length === 0) return;

  const rows = [...logs].reverse().slice(0, 25);
  el.innerHTML = rows.map(r => {
    const method = (r.method ?? 'GET').toUpperCase();
    const mClass = method === 'GET' ? 'get' : method === 'POST' ? 'post' : 'other';
    const s = r.status ?? 0;
    const sClass = s < 400 ? 'ok' : s < 500 ? 'warn' : 'err';
    const ms = r.duration_ms != null ? `${r.duration_ms.toFixed(0)}ms` : '—';
    const when = r.timestamp ? timeAgo(r.timestamp) : '—';
    return `
      <div class="srv-feed-row">
        <span class="feed-method feed-method-${mClass}">${method}</span>
        <code class="feed-path">${r.path ?? '—'}</code>
        <span class="feed-status feed-${sClass}">${s}</span>
        <span class="feed-ms">${ms}</span>
        <span class="feed-when">${when}</span>
      </div>`;
  }).join('');
}

// ── Cache Cluster ──────────────────────────────────────────────────────────

async function updateCacheCluster() {
  const el = document.getElementById('srv-cache-cluster');
  if (!el) return;
  const d = await apiFetch('/v1/cluster');
  if (!d || !d.nodes) {
    el.innerHTML = '<div class="srv-loading">Cache cluster unavailable</div>';
    return;
  }

  const summary = d.summary || {};
  const nodes   = d.nodes  || [];
  const alive   = summary.alive ?? 0;
  const total   = summary.total ?? nodes.length;
  const allGood = alive === total;

  const nodeChips = nodes.map(n => {
    const id  = n.node_id || n.id || '?';
    const st  = n.status  || 'unreachable';
    const sc  = st === 'alive' ? 'ok' : st === 'suspect' ? 'warn' : 'err';
    const peers = n.peer_states
      ? Object.entries(n.peer_states).map(([pid, pst]) => {
          const pc = pst === 'alive' ? 'ok' : pst === 'suspect' ? 'warn' : 'err';
          return `<span class="cache-peer-dot cache-dot-${pc}" title="${pid}: ${pst}"></span>`;
        }).join('')
      : '';
    return `
      <div class="cache-node-card">
        <div class="cache-node-top">
          <span class="cache-dot cache-dot-${sc}"></span>
          <span class="cache-node-id">${id}</span>
        </div>
        <div class="cache-node-keys">${n.keys_held ?? '—'}</div>
        <div class="cache-node-label">keys</div>
        ${n.uptime_seconds != null ? `<div class="cache-node-uptime">${fmtUp(n.uptime_seconds)}</div>` : ''}
        <div class="cache-peers-row">${peers}</div>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div class="cache-cluster-wrap">
      <div class="cache-summary-row">
        <span class="cache-summary-stat ${allGood ? 'good' : 'warn'}">${alive}/${total} nodes alive</span>
        <span class="cache-summary-stat">${summary.total_keys ?? 0} keys cached</span>
        <span class="cache-summary-stat">3-node consistent hash ring</span>
      </div>
      <div class="cache-nodes-row">${nodeChips}</div>
    </div>`;
}

function fmtUp(s) {
  if (!s && s !== 0) return '—';
  if (s < 60)   return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

// ── API Explorer ───────────────────────────────────────────────────────────

function initApiExplorer() {
  document.querySelectorAll('.api-row').forEach(row => {
    const btn = row.querySelector('.api-btn');
    const path = row.dataset.path;
    const fmt = row.dataset.format ?? 'json';
    const key = path.replace('/v1/', '');
    const output = document.getElementById(`out-${key}`);
    if (!btn || !output) return;

    btn.addEventListener('click', async e => {
      e.stopPropagation();
      btn.textContent = '…';
      btn.disabled = true;
      output.style.display = 'block';
      const method = row.dataset.method ?? 'GET';
      output.textContent = `// ${method} ${API_BASE}${path}`;

      const data = method === 'POST'
        ? await fetch(`${API_BASE}${path}`, { method: 'POST' }).then(r => r.json()).catch(() => null)
        : await apiFetch(path, { timeout: 12000, format: fmt });
      if (data !== null) {
        output.textContent = fmt === 'text'
          ? String(data)
          : JSON.stringify(data, null, 2);
        btn.textContent = '✓';
        btn.style.background = '#16a34a';
        setTimeout(() => {
          btn.textContent = 'Try';
          btn.style.background = '';
          btn.disabled = false;
        }, 2500);
      } else {
        output.textContent = '// request failed or timed out';
        btn.textContent = 'Retry';
        btn.disabled = false;
      }
    });
  });
}

// ── Init ───────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initApiExplorer();

  updateStatusPill();
  updateStats();
  updateAvailability();
  updateResponseTimes();
  updateFeed();
  updateCacheCluster();

  setInterval(updateStats,          5000);
  setInterval(updateFeed,           5000);
  setInterval(updateCacheCluster,  10000);
  setInterval(updateStatusPill,    30000);
  setInterval(updateResponseTimes,  60000);
  setInterval(updateAvailability,  300000);
});
