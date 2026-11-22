const $ = id => document.getElementById(id);
const fmt = n => n == null ? '—' : Intl.NumberFormat('en-IN', {notation: n >= 100000 ? 'compact' : 'standard', maximumFractionDigits: 1}).format(n);
const DAY = 864e5;
const START = '2026-11-14';                      /* day one of Factify Hindi tracking */
const C = {ink: '#1b1240', mut: '#5d5282', soft: '#ddd2ff', surf: '#efeaff', gold: '#d18f00', y: '#ffd23f', up: '#0f8a5f', miss: '#e5345b', violet: '#7a5cf0'};
const esc = s => String(s || '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const dshort = iso => new Date(iso).toLocaleDateString('en-IN', {day: 'numeric', month: 'short'});
let yt = null, ig = null, chart;
const store = (k, d) => { try { return localStorage.getItem(k) || d; } catch(e){ return d; } };
const save = (k, v) => { try { localStorage.setItem(k, v); } catch(e){} };
let feed = store('fh_feed', 'yt'), show = store('fh_show', 'both'), perfSrc = store('fh_perf', 'yt');

const istNow = () => new Date(Date.now() + 5.5 * 3600e3);
const daysAgo = d => new Date(istNow() - d * DAY).toISOString().slice(0, 10);
const istDay = iso => new Date(new Date(iso).getTime() + 5.5 * 3600e3).toISOString().slice(0, 10);
function past(hist, key, days){
  const target = daysAgo(days), ds = Object.keys(hist || {}).filter(d => d <= target).sort();
  return ds.length ? hist[ds[ds.length - 1]][key] : null;
}
function delta(cur, prev){
  if (cur == null) return '';
  if (prev == null) prev = cur;                  /* first day: 0 until there is history */
  const d = cur - prev;
  return d < 0 ? `<b class="down">▼ ${fmt(-d)}</b> today` : `▲ ${fmt(d)} today`;
}
const ago = iso => { const m = Math.round((Date.now() - new Date(iso)) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : Math.round(m / 60) + ' h ago'; };
const getJSON = async f => { try { const r = await fetch(f + '?t=' + Date.now()); return r.ok ? await r.json() : null; } catch(e){ return null; } };

async function load(){
  [yt, ig] = await Promise.all([getJSON('data.json'), getJSON('data-ig.json')]);
  if (yt){
    const s = yt.latest;
    $('subs').textContent = s.subs == null ? 'Hidden' : fmt(s.subs);
    $('views').textContent = fmt(s.views);
    $('subsD').innerHTML = delta(s.subs, past(yt.history, 'subs', 1));
    $('viewsD').innerHTML = delta(s.views, past(yt.history, 'views', 1));
  }
  if (ig && ig.latest){
    const s = ig.latest;
    $('igf').textContent = fmt(s.followers);
    $('igl').textContent = fmt(s.likes);
    $('igfD').innerHTML = delta(s.followers, past(ig.history, 'followers', 1));
    $('iglD').innerHTML = delta(s.likes, past(ig.history, 'likes', 1));
    if (ig.account && ig.account.username) $('igLink').href = 'https://www.instagram.com/' + ig.account.username + '/';
  }
  for (const f of [renderPosts, drawChart, renderWeek, renderPerf, renderMiles, renderCal, renderBest, warnings]) { try { f(); } catch(e){ console.error(f.name, e); } }
  const t = [yt && yt.updatedAt, ig && ig.updatedAt].filter(Boolean).sort().pop();
  const txt = t ? 'Updated ' + ago(t) : 'No data yet — run the GitHub Action once';
  $('updated').innerHTML = (t ? '<span class="live"></span>' : '') + txt;
  $('updated2').textContent = txt + ' ·';
}

/* ---------- Growth graph ---------- */
function drawChart(){
  document.querySelectorAll('[data-show]').forEach(b => b.setAttribute('aria-pressed', b.dataset.show === show));
  const yh = (yt && yt.history) || {}, ih = (ig && ig.history) || {};
  const dates = [...new Set([...(show !== 'ig' ? Object.keys(yh) : []), ...(show !== 'yt' ? Object.keys(ih) : [])])].filter(d => d >= START).sort().slice(-90);
  const ctx = $('chart').getContext('2d');
  const mk = (label, color, rgb, vals) => {
    const g = ctx.createLinearGradient(0, 0, 0, 290); g.addColorStop(0, `rgba(${rgb},.22)`); g.addColorStop(1, `rgba(${rgb},0)`);
    return {label, data: vals, borderColor: color, backgroundColor: g, fill: 'origin', tension: .4, borderWidth: 3, borderCapStyle: 'round',
      pointRadius: vals.map((_, i) => i === vals.length - 1 ? 5 : 0), pointHoverRadius: 6, pointBackgroundColor: color, pointBorderColor: C.surf, pointBorderWidth: 3, spanGaps: true};
  };
  const sets = [];
  if (show !== 'ig') sets.push(mk('YouTube subscribers', C.gold, '209,143,0', dates.map(d => yh[d] ? yh[d].subs : null)));
  if (show !== 'yt') sets.push(mk('Instagram followers', C.ink, '27,18,64', dates.map(d => ih[d] ? ih[d].followers : null)));
  $('legend').innerHTML = sets.map(s => `<span><i style="background:${s.borderColor}"></i>${s.label}</span>`).join('');
  $('chartNote').hidden = dates.length >= 2;
  $('chartNote').textContent = 'Tracking started — a new point is added every day.';
  if (chart) chart.destroy();
  chart = new Chart(ctx, {type: 'line',
    data: {labels: dates.map(d => dshort(d + 'T00:00:00')), datasets: sets},
    options: {responsive: true, maintainAspectRatio: false, interaction: {mode: 'index', intersect: false},
      layout: {padding: {top: 8, right: 8}},
      plugins: {legend: {display: false},
        tooltip: {backgroundColor: C.ink, titleColor: '#fff', bodyColor: '#e8e1ff', padding: 10, cornerRadius: 12, boxPadding: 4, usePointStyle: true,
          titleFont: {family: 'Inter', weight: '600'}, bodyFont: {family: 'Inter'}, callbacks: {label: c => ` ${c.dataset.label}: ${fmt(c.parsed.y)}`}}},
      scales: {x: {ticks: {color: C.mut, font: {family: 'Inter', size: 11}, maxRotation: 0, autoSkipPadding: 14}, grid: {display: false}, border: {display: false}},
               y: {beginAtZero: true, ticks: {color: C.mut, font: {family: 'Inter', size: 11}, precision: 0, callback: v => fmt(v), maxTicksLimit: 5},
                   grid: {color: 'rgba(27,18,64,.07)'}, border: {display: false}}}}});
}
document.querySelectorAll('[data-show]').forEach(b => b.onclick = () => { show = b.dataset.show; save('fh_show', show); drawChart(); });

/* ---------- Milestones ---------- */
const STEPS = [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000, 5000000, 10000000];
const VSTEPS = [1000, 10000, 50000, 100000, 500000, 1000000, 5000000, 10000000, 50000000, 100000000];
function eta(hist, key, cur, next){
  const ds = Object.keys(hist || {}).filter(d => d >= START).sort();
  if (ds.length < 2) return 'keep posting to see an estimate';
  const first = hist[ds[0]][key] || 0, span = Math.max(1, (new Date(ds[ds.length - 1]) - new Date(ds[0])) / DAY);
  const rate = (cur - first) / span;
  if (rate <= 0) return 'keep posting to see an estimate';
  const days = Math.ceil((next - cur) / rate);
  if (days <= 1) return 'about tomorrow';
  return 'around ' + dshort(Date.now() + days * DAY);
}
function ring(cur, steps, color, label, hist, key){
  if (cur == null) return '';
  const next = steps.find(x => x > cur) || cur, prev = [0, ...steps].filter(x => x <= cur).pop();
  const pct = next === prev ? 100 : Math.round((cur - prev) / (next - prev) * 100);
  const L = 2 * Math.PI * 29, on = Math.max(pct, 2) / 100 * L;
  return `<div class="mrow"><svg class="ring" viewBox="0 0 70 70" role="img" aria-label="${pct}% of the way">
      <circle cx="35" cy="35" r="29" fill="none" stroke="${C.soft}" stroke-width="8"/>
      <circle cx="35" cy="35" r="29" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${on} ${L}" transform="rotate(-90 35 35)"/>
      <text x="35" y="40" text-anchor="middle">${pct}%</text></svg>
    <div class="mt"><b>${fmt(cur)} / ${fmt(next)} ${label}</b><span>${fmt(next - cur)} to go · ${eta(hist, key, cur, next)}</span></div></div>`;
}
function renderMiles(){
  const ys = (yt && yt.latest) || {}, is = (ig && ig.latest) || {};
  $('miles').innerHTML = (ring(ys.subs, STEPS, C.gold, 'subscribers', yt && yt.history, 'subs') +
    ring(is.followers, STEPS, C.ink, 'followers', ig && ig.history, 'followers') +
    ring(ys.views, VSTEPS, C.violet, 'views', yt && yt.history, 'views')) || '<div class="empty">Waiting for data…</div>';
}

/* ---------- Upload calendar (ticks itself when a post goes live) ---------- */
function renderCal(){
  const box = $('cal');
  const plan = (typeof SCHEDULE !== 'undefined' && SCHEDULE) || [];
  if (!plan.length){ box.innerHTML = '<div class="empty">No upload plan loaded.</div>'; return; }
  const ytD = new Set(((yt && yt.videos) || []).map(v => istDay(v.published)));
  const igD = new Set(((ig && ig.media) || []).filter(m => m.published).map(m => istDay(m.published)));
  const now = istNow(), today = now.toISOString().slice(0, 10), hm = now.toISOString().slice(11, 16);
  const byDay = {}; plan.forEach(p => byDay[p.date] = p);
  const state = p => {
    const y = ytD.has(p.date), i = igD.has(p.date);
    if (y || i) return {k: 'done', y, i};
    if (p.date < today) return {k: 'miss'};
    if (p.date === today) return {k: hm >= (p.time || '17:30') ? 'late' : 'today'};
    return {k: 'soon'};
  };
  let posted = 0, missed = 0, streak = 0;
  plan.forEach(p => { const k = state(p).k; if (k === 'done') posted++; if (k === 'miss') missed++; });
  for (const p of [...plan].reverse()){ if (p.date > today) continue; const k = state(p).k; if (k === 'done') streak++; else if (k === 'today') continue; else break; }
  const first = new Date(plan[0].date + 'T00:00:00Z'), last = new Date(plan[plan.length - 1].date + 'T00:00:00Z');
  const d = new Date(first); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  let cells = '';
  for (let n = 0; d <= last || n % 7; n++, d.setUTCDate(d.getUTCDate() + 1)){
    const ds = d.toISOString().slice(0, 10), p = byDay[ds], dn = d.getUTCDate();
    if (!p){ cells += '<div class="cal-c off"><span class="cal-o"></span></div>'; continue; }
    const s = state(p);
    const where = s.k === 'done' ? (s.y && s.i ? 'YouTube + Instagram' : s.y ? 'YouTube' : 'Instagram') : '';
    const tip = `${dshort(ds + 'T00:00:00')} · #${p.n} ${p.title || ''}` + {done: ` — posted on ${where}`, miss: ' — missed', today: ` — due at ${p.time || '17:30'}`, late: ' — due now', soon: ''}[s.k];
    const mark = s.k === 'done' ? '✓' : s.k === 'miss' ? '✕' : s.k === 'late' ? '!' : dn;
    cells += `<div class="cal-c ${s.k}"><span class="cal-o" title="${esc(tip)}" aria-label="${esc(tip)}">${mark}</span></div>`;
  }
  $('calSub').textContent = `${posted} of ${plan.length} posted${missed ? ' · ' + missed + ' missed' : ''}${streak > 1 ? ' · 🔥 ' + streak + '-day streak' : ''}`;
  const next = plan.find(p => p.date > today || (p.date === today && state(p).k !== 'done'));
  box.innerHTML = `<div class="cal-g">${['M','T','W','T','F','S','S'].map(w => `<div class="cal-w">${w}</div>`).join('')}${cells}</div>
    <div class="cal-key"><span><i style="background:${C.ink}"></i>Posted</span><span><i style="background:${C.y}"></i>Today</span><span><i style="box-shadow:inset 0 0 0 2px ${C.miss}"></i>Missed</span><span><i style="background:${C.soft}"></i>Planned</span></div>
    ${next ? `<div class="cal-next">Next up: <b>#${next.n} ${esc(next.title)}</b> · ${next.date === today ? 'today' : dshort(next.date + 'T00:00:00')} at ${next.time || '17:30'}</div>` : ''}`;
}

/* ---------- Video performance ---------- */
function spark(vals){
  const v = vals.filter(x => x != null);
  if (v.length < 2) return '<span class="muted">new</span>';
  const w = 64, h = 22, mn = Math.min(...v), mx = Math.max(...v), r = mx - mn || 1;
  const pts = v.map((y, i) => `${(i / (v.length - 1) * w).toFixed(1)},${(h - 3 - (y - mn) / r * (h - 6)).toFixed(1)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}
function renderPerf(){
  document.querySelectorAll('[data-perf]').forEach(b => b.setAttribute('aria-pressed', b.dataset.perf === perfSrc));
  if (perfSrc === 'ig') return renderPerfIG();
  const box = $('perf'), vids = (yt && yt.videos) || [], vh = (yt && yt.videoHistory) || {};
  if (!vids.length){ box.innerHTML = '<div class="empty">Your Shorts will show up here once they go live.</div>'; return; }
  const rows = vids.map(v => {
    const h = vh[v.id] || {}, days = Object.keys(h.daily || {}).sort();
    const eng = v.views ? (v.likes + v.comments) / v.views * 100 : null;
    const ageH = (Date.now() - new Date(v.published)) / 3600e3;
    const f24 = h.first24 != null ? fmt(h.first24) : `<span class="muted">${ageH < 24 ? 'in ' + Math.ceil(24 - ageH) + 'h' : '—'}</span>`;
    return {v, eng, f24, sp: spark(days.map(d => h.daily[d].views))};
  }).sort((a, b) => b.v.views - a.v.views);
  box.innerHTML = `<table class="perf"><thead><tr><th>Short</th><th>Views</th><th class="hide-m">First 24h</th><th>Engagement</th><th class="hide-m">Trend</th></tr></thead><tbody>` +
    rows.map(r => `<tr>
      <td><a class="tt" href="https://youtube.com/watch?v=${r.v.id}" target="_blank" rel="noopener">${r.v.thumb ? `<img src="${r.v.thumb}" alt="">` : '<span class="ph"></span>'}
        <span class="name"><span>${esc(r.v.title.replace(/\s*#shorts\b/i, ''))}</span><small>${dshort(r.v.published)}</small></span></a></td>
      <td>${fmt(r.v.views)}</td><td class="hide-m">${r.f24}</td>
      <td>${r.eng == null ? '—' : `<span class="chip${r.eng < 5 ? ' mid' : ''}">${r.eng.toFixed(1)}%</span>`}</td>
      <td class="hide-m">${r.sp}</td></tr>`).join('') +
    `</tbody></table><p class="perf-note">Engagement = (likes + comments) ÷ views. Green means above 5%, which is strong for Shorts.</p>`;
}

function renderPerfIG(){
  const box = $('perf'), media = ((ig && ig.media) || []).filter(m => m.type === 'REELS' || m.type === 'VIDEO' || m.views != null), mh = (ig && ig.mediaHistory) || {};
  if (!media.length){ box.innerHTML = '<div class="empty">Your Reels will show up here once they go live.</div>'; return; }
  const hasViews = media.some(m => m.views != null);
  const rows = media.map(m => {
    const h = mh[m.id] || {}, days = Object.keys(h.daily || {}).sort();
    const inter = (m.likes || 0) + (m.comments || 0) + (m.saves || 0) + (m.shares || 0);
    return {m, eng: m.views ? inter / m.views * 100 : null, sp: spark(days.map(d => h.daily[d].views))};
  }).sort((a, b) => (b.m.views ?? b.m.likes ?? 0) - (a.m.views ?? a.m.likes ?? 0));
  box.innerHTML = `<table class="perf"><thead><tr><th>Reel</th><th>Views</th><th class="hide-m">Reach</th><th>${hasViews ? 'Engagement' : 'Likes'}</th><th class="hide-m">Trend</th></tr></thead><tbody>` +
    rows.map(r => `<tr>
      <td><a class="tt" href="${r.m.url}" target="_blank" rel="noopener">${r.m.thumb ? `<img src="${r.m.thumb}" alt="">` : '<span class="ph"></span>'}
        <span class="name"><span>${esc(r.m.caption || 'Reel')}</span><small>${dshort(r.m.published)}</small></span></a></td>
      <td>${fmt(r.m.views)}</td><td class="hide-m">${fmt(r.m.reach)}</td>
      <td>${hasViews ? (r.eng == null ? '—' : `<span class="chip${r.eng < 5 ? ' mid' : ''}">${r.eng.toFixed(1)}%</span>`) : fmt(r.m.likes)}</td>
      <td class="hide-m">${r.sp}</td></tr>`).join('') + '</tbody></table>' +
    (hasViews ? '<p class="perf-note">Engagement = (likes + comments + saves + shares) ÷ views. Reach = how many different accounts saw it.</p>'
              : '<p class="perf-note">Reel views and reach need one extra Instagram permission. Until then this shows likes only.</p>');
}
document.querySelectorAll('[data-perf]').forEach(b => b.onclick = () => { perfSrc = b.dataset.perf; save('fh_perf', perfSrc); renderPerf(); });

/* ---------- Best time to post ---------- */
const median = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const slotOf = iso => { const t = new Date(new Date(iso).getTime() + 5.5 * 3600e3); let mins = Math.round((t.getUTCHours() * 60 + t.getUTCMinutes()) / 15) * 15; return mins % 1440; };
const slotLabel = m => { const h = Math.floor(m / 60), mm = String(m % 60).padStart(2, '0'); return `${h % 12 || 12}:${mm} ${h < 12 ? 'AM' : 'PM'}`; };
function bestBlock(title, cls, items){
  const slots = {};
  items.forEach(x => (slots[slotOf(x.published)] = slots[slotOf(x.published)] || []).push(x.v));
  const rows = Object.entries(slots).map(([k, v]) => ({k: +k, n: v.length, med: median(v)})).sort((a, b) => a.k - b.k);
  if (!rows.length) return `<div class="bt ${cls}"><h3><span class="dot ${cls}"></span>${title}</h3><div class="empty">No first-day numbers yet. They appear 24 hours after each upload.</div></div>`;
  const reliable = rows.filter(r => r.n >= 3), top = Math.max(...rows.map(r => r.med)) || 1;
  const win = reliable.length >= 2 ? reliable.reduce((a, b) => b.med > a.med ? b : a) : null;
  return `<div class="bt ${cls}"><h3><span class="dot ${cls}"></span>${title}</h3>` + rows.map(r => `
    <div class="bt-row"><span class="bt-t">${slotLabel(r.k)}</span><span class="bt-bar"><i style="width:${Math.max(4, r.med / top * 100)}%"></i></span>
      <span class="bt-v"><b>${fmt(Math.round(r.med))}</b>${win && win.k === r.k ? '<span class="bt-win">Best</span>' : ''}<small>${r.n} upload${r.n === 1 ? '' : 's'}${r.n < 3 ? ' · need ' + (3 - r.n) + ' more' : ''}</small></span></div>`).join('') + '</div>';
}
function renderBest(){
  const vh = (yt && yt.videoHistory) || {};
  const ytItems = ((yt && yt.videos) || []).map(v => ({published: v.published, v: vh[v.id] && vh[v.id].first24})).filter(x => x.v != null);
  const mh = (ig && ig.mediaHistory) || {};
  const igItems = Object.values(mh).filter(h => h.first24 != null).map(h => ({published: h.published, v: h.first24}));
  $('best').innerHTML = bestBlock('YouTube Shorts', 'yt', ytItems) + bestBlock('Instagram Reels', 'ig', igItems) +
    '<p class="bt-note" style="grid-column:1/-1">Each bar is the typical (middle) first-day views for uploads at that time, so one viral video can\'t skew it. A time needs at least 3 uploads before it can be called Best. Your hook still matters more than the clock.</p>';
}

/* ---------- Latest posts ---------- */
function renderPosts(){
  document.querySelectorAll('[data-feed]').forEach(b => b.setAttribute('aria-pressed', b.dataset.feed === feed));
  let items = [];
  if (feed === 'yt') items = ((yt && yt.videos) || []).map(v => ({url: 'https://youtube.com/watch?v=' + v.id, thumb: v.thumb, title: v.title, date: v.published,
    meta: `${fmt(v.views)} views · ${fmt(v.likes)} likes · ${fmt(v.comments)} comments`}));
  else items = ((ig && ig.media) || []).map(m => ({url: m.url, thumb: m.thumb, title: m.caption || (m.type === 'REELS' ? 'Reel' : 'Post'), date: m.published,
    meta: `${m.views != null ? fmt(m.views) + ' views · ' : ''}${m.likes != null ? fmt(m.likes) + ' likes · ' : ''}${fmt(m.comments || 0)} comments`}));
  items.sort((a, b) => new Date(b.date) - new Date(a.date));
  const empty = feed === 'yt' ? 'No Shorts yet — your first upload will show up here.' : (ig ? 'No Reels yet — your first post will show up here.' : 'Connect Instagram to see your Reels here.');
  $('vids').innerHTML = items.length ? items.slice(0, 12).map(x => `
    <a class="vid" href="${x.url}" target="_blank" rel="noopener">${x.thumb ? `<img src="${x.thumb}" alt="">` : '<span class="ph"></span>'}
      <div><div class="t">${esc(x.title)}</div><div class="m">${x.meta} · ${dshort(x.date)}</div></div></a>`).join('') : `<div class="empty">${empty}</div>`;
}
document.querySelectorAll('[data-feed]').forEach(b => b.onclick = () => { feed = b.dataset.feed; save('fh_feed', feed); renderPosts(); });

/* ---------- This week ---------- */
function weekAgoVal(hist, key){
  const target = daysAgo(7), ds = Object.keys(hist || {}).filter(d => d >= START).sort();
  if (!ds.length) return null;
  const before = ds.filter(d => d <= target);
  return (before.length ? hist[before[before.length - 1]] : hist[ds[0]])[key];
}
function weekRow(label, tag, cur, prev){
  const d = cur != null && prev != null ? cur - prev : null;
  return `<div class="wk-row"><span class="wk-l"><span class="dot ${tag}"></span>${label}</span>
    <span class="wk-v ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d == null ? '—' : (d > 0 ? '+' : '') + fmt(d)}</span></div>`;
}
function renderWeek(){
  const yh = (yt && yt.history) || {}, ih = (ig && ig.history) || {}, ys = (yt && yt.latest) || {}, is = (ig && ig.latest) || {};
  const firstDay = [...Object.keys(yh), ...Object.keys(ih)].filter(d => d >= START).sort()[0];
  const days = firstDay ? Math.min(7, Math.round((new Date(daysAgo(0)) - new Date(firstDay)) / DAY) + 1) : 0;
  $('weekSub').textContent = days >= 7 ? 'last 7 days' : `first ${days} day${days === 1 ? '' : 's'} of tracking`;
  const rows = weekRow('YouTube subscribers', 'yt', ys.subs, weekAgoVal(yh, 'subs')) + weekRow('YouTube views', 'yt', ys.views, weekAgoVal(yh, 'views')) +
               weekRow('Instagram followers', 'ig', is.followers, weekAgoVal(ih, 'followers')) + weekRow('Instagram likes', 'ig', is.likes, weekAgoVal(ih, 'likes'));
  const since = Date.now() - 7 * DAY;
  const bestYT = ((yt && yt.videos) || []).filter(v => new Date(v.published) >= since).sort((a, b) => b.views - a.views)[0];
  const best = bestYT ? `<a class="wk-best" href="https://youtube.com/watch?v=${bestYT.id}" target="_blank" rel="noopener">
      ${bestYT.thumb ? `<img src="${bestYT.thumb}" alt="">` : '<span class="ph"></span>'}
      <span><span class="wk-cap">Best Short this week</span><span class="wk-t">${esc(bestYT.title)}</span><span class="wk-s">${fmt(bestYT.views)} views · ${fmt(bestYT.likes)} likes</span></span></a>` : '';
  $('week').innerHTML = rows + best;
}

/* ---------- Warnings ---------- */
function warnings(){
  const w = $('igWarn'), msgs = [];
  if (ig && ig.token && ig.token.expiresAt){
    const days = Math.round((new Date(ig.token.expiresAt) - Date.now()) / DAY);
    if (days <= 10) msgs.push(`Instagram key expires in ${Math.max(days, 0)} days — run “Refresh Instagram token” in GitHub Actions or make a new key.`);
  }
  if (ig && ig.updatedAt && Date.now() - new Date(ig.updatedAt) > 2 * DAY) msgs.push('Instagram stats haven’t updated for 2+ days — the key may have expired.');
  w.hidden = !msgs.length; w.textContent = msgs.join(' ');
}

/* Instagram picture links expire after a while: swap a broken picture for a plain box */
document.addEventListener('error', e => { const t = e.target; if (t.tagName === 'IMG' && !t.dataset.dead){ t.dataset.dead = 1; const ph = document.createElement('span'); ph.className = 'ph'; t.replaceWith(ph); } }, true);

$('refreshBtn').onclick = load;
load();
setInterval(load, 5 * 60 * 1000);
