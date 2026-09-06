/* ============================================================
   校验课程数据：JSON 格式、字段完整性、句子成分解析与
   App 分词逻辑（tokenize）是否一一对应
   用法：node tools/validate-data.js [nce1|nce2]
   ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'data');
const BOOK = process.argv[2] || 'nce1';
const DIR = path.join(ROOT, BOOK);
const ROLES = ['主语', '谓语', '宾语', '表语', '定语', '状语', '补语', '连词', '感叹词'];

/* 和 app.js 的 tokenize 一致：空格分词 + 去掉尾部标点 */
function tokenize(text) {
  return String(text).split(/\s+/).filter(Boolean).map(t => {
    const m = t.match(/^([\w'’-]+)([^a-zA-Z0-9]*)$/);
    return m ? m[1] : t.replace(/[^a-zA-Z0-9]/g, '');
  });
}

const files = fs.readdirSync(DIR).filter(f => /^L\d{3}\.json$/.test(f)).sort();
let bad = 0;
const problems = [];

for (const f of files) {
  const raw = fs.readFileSync(path.join(DIR, f), 'utf8');
  let L;
  try { L = JSON.parse(raw); } catch (e) { problems.push(`${f}: JSON 解析失败 ${e.message}`); bad++; continue; }

  if (!L.id || !L.title || !L.titleZh) { problems.push(`${f}: 缺 id/title/titleZh`); bad++; }
  if (!Array.isArray(L.words) || L.words.length < 6) { problems.push(`${f}: words 不足6个`); bad++; }
  for (const w of L.words || []) {
    if (!w.word || !w.meaning) { problems.push(`${f}: 单词缺 word/meaning: ${JSON.stringify(w).slice(0, 60)}`); bad++; }
    for (const ex of w.examples || []) {
      if (!ex.en || !ex.zh) { problems.push(`${f}: 单词 ${w.word} 例句缺 en/zh`); bad++; }
    }
  }
  if (!Array.isArray(L.sentences) || L.sentences.length < 3) { problems.push(`${f}: sentences 不足3个`); bad++; }
  for (const s of L.sentences || []) {
    if (!s.en || !s.zh) { problems.push(`${f}: 句子缺 en/zh`); bad++; continue; }
    const toks = tokenize(s.en);
    const ana = (s.analysis || []).map(a => a && a.text);
    if (JSON.stringify(toks) !== JSON.stringify(ana)) {
      problems.push(`${f}: 句子成分与分词不一致 → "${s.en}"\n    分词: ${JSON.stringify(toks)}\n    解析: ${JSON.stringify(ana)}`);
      bad++;
    }
    for (const a of s.analysis || []) {
      if (!a.text || !Array.isArray(a.roles) || !a.roles.length) { problems.push(`${f}: 解析片段缺 roles: ${JSON.stringify(a)}`); bad++; }
      else if (a.roles.some(r => !ROLES.includes(r))) { problems.push(`${f}: 非法句子成分 "${a.roles}"`); bad++; }
    }
  }
  if (!Array.isArray(L.article) || L.article.length < 3) { problems.push(`${f}: article 不足3句`); bad++; }
  for (const a of L.article || []) {
    if (!a.en || !a.zh) { problems.push(`${f}: 文章句子缺 en/zh`); bad++; }
  }
}

console.log(`== ${BOOK}：共 ${files.length} 课，问题 ${bad} 处 ==`);
problems.forEach(p => console.log('✗ ' + p));
console.log(bad === 0 ? '✓ 全部通过' : `✗ 有 ${bad} 处问题需要修复`);
process.exit(bad === 0 ? 0 : 1);
