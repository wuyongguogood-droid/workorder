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
     ? kws.map(k => '<span class="viewer-tag">' + escapeHtml(k) + '</span>').join('')
     : '<span class="text-tertiary">无</span>';
 
   const actionsHTML = acts.length
     ? acts.map(a => '<div class="viewer-action"><span class="dot">✓</span>' + escapeHtml(actionLabels[a] || a) + '</div>').join('')
     : '<div class="text-tertiary">无营销动作要求</div>';
 
   const priceHTML = task.price
     ? '<div class="viewer-section"><div class="vs-title">价格调整</div><div style="font-size:18px;color:#FF9500;font-weight:600">¥ ' + task.price + '</div></div>'
     : '';
 
   let skuHTML = '';
   if (task.sku) {
     const imgPart = task.sku.image
       ? '<img src="' + task.sku.image + '" class="viewer-review-img" onclick="event.stopPropagation();openLightbox(this.src)" style="max-height:200px;margin-top:8px;cursor:zoom-in">'
       : '';
     const txtPart = task.sku.text
       ? '<div style="font-size:15px;line-height:1.5;white-space:pre-wrap">' + escapeHtml(task.sku.text) + '</div>'
       : '';
     if (imgPart || txtPart) {
       skuHTML = '<div class="viewer-section"><div class="vs-title">下单要求</div>' + txtPart + imgPart + '</div>';
     }
   }
 
   return '<div class="viewer-section">' +
     (task.cover && task.cover.dataUrl ? '<div class="viewer-cover" style="background-image:url(' + task.cover.dataUrl + ')" onclick="openLightbox(this.style.backgroundImage.slice(4, -1).replace(/&quot;/g, \"\'\"))"></div>' : '') +
     '<div class="viewer-meta">' +
       '<div class="row"><span class="k">店铺</span><span class="v">' + escapeHtml(task.store) + '</span></div>' +
       '<div class="row"><span class="k">商品</span><span class="v">' + escapeHtml(task.product) + '</span></div>' +
     '</div></div>' +
     '<div class="viewer-section"><div class="vs-title">搜索关键词</div><div>' + keywordsHTML + '</div></div>' +
     '<div class="viewer-section"><div class="vs-title">营销动作</div>' + actionsHTML + '</div>' +
     priceHTML +
     skuHTML;
 }
 
 function renderReview(review) {
   const imgHTML = review.image
     ? '<img src="' + review.image + '" class="viewer-review-img" onclick="event.stopPropagation();openLightbox(this.src)" style="cursor:zoom-in">'
     : '';
   const saveBtn = (review.image || review.text)
     ? '<div style="display:flex;gap:8px;margin-top:12px">' +
       (review.text ? '<button class="btn btn-secondary" style="flex:1" onclick="copyText(\'v-review-text\')">复制文本</button>' : '<div style="flex:1"></div>') +
       (review.image ? '<button class="btn btn-secondary" style="flex:1" onclick="saveReviewImg()">保存配图</button>' : '<div style="flex:1"></div>') +
       '</div>'
     : '';
   return '<div class="viewer-section">' +
     '<div class="vs-title">买家秀评语</div>' +
     (review.target ? '<div style="font-size:13px;color:var(--secondary-label);margin-bottom:8px">关于 ' + escapeHtml(review.target) + '</div>' : '') +
     '<div class="viewer-review-text" id="v-review-text">' + escapeHtml(review.text || '') + '</div>' +
     imgHTML +
     saveBtn +
     '</div>';
 }
 
 function saveReviewImg() {
   if (!window._currentReview || !window._currentReview.image) return;
   downloadDataURL(window._currentReview.image, 'review-' + Date.now() + '.jpg');
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
 
   window._currentReview = payload.review || {};
 
   const body = document.getElementById('viewer-body');
   body.innerHTML = renderTask(payload.task) + renderReview(payload.review || {});
 }
 
 document.addEventListener('DOMContentLoaded', init);
