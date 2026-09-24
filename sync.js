/* sync.js — GitHub Gist 동기화
   토큰: classic PAT, 스코프는 gist 하나만
   흐름: pull → 항목별 병합(u 최신 우선, 삭제는 tombstone) → push */
const Sync = (() => {
  const CFG = 'vocab.sync';
  const FILE = 'vocab.json';
  const API = 'https://api.github.com/gists';

  const cfg = () => { try { return JSON.parse(localStorage.getItem(CFG)) || {}; } catch (e) { return {}; } };
  const setCfg = o => { localStorage.setItem(CFG, JSON.stringify(Object.assign(cfg(), o))); };

  // 복사 과정에서 붙는 공백·줄바꿈·제로폭 문자 제거
  const cleanToken = t => String(t || '').replace(/[\s\u200B-\u200D\uFEFF"']/g, '');
  // 전체 URL을 붙여넣어도 ID만 추출
  const cleanId = s => {
    s = String(s || '').trim().replace(/\/+$/, '');
    const m = s.match(/([0-9a-fA-F]{20,})/);
    return m ? m[1] : s;
  };

  function headers() {
    const t = cleanToken(cfg().token);
    if (!t) throw new Error('토큰을 먼저 입력하세요');
    if (t.startsWith('github_pat_'))
      throw new Error('Fine-grained 토큰은 Gist를 지원하지 않습니다. classic 토큰으로 다시 발급하세요');
    return { 'Authorization': 'Bearer ' + t, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' };
  }

  async function req(url, opt) {
    let r;
    try { r = await fetch(url, opt); }
    catch (e) { throw new Error('네트워크 연결 실패 — 인터넷 상태를 확인하세요'); }
    if (r.ok) return r.json();
    let msg = '';
    try { const j = await r.json(); msg = j.message || ''; } catch (e) { }
    if (r.status === 401) throw new Error('토큰이 올바르지 않습니다 (401) — 다시 복사해 붙여넣으세요');
    if (r.status === 403) throw new Error('권한 없음 (403) — 토큰의 gist 스코프를 확인하세요');
    if (r.status === 404) throw new Error('Gist를 찾을 수 없습니다 (404) — ID 칸을 비우고 다시 동기화하세요');
    if (r.status === 422) throw new Error('요청 거부됨 (422) ' + msg);
    throw new Error('실패 ' + r.status + ' ' + msg);
  }

  /* 토큰·스코프 검증 */
  async function test() {
    await req(API + '?per_page=1&t=' + Date.now(), { headers: headers(), cache: 'no-store' });
    const c = cfg();
    if (c.gistId) {
      const g = await req(API + '/' + c.gistId + '?t=' + Date.now(), { headers: headers(), cache: 'no-store' });
      if (!g.files || !g.files[FILE]) throw new Error('Gist는 있으나 vocab.json이 없습니다 — 동기화를 한 번 실행하세요');
      return '토큰 정상 · Gist 연결됨';
    }
    return '토큰 정상 · Gist는 아직 없음 (동기화 시 자동 생성)';
  }

  async function pull() {
    const c = cfg(); if (!c.gistId) return null;
    const g = await req(API + '/' + c.gistId + '?t=' + Date.now(), { headers: headers(), cache: 'no-store' });
    const f = g.files && g.files[FILE];
    if (!f) return null;
    const txt = f.truncated ? await (await fetch(f.raw_url, { cache: 'no-store' })).text() : f.content;
    try { return JSON.parse(txt); } catch (e) { throw new Error('서버 데이터를 읽을 수 없습니다'); }
  }

  async function push() {
    const c = cfg();
    const files = {}; files[FILE] = { content: JSON.stringify(Store.raw()) };
    const g = c.gistId
      ? await req(API + '/' + c.gistId, { method: 'PATCH', headers: headers(), body: JSON.stringify({ files: files }) })
      : await req(API, { method: 'POST', headers: headers(), body: JSON.stringify({ description: 'WORDS vocab data', public: false, files: files }) });
    setCfg({ gistId: g.id, at: Date.now(), err: '' });
    return g.id;
  }

  async function run() {
    try {
      const remote = await pull();
      if (remote) Store.merge(remote);
      await push();
      setCfg({ at: Date.now(), err: '' });
      return true;
    } catch (e) {
      setCfg({ err: e.message || String(e) });
      throw e;
    }
  }

  /* 변경 후 지연 자동 업로드 */
  let t = null;
  function auto() {
    const c = cfg();
    if (!cleanToken(c.token) || !c.gistId) return;
    clearTimeout(t);
    t = setTimeout(function () { run().catch(function () { }); }, 6000);
  }

  /* 앱 진입 / 복귀 시 서버 변경분 자동 반영 */
  let booting = false;
  async function boot(silent) {
    const c = cfg();
    if (booting || !cleanToken(c.token) || !c.gistId) return;
    booting = true;
    try {
      const remote = await pull();
      if (remote) {
        const n = Store.merge(remote);
        if (n) { if (!silent) UI.toast(n + '건 반영됨'); App.refresh(); }
      }
      setCfg({ at: Date.now(), err: '' });
    } catch (e) { setCfg({ err: e.message || String(e) }); }
    booting = false;
  }

  function watch() {
    document.addEventListener('visibilitychange', function () { if (!document.hidden) boot(true); });
    window.addEventListener('online', function () { boot(true); });
  }

  return { VERSION: 3,
           cfg: cfg, setCfg: setCfg, cleanToken: cleanToken, cleanId: cleanId,
           test: test, pull: pull, push: push, run: run, auto: auto, boot: boot, watch: watch };
})();
window.Sync = Sync;
