 /* ======================================================================
  * 工单助手 - app.js
  * 任务卡生成 + 买家秀评语 + 派发二维码
  * ====================================================================== */
 
 /* ===== Style intensity matrix =====
  * 每个风格的 高/中/低 都有独立定义
  * 一般 没有强度档位（null）
  */
 const STYLE_MATRIX = {
   '热情': {
     high: '极度兴奋，反复强调喜欢，连用多个感叹号，emoji 频繁（🔥❤️👍✨）',
     mid: '明显开心，语气积极自然，1-2 个 emoji 点缀',
     low: '温和地表达满意，语气平稳克制'
   },
   '感谢': {
     high: '夸张地感谢商品带来的绝赞效果，提到身边人都被安利，引用上帝/运气/缘分等词',
     mid: '真诚温暖地感谢卖家，1 个 emoji',
     low: '简单提一句感谢或带来的效果'
   },
   '夸赞': {
     high: '用最高级形容词（绝绝子、神仙、太值了），比喻夸张绝对化',
     mid: '明确肯定产品优点，自然地夸赞',
     low: '简单说产品不错/好用'
   },
   '一般': null,
   '网络': {
     high: '浓重网感：yyds、绝绝子、xswl、栓Q、社交牛逼症、各种网络梗叠加',
     mid: '中等网感：1-2 个网络词穿插',
     low: '轻微网感：偶尔用一个网词'
   },
   '抽象': {
     high: '高度抽象的比喻，段子手风格，荒诞反差，跳跃性思维',
     mid: '有些出人意料的比喻但不夸张',
     low: '稍微带点抽象表达'
   },
   '幽默调侃': {
     high: '大胆夸张的比喻和反差（"霍金都能自己染头"这种）',
     mid: '明显的幽默表达，轻微调侃',
     low: '温和的日常比喻（"爷爷煮顿饭的功夫就染好了"）'
   },
   '真诚朴实': {
     high: '朴实但反复强调真实使用感受，引用具体细节（用了 X 天、第几次买）',
     mid: '诚恳自然，没有修饰',
     low: '简洁陈述使用体验'
   },
   '种草安利': {
     high: '强烈推荐，"姐妹们冲"、"不买后悔"，有强烈感染力和号召力',
     mid: '温和推荐，表达愿意继续回购',
     low: '简单说值得购买'
   },
   '简洁干练': {
     high: '极简，一句话讲完事实，无修饰',
     mid: '简洁但完整，结构清晰',
     low: '稍长但仍不啰嗦'
   }
 };
 /* ===== Default settings ===== */
 const DEFAULT_SETTINGS = {
   apiBase: 'https://api.deepseek.com/v1',
   model: 'deepseek-chat',
   apiKey: '',
   baseUrl: '',
   pasteUrl: 'https://catbox.moe/user/api.php',
   githubToken: ''
 };
 
 /* ===== App state ===== */
 const state = {
   cover: null,
   skuImage: null,
   reviewImage: null,
   skuText: '',
   actionCustomText: '',
   priceValue: null,
   kwCustomText: '',
   styleCustomText: '',
   identityCustom: '',
   targetCustom: '',
   selectedLength: 20,
   selectedLengthCustom: null,
   selectedStyles: new Map(),
   selectedKw: new Set(),
   selectedId: null,
   selectedTarget: null,
   lastTask: null,
   lastReview: null,
   lastCardDataUrl: null,
   settings: null
 };
 
 /* ===== IndexedDB ===== */
 const DB_NAME = 'workorder-db';
 const DB_VERSION = 2;
 let _db = null;
 
 function dbOpen() {
   if (_db) return Promise.resolve(_db);
   return new Promise((resolve, reject) => {
     const req = indexedDB.open(DB_NAME, DB_VERSION);
     req.onupgradeneeded = (e) => {
       const db = e.target.result;
       if (!db.objectStoreNames.contains('terms')) {
         const s = db.createObjectStore('terms', { keyPath: 'id', autoIncrement: true });
         s.createIndex('type', 'type');
         s.createIndex('type_usedAt', ['type', 'usedAt']);
       }
       if (!db.objectStoreNames.contains('covers')) {
         const s = db.createObjectStore('covers', { keyPath: 'id', autoIncrement: true });
         s.createIndex('hash', 'hash', { unique: true });
         s.createIndex('usedAt', 'usedAt');
       }
       if (!db.objectStoreNames.contains('tasks')) {
         db.createObjectStore('tasks', { keyPath: 'id', autoIncrement: true });
       }
       if (!db.objectStoreNames.contains('reviews')) {
         db.createObjectStore('reviews', { keyPath: 'id', autoIncrement: true });
       }
       if (!db.objectStoreNames.contains('settings')) {
         db.createObjectStore('settings', { keyPath: 'key' });
       }
       if (!db.objectStoreNames.contains('skuImages')) {
         const s = db.createObjectStore('skuImages', { keyPath: 'id', autoIncrement: true });
         s.createIndex('hash', 'hash', { unique: true });
         s.createIndex('usedAt', 'usedAt');
       }
       if (!db.objectStoreNames.contains('reviewImages')) {
         const s = db.createObjectStore('reviewImages', { keyPath: 'id', autoIncrement: true });
         s.createIndex('hash', 'hash', { unique: true });
         s.createIndex('usedAt', 'usedAt');
       }
     };
     req.onsuccess = () => { _db = req.result; resolve(_db); };
     req.onerror = () => reject(req.error);
   });
 }
 
 function tx(store, mode = 'readonly') {
   return dbOpen().then(db => db.transaction(store, mode).objectStore(store));
 }
 
 async function dbAdd(store, data) {
   const s = await tx(store, 'readwrite');
   return new Promise((res, rej) => {
     const r = s.add(data);
     r.onsuccess = () => res(r.result);
     r.onerror = () => rej(r.error);
   });
 }
 
 async function dbPut(store, data) {
   const s = await tx(store, 'readwrite');
   return new Promise((res, rej) => {
     const r = s.put(data);
     r.onsuccess = () => res(r.result);
     r.onerror = () => rej(r.error);
   });
 }
 
 async function dbGet(store, key) {
   const s = await tx(store);
   return new Promise((res, rej) => {
     const r = s.get(key);
     r.onsuccess = () => res(r.result);
     r.onerror = () => rej(r.error);
   });
 }
 
 async function dbGetAll(store) {
   const s = await tx(store);
   return new Promise((res, rej) => {
     const r = s.getAll();
     r.onsuccess = () => res(r.result);
     r.onerror = () => rej(r.error);
   });
 }
 
 async function dbDelete(store, key) {
   const s = await tx(store, 'readwrite');
   return new Promise((res, rej) => {
     const r = s.delete(key);
     r.onsuccess = () => res();
     r.onerror = () => rej(r.error);
   });
 }
 
 async function dbClear(store) {
   const s = await tx(store, 'readwrite');
   return new Promise((res, rej) => {
     const r = s.clear();
     r.onsuccess = () => res();
     r.onerror = () => rej(r.error);
   });
 }
 /* ===== Settings ===== */
 async function loadSettings() {
   const list = await dbGetAll('settings');
   const map = Object.assign({}, DEFAULT_SETTINGS);
   list.forEach(r => { map[r.key] = r.value; });
   state.settings = map;
   document.getElementById('setting-api-base').value = map.apiBase || DEFAULT_SETTINGS.apiBase;
   document.getElementById('setting-model').value = map.model || DEFAULT_SETTINGS.model;
   document.getElementById('setting-api-key').value = map.apiKey || '';
   document.getElementById('setting-base-url').value = map.baseUrl || '';
   document.getElementById('setting-paste-url').value = map.pasteUrl || DEFAULT_SETTINGS.pasteUrl;
   document.getElementById('setting-github-token').value = map.githubToken || '';
 }

 async function saveSettings() {
   const map = {
     apiBase: (document.getElementById('setting-api-base').value.trim() || DEFAULT_SETTINGS.apiBase).replace(/\/+$/, ''),
     model: document.getElementById('setting-model').value.trim() || DEFAULT_SETTINGS.model,
     apiKey: document.getElementById('setting-api-key').value.trim(),
     baseUrl: document.getElementById('setting-base-url').value.trim().replace(/\/+$/, ''),
     pasteUrl: document.getElementById('setting-paste-url').value.trim() || DEFAULT_SETTINGS.pasteUrl,
     githubToken: document.getElementById('setting-github-token').value.trim()
   };
   await dbPut('settings', { key: 'apiBase', value: map.apiBase });
   await dbPut('settings', { key: 'model', value: map.model });
   await dbPut('settings', { key: 'apiKey', value: map.apiKey });
   await dbPut('settings', { key: 'baseUrl', value: map.baseUrl });
   await dbPut('settings', { key: 'pasteUrl', value: map.pasteUrl });
   await dbPut('settings', { key: 'githubToken', value: map.githubToken });
   state.settings = map;
   showToast('已保存');
 }
 
 /* ===== Clock ===== */
 function updateClock() {
   const d = new Date();
   const hh = d.getHours().toString().padStart(2, '0');
   const mm = d.getMinutes().toString().padStart(2, '0');
   const el = document.getElementById('clockText');
   if (el) el.textContent = `${hh}:${mm}`;
 }
 
 /* ===== Navigation ===== */
 function showPage(id) {
   document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
   const el = document.getElementById(id);
   if (el) el.classList.add('active');
   window.scrollTo(0, 0);
   if (id === 'page-dispatch') refreshDispatch();
   if (id === 'page-history') loadHistory();
   if (id === 'page-home') refreshHome();
 }
 
 /* ===== Toast & Loading ===== */
 let toastTimer = null;
 function showToast(text) {
   const el = document.getElementById('toast');
   el.textContent = text;
   el.classList.add('show');
   if (toastTimer) clearTimeout(toastTimer);
   toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
 }
 
 function showLoading(text) {
   document.getElementById('loading-text').textContent = text || '处理中...';
   document.getElementById('loading').classList.add('show');
 }
 function hideLoading() {
   document.getElementById('loading').classList.remove('show');
 }
 
 /* ===== Copy / Lightbox ===== */
 async function copyText(elemId) {
   const el = document.getElementById(elemId);
   if (!el) return;
   try {
     await navigator.clipboard.writeText(el.innerText);
     showToast('已复制');
   } catch (e) {
     const r = document.createRange();
     r.selectNode(el);
     const sel = window.getSelection();
     sel.removeAllRanges();
     sel.addRange(r);
     try { document.execCommand('copy'); showToast('已复制'); }
     catch (e2) { showToast('复制失败'); }
     sel.removeAllRanges();
   }
 }
 
 function openLightbox(src) {
   document.getElementById('lightbox-img').src = src;
   document.getElementById('lightbox').classList.add('show');
 }
 function closeLightbox() {
   document.getElementById('lightbox').classList.remove('show');
 }
 
 /* ===== Image utilities ===== */
 function readFileAsDataURL(file) {
   return new Promise((res, rej) => {
     const r = new FileReader();
     r.onload = () => res(r.result);
     r.onerror = () => rej(r.error);
     r.readAsDataURL(file);
   });
 }
 
 async function hashBlob(blob) {
   const buf = await blob.arrayBuffer();
   const hash = await crypto.subtle.digest('SHA-256', buf);
   return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
 }
 
 function dataURLtoBlob(dataUrl) {
   const [meta, b64] = dataUrl.split(',');
   const mime = (meta.match(/data:([^;]+)/) || [])[1] || 'image/png';
   const bin = atob(b64);
   const arr = new Uint8Array(bin.length);
   for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
   return new Blob([arr], { type: mime });
 }
 
 function compressImage(dataUrl, maxSize = 1024, quality = 0.85) {
   return new Promise((res) => {
     const img = new Image();
     img.onload = () => {
       let w = img.width, h = img.height;
       if (w > h && w > maxSize) { h = h * maxSize / w; w = maxSize; }
       else if (h > maxSize) { w = w * maxSize / h; h = maxSize; }
       const c = document.createElement('canvas');
       c.width = w; c.height = h;
       c.getContext('2d').drawImage(img, 0, 0, w, h);
       res(c.toDataURL('image/jpeg', quality));
     };
     img.onerror = () => res(dataUrl);
     img.src = dataUrl;
   });
 }
 /* ===== Term (history) management ===== */
 async function recordTerm(type, value) {
   if (!value || !value.trim()) return;
   value = value.trim();
   const all = await dbGetAll('terms');
   const existing = all.find(t => t.type === type && t.value === value);
   if (existing) {
     existing.usedAt = Date.now();
     await dbPut('terms', existing);
   } else {
     await dbAdd('terms', { type, value, usedAt: Date.now() });
   }
 }
 
 async function getRecentTerms(type, limit = 5) {
   const all = await dbGetAll('terms');
   return all
     .filter(t => t.type === type)
     .sort((a, b) => b.usedAt - a.usedAt)
     .slice(0, limit);
 }
 
 async function deleteTerm(id) {
   await dbDelete('terms', id);
 }
 
