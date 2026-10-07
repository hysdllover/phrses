/* store.js — 데이터 저장/병합/스냅샷
   레코드 공통 필드: id, u(수정시각), d(삭제 tombstone 시각)
   스키마 변경 시 SCHEMA 올리고 migrate()에 단계 추가 → 기존 기록 유지됨 */
const Store = (() => {
  const KEY = 'vocab.data';
  const SNAP_PREFIX = 'vocab.snap.';
  const SCHEMA = 2;
  const PURGE_DAYS = 90;

  const PALETTE = ['#6b7a99','#8a9a7b','#9b8fb0','#c39a9e','#7fa39a','#c0ab8a','#b58f80','#9a9aa2'];

  const now = () => Date.now();
  const uid = () => Math.random().toString(36).slice(2, 8) + now().toString(36).slice(-4);

  const blank = () => ({
    v: SCHEMA,
    decks: [],
    words: [],
    settings: { deck: 'all', sort: 'imp', st: [0, 1, 2], q: '', mask: 'ko', shuffle: false }
  });

  let data = blank();

  function migrate(d) {
    if (!d || typeof d !== 'object') return blank();
    if (!d.v) d.v = 1;
    d.decks = d.decks || [];
    d.words = d.words || [];
    if (d.v < 2) {   // etc. 덱 추가 (기존 기록은 그대로 유지)
      if (d.decks.length && !d.decks.some(x => !x.d && x.name === 'etc.'))
        d.decks.push({ id: uid(), name: 'etc.', color: PALETTE[4], o: d.decks.length, u: now() });
      d.v = 2;
    }
    // v2 → v3 마이그레이션은 여기에 추가
    const b = blank();
    d.settings = Object.assign({}, b.settings, d.settings || {});
    d.v = SCHEMA;
    return d;
  }

  function init() {
    try { data = migrate(JSON.parse(localStorage.getItem(KEY))); }
    catch (e) { data = blank(); }
    if (!data.decks.length) {
      ['WICS', '파피루스', '서바', '기출', 'etc.'].forEach((n, i) => {
        data.decks.push({ id: uid(), name: n, color: PALETTE[i], o: i, u: now() });
      });
    }
    save(false);
  }

  // 용량 초과 시 오래된 스냅샷부터 지우고 재시도
  function put(k, v) {
    for (;;) {
      try { localStorage.setItem(k, v); return true; }
      catch (e) {
        const old = snapKeys().reverse().filter(x => x !== k);
        if (!old.length) return false;
        localStorage.removeItem(old[0]);
      }
    }
  }

  function save(snap = true) {
    if (!put(KEY, JSON.stringify(data))) {
      if (typeof UI !== 'undefined') UI.toast('저장 공간 부족 · JSON 내보내기를 권장합니다', 4000);
      return;
    }
    if (snap) snapshot();
  }

  function snapshot() {
    const k = SNAP_PREFIX + new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(k)) return;
    try { localStorage.setItem(k, JSON.stringify(data)); } catch (e) { return; }   // 스냅샷은 본 데이터보다 후순위
    const keys = snapKeys().reverse();
    while (keys.length > 7) localStorage.removeItem(keys.shift());
  }
  const snapKeys = () => Object.keys(localStorage).filter(x => x.startsWith(SNAP_PREFIX)).sort().reverse();
  function restore(key) {
    const raw = localStorage.getItem(key); if (!raw) return false;
    data = migrate(JSON.parse(raw)); save(false); return true;
  }

  const alive = a => a.filter(x => !x.d);

  /* decks */
  const decks = () => alive(data.decks).sort((a, b) => (a.o || 0) - (b.o || 0));
  const deck = id => data.decks.find(x => x.id === id && !x.d);
  function saveDeck(o) {
    o.u = now();
    const i = data.decks.findIndex(x => x.id === o.id);
    if (i >= 0) data.decks[i] = Object.assign(data.decks[i], o);
    else { o.id = o.id || uid(); o.o = data.decks.length; data.decks.push(Object.assign({}, o)); }
    save(); return o.id;
  }
  function delDeck(id) {
    const t = now();
    const d = data.decks.find(x => x.id === id); if (d) { d.d = t; d.u = t; }
    data.words.forEach(w => { if (w.deckId === id && !w.d) { w.d = t; w.u = t; } });
    save();
  }

  /* words */
  const allWords = () => alive(data.words);
  const word = id => data.words.find(x => x.id === id && !x.d);
  const countOf = deckId => alive(data.words).filter(w => w.deckId === deckId).length;

  function saveWord(o) {
    o.u = now();
    const i = data.words.findIndex(x => x.id === o.id);
    if (i >= 0) data.words[i] = Object.assign(data.words[i], o);
    else { o.id = o.id || uid(); o.c = now(); data.words.push(Object.assign({}, o)); }
    save(); return o.id;
  }
  function delWord(id) {
    const w = data.words.find(x => x.id === id);
    if (w) { w.d = now(); w.u = w.d; save(); }
  }
  function setStatus(id, st) {
    const w = word(id); if (!w) return;
    w.st = st; w.u = now(); save(false);
  }
  // 중복 확인: 대소문자·공백 무시
  const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const findByEn = (en, exceptId) => { const k = norm(en); return k ? allWords().find(w => w.id !== exceptId && norm(w.en) === k) : null; };

  /* query */
  function query(opt) {
    const s = Object.assign({}, data.settings, opt || {});
    let list = alive(data.words);
    if (s.deck && s.deck !== 'all') list = list.filter(w => w.deckId === s.deck);
    if (s.st && s.st.length < 3) list = list.filter(w => s.st.includes(w.st || 0));
    const q = (s.q || '').trim().toLowerCase();
    if (q) list = list.filter(w =>
      (w.en || '').toLowerCase().includes(q) || (w.ko || '').includes(q) ||
      (w.syn || '').toLowerCase().includes(q) || (w.cf || '').toLowerCase().includes(q));
    if (s.sort === 'imp') list.sort((a, b) => (b.imp || 2) - (a.imp || 2) || (b.c || 0) - (a.c || 0));
    else if (s.sort === 'imp_asc') list.sort((a, b) => (a.imp || 2) - (b.imp || 2) || (b.c || 0) - (a.c || 0));
    else if (s.sort === 'az') list.sort((a, b) => (a.en || '').localeCompare(b.en || ''));
    else if (s.sort === 'rand') list = shuffle(list);
    else list.sort((a, b) => (b.c || 0) - (a.c || 0));
    return list;
  }
  function shuffle(a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  /* settings */
  function set(k, v) { data.settings[k] = v; save(false); }

  /* sync */
  const raw = () => data;
  function merge(remote) {
    if (!remote || !remote.words) return 0;
    let n = 0;
    const mix = (local, rem) => {
      const map = new Map(local.map(x => [x.id, x]));
      rem.forEach(r => {
        const l = map.get(r.id);
        if (!l || (r.u || 0) > (l.u || 0)) { map.set(r.id, r); n++; }
      });
      return [...map.values()];
    };
    data.decks = mix(data.decks, remote.decks || []);
    data.words = mix(data.words, remote.words || []);
    n += dedupeDecks();
    purge(); save(); return n;
  }
  // 기기마다 따로 만든 같은 이름 덱 → id가 가장 작은 덱으로 통합 (양쪽 기기가 같은 결과로 수렴)
  function dedupeDecks() {
    const keep = {}, t = now(); let n = 0;
    alive(data.decks).slice().sort((a, b) => a.id < b.id ? -1 : 1).forEach(d => {
      const k = d.name.trim().toLowerCase();
      if (!keep[k]) { keep[k] = d; return; }
      data.words.forEach(w => { if (w.deckId === d.id && !w.d) { w.deckId = keep[k].id; w.u = t; n++; } });
      if (data.settings.deck === d.id) data.settings.deck = keep[k].id;
      d.d = t; d.u = t; n++;
    });
    // 이미 통합(삭제)된 덱을 가리키는 단어가 다른 기기에서 들어오면 같은 이름의 덱으로 옮김
    data.words.forEach(w => {
      if (w.d || deck(w.deckId)) return;
      const old = data.decks.find(x => x.id === w.deckId);
      const k = old && old.name.trim().toLowerCase();
      if (k && keep[k]) { w.deckId = keep[k].id; w.u = t; n++; }
    });
    return n;
  }
  function purge() {
    const cut = now() - PURGE_DAYS * 864e5;
    data.decks = data.decks.filter(x => !x.d || x.d > cut);
    data.words = data.words.filter(x => !x.d || x.d > cut);
  }
  function replaceAll(d) { data = migrate(d); save(); }

  /* 파일 가져오기 (중복 없이 병합)
     - 같은 id: 최신(u) 우선 / 같은 이름 덱: 기존 덱으로 합침 / 같은 영단어(대소문자·공백 무시): 건너뜀 */
  function importMerge(d) {
    const t = now(), r = { added: 0, updated: 0, skipped: 0, decks: 0 };
    const idMap = {};
    alive(d.decks || []).forEach(x => {
      const same = deck(x.id) || decks().find(y => norm(y.name) === norm(x.name));
      if (same) { idMap[x.id] = same.id; return; }
      const nd = Object.assign({}, x, { id: data.decks.some(y => y.id === x.id) ? uid() : x.id, o: data.decks.length, u: t });
      data.decks.push(nd); idMap[x.id] = nd.id; r.decks++;
    });
    const seen = new Set(alive(data.words).map(w => norm(w.en)));
    alive(d.words).forEach(x => {
      const w = Object.assign({}, x, { deckId: idMap[x.deckId] || x.deckId });
      const i = data.words.findIndex(y => y.id === w.id);
      if (i >= 0) {
        if ((w.u || 0) > (data.words[i].u || 0)) { data.words[i] = w; r.updated++; } else r.skipped++;
        return;
      }
      const k = norm(w.en);
      if (!k || seen.has(k) || !deck(w.deckId)) { r.skipped++; return; }
      seen.add(k); w.u = t; w.c = w.c || t; data.words.push(w); r.added++;
    });
    save(); return r;
  }

  return {
    init, save, PALETTE, uid, now,
    decks, deck, saveDeck, delDeck,
    allWords, word, saveWord, delWord, setStatus, countOf, findByEn, norm,
    query, shuffle, set, get settings() { return data.settings; },
    raw, merge, replaceAll, importMerge, snapKeys, restore
  };
})();
