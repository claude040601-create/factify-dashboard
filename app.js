const $ = id => document.getElementById(id);
const fmt = n => n == null ? '—' : Intl.NumberFormat('en-IN', {notation: n >= 100000 ? 'compact' : 'standard', maximumFractionDigits: 1}).format(n);
let data, chart;

function daysAgo(d){ const t = new Date(); t.setDate(t.getDate() - d); return t.toISOString().slice(0,10); }
function pastValue(key, days){
  const target = daysAgo(days);
  const dates = Object.keys(data.history).filter(d => d <= target).sort();
  return dates.length ? data.history[dates[dates.length-1]][key] : null;
}
function deltaHtml(cur, past, label){
  if (past == null || cur == null) return '<span>tracking started — more soon</span>';
  const d = cur - past, cls = d > 0 ? 'up' : d < 0 ? 'down' : '';
  return `<b class="${cls}">${d > 0 ? '+' : ''}${fmt(d)}</b> ${label}`;
}
function ago(iso){
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : Math.round(m/60) + ' h ago';
}

async function load(){
  try{
    const r = await fetch('data.json?t=' + Date.now());
    if (!r.ok) throw new Error('No data yet — run the GitHub Action once.');
    data = await r.json();
    const c = data.channel, s = data.latest;
    $('chName').textContent = c.title;
    $('chSub').textContent = c.handle + ' · live growth';
    if (c.avatar) $('avatar').src = c.avatar;
    $('subs').textContent = s.subs == null ? 'Hidden' : fmt(s.subs);
    $('views').textContent = fmt(s.views);
    $('videos').textContent = fmt(s.videos);
    $('subsD').innerHTML = deltaHtml(s.subs, pastValue('subs', 7), 'in 7 days');
    $('viewsD').innerHTML = deltaHtml(s.views, pastValue('views', 1), 'since yesterday');
    $('videosD').innerHTML = deltaHtml(s.videos, pastValue('videos', 7), 'in 7 days');
    const v = data.videos || [];
    if (v.length){
      $('avg').textContent = fmt(Math.round(v.reduce((a,x) => a + x.views, 0) / v.length));
      $('avgD').textContent = `across latest ${v.length} uploads`;
      $('vids').innerHTML = v.map(x => `
        <a class="vid" href="https://youtube.com/watch?v=${x.id}" target="_blank" rel="noopener">
          <img src="${x.thumb}" alt="">
          <div><div class="t">${x.title.replace(/</g,'&lt;')}</div>
          <div class="m">👁 ${fmt(x.views)} · 👍 ${fmt(x.likes)} · 💬 ${fmt(x.comments)} · ${new Date(x.published).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</div></div>
        </a>`).join('');
    } else $('vids').innerHTML = '<div class="empty">No uploads yet — your first Short will show up here.</div>';
    drawChart();
    $('updated').innerHTML = '<span class="live"></span>Updated ' + ago(data.updatedAt);
  }catch(e){ $('updated').textContent = '⚠ ' + e.message; }
}

function drawChart(){
  const key = $('metric').value;
  const dates = Object.keys(data.history).sort().slice(-90);
  const vals = dates.map(d => data.history[d][key]);
  $('chartNote').style.display = dates.length < 2 ? 'block' : 'none';
  $('chartNote').textContent = 'Tracking started 📈 — your growth curve builds up a point every day.';
  const ctx = $('chart').getContext('2d');
  const g = ctx.createLinearGradient(0,0,0,300);
  g.addColorStop(0,'rgba(181,140,255,.45)'); g.addColorStop(1,'rgba(181,140,255,0)');
  if (chart) chart.destroy();
  chart = new Chart(ctx, {type:'line',
    data:{labels: dates.map(d => new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short'})),
          datasets:[{data:vals,borderColor:'#b58cff',backgroundColor:g,fill:true,tension:.35,pointRadius:3,pointBackgroundColor:'#fff',borderWidth:2.5}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
      scales:{x:{ticks:{color:'#b9aee0'},grid:{color:'rgba(255,255,255,.05)'}},
              y:{ticks:{color:'#b9aee0',callback:v=>fmt(v)},grid:{color:'rgba(255,255,255,.05)'}}}}});
}
$('refreshBtn').onclick = load;
$('metric').onchange = drawChart;
load();
setInterval(load, 5 * 60 * 1000);
