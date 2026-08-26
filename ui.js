/* ui.js — 시트/확인/토스트 (window.confirm은 iOS에서 불안정하므로 사용 안 함) */
const UI = (() => {
  const root = () => document.getElementById('sheet-root');

  function sheet({ title, body, ok = '저장', onOk, onClose }) {
    const ovl = document.createElement('div');
    ovl.className = 'ovl';
    ovl.innerHTML =
      `<div class="sheet">
         <div class="sh-h">
           <button data-x>닫기</button><b>${title}</b>
           <button class="pri" data-ok ${ok ? '' : 'hidden'}>${ok}</button>
         </div>
         <div class="sh-b"></div>
       </div>`;
    const box = ovl.querySelector('.sh-b');
    if (typeof body === 'string') box.innerHTML = body;
    else if (body instanceof Node) box.appendChild(body);
    const close = () => { ovl.remove(); onClose && onClose(); };
    ovl.querySelector('[data-x]').onclick = close;
    ovl.onclick = e => { if (e.target === ovl) close(); };
    const okb = ovl.querySelector('[data-ok]');
    if (okb) okb.onclick = () => { if (!onOk || onOk(box, close) !== false) close(); };
    root().appendChild(ovl);
    return { el: box, close, ovl };
  }

  function confirm(msg, okText = '삭제') {
    return new Promise(res => {
      const ovl = document.createElement('div');
      ovl.className = 'ovl';
      ovl.innerHTML =
        `<div class="sheet"><div class="sh-b" style="padding:22px 18px 18px">
           <div style="font-size:13px;margin-bottom:16px">${msg}</div>
           <button class="btn full warn" data-y style="margin-bottom:7px">${okText}</button>
           <button class="btn full dim" data-n>취소</button>
         </div></div>`;
      const fin = v => { ovl.remove(); res(v); };
      ovl.querySelector('[data-y]').onclick = () => fin(true);
      ovl.querySelector('[data-n]').onclick = () => fin(false);
      ovl.onclick = e => { if (e.target === ovl) fin(false); };
      root().appendChild(ovl);
    });
  }

  function toast(msg, ms = 1500) {
    const r = document.getElementById('toast-root');
    r.innerHTML = `<div class="toast">${msg}</div>`;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { r.innerHTML = ''; }, ms);
  }

  const esc = s => (s == null ? '' : String(s))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  return { sheet, confirm, toast, esc };
})();
