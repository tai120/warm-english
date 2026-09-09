/* ============================================================
   暖学英语 · 主程序
   页面切换 + 各学习模块的渲染与交互
   ============================================================ */

/* ---------- 小工具 ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => t.classList.remove('show'), 2200);
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

/* 把句子拆成单词：末尾的标点单独拿出来 */
function tokenize(text) {
  return text.split(/\s+/).map(w => {
    const m = w.match(/^(.*?)([.,!?;:]+)$/);
    return m ? { word: m[1], punct: m[2] } : { word: w, punct: '' };
  });
}

/* 比较单词时忽略大小写和标点 */
const normWord = x => String(x).toLowerCase().replace(/[^a-z]/g, '');

/* 句子成分的颜色表 */
const ROLE_COLOR = {
  '主语': '#4A7DD6', '谓语': '#E05A3A', '宾语': '#2E9E6B',
  '表语': '#17A398', '定语': '#B07CD8', '状语': '#E8A23A',
  '补语': '#C77FA8', '连词': '#8A94A6', '感叹词': '#8A94A6', '其他': '#8A94A6'
};

/* ---------- 页面状态与导航 ---------- */
const state = {
  screen: 'home',
  stack: [],           /* 返回栈 */
  pageData: {},        /* 当前页面携带的数据 */
  textbooks: [],
  textbook: null,      /* 当前教材 */
  lesson: null,        /* 当前课程数据 */
  dictIdx: 0,          /* 当前听写的句子下标 */
  dictFinished: false, /* 当前听写是否已提交 */
  wdictIdx: 0,         /* 单词听写：当前单词下标 */
  wdMode: 'list',      /* 单词听写：list=列表 practice=练习 */
  wdStep: 0,           /* 单词听写：0=写单词 1=写例句 */
  wdResult: null,      /* 单词听写：本词得分记录 */
  wdFinished: false,   /* 单词听写当前步是否已提交 */
  rec: {},             /* 跟读录音 {句子下标: 播放地址} */
  articlePlaying: -1,  /* 正在播放的句子下标 */
  bookTab: 'review'
};

const ROOT = ['home', 'book', 'settings'];
const SCREENS = ['home', 'lessons', 'lesson', 'words', 'sentences', 'dictation', 'wdict', 'article', 'book', 'settings'];

function show(id) {
  SCREENS.forEach(s => $('#screen-' + s).classList.toggle('active', s === id));
  $('#bottom-nav').classList.toggle('hidden', !ROOT.includes(id));
  $$('#bottom-nav button').forEach(b => b.classList.toggle('active', b.dataset.nav === id));
  window.scrollTo(0, 0);
  state.screen = id;
}

function go(id, data = {}) {
  state.stack.push({ id: state.screen, data: { ...state.pageData } });
  state.pageData = data;
  route(id);
}

function route(id) {
  show(id);
  if (id === 'home') renderHome();
  else if (id === 'lessons') renderLessons();
  else if (id === 'lesson') renderLesson();
  else if (id === 'words') renderWords();
  else if (id === 'sentences') renderSentences();
  else if (id === 'dictation') renderDictation();
  else if (id === 'wdict') renderWdict();
  else if (id === 'article') renderArticle();
  else if (id === 'book') renderBook();
  else if (id === 'settings') renderSettings();
}

function back() {
  const prev = state.stack.pop();
  if (prev) { state.pageData = prev.data; route(prev.id); }
  else { state.pageData = {}; route('home'); }
}

/* 统一处理所有「返回」按钮 */
document.addEventListener('click', e => {
  if (e.target.closest('[data-back]')) {
    /* 单词听写练习中按返回 → 先回到单词列表 */
    if (state.screen === 'wdict' && state.wdMode === 'practice') {
      state.wdMode = 'list';
      renderWdict();
    } else {
      back();
    }
  }
});

/* 全局键盘处理（挂在最外层，任何情况下都生效）
   空格 = 跳到下一个空；回车 = 听写提交后再按 → 学下一个句子 */
document.addEventListener('keydown', e => {
  /* 空格键：句子听写 / 例句听写中跳到下一个空 */
  if (e.key === ' ' || e.code === 'Space' || e.keyCode === 32) {
    if (state.screen !== 'dictation' && state.screen !== 'wdict') return;
    const inp = e.target;
    if (!inp || !inp.classList || !inp.classList.contains('dict-inp')) return;
    e.preventDefault();
    const line = inp.closest('.dict-line');
    const next = line && line.querySelector(`.dict-inp[data-i="${+inp.dataset.i + 1}"]`);
    if (next) next.focus();
    return;
  }
  /* 回车：听写提交后再按 → 学下一个（句子听写和单词听写都支持） */
  if (e.key !== 'Enter') return;
  if (e.target && e.target.classList && e.target.classList.contains('dict-inp')) return;
  if (state.screen === 'dictation' && state.dictFinished) nextSentence();
  else if (state.screen === 'wdict' && state.wdFinished) wdNext();
});

/* ---------- 首页：选择教材 ---------- */
async function renderHome() {
  const s = $('#screen-home');
  if (!state.textbooks.length) {
    try {
      const res = await fetch('data/textbooks.json');
      state.textbooks = (await res.json()).textbooks;
    } catch (e) {
      s.innerHTML = '<div class="err-box">教材加载失败，请检查网络后刷新</div>';
      return;
    }
  }
  const due = Book.due().length;
  const total = Object.keys(Book.all()).length;
  s.innerHTML = `
    <header class="hero">
      <img src="icons/icon-192.png" class="hero-logo" alt="logo">
      <h1>暖学英语</h1>
      <p>温暖的英语学习小助手</p>
    </header>
    <div class="card stats-row" id="go-book">
      <div><b>${total}</b><span>生词本单词</span></div>
      <div><b>${due}</b><span>待复习</span></div>
      <div class="link">去复习 ›</div>
    </div>
    <h2 class="sec-title">选择教材</h2>
    ${state.textbooks.map(tb => `
      <div class="card tb-card" data-tb="${tb.id}">
        <div class="tb-icon">📘</div>
        <div class="tb-info">
          <b>${esc(tb.name)}</b>
          <span>${esc(tb.nameEn)}</span>
          <small>${esc(tb.desc)}</small>
        </div>
        <div class="tb-arrow">›</div>
      </div>`).join('')}
  `;
  $('#go-book', s).addEventListener('click', () => go('book'));
  $$('.tb-card', s).forEach(el => el.addEventListener('click', () => {
    state.textbook = state.textbooks.find(t => t.id === el.dataset.tb);
    go('lessons');
  }));
}

