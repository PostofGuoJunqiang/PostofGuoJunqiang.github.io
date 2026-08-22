  // 以 file:// 直接打开时，相对路径接口必然不可用，提前提示
  if(location.protocol === 'file:'){
    setTimeout(()=>{
      try{
        const el = document.getElementById('toast');
        if(el){ el.textContent='请通过 http(s):// 访问本应用（部署后的域名，或本地 http://localhost:8765），不要直接双击打开 HTML 文件，否则批改接口不可用'; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),4000); }
      }catch(e){}
    }, 800);
  }
  const BATTERY = '<svg class="battery" viewBox="0 0 22 12" fill="none"><rect x="1" y="1" width="18" height="10" rx="3" stroke="#111" stroke-width="1.5"/><rect x="3" y="3" width="11" height="6" rx="1.5" fill="#111"/><rect x="20" y="4" width="1.5" height="4" rx="0.75" fill="#111"/></svg>';
  const ICONS = {
    home:'<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5L11 3l8 7.5"/><path d="M5.5 9.5V19h11V9.5"/></svg>',
    review:'<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4.5l3 3L8 17l-4 1 1-4z"/><path d="M13 6l3 3"/></svg>',
    history:'<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7.5"/><path d="M11 7v4l3 2"/></svg>',
    mine:'<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="7.5" r="3.5"/><path d="M4.5 19c0-3.6 3-6 6.5-6s6.5 2.4 6.5 6"/></svg>',
    vocab:'<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5h10v15l-5-3.5-5 3.5z"/></svg>'
  };
  const TABS = [['home','首页'],['review','批改'],['history','历史'],['vocab','积累'],['mine','我的']];
  const screens = {};
  document.querySelectorAll('.screen').forEach(s=>{
    const active = s.dataset.active;
    screens[active] = s;
    const sb = document.createElement('div');
    sb.className = 'statusbar';
    sb.innerHTML = '<span class="time">9:41</span>' + BATTERY;
    s.prepend(sb);
    const tb = document.createElement('nav');
    tb.className = 'tabbar';
    const tabsHtml = TABS.map(([id,label])=>
      `<button class="tab ${id===active?'active':''}" data-go="${id}">${ICONS[id]}<span>${label}</span></button>`
    ).join('');
    tb.innerHTML = `<div class="tabpill">${tabsHtml}</div><div class="home-indicator"></div>`;
    s.append(tb);
  });

  // ===== 桌面工作台侧边栏（移动端由 CSS 隐藏）=====
  const SIDEBAR = document.createElement('aside');
  SIDEBAR.className = 'wb-sidebar';
  const _cfg = loadLlmCfg();
  const _keySet = (_cfg && _cfg.key) ? '已配置你的 API Key' : '未配置 Key（走服务端默认）';
  function updateModelTip(){
    const tip = document.querySelector('.wb-model-tip');
    if (!tip) return;
    const c = loadLlmCfg();
    tip.textContent = '模型设置：' + ((c && c.key) ? '已配置你的 API Key' : '未配置 Key（走服务端默认）');
  }
  SIDEBAR.innerHTML = `
    <div class="wb-brand"><div class="wb-logo">批</div><div><div class="wb-name">批改台</div><div class="wb-sub">英语作文智能批改</div></div></div>
    <nav class="wb-nav">
      ${TABS.map(([id,label])=>`<button class="wb-nav-item ${id==='home'?'active':''}" data-go="${id}">${ICONS[id]}<span>${label}</span></button>`).join('')}
    </nav>
    <div class="wb-side-foot">
      <div class="wb-model-tip">模型设置：${_keySet}</div>
      <button class="wb-install" id="wbInstall" hidden>＋ 安装到桌面</button>
    </div>`;
  document.querySelector('.phone') ? document.querySelector('.phone').prepend(SIDEBAR) : document.body.prepend(SIDEBAR);
  SIDEBAR.querySelectorAll('.wb-nav-item').forEach(b=>{
    b.addEventListener('click', ()=>{ const id=TAB_TARGET[b.dataset.go]; showScreen(id); if(id==='s-vocab') renderVocab(); });
  });

  function showScreen(id){
    const target = document.getElementById(id);
    if(!target) return;
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('show'));
    target.classList.add('show');
    const act = target.dataset.active;
    document.querySelectorAll('.tabbar').forEach(bar=>{
      bar.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active', x.dataset.go===act));
    });
    document.querySelectorAll('.wb-nav-item').forEach(x=>x.classList.toggle('active', x.dataset.go===act));
    if(id==='s-history') refreshTasks();
    if(id==='s-home') renderRecent();
  }
  const TAB_TARGET = { home:'s-home', review:'s-new', history:'s-history', vocab:'s-vocab', mine:'s-mine' };

  // Tab 切换
  document.querySelectorAll('.tab').forEach(t=>{
    t.addEventListener('click',()=>{ const id=TAB_TARGET[t.dataset.go]; showScreen(id); if(id==='s-vocab') renderVocab(); });
  });

  // 考试标准：单选下拉（决定评分依据与目标字数）；题目提示随考试类型动态
  const levelSelect = document.getElementById('levelSelect');
  const dirHint = document.getElementById('dirHint');
  function updateDirHint(){
    if(!dirHint) return;
    const v = levelSelect.value;
    dirHint.textContent = (v && v.indexOf('考研')===0)
      ? '题目 / Directions（考研A节必填）'
      : '题目 / Directions（选填，填写可提升离题批改准确率）';
  }
  levelSelect.addEventListener('change', ()=>{ updateCount(); updateDirHint(); });
  updateDirHint();

  // 字数统计（含考试目标字数达标提醒）
  const essayInput = document.getElementById('essayInput');
  const wordCount = document.getElementById('wordCount');
  const wordTarget = document.getElementById('wordTarget');
  const WORD_RANGES = {
    'CET4':[120,180],'CET6':[150,200],'考研英一A':[160,200],'考研英一B':[150,200],
    '考研英二A':[150,180],'考研英二B':[100,180],'高中':[100,120],'雅思':[250,280]
  };
  function currentWordRange(){
    const lv = levelSelect ? levelSelect.value : 'CET4';
    return WORD_RANGES[lv] || [100,200];
  }
  function updateCount(){
    const t = essayInput.value.trim();
    const n = t ? t.split(/\s+/).length : 0;
    wordCount.textContent = n + ' 词';
    const r = currentWordRange();
    if(wordTarget) wordTarget.textContent = '目标 ' + r[0] + '–' + r[1] + ' 词';
    wordCount.classList.remove('low','ok','high');
    if(n>0){
      if(n < r[0]) wordCount.classList.add('low');
      else if(n > r[1]) wordCount.classList.add('high');
      else wordCount.classList.add('ok');
    }
  }
  essayInput.addEventListener('input', updateCount);
  updateCount();

  // 工具
  function esc(s){
    return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function showLoading(b){ document.getElementById('loading').style.display = b ? 'flex' : 'none'; }
  // ===== 模型设置（BYOK）：使用者自带 API Key，各自承担额度，不暴露他人 Key =====
  const LLM_KEY = 'llm_cfg';
  function loadLlmCfg(){
    try{
      const c = JSON.parse(localStorage.getItem(LLM_KEY) || '{}');
      return { vendor: c.vendor || 'deepseek', key: c.key || '', base: c.base || '', model: c.model || '' };
    }catch(e){ return { vendor: 'deepseek', key: '', base: '', model: '' }; }
  }
  const llmCfg = loadLlmCfg();
  function saveLlmCfg(){ localStorage.setItem(LLM_KEY, JSON.stringify(llmCfg)); }
  (function initLlmSettings(){
    const saveBtn = document.getElementById('llmSave');
    if(!saveBtn) return;
    const vendorSeg = document.getElementById('llmVendor');
    const keyInput = document.getElementById('llmKey');
    const baseInput = document.getElementById('llmBase');
    const modelInput = document.getElementById('llmModel');
    const customWrap = document.getElementById('llmCustom');
    keyInput.value = llmCfg.key;
    baseInput.value = llmCfg.base;
    modelInput.value = llmCfg.model;
    const applyVendor = () => {
      vendorSeg.querySelectorAll('button').forEach(b=>b.classList.toggle('on', b.dataset.vendor === llmCfg.vendor));
      customWrap.hidden = llmCfg.vendor !== 'custom';
    };
    vendorSeg.querySelectorAll('button').forEach(b=>{
      b.addEventListener('click', ()=>{ llmCfg.vendor = b.dataset.vendor; applyVendor(); });
    });
    saveBtn.addEventListener('click', ()=>{
      llmCfg.key = keyInput.value.trim();
      if(llmCfg.key && !/^sk-/.test(llmCfg.key)){
        keyInput.classList.add('llm-invalid');
        keyInput.focus();
        showToast('API Key 格式不正确（应以 sk- 开头）');
        return;
      }
      keyInput.classList.remove('llm-invalid');
      if(llmCfg.vendor === 'custom'){
        llmCfg.base = baseInput.value.trim();
        llmCfg.model = modelInput.value.trim();
      } else {
        llmCfg.base = 'https://api.deepseek.com/chat/completions';
        llmCfg.model = modelInput.value.trim() || 'deepseek-v4-flash';
      }
      saveLlmCfg();
      showToast('模型设置已保存');
      updateModelTip();
    });
    applyVendor();
  })();

  // 统一给 /api/* 请求附加 BYOK 配置头（API key 仅存本浏览器，不随包分发）
  const _origFetch = window.fetch ? window.fetch.bind(window) : ((url, opts) => Promise.reject(new Error('当前环境不支持 fetch')));
  window.fetch = (url, opts) => {
    opts = opts || {};
    const headers = Object.assign({}, opts.headers || {});
    const isApi = String(url).indexOf('/api/') === 0;
    if(isApi && llmCfg.key){ headers['X-LLM-Key'] = llmCfg.key; }
    if(isApi && llmCfg.base){ headers['X-LLM-Base'] = llmCfg.base; }
    if(isApi && llmCfg.model){ headers['X-LLM-Model'] = llmCfg.model; }
    if(opts.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    return _origFetch(url, Object.assign({}, opts, { headers }));
  };

  let lastResult = null;
  let lastLevels = [];
  const LEVEL_KIND = {"CET4":"cet","CET6":"cet","考研英一A":"postgrad","考研英一B":"postgrad","考研英二A":"postgrad","考研英二B":"postgrad","高中":"senior","雅思":"ielts"};

  // ===== 轻提示 / 加载文案 =====
  function setLoadingText(t){ const el=document.querySelector('#loading .loading-text'); if(el) el.textContent=t; }
  let toastTimer=null;
  function showToast(msg){ showToastAction(msg, null); }
  // 带操作按钮的 toast（如收藏成功 → 查看）
  function showToastAction(msg, actionText, fn){
    const el=document.getElementById('toast'); if(!el) return;
    document.getElementById('toastText').textContent=msg;
    const act=document.getElementById('toastAction');
    if(actionText && fn){ act.textContent=actionText; act.hidden=false; act.onclick=fn; }
    else { act.hidden=true; }
    el.classList.add('show');
    clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2200);
  }

  // 通用居中确认弹窗：showConfirm({title, body, confirmText, cancelText, onConfirm, onCancel})
  function showConfirm(opts){
    const mask=document.getElementById('modalMask');
    if(!mask) return;
    document.getElementById('modalTitle').textContent = opts.title || '提示';
    document.getElementById('modalBody').innerHTML = opts.body || '';
    document.getElementById('modalConfirm').textContent = opts.confirmText || '确定';
    document.getElementById('modalCancel').textContent = opts.cancelText || '取消';
    const close=()=>{ mask.hidden=true; };
    const onC=opts.onConfirm||close, onX=opts.onCancel||close;
    document.getElementById('modalConfirm').onclick=()=>{ close(); onC(); };
    document.getElementById('modalCancel').onclick=()=>{ close(); onX(); };
    mask.hidden=false;
  }

  // 批改失败：优雅提示 + 重试
  function renderGradeError(msg){
    lastResult=null;
    document.getElementById('resultBody').innerHTML=`
      <div class="card" style="gap:14px;align-items:center;text-align:center">
        <div style="font-size:30px">⚠️</div>
        <div class="card-title">批改暂不可用</div>
        <div class="desc">${esc(msg)}</div>
        <div class="desc" style="color:var(--ink-3)">逐句批改需调用大模型接口，请确认网络与额度后重试。</div>
        <button class="cta-primary" id="retryGrade" style="width:160px;margin-top:4px">重试</button>
      </div>`;
    document.getElementById('retryGrade').addEventListener('click',()=>{ showScreen('s-new'); doGrade(); });
    showScreen('s-result');
  }

  // P0 前置校验①：API Key 预校验（格式非法 → 拦截引导去设置；未填 → 确认走服务端默认，不硬拦）
  function ensureKeyOk(){
    const key = (llmCfg.key||'').trim();
    if(key && !/^sk-/.test(key)){
      return new Promise(res=>{
        showConfirm({ title:'未配置有效的API Key', body:'请先到「我的-模型设置」填写正确的 DeepSeek 密钥（sk- 开头），再提交批改。', confirmText:'去设置', cancelText:'取消',
          onConfirm:()=>{ showScreen('s-mine'); res(false); }, onCancel:()=>res(false) });
      });
    }
    if(!key){
      return new Promise(res=>{
        showConfirm({ title:'未填写 API Key', body:'本应用为纯本地运行，需你自己的大模型 API Key 才能批改。请到「我的-模型设置」填写（Key 仅存你本机，不会上传）。', confirmText:'去设置', cancelText:'取消',
          onConfirm:()=>{ showScreen('s-mine'); res(false); }, onCancel:()=>res(false) });
      });
    }
    return Promise.resolve(true);
  }
  // P0 前置校验②：题目-内容错配提醒（仅填了题目时触发；接口失败默认放行）
  async function topicCheckOk(text, direction){
    try{
      setLoadingText('正在检查作文与题目的匹配度…');
      const d = await LLM.doTopicCheck(text, direction);
      if(d && typeof d.relevant === 'number' && d.relevant < 0.4){
        return new Promise(resolve=>{
          showConfirm({ title:'内容可能离题', body:'检测到你的作文内容和题目要求关联度较低，确认提交批改吗？', confirmText:'仍然提交', cancelText:'返回修改',
            onConfirm:()=>resolve(true), onCancel:()=>resolve(false) });
        });
      }
      return true;
    }catch(e){ return true; }
  }

  // 真实批改：前置校验 → 提交异步任务（后台批改，完成后在历史中查看）
  async function doGrade(){
    let text = essayInput.value.trim();
    const levels = [levelSelect.value];
    lastLevels = [levelSelect.value];
    const direction = document.getElementById('dirInput').value.trim();

    if(!text){ alert('请先输入作文内容'); return; }
    if(!await ensureKeyOk()) return;
    if(direction && !await topicCheckOk(text, direction)) return;

    showLoading(true);
    try{
      setLoadingText('正在提交批改任务…');
      // 首次运行时让用户选择本地存档文件夹（桌面端写成 JSON 文件）
      if(!Store.isFileMode() && window.showDirectoryPicker){
        try{ await Store.ensureFolder(); }catch(e){}
      }
      const taskId = Store.newTaskId();
      const task = { taskId, status:'pending', text, levels, direction, created_at: Date.now()/1000, updated_at: Date.now()/1000 };
      Store.addTask(task);
      refreshTasks(); renderRecent();
      showScreen('s-history');
      startPolling();
      showLoading(false);
      // 后台直连大模型批改（数据不出本机）
      (async ()=>{
        const r = await LLM.doGrade(text, levels, direction);
        if(r.error || !r.data){ task.status='failed'; task.error = r.error || '批改失败'; }
        else { task.status='done'; task.result = r.data; }
        task.updated_at = Date.now()/1000;
        Store.updateTask(task);
        refreshTasks(); renderRecent();
      })();
    }catch(e){
      showLoading(false);
      const emsg = String(e.message || e || '');
      let msg = '异常：' + emsg;
      if(/Failed to fetch|NetworkError|ERR_CONNECTION|ECONNREFUSED|fetch failed|Network request failed|Access-Control|CORS|blocked by CORS/i.test(emsg)){
        msg = '无法连接大模型接口：请确认「模型设置」中的接口地址与 Key 正确，且该接口允许浏览器跨域（CORS）；部分厂商需经服务端代理转发。';
      }
      renderGradeError(msg);
    }
  }
  document.getElementById('gradeBtn').addEventListener('click', doGrade);

  // ===== 批改任务列表（异步：提交即返回，后台批改，历史查看）=====
  let lastTaskId = null;
  let pollTimer = null;
  function fmtTaskTime(ts){
    if(!ts) return '';
    const d = new Date(ts*1000);
    const p = n => String(n).padStart(2,'0');
    return (d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes());
  }
  // 后端错误 → 面向学生的友好文案（技术细节折叠展示）
  function friendlyError(err){
    const s = String(err || '');
    if(/401|authentication|api[ -]?key|invalid/i.test(s)) return '批改失败：API 密钥无效，请到「我的-模型设置」检查';
    if(/429|insufficient|余额|limit/i.test(s)) return '批改失败：请求频率过高或额度不足，请稍后再试';
    if(/timeout|timed ?out|ETIMEDOUT/i.test(s)) return '批改超时，请点「重新批改」再试';
    if(/network|connection|fetch/i.test(s)) return '网络连接异常，请确认服务已启动';
    return '批改失败，请稍后重试';
  }
  function isKeyError(err){ return /401|authentication|api[ -]?key|invalid/i.test(String(err||'')); }
  // 历史任务预览：有题目显示题目（截断），无题目显示作文首句
  function taskPreview(t){
    const src = ((t.direction||'').trim() || (t.text||'').trim()).replace(/\s+/g,' ');
    if(!src) return '';
    return src.length > 34 ? src.slice(0,34)+'…' : src;
  }
  function renderTaskList(list){
    const box = document.getElementById('taskList');
    const empty = document.getElementById('taskEmpty');
    const arr = (list||[]).slice();
    if(!arr.length){ box.innerHTML=''; if(empty) empty.hidden=false; return; }
    if(empty) empty.hidden=true;
    box.innerHTML = arr.map(t=>{
      const st = t.status;
      let stateHtml='', cls='', extra='';
      if(st==='pending'||st==='running'){
        stateHtml = '<div class="task-state running">批改中…</div>';
        cls='running';
      } else if(st==='done'){
        const r = t.result||{};
        const scoreTxt = r.scoreType==='ielts'
          ? ((r.overall??'-')+' / 9')
          : ((r.score??'-')+' / '+(r.maxScore??'-'));
        stateHtml = `<div class="task-state done">已完成 <b>${esc(scoreTxt)}</b></div>`;
      } else {
        const setBtn = isKeyError(t.error) ? `<button class="task-retry ghost" data-go-set="1">去设置</button>` : '';
        extra = `<div class="task-fail-box">
          <div class="task-state failed">${esc(friendlyError(t.error))}</div>
          <div class="task-fail-actions">
            <button class="task-retry" data-task="${esc(t.taskId)}">重新批改</button>
            ${setBtn}
            <details class="task-detail"><summary>技术详情</summary><div class="task-detail-body">${esc(t.error||'')}</div></details>
          </div>
        </div>`;
      }
      const lv = (t.levels||[]).filter(x=>x!=='全部（跨考试对比）').join('、') || '通用';
      const pv = taskPreview(t);
      return `<div class="history-card task-card ${cls}" data-task="${esc(t.taskId)}">
        <div class="hc-left">
          <div class="chip-label">${esc(lv)}</div>
          <div class="hc-meta">#${esc(t.taskId)} · ${fmtTaskTime(t.created_at)}</div>
          ${pv ? `<div class="hc-preview">${esc(pv)}</div>` : ''}
        </div>
        <div class="hc-right">${stateHtml}</div>
        ${extra}
      </div>`;
    }).join('');
    box.innerHTML = '<div class="list-card">' + box.innerHTML + '</div>';
  }
  async function refreshTasks(){
    try{
      const list = Store.getHistory();
      renderTaskList(list);
      return list;
    }catch(e){ return []; }
  }
  function startPolling(){
    if(pollTimer) return;
    pollTimer = setInterval(async ()=>{
      const list = await refreshTasks();
      const hasActive = (list||[]).some(t=>t.status==='pending'||t.status==='running');
      if(!hasActive && pollTimer){ clearInterval(pollTimer); pollTimer=null; }
    }, 3000);
  }
  // 历史任务点击：已完成 → 查看结果；「重新批改」→ 用原文重提任务
  document.getElementById('taskList').addEventListener('click', async (e)=>{
    if(e.target.closest('[data-go-set]')){ showScreen('s-mine'); return; }
    const retry = e.target.closest('.task-retry');
    if(retry){
      const tid = retry.dataset.task;
      const list = await refreshTasks();
      const t = (list||[]).find(x=>x.taskId===tid);
      if(!t || !t.text){ showToast('无法重试：缺少原文'); return; }
      showToast('正在重新批改…');
      startPolling();
      (async ()=>{
        try{
          const r = await LLM.doGrade(t.text, t.levels||[], t.direction||'');
          if(r.error || !r.data){ t.status='failed'; t.error = r.error || '批改失败'; }
          else { t.status='done'; t.result = r.data; }
        }catch(e2){ t.status='failed'; t.error = String((e2&&e2.message)||e2); }
        t.updated_at = Date.now()/1000;
        Store.updateTask(t); refreshTasks(); renderRecent();
      })();
      return;
    }
    const card = e.target.closest('.task-card');
    if(!card) return;
    const list = await refreshTasks();
    const t = (list||[]).find(x=>x.taskId===card.dataset.task);
    if(!t) return;
    if(t.status!=='done' || !t.result){ showToast(t.error?friendlyError(t.error):'任务尚未完成，请稍候'); return; }
    lastResult = t.result;
    lastTaskId = t.taskId;
    renderResult(t.result);
    showScreen('s-result');
  });

  // 渲染：批改结果屏（双视图：阅读视图 / 逐句卡片）
  let viewMode = 'reading';
  // 低分行动指引（0 分/0 档时提示补充内容，目标字数随考试动态）
  function lowScoreHint(d){
    const score = d.scoreType==='ielts' ? Number(d.overall) : Number(d.score);
    if(score === 0 || Number(d.band) === 0){
      const min = currentWordRange()[0];
      return `<div class="low-tip">💡 你的作文内容过短/完全离题，请补充符合题目要求的完整内容后重试，当前考试要求至少 ${min} 词</div>`;
    }
    return '';
  }
  function renderResult(d){
    const isIelts = d.scoreType === 'ielts';
    let scoreCard;
    if(isIelts){
      const dims = (d.dimensions||[]).map(x=>{
        const s = Number(x.score)||0;
        const desc = x.descriptor ? `<div class="desc" style="font-size:12px;color:var(--ink-3);margin-top:2px;line-height:18px">${esc(x.descriptor)}</div>` : '';
        const q = `<span class="info-btn tiny" data-std-level="雅思" data-std-dim="${esc(x.name)}" title="查看该维度官方标准">?</span>`;
        return `<div class="dim4-row" style="flex-wrap:wrap"><div class="dim4-name">${esc(x.name)}</div><div class="dim4-bar"><div class="dim4-fill" style="width:${Math.max(0,Math.min(100,s/9*100))}%"></div></div><div class="dim4-score">${s}</div>${q}</div>${desc}`;
      }).join('');
      scoreCard = `<div class="score-card" style="flex-direction:column;align-items:stretch;gap:14px">
        <button class="info-btn" data-std-level="雅思" title="查看雅思官方评分标准">?</button>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div style="display:flex;flex-direction:column;gap:4px"><div class="sc-tag">${esc(d.exam||'雅思 Task 2')}</div><div class="sc-band">${esc(d.bandDescriptor||'')}</div></div>
          <div style="text-align:right"><div class="sc-cap">Overall</div><div class="sc-conv" style="font-size:34px">${esc(d.overall)}</div></div>
        </div>
        <div class="dim4">${dims}</div>
        <div class="source">来源：${esc(d.officialSource)}（IELTS Writing Task 2 Band Descriptors, Public Version）</div>
      </div>`;
    } else {
      const max = Number(d.maxScore)||15;
      const conv = (Number(d.score)||0)/max*100;
      scoreCard = `<div class="score-card">
        <button class="info-btn" data-std-level="${esc(stdLevelFor(d))}" title="查看官方评分标准">?</button>
        <div class="sc-left"><div class="sc-tag">${esc(d.exam||'CET-4')}</div><div class="sc-score">${esc(d.score)}/${max}</div><div class="sc-band">${esc(d.band)} 档</div></div>
        <div class="sc-right"><div class="sc-cap">折合满分100</div><div class="sc-conv">${isFinite(conv)?conv.toFixed(1):'--'}</div></div>
      </div>
      <div class="card" style="gap:8px"><div class="card-title">官方档次描述</div><div class="desc">${esc(d.officialDesc)}</div><div class="source">来源：${esc(d.officialSource)}</div></div>`;
    }
    const toggle = `<div class="seg" id="viewSeg" style="margin:2px 0 12px"><button class="${viewMode==='reading'?'on':''}" data-view="reading">阅读视图</button><button class="${viewMode==='sentences'?'on':''}" data-view="sentences">逐句卡片</button></div>`;
    const content = viewMode==='reading' ? buildReadingView(d) : buildSentencesView(d);
    const cb = d.scoreType==='ielts' ? null : d.band;
    const stdSection = buildStandardSection(stdLevelFor(d), null, cb);
    document.getElementById('resultBody').innerHTML = scoreCard + lowScoreHint(d) + stdSection + toggle + content;
    if(viewMode==='reading'){
      const r = document.getElementById('reading'); if(r) r.addEventListener('click', onReadingClick);
      const th = document.getElementById('transHead');
      if(th) th.addEventListener('click', ()=>document.getElementById('transCard').classList.toggle('open'));
    } else {
      const sl = document.getElementById('sentListView'); if(sl) sl.addEventListener('click', onSentencesClick);
    }
    const vs = document.getElementById('viewSeg');
    if(vs) vs.addEventListener('click', e=>{ const b=e.target.closest('button'); if(!b) return; viewMode=b.dataset.view; renderResult(d); });
  }
  function buildReadingView(d){
    const reading = (d.sentences||[]).map(s=>
      `<p data-i="${esc(s.index)}">${renderSentenceText(s)}<span class="sent-collect" data-i="${esc(s.index)}" title="收藏此句">☆</span></p>`
    ).join('');
    const trans = d.translation
      ? `<div class="trans-card open" id="transCard"><div class="trans-head" id="transHead"><span class="section-title">全文翻译</span><span class="chev">▾</span></div><div class="trans-body">${esc(d.translation)}</div></div>`
      : '';
    return `<div class="card" style="gap:6px"><div class="card-title">原文精读</div><div class="sub">红色波浪线＝点击看修改；蓝色＝好词好句；点任意单词＝查词/朗读/收藏</div></div>
      <div class="reading" id="reading">${reading}</div>
      ${trans}
      <div class="path-card"><div class="card-title">升档路径</div><div class="desc" style="color:var(--ink-2)">${esc(d.upgradePath)}</div></div>`;
  }
  // 逐句卡片视图：多句时提供「上一句/下一句」快速切换
  let sentPos = 1;
  function buildSentencesView(d){
    const sents = (d.sentences||[]).map(s=>{
      const issues=(s.issues||[]).map(i=>{
        const sev=i.severity==='major'?'major':(i.severity==='minor'?'minor':'');
        return `<div class="sent-issue"><span class="issue-tag ${sev}">${esc(i.type)}</span><span>${esc(i.note)}</span></div>`;
      }).join('');
      const tip=(!s.hasError && s.sentenceTip)?`<div class="sent-tip"><span class="tip-label">升级</span><span>${esc(s.sentenceTip)}</span></div>`:'';
      return `<div class="sent-card" data-i="${esc(s.index)}">
        <div class="sent-head"><span class="sent-idx">${esc(s.index)}</span>${s.hasError?'<span class="sent-flag bad">需修改</span>':'<span class="sent-flag ok">正确</span>'}
        <span class="sent-collect" data-i="${esc(s.index)}" title="收藏此句">☆</span></div>
        <div class="sent-orig">${esc(s.original)}</div>
        ${s.hasError?`<div class="sent-fix"><span class="fix-label">修改</span>${esc(s.corrected)}</div>`:''}
        ${issues}${tip}
      </div>`;
    }).join('');
    const len = (d.sentences||[]).length;
    if(sentPos < 1 || sentPos > len) sentPos = 1;
    const nav = len > 1 ? `<div class="sent-nav">
      <button class="sent-nav-btn" data-dir="-1">‹ 上一句</button>
      <span class="sent-nav-idx">${sentPos} / ${len}</span>
      <button class="sent-nav-btn" data-dir="1">下一句 ›</button>
    </div>` : '';
    return `<div class="card sent-block" style="gap:10px"><div class="card-title">逐句批改（共 ${len} 句）</div>${nav}<div class="sent-list" id="sentList">${sents}</div></div>`;
  }

  // 把一句原文渲染为带内联标注的 HTML（红错词 / 蓝好词 / 可点单词）
  function renderSentenceText(s){
    const orig = s.original || '';
    const errs = (s.errorSpans||[]).filter(Boolean);
    const goods = (s.highlights||[]).filter(h=>h && h.text);
    const marks = [];
    errs.forEach(t=>{ const i=orig.indexOf(t); if(i>=0) marks.push({type:'err',text:t,start:i,end:i+t.length}); });
    goods.forEach(h=>{ const i=orig.indexOf(h.text); if(i>=0) marks.push({type:'good',text:h.text,reason:h.reason,start:i,end:i+h.text.length}); });
    marks.sort((a,b)=>a.start-b.start);
    const kept=[]; let lastEnd=-1;
    marks.forEach(m=>{ if(m.start>=lastEnd){ kept.push(m); lastEnd=m.end; } });
    if(!kept.length) return wrapWords(orig);
    const ph=[]; let parts=[]; let cursor=0;
    kept.forEach((m,i)=>{
      if(m.start>cursor) parts.push(wrapWords(orig.slice(cursor,m.start)));
      const token='\u0001'+i+'\u0001'; parts.push(token); ph[i]=m; cursor=m.end;
    });
    if(cursor<orig.length) parts.push(wrapWords(orig.slice(cursor)));
    let html = parts.join('');
    ph.forEach((m,i)=>{
      const token='\u0001'+i+'\u0001';
      if(m.type==='err') html = html.split(token).join(`<span class="err-mark" data-i="${esc(s.index)}">${esc(m.text)}</span>`);
      else html = html.split(token).join(`<span class="good-mark" title="${esc(m.reason||'')}">${esc(m.text)}</span>`);
    });
    return html;
  }
  function wrapWords(text){
    return text.split(/(\s+)/).map(tok=>{
      if(/^\s+$/.test(tok)) return tok;
      const key = tok.replace(/^[^A-Za-z']+|[^A-Za-z']+$/g,'').toLowerCase();
      if(!key) return esc(tok);
      return `<span class="w" data-w="${esc(key)}">${esc(tok)}</span>`;
    }).join('');
  }
  function onReadingClick(e){
    const sc = e.target.closest('.sent-collect');
    if(sc){ collectSentence(sc.dataset.i); return; }
    const err = e.target.closest('.err-mark');
    if(err){ showErrorSheet(err.dataset.i); return; }
    const good = e.target.closest('.good-mark');
    if(good){ const t=good.getAttribute('title'); if(t) showToast(t); return; }
    const w = e.target.closest('.w');
    if(w){ showWordSheet(w.dataset.w); }
  }
  function onSentencesClick(e){
    const sc = e.target.closest('.sent-collect');
    if(sc){ collectSentence(sc.dataset.i); return; }
    const nav = e.target.closest('.sent-nav-btn');
    if(nav){
      const dir = Number(nav.dataset.dir)||0;
      const cards = Array.from(document.querySelectorAll('#sentList .sent-card'));
      if(cards.length){ sentPos = Math.min(cards.length, Math.max(1, sentPos + dir)); }
      document.querySelector('.sent-nav-idx').textContent = sentPos + ' / ' + cards.length;
      const target = cards[sentPos-1];
      if(target){ target.scrollIntoView({behavior:'smooth', block:'center'}); }
      return;
    }
    const card = e.target.closest('.sent-card');
    if(card){ showErrorSheet(card.dataset.i); }
  }

  // ===== 评分标准（页内可折叠区块，数据已内置 STANDARDS，零网络依赖）=====
  function stdLevelFor(d){
    if(d.scoreType === 'ielts') return '雅思';
    if(lastLevels && lastLevels.length){
      const concrete = lastLevels.filter(l=>LEVEL_KIND[l]);
      if(concrete.length) return concrete[0];
    }
    const ex = (d.exam||'');
    if(ex.indexOf('高中') >= 0) return '高中';
    if(ex.indexOf('考研') >= 0) return '考研英一A';
    return 'CET4';
  }
  // 渲染一个可折叠的官方评分标准区块（默认收起，点击 header 展开）；currentBand 用于高亮当前档位
  function buildStandardSection(level, dimension, currentBand){
    const S = STANDARDS[level];
    if(!S) return '';
    let body;
    if(S.kind === 'ielts'){
      body = `<div class="std-note-i">Task 2 四个维度（Task Response / Coherence and Cohesion / Lexical Resource / Grammatical Range and Accuracy）各自 0–9 分、等权重（各 25%），平均后四舍五入至最近半分；Task 2 在写作总分中权重为 Task 1 的两倍。</div>` +
        Object.keys(S.dims).map(dn=>{
          const table = S.dims[dn];
          const rows = Object.keys(table).sort((a,b)=>b-a).map(b=>`<div class="std-row"><div class="std-band">Band ${b}</div><div class="std-text">${esc(table[b])}</div></div>`).join('');
          const flash = (dimension === dn) ? ' flash' : '';
          return `<div class="std-dim${flash}" data-dim="${esc(dn)}"><div class="std-dim-name">${esc(dn)}</div>${rows}</div>`;
        }).join('');
    } else {
      const isCet = S.kind === 'cet';
      const RANGES = {14:'13-15',11:'10-12',8:'7-9',5:'4-6',0:'0'};
      const rows = Object.keys(S.bands).sort((a,b)=>b-a).map(b=>{
        const hl = (currentBand!=null && Number(b)===Number(currentBand)) ? ' highlight' : '';
        const range = isCet ? ` <span class="std-range">（${RANGES[b]||'0'}分）</span>` : '';
        return `<div class="std-row${hl}"><div class="std-band">${b} 档${range}</div><div class="std-text">${esc(S.bands[b])}</div></div>`;
      }).join('');
      body = `<div class="std-sub">满分 ${S.max} 分，分档评分</div>` + rows;
    }
    const header = `<div class="std-head"><div class="std-head-t"><span class="q">?</span><span class="std-title">官方评分标准</span></div><span class="std-chev">▾</span></div>`;
    const bodyWrap = `<div class="std-body"><div class="std-source">来源：${esc(S.source)}</div>${body}</div>`;
    return `<div class="std-section">${header}${bodyWrap}</div>`;
  }
  // 点「?」：展开对应屏内的标准区块并滚动定位；若指定维度则高亮该维度
  function openStandard(level, dimension, screen){
    const sec = screen ? screen.querySelector('.std-section') : null;
    if(!sec) return;
    sec.classList.add('open');
    if(dimension){
      sec.querySelectorAll('.std-dim').forEach(d=>{ if(d.dataset.dim === dimension) d.classList.add('flash'); });
    }
    sec.scrollIntoView({behavior:'smooth', block:'start'});
  }
  // 点「?」角标：展开所在屏的标准区块
  document.addEventListener('click', e=>{
    const ib = e.target.closest('.info-btn');
    if(ib){ e.preventDefault(); const screen = ib.closest('.screen'); openStandard(ib.dataset.stdLevel, ib.dataset.stdDim || null, screen); }
  });
  // 点标准区块 header：折叠 / 展开
  document.addEventListener('click', e=>{
    const h = e.target.closest('.std-head');
    if(h){ h.closest('.std-section').classList.toggle('open'); }
  });

  // 渲染：报告屏
  function renderReport(d){
    const body = document.getElementById('reportBody');
    if(!d){ body.innerHTML = '<div class="banner"><span>请先在批改结果页生成报告</span></div>'; return; }
    const isIelts = d.scoreType === 'ielts';
    const max = Number(d.maxScore)||15;
    const conv = isIelts ? null : (Number(d.score)||0)/max*100;
    const sents = (d.sentences||[]).map(s=>{
      const issues=(s.issues||[]).map(i=>{
        const sev = i.severity==='major'?'major':(i.severity==='minor'?'minor':'');
        return `<div class="sent-issue"><span class="issue-tag ${sev}">${esc(i.type)}</span><span>${esc(i.note)}</span></div>`;
      }).join('');
      const tip = (!s.hasError && s.sentenceTip) ? `<div class="sent-tip"><span class="tip-label">升级</span><span>${esc(s.sentenceTip)}</span></div>` : '';
      return `<div class="sent-card">
        <div class="sent-head"><span class="sent-idx">${esc(s.index)}</span>${s.hasError?'<span class="sent-flag bad">需修改</span>':'<span class="sent-flag ok">正确</span>'}</div>
        <div class="sent-orig">${esc(s.original)}</div>
        ${s.hasError?`<div class="sent-fix"><span class="fix-label">修改</span>${esc(s.corrected)}</div>`:''}
        ${issues}
        ${tip}
      </div>`;
    }).join('');
    const probs = (d.problems||[]).map(p=>`<div class="issue"><span class="dot" style="background:${p.severity==='red'?'var(--red)':'var(--warn)'}"></span><span class="issue-text">${esc(p.text)}</span></div>`).join('') || '<div class="desc">无明显问题</div>';
    let scoreBlock;
    const stdBtn = isIelts
      ? `<button class="info-btn" data-std-level="雅思" title="查看雅思官方评分标准">?</button>`
      : `<button class="info-btn" data-std-level="${esc(stdLevelFor(d))}" title="查看官方评分标准">?</button>`;
    if(isIelts){
      scoreBlock = `<div class="rep-top"><div class="rep-left"><div class="chip-label">${esc(d.exam||'雅思')}</div><div class="rep-score">${esc(d.overall)}</div><div class="rep-band">${esc(d.bandDescriptor||'')}</div></div></div>
        <div class="dim4" style="margin-top:12px">${(d.dimensions||[]).map(x=>`<div class="dim4-row"><div class="dim4-name">${esc(x.name)}</div><div class="dim4-bar"><div class="dim4-fill" style="width:${Math.max(0,Math.min(100,(Number(x.score)||0)/9*100))}%"></div></div><div class="dim4-score">${esc(x.score)}</div></div>`).join('')}</div>`;
    } else {
      scoreBlock = `<div class="rep-top"><div class="rep-left"><div class="chip-label">${esc(d.exam||'CET-4')}</div><div class="rep-score">${esc(d.score)}/${max}</div><div class="rep-band">${esc(d.band)} 档</div></div><div class="rep-right"><div class="rep-cap">折合</div><div class="rep-conv">${isFinite(conv)?conv.toFixed(1):'--'}</div></div></div>
        <div class="desc">${esc(d.officialDesc)}</div>
        <div class="source">来源：${esc(d.officialSource)}</div>`;
    }
    scoreBlock = `<div style="position:relative">${stdBtn}${scoreBlock}</div>`;
    const stdSection = buildStandardSection(isIelts ? '雅思' : stdLevelFor(d), null);
    body.innerHTML = `
      <div class="banner"><svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="9"/><path d="M7.5 11l2.5 2.5 4-5"/></svg><span>报告已生成，可下载或分享</span></div>
      <div class="report-card">
        ${scoreBlock}
      </div>
      ${stdSection}
      <div class="card sent-block" style="gap:10px">
        <div class="card-title">逐句批改全文</div>
        ${sents}
      </div>
      <div class="card" style="gap:10px">
        <div class="card-title">问题清单</div>
        ${probs}
      </div>
    `;
  }

  // 下载报告
  function downloadReport(){
    if(!lastResult) return;
    const d = lastResult;
    const max = Number(d.maxScore)||15;
    const scoreLine = d.scoreType==='ielts'
      ? `Overall：${d.overall}\n档位：${d.bandDescriptor||''}`
      : `得分：${d.score}/${max}  折合满分100：${((Number(d.score)/max*100).toFixed(1))}\n档位：${d.band}`;
    let txt = `英语作文批改报告\n考试标准：${d.exam||''}\n${scoreLine}\n官方描述：${d.officialDesc||''}\n出处：${d.officialSource||''}\n\n—— 逐句批改 ——\n`;
    (d.sentences||[]).forEach(s=>{
      txt += `第${s.index}句：\n  原文：${s.original}\n`;
      if(s.hasError){ txt += `  修改：${s.corrected}\n`; (s.issues||[]).forEach(i=>txt+=`  [${i.type}] ${i.note}\n`); }
      else txt += '  （正确）\n';
    });
    txt += `\n—— 维度诊断 ——\n`;
    (d.dimensions||[]).forEach(x=>txt+=`${x.name}：${x.comment}\n`);
    txt += `\n—— 问题清单 ——\n`;
    (d.problems||[]).forEach(p=>txt+=`[${p.severity}] ${p.text}\n`);
    txt += `\n—— 词汇升级 ——\n`;
    (d.vocab||[]).forEach(v=>txt+=`${v.old} → ${v.new}\n`);
    txt += `\n—— 全文翻译 ——\n${(d.translation||'')}\n`;
    txt += `\n—— 升档路径 ——\n${d.upgradePath}\n`;
    try{
      const blob=new Blob([txt],{type:'text/plain;charset=utf-8'});
      const url=URL.createObjectURL(blob); const a=document.createElement('a');
      a.href=url; a.download='批改报告.txt'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      showToast('报告已下载');
    }catch(e){}
  }

  // ===== 底部弹层 / 取词 / 纠错 / 好词好句本 =====
  function openSheet(){ document.getElementById('sheetMask').classList.add('show'); document.getElementById('sheet').classList.add('show'); }
  function closeSheet(){ document.getElementById('sheetMask').classList.remove('show'); document.getElementById('sheet').classList.remove('show'); }
  document.getElementById('sheetMask').addEventListener('click', closeSheet);

  function showErrorSheet(i){
    const s = (lastResult && lastResult.sentences||[]).find(x=>String(x.index)===String(i));
    if(!s) return;
    const issues=(s.issues||[]).map(it=>{
      const sev = it.severity==='major'?'major':(it.severity==='minor'?'minor':'');
      return `<div class="err-issue"><span class="issue-tag ${sev}">${esc(it.type)}</span><span>${esc(it.note)}</span></div>`;
    }).join('');
    const tip=(!s.hasError && s.sentenceTip)?`<div class="err-tip"><span style="font-weight:600">升级</span> ${esc(s.sentenceTip)}</div>`:'';
    const sheet=document.getElementById('sheet');
    sheet.innerHTML=`<div class="sheet-title"><span>修改建议</span><span class="sheet-close">✕</span></div>
      <div class="err-orig">${esc(s.original)}</div>
      ${s.hasError?`<div class="err-fix"><span style="font-weight:600">建议改为：</span>${esc(s.corrected)}</div>`:''}
      ${issues}
      ${tip}
      <div class="sheet-actions"><button class="cta-secondary" id="errClose" style="flex:1">知道了</button></div>`;
    openSheet();
    sheet.querySelector('.sheet-close').addEventListener('click',closeSheet);
    sheet.querySelector('#errClose').addEventListener('click',closeSheet);
  }

  function showWordSheet(word){
    const sheet=document.getElementById('sheet');
    sheet.innerHTML=`<div class="sheet-title"><span>单词查询 · ${esc(word)}</span><span class="sheet-close">✕</span></div>
      <div class="sheet-word">${esc(word)}</div>
      <div class="sheet-phon">查询中…</div>
      <div id="glossBox"></div>
      <div class="sheet-actions"><button class="cta-primary" id="wRead">朗读</button><button class="cta-secondary" id="wSave">收藏</button></div>`;
    openSheet();
    sheet.querySelector('.sheet-close').addEventListener('click',closeSheet);
    sheet.querySelector('#wRead').addEventListener('click',()=>speak(word));
    sheet.querySelector('#wSave').addEventListener('click',()=>{
      addVocab({type:'word', text:word, exam: lastResult?lastResult.exam:'', context:''});
    });
    // 英文释义（Free Dictionary，并行）
    fetch('https://api.dictionaryapi.dev/api/v2/entries/en/'+encodeURIComponent(word))
      .then(r=>r.ok?r.json():Promise.reject('no'))
      .then(d=>{ const ph=sheet.querySelector('.sheet-phon'); if(ph) ph.textContent=''; renderDict(sheet,d); })
      .catch(()=>{ const ph=sheet.querySelector('.sheet-phon'); if(ph) ph.textContent='（英文释义源暂不可用）'; });
    // 中文释义层（直连大模型，并行叠加）
    LLM.doGloss(word)
      .then(({data:g})=>{ renderGloss(sheet, g||{}); })
      .catch(()=>{ const box=sheet.querySelector('#glossBox'); if(box) box.innerHTML='<div class="desc" style="color:var(--ink-3)">中文释义获取失败（接口或网络问题）</div>'; });
  }
  function renderGloss(sheet, g){
    const box=sheet.querySelector('#glossBox'); if(!box) return;
    const pos = g.pos?`<span class="dict-pos">${esc(g.pos)}</span> `:'';
    const cn = g.cn?`<div class="dict-def" style="color:var(--ink);font-weight:600">🇨🇳 ${esc(g.cn)}</div>`:'';
    const en = g.en?`<div class="dict-def" style="margin-top:4px">${pos}${esc(g.en)}</div>`:'';
    const ex = (g.example)?`<div class="dict-ex">"${esc(g.example)}"${g.exampleCn?` — ${esc(g.exampleCn)}`:''}</div>`:'';
    const phon = g.phonetic?`<div class="sheet-phon" style="margin-top:-6px;color:var(--ink-3)">${esc(g.phonetic)}</div>`:'';
    box.innerHTML = `<div class="dict-item">${cn}${en}${ex}</div>${phon}`;
  }
  function renderDict(sheet, data){
    const phon = (data[0] && data[0].phonetic) ? data[0].phonetic
      : (data[0] && data[0].phonetics && data[0].phonetics[0] && data[0].phonetics[0].text) || '';
    let html = phon?`<div class="sheet-phon">${esc(phon)}</div>`:'<div class="sheet-phon"></div>';
    const items=[];
    (data||[]).forEach(entry=>{
      (entry.meanings||[]).forEach(m=>{
        (m.definitions||[]).slice(0,3).forEach(def=>{
          items.push(`<div class="dict-item"><div class="dict-pos">${esc(m.partOfSpeech||'')}</div><div class="dict-def">${esc(def.definition||'')}</div>${def.example?`<div class="dict-ex">"${esc(def.example)}"</div>`:''}</div>`);
        });
      });
    });
    html += items.slice(0,8).join('');
    const actions = sheet.querySelector('.sheet-actions');
    actions.insertAdjacentHTML('beforebegin', html);
  }
  function speak(text){
    try{
      if(!('speechSynthesis' in window)){ showToast('当前环境不支持朗读'); return; }
      const u=new SpeechSynthesisUtterance(text); u.lang='en-US'; u.rate=0.9;
      window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
    }catch(e){ showToast('朗读失败'); }
  }

  function collectSentence(i){
    if(!lastResult) return;
    const s=(lastResult.sentences||[]).find(x=>String(x.index)===String(i));
    if(!s) return;
    addVocab({type:'sentence', text:s.original, exam:lastResult.exam, context:s.corrected});
  }

  const VKEY='essay_vocab';
  function loadVocab(){ try{ return Store.getVocab().slice(); }catch(e){ return []; } }
  function saveVocab(a){ try{ Store.saveVocab(a); }catch(e){} }
  async function addVocab(item){
    if(!Store.isFileMode() && window.showDirectoryPicker){ try{ await Store.ensureFolder(); }catch(e){} }
    const a=loadVocab();
    if(a.some(x=>x.type===item.type && x.text===item.text)){ showToast('已收藏过'); return; }
    item.ts=Date.now();
    // 预取复习信息：单词→音标/释义/例句；句子→中文翻译（失败不影响收藏）
    try{
      if(item.type==='word'){
        const {data:g}=await LLM.doGloss(item.text);
        if(g && !g.error){ item.phonetic=g.phonetic; item.cn=g.cn; item.example=g.example; item.exampleCn=g.exampleCn; }
      } else if(item.type==='sentence'){
        const {text:trans}=await LLM.doTranslate(item.text);
        if(trans) item.translation=trans;
      }
    }catch(e){}
    a.unshift(item); saveVocab(a); renderVocab(); showToastAction('已加入好词好句本','查看',()=>showScreen('s-vocab'));
  }
  function removeVocab(ts){ let a=loadVocab(); a=a.filter(x=>x.ts!=ts); saveVocab(a); renderVocab(); }
  function renderVocab(){
    const body=document.getElementById('vocabBody'); if(!body) return;
    const a=loadVocab();
    if(!a.length){
      body.innerHTML='<div class="vocab-empty"><svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 16h22"/><path d="M11 23h22"/><path d="M11 30h14"/><rect x="6" y="8" width="32" height="30" rx="7"/></svg><div>还没有收藏的词句<br>批改时点击单词 / 句子即可收藏</div></div>';
      return;
    }
    body.innerHTML = '<div class="list-card">' + a.map(x=>{
      const sub = x.type==='word'
        ? ((x.phonetic||x.cn) ? `<div class="vocab-sub">${esc(x.phonetic||'')}${x.phonetic&&x.cn?'　':''}${esc(x.cn||'')}</div>` : '')
        : (x.translation ? `<div class="vocab-sub">${esc(x.translation)}</div>` : '');
      const more = (x.type==='word' && (x.example||x.exampleCn))
        ? `<div class="vocab-more">${esc(x.example||'')}${x.exampleCn?('　'+esc(x.exampleCn)):''}</div>`
        : '';
      return `<div class="vocab-item ${x.type==='word'&&more?'has-more':''}">
        <div class="vocab-main">
          <span class="vocab-type ${x.type}">${x.type==='word'?'单词':'句子'}</span>
          <div class="vocab-text">${esc(x.text)}</div>
          ${sub}
          ${more}
          ${x.context?`<div class="vocab-ctx">${esc(x.context)}</div>`:''}
          <div class="vocab-meta">${esc(x.exam||'')} · ${new Date(x.ts).toLocaleDateString()}</div>
        </div>
        <div class="vocab-del" data-ts="${x.ts}">✕</div>
      </div>`;
    }).join('') + '</div>';
    body.querySelectorAll('.vocab-del').forEach(b=>b.addEventListener('click',(e)=>{ e.stopPropagation(); removeVocab(b.dataset.ts); }));
    body.querySelectorAll('.vocab-item.has-more').forEach(c=>c.addEventListener('click',()=>c.classList.toggle('open')));
  }
  function exportVocab(){
    const a=loadVocab(); if(!a.length){ showToast('没有可导出的内容'); return; }
    let csv='type,text,exam,context\n';
    a.forEach(x=>{ csv+=`"${x.type}","${x.text.replace(/"/g,'""')}","${(x.exam||'').replace(/"/g,'""')}","${(x.context||'').replace(/"/g,'""')}"\n`; });
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob); const el=document.createElement('a'); el.href=url; el.download='好词好句本.csv'; document.body.appendChild(el); el.click(); el.remove(); URL.revokeObjectURL(url);
    showToast('已导出好词好句本');
  }

  // ===== CTA 导航 =====
  document.getElementById('homeCta').addEventListener('click', ()=>showScreen('s-new'));
  document.getElementById('qcReport').addEventListener('click', ()=>showScreen('s-history'));

  // 首页「近期批改」：真实数据（最近 2 条已完成任务），点击打开结果
  async function renderRecent(){
    const box = document.getElementById('recentList');
    if(!box) return;
    let list = [];
    try{ list = Store.getHistory(); }catch(e){}
    const done = list.filter(t=>t.status==='done' && t.result).slice(0,2);
    if(!done.length){
      box.innerHTML = `<div class="recent-card" data-go="grade" style="cursor:pointer">
        <div class="rc-left"><div class="chip-label">暂无</div><div class="rc-meta">还没有批改记录，点这里去批改一篇</div></div>
        <div class="rc-right"><div class="rc-score" style="font-size:14px;color:var(--ink-3);font-family:'Noto Sans SC',sans-serif">去批改 ›</div></div>
      </div>`;
      return;
    }
    box.innerHTML = done.map(t=>{
      const r = t.result||{};
      const lv = (t.levels||[]).filter(x=>x!=='全部（跨考试对比）').join('、') || '通用';
      const scoreTxt = r.scoreType==='ielts' ? ((r.overall??'-')+' / 9') : ((r.score??'-')+' / '+(r.maxScore??'-'));
      return `<div class="recent-card" data-task="${esc(t.taskId)}" style="cursor:pointer">
        <div class="rc-left"><div class="chip-label">${esc(lv)}</div><div class="rc-meta">${fmtTaskTime(t.created_at)}</div></div>
        <div class="rc-right"><div class="rc-score">${esc(scoreTxt)}</div><div class="rc-band">已完成</div></div>
      </div>`;
    }).join('');
  }
  document.getElementById('recentList').addEventListener('click', async (e)=>{
    const card = e.target.closest('.recent-card');
    if(!card) return;
    if(card.dataset.go === 'grade'){ showScreen('s-new'); return; }
    if(card.dataset.task){
      const list = await refreshTasks();
      const t = (list||[]).find(x=>x.taskId===card.dataset.task);
      if(t && t.status==='done' && t.result){ lastResult = t.result; renderResult(t.result); showScreen('s-result'); }
      else { showToast('任务尚未完成，请稍候'); }
    }
  });
  renderRecent();
  document.getElementById('newClose').addEventListener('click', ()=>showScreen('s-home'));
  document.getElementById('resultClose').addEventListener('click', ()=>showScreen('s-home'));
  document.getElementById('genReport').addEventListener('click', ()=>{ renderReport(lastResult); showScreen('s-report'); });
  document.getElementById('againBtn').addEventListener('click', ()=>showScreen('s-new'));
  document.getElementById('reportDownload').addEventListener('click', downloadReport);
  document.getElementById('vocabExport').addEventListener('click', exportVocab);

  // ===== PWA：注册 Service Worker + 桌面安装按钮 =====
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
  // 初始化本地存储（读取已授权的文件夹句柄 / IndexedDB 回退）
  try { Store.init(); } catch (e) {}
  let deferredPrompt = null;
  const wbInstallBtn = document.getElementById('wbInstall');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (wbInstallBtn) wbInstallBtn.hidden = false;
  });
  window.addEventListener('appinstalled', () => {
    if (wbInstallBtn) wbInstallBtn.hidden = true;
    deferredPrompt = null;
  });
  if (wbInstallBtn) {
    wbInstallBtn.addEventListener('click', async () => {
      if (!deferredPrompt) { showToast('可在浏览器菜单选择「安装应用」/「添加到桌面」'); return; }
      deferredPrompt.prompt();
      try { await deferredPrompt.userChoice; } catch (e) {}
      deferredPrompt = null;
      wbInstallBtn.hidden = true;
    });
  }