/* ===== Browser-style history dropdown ===== */
let _dropdownInputEl = null;

function showHistoryDropdown(type, inputEl) {
  _dropdownInputEl = inputEl;
  const dropdown = document.getElementById('history-dropdown');
  const body = document.getElementById('history-dropdown-body');
  getRecentTerms(type, 5).then(terms => {
    body.innerHTML = '';
    if (!terms.length) {
      const empty = document.createElement('div');
      empty.className = 'history-dropdown-empty';
      empty.textContent = '暂无历史词条';
      body.appendChild(empty);
    } else {
      terms.forEach(t => {
        const item = document.createElement('div');
        item.className = 'history-dropdown-item';
        const txt = document.createElement('span');
        txt.className = 'hdi-text';
        txt.textContent = t.value;
        item.appendChild(txt);
        const del = document.createElement('button');
        del.className = 'hdi-del';
        del.textContent = '删除';
        del.onmousedown = (ev) => { ev.preventDefault(); ev.stopPropagation(); };
        del.ontouchstart = (ev) => { ev.preventDefault(); ev.stopPropagation(); };
        del.onclick = async (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          await deleteTerm(t.id);
          showHistoryDropdown(type, inputEl);
        };
        item.appendChild(del);
        item.onmousedown = (ev) => {
          if (ev.target === del) return;
          ev.preventDefault();
          inputEl.value = t.value;
          inputEl.dispatchEvent(new Event('input', { bubbles: true }));
          hideHistoryDropdown();
        };
        item.ontouchstart = (ev) => {
          if (ev.target === del) return;
          ev.preventDefault();
          inputEl.value = t.value;
          inputEl.dispatchEvent(new Event('input', { bubbles: true }));
          hideHistoryDropdown();
        };
        body.appendChild(item);
      });
    }
    positionDropdown(inputEl, dropdown);
    dropdown.hidden = false;
  });
}