/* ---------- 课程列表 ---------- */
async function renderLessons() {
  const s = $('#screen-lessons');
  const tb = state.textbook;
  s.innerHTML = `
    <div class="page-head">
      <button class="icon-btn" data-back>‹</button>
      <div class="head-title"><b>${esc(tb.name)}</b><small>${esc(tb.nameEn)}</small></div>
    </div>
    <p class="hint">加载中…</p>`;
  let index;
  try {
    index = await (await fetch(`data/${tb.id}/index.json`)).json();
  } catch (e) {
    s.innerHTML = '<div class="page-head"><button class="icon-btn" data-back>‹</button></div>' +
      '<div class="err-box">课程列表加载失败，请重试</div>';
    return;
  }
  const p = Progress.get(tb.id);
  s.innerHTML = `
    <div class="page-head">
      <button class="icon-btn" data-back>‹</button>
      <div class="head-title"><b>${esc(tb.name)}</b><small>${esc(tb.nameEn)}</small></div>
    </div>
    <p class="hint">已上线 ${index.lessons.length} 课 · 更多课程持续更新中</p>
    ${index.lessons.map(L => {
      const lp = Progress.lesson(p, L.id);
      const wDone = `${lp.words.length}/${L.wordCount}`;
      const sDone = `${Object.keys(lp.scores).length}/${L.sentenceCount}`;
      const aDone = lp.article;
      return `<div class="card lesson-card" data-id="${L.id}">
        <div class="lc-num">${parseInt(L.id.replace(/\D/g, ''), 10)}</div>
        <div class="lc-info"><b>${esc(L.title)}</b><small>${esc(L.titleZh || '')}</small></div>
        <div class="lc-progress">
          <span class="mini-chip">词 ${wDone}</span>
          <span class="mini-chip">句 ${sDone}</span>
          <span class="mini-chip ${aDone ? 'done' : ''}">文 ${aDone ? '✓' : '✗'}</span>
        </div>
      </div>`;
    }).join('')}`;
  $$('.lesson-card', s).forEach(el => el.addEventListener('click', () => {
    go('lesson', { lessonId: el.dataset.id });
  }));
}

/* ---------- 课程主页：三个学习模块 ---------- */
async function renderLesson() {
  const s = $('#screen-lesson');
  s.innerHTML = `<div class="page-head"><button class="icon-btn" data-back>‹</button>
    <div class="head-title"><b>加载中…</b></div></div>`;
  const { lessonId } = state.pageData;
  let L;
  try {
    L = await (await fetch(`data/${state.textbook.id}/${lessonId}.json`)).json();
  } catch (e) {
    s.innerHTML = '<div class="page-head"><button class="icon-btn" data-back>‹</button></div>' +
      '<div class="err-box">课程内容加载失败，请重试</div>';
    return;
  }
  state.lesson = L;
  const p = Progress.get(state.textbook.id);
  const lp = Progress.lesson(p, L.id);
  const wDone = lp.words.length;
  const wdDone = Object.keys(lp.wScores || {}).length;
  const sDone = Object.keys(lp.scores).length;
  const wPct = L.words.length ? Math.round(wDone / L.words.length * 100) : 0;
  const wdPct = L.words.length ? Math.round(wdDone / L.words.length * 100) : 0;
  const sPct = L.sentences.length ? Math.round(sDone / L.sentences.length * 100) : 0;
  s.innerHTML = `
    <div class="page-head">
      <button class="icon-btn" data-back>‹</button>
      <div class="head-title"><b>${esc(L.title)}</b><small>${esc(L.titleZh || '')}</small></div>
    </div>
    <p class="hint">词汇 ${wDone}/${L.words.length} · 单词听写 ${wdDone}/${L.words.length} · 句子 ${sDone}/${L.sentences.length} · 文章 ${lp.article ? '已完成' : '未完成'}</p>
    <div class="card module-card" data-m="words">
      <div class="mc-row">
        <div class="mc-ico">📖</div>
        <div class="mc-info"><b>词汇学习</b><span>${L.words.length} 个单词 · 卡片 + 例句</span></div>
        <div class="mc-arrow">›</div>
      </div>
      <div class="mc-bar"><i style="width:${wPct}%"></i></div>
    </div>
    <div class="card module-card" data-m="wdict">
      <div class="mc-row">
        <div class="mc-ico">🔤</div>
        <div class="mc-info"><b>单词听写</b><span>听音写单词 + 例句听写</span></div>
        <div class="mc-arrow">›</div>
      </div>
      <div class="mc-bar"><i style="width:${wdPct}%"></i></div>
    </div>
    <div class="card module-card" data-m="sentences">
      <div class="mc-row">
        <div class="mc-ico">🎧</div>
        <div class="mc-info"><b>句子听写</b><span>${L.sentences.length} 个重点句 · 听发音写句子</span></div>
        <div class="mc-arrow">›</div>
      </div>
      <div class="mc-bar"><i style="width:${sPct}%"></i></div>
    </div>
    <div class="card module-card" data-m="article">
      <div class="mc-row">
        <div class="mc-ico">🗣️</div>
        <div class="mc-info"><b>文章跟读</b><span>影子跟读 · 逐句听 + 录音对比</span></div>
        <div class="mc-arrow">›</div>
      </div>
      <div class="mc-bar"><i style="width:${lp.article ? 100 : 0}%"></i></div>
    </div>`;
  $$('.module-card', s).forEach(el => el.addEventListener('click', () => {
    if (el.dataset.m === 'wdict') { state.wdMode = 'list'; state.wdStep = 0; }
    go(el.dataset.m);
  }));
}

