import { writeFile } from 'node:fs/promises';

const CREATORS = [
  { key: 'milk', aliases: ['牛奶MiIk', '牛奶milk'] },
  { key: 'sugar', aliases: ['小糖姐姐呀', '小糖姐姐'] },
  { key: 'pajama', aliases: ['战术睡衣'] },
  { key: 'miao', aliases: ['缪可言Sean', '缈可言', '缪可言'] },
  { key: 'official', aliases: ['曼城足球俱乐部', '曼城官方'] },
];

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function clean(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function cookie() {
  const token = Array.from({ length: 32 }, () =>
    '0123456789ABCDEF'[Math.floor(Math.random() * 16)],
  ).join('');
  return `buvid3=${token}infoc; b_nut=${Math.floor(Date.now() / 1000)}`;
}

async function search(keyword) {
  const url = `https://api.bilibili.com/x/web-interface/search/all/v2?keyword=${encodeURIComponent(keyword)}&page=1&order=pubdate`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Referer: 'https://www.bilibili.com/',
      Origin: 'https://www.bilibili.com',
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      Cookie: cookie(),
    },
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  if (payload?.code !== 0) throw new Error(`Bilibili ${payload.code}`);
  const groups = payload?.data?.result || [];
  return groups.find((group) => group.result_type === 'video')?.data || [];
}

const found = new Map();
for (const creator of CREATORS) {
  let items = [];
  for (const alias of creator.aliases) {
    try {
      const results = await search(alias);
      items = results.filter((item) => {
        const author = clean(item.author);
        const title = clean(item.title);
        return (
          creator.aliases.some((name) => author.includes(name)) &&
          (title.includes('曼城') || author.includes('曼城'))
        );
      });
      if (items.length) break;
    } catch (error) {
      console.warn(`${creator.key}/${alias}: ${error.message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }
  for (const item of items.slice(0, 2)) {
    if (!item?.bvid || !/^BV/.test(item.bvid)) continue;
    if (!found.has(item.bvid)) {
      found.set(item.bvid, {
        bvid: item.bvid,
        title: clean(item.title),
        author: clean(item.author),
        creator: creator.key,
        pic: String(item.pic || '').replace(/^\/\//, 'https://'),
        duration: String(item.duration || ''),
        pubdate: Number(item.pubdate) || 0,
        play: Number(item.play) || 0,
      });
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 1600));
}

const videos = [...found.values()]
  .sort((a, b) => b.pubdate - a.pubdate)
  .slice(0, 8);
await writeFile(
  'videos.json',
  JSON.stringify({ generatedAt: new Date().toISOString(), videos }, null, 2) + '\n',
);
console.log(`wrote ${videos.length} videos`);
for (const video of videos) console.log(`${video.author} | ${video.title.slice(0, 50)}`);
