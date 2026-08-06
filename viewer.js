 /* ======================================================================
  * 员工查看页 - viewer.js
  * 从 URL ?data=<catbox-url> 拉取 JSON 并展示
  * ====================================================================== */

 function escapeHtml(s) {
   return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
 }

 function showToast(text) {
   const el = document.getElementById('toast');
   el.textContent = text;
   el.classList.add('show');
   setTimeout(() => el.classList.remove('show'), 2000);
 }

 function openLightbox(src) {
   document.getElementById('lightbox-img').src = src;
   document.getElementById('lightbox').classList.add('show');
 }
 function closeLightbox() {
   document.getElementById('lightbox').classList.remove('show');
 }

 /* 复制纯文本到剪贴板 */
 async function copyTextToClipboard(text) {
   if (!text) return;
   try {
     await navigator.clipboard.writeText(text);
     showToast('已复制');
   } catch (e) {
     const ta = document.createElement('textarea');
     ta.value = text;
     ta.style.position = 'fixed';
     ta.style.opacity = '0';
     document.body.appendChild(ta);
     ta.select();
     try { document.execCommand('copy'); showToast('已复制'); }
     catch (e2) { showToast('复制失败'); }
     document.body.removeChild(ta);
   }
 }

 /* 复制元素内文本 */
 async function copyText(elemId) {
   const el = document.getElementById(elemId);
   if (!el) return;
   copyTextToClipboard(el.innerText);
 }

 /* 复制图片到剪贴板（必须转 PNG）。
    安卓 WeChat / 老内核浏览器对 ClipboardItem 写图支持很差，
    失败时降级为：打开大图让用户长按保存到相册。 */
 async function copyImageToClipboard(dataUrl) {
   if (!dataUrl) return;
   if (navigator.clipboard && navigator.clipboard.write && window.ClipboardItem) {
     try {
       const img = new Image();
       await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
       const c = document.createElement('canvas');
       c.width = img.naturalWidth;
       c.height = img.naturalHeight;
       c.getContext('2d').drawImage(img, 0, 0);
       const pngBlob = await new Promise((res, rej) => {
         c.toBlob(b => b ? res(b) : rej(new Error('toBlob failed')), 'image/png');
       });
       await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
       showToast('已复制图片，去聊天窗口粘贴');
       return;
     } catch (e) {
       console.warn('clipboard.write failed, fallback to long-press:', e);
     }
   }
   /* 降级：打开大图，用户长按图片保存到相册 */
   openLightbox(dataUrl);
   showToast('请长按图片保存到相册');
 }

 function copyCoverImg() {
   if (!window._currentTask || !window._currentTask.cover) return;
   copyImageToClipboard(window._currentTask.cover.dataUrl);
 }
 function copySkuImg() {
   if (!window._currentTask || !window._currentTask.sku) return;
   copyImageToClipboard(window._currentTask.sku.image);
 }
 function copyReviewImg() {
   if (!window._currentReview || !window._currentReview.image) return;
   copyImageToClipboard(window._currentReview.image);
 }

 /* 标签长按复制（兼容移动端 + 桌面右键） */
 function bindLongPress(el) {
   const text = el.dataset.copy || el.textContent.trim();
   if (!text) return;
   let timer = null, moved = false, sx = 0, sy = 0;

   const start = (e) => {
     moved = false;
     const t = e.touches ? e.touches[0] : e;
     sx = t.clientX; sy = t.clientY;
     timer = setTimeout(() => {
       if (!moved) {
         copyTextToClipboard(text);
         if (navigator.vibrate) navigator.vibrate(30);
       }
     }, 500);
   };
   const move = (e) => {
     if (!timer) return;
     const t = e.touches ? e.touches[0] : e;
     if (Math.abs(t.clientX - sx) > 8 || Math.abs(t.clientY - sy) > 8) {
       moved = true; clearTimeout(timer); timer = null;
     }
   };
   const end = () => { if (timer) { clearTimeout(timer); timer = null; } };

   el.addEventListener('touchstart', start, { passive: true });
   el.addEventListener('touchmove', move, { passive: true });
   el.addEventListener('touchend', end);
   el.addEventListener('touchcancel', end);
   el.addEventListener('mousedown', start);
   el.addEventListener('mousemove', move);
   el.addEventListener('mouseup', end);
   el.addEventListener('mouseleave', end);
   el.addEventListener('contextmenu', (e) => {
     e.preventDefault();
     copyTextToClipboard(text);
   });
 }

 function downloadDataURL(dataUrl, filename) {
   const a = document.createElement('a');
   a.href = dataUrl;
   a.download = filename;
   document.body.appendChild(a);
   a.click();
   document.body.removeChild(a);
 }

 function updateClock() {
   const d = new Date();
   const hh = d.getHours().toString().padStart(2, '0');
   const mm = d.getMinutes().toString().padStart(2, '0');
   const el = document.getElementById('clockText');
   if (el) el.textContent = hh + ':' + mm;
 }

 function getQueryParam(name) {
   const url = new URL(window.location.href);
   return url.searchParams.get(name);
 }

 function renderTask(task) {
   const actionLabels = {
     cart: '添加至购物车',
     fav: '收藏商品',
     follow: '关注店铺',
     compare: '货比两家',
     chat: '与客服互动'
   };
   const acts = Object.keys(actionLabels).filter(k => task.actions && task.actions[k]);
   if (task.actions && task.actions.custom && task.actions.customText) {
     acts.push(task.actions.customText);
   }

   const kws = [task.kwSuggest].concat(task.kwAlt || []).filter(Boolean);
   const keywordsHTML = kws.length
     ? '<div class="tag-list">' + kws.map(k =>
         '<span class="viewer-tag" data-copy="' + escapeHtml(k) + '">' + escapeHtml(k) + '</span>'
       ).join('') + '</div><div class="tag-hint">长按标签可单独复制</div>'
     : '<span class="text-tertiary">无</span>';

   const actionsHTML = acts.length
     ? acts.map(a => '<div class="viewer-action"><span class="dot">✓</span>' + escapeHtml(actionLabels[a] || a) + '</div>').join('')
     : '<div class="text-tertiary">无营销动作要求</div>';

   const priceHTML = task.price
     ? '<div class="viewer-section"><div class="vs-title">价格调整</div><div style="font-size:18px;color:#FF9500;font-weight:600">¥ ' + task.price + '</div></div>'
     : '';

   /* 店铺 + 商品（顶部，带复制按钮） */
   const storeHTML = task.store
     ? '<div class="row"><span class="k">店铺</span><span class="v" id="v-store">' + escapeHtml(task.store) + '</span><button class="copy-btn" onclick="copyText(\'v-store\')">复制</button></div>'
     : '';
   const productHTML = task.product
     ? '<div class="row"><span class="k">商品</span><span class="v" id="v-product">' + escapeHtml(task.product) + '</span><button class="copy-btn" onclick="copyText(\'v-product\')">复制</button></div>'
     : '';

   /* 封面：改成 <img> 标签，长按可保存（移动端原生支持） */
   const coverImg = task.cover && task.cover.dataUrl
     ? '<img src="' + task.cover.dataUrl + '" class="viewer-cover-img" id="v-cover-img" onclick="event.stopPropagation();openLightbox(this.src)">'
     : '';
   const coverCopyBtn = task.cover && task.cover.dataUrl
     ? '<div style="display:flex;gap:8px;margin-top:10px"><button class="btn btn-secondary" style="flex:1" onclick="copyCoverImg()">复制图片到剪贴板</button></div>'
     : '';

   /* 下单要求：跟买家秀评语一样 — 文本 + 图片 + 复制文本 + 复制图片 */
   let skuHTML = '';
   if (task.sku && (task.sku.image || task.sku.text)) {
     const txtPart = task.sku.text
       ? '<div class="viewer-review-text" id="v-sku-text">' + escapeHtml(task.sku.text) + '</div>'
       : '';
     const imgPart = task.sku.image
       ? '<img src="' + task.sku.image + '" class="viewer-review-img" id="v-sku-img" onclick="event.stopPropagation();openLightbox(this.src)">'
       : '';
     const btnPart = '<div style="display:flex;gap:8px;margin-top:12px">' +
       (task.sku.text ? '<button class="btn btn-secondary" style="flex:1" onclick="copyText(\'v-sku-text\')">复制文本</button>' : '<div style="flex:1"></div>') +
       (task.sku.image ? '<button class="btn btn-secondary" style="flex:1" onclick="copySkuImg()">复制图片到剪贴板</button>' : '<div style="flex:1"></div>') +
       '</div>';
     skuHTML = '<div class="viewer-section"><div class="vs-title">下单要求</div>' + txtPart + imgPart + btnPart + '</div>';
   }

   return '<div class="viewer-section">' +
     '<div class="viewer-meta">' + storeHTML + productHTML + '</div>' +
     coverImg + coverCopyBtn +
     '</div>' +
     '<div class="viewer-section"><div class="vs-title">搜索关键词</div>' + keywordsHTML + '</div>' +
     '<div class="viewer-section"><div class="vs-title">营销动作</div>' + actionsHTML + '</div>' +
     priceHTML +
     skuHTML;
 }

 function renderReview(review) {
   const imgHTML = review.image
     ? '<img src="' + review.image + '" class="viewer-review-img" id="v-review-img" onclick="event.stopPropagation();openLightbox(this.src)">'
     : '';
   /* 去掉"保存配图"按钮，改成"复制图片到剪贴板" */
   const btnRow = (review.image || review.text)
     ? '<div style="display:flex;gap:8px;margin-top:12px">' +
       (review.text ? '<button class="btn btn-secondary" style="flex:1" onclick="copyText(\'v-review-text\')">复制文本</button>' : '<div style="flex:1"></div>') +
       (review.image ? '<button class="btn btn-secondary" style="flex:1" onclick="copyReviewImg()">复制图片到剪贴板</button>' : '<div style="flex:1"></div>') +
       '</div>'
     : '';
   return '<div class="viewer-section">' +
     '<div class="vs-title">买家秀评语</div>' +
     (review.target ? '<div style="font-size:13px;color:var(--secondary-label);margin-bottom:8px">关于 ' + escapeHtml(review.target) + '</div>' : '') +
     '<div class="viewer-review-text" id="v-review-text">' + escapeHtml(review.text || '') + '</div>' +
     imgHTML +
     btnRow +
     '</div>';
 }

 function showError(msg) {
   const body = document.getElementById('viewer-body');
   body.innerHTML = '<div class="viewer-error">' +
     '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--tertiary-label)"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
     '<p style="margin-top:12px;font-size:15px">' + escapeHtml(msg) + '</p>' +
     '</div>';
   document.getElementById('v-title').textContent = '任务详情';
   document.getElementById('v-sub').textContent = '';
 }

 async function init() {
   updateClock();
   setInterval(updateClock, 30000);

   const dataUrl = getQueryParam('data');
   if (!dataUrl) {
     showError('链接无效：缺少 data 参数');
     return;
   }

   let payload;
   try {
     const res = await fetch(dataUrl);
     if (!res.ok) throw new Error('HTTP ' + res.status);
     payload = await res.json();
   } catch (e) {
     console.error(e);
     showError('加载失败：' + e.message);
     return;
   }

   if (!payload || !payload.task) {
     showError('数据格式错误');
     return;
   }

   document.getElementById('v-title').textContent = payload.task.product || '任务详情';
   document.getElementById('v-sub').textContent = payload.task.store || '';
   document.title = (payload.task.product || '任务') + ' - 任务详情';

   window._currentTask = payload.task || {};
   window._currentReview = payload.review || {};

   const body = document.getElementById('viewer-body');
   body.innerHTML = renderTask(payload.task) + renderReview(payload.review || {});

   /* 给所有 viewer-tag 绑定长按复制 */
   body.querySelectorAll('.viewer-tag').forEach(bindLongPress);
 }

 document.addEventListener('DOMContentLoaded', init);