function positionDropdown(inputEl, dropdown) {
  const rect = inputEl.getBoundingClientRect();
  const dw = Math.max(rect.width, 200);
  const dh = 240;
  let top = rect.bottom + 4;
  if (top + dh > window.innerHeight) top = Math.max(8, rect.top - dh - 4);
  let left = rect.left;
  if (left + dw > window.innerWidth) left = Math.max(8, window.innerWidth - dw - 8);
  dropdown.style.left = left + 'px';
  dropdown.style.top = top + 'px';
  dropdown.style.width = dw + 'px';
  dropdown.style.maxHeight = Math.min(dh, window.innerHeight - top - 8) + 'px';
}

function hideHistoryDropdown() {
  const dropdown = document.getElementById('history-dropdown');
  if (dropdown) dropdown.hidden = true;
  _dropdownInputEl = null;
}
 
 function escapeHtml(s) {
   return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
 }
 
 /* ===== Confirm input (the ✓ button next to text inputs) ===== */
 async function confirmInput(btn) {
   const inputId = btn.dataset.confirmInput;
   const type = btn.dataset.termType;
   const input = document.getElementById(inputId);
   if (!input) return;
   const value = input.value.trim();
   if (!value) {
     showToast('请先输入内容');
     return;
   }
   await recordTerm(type, value);
   showToast('已添加');
   input.blur();
 }
 /* ===== Cover (image) handling ===== */
 function pickCover() {
   document.getElementById('cover-input').click();
 }
 async function onCoverSelected(e) {
   const file = e.target.files[0];
   if (!file) return;
   const dataUrl = await readFileAsDataURL(file);
   const compressed = await compressImage(dataUrl, 1200, 0.88);
   const blob = dataURLtoBlob(compressed);
   const hash = await hashBlob(blob);
   const all = await dbGetAll('covers');
   let cover = all.find(c => c.hash === hash);
   if (!cover) {
     await dbAdd('covers', { hash, dataUrl: compressed, usedAt: Date.now() });
     cover = { hash, dataUrl: compressed, usedAt: Date.now() };
   } else {
     cover.usedAt = Date.now();
     await dbPut('covers', cover);
   }
   state.cover = cover;
   setCoverPreview(cover.dataUrl);
   loadCoverHistory();
   e.target.value = '';
 }
 
function setCoverPreview(dataUrl) {
  const el = document.getElementById('task-cover-preview');
  el.innerHTML = `<img src="${dataUrl}">`;
  el.classList.add('has-img');
}
 
 async function loadCoverHistory() {
   const wrap = document.getElementById('cover-history');
   wrap.innerHTML = '';
   const all = await dbGetAll('covers');
   const sorted = all.sort((a, b) => b.usedAt - a.usedAt).slice(0, 8);
   sorted.forEach(c => {
     const t = document.createElement('div');
     t.className = 'img-thumb';
     if (state.cover && state.cover.hash === c.hash) t.classList.add('active');
     t.style.backgroundImage = `url(${c.dataUrl})`;
     t.onclick = () => {
       state.cover = c;
       setCoverPreview(c.dataUrl);
       loadCoverHistory();
     };
     wrap.appendChild(t);
   });
 }
 
/* ===== SKU image handling ===== */
function pickSkuImg() {
  document.getElementById('sku-img-input').click();
}
async function onSkuImgSelected(e) {
  const file = e.target.files[0];
  if (!file) return;
  const dataUrl = await readFileAsDataURL(file);
  const compressed = await compressImage(dataUrl, 800, 0.85);
  const blob = dataURLtoBlob(compressed);
  const hash = await hashBlob(blob);
  const all = await dbGetAll('skuImages');
  let rec = all.find(c => c.hash === hash);
  if (!rec) {
    await dbAdd('skuImages', { hash, dataUrl: compressed, usedAt: Date.now() });
    rec = { hash, dataUrl: compressed, usedAt: Date.now() };
  } else {
    rec.usedAt = Date.now();
    await dbPut('skuImages', rec);
  }
  state.skuImage = rec;
  const skuEl = document.getElementById('task-sku-img-preview');
  skuEl.innerHTML = `<img src="${compressed}">`;
  skuEl.classList.add('has-img');
  loadImageHistory('skuImages', 'sku-img-history', (c) => {
    state.skuImage = c;
    skuEl.innerHTML = `<img src="${c.dataUrl}">`;
    skuEl.classList.add('has-img');
    loadImageHistory('skuImages', 'sku-img-history', null, c.hash);
  });
  e.target.value = '';
}
async function loadSkuImgHistory() {
  await loadImageHistory('skuImages', 'sku-img-history', (c) => {
    state.skuImage = c;
    const skuEl = document.getElementById('task-sku-img-preview');
    skuEl.innerHTML = `<img src="${c.dataUrl}">`;
    skuEl.classList.add('has-img');
  });
}

/* ===== Review image handling ===== */
function pickReviewImg() {
  document.getElementById('rev-img-input').click();
}
async function onReviewImgSelected(e) {
  const file = e.target.files[0];
  if (!file) return;
  const dataUrl = await readFileAsDataURL(file);
  const compressed = await compressImage(dataUrl, 1200, 0.85);
  const blob = dataURLtoBlob(compressed);
  const hash = await hashBlob(blob);
  const all = await dbGetAll('reviewImages');
  let rec = all.find(c => c.hash === hash);
  if (!rec) {
    await dbAdd('reviewImages', { hash, dataUrl: compressed, usedAt: Date.now() });
    rec = { hash, dataUrl: compressed, usedAt: Date.now() };
  } else {
    rec.usedAt = Date.now();
    await dbPut('reviewImages', rec);
  }
  state.reviewImage = rec;
  const revEl = document.getElementById('rev-img-preview');
  revEl.innerHTML = `<img src="${compressed}">`;
  revEl.classList.add('has-img');
  loadImageHistory('reviewImages', 'rev-img-history', (c) => {
    state.reviewImage = c;
    revEl.innerHTML = `<img src="${c.dataUrl}">`;
    revEl.classList.add('has-img');
    loadImageHistory('reviewImages', 'rev-img-history', null, c.hash);
  });
  e.target.value = '';
}
async function loadReviewImgHistory() {
  await loadImageHistory('reviewImages', 'rev-img-history', (c) => {
    state.reviewImage = c;
    const revEl = document.getElementById('rev-img-preview');
    revEl.innerHTML = `<img src="${c.dataUrl}">`;
    revEl.classList.add('has-img');
  });
}

/* Generic image-history renderer */
async function loadImageHistory(store, wrapId, onClick, activeHash) {
  const wrap = document.getElementById(wrapId);
  if (!wrap) return;
  const all = await dbGetAll(store);
  const sorted = all.sort((a, b) => b.usedAt - a.usedAt).slice(0, 8);
  const cur = activeHash || (state && state[storeToStateKey(store)] && state[storeToStateKey(store)].hash);
  wrap.innerHTML = '';
  sorted.forEach(c => {
    const t = document.createElement('div');
    t.className = 'img-thumb';
    if (cur && cur === c.hash) t.classList.add('active');
    t.style.backgroundImage = `url(${c.dataUrl})`;
    t.onclick = () => onClick && onClick(c);
    wrap.appendChild(t);
  });
}
function storeToStateKey(store) {
  if (store === 'skuImages') return 'skuImage';
  if (store === 'reviewImages') return 'reviewImage';
  if (store === 'covers') return 'cover';
  return null;
}
 /* ===== Form A: Task Card ===== */
function enterTaskForm() {
  showPage('page-form-task');
  loadCoverHistory();
  loadSkuImgHistory();
}
 
function toggleAction(row) {
  row.classList.toggle('checked');
}

function toggleActionAll(row) {
  const allRows = Array.from(document.querySelectorAll('[data-action]'))
    .filter(r => r.dataset.action !== 'custom');
  const allChecked = allRows.every(r => r.classList.contains('checked'));
  allRows.forEach(r => r.classList.toggle('checked', !allChecked));
}

