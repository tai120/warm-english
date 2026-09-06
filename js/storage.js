/* ============================================================
   数据存储：所有数据保存在手机浏览器本地（localStorage）
   包含：学习进度、生词本、设置
   ============================================================ */

/* 底层读写，失败时不报错（比如隐身模式） */
const store = {
  get(key, dflt) {
    try {
      const v = localStorage.getItem('we.' + key);
      return v === null ? dflt : JSON.parse(v);
    } catch (e) { return dflt; }
  },
  set(key, val) {
    try { localStorage.setItem('we.' + key, JSON.stringify(val)); } catch (e) {}
  }
};

/* ---------- 学习进度：每个课程记录 词汇/句子/文章 完成情况 ---------- */
const Progress = {
  get(tbId) { return store.get('progress', {})[tbId] || { lessons: {} }; },
  save(tbId, p) {
    const all = store.get('progress', {});
    all[tbId] = p;
    store.set('progress', all);
  },
  /* 取出某课的进度（不存在则创建） */
  lesson(p, lid) {
    if (!p.lessons[lid]) p.lessons[lid] = { words: [], scores: {}, wScores: {}, article: false };
    return p.lessons[lid];
  },
  /* 标记/取消单词「已学会」，返回最新状态 */
  toggleWord(tbId, lid, word) {
    const p = Progress.get(tbId);
    const lp = Progress.lesson(p, lid);
    const i = lp.words.indexOf(word);
    if (i >= 0) lp.words.splice(i, 1); else lp.words.push(word);
    Progress.save(tbId, p);
    return i < 0;
  },
  /* 记录句子听写得分（保留最高分） */
  score(tbId, lid, idx, sc) {
    const p = Progress.get(tbId);
    const lp = Progress.lesson(p, lid);
    lp.scores[idx] = Math.max(lp.scores[idx] || 0, sc);
    Progress.save(tbId, p);
  },
  /* 记录单词听写得分（保留最高分） */
  wordScore(tbId, lid, idx, sc) {
    const p = Progress.get(tbId);
    const lp = Progress.lesson(p, lid);
    lp.wScores = lp.wScores || {};
    lp.wScores[idx] = Math.max(lp.wScores[idx] || 0, sc);
    Progress.save(tbId, p);
  },
  /* 标记文章跟读完成 */
  setArticle(tbId, lid) {
    const p = Progress.get(tbId);
    Progress.lesson(p, lid).article = true;
    Progress.save(tbId, p);
  }
};

/* ---------- 生词本：收藏的单词卡片 ---------- */
const Book = {
  all() { return store.get('book', {}); },
  save(items) { store.set('book', items); },
  key(tbId, word) { return tbId + '::' + word.toLowerCase(); },
  has(tbId, word) { return !!Book.all()[Book.key(tbId, word)]; },
  /* 收藏单词（保存单词快照，复习时不用再查课文数据） */
  add(tbId, w) {
    const items = Book.all();
    const k = Book.key(tbId, w.word);
    if (items[k]) return false;
    items[k] = {
      key: k,
      tb: tbId,
      word: w.word,
      phonetic: w.phonetic || '',
      meaning: w.meaning || '',
      examples: (w.examples || []).slice(0, 3),
      addedAt: Date.now(),
      srs: { n: 0, ef: 2.5, interval: 0, due: Date.now(), seen: 0, ok: 0 }
    };
    Book.save(items);
    return true;
  },
  removeByKey(key) {
    const items = Book.all();
    if (items[key]) { delete items[key]; Book.save(items); return true; }
    return false;
  },
  /* 到期需要复习的单词（按到期时间排序） */
  due() {
    const now = Date.now();
    return Object.values(Book.all())
      .filter(it => it.srs && it.srs.due <= now)
      .sort((a, b) => a.srs.due - b.srs.due);
  }
};

/* ---------- 设置 ---------- */
const Settings = {
  get() { return Object.assign({ dictRate: 0.85, shadowRate: 0.9 }, store.get('settings', {})); },
  set(patch) { store.set('settings', Object.assign(Settings.get(), patch)); }
};