/* ---------- 词汇学习 ---------- */
function renderWords() {
  const s = $('#screen-words');
  const L = state.lesson;
  const tbId = state.textbook.id;
  const p = Progress.get(tbId);
  const lp = Progress.lesson(p, L.id);
  s.innerHTML = `
    <div class="page-head">
      <button class="icon-btn" data-back>‹</button>
      <div class="head-title"><b>词汇学习</b><small>${esc(L.title)}</small></div>
    </div>
    <p class="hint">点卡片翻面看释义 · 不熟的单词加入生词本</p>
    ${L.words.map((w, i) => {
      const learned = lp.words.includes(w.word);
      const inBook = Book.has(tbId, w.word);
      return `
      <div class="word-card" data-i="${i}">
        <div class="wc-inner">
          <div class="wc-face wc-front">
            <button class="wc-play" data-play>🔊</button>
            <b>${esc(w.word)}</b>
            <span class="phon">${esc(w.phonetic || '')}</span>
            <small class="wc-tip">点击卡片翻面</small>
          </div>
          <div class="wc-face wc-back">
            <div class="wc-mean">${esc(w.meaning || '')}</div>
            ${(w.examples || []).slice(0, 2).map(ex =>
              `<div class="wc-ex"><p>${esc(ex.en)}</p><small>${esc(ex.zh)}</small></div>`).join('')}
            <div class="wc-actions">
              <button class="btn btn-sm" data-ex-play>🔊 发音</button>
              <button class="btn btn-sm ${inBook ? 'btn-done' : ''}" data-book>${inBook ? '📚 已在生词本' : '＋ 加入生词本'}</button>
              <button class="btn btn-sm ${learned ? 'btn-done' : ''}" data-learn>${learned ? '✓ 已学会' : '✓ 学会了'}</button>
            </div>
          </div>
        </div>
      </div>`;
    }).join('')}`;

  $$('.word-card', s).forEach(card => {
    const w = L.words[+card.dataset.i];
    /* 点卡片翻面（点到按钮不翻） */
    card.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      card.classList.toggle('flipped');
    });
    $('[data-play]', card).addEventListener('click', () => speak(w.word, 0.9));
    $('[data-ex-play]', card).addEventListener('click', () => speak(w.word, 0.9));
    /* 加入/移出生词本 */
    $('[data-book]', card).addEventListener('click', () => {
      if (Book.has(tbId, w.word)) {
        Book.removeByKey(Book.key(tbId, w.word));
        toast('已移出生词本');
      } else {
        Book.add(tbId, w);
        toast('已加入生词本 📚');
      }
      const inBook = Book.has(tbId, w.word);
      const btn = $('[data-book]', card);
      btn.textContent = inBook ? '📚 已在生词本' : '＋ 加入生词本';
      btn.classList.toggle('btn-done', inBook);
      updateNavBadge();
    });
    /* 标记/取消已学会 */
    $('[data-learn]', card).addEventListener('click', () => {
      const learned = Progress.toggleWord(tbId, L.id, w.word);
      const btn = $('[data-learn]', card);
      btn.textContent = learned ? '✓ 已学会' : '✓ 学会了';
      btn.classList.toggle('btn-done', learned);
      toast(learned ? '真棒，这个词学会了！' : '已取消标记');
    });
  });
}

/* ---------- 句子听写：句子列表 ---------- */
function renderSentences() {
  const s = $('#screen-sentences');
  const L = state.lesson;
  const p = Progress.get(state.textbook.id);
  const lp = Progress.lesson(p, L.id);
  s.innerHTML = `
    <div class="page-head">
      <button class="icon-btn" data-back>‹</button>
      <div class="head-title"><b>句子听写</b><small>${esc(L.title)}</small></div>
    </div>
    <p class="hint">听发音，把句子一个词一个词写出来</p>
    ${L.sentences.map((sen, i) => {
      const sc = lp.scores[i];
      const badge = sc === undefined ? '<span class="badge b-new">未练习</span>'
        : sc === 100 ? '<span class="badge b-done">✓ 全对</span>'
        : `<span class="badge b-part">${sc} 分</span>`;
      return `<div class="card sen-row" data-i="${i}">
        <div class="sen-num">${i + 1}</div>
        <div class="sen-info"><b>句子 ${i + 1}</b><span>共 ${tokenize(sen.en).length} 个单词</span></div>
        ${badge}
        <div class="sen-arrow">›</div>
      </div>`;
    }).join('')}`;
  $$('.sen-row', s).forEach(el => el.addEventListener('click', () => {
    state.dictIdx = +el.dataset.i;
    go('dictation');
  }));
}