function toggleCustomAction(row) {
   row.classList.toggle('checked');
   const isChecked = row.classList.contains('checked');
   const toggle = document.getElementById('action-custom-toggle');
   if (toggle.checked !== isChecked) {
     toggle.checked = isChecked;
     toggleCustomActionField();
   }
 }
 
 function toggleCustomActionField() {
   const t = document.getElementById('action-custom-toggle');
   const row = document.getElementById('action-custom-row');
   if (t.checked) {
     row.classList.remove('hidden');
     const r = t.closest('.check-row');
     if (r) r.classList.add('checked');
   } else {
     row.classList.add('hidden');
     const r = t.closest('.check-row');
     if (r) r.classList.remove('checked');
   }
 }
 
function togglePrice() {
  const t = document.getElementById('price-toggle');
  document.getElementById('price-options').classList.toggle('hidden', !t.checked);
  if (t.checked && !state.priceValue) {
    const first = document.querySelector('[data-price="20"]');
    if (first) pickPrice(first);
  }
}

/* Event delegation for price rows (ensure clicks work on mobile) */
const _priceOptsEl = document.getElementById('price-options');
if (_priceOptsEl) {
  // 兜底：内联 onclick 已经能处理大多数情况；这里只处理事件冒泡被吞的极端情况
  _priceOptsEl.addEventListener('click', (e) => {
    if (e.target.closest('.num-stepper')) return;
    const row = e.target.closest('[data-price]');
    if (row && !row.classList.contains('checked')) pickPrice(row);
  });
}

function pickPrice(row) {
   document.querySelectorAll('[data-price]').forEach(r => r.classList.remove('checked'));
   row.classList.add('checked');
   const v = row.dataset.price;
   if (v === 'custom') {
     const inp = document.getElementById('price-custom');
     state.priceValue = parseFloat(inp.value) || null;
   } else {
     state.priceValue = parseFloat(v);
   }
 }
 
function onPriceCustomInput() {
  const row = document.querySelector('[data-price="custom"]');
  const inp = document.getElementById('price-custom');
  if (!row || !inp) return;
  // 用户直接输入时，也自动选中自定义行
  if (inp.value && !row.classList.contains('checked')) pickPrice(row);
  if (row.classList.contains('checked')) {
    state.priceValue = parseFloat(inp.value) || null;
  }
}

function stepPrice(delta) {
  const inp = document.getElementById('price-custom');
  const row = document.querySelector('[data-price="custom"]');
  if (delta !== 0) {
    const cur = parseFloat(inp.value) || 0;
    inp.value = Math.max(0, cur + delta);
  }
  if (row && !row.classList.contains('checked')) pickPrice(row);
  state.priceValue = parseFloat(inp.value) || null;
}

function stepLen(delta) {
  const inp = document.getElementById('rev-len-custom');
  const cur = parseInt(inp.value) || 0;
  const next = Math.max(1, cur + delta);
  inp.value = next;
  state.selectedLengthCustom = next;
  const row = document.querySelector('[data-len="custom"]');
  if (row && !row.classList.contains('checked')) pickLen(row);
}
 
 function toggleSku() {
   const t = document.getElementById('sku-toggle');
   document.getElementById('sku-section').classList.toggle('hidden', !t.checked);
 }
 async function generateTaskCard() {
   const store = document.getElementById('task-store').value.trim();
   const product = document.getElementById('task-product').value.trim();
   if (!store) { showToast('请填写店铺'); return; }
   if (!product) { showToast('请填写商品名称'); return; }
   if (!state.cover) { showToast('请上传封面图'); return; }
   const kwSuggest = document.getElementById('task-kw-suggest').value.trim();
   if (!kwSuggest) { showToast('请填写建议搜索词'); return; }
 
  const actions = {};
  document.querySelectorAll('[data-action]').forEach(r => {
    actions[r.dataset.action] = r.classList.contains('checked');
  });
  actions.customText = document.getElementById('action-custom-toggle').checked
    ? document.getElementById('action-custom-text').value.trim()
    : '';

  if (store) await recordTerm('store', store);
  if (product) await recordTerm('product', product);
  if (kwSuggest) await recordTerm('keyword', kwSuggest);
  for (const id of ['task-kw-alt1', 'task-kw-alt2', 'task-kw-alt3']) {
    const v = document.getElementById(id).value.trim();
    if (v) await recordTerm('keyword', v);
  }
  if (actions.customText) await recordTerm('action', actions.customText);
 
   const skuEnabled = document.getElementById('sku-toggle').checked;
   if (skuEnabled) {
     const hasImg = !!state.skuImage;
     const hasText = !!document.getElementById('task-sku-text').value.trim();
     if (!hasImg && !hasText) {
       showToast('下单要求：图片和文字至少填一项');
       return;
     }
   }
 
   const data = {
     store,
     product,
     cover: state.cover ? { dataUrl: state.cover.dataUrl, hash: state.cover.hash } : null,
     kwSuggest,
     kwAlt: [
       document.getElementById('task-kw-alt1').value.trim(),
       document.getElementById('task-kw-alt2').value.trim(),
       document.getElementById('task-kw-alt3').value.trim()
     ].filter(Boolean),
     actions,
     price: document.getElementById('price-toggle').checked ? state.priceValue : null,
     sku: skuEnabled ? {
       image: state.skuImage ? state.skuImage.dataUrl : null,
       text: document.getElementById('task-sku-text').value.trim()
     } : null,
     createdAt: Date.now()
   };
 
   showLoading('生成中...');
   try {
     const dataUrl = await renderTaskCard(data);
     state.lastTask = data;
     state.lastCardDataUrl = dataUrl;
     await dbAdd('tasks', Object.assign({}, data, { cardDataUrl: dataUrl }));
     showTaskCardResult(data, dataUrl);
     showPage('page-result-task');
   } catch (e) {
     console.error(e);
     showToast('生成失败：' + e.message);
   } finally {
     hideLoading();
   }
 }
 
 async function renderTaskCard(data) {
   const wrap = document.createElement('div');
   wrap.style.position = 'fixed';
   wrap.style.left = '-9999px';
   wrap.style.top = '0';
   wrap.style.background = '#fff';
   wrap.innerHTML = taskCardHTML(data);
   document.body.appendChild(wrap);
   const imgs = wrap.querySelectorAll('img');
   await Promise.all(Array.from(imgs).map(img => {
     if (img.complete) return Promise.resolve();
     return new Promise(r => { img.onload = r; img.onerror = r; });
   }));
   const canvas = await html2canvas(wrap.firstElementChild, {
     scale: 2,
     backgroundColor: '#ffffff',
     useCORS: true,
     logging: false
   });
   document.body.removeChild(wrap);
   return canvas.toDataURL('image/png');
 }
 
 function taskCardHTML(data) {
   const actionLabels = {
     cart: '添加至购物车',
     fav: '收藏商品',
     follow: '关注店铺',
     compare: '货比两家',
     chat: '与客服互动'
   };
   const checkedActions = Object.keys(actionLabels).filter(k => data.actions[k]);
   if (data.actions.custom && data.actions.customText) {
     checkedActions.push(data.actions.customText);
   }
   const actionsHTML = checkedActions.length
     ? checkedActions.map(a => `<div class="tc-action"><span class="dot">✓</span> ${escapeHtml(a)}</div>`).join('')
     : '<div class="tc-action" style="color:#8e8e93">无营销动作要求</div>';
 
   const keywordsHTML = [data.kwSuggest].concat(data.kwAlt)
     .map((k, i) => `<span class="tc-keyword${i === 0 ? '' : ' alt'}">${escapeHtml(k)}</span>`)
     .join('');
 
   const priceHTML = data.price
     ? `<div class="tc-section"><div class="tc-section-title">价格调整</div><div class="tc-price">¥ ${data.price}</div></div>`
     : '';
 
   const skuHTML = data.sku
     ? `<div class="tc-section"><div class="tc-section-title">下单要求</div>
          <div class="tc-sku">${data.sku.text ? escapeHtml(data.sku.text) : ''}${data.sku.image ? `<img src="${data.sku.image}">` : ''}</div>
        </div>`
     : '';
 
   return `<div class="task-card-preview" style="width:360px;margin:0">
     <div class="tc-header">
       <div class="tc-cover" style="background-image:url(${data.cover ? data.cover.dataUrl : ''})"></div>
       <div style="flex:1;min-width:0">
         <div class="tc-title">${escapeHtml(data.product)}</div>
         <div class="tc-store">${escapeHtml(data.store)}</div>
       </div>
     </div>
     <div class="tc-section">
       <div class="tc-section-title">搜索关键词</div>
       <div class="tc-keywords">${keywordsHTML}</div>
     </div>
     <div class="tc-section">
       <div class="tc-section-title">营销动作</div>
       ${actionsHTML}
     </div>
     ${priceHTML}
     ${skuHTML}
   </div>`;
 }
 
 function showTaskCardResult(data, dataUrl) {
   document.getElementById('task-card-img-wrap').innerHTML = `<img src="${dataUrl}">`;
   document.getElementById('task-card-text-content').textContent = buildTaskText(data);
 }
 
 function buildTaskText(data) {
   const lines = [];
   lines.push('【店铺】' + data.store);
   lines.push('【商品】' + data.product);
   lines.push('【搜索词】' + data.kwSuggest + (data.kwAlt.length ? ' / ' + data.kwAlt.join(' / ') : ''));
   const actionLabels = { cart: '加购物车', fav: '收藏', follow: '关注', compare: '货比', chat: '问客服' };
   const acts = Object.keys(actionLabels).filter(k => data.actions[k]).map(k => actionLabels[k]);
   if (data.actions.custom && data.actions.customText) acts.push(data.actions.customText);
   lines.push('【动作】' + (acts.join('、') || '无'));
   if (data.price) lines.push('【改价】¥' + data.price);
   if (data.sku) {
     const skuBits = [];
     if (data.sku.text) skuBits.push(data.sku.text);
     if (data.sku.image) skuBits.push('[附图]');
     lines.push('【下单】' + skuBits.join(' '));
   }
   return lines.join('\n');
 }
 
 function saveTaskCardImg() {
   if (!state.lastCardDataUrl) { showToast('暂无图片'); return; }
   downloadDataURL(state.lastCardDataUrl, 'task-' + Date.now() + '.png');
 }
 
 function downloadDataURL(dataUrl, filename) {
   const a = document.createElement('a');
   a.href = dataUrl;
   a.download = filename;
   document.body.appendChild(a);
   a.click();
   document.body.removeChild(a);
 }
 /* ===== Form B: Review ===== */
