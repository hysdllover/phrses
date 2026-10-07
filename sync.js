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

  const hm = t => new Date(t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  const held = () => Date.now() < (cfg().holdUntil || 0);

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
    // 403/429: 요청 한도 초과면 잠시 쉬었다가 자동 재시도
    const h = k => r.headers.get(k);
    if ((r.status === 403 || r.status === 429) && (h('x-ratelimit-remaining') === '0' || /rate limit/i.test(msg) || r.status === 429)) {
      const until = h('retry-after') ? Date.now() + (+h('retry-after')) * 1000
        : h('x-ratelimit-reset') ? (+h('x-ratelimit-reset')) * 1000 : Date.now() + 60000;
      setCfg({ holdUntil: Math.max(until, Date.now() + 30000) });
      throw new Error('요청 한도 초과 — ' + hm(cfg().holdUntil) + ' 이후 다시 시도하세요');
    }
    if (r.status === 403) throw new Error('권한 없음 (403)' + (msg ? ' — ' + msg : '') + ' · 토큰의 gist 스코프를 확인하세요');
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

  let lastRemote = null;   // 마지막으로 받은 서버 원문 (변경 없으면 업로드 생략용)
  async function pull() {
    const c = cfg(); if (!c.gistId) return null;
    const g = await req(API + '/' + c.gistId + '?t=' + Date.now(), { headers: headers(), cache: 'no-store' });
    const f = g.files && g.files[FILE];
    if (!f) return null;
    const txt = f.truncated ? await (await fetch(f.raw_url, { cache: 'no-store' })).text() : f.content;
    lastRemote = txt;
    try { return JSON.parse(txt); } catch (e) { throw new Error('서버 데이터를 읽을 수 없습니다'); }
  }

  async function push(keep) {
    const c = cfg();
    const content = JSON.stringify(Store.raw());
    if (c.gistId && content === lastRemote) { setCfg({ err: '' }); return c.gistId; }   // 서버와 동일 → PATCH 생략
    const files = {}; files[FILE] = { content: content };
    const body = c.gistId ? JSON.stringify({ files: files })
      : JSON.stringify({ description: 'WORDS vocab data', public: false, files: files });
    const opt = { method: c.gistId ? 'PATCH' : 'POST', headers: headers(), body: body };
    if (keep && body.length < 60000) opt.keepalive = true;   // 앱이 닫혀도 전송 완료 (64KB 제한)
    const g = await req(c.gistId ? API + '/' + c.gistId : API, opt);
    lastRemote = content;
    setCfg({ gistId: g.id, pushAt: Date.now(), err: '', holdUntil: 0 });
    return g.id;
  }

  /* pull → 병합 → push. 도중에 생긴 변경은 dirty로 남겨 다음에 다시 올림 */
  let busy = null;
  function run(keep) {
    if (held()) return Promise.reject(new Error('요청 한도 초과 — ' + hm(cfg().holdUntil) + ' 이후 다시 시도하세요'));
    if (busy) return busy.then(() => (cfg().dirty ? run(keep) : true));
    busy = (async () => {
      const mark = cfg().dirty;
      try {
        const remote = await pull();
        if (remote && Store.merge(remote)) App.refresh();
        if (remote) setCfg({ pullAt: Date.now() });
        await push(keep);
        if (cfg().dirty === mark) setCfg({ dirty: 0 });
        setCfg({ at: Date.now(), err: '', holdUntil: 0 });
        return true;
      } catch (e) {
        setCfg({ err: e.message || String(e) });
        throw e;
      } finally { busy = null; }
    })();
    return busy;
  }

  const ready = () => { const c = cfg(); return !!(cleanToken(c.token) && c.gistId); };

  // 수동 동기화: 변경 표시만 남기고, 업로드는 '지금 동기화'를 누를 때
  function auto() {
    if (ready()) setCfg({ dirty: Date.now() });
  }

  /* 앱 진입 / 복귀 / 주기적으로 서버 변경분 반영. 올리지 못한 변경이 있으면 함께 업로드 */
  async function boot(silent) {
    if (!ready() || busy || held()) return;
    if (cfg().dirty) { try { await run(); } catch (e) { } return; }
    busy = (async () => {
      try {
        const remote = await pull();
        if (remote) {
          const n = Store.merge(remote);
          if (n) { if (!silent) UI.toast(n + '건 반영됨'); App.refresh(); }
        }
        setCfg({ pullAt: Date.now(), at: Date.now(), err: '', holdUntil: 0 });
      } catch (e) { setCfg({ err: e.message || String(e) }); }
      finally { busy = null; }
    })();
    await busy;
  }

  function watch() { }   // 수동 동기화 모드: 자동 가져오기·업로드 없음

  return { VERSION: 6, held: held,
           cfg: cfg, setCfg: setCfg, cleanToken: cleanToken, cleanId: cleanId,
           test: test, pull: pull, push: push, run: run, auto: auto, boot: boot, watch: watch };
})();
window.Sync = Sync;
