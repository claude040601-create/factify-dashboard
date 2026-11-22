// Runs on GitHub Actions. Fetches your Instagram professional account stats into data-ig.json.
import fs from 'node:fs';
const TOKEN = process.env.IG_TOKEN;
if (!TOKEN) { console.log('IG_TOKEN secret not set yet: skipping Instagram.'); process.exit(0); }
const IG_ID = process.env.IG_USER_ID || '17841445222837990';     // @factifyhindifacts
const call = async (base, path, params) => {
  const r = await fetch(base + path + '?' + new URLSearchParams({...params, access_token: TOKEN}));
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  return j;
};
const PROFILE = 'username,followers_count,follows_count,media_count,profile_picture_url';
const MEDIA = 'id,caption,media_type,media_product_type,thumbnail_url,media_url,permalink,timestamp,like_count,comments_count';

// Meta issues two kinds of keys: Instagram-login keys (graph.instagram.com) and
// Facebook/unified-login keys (graph.facebook.com). Try one, fall back to the other.
let me, base, who;
try {
  base = 'https://graph.instagram.com/'; who = 'me';
  me = await call(base, who, {fields: PROFILE});
} catch (e1) {
  try {
    base = 'https://graph.facebook.com/v21.0/'; who = IG_ID;
    me = await call(base, who, {fields: PROFILE});
  } catch (e2) {
    throw new Error('Instagram key rejected. Instagram API: ' + e1.message + ' | Facebook API: ' + e2.message);
  }
}
console.log('Connected via', base);

let media = [];
try {
  const m = await call(base, who + '/media', {fields: MEDIA, limit: 12});
  media = (m.data || []).map(x => ({
    id: x.id,
    caption: (x.caption || '').split('\n')[0].slice(0, 120),
    type: x.media_product_type || x.media_type,
    thumb: x.thumbnail_url || (x.media_type === 'IMAGE' ? x.media_url : '') || '',
    url: x.permalink, published: x.timestamp,
    likes: x.like_count ?? null, comments: x.comments_count ?? null
  }));
} catch (e) { console.log('Could not read posts:', e.message); }

// Reel views and reach (needs the instagram_manage_insights permission on the key).
// Meta renames metrics now and then, so try the full set first, then smaller ones.
let insightsNote = null;
const METRIC_SETS = ['views,reach,saved,shares,total_interactions', 'views,reach', 'views', 'reach'];
let workingSet = null;
for (const x of media) {
  for (const set of (workingSet ? [workingSet] : METRIC_SETS)) {
    try {
      const r = await call(base, x.id + '/insights', {metric: set});
      for (const m of r.data || []) {
        const v = m.values && m.values[0] ? m.values[0].value : (m.total_value ? m.total_value.value : null);
        if (m.name === 'views') x.views = v;
        if (m.name === 'reach') x.reach = v;
        if (m.name === 'saved') x.saves = v;
        if (m.name === 'shares') x.shares = v;
      }
      workingSet = set; insightsNote = null; break;
    } catch (e) { insightsNote = e.message; }
  }
}
if (insightsNote) console.log('Reel views not available:', insightsNote);

let old = { history: {} };
try { old = JSON.parse(fs.readFileSync('data-ig.json', 'utf8')); } catch {}
old.history = old.history || {};
const day = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);   // India date
const latest = { followers: me.followers_count ?? null, following: me.follows_count ?? null, posts: me.media_count ?? null };
latest.likes = media.reduce((a, x) => a + (x.likes || 0), 0);      // total likes on the latest 12 posts
latest.views = media.some(x => x.views != null) ? media.reduce((a, x) => a + (x.views || 0), 0) : null;
old.history[day] = { followers: latest.followers, posts: latest.posts, likes: latest.likes, views: latest.views };

// per-Reel history: daily numbers + views 24 hours after posting (for the best-time panel)
const mh = old.mediaHistory || {};
for (const x of media) {
  const h = mh[x.id] || (mh[x.id] = { published: x.published, daily: {}, first24: null, first24Missed: false });
  h.daily[day] = { views: x.views ?? null, likes: x.likes, comments: x.comments };
  const ageH = (Date.now() - new Date(x.published)) / 3600e3;
  if (h.first24 == null && !h.first24Missed && x.views != null) {
    if (ageH >= 24 && ageH < 30) h.first24 = x.views;
    else if (ageH >= 30) h.first24Missed = true;
  }
}

fs.writeFileSync('data-ig.json', JSON.stringify({
  updatedAt: new Date().toISOString(),
  account: { username: me.username, avatar: me.profile_picture_url || '' },
  latest, media, history: old.history, mediaHistory: mh,
  insights: insightsNote ? { ok: false, note: insightsNote } : { ok: true },
  token: old.token || null          // expiry info written by the weekly refresh job (never the key itself)
}, null, 1));
console.log('Instagram updated', day, latest);