function enterReviewForm() {
  showPage('page-form-review');
  bindReviewInputs();
  bindStyleIntensities();
  updateSummaryCount();
  loadReviewImgHistory();
}
 
 function bindReviewInputs() {
   const ta = document.getElementById('rev-summary');
   ta.oninput = updateSummaryCount;
 }
 
 function updateSummaryCount() {
   const v = document.getElementById('rev-summary').value;
   document.getElementById('rev-summary-count').textContent = v.length;
 }
 
 function pickLen(row) {
   document.querySelectorAll('[data-len]').forEach(r => r.classList.remove('checked'));
   row.classList.add('checked');
   const v = row.dataset.len;
   if (v === 'custom') {
     state.selectedLength = 'custom';
     state.selectedLengthCustom = parseInt(document.getElementById('rev-len-custom').value) || null;
   } else {
     state.selectedLength = parseInt(v);
     state.selectedLengthCustom = null;
   }
 }
 
 function toggleKw(row) {
   row.classList.toggle('checked');
   const v = row.dataset.kw;
   if (row.classList.contains('checked')) state.selectedKw.add(v);
   else state.selectedKw.delete(v);
 }
 
 function toggleCustomKw(row) {
   row.classList.toggle('checked');
   const t = document.getElementById('kw-custom-toggle');
   if (row.classList.contains('checked')) {
     t.checked = true;
     document.getElementById('kw-custom-row').classList.remove('hidden');
   } else {
     t.checked = false;
     document.getElementById('kw-custom-row').classList.add('hidden');
   }
 }
 
 function toggleCustomKwField() {
   const t = document.getElementById('kw-custom-toggle');
   const row = document.getElementById('kw-custom-row');
   const checkRow = t.closest('.check-row');
   if (t.checked) {
     row.classList.remove('hidden');
     if (checkRow) checkRow.classList.add('checked');
     state.selectedKw.add('__custom__');
   } else {
     row.classList.add('hidden');
     if (checkRow) checkRow.classList.remove('checked');
     state.selectedKw.delete('__custom__');
   }
 }
 function toggleStyle(row) {
   row.classList.toggle('checked');
   const name = row.dataset.style;
   if (row.classList.contains('checked')) {
     const mat = STYLE_MATRIX[name];
     state.selectedStyles.set(name, mat === null ? 'none' : 'default');
   } else {
     state.selectedStyles.delete(name);
   }
 }
 
 function toggleCustomStyle(row) {
   row.classList.toggle('checked');
   const t = document.getElementById('style-custom-toggle');
   if (row.classList.contains('checked')) {
     t.checked = true;
     document.getElementById('style-custom-row').classList.remove('hidden');
   } else {
     t.checked = false;
     document.getElementById('style-custom-row').classList.add('hidden');
   }
 }
 
 function toggleCustomStyleField() {
   const t = document.getElementById('style-custom-toggle');
   const row = document.getElementById('style-custom-row');
   const checkRow = t.closest('.check-row');
   if (t.checked) {
     row.classList.remove('hidden');
     if (checkRow) checkRow.classList.add('checked');
     state.selectedStyles.set('__custom__', 'none');
   } else {
     row.classList.add('hidden');
     if (checkRow) checkRow.classList.remove('checked');
     state.selectedStyles.delete('__custom__');
   }
 }
 
 function bindStyleIntensities() {
   document.querySelectorAll('[data-style]').forEach(row => {
     const name = row.dataset.style;
     const mat = STYLE_MATRIX[name];
     if (mat === undefined) return;
     const segs = row.querySelectorAll('.seg');
     segs.forEach(seg => {
       seg.onclick = (e) => {
         e.stopPropagation();
         if (mat === null) return;
         segs.forEach(s => s.classList.remove('active'));
         seg.classList.add('active');
         if (row.classList.contains('checked')) {
           state.selectedStyles.set(name, seg.dataset.int);
         }
       };
     });
   });
 }
 
 function pickId(row) {
   document.querySelectorAll('[data-id]').forEach(r => r.classList.remove('checked'));
   row.classList.add('checked');
   state.selectedId = row.dataset.id;
   document.getElementById('id-custom-text').value = '';
 }
 function pickCustomId(row) {
   document.querySelectorAll('[data-id]').forEach(r => r.classList.remove('checked'));
   row.classList.add('checked');
   state.selectedId = '__custom__';
 }
 
 function onReviewEdit(text) {
   if (state.lastReview) {
     state.lastReview.text = text;
     state.lastReview.edited = true;
   }
   const counter = document.getElementById('review-edit-count');
   if (counter) counter.textContent = text.length;
 }

 /* ===== Random helpers ===== */
