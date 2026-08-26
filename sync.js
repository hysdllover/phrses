/* sync.js — GitHub Gist 동기화 (토큰 권한은 gist 하나면 충분)
   흐름: pull → 항목별 병합(u 최신 우선, 삭제는 tombstone) → push */
const Sync = (() => {
  const CFG = 'vocab.sync';
  const FILE = 'vocab.json';
  const API = 'https://api.github.com/gists';

  const cfg = () => { try { return JSON.parse(localStorage.getItem(CFG)) || {}; } catch (e) { return {}; } };
  const setCfg = o => localStorage.setItem(CFG, JSON.stringify(Object.assign(cfg(), o)));

  function head() {
    const c = cfg();
    if (!c.token) throw new Error('토큰이 없습니다');
    return { 'Authorization': 'Bearer ' + c.token, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' };
  }

  async function pull() {
    const c = cfg(); if (!c.gistId) return null;
    const r = await fetch(API + '/' + c.gistId + '?t=' + Date.now(), { headers: head(), cache: 'no-store' });
    if (r.status === 404) { setCfg({ gistId: '' }); return null; }
    if (!r.ok) throw new Error('불러오기 실패 ' + r.status);
    const g = await r.json();
    const f = g.files && g.files[FILE];
    if (!f) return null;
    const txt = f.truncated ? await (await fetch(f.raw_url)).text() : f.content;
    return JSON.parse(txt);
  }

  async function push() {
    const c = cfg();
    const body = JSON.stringify({
      description: 'WORDS vocab data',
      files: { [FILE]: { content: JSON.stringify(Store.raw()) } }
    });
    let r;
    if (c.gistId) r = await fetch(API + '/' + c.gistId, { method: 'PATCH', headers: head(), body });
    else r = await fetch(API, { method: 'POST', headers: head(), body: JSON.stringify({ description: 'WORDS vocab data', public: false, files: { [FILE]: { content: JSON.stringify(Store.raw()) } } }) });
    if (!r.ok) throw new Error('업로드 실패 ' + r.status);
    const g = await r.json();
    setCfg({ gistId: g.id, at: Date.now() });
    return g.id;
  }

  async function run() {
    const remote = await pull();
    if (remote) Store.merge(remote);
    await push();
    setCfg({ at: Date.now() });
    return true;
  }

  // 자동 동기화: 변경 후 8초 뒤 1회 (토큰 있을 때만)
  let t = null;
  function auto() {
    if (!cfg().token || !cfg().gistId) return;
    clearTimeout(t);
    t = setTimeout(() => run().catch(() => {}), 8000);
  }

  return { cfg, setCfg, pull, push, run, auto };
})();
