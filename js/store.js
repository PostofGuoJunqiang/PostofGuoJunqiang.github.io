// store.js — 本地数据存储（数据只存用户本机，零服务器）
// 桌面端（Chromium 系 PWA，如 Edge/Chrome 安装的桌面版）：用 File System Access API
//   把数据写成用户自选文件夹里的 JSON 文件：history.json / vocab.json / settings.json
// 移动端 / 不支持文件系统 API 的环境：回退到 IndexedDB（同样只存本机，只是不是可浏览的文件）
// 读取走内存 state（同步），写入异步落盘。Key / 历史 / 好词本全部在本机，不会上传。
(function () {
  const FILES = { history: 'history.json', vocab: 'vocab.json', settings: 'settings.json' };
  let state = { history: [], vocab: [], settings: {} };
  let dirHandle = null;
  let useFS = false;
  let initialized = false;
  let askedFolder = false;

  // ---- IndexedDB 小工具（保存目录句柄 + 移动端回退存储） ----
  function idb() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('pigai-store', 1);
      r.onupgradeneeded = () => { const db = r.result; if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv'); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  function idbSet(k, v) {
    return idb().then(db => new Promise((res, rej) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(v, k);
      tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
    }));
  }
  function idbGet(k) {
    return idb().then(db => new Promise((res, rej) => {
      const tx = db.transaction('kv', 'readonly');
      const rq = tx.objectStore('kv').get(k);
      rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
    }));
  }

  async function readJsonFile(name, def) {
    if (!useFS || !dirHandle) return def;
    try {
      const f = await dirHandle.getFileHandle(name, { create: false });
      const file = await f.getFile();
      const txt = await file.text();
      return JSON.parse(txt);
    } catch (e) { return def; }
  }
  async function writeJsonFile(name, val) {
    if (!useFS || !dirHandle) return;
    try {
      const f = await dirHandle.getFileHandle(name, { create: true });
      const w = await f.createWritable();
      await w.write(JSON.stringify(val, null, 2));
      await w.close();
    } catch (e) { /* 写盘失败（如权限被收回）时静默忽略 */ }
  }
  async function persistAll() {
    if (useFS && dirHandle) {
      await Promise.all([
        writeJsonFile(FILES.history, state.history),
        writeJsonFile(FILES.vocab, state.vocab),
        writeJsonFile(FILES.settings, state.settings)
      ]);
    } else {
      await idbSet('pigai-data', state); // 移动端回退
    }
  }
  async function loadFromFS() {
    state.history = await readJsonFile(FILES.history, []);
    state.vocab = await readJsonFile(FILES.vocab, []);
    state.settings = await readJsonFile(FILES.settings, {});
  }

  async function init() {
    if (initialized) return;
    initialized = true;
    // 尝试恢复此前已授权的目录句柄
    try {
      const saved = await idbGet('pigai-dir-handle');
      if (saved && saved.handle && window.showDirectoryPicker) {
        try {
          const perm = await saved.handle.requestPermission({ mode: 'readwrite' });
          if (perm === 'granted') { dirHandle = saved.handle; useFS = true; await loadFromFS(); }
        } catch (e) { /* 忽略，走回退 */ }
      }
    } catch (e) { }
    // 移动端 / 无句柄：从 IDB 恢复
    try {
      const d = await idbGet('pigai-data');
      if (d) { state = Object.assign(state, d); }
    } catch (e) { }
    // 兼容：把旧 localStorage 里的好词本迁移进 store（仅一次）
    try {
      const old = localStorage.getItem('essay_vocab');
      if (old && !state.vocab.length) { state.vocab = JSON.parse(old) || []; }
    } catch (e) { }
  }

  // 桌面端：让用户选一个本地文件夹作为存档目录（需用户手势触发）
  async function chooseFolder() {
    if (!window.showDirectoryPicker) { useFS = false; return { ok: false, error: '当前浏览器不支持选择文件夹（需 Chrome / Edge 内核，且在 https 或 localhost 下）' }; }
    try {
      dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      useFS = true;
      await idbSet('pigai-dir-handle', { handle: dirHandle });
      await loadFromFS();
      await persistAll();
      return { ok: true, error: '' };
    } catch (e) {
      useFS = false;
      if (e && e.name === 'AbortError') return { ok: false, error: '已取消选择文件夹' };
      console.error('chooseFolder:', e);
      return { ok: false, error: '选择文件夹失败：' + ((e && e.message) ? e.message : String(e)) };
    }
  }
  // 首次写入时若还没选过文件夹，自动弹一次选择（仅一次）
  async function ensureFolder() {
    if (useFS || !window.showDirectoryPicker || askedFolder) return;
    askedFolder = true;
    try { await chooseFolder(); } catch (e) { }
  }

  // ---- 对外 API ----
  function getHistory() {
    return state.history.slice().sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  }
  function getVocab() { return state.vocab.slice(); }
  function getSettings() { return state.settings; }
  function saveVocab(arr) { state.vocab = (arr || []).slice(); persistAll(); }
  function saveHistory(arr) { state.history = (arr || []).slice(); persistAll(); }
  function saveSettings(obj) { state.settings = Object.assign({}, state.settings, obj || {}); persistAll(); }

  function newTaskId() {
    return new Date().toISOString().slice(5, 16).replace(/[-:T]/g, '') + Math.floor(Math.random() * 900 + 100);
  }
  function addTask(t) { state.history.unshift(t); persistAll(); }
  function updateTask(t) {
    const i = state.history.findIndex(x => x.taskId === t.taskId);
    if (i >= 0) state.history[i] = t; else state.history.unshift(t);
    persistAll();
  }
  function getTask(id) { return state.history.find(x => x.taskId === id); }

  // 从 JSON 文本导入备份（history/vocab/settings）。兼容三种形态：
  //   1) {history:[...], vocab:[...], settings:{...}}
  //   2) 纯数组且首项含 taskId → 视为 history
  // 导入后立即落盘。返回 {ok, history, vocab, settings}
  function importFromJSON(text) {
    let obj;
    try { obj = JSON.parse(text); } catch (e) { return { ok: false, error: '不是有效的 JSON 文件' }; }
    let h = 0, v = 0, s = 0;
    if (Array.isArray(obj.history)) { state.history = obj.history; h = obj.history.length; }
    else if (Array.isArray(obj) && obj[0] && obj[0].taskId) { state.history = obj; h = obj.length; }
    if (Array.isArray(obj.vocab)) { state.vocab = obj.vocab; v = obj.vocab.length; }
    if (obj.settings && typeof obj.settings === 'object') { state.settings = Object.assign({}, state.settings, obj.settings); s = 1; }
    try { persistAll(); } catch (e) { /* 落盘失败不阻塞（数据已在内存，本次会话可用） */ }
    return { ok: true, history: h, vocab: v, settings: s };
  }

  window.Store = {
    init, chooseFolder, ensureFolder,
    getHistory, getVocab, getSettings, saveVocab, saveHistory, saveSettings,
    addTask, updateTask, getTask, newTaskId,
    importFromJSON,
    isFileMode: () => useFS,
    hasFolder: () => !!dirHandle
  };
})();