function randomLen() {
  const rows = document.querySelectorAll('[data-len]');
  rows.forEach(r => r.classList.remove('checked'));
  // 权重：20 和 30 出现概率高一些
  const pool = [20, 20, 30, 30, 30, 40, 60];
  const pick = pool[Math.floor(Math.random() * pool.length)];
  const row = document.querySelector('[data-len="' + pick + '"]');
  if (row) {
     row.classList.add('checked');
     state.selectedLength = pick;
     state.selectedLengthCustom = null;
   }
 }
 
 function randomKw() {
   const rows = Array.from(document.querySelectorAll('[data-kw]')).filter(r => r.dataset.kw !== '__custom__');
  rows.forEach(r => r.classList.remove('checked'));
  state.selectedKw.clear();
  const count = 1 + Math.floor(Math.random() * 4); // 1-4
  const shuffled = rows.sort(() => Math.random() - 0.5).slice(0, count);
   shuffled.forEach(row => {
     row.classList.add('checked');
     state.selectedKw.add(row.dataset.kw);
   });
   // 隐藏自定义输入
   const t = document.getElementById('kw-custom-toggle');
   if (t) { t.checked = false; }
   const r = document.getElementById('kw-custom-row');
   if (r) r.classList.add('hidden');
 }
 
function randomStyle() {
  const rows = Array.from(document.querySelectorAll('[data-style]'))
    .filter(r => r.dataset.style !== '__custom__');
  rows.forEach(r => r.classList.remove('checked'));
  state.selectedStyles.clear();
  // 风格池：排除「一般」（无强度档位）
  const valid = rows.filter(r => {
    const name = r.dataset.style;
    return name !== '一般' && STYLE_MATRIX[name] !== null && STYLE_MATRIX[name] !== undefined;
  });
  // 2-6 个风格
  const count = 2 + Math.floor(Math.random() * 5); // 2,3,4,5,6
  const shuffled = valid.sort(() => Math.random() - 0.5).slice(0, count);
  const intensityPool = ['default', 'low', 'mid', 'high'];
  shuffled.forEach(row => {
    row.classList.add('checked');
    let intensity = 'default';
    if (arguments[0] === 'strong') {
      intensity = intensityPool[Math.floor(Math.random() * intensityPool.length)];
    }
    state.selectedStyles.set(row.dataset.style, intensity);
    // 同步 segmented UI 高亮
    const segs = row.querySelectorAll('.seg');
    segs.forEach(s => s.classList.remove('active'));
    const target = row.querySelector('.seg[data-int="' + intensity + '"]');
    if (target) target.classList.add('active');
    else if (segs[0]) segs[0].classList.add('active');
  });
  // 隐藏自定义输入
  const t = document.getElementById('style-custom-toggle');
  if (t) { t.checked = false; }
  const r = document.getElementById('style-custom-row');
  if (r) r.classList.add('hidden');
}
 
 function randomId() {
   const rows = Array.from(document.querySelectorAll('[data-id]'))
     .filter(r => r.dataset.id !== '__custom__');
   rows.forEach(r => r.classList.remove('checked'));
   state.selectedId = null;
   document.getElementById('id-custom-text').value = '';
   if (rows.length === 0) return;
   const pick = rows[Math.floor(Math.random() * rows.length)];
   pick.classList.add('checked');
   state.selectedId = pick.dataset.id;
 }

function pickTarget(row) {
  document.querySelectorAll('[data-target]').forEach(r => r.classList.remove('checked'));
  row.classList.add('checked');
  state.selectedTarget = row.dataset.target;
  document.getElementById('target-custom-text').value = '';
}

function randomTarget() {
  const rows = Array.from(document.querySelectorAll('[data-target]'))
    .filter(r => r.dataset.target !== '__custom__');
  rows.forEach(r => r.classList.remove('checked'));
  state.selectedTarget = null;
  document.getElementById('target-custom-text').value = '';
  if (rows.length === 0) return;
  const pick = rows[Math.floor(Math.random() * rows.length)];
  pick.classList.add('checked');
  state.selectedTarget = pick.dataset.target;
}
 function pickTargetCustom(row) {
   document.querySelectorAll('[data-target]').forEach(r => r.classList.remove('checked'));
   row.classList.add('checked');
   state.selectedTarget = '__custom__';
 }
  /* ===== Generate Review (LLM) ===== */
 async function generateReview() {
   const summary = document.getElementById('rev-summary').value.trim();
   if (!summary) { showToast('请填写需求概括'); return; }
   if (summary.length > 60) { showToast('需求概括不超过 60 字'); return; }
  if (state.selectedKw.size === 0) { showToast('请至少选择 1 个关键词体现'); return; }
 
   const length = state.selectedLength === 'custom'
     ? (parseInt(document.getElementById('rev-len-custom').value) || 20)
     : state.selectedLength;
 
   const kws = Array.from(state.selectedKw).map(k => {
     if (k === '__custom__') return document.getElementById('kw-custom-text').value.trim();
     return k;
   }).filter(Boolean);
  if (kws.length === 0) { showToast('请至少选择 1 个关键词体现'); return; }
 
   const styles = [];
   for (const [name, intensity] of state.selectedStyles) {
     if (name === '__custom__') {
       const txt = document.getElementById('style-custom-text').value.trim();
       if (txt) styles.push({ name: 'custom', text: txt, intensity: 'none' });
     } else {
       styles.push({ name, intensity });
     }
   }
 
  let identity = null;
  if (state.selectedId === '__custom__') {
    identity = document.getElementById('id-custom-text').value.trim() || null;
    if (identity) await recordTerm('id', identity);
  } else if (state.selectedId) {
    identity = state.selectedId;
  }

  let target = null;
  if (state.selectedTarget === '__custom__') {
    target = document.getElementById('target-custom-text').value.trim() || null;
    if (target) await recordTerm('target', target);
  } else if (state.selectedTarget) {
    target = state.selectedTarget;
  }

  if (summary) await recordTerm('summary', summary);
  for (const k of kws) {
    if (k && state.selectedKw.has('__custom__') && k === document.getElementById('kw-custom-text').value.trim()) {
      await recordTerm('kw', k);
    }
  }
  for (const s of styles) {
    if (s.name === 'custom' && s.text) await recordTerm('style', s.text);
  }

  const prompt = buildDeepSeekPrompt({ summary, length, kws, styles, identity, target });
   showLoading('AI 正在撰写...');
   try {
     const text = await callLLM(prompt);
     state.lastReview = {
       summary, length, kws, styles, identity, target,
       text, image: state.reviewImage ? state.reviewImage.dataUrl : null,
       createdAt: Date.now()
     };
    await dbAdd('reviews', Object.assign({}, state.lastReview));
    document.getElementById('review-text-content').textContent = text;
    onReviewEdit(text);
    showPage('page-result-review');
   } catch (e) {
     console.error(e);
     showToast('生成失败：' + e.message);
   } finally {
     hideLoading();
   }
 }
 
