const $ = id => document.getElementById(id);
const fmt = n => n == null ? '—' : Intl.NumberFormat('en-IN', {notation: n >= 100000 ? 'compact' : 'standard', maximumFractionDigits: 1}).format(n);
const DAY = 864e5;
const START = '2026-11-14';          /* day one of Factify Hindi tracking */
let yt = null, ig = null, chart;
let feed = (() => { try { return localStorage.getItem('fh_feed') || 'yt'; } catch(e){ return 'yt'; } })();
let show = (() => { try { return localStorage.getItem('fh_show') || 'both'; } catch(e){ return 'both'; } })();

const daysAgo = d => new Date(Date.now() + 5.5 * 3600e3 - d * DAY).toISOString().slice(0, 10);
function past(hist, key, days){
  const target = daysAgo(days);
  const ds = Object.keys(hist || {}).filter(d => d <= target).sort();
  return ds.length ? hist[ds[ds.length - 1]][key] : null;
}
function deltaHtml(cur, prev, label){
  if (cur == null) return '';
  if (prev == null) prev = cur;            /* first day of tracking: show 0 until there is history */
  const d = cur - prev, cls = d > 0 ? 'up' : d < 0 ? 'down' : '';
  return `<b class="${cls}">${d > 0 ? '+' : ''}${fmt(d)}</b> ${label}`;
}
const ago = iso => { const m = Math.round((Date.now() - new Date(iso)) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : Math.round(m / 60) + ' h ago'; };
const getJSON = async f => { try { const r = await fetch(f + '?t=' + Date.now()); return r.ok ? await r.json() : null; } catch(e){ return null; } };

async function load(){
  [yt, ig] = await Promise.all([getJSON('data.json'), getJSON('data-ig.json')]);
  if (yt){
    const c = yt.channel, s = yt.latest;
    $('chName').textContent = c.title;
    if (c.avatar) $('avatar').src = c.avatar;
    $('subs').textContent = s.subs == null ? 'Hidden' : fmt(s.subs);
    $('views').textContent = fmt(s.views);
    $('subsD').innerHTML = deltaHtml(s.subs, past(yt.history, 'subs', 1), 'today');
    $('viewsD').innerHTML = deltaHtml(s.views, past(yt.history, 'views', 1), 'today');
  }
  if (ig && ig.latest){
    const s = ig.latest;
    $('igf').textContent = fmt(s.followers);
    $('igl').textContent = fmt(s.likes);
    $('igfD').innerHTML = deltaHtml(s.followers, past(ig.history, 'followers', 1), 'today');
    $('iglD').innerHTML = deltaHtml(s.likes, past(ig.history, 'likes', 1), 'today');
    if (ig.account && ig.account.username) $('igLink').href = 'https://www.instagram.com/' + ig.account.username + '/';
  } else {
    ['igfD', 'iglD'].forEach(id => $(id).innerHTML = '<span>connect Instagram to see this</span>');
  }
  renderPosts(); drawChart(); renderWeek(); warnings();
  const t = [yt && yt.updatedAt, ig && ig.updatedAt].filter(Boolean).sort().pop();
  $('updated').innerHTML = t ? '<span class="live"></span>Updated ' + ago(t) : '⚠ No data yet — run the GitHub Action once.';
}

function renderPosts(){
  document.querySelectorAll('[data-feed]').forEach(b => b.setAttribute('aria-pressed', b.dataset.feed === feed));
  let items = [];
  if (feed === 'yt') items = (yt && yt.videos || []).map(v => ({url: 'https://youtube.com/watch?v=' + v.id, thumb: v.thumb, title: v.title, date: v.published,
    meta: `👁 ${fmt(v.views)} · 👍 ${fmt(v.likes)} · 💬 ${fmt(v.comments)}`}));
  else items = (ig && ig.media || []).map(m => ({url: m.url, thumb: m.thumb, title: m.caption || (m.type === 'REELS' ? 'Reel' : 'Post'), date: m.published,
    meta: `${m.likes != null ? '♥ ' + fmt(m.likes) + ' · ' : ''}💬 ${fmt(m.comments || 0)}`}));
  items.sort((a, b) => new Date(b.date) - new Date(a.date));
  const empty = feed === 'yt' ? 'No Shorts yet — your first upload will show up here.'
              : (ig ? 'No Reels yet — your first post will show up here.' : 'Connect Instagram to see your Reels here.');
  $('vids').innerHTML = items.length ? items.slice(0, 12).map(x => `
    <a class="vid" href="${x.url}" target="_blank" rel="noopener">
      ${x.thumb ? `<img src="${x.thumb}" alt="">` : '<span class="ph"></span>'}
      <div><div class="t">${x.title.replace(/</g, '&lt;')}</div>
      <div class="m">${x.meta} · ${new Date(x.date).toLocaleDateString('en-IN', {day:'numeric', month:'short'})}</div></div>
    </a>`).join('') : `<div class="empty">${empty}</div>`;
}
document.querySelectorAll('[data-feed]').forEach(b => b.onclick = () => {
  feed = b.dataset.feed; try { localStorage.setItem('fh_feed', feed); } catch(e){}
  renderPosts();
});

function drawChart(){
  document.querySelectorAll('[data-show]').forEach(b => b.setAttribute('aria-pressed', b.dataset.show === show));
  const yh = (yt && yt.history) || {}, ih = (ig && ig.history) || {};
  const dates = [...new Set([...(show !== 'ig' ? Object.keys(yh) : []), ...(show !== 'yt' ? Object.keys(ih) : [])])].filter(d => d >= START).sort().slice(-90);
  const sets = [];
  const mk = (label, color, fillTop, vals) => {
    const ctx = $('chart').getContext('2d'), g = ctx.createLinearGradient(0, 0, 0, 300);
    g.addColorStop(0, fillTop); g.addColorStop(1, 'rgba(0,0,0,0)');
    return {label, data: vals, borderColor: color, backgroundColor: g, fill: show !== 'both', tension: .35, pointRadius: 3, pointBackgroundColor: '#fff', borderWidth: 2.5, spanGaps: true};
  };
  if (show !== 'ig') sets.push(mk('YouTube subscribers', '#ff5c5c', 'rgba(255,92,92,.35)', dates.map(d => yh[d] ? yh[d].subs : null)));
  if (show !== 'yt') sets.push(mk('Instagram followers', '#e1306c', 'rgba(225,48,108,.35)', dates.map(d => ih[d] ? ih[d].followers : null)));
  if (show === 'both' && sets[1]) sets[1].borderColor = '#c58cff';
  $('chartNote').style.display = dates.length < 2 ? 'block' : 'none';
  $('chartNote').textContent = 'Tracking started 📈 — a new point gets added every day.';
  if (chart) chart.destroy();
  chart = new Chart($('chart').getContext('2d'), {type: 'line',
    data: {labels: dates.map(d => new Date(d).toLocaleDateString('en-IN', {day:'numeric', month:'short'})), datasets: sets},
    options: {responsive: true, maintainAspectRatio: false, interaction: {mode: 'index', intersect: false},
      plugins: {legend: {display: show === 'both', align: 'center', labels: {color: '#d9d2f5', font: {family: 'Outfit', size: 12}, padding: 18, usePointStyle: true, pointStyle: 'circle', boxWidth: 7, boxHeight: 7,
        generateLabels: c => Chart.defaults.plugins.legend.labels.generateLabels(c).map(l => ({...l, fillStyle: l.strokeStyle, lineWidth: 0}))}}},
      scales: {x: {ticks: {color: '#b9aee0'}, grid: {color: 'rgba(255,255,255,.05)'}},
               y: {ticks: {color: '#b9aee0', callback: v => fmt(v)}, grid: {color: 'rgba(255,255,255,.05)'}}}}});
}
document.querySelectorAll('[data-show]').forEach(b => b.onclick = () => {
  show = b.dataset.show; try { localStorage.setItem('fh_show', show); } catch(e){}
  drawChart();
});

function warnings(){
  const w = $('igWarn'), msgs = [];
  if (ig && ig.token && ig.token.expiresAt){
    const days = Math.round((new Date(ig.token.expiresAt) - Date.now()) / DAY);
    if (days <= 10) msgs.push(`Instagram key expires in ${Math.max(days, 0)} days — run “Refresh Instagram token” in GitHub Actions or make a new key.`);
    if (ig.token.saved === false) msgs.push('Instagram key was renewed but not saved — add the GH_PAT secret so renewals stay automatic.');
  }
  if (ig && ig.updatedAt && Date.now() - new Date(ig.updatedAt) > 2 * DAY) msgs.push('Instagram stats haven’t updated for 2+ days — the key may have expired.');
  w.hidden = !msgs.length; w.textContent = msgs.join(' ');
}

$('refreshBtn').onclick = load;
load();
setInterval(load, 5 * 60 * 1000);

/* ---------- This week ---------- */
function weekAgoVal(hist, key){
  /* value 7 days ago, or the first tracked day if the channel is younger than a week */
  const target = daysAgo(7);
  const ds = Object.keys(hist || {}).filter(d => d >= START).sort();
  if (!ds.length) return null;
  const before = ds.filter(d => d <= target);
  return (before.length ? hist[before[before.length - 1]] : hist[ds[0]])[key];
}
function weekRow(label, tag, cur, prev){
  const d = cur != null && prev != null ? cur - prev : null;
  const cls = d > 0 ? 'up' : d < 0 ? 'down' : '';
  return `<div class="wk-row"><span class="tag ${tag}">${tag.toUpperCase()}</span><span class="wk-l">${label}</span>
    <span class="wk-v ${cls}">${d == null ? '—' : (d > 0 ? '+' : '') + fmt(d)}</span></div>`;
}
function renderWeek(){
  const box = $('week'); if (!box) return;
  const yh = (yt && yt.history) || {}, ih = (ig && ig.history) || {};
  const ys = yt && yt.latest || {}, is = ig && ig.latest || {};
  const firstDay = [...Object.keys(yh), ...Object.keys(ih)].filter(d => d >= START).sort()[0];
  const days = firstDay ? Math.min(7, Math.round((new Date(daysAgo(0)) - new Date(firstDay)) / DAY) + 1) : 0;
  $('weekSub').textContent = days >= 7 ? 'last 7 days' : `first ${days} day${days === 1 ? '' : 's'} of tracking`;
  const rows = weekRow('Subscribers', 'yt', ys.subs, weekAgoVal(yh, 'subs')) +
               weekRow('Views', 'yt', ys.views, weekAgoVal(yh, 'views')) +
               weekRow('Followers', 'ig', is.followers, weekAgoVal(ih, 'followers')) +
               weekRow('Likes', 'ig', is.likes, weekAgoVal(ih, 'likes'));
  const since = Date.now() - 7 * DAY;
  const bestYT = (yt && yt.videos || []).filter(v => new Date(v.published) >= since).sort((a, b) => b.views - a.views)[0];
  const bestIG = (ig && ig.media || []).filter(m => new Date(m.published) >= since).sort((a, b) => (b.likes || 0) - (a.likes || 0))[0];
  const best = (x, tag, url, title, stat) => x ? `
    <a class="wk-best" href="${url}" target="_blank" rel="noopener">
      ${x.thumb ? `<img src="${x.thumb}" alt="">` : '<span class="ph"></span>'}
      <span><span class="wk-cap"><span class="tag ${tag}">${tag.toUpperCase()}</span>Best this week</span>
      <span class="wk-t">${title.replace(/</g, '&lt;')}</span><span class="wk-s">${stat}</span></span>
    </a>` : '';
  const bests = best(bestYT, 'yt', bestYT && 'https://youtube.com/watch?v=' + bestYT.id, bestYT && bestYT.title, bestYT && `👁 ${fmt(bestYT.views)} views · 👍 ${fmt(bestYT.likes)}`) +
                best(bestIG, 'ig', bestIG && bestIG.url, bestIG && (bestIG.caption || 'Reel'), bestIG && `♥ ${fmt(bestIG.likes)} likes · 💬 ${fmt(bestIG.comments || 0)}`);
  box.innerHTML = `<div class="wk-rows">${rows}</div>${bests ? `<div class="wk-bests">${bests}</div>` : ''}`;
}
