/* app.js — 뷰 등록/전환
   탭 추가 = view-xxx.js 파일 1개 + index.html 스크립트 태그 1줄 */
const App = (() => {
  const views = [], byId = {}, scroll = {};
  let cur = null;

  const register = v => { views.push(v); byId[v.id] = v; };

  function buildTabs() {
    const n = document.getElementById('tabbar');
    n.style.gridTemplateColumns = `repeat(${views.length},1fr)`;
    n.innerHTML = views.map(v => `<button data-go="${v.id}">${v.name}</button>`).join('');
    n.onclick = e => { const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); };
  }

  function paint(reset) {
    const host = document.getElementById('app');
    const box = document.createElement('div');   // 매 렌더마다 새 컨테이너 → 리스너 누적 방지
    box.className = 'view';
    const v = byId[cur];
    document.getElementById('title').textContent = v.name;
    const acts = document.getElementById('tb-actions');
    acts.innerHTML = ''; acts.onclick = null;
    if (v.actions) v.actions(acts);
    v.render(box);
    host.replaceChildren(box);
    document.querySelectorAll('#tabbar button').forEach(b => b.classList.toggle('on', b.dataset.go === cur));
    requestAnimationFrame(() => window.scrollTo(0, reset ? 0 : (scroll[cur] || 0)));
  }

  function go(id) {
    if (!byId[id]) return;
    if (cur) scroll[cur] = window.scrollY;
    cur = id; localStorage.setItem('vocab.tab', id);
    paint(true);
  }
  function refresh() { scroll[cur] = window.scrollY; paint(false); }

  function start() {
    Store.init();
    buildTabs();
    cur = localStorage.getItem('vocab.tab');
    if (!byId[cur]) cur = views[0].id;
    paint(true);
    try { if (typeof Sync !== 'undefined' && Sync.watch) { Sync.watch(); Sync.boot(true); } } catch (e) { logErr(e); }
  }

  // 전역 오류를 기록해 설정 화면에서 확인할 수 있게 함
  function logErr(e) {
    const m = (e && (e.message || e.reason && e.reason.message)) || String(e);
    localStorage.setItem('vocab.lasterr', m + ' @ ' + new Date().toLocaleTimeString('ko-KR'));
  }
  window.addEventListener('error', ev => logErr(ev.error || ev.message));
  window.addEventListener('unhandledrejection', ev => logErr(ev.reason));

  return { VERSION: 3, register, go, refresh, start, logErr, get current() { return cur; } };
})();

window.App = App;