function buildDeepSeekPrompt({ summary, length, kws, styles, identity, target }) {
  let p = '';
  p += '【任务】你是一个真实买家，根据用户要求写一条电商商品买家秀评价。**只输出评价文本本身**，不要任何前缀、标题、解释、引号、表情。\n\n';
  p += '【字数】' + length + '±3 字（严格控制）\n\n';
  p += '【用户需求概括】' + summary + '\n\n';
  if (target) {
    p += '【目标产品】' + target + '（这条评价是关于该产品的，用户需求概括里不要再写产品名）\n\n';
  }
 p += '【关键词体现】在评价中自然融入以下要素（不要直接列出，要自然表达）：' + kws.join('、') + '\n\n';
  if (styles.length) {
    p += '【语句风格】按以下风格组合执行：\n';
    styles.forEach(s => {
      if (s.name === 'custom') {
        p += '- 自定义风格：' + s.text + '\n';
      } else if (s.intensity === 'none') {
        p += '- ' + s.name + '风格\n';
      } else {
        const actualIntensity = s.intensity === 'default'
          ? ['low', 'mid', 'high'][Math.floor(Math.random() * 3)]
          : s.intensity;
        const desc = STYLE_MATRIX[s.name][actualIntensity];
        p += '- ' + s.name + '（' + intensityLabel(actualIntensity) + '）：' + desc + '\n';
      }
    });
    p += '\n';
  }
  if (identity === '不强调身份') {
    p += '【身份视角】不强调特定身份，以普通买家的口吻写，场景和关注点自由。\n\n';
  } else if (identity) {
    p += '【身份视角】用「' + identity + '」这个身份的口吻、场景和关注点来写。但「' + identity + '」这个词本身**不要刻意出现在评价里**，除非自然带出（比如学生党提到"室友"、"考试周"是自然的；上班族说"加班"、"通勤"是自然的；情侣提到"另一半"是自然的）。重点是用这个身份的方式说话，不是给评价打身份标签。\n\n';
  }
  p += '【输出要求】\n';
  p += '- 只输出评价文本，不超过字数上下限\n';
  p += '- emoji / 标点 / 用词 都严格按风格执行\n';
  p += '- 真实感 > 文采，**要看起来像真人发的，不是 AI 写的**\n';
  return p;
}
 
 function intensityLabel(i) {
   return { high: '高强度', mid: '中强度', low: '低强度' }[i] || i;
 }
 
 async function callLLM(prompt) {
   const s = state.settings || {};
   const key = s.apiKey || '';
   const base = (s.apiBase || DEFAULT_SETTINGS.apiBase).replace(/\/+$/, '');
   const model = s.model || DEFAULT_SETTINGS.model;
   if (!key) throw new Error('请先在设置中填入 API Key');
   if (!base) throw new Error('请先在设置中填入 API 地址');
   const url = base + '/chat/completions';
   const res = await fetch(url, {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'Authorization': 'Bearer ' + key,
       ...(s.provider === 'volcano' ? {} : {})
     },
     body: JSON.stringify({
       model,
       messages: [
         { role: 'system', content: '你是一个专业的电商买家秀评价撰写助手。' },
         { role: 'user', content: prompt }
       ],
       temperature: 0.95,
       max_tokens: 500
     })
   });
   if (!res.ok) {
     const t = await res.text();
     throw new Error(res.status + ' ' + t.slice(0, 100));
   }
   const data = await res.json();
   return (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '').trim();
 }