/* ---------- 句子听写：答题页 ---------- */
function renderDictation() {
  const s = $('#screen-dictation');
  const L = state.lesson;
  const sen = L.sentences[state.dictIdx];
  const tokens = tokenize(sen.en);
  state.dictFinished = false;
  s.innerHTML = `
    <div class="page-head">
      <button class="icon-btn" data-back>‹</button>
      <div class="head-title"><b>句子 ${state.dictIdx + 1}</b><small>${esc(L.title)}</small></div>
    </div>
    <div class="card dict-body">
      <button class="btn btn-primary btn-big" id="dict-play">🔊 播放发音</button>
      <p class="hint" style="text-align:center;margin:12px 0 0">共 ${tokens.length} 个单词 · 写完一个单词自动跳下一个空（空格键也可以跳）</p>
      <p class="hint" style="text-align:center;margin:6px 0 0;color:var(--primary-dark)">💡 中文提示：${esc(sen.zh)}</p>
      <div class="dict-line">
        ${tokens.map((t, i) => `
          <span class="dict-tok">
            <input class="dict-inp" data-i="${i}" style="width:${Math.max(t.word.length, 3) + 1}ch"
              autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done">
            ${t.punct ? `<i class="punct">${esc(t.punct)}</i>` : ''}
          </span>`).join('')}
      </div>
      <div class="dict-actions">
        <button class="btn" id="dict-fix" style="display:none">✏️ 只重写错词</button>
        <button class="btn" id="dict-retry" style="display:none">🔄 再试一次</button>
        <button class="btn btn-primary" id="dict-submit">提交答案</button>
        <button class="btn" id="dict-next" style="display:none">下一个句子 ›</button>
      </div>
      <div id="dict-result"></div>
    </div>`;
  /* 进入即播放发音（来自点击，符合浏览器要求） */
  speak(sen.en, Settings.get().dictRate);
  $('#dict-play', s).addEventListener('click', () => speak(sen.en, Settings.get().dictRate));
  $('#dict-submit', s).addEventListener('click', () => submitDictation(sen, tokens));
  /* 只重写错词：写错的空格清空重填，写对的保持不动 */
  $('#dict-fix', s).addEventListener('click', () => {
    const wrongs = $$('.dict-inp.wrong', s);
    wrongs.forEach(inp => {
      inp.classList.remove('wrong');
      inp.value = '';
      inp.disabled = false;
      delete inp.dataset.done;
    });
    state.dictFinished = false;
    $('#dict-fix', s).style.display = 'none';
    $('#dict-retry', s).style.display = 'none';
    $('#dict-next', s).style.display = 'none';
    $('#dict-submit', s).style.display = '';
    $('#dict-result', s).innerHTML = `<p class="hint" style="margin:8px 0 0">还剩 ${wrongs.length} 个词，改写后再提交</p>`;
    if (wrongs[0]) wrongs[0].focus();
  });
  $('#dict-retry', s).addEventListener('click', () => renderDictation());
  $('#dict-next', s).addEventListener('click', nextSentence);
  const line = $('.dict-line', s); /* 注意：这里是 class 选择器 */
  const isInput = el => el && el.classList.contains('dict-inp');
  const focusNext = inp => {
    const next = $(`.dict-inp[data-i="${+inp.dataset.i + 1}"]`, line);
    if (next) next.focus();
  };
  /* 自动跳下一个空：写对单词，或字母数已经写够，就跳。
     即使输入法把空格键「吃掉」也能自动跳。
     用 data-done 记住跳过的格子，回头修改时不至于又被弹走 */
  const autoAdvance = inp => {
    const tok = tokens[+inp.dataset.i];
    if (!tok) return;
    const letters = (inp.value || '').replace(/[^a-zA-Z'-]/g, '');
    const expect = (tok.word || '').replace(/[^a-zA-Z'-]/g, '');
    const matches = letters && (normWord(inp.value) === normWord(tok.word) || letters.length >= expect.length);
    if (matches && !inp.dataset.done) {
      inp.dataset.done = '1';
      focusNext(inp);
    } else if (!matches) {
      delete inp.dataset.done;
    }
  };
  /* input 事件：覆盖电脑输入法和手机键盘（空格被输入法吃掉也不怕） */
  line.addEventListener('input', e => {
    const inp = e.target;
    if (!isInput(inp)) return;
    if (/\s/.test(inp.value)) {
      inp.value = inp.value.replace(/\s/g, '');
      focusNext(inp);
      return;
    }
    autoAdvance(inp);
  });
  /* 键盘事件：回车 = 提交答案（空格键由全局监听统一处理，更可靠） */
  line.addEventListener('keydown', e => {
    const inp = e.target;
    if (!isInput(inp)) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      submitDictation(sen, tokens);
    }
  });
  const first = $('.dict-inp', s);
  if (first) first.focus();
}

/* 批改听写结果 */
function submitDictation(sen, tokens) {
  const s = $('#screen-dictation');
  const inputs = $$('.dict-inp', s);
  if (inputs.some(i => !i.value.trim())) { toast('还有空白没有填哦'); return; }
  let correct = 0;
  inputs.forEach((inp, i) => {
    inp.disabled = true;
    const ok = normWord(inp.value) === normWord(tokens[i].word);
    inp.classList.add(ok ? 'ok' : 'wrong');
    if (ok) correct++; else inp.value = tokens[i].word;
  });
  const score = Math.round(correct / tokens.length * 100);
  Progress.score(state.textbook.id, state.lesson.id, state.dictIdx, score);
  state.dictFinished = true;
  $('#dict-submit', s).style.display = 'none';
  $('#dict-retry', s).style.display = '';
  if ($$('.dict-inp.wrong', s).length) $('#dict-fix', s).style.display = '';
  const nextBtn = $('#dict-next', s);
  nextBtn.style.display = '';
  nextBtn.textContent = state.dictIdx + 1 < state.lesson.sentences.length ? '下一个句子 ›' : '本课完成 ✓';
  $('#dict-result', s).innerHTML = `
    <div class="card res-card">
      <div class="res-score ${score === 100 ? 'all-right' : ''}">${score === 100 ? '🎉 全部正确！' : '得分 ' + score}</div>
      <div class="res-trans"><b>翻译</b><p>${esc(sen.zh)}</p></div>
      <div class="res-ana">
        <b>句子成分解析</b>
        <div class="chips">${(sen.analysis || []).map(a => `
          <span class="chip" style="--rc:${ROLE_COLOR[a.roles[0]] || ROLE_COLOR['其他']}">
            <b>${esc(a.text)}</b><i>${esc(a.roles.join('·'))}</i>
          </span>`).join('')}
        </div>
        <div class="legend">${Object.keys(ROLE_COLOR).filter(k => k !== '其他').map(k =>
          `<span><i style="background:${ROLE_COLOR[k]}"></i>${k}</span>`).join('')}
        </div>
      </div>
      <p class="res-note">💡 看一遍成分解析，再点「再试一次」练到全对</p>
    </div>`;
  if (score === 100) toast('太棒了！全部正确 🎉');
}

/* 学习下一个句子（听写完成后按回车或点按钮） */
function nextSentence() {
  const L = state.lesson;
  if (state.dictIdx + 1 < L.sentences.length) {
    state.dictIdx++;
    renderDictation();
  } else {
    toast('本课句子全部学完啦 🎉');
    back();
  }
}

/* ---------- 单词听写（听音写单词 + 例句听写） ---------- */
function renderWdict() {
  const s = $('#screen-wdict');
  const L = state.lesson;
  if (state.wdMode === 'practice') { renderWdictPractice(); return; }
  state.wdFinished = false;
  const p = Progress.get(state.textbook.id);
  const lp = Progress.lesson(p, L.id);
  const wS = lp.wScores || {};
  s.innerHTML = `
    <div class="page-head">
      <button class="icon-btn" data-back>‹</button>
      <div class="head-title"><b>单词听写</b><small>${esc(L.title)}</small></div>
    </div>
    <p class="hint">听发音写出单词，再听写它的例句</p>
    ${L.words.map((w, i) => {
      const sc = wS[i];
      const badge = sc === undefined ? '<span class="badge b-new">未练习</span>'
        : sc === 100 ? '<span class="badge b-done">✓ 全对</span>'
        : `<span class="badge b-part">${sc} 分</span>`;
      const ex = (w.examples && w.examples[0]) || null;
      return `<div class="card sen-row" data-i="${i}">
        <div class="sen-num">${i + 1}</div>
        <div class="sen-info"><b>${esc(w.meaning || w.word)}</b><span>${ex ? '例句听写 · ' + tokenize(ex.en).length + ' 词' : '无例句'}</span></div>
        ${badge}
        <div class="sen-arrow">›</div>
      </div>`;
    }).join('')}`;
  $$('.sen-row', s).forEach(el => el.addEventListener('click', () => {
    state.wdictIdx = +el.dataset.i;
    state.wdStep = 0;
    state.wdResult = { wordOk: false, sentOk: 0, sentTotal: 0 };
    state.wdMode = 'practice';
    renderWdictPractice();
  }));
}

function renderWdictPractice() {
  const s = $('#screen-wdict');
  const L = state.lesson;
  const w = L.words[state.wdictIdx];
  const ex = (w.examples && w.examples[0]) || null;
  const isLast = state.wdictIdx + 1 >= L.words.length;
  state.wdFinished = false;

  /* ---- 第一步：听音写单词 ---- */
  if (state.wdStep === 0) {
    s.innerHTML = `
      <div class="page-head">
        <button class="icon-btn" data-back>‹</button>
        <div class="head-title"><b>单词听写 ${state.wdictIdx + 1} / ${L.words.length}</b><small>${esc(L.title)}</small></div>
      </div>
      <div class="card dict-body">
        <button class="btn btn-primary btn-big" id="wd-play">🔊 播放单词</button>
        <p class="hint" style="text-align:center;margin:12px 0 0">听发音写出单词（提示：${esc(w.meaning || '')}）· 提交后再按回车进入下一步</p>
        <div class="dict-line">
          <input class="dict-inp" data-i="0" id="wd-word-inp"
            style="width:${Math.max(w.word.length, 3) + 1}ch"
            autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">
        </div>
        <div class="dict-actions">
          <button class="btn btn-primary" id="wd-submit">提交</button>
          <button class="btn" id="wd-retry" style="display:none">🔄 再试一次</button>
          <button class="btn" id="wd-next" style="display:none">下一步 ›</button>
        </div>
        <div id="wd-result"></div>
      </div>`;
    speak(w.word, Settings.get().dictRate);
    $('#wd-play', s).addEventListener('click', () => speak(w.word, Settings.get().dictRate));
    const inp = $('#wd-word-inp', s);
    const submit = () => {
      if (!inp.value.trim()) { toast('先写下你听到的单词哦'); return; }
      const ok = normWord(inp.value) === normWord(w.word);
      inp.disabled = true;
      inp.classList.add(ok ? 'ok' : 'wrong');
      if (!ok) inp.value = w.word;
      state.wdResult = { wordOk: ok, sentOk: 0, sentTotal: 0 };
      state.wdFinished = true;
      $('#wd-submit', s).style.display = 'none';
      $('#wd-retry', s).style.display = '';
      const nextBtn = $('#wd-next', s);
      nextBtn.style.display = '';
      nextBtn.textContent = ex ? '下一步：听写例句 ›' : (isLast ? '完成 ✓' : '下一个单词 ›');
      $('#wd-result', s).innerHTML = ok
        ? '<div class="res-score all-right">✓ 单词写对了！</div>'
        : '<div class="res-score">正确答案是 <b style="color:#D95D4E">' + esc(w.word) + '</b>，记住它</div>';
    };
    $('#wd-submit', s).addEventListener('click', submit);
    $('#wd-retry', s).addEventListener('click', () => renderWdictPractice());
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    $('#wd-next', s).addEventListener('click', wdNext);
    inp.focus();
    return;
  }

  /* ---- 第二步：听写例句 ---- */
  const tokens = tokenize(ex.en);
  s.innerHTML = `
    <div class="page-head">
      <button class="icon-btn" data-back>‹</button>
      <div class="head-title"><b>例句听写 ${state.wdictIdx + 1} / ${L.words.length}</b><small>${esc(L.title)}</small></div>
    </div>
    <div class="card dict-body">
      <button class="btn btn-primary btn-big" id="wd-play">🔊 播放例句</button>
      <p class="hint" style="text-align:center;margin:12px 0 0">例句中包含单词「${esc(w.word)}」· 共 ${tokens.length} 个单词 · 写完自动跳下一个空 · 提交后按回车继续</p>
      <div class="dict-line">
        ${tokens.map((t, i) => `
          <span class="dict-tok">
            <input class="dict-inp" data-i="${i}" style="width:${Math.max(t.word.length, 3) + 1}ch"
              autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">
            ${t.punct ? `<i class="punct">${esc(t.punct)}</i>` : ''}
          </span>`).join('')}
      </div>
      <div class="dict-actions">
        <button class="btn btn-primary" id="wd-submit">提交</button>
        <button class="btn" id="wd-retry" style="display:none">🔄 再试一次</button>
        <button class="btn" id="wd-next" style="display:none">${isLast ? '完成 ✓' : '下一个单词 ›'}</button>
      </div>
      <div id="wd-result"></div>
    </div>`;
  speak(ex.en, Settings.get().dictRate);
  $('#wd-play', s).addEventListener('click', () => speak(ex.en, Settings.get().dictRate));
  const line = $('.dict-line', s);
  const focusNext = inp => {
    const next = line.querySelector(`.dict-inp[data-i="${+inp.dataset.i + 1}"]`);
    if (next) next.focus();
  };
  /* 和句子听写一样：写完自动跳下一个空 */
  line.addEventListener('input', e => {
    const inp = e.target;
    if (!inp.classList.contains('dict-inp')) return;
    if (/\s/.test(inp.value)) { inp.value = inp.value.replace(/\s/g, ''); focusNext(inp); return; }
    const tok = tokens[+inp.dataset.i];
    if (!tok) return;
    const letters = inp.value.replace(/[^a-zA-Z'-]/g, '');
    const expect = tok.word.replace(/[^a-zA-Z'-]/g, '');
    const matches = letters && (normWord(inp.value) === normWord(tok.word) || letters.length >= expect.length);
    if (matches && !inp.dataset.done) {
      inp.dataset.done = '1';
      focusNext(inp);
    } else if (!matches) {
      delete inp.dataset.done;
    }
  });
  const submitWdSent = () => {
    const inputs = $$('.dict-inp', s);
    if (inputs.some(i => !i.value.trim())) { toast('还有空白没有填哦'); return; }
    let correct = 0;
    inputs.forEach((inp, i) => {
      inp.disabled = true;
      const ok = normWord(inp.value) === normWord(tokens[i].word);
      inp.classList.add(ok ? 'ok' : 'wrong');
      if (ok) correct++; else inp.value = tokens[i].word;
    });
    const r = state.wdResult;
    r.sentOk = correct;
    r.sentTotal = tokens.length;
    state.wdFinished = true;
    $('#wd-submit', s).style.display = 'none';
    $('#wd-retry', s).style.display = '';
    $('#wd-next', s).style.display = '';
    const allOk = correct === tokens.length;
    $('#wd-result', s).innerHTML = `
      <div class="card res-card">
        <div class="res-score ${allOk ? 'all-right' : ''}">${allOk ? '🎉 例句全对！' : '例句对了 ' + correct + ' / ' + tokens.length + ' 词'}</div>
        <div class="res-trans"><b>翻译</b><p>${esc(ex.zh)}</p></div>
      </div>`;
  };
  line.addEventListener('keydown', e => {
    const inp = e.target;
    if (!inp.classList.contains('dict-inp')) return;
    if (e.key === 'Enter') { e.preventDefault(); submitWdSent(); }
  });
  $('#wd-submit', s).addEventListener('click', submitWdSent);
  $('#wd-retry', s).addEventListener('click', () => renderWdictPractice());
  $('#wd-next', s).addEventListener('click', wdNext);
  const first = $('.dict-inp', s);
  if (first) first.focus();
}

/* 本步提交后：进入下一步（例句听写 / 下一个单词），回车和按钮共用 */
function wdNext() {
  if (state.wdMode !== 'practice') return;
  const w = state.lesson.words[state.wdictIdx];
  if (state.wdStep === 0 && w.examples && w.examples[0]) {
    state.wdStep = 1;
    renderWdictPractice();
  } else {
    wdFinish();
  }
}

/* 本单词听写结束：算总分（单词 + 例句各占一定比例）并进入下一个 */
function wdFinish() {
  const L = state.lesson;
  const w = L.words[state.wdictIdx];
  const ex = (w.examples && w.examples[0]) || null;
  const r = state.wdResult || { wordOk: false, sentOk: 0, sentTotal: 0 };
  const total = 1 + (ex ? tokenize(ex.en).length : 0);
  const correct = (r.wordOk ? 1 : 0) + r.sentOk;
  const score = Math.round(correct / total * 100);
  Progress.wordScore(state.textbook.id, L.id, state.wdictIdx, score);
  if (state.wdictIdx + 1 < L.words.length) {
    state.wdictIdx++;
    state.wdStep = 0;
    state.wdResult = { wordOk: false, sentOk: 0, sentTotal: 0 };
    renderWdictPractice();
  } else {
    state.wdMode = 'list';
    toast('单词听写全部完成 🎉');
    renderWdict();
  }
}

/* ---------- 文章影子跟读 ---------- */
function renderArticle() {
  const s = $('#screen-article');
  const L = state.lesson;
  const sp = Settings.get().shadowRate;
  const p = Progress.get(state.textbook.id);
  const lp = Progress.lesson(p, L.id);
  s.innerHTML = `
    <div class="page-head">
      <button class="icon-btn" data-back>‹</button>
      <div class="head-title"><b>影子跟读</b><small>${esc(L.title)}</small></div>
    </div>
    <p class="hint">先听原声 → 点录音跟着读 → 回放对比</p>
    <div class="speed-row">语速：${[0.6, 0.8, 1, 1.2].map(r =>
      `<button class="chip-btn ${Math.abs(sp - r) < 0.05 ? 'on' : ''}" data-rate="${r}">${r}×</button>`).join('')}
    </div>
    ${L.article.map((sen, i) => `
      <div class="card art-card" data-i="${i}">
        <p class="art-en">${esc(sen.en)}</p>
        <p class="art-zh">${esc(sen.zh)}</p>
        <div class="art-controls">
          <button class="btn btn-sm" data-play>▶ 播放</button>
          <button class="btn btn-sm" data-rec>🎙 录音</button>
        </div>
        <audio class="art-audio ${state.rec[i] ? '' : 'hidden'}" controls src="${state.rec[i] || ''}"></audio>
      </div>`).join('')}
    <button class="btn ${lp.article ? 'btn-done' : 'btn-primary'} btn-block" id="art-done">${lp.article ? '✓ 本课跟读已完成' : '✓ 标记本课跟读完成'}</button>`;

  /* 语速切换 */
  $$('.chip-btn', s).forEach(b => b.addEventListener('click', () => {
    Settings.set({ shadowRate: +b.dataset.rate });
    $$('.chip-btn', s).forEach(x => x.classList.toggle('on', x === b));
  }));

  function updatePlayBtns() {
    $$('.art-card', s).forEach((card, i) => {
      $('[data-play]', card).textContent = state.articlePlaying === i ? '⏹ 停止' : '▶ 播放';
    });
  }

  $$('.art-card', s).forEach(card => {
    const i = +card.dataset.i;
    const sen = L.article[i];
    /* 播放/停止原声 */
    $('[data-play]', card).addEventListener('click', () => {
      if (state.articlePlaying === i) {
        stopSpeak();
        state.articlePlaying = -1;
        updatePlayBtns();
        return;
      }
      state.articlePlaying = i;
      updatePlayBtns();
      speak(sen.en, Settings.get().shadowRate, () => {
        state.articlePlaying = -1;
        updatePlayBtns();
      });
    });
    /* 录音/停止录音 */
    $('[data-rec]', card).addEventListener('click', async () => {
      if (isRecording()) { stopRecord(); return; }
      const btn = $('[data-rec]', card);
      btn.textContent = '⏹ 停止录音';
      card.classList.add('recording');
      const ok = await startRecord(url => {
        btn.textContent = '🎙 录音';
        card.classList.remove('recording');
        if (state.rec[i]) URL.revokeObjectURL(state.rec[i]);
        state.rec[i] = url;
        const au = $('.art-audio', card);
        au.src = url;
        au.classList.remove('hidden');
        au.play();
      }, () => {
        btn.textContent = '🎙 录音';
        card.classList.remove('recording');
        toast('录音失败：请允许麦克风权限');
      });
      if (!ok) {
        btn.textContent = '🎙 录音';
        card.classList.remove('recording');
      }
    });
  });

  $('#art-done', s).addEventListener('click', () => {
    if (lp.article) { toast('本课跟读已完成 ✓'); return; }
    Progress.setArticle(state.textbook.id, L.id);
    toast('本课跟读完成，继续加油！');
    renderArticle();
  });
}

/* ---------- 生词本 ---------- */
function renderBook() {
  const s = $('#screen-book');
  const due = Book.due();
  const all = Object.values(Book.all()).sort((a, b) => a.addedAt - b.addedAt);
  s.innerHTML = `
    <div class="page-head">
      <div class="head-title"><b>我的生词本</b><small>智能间隔复习 · 及时复习记得更牢</small></div>
    </div>
    <div class="tab-bar">
      <button class="tab ${state.bookTab === 'review' ? 'on' : ''}" data-tab="review">待复习 (${due.length})</button>
      <button class="tab ${state.bookTab === 'all' ? 'on' : ''}" data-tab="all">全部单词 (${all.length})</button>
    </div>
    <div id="book-body"></div>`;
  $$('.tab', s).forEach(t => t.addEventListener('click', () => {
    state.bookTab = t.dataset.tab;
    renderBook();
  }));
  renderBookBody();
}

function renderBookBody() {
  const body = $('#book-body');
  const due = Book.due();
  const all = Object.values(Book.all()).sort((a, b) => a.addedAt - b.addedAt);
  if (state.bookTab === 'review') {
    if (!due.length) {
      body.innerHTML = '<div class="empty">🎉 今天没有需要复习的单词<br><small>去词汇学习里收藏新单词吧</small></div>';
      return;
    }
    renderReviewCard(due, 0);
  } else {
    if (!all.length) {
      body.innerHTML = '<div class="empty">📭 生词本还是空的<br><small>在词汇学习中点「加入生词本」收藏单词</small></div>';
      return;
    }
    body.innerHTML = all.map(w => `
      <div class="card book-row">
        <div class="br-info"><b>${esc(w.word)}</b><span>${esc(w.meaning || '')}</span></div>
        <div class="br-side">
          <small>${w.srs.due <= Date.now() ? '现在复习' : '下次 ' + fmtDate(w.srs.due)}</small>
          <button class="icon-btn" data-del="${esc(w.key)}" style="width:30px;height:30px;font-size:15px">✕</button>
        </div>
      </div>`).join('');
    $$('[data-del]', body).forEach(b => b.addEventListener('click', () => {
      Book.removeByKey(b.dataset.del);
      toast('已删除该单词');
      renderBook();
    }));
  }
}

function renderReviewCard(queue, idx) {
  const item = queue[idx];
  const body = $('#book-body');
  body.innerHTML = `
    <div class="card review-card">
      <div class="rc-count">第 ${idx + 1} / ${queue.length} 个</div>
      <div class="rc-word">
        <b>${esc(item.word)}</b>
        <span class="phon">${esc(item.phonetic || '')}</span>
        <button class="icon-btn" id="rc-play">🔊</button>
      </div>
      <button class="btn btn-primary btn-block" id="rc-reveal">显示释义</button>
      <div id="rc-answer" class="hidden">
        <div class="rc-mean">${esc(item.meaning || '')}</div>
        ${(item.examples || []).slice(0, 1).map(ex =>
          `<div class="wc-ex" style="text-align:left"><p>${esc(ex.en)}</p><small>${esc(ex.zh)}</small></div>`).join('')}
        <div class="rc-grade">
          <button class="btn g-again" data-grade="again">😅 忘记了</button>
          <button class="btn g-hard" data-grade="hard">🤔 模糊</button>
          <button class="btn g-good" data-grade="good">😊 认识</button>
        </div>
      </div>
    </div>`;
  $('#rc-play', body).addEventListener('click', () => speak(item.word, 0.9));
  $('#rc-reveal', body).addEventListener('click', () => {
    $('#rc-answer', body).classList.remove('hidden');
    $('#rc-reveal', body).classList.add('hidden');
  });
  $$('[data-grade]', body).forEach(b => b.addEventListener('click', () => {
    const grade = b.dataset.grade;
    schedule(item, grade);
    Book.save(Book.all());
    updateNavBadge();
    toast(grade === 'again' ? '10 分钟后再复习一次，加油！'
      : grade === 'hard' ? '明天再复习一次'
      : item.srs.interval > 1 ? `记住了！${item.srs.interval} 天后再见` : '记住了！明天再见');
    const nq = Book.due();
    if (!nq.length) {
      body.innerHTML = '<div class="empty">🎉 今天的复习全部完成！<br><small>学而时习之，不亦说乎</small></div>';
      return;
    }
    renderReviewCard(nq, Math.min(idx, nq.length - 1));
  }));
}

/* 底部导航上的待复习数字 */
function updateNavBadge() {
  const badge = $('#nav-due-badge');
  const n = Book.due().length;
  badge.textContent = n > 99 ? '99+' : n;
  badge.classList.toggle('hidden', n === 0);
}

/* ---------- 设置 ---------- */
function renderSettings() {
  const s = $('#screen-settings');
  const st = Settings.get();
  s.innerHTML = `
    <div class="page-head"><div class="head-title"><b>设置</b></div></div>
    <div class="card set-card">
      <div class="set-row">
        <label>句子听写语速</label>
        <input type="range" id="set-dict" min="0.5" max="1.2" step="0.05" value="${st.dictRate}">
        <b id="v-dict">${st.dictRate}×</b>
      </div>
      <div class="set-row">
        <label>影子跟读语速</label>
        <input type="range" id="set-shadow" min="0.5" max="1.2" step="0.05" value="${st.shadowRate}">
        <b id="v-shadow">${st.shadowRate}×</b>
      </div>
    </div>
    <div class="card set-card">
      <b class="sec-sub">🔊 发音设置</b>
      ${('speechSynthesis' in window) ? `
      <div class="set-row" style="flex-wrap:wrap">
        <label>英文音色</label>
        <select class="set-select" id="set-voice"></select>
      </div>
      <button class="btn btn-sm" id="set-voice-test">🔊 试听所选音色</button>
      <p class="set-p">每台设备的音色都不一样（电脑、平板、手机各是各的），在这里挑一个你喜欢的。手机上若完全没声音，请用系统浏览器（Chrome / Safari / Edge）打开本网站 —— 微信内置浏览器不支持发音。</p>`
      : `<p class="set-p" style="color:#D95D4E">当前浏览器不支持系统发音。请用 Chrome / Safari / Edge 等系统浏览器打开本网站（微信里点右上角「···」→「在浏览器中打开」）。</p>`}
    </div>
    <div class="card set-card">
      <b class="sec-sub">📲 安装到手机桌面（像 App 一样用）</b>
      <button class="btn btn-primary btn-block hidden" id="install-btn">📲 一键安装到桌面</button>
      <p class="set-p">上面没有按钮时，手动操作：</p>
      <p class="set-p">iPhone / iPad：用 <b>Safari</b> 打开网址 → 点底部「分享」→ 「添加到主屏幕」</p>
      <p class="set-p">安卓：用 <b>Chrome / Edge</b> 打开网址 → 右上角菜单「⋮」→ 「安装应用」或「添加到主屏幕」</p>
      <p class="set-p">⚠️ 微信里打开的页面不能安装也不能发音，请点微信右上角「···」→「在浏览器中打开」。</p>
    </div>
    <div class="card set-card">
      <b class="sec-sub">💾 数据说明</b>
      <p class="set-p">学习进度和生词本保存在本机浏览器中，不联网同步。换手机或清除浏览器数据会丢失。</p>
    </div>
    <div class="card set-card danger">
      <button class="btn btn-danger btn-block" id="set-clear">清空所有学习数据</button>
    </div>
    <p class="about">暖学英语 v0.2.2 · 白色暖色主题</p>`;

  function bindSlider(id, valId, key) {
    const slider = $('#' + id, s);
    slider.addEventListener('input', () => {
      Settings.set({ [key]: +slider.value });
      $('#' + valId, s).textContent = slider.value + '×';
    });
  }
  bindSlider('set-dict', 'v-dict', 'dictRate');
  bindSlider('set-shadow', 'v-shadow', 'shadowRate');

  /* 音色选择：列出设备上的英文声音，挑中后保存 */
  if ('speechSynthesis' in window) {
    const sel = $('#set-voice', s);
    const fill = () => {
      const vs = listVoices();
      if (!vs.length) { sel.innerHTML = '<option>声音列表加载中…请稍候</option>'; return; }
      const cur = ttsVoice && ttsVoice.name;
      sel.innerHTML = vs.map(v =>
        `<option value="${esc(v.name)}" ${v.name === cur ? 'selected' : ''}>${esc(v.name)}（${esc(v.lang)}）</option>`).join('');
    };
    fill();
    speechSynthesis.addEventListener('voiceschanged', fill);
    sel.addEventListener('change', () => {
      Settings.set({ voice: sel.value });
      pickVoice();
      toast('已切换音色');
    });
    $('#set-voice-test', s).addEventListener('click', () => {
      if (sel.value) Settings.set({ voice: sel.value });
      pickVoice();
      speak('Nice to meet you. Let us learn English together.');
    });
  }

  /* 一键安装到桌面（支持此功能的浏览器会显示按钮） */
  const ib = $('#install-btn', s);
  if (ib) {
    if (window.__deferredInstall) ib.classList.remove('hidden');
    ib.addEventListener('click', () => {
      const ev = window.__deferredInstall;
      if (ev) {
        ev.prompt();
        ev.userChoice.then(c => {
          window.__deferredInstall = null;
          ib.classList.add('hidden');
          if (c.outcome === 'accepted') toast('正在安装…');
        });
      } else {
        toast('当前浏览器不支持一键安装，请按下面说明手动操作');
      }
    });
  }

  $('#set-clear', s).addEventListener('click', () => {
    if (confirm('确定清空所有学习数据吗？此操作无法恢复。')) {
      try {
        Object.keys(localStorage).filter(k => k.startsWith('we.')).forEach(k => localStorage.removeItem(k));
      } catch (e) {}
      toast('已清空');
      renderSettings();
    }
  });
}

/* ---------- 启动 ---------- */
document.addEventListener('DOMContentLoaded', () => {
  $$('#bottom-nav [data-nav]').forEach(b => b.addEventListener('click', () => {
    state.stack = [];
    state.pageData = {};
    route(b.dataset.nav);
  }));
  updateNavBadge();
  renderHome();
  show('home');
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  /* 浏览器提示「可以安装」时拦下来，改为在设置页显示安装按钮 */
  window.__deferredInstall = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    window.__deferredInstall = e;
    const ib = $('#install-btn');
    if (ib) ib.classList.remove('hidden');
  });
  window.addEventListener('appinstalled', () => {
    window.__deferredInstall = null;
    toast('安装成功 🎉');
  });
});
