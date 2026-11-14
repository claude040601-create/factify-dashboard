// Runs on GitHub Actions. Fetches your Instagram professional account stats into data-ig.json.
import fs from 'node:fs';
const TOKEN = process.env.IG_TOKEN;
if (!TOKEN) { console.log('IG_TOKEN secret not set yet: skipping Instagram.'); process.exit(0); }
const get = async (path, params) => {
  const r = await fetch('https://graph.instagram.com/' + path + '?' + new URLSearchParams({...params, access_token: TOKEN}));
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  return j;
};

const me = await get('me', {fields: 'username,followers_count,follows_count,media_count,profile_picture_url'});

let media = [];
try {
  const m = await get('me/media', {fields: 'id,caption,media_type,media_product_type,thumbnail_url,media_url,permalink,timestamp,like_count,comments_count', limit: 12});
  media = (m.data || []).map(x => ({
    id: x.id,
    caption: (x.caption || '').split('\n')[0].slice(0, 120),
    type: x.media_product_type || x.media_type,
    thumb: x.thumbnail_url || (x.media_type === 'IMAGE' ? x.media_url : '') || '',
    url: x.permalink, published: x.timestamp,
    likes: x.like_count ?? null, comments: x.comments_count ?? null
  }));
} catch (e) { console.log('Could not read posts:', e.message); }

let old = { history: {} };
try { old = JSON.parse(fs.readFileSync('data-ig.json', 'utf8')); } catch {}
old.history = old.history || {};
const day = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);   // India date
const latest = { followers: me.followers_count ?? null, following: me.follows_count ?? null, posts: me.media_count ?? null };
latest.likes = media.reduce((a, x) => a + (x.likes || 0), 0);      // total likes on the latest 12 posts
old.history[day] = { followers: latest.followers, posts: latest.posts, likes: latest.likes };

fs.writeFileSync('data-ig.json', JSON.stringify({
  updatedAt: new Date().toISOString(),
  account: { username: me.username, avatar: me.profile_picture_url || '' },
  latest, media, history: old.history,
  token: old.token || null          // expiry info written by the weekly refresh job (never the key itself)
}, null, 1));
console.log('Instagram updated', day, latest);
