/* ============================================================
   根据 data/<book>/L*.json 自动生成 index.json
   用法：node tools/gen-index.js nce1
        node tools/gen-index.js nce2
   ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'data');
const BOOK = process.argv[2];
if (!BOOK) { console.error('用法: node tools/gen-index.js nce1|nce2'); process.exit(1); }
const DIR = path.join(ROOT, BOOK);

const lessons = fs.readdirSync(DIR)
  .filter(f => /^L\d{3}\.json$/.test(f))
  .sort()
  .map(f => {
    const L = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
    return {
      id: L.id,
      title: L.title,
      titleZh: L.titleZh,
      wordCount: (L.words || []).length,
      sentenceCount: (L.sentences || []).length
    };
  });

const out = JSON.stringify({ lessons }, null, 2);
fs.writeFileSync(path.join(DIR, 'index.json'), out + '\n');
console.log(`${BOOK}/index.json 已生成：${lessons.length} 课`);
lessons.forEach(l => console.log(`  ${l.id} ${l.title}（${l.titleZh}）词${l.wordCount} 句${l.sentenceCount}`));
