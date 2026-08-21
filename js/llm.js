// llm.js — 纯客户端大模型批改核心（BYOK：用户自带 Key，数据不出本机）
// 端口自 server.py：提示词构造、官方档位/描述符填充、JSON 提取、浏览器直连大模型。
// 评分标准数据直接复用 standards.js 的全局 STANDARDS（单一数据源，与 server.py 逐字一致）。
(function () {
  const DEFAULT_BASE = 'https://api.deepseek.com/chat/completions';

  // 读取「我的-模型设置」中保存的配置（localStorage.llm_cfg）
  function getLLMConfig() {
    let c = {};
    try { c = JSON.parse(localStorage.getItem('llm_cfg') || '{}'); } catch (e) { }
    const vendor = c.vendor || 'deepseek';
    const base = c.base || (vendor === 'custom' ? '' : DEFAULT_BASE);
    const model = c.model || 'deepseek-v4-flash';
    return { base, key: (c.key || '').trim(), model, models: [model] };
  }

  // 直连大模型（OpenAI 兼容格式）
  function callLLM(prompt, cfg) {
    if (!cfg || !cfg.key) return Promise.resolve({ text: null, error: '未填写 API Key（请在「我的-模型设置」填写）' });
    if (!cfg.base) return Promise.resolve({ text: null, error: '未配置模型接口地址（请在「我的-模型设置」选择服务商或填写自定义 Base）' });
    const model = cfg.model || (cfg.models && cfg.models[0]) || '';
    const body = JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], stream: false, temperature: 0.3 });
    return fetch(cfg.base, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + cfg.key, 'Content-Type': 'application/json' },
      body
    })
      .then(r => { if (!r.ok) return r.text().then(t => Promise.reject('HTTP ' + r.status + ': ' + t)); return r.json(); })
      .then(d => ({ text: (d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || null, error: null }))
      .catch(e => ({ text: null, error: String((e && e.message) ? e.message : e) }));
  }

  // 从模型输出稳健提取 JSON（兼容 ```json 包裹）
  function extractJSON(text) {
    if (!text) return null;
    text = text.trim();
    const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) text = m[1].trim();
    const s = text.indexOf('{'); const e = text.lastIndexOf('}');
    if (s >= 0 && e >= 0) { try { return JSON.parse(text.slice(s, e + 1)); } catch (_) { return null; } }
    return null;
  }

  // ---- 官方档位 / 描述符（复用 standards.js 的 STANDARDS） ----
  function levelKind(l) { return (STANDARDS[l] && STANDARDS[l].kind) || 'cet'; }
  function levelMax(l) { return (STANDARDS[l] && STANDARDS[l].max) || 15; }
  function officialFor(level, bandNum) {
    const meta = STANDARDS[level] || STANDARDS['CET4'];
    const table = meta.bands, source = meta.source;
    if (bandNum == null) return null;
    if (table[bandNum] != null) return { text: table[bandNum], source };
    const cands = Object.keys(table).map(Number).filter(b => b <= bandNum);
    if (cands.length) return { text: table[Math.max.apply(null, cands)], source };
    return { text: table[Math.min.apply(null, Object.keys(table).map(Number))], source };
  }
  function extractBandNum(band) {
    if (typeof band === 'number') return band;
    if (typeof band === 'string') { const m = band.match(/(\d+)/); return m ? parseInt(m[1], 10) : null; }
    return null;
  }
  const IELTS_OVERALL = {
    9: 'Band 9 Expert user', 8: 'Band 8 Very good user', 7: 'Band 7 Good user',
    6: 'Band 6 Competent user', 5: 'Band 5 Modest user', 4: 'Band 4 Limited user',
    3: 'Band 3 Extremely limited user', 2: 'Band 2 Intermittent user', 1: 'Band 1 Non user', 0: 'Band 0 Did not attempt the test'
  };
  function ieltsOverall(n) { return IELTS_OVERALL[n] || ''; }
  function ieltsDescriptor(dim, score) {
    const tbl = STANDARDS['雅思'] && STANDARDS['雅思'].dims[dim];
    if (!tbl) return '';
    let s; try { s = Math.round(Number(score)); } catch (e) { return ''; }
    return tbl[s] != null ? tbl[s] : '';
  }
  function buildBandText(level) {
    const meta = STANDARDS[level] || STANDARDS['CET4'];
    const table = meta.bands;
    return Object.keys(table).map(Number).sort((a, b) => b - a).map(b => '  ' + b + ' 档：' + table[b]).join('\n');
  }

  // ---- 提示词（与 server.py 逐字一致；{{ }} 已转为单括号，{x} 为占位符） ----
  const BAND_GRADE_PROMPT = `你是一位严格的英语考试作文阅卷专家。请按给定的考试标准，对这篇英文作文做逐句批改，并严格只返回一个 JSON 对象（不要任何额外文字、不要 markdown 代码块）。

考试标准：{levels}
题目 / Directions：{direction}

官方档次描述（请严格依据档位定级；score 取对应档位分数区间内的值）：
{bands}

作文：
{essay}

JSON 结构（字段必须齐全）：
{
  "exam": "主考试标准，如 CET-4 / 高中 / 考研英一A",
  "scoreType": "band",
  "score": 整数（按对应满分制：CET 满分 15；考研英一 20、英二 15；高中 25）,
  "maxScore": 对应满分,
  "band": 整数档位（CET 用 14/11/8/5/2/0；考研与高中用 5/4/3/2/1/0）,
  "officialDesc": "（系统会填为官方档位原文，你无需填写）",
  "officialSource": "（系统会填）",
  "translation": "整篇作文的中文翻译（一句不漏，忠实原文）",
  "sentences": [
    {"index": 1,
      "original": "原句",
      "corrected": "修改后完整句子（无错句与 original 一致）",
      "hasError": false,
      "severity": "none",
      "issues": [{"type": "语法：时态|语法：主谓一致|语法：冠词|语法：介词|语法：搭配|用词|拼写|逻辑|结构|抄写Directions", "note": "说明错误与修改理由", "severity": "major|minor"}],
      "sentenceTip": "即使无错也给出提升建议（更优连接词/句型/词汇），无则空字符串",
      "errorSpans": ["原句中确切的错误短语（将被红色波浪下划线标注），无错则为空数组"],
      "highlights": [{"text": "原句中确切的精彩短语", "reason": "好在哪（用词/句型/逻辑）"}]
    }
  ],
  "dimensions": [{"name": "切题", "comment": "..."}, {"name": "清楚", "comment": "..."}, {"name": "连贯", "comment": "..."}, {"name": "语言", "comment": "..."}],
  "problems": [{"severity": "warn|red", "text": "问题说明"}],
  "vocab": [{"old": "原词", "new": "升级词"}],
  "upgradePath": "升档建议（1-2 条，具体可操作）"
}

要求：
1. sentences 必须逐句覆盖整篇作文，按原文顺序编号；
2. errorSpans 必须是 original 中确切连续子串（用于红色波浪下划线+点击提示）；无错句 errorSpans 为空数组；
3. highlights 必须是 original 中确切连续子串（用于蓝色高亮好词好句），reason 说明好在哪；
4. hasError 为 true 时 issues 必填，severity 标 major/minor，type 用「大类：细分」；
5. 即使 hasError 为 false，也尽量给 sentenceTip 提升建议，无则空字符串；note 与 sentenceTip 务必精炼（各不超过 20 字）；
6. vocab 不超过 3 条，problems 只列重要问题（red/warn），最多 4 条；
7. 只输出 JSON，不要任何多余文字。`;

  const IELTS_GRADE_PROMPT = `你是一位 IELTS Writing Task 2 官方考官。请按雅思评分标准对这篇英文作文评分，并严格只返回一个 JSON 对象（不要任何额外文字、不要 markdown 代码块）。

题目 / Directions：{direction}

作文：
{essay}

JSON 结构（字段必须齐全）：
{
  "exam": "雅思 Task 2",
  "scoreType": "ielts",
  "overall": 0-9 之间的小数（四个维度得分的平均值，保留一位小数，如 6.5）,
  "dimensions": [
    {"name": "Task Response", "score": 0-9整数, "comment": "该维度评价（中文）"},
    {"name": "Coherence and Cohesion", "score": 0-9整数, "comment": "该维度评价（中文）"},
    {"name": "Lexical Resource", "score": 0-9整数, "comment": "该维度评价（中文）"},
    {"name": "Grammatical Range and Accuracy", "score": 0-9整数, "comment": "该维度评价（中文）"}
  ],
  "bandDescriptor": "（系统会填为官方整体档描述，你无需填写）",
  "officialSource": "（系统会填）",
  "translation": "整篇作文的中文翻译（一句不漏，忠实原文）",
  "sentences": [
    {"index": 1,
      "original": "原句",
      "corrected": "修改后完整句子（无错句与 original 一致）",
      "hasError": false,
      "severity": "none",
      "issues": [{"type": "语法|用词|逻辑|结构|拼写", "note": "说明问题", "severity": "major|minor"}],
      "sentenceTip": "提升建议，无则空字符串",
      "errorSpans": ["原句中确切的错误短语，无错为空数组"],
      "highlights": [{"text": "原句中确切的精彩短语", "reason": "好在哪"}]
    }
  ],
  "problems": [{"severity": "warn|red", "text": "问题说明"}],
  "vocab": [{"old": "原词", "new": "升级词"}],
  "upgradePath": "提分建议（1-2 条）"
}

要求：
1. 四个维度 score 为 0-9 整数；overall 为四者平均值，保留一位小数；
2. dimensions 的 name 必须严格为上述四个官方维度名（Task Response / Coherence and Cohesion / Lexical Resource / Grammatical Range and Accuracy），不得改写；不要返回 descriptor 字段（官方描述符由系统按分数查表填充，避免编造）；
3. sentences 逐句覆盖整篇，errorSpans/highlights 为 original 确切子串；note 与 sentenceTip 务必精炼（各不超过 20 字）；
4. vocab 不超过 3 条，problems 只列重要问题（red/warn），最多 4 条；
5. 只输出 JSON，不要任何多余文字。`;

  const GLOSS_PROMPT = `你是一位英语词典专家。请为下面的英文单词或短语提供释义，严格只返回一个 JSON 对象（不要 markdown 代码块、不要额外文字）。
单词：{word}

JSON 字段：word（原词，保持原样）、phonetic（音标，如 /kəˈmjuːnɪkeɪt/，未知则空字符串）、pos（词性缩写，如 n. / v. / adj. / phr.）、cn（准确简明的中文释义，1-3 个义项用分号分隔）、en（简明英文释义）、example（一个典型英文例句）、exampleCn（该例句的中文翻译）。
只输出 JSON。`;

  // ---- 对外能力 ----
  async function doGrade(text, levels, direction, cfg) {
    cfg = cfg || getLLMConfig();
    levels = levels || [];
    if (levels.some(l => l === '雅思')) {
      const prompt = IELTS_GRADE_PROMPT.replace('{direction}', direction || '（未提供）').replace('{essay}', text);
      let lastErr = null;
      for (const model of (cfg.models || [cfg.model])) {
        const r = await callLLM(prompt, Object.assign({}, cfg, { model }));
        if (r.text) {
          const data = extractJSON(r.text);
          if (data) {
            (data.dimensions || []).forEach(dim => { dim.descriptor = ieltsDescriptor(dim.name, dim.score); });
            let ovn; try { ovn = Math.round(Number(data.overall)); } catch (e) { ovn = null; }
            data.bandDescriptor = ovn != null ? ieltsOverall(ovn) : '';
            data.officialSource = (STANDARDS['雅思'] && STANDARDS['雅思'].source) || '';
            return { data, error: null };
          }
          lastErr = '模型未返回有效 JSON';
        } else lastErr = r.error;
      }
      return { data: null, error: lastErr };
    }
    // band 类（CET / 考研 / 高中）
    let primary = null;
    for (const l of levels) { if (['cet', 'postgrad', 'senior'].indexOf(levelKind(l)) >= 0) { primary = l; break; } }
    if (!primary) primary = levels[0] || 'CET4';
    const prompt = BAND_GRADE_PROMPT
      .replace('{levels}', levels.join('、') || '通用英语写作')
      .replace('{direction}', direction || '（未提供）')
      .replace('{essay}', text)
      .replace('{bands}', buildBandText(primary));
    let lastErr = null;
    for (const model of (cfg.models || [cfg.model])) {
      const r = await callLLM(prompt, Object.assign({}, cfg, { model }));
      if (r.text) {
        const data = extractJSON(r.text);
        if (data) {
          const bandNum = extractBandNum(data.band);
          const off = officialFor(primary, bandNum);
          if (off) { data.officialDesc = off.text; data.officialSource = off.source; }
          if (data.maxScore == null) data.maxScore = levelMax(primary);
          return { data, error: null };
        }
        lastErr = '模型未返回有效 JSON';
      } else lastErr = r.error;
    }
    return { data: null, error: lastErr };
  }

  async function doGloss(word, cfg) {
    cfg = cfg || getLLMConfig();
    if (!cfg.key) return { data: null, error: '未填写 API Key（请到「我的-模型设置」填写）' };
    const prompt = GLOSS_PROMPT.replace('{word}', word);
    let lastErr = null;
    for (const model of (cfg.models || [cfg.model])) {
      const r = await callLLM(prompt, Object.assign({}, cfg, { model }));
      if (r.text) { const data = extractJSON(r.text); if (data) { data.word = word; return { data, error: null }; } lastErr = '模型未返回有效 JSON'; }
      else lastErr = r.error;
    }
    return { data: null, error: lastErr };
  }

  async function doTranslate(text, cfg) {
    cfg = cfg || getLLMConfig();
    if (!cfg.key) return { text: null, error: '未填写 API Key' };
    const prompt = '请把下面的英文句子翻译成通顺自然的中文，只输出译文，不要任何其它内容：\n' + text;
    const r = await callLLM(prompt, cfg);
    if (r.text) return { text: r.text.trim(), error: null };
    return { text: null, error: r.error };
  }

  async function doTopicCheck(text, direction, cfg) {
    cfg = cfg || getLLMConfig();
    if (!cfg.key) return { relevant: 1.0 };
    const prompt = '你是作文阅卷助手。判断下面的作文是否切合题目/Directions。只返回一个 0 到 1 之间的数字（0=完全离题，1=高度切题），不要任何其它文字。\n\n题目/Directions：' + (direction || '').slice(0, 200) + '\n\n作文：' + (text || '').slice(0, 2000);
    try {
      const r = await callLLM(prompt, cfg);
      if (r.text) { const m = r.text.match(/0(\.\d+)?|\b1(\.0)?\b/); if (m) { const v = parseFloat(m[0]); return { relevant: Math.min(1, Math.max(0, v)) }; } }
    } catch (e) { }
    return { relevant: 1.0 };
  }

  // 通用对话（首页「每日一句」等轻量生成用）：返回 {text, error}
  function doChat(prompt) {
    return callLLM(prompt, getLLMConfig());
  }

  window.LLM = { getLLMConfig, doGrade, doGloss, doTranslate, doTopicCheck, doChat };
})();
