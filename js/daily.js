// daily.js — 首页「每日一句」：完全由 AI 生成（用户自带 Key，BYOK）
// 数据无服务端、仅存本机（localStorage `pigai_daily_ai` 仅缓存已生成的句子以避免重复扣费）。
// 无 Key 时显示引导文案，提示去「我的-模型设置」配置。
(function () {
  const AI_KEY = 'pigai_daily_ai'; // 缓存：{ cat: [item,...] }
  const PROMPTS = {
    long: '你是一位英语学习助手。请给我一句值得背诵的长难句（含从句/倒装/分词/插入语等高级结构，难度适合 CET-6 / 考研）。严格只返回 JSON：{"en":"英文句子","cn":"中文翻译","by":"作者或留空"}，不要任何其它文字。',
    good: '你是一位英语作文老师。请给我一句可以直接套用的英语作文高级句型模板，用 ___ 表示需要替换的空缺。严格只返回 JSON：{"en":"英文句型","cn":"中文释义与用法提示","by":"留空"}，不要任何其它文字。',
    quote: '你是一位英语学习助手。请给我一句经典英语名言（来自不同人物，避免重复）。严格只返回 JSON：{"en":"英文","cn":"中文翻译","by":"作者"},不要任何其它文字。'
  };

  let cat = 'long';
  let loading = false;
  let lastPoolLen = -1; // 上次渲染时池长度，用于"换一句"时判断追加

  function aiPool() {
    let d = {};
    try { d = JSON.parse(localStorage.getItem(AI_KEY) || '{}'); } catch (e) { }
    return d[cat] || [];
  }
  function savePool(arr) {
    let d = {};
    try { d = JSON.parse(localStorage.getItem(AI_KEY) || '{}'); } catch (e) { }
    d[cat] = arr;
    try { localStorage.setItem(AI_KEY, JSON.stringify(d)); } catch (e) { }
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
  function setEmptyState(msg, sub) {
    const el = document.getElementById('dailyText');
    const cn = document.getElementById('dailyCn');
    const au = document.getElementById('dailyAuthor');
    const src = document.getElementById('dailySrc');
    if (el) el.textContent = msg;
    if (cn) cn.textContent = sub || '';
    if (au) au.textContent = '';
    if (src) src.textContent = 'AI';
  }
  function renderItem(it) {
    const el = document.getElementById('dailyText');
    const cn = document.getElementById('dailyCn');
    const au = document.getElementById('dailyAuthor');
    const src = document.getElementById('dailySrc');
    if (!el) return;
    if (!it) return;
    el.textContent = it.en || '';
    cn.textContent = it.cn || '';
    au.textContent = it.by ? '— ' + it.by : '';
    if (src) src.textContent = 'AI';
  }
  function setLoading(on) {
    loading = on;
    const el = document.getElementById('dailyText');
    const cn = document.getElementById('dailyCn');
    const au = document.getElementById('dailyAuthor');
    const src = document.getElementById('dailySrc');
    const nb = document.getElementById('dailyNext');
    const sb = document.getElementById('dailySave');
    if (on) {
      if (el) el.textContent = 'AI 正在为你写一句…';
      if (cn) cn.textContent = '请稍候';
      if (au) au.textContent = '';
      if (src) src.textContent = '';
      if (nb) nb.disabled = true;
      if (sb) sb.disabled = true;
    } else {
      if (nb) nb.disabled = false;
      if (sb) sb.disabled = false;
    }
  }
  function toast(msg) {
    const t = document.getElementById('toast');
    const tt = document.getElementById('toastText');
    if (!t || !tt) return;
    tt.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 2200);
  }
  // 调用户 Key 生成一条新句，追加到池尾并渲染
  async function genAI() {
    if (loading) return;
    if (!window.LLM || !window.LLM.doChat) {
      setEmptyState('未配置 API Key', '请到「我的-模型设置」填 Key 后点「换一句」');
      toast('未找到 LLM 模块');
      return;
    }
    setLoading(true);
    const r = await window.LLM.doChat(PROMPTS[cat] || PROMPTS.long);
    setLoading(false);
    if (r.error || !r.text) {
      const msg = (r.error && /Key|key|未填/i.test(r.error))
        ? '未配置 API Key，请到「我的-模型设置」填 Key'
        : '生成失败：' + (r.error || '未知错误');
      toast(msg);
      if (!aiPool().length) setEmptyState('未配置 API Key', '请到「我的-模型设置」填 Key 后点「换一句」');
      return;
    }
    const j = extractJSON(r.text);
    if (!j || !j.en) {
      toast('AI 返回格式异常，请重试');
      if (!aiPool().length) setEmptyState('生成失败，请重试', '点击「换一句」再试一次');
      return;
    }
    const item = { en: String(j.en).trim(), cn: String(j.cn || '').trim(), by: String(j.by || '').trim(), ts: Date.now() };
    const pool = aiPool().concat(item);
    savePool(pool);
    lastPoolLen = pool.length;
    renderItem(item);
  }
  // 取池中最新一条渲染（池空则调 genAI 生成第一条）
  async function renderLatestOrGen() {
    const pool = aiPool();
    if (pool.length) { lastPoolLen = pool.length; renderItem(pool[pool.length - 1]); return; }
    // 池空：检测是否有 key，没有就显示引导
    try {
      const cfg = JSON.parse(localStorage.getItem('llm_cfg') || '{}');
      if (!cfg.key) { setEmptyState('未配置 API Key', '请到「我的-模型设置」填 Key 后点「换一句」'); return; }
    } catch (e) { }
    await genAI();
  }
  function next() {
    // "换一句" 永远生成一条新的并追加到池尾
    genAI();
  }
  function save() {
    const pool = aiPool();
    const it = pool[pool.length - 1];
    if (!it) { toast('暂无可收藏的句子'); return; }
    const st = window.Store;
    if (!st) return;
    const list = st.getVocab().slice();
    if (list.some(x => x.type === 'sentence' && x.text === it.en)) { toast('已收藏过'); return; }
    const item = { type: 'sentence', text: it.en, cn: it.cn || '', ts: Date.now() };
    st.saveVocab(list.concat(item));
    toast('已加入好词好句本');
  }
  function init() {
    const seg = document.getElementById('dailySeg');
    if (seg) {
      seg.querySelectorAll('button').forEach(b => {
        b.addEventListener('click', () => {
          if (loading) return;
          seg.querySelectorAll('button').forEach(x => x.classList.remove('on'));
          b.classList.add('on');
          cat = b.dataset.cat;
          renderLatestOrGen();
        });
      });
    }
    const nb = document.getElementById('dailyNext');
    if (nb) nb.addEventListener('click', next);
    const sv = document.getElementById('dailySave');
    if (sv) sv.addEventListener('click', save);
    renderLatestOrGen();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
