// daily.js — 首页「每日一句」：长难句 / 作文好句 / 名言。
// 双源设计：
//   1) 内置精选库（离线兜底，秒开，无需 Key）；
//   2) 智能生成用用户自己的 API Key（BYOK）现生成一句，结果本地缓存，避免重复扣费。
// 全部数据仅存本机（localStorage 仅存生成的句子文本，不存 Key）。
(function () {
  const LIB = {
    long: [ // 长难句（英文 + 中文释义）
      { en: 'Although the digital revolution has brought unprecedented convenience to our daily lives, it has simultaneously given rise to a subtle erosion of our capacity for sustained attention and deep reflection.',
        cn: '尽管数字革命给日常生活带来了前所未有的便利，它同时也导致我们持续专注与深度思考能力的悄然退化。' },
      { en: 'What distinguishes human beings from other animals is not the ability to reason alone, but rather the capacity to reflect upon our own thoughts and to choose how we respond to them.',
        cn: '使人区别于其他动物的，不只是推理能力，更是反思自身思想、并选择如何回应它们的能力。' },
      { en: 'It is not the consciousness of men that determines their being, but, on the contrary, their social being that determines their consciousness.',
        cn: '并非人的意识决定人的存在，相反，是人的社会存在决定人的意识。',
        by: 'Karl Marx' },
      { en: 'The most beautiful thing we can experience is the mysterious, which is the source of all true art and science.',
        cn: '我们能体验到的最美的事物是神秘，它是所有真正艺术与科学的源泉。',
        by: 'Albert Einstein' },
      { en: 'Those who can make you believe absurdities can make you commit atrocities.',
        cn: '能让你相信荒谬之人，也能让你犯下暴行。',
        by: 'Voltaire' },
      { en: 'We are what we repeatedly do; excellence, then, is not an act but a habit.',
        cn: '我们重复做什么，自己就是什么；卓越不是一时的行为，而是一种习惯。',
        by: 'Aristotle' }
    ],
    good: [ // 作文好句（可套用句型 + 中文）
      { en: 'There is no denying that ___ has become a hotly debated topic in recent years.',
        cn: '不可否认，___ 近年来已成为一个热议话题。（开头万能句）' },
      { en: 'From my perspective, what really matters is not merely ___, but the underlying value it reflects.',
        cn: '在我看来，真正重要的不只是 ___，更是它所折射出的内在价值。' },
      { en: 'Only by ___ can we truly ___ and make a difference.',
        cn: '唯有 ___，我们才能真正 ___ 并带来改变。（倒装强调）' },
      { en: 'It is widely acknowledged that ___ plays an indispensable role in ___.',
        cn: '人们普遍认为，___ 在 ___ 中扮演着不可或缺的角色。' },
      { en: 'The merits of ___ are manifold, ranging from ___ to ___.',
        cn: '___ 的好处是多方面的，从 ___ 到 ___ 不一而足。' },
      { en: 'Every coin has two sides, and ___ is no exception: it brings convenience, yet also poses challenges.',
        cn: '凡事皆有两面，___ 也不例外：它带来便利，也提出挑战。' }
    ],
    quote: [ // 名言（英文 + 作者）
      { en: 'Stay hungry, stay foolish.',
        cn: '求知若饥，虚心若愚。',
        by: 'Steve Jobs' },
      { en: 'The only way to do great work is to love what you do.',
        cn: '成就伟大工作的唯一方法，是热爱你所做的事。',
        by: 'Steve Jobs' },
      { en: 'In the middle of difficulty lies opportunity.',
        cn: '困难之中蕴藏着机遇。',
        by: 'Albert Einstein' },
      { en: 'Well done is better than well said.',
        cn: '行胜于言。',
        by: 'Benjamin Franklin' },
      { en: 'Genius is one percent inspiration and ninety-nine percent perspiration.',
        cn: '天才是百分之一的灵感加百分之九十九的汗水。',
        by: 'Thomas Edison' },
      { en: 'The journey of a thousand miles begins with a single step.',
        cn: '千里之行，始于足下。',
        by: 'Lao Tzu' },
      { en: 'Education is the most powerful weapon which you can use to change the world.',
        cn: '教育是你用来改变世界的最有力武器。',
        by: 'Nelson Mandela' }
    ]
  };

  const AI_KEY = 'pigai_daily_ai'; // 生成的句子缓存（{cat: [item,...]}），不存 Key
  const PROMPTS = {
    long: '你是英语学习助手。给我一句值得背诵的长难句（含从句/倒装/分词等高级结构），难度适合 CET-6 或考研。只返回 JSON：{"en":"英文句子","cn":"中文翻译"}，不要其它文字。',
    good: '你是英语作文老师。给我一句可以直接套用的英语作文高级句型模板，用 ___ 表示需要替换的空缺。只返回 JSON：{"en":"英文句型","cn":"中文释义与用法提示"}，不要其它文字。',
    quote: '你是英语学习助手。给我一句经典英语名言。只返回 JSON：{"en":"英文","cn":"中文翻译","by":"作者"}，不要其它文字。'
  };

  let cat = 'long';
  let source = 'builtin'; // 'builtin' | 'ai'
  let offset = 0;         // 内置库游标
  let aiCursor = 0;       // AI 缓存游标
  let loading = false;

  function dayIndex() { return Math.floor(Date.now() / 86400000); }
  function builtinPick() { const l = LIB[cat] || []; if (!l.length) return null; return l[(dayIndex() + offset) % l.length]; }
  function aiPool() { let d = {}; try { d = JSON.parse(localStorage.getItem(AI_KEY) || '{}'); } catch (e) { } return (d[cat] || []); }
  function aiPick() { const p = aiPool(); return p[aiCursor] || null; }
  function current() { return source === 'ai' ? aiPick() : builtinPick(); }

  function toast(msg) {
    const t = document.getElementById('toast');
    const tt = document.getElementById('toastText');
    if (!t || !tt) return;
    tt.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 2000);
  }

  function extractJSON(text) {
    if (!text) return null;
    text = text.trim();
    const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) text = m[1].trim();
    const s = text.indexOf('{'), e = text.lastIndexOf('}');
    if (s >= 0 && e >= 0) { try { return JSON.parse(text.slice(s, e + 1)); } catch (_) { } }
    return null;
  }

  // 调用户自己的 Key 生成一句并缓存
  async function genAI() {
    if (loading) return null;
    if (!window.LLM || !window.LLM.doChat) { toast('智能生成不可用，已显示内置例句'); source = 'builtin'; render(); return null; }
    loading = true; render();
    const r = await window.LLM.doChat(PROMPTS[cat] || PROMPTS.long);
    loading = false;
    if (r.error || !r.text) {
      toast((r.error ? '生成失败：' + r.error : '生成失败') + '，已显示内置例句');
      source = 'builtin'; offset = 0; render();
      return null;
    }
    const j = extractJSON(r.text);
    if (!j || !j.en) { toast('智能生成返回格式异常，已显示内置例句'); source = 'builtin'; offset = 0; render(); return null; }
    const item = { en: String(j.en).trim(), cn: (j.cn || '').trim(), by: (j.by || '').trim(), ai: true };
    let d = {}; try { d = JSON.parse(localStorage.getItem(AI_KEY) || '{}'); } catch (e) { }
    d[cat] = (d[cat] || []).concat(item);
    try { localStorage.setItem(AI_KEY, JSON.stringify(d)); } catch (e) { }
    aiCursor = d[cat].length - 1;
    render();
    return item;
  }

  function render() {
    const el = document.getElementById('dailyText');
    const cn = document.getElementById('dailyCn');
    const au = document.getElementById('dailyAuthor');
    const src = document.getElementById('dailySrc');
    const nextBtn = document.getElementById('dailyNext');
    if (!el) return;
    if (loading) {
      el.textContent = '生成中…';
      cn.textContent = '请稍候';
      au.textContent = '';
      if (src) src.textContent = '';
      if (nextBtn) nextBtn.disabled = true;
      return;
    }
    if (nextBtn) nextBtn.disabled = false;
    const it = current();
    if (!it) { el.textContent = ''; cn.textContent = ''; au.textContent = ''; if (src) src.textContent = ''; return; }
    el.textContent = it.en;
    cn.textContent = it.cn || '';
    au.textContent = it.by ? '— ' + it.by : '';
    if (src) src.textContent = source === 'ai' ? 'AI' : '内置';
  }

  function next() {
    if (source === 'ai') {
      const p = aiPool();
      if (aiCursor < p.length - 1) { aiCursor++; render(); return; }
      source = 'builtin'; offset++; render(); // AI 缓存翻完 → 回到内置库
    } else {
      source = 'ai';
      const p = aiPool();
      if (p.length) { aiCursor = 0; render(); }
      else genAI(); // 无缓存 → 现生成新的
    }
  }

  function save() {
    const it = current();
    if (!it) return;
    const st = window.Store;
    const list = (st ? st.getVocab() : []).slice();
    if (list.some(x => x.type === 'sentence' && x.text === it.en)) { toast('已收藏过'); return; }
    const item = { type: 'sentence', text: it.en, cn: it.cn || '', ts: Date.now() };
    if (st) st.saveVocab(list.concat(item));
    toast('已加入好词好句本');
  }

  function init() {
    const seg = document.getElementById('dailySeg');
    if (seg) {
      seg.querySelectorAll('button').forEach(b => {
        b.addEventListener('click', () => {
          seg.querySelectorAll('button').forEach(x => x.classList.remove('on'));
          b.classList.add('on');
          cat = b.dataset.cat; source = 'builtin'; offset = 0; aiCursor = 0; render();
        });
      });
    }
    const nextBtn = document.getElementById('dailyNext');
    if (nextBtn) nextBtn.addEventListener('click', next);
    const sv = document.getElementById('dailySave');
    if (sv) sv.addEventListener('click', save);
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
