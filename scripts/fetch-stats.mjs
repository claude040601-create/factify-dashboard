// Runs on GitHub Actions. Fetches public channel stats and updates data.json.
import fs from 'node:fs';
const KEY = process.env.YT_API_KEY;
let HANDLE = process.env.YT_HANDLE || '';
if (!KEY || !HANDLE) { console.error('Set YT_API_KEY secret and YT_HANDLE variable.'); process.exit(1); }
if (!HANDLE.startsWith('@')) HANDLE = '@' + HANDLE;
const api = async (path, params) => {
  const r = await fetch('https://www.googleapis.com/youtube/v3/' + path + '?' + new URLSearchParams({...params, key: KEY}));
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  return j;
};
const ch = await api('channels', {part: 'snippet,statistics,contentDetails', forHandle: HANDLE});
if (!ch.items?.length) throw new Error('Channel not found: ' + HANDLE);
const c = ch.items[0], s = c.statistics;
const latest = { subs: s.hiddenSubscriberCount ? null : +s.subscriberCount, views: +s.viewCount, videos: +s.videoCount };

// New channels with no public uploads have no uploads playlist yet; treat as zero videos
let ids = [];
try {
  const pl = await api('playlistItems', {part: 'contentDetails', playlistId: c.contentDetails.relatedPlaylists.uploads, maxResults: 12});
  ids = (pl.items || []).map(i => i.contentDetails.videoId);
} catch (e) {
  console.log('No uploads found yet:', e.message);
}
let videos = [];
if (ids.length) {
  const v = await api('videos', {part: 'snippet,statistics', id: ids.join(',')});
  videos = v.items.map(x => ({
    id: x.id, title: x.snippet.title, published: x.snippet.publishedAt,
    thumb: x.snippet.thumbnails.medium?.url || '',
    views: +x.statistics.viewCount || 0, likes: +x.statistics.likeCount || 0, comments: +x.statistics.commentCount || 0
  }));
}

let old = { history: {} };
try { old = JSON.parse(fs.readFileSync('data.json', 'utf8')); } catch {}
// India date as the day key
const day = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
old.history[day] = latest;

// per-video history: daily views + views at 24 hours after upload
const vh = old.videoHistory || {};
const nowMs = Date.now();
for (const v of videos) {
  const h = vh[v.id] || (vh[v.id] = { title: v.title, published: v.published, daily: {}, first24: null, first24Missed: false });
  h.title = v.title;
  h.daily[day] = { views: v.views, likes: v.likes, comments: v.comments };
  const ageH = (nowMs - new Date(v.published)) / 3600e3;
  if (h.first24 == null && !h.first24Missed) {
    if (ageH >= 24 && ageH < 30) h.first24 = v.views;          // first check after the 24-hour mark
    else if (ageH >= 30) h.first24Missed = true;                 // video was already older when tracking began
  }
}

fs.writeFileSync('data.json', JSON.stringify({
  updatedAt: new Date().toISOString(),
  channel: { title: c.snippet.title, handle: HANDLE, avatar: c.snippet.thumbnails.medium?.url || '' },
  latest, videos, history: old.history, videoHistory: vh
}, null, 1));
console.log('Updated', day, latest);