async function regenerateReview() {
  if (!state.lastReview) return;
  if (state.lastReview.edited) {
    const ok = confirm('当前评语已编辑过，重新生成会覆盖。继续？');
    if (!ok) return;
  }
  showLoading('重新生成中...');
  try {
    const prompt = buildDeepSeekPrompt(state.lastReview);
    const text = await callLLM(prompt);
    state.lastReview.text = text;
    state.lastReview.edited = false;
    state.lastReview.createdAt = Date.now();
    const all = await dbGetAll('reviews');
    const sorted = all.sort((a, b) => b.createdAt - a.createdAt);
     if (sorted[0]) {
       sorted[0].text = text;
       sorted[0].createdAt = state.lastReview.createdAt;
       await dbPut('reviews', sorted[0]);
     }
     document.getElementById('review-text-content').textContent = text;
      onReviewEdit(text);
    } catch (e) {
      showToast('失败：' + e.message);
   } finally {
     hideLoading();
   }
 }
 /* ===== Dispatch: Upload + QR ===== */
 function enterDispatch() {
   if (!state.lastTask) { showToast('请先生成任务卡'); return; }
   if (!state.lastReview) { showToast('请先生成评语'); return; }
   if (!state.settings || !state.settings.baseUrl) { showToast('请先在设置中填入 GitHub Pages 地址'); return; }
   showPage('page-dispatch');
 }
 
 function refreshDispatch() {
   const tEl = document.getElementById('dispatch-task-info');
   const rEl = document.getElementById('dispatch-review-info');
   if (state.lastTask) {
     tEl.textContent = state.lastTask.store + ' · ' + state.lastTask.product;
     tEl.classList.remove('text-tertiary');
   } else {
     tEl.textContent = '未选择';
     tEl.classList.add('text-tertiary');
   }
   if (state.lastReview) {
     const preview = (state.lastReview.text || '').slice(0, 18) + '...';
     rEl.textContent = preview;
     rEl.classList.remove('text-tertiary');
   } else {
     rEl.textContent = '未选择';
     rEl.classList.add('text-tertiary');
   }
   document.getElementById('dispatch-result').classList.add('hidden');
   document.getElementById('dispatch-btn').classList.remove('hidden');
 }
 
 async function generateDispatchQR() {
   if (!state.lastTask || !state.lastReview) return;
   const btn = document.getElementById('dispatch-btn');
   btn.classList.add('hidden');
   showLoading('上传中...');
   try {
     const payload = {
       v: 1,
       created: Date.now(),
       task: Object.assign({}, state.lastTask, { cardDataUrl: state.lastCardDataUrl }),
       review: {
         text: state.lastReview.text,
         image: state.lastReview.image,
         summary: state.lastReview.summary,
         target: state.lastReview.target
       }
     };
     const dataUrl = await uploadToPaste(payload);
     const base = (state.settings.baseUrl || '').replace(/\/+$/, '');
     const viewerUrl = base + '/viewer.html?data=' + encodeURIComponent(dataUrl);
     await renderQR(viewerUrl);
     document.getElementById('qr-url-text').textContent = viewerUrl;
     document.getElementById('dispatch-result').classList.remove('hidden');
   } catch (e) {
     console.error(e);
     showToast('上传失败：' + e.message);
     btn.classList.remove('hidden');
   } finally {
     hideLoading();
   }
 }
 
 async function uploadToPaste(payload) {
   const token = (state.settings && state.settings.githubToken) || '';
   if (token) {
     return await uploadToGist(payload, token);
   }
   const url = (state.settings && state.settings.pasteUrl) || DEFAULT_SETTINGS.pasteUrl;
   const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
   const file = new File([blob], 'task-' + Date.now() + '.json', { type: 'application/json' });
   const fd = new FormData();
   fd.append('reqtype', 'fileupload');
   fd.append('fileToUpload', file);
   const res = await fetch(url, { method: 'POST', body: fd });
   if (!res.ok) {
     const t = await res.text();
     throw new Error(res.status + ' ' + t.slice(0, 80));
   }
   return (await res.text()).trim();
 }

 async function uploadToGist(payload, token) {
   const res = await fetch('https://api.github.com/gists', {
     method: 'POST',
     headers: {
       'Authorization': 'Bearer ' + token,
       'Content-Type': 'application/json',
       'Accept': 'application/vnd.github+json'
     },
     body: JSON.stringify({
       description: 'workorder-dispatch-' + Date.now(),
       public: true,
       files: {
         'data.json': { content: JSON.stringify(payload) }
       }
     })
   });
   if (!res.ok) {
     const t = await res.text();
     throw new Error(res.status + ' ' + t.slice(0, 120));
   }
   const data = await res.json();
   if (!data.files || !data.files['data.json'] || !data.files['data.json'].raw_url) {
     throw new Error('Gist 返回异常');
   }
   return data.files['data.json'].raw_url;
 }
 
 async function renderQR(text) {
   const container = document.getElementById('qr-canvas');
   container.innerHTML = '';
   return new Promise((res, rej) => {
     try {
       new QRCode(container, {
         text: text,
         width: 240,
         height: 240,
         colorDark: '#000',
         colorLight: '#fff',
         correctLevel: QRCode.CorrectLevel.M
       });
       const canvas = container.querySelector('canvas');
       res(canvas || container);
     } catch (e) {
       rej(e);
     }
   });
 }
 
 async function saveQRImg() {
   const canvas = document.querySelector('#qr-canvas canvas');
   if (!canvas) { showToast('暂无二维码'); return; }
   const url = canvas.toDataURL('image/png');
   downloadDataURL(url, 'dispatch-qr-' + Date.now() + '.png');
 }
 
 async function copyQRUrl() {
   const t = document.getElementById('qr-url-text').textContent;
   try {
     await navigator.clipboard.writeText(t);
     showToast('链接已复制');
   } catch (e) {
     showToast('复制失败');
   }
 }
 /* ===== Home refresh ===== */
 function refreshHome() {
   const c = document.getElementById('dispatch-card');
   if (state.lastTask && state.lastReview) {
     c.style.display = 'flex';
   } else {
     c.style.display = 'none';
   }
 }
 
 /* ===== History ===== */
 async function loadHistory() {
   await Promise.all([loadTaskHistory(), loadReviewHistory()]);
 }
 
 function switchHistoryTab(btn) {
   document.querySelectorAll('[data-tab]').forEach(b => b.classList.remove('active'));
   btn.classList.add('active');
   const tab = btn.dataset.tab;
   document.getElementById('history-task-list').classList.toggle('hidden', tab !== 'task');
   document.getElementById('history-review-list').classList.toggle('hidden', tab !== 'review');
 }
 
 async function loadTaskHistory() {
   const list = document.getElementById('history-task-list');
   list.innerHTML = '';
   const all = await dbGetAll('tasks');
   const sorted = all.sort((a, b) => b.createdAt - a.createdAt);
   if (!sorted.length) {
    list.innerHTML = '<div class="empty"><div class="empty-title">还没有任务卡</div>生成的任务卡会出现在这里</div>';
     return;
   }
   sorted.forEach(t => {
     const item = document.createElement('div');
     item.className = 'history-item';
     const thumb = t.cover ? t.cover.dataUrl : '';
     const time = new Date(t.createdAt).toLocaleString('zh-CN', { hour12: false });
     const thumbStyle = thumb ? 'background-image:url(' + thumb + ')' : '';
     const thumbText = thumb ? '' : '无图';
     item.innerHTML = '<div class="thumb" style="' + thumbStyle + '">' + thumbText + '</div>' +
       '<div class="meta">' +
       '<div class="h-title">' + escapeHtml(t.product) + '</div>' +
       '<div class="h-sub">' + escapeHtml(t.store) + '</div>' +
       '<div class="h-time">' + time + '</div>' +
       '</div>';
     item.onclick = () => {
       state.lastTask = t;
       state.lastCardDataUrl = t.cardDataUrl;
       showTaskCardResult(t, t.cardDataUrl);
       showPage('page-result-task');
     };
     list.appendChild(item);
   });
 }
 
 async function loadReviewHistory() {
   const list = document.getElementById('history-review-list');
   list.innerHTML = '';
   const all = await dbGetAll('reviews');
   const sorted = all.sort((a, b) => b.createdAt - a.createdAt);
   if (!sorted.length) {
    list.innerHTML = '<div class="empty"><div class="empty-title">还没有评语</div>生成的评语会出现在这里</div>';
     return;
   }
   sorted.forEach(r => {
     const item = document.createElement('div');
     item.className = 'history-item';
     const thumb = r.image || '';
     const time = new Date(r.createdAt).toLocaleString('zh-CN', { hour12: false });
     const preview = (r.text || '').slice(0, 40) + ((r.text && r.text.length > 40) ? '...' : '');
     const thumbStyle = thumb ? 'background-image:url(' + thumb + ')' : '';
     const thumbText = thumb ? '' : '文';
     item.innerHTML = '<div class="thumb" style="' + thumbStyle + '">' + thumbText + '</div>' +
       '<div class="meta">' +
       '<div class="h-title">' + escapeHtml(preview) + '</div>' +
       '<div class="h-sub">' + escapeHtml(r.target || '未指定产品') + '</div>' +
       '<div class="h-time">' + time + '</div>' +
       '</div>';
   item.onclick = () => {
     state.lastReview = r;
     document.getElementById('review-text-content').textContent = r.text;
     onReviewEdit(r.text);
     showPage('page-result-review');
   };
     list.appendChild(item);
   });
 }
 
 /* ===== Data management ===== */
 async function confirmClearHistory() {
   if (!confirm('确定清空历史记录（任务卡、评语、词条、封面）？此操作不可恢复。')) return;
   await dbClear('tasks');
   await dbClear('reviews');
   await dbClear('terms');
   await dbClear('covers');
   showToast('已清空');
 }
 async function confirmClearAll() {
   if (!confirm('确定清空所有数据（含设置）？此操作不可恢复。')) return;
   if (!confirm('再次确认：所有数据将永久删除')) return;
   for (const s of ['terms', 'covers', 'tasks', 'reviews', 'settings']) {
     await dbClear(s);
   }
   showToast('已清空');
   setTimeout(() => location.reload(), 800);
 }
 /* ===== Init ===== */
 async function init() {
   updateClock();
   setInterval(updateClock, 30000);
   await loadSettings();
 
   document.querySelectorAll('[data-confirm-input]').forEach(btn => {
     btn.addEventListener('click', () => confirmInput(btn));
   });
 
  // History dropdown: focus on any input with data-history → show dropdown
  document.addEventListener('focusin', (e) => {
    const t = e.target;
    if (t && t.dataset && t.dataset.history) {
      showHistoryDropdown(t.dataset.history, t);
    }
  });
  // Close on click outside / focus outside
  document.addEventListener('mousedown', (e) => {
    const dd = document.getElementById('history-dropdown');
    if (!dd || dd.hidden) return;
    if (dd.contains(e.target)) return;
    if (e.target.dataset && e.target.dataset.history) return;
    hideHistoryDropdown();
  }, true);
  document.addEventListener('touchstart', (e) => {
    const dd = document.getElementById('history-dropdown');
    if (!dd || dd.hidden) return;
    if (dd.contains(e.target)) return;
    if (e.target.dataset && e.target.dataset.history) return;
    hideHistoryDropdown();
  }, true);
 
   document.getElementById('cover-input').addEventListener('change', onCoverSelected);
   document.getElementById('sku-img-input').addEventListener('change', onSkuImgSelected);
   document.getElementById('rev-img-input').addEventListener('change', onReviewImgSelected);
   document.getElementById('price-custom').addEventListener('input', onPriceCustomInput);
 
   refreshHome();
}

// iOS 26 液态玻璃水滴：监听所有 .switch 的状态变化，触发水滴展开动画
function bindLiquidGlassSwitches() {
  document.querySelectorAll('.switch').forEach(sw => {
    const input = sw.querySelector('input[type="checkbox"]');
    const slider = sw.querySelector('.slider');
    if (!input || !slider) return;
    input.addEventListener('change', () => {
      slider.classList.remove('flipping-on', 'flipping-off');
      void slider.offsetWidth;
      slider.classList.add(input.checked ? 'flipping-on' : 'flipping-off');
      setTimeout(() => {
        slider.classList.remove('flipping-on', 'flipping-off');
      }, 600);
    });
  });
}

document.addEventListener('DOMContentLoaded', init);
