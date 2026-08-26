/* view-words.js — 단어 목록 / 입력 */
(() => {
  const POS = ['', 'n.', 'v.', 'a.', 'ad.', 'prep.', 'conj.', 'phr.'];
  const IMP = ['', '★', '★★', '★★★'];
  const ST = ['X', '?', 'O'];
  let seed = 0; // 랜덤 정렬 고정용

  const dcolor = id => (Store.deck(id) || {}).color || 'var(--tx3)';

  function form(id) {
    const decks = Store.decks();
    if (!decks.length) { UI.toast('덱을 먼저 만들어주세요'); App.go('decks'); return; }
    const S = Store.settings;
    const w = id ? Object.assign({}, Store.word(id)) : {
      deckId: S.deck !== 'all' ? S.deck : decks[0].id, en: '', ko: '', syn: '', cf: '', pos: '', imp: 2, st: 0
    };
    const e = UI.esc;
    const html =
      `<div class="fld"><label>덱</label>
        <select data-f="deckId">${decks.map(d => `<option value="${d.id}" ${d.id === w.deckId ? 'selected' : ''}>${e(d.name)}</option>`).join('')}</select></div>
      <div class="fld"><label>영단어</label>
        <input data-f="en" value="${e(w.en)}" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="word"></div>
      <div class="g2">
        <div class="fld"><label>품사</label>
          <select data-f="pos">${POS.map(p => `<option value="${p}" ${p === (w.pos || '') ? 'selected' : ''}>${p || '—'}</option>`).join('')}</select></div>
        <div class="fld"><label>중요도</label>
          <div class="impsel">${[1, 2, 3].map(n => `<button data-imp="${n}" class="${(w.imp || 2) === n ? 'on' : ''}">${IMP[n]}</button>`).join('')}</div></div>
      </div>
      <div class="fld"><label>의미</label><textarea data-f="ko" rows="2" placeholder="뜻">${e(w.ko)}</textarea></div>
      <div class="fld"><label>유의어</label><input data-f="syn" value="${e(w.syn)}" autocapitalize="off" placeholder="syn1, syn2"></div>
      <div class="fld"><label>cf.</label><input data-f="cf" value="${e(w.cf)}" placeholder="비교·파생·메모"></div>
      ${id ? '<button class="btn full warn" data-del style="margin-top:14px">삭제</button>'
           : '<label class="tiny" style="display:flex;gap:6px;align-items:center;margin-top:10px"><input type="checkbox" data-cont checked style="width:auto"> 저장 후 계속 입력</label>'}`;

    const sh = UI.sheet({
      title: id ? '단어 수정' : '단어 추가', ok: '저장',
      onOk: (box, close) => {
        const g = f => box.querySelector(`[data-f="${f}"]`).value.trim();
        if (!g('en')) { UI.toast('영단어를 입력하세요'); return false; }
        const o = Object.assign(w, {
          deckId: g('deckId'), en: g('en'), ko: g('ko'), syn: g('syn'), cf: g('cf'), pos: g('pos'),
          imp: +box.querySelector('.impsel .on').dataset.imp
        });
        Store.saveWord(o); Sync.auto();
        const cont = box.querySelector('[data-cont]');
        if (!id && cont && cont.checked) {
          delete w.id; delete w.c; delete w.u;   // 다음 저장은 새 레코드로
          ['en', 'ko', 'syn', 'cf'].forEach(f => box.querySelector(`[data-f="${f}"]`).value = '');
          box.querySelector('[data-f="en"]').focus();
          UI.toast('저장됨 · 계속 입력');
          App.refresh();
          return false;   // 시트 유지
        }
        UI.toast('저장됨'); App.refresh();
      }
    });
    sh.el.innerHTML = html;
    sh.el.querySelector('.impsel').onclick = ev => {
      const b = ev.target.closest('[data-imp]'); if (!b) return;
      sh.el.querySelectorAll('.impsel button').forEach(x => x.classList.toggle('on', x === b));
    };
    const del = sh.el.querySelector('[data-del]');
    if (del) del.onclick = async () => {
      if (await UI.confirm('이 단어를 삭제할까요?')) { Store.delWord(id); Sync.auto(); sh.close(); App.refresh(); }
    };
    if (!id) setTimeout(() => sh.el.querySelector('[data-f="en"]').focus(), 250);
  }

  function bulk() {
    const decks = Store.decks(); if (!decks.length) return;
    const S = Store.settings;
    const sh = UI.sheet({
      title: '일괄 입력', ok: '추가',
      onOk: (box, close) => {
        const deckId = box.querySelector('[data-f="deckId"]').value;
        const imp = +box.querySelector('.impsel .on').dataset.imp;
        const lines = box.querySelector('textarea').value.split('\n').map(s => s.trim()).filter(Boolean);
        let n = 0;
        lines.forEach(L => {
          const m = L.split(/\s*[-–—:\t|]\s*/);
          const en = (m[0] || '').trim(); if (!en) return;
          Store.saveWord({ deckId, en, ko: (m.slice(1).join(' - ') || '').trim(), syn: '', cf: '', pos: '', imp, st: 0 });
          n++;
        });
        Sync.auto(); UI.toast(n + '개 추가됨'); App.refresh();
      }
    });
    sh.el.innerHTML =
      `<div class="fld"><label>덱</label><select data-f="deckId">${decks.map(d => `<option value="${d.id}" ${d.id === S.deck ? 'selected' : ''}>${UI.esc(d.name)}</option>`).join('')}</select></div>
       <div class="fld"><label>중요도</label><div class="impsel">${[1, 2, 3].map(n => `<button data-imp="${n}" class="${n === 2 ? 'on' : ''}">${IMP[n]}</button>`).join('')}</div></div>
       <div class="fld"><label>한 줄에 하나씩 · <span class="tiny">word - 뜻</span></label>
         <textarea rows="10" placeholder="abandon - 버리다&#10;abolish - 폐지하다" autocapitalize="off" spellcheck="false"></textarea></div>`;
    sh.el.querySelector('.impsel').onclick = ev => {
      const b = ev.target.closest('[data-imp]'); if (!b) return;
      sh.el.querySelectorAll('.impsel button').forEach(x => x.classList.toggle('on', x === b));
    };
  }

  App.register({
    id: 'words', name: '단어',
    actions(el) {
      el.innerHTML = `<button data-a="bulk">일괄</button><button data-a="print">인쇄</button>`;
      el.onclick = ev => {
        const a = ev.target.closest('[data-a]'); if (!a) return;
        if (a.dataset.a === 'bulk') bulk(); else window.print();
      };
    },
    render(root) {
      const S = Store.settings, e = UI.esc;
      const decks = Store.decks();
      if (S.sort === 'rand' && !seed) seed = 1;

      root.innerHTML =
        `<div class="print-head">단어장 — ${S.deck === 'all' ? '전체' : e((Store.deck(S.deck) || {}).name || '')}</div>
        <div class="chips" data-deck>
          <button class="chip ${S.deck === 'all' ? 'on' : ''}" data-d="all">전체</button>
          ${decks.map(d => `<button class="chip ${S.deck === d.id ? 'on' : ''}" data-d="${d.id}"><i class="dot" style="background:${d.color}"></i>${e(d.name)}</button>`).join('')}
        </div>
        <div class="row" style="margin:8px 0 7px"><input data-q value="${e(S.q)}" placeholder="검색" autocapitalize="off"></div>
        <div class="row" style="gap:7px">
          <div class="seg" data-sort style="flex:1.4">
            ${[['imp', '중요도↓'], ['imp_asc', '중요도↑'], ['az', 'A–Z'], ['rand', '랜덤']]
          .map(([k, l]) => `<button data-s="${k}" class="${S.sort === k ? 'on' : ''}">${l}</button>`).join('')}
          </div>
          <div class="seg" data-st style="flex:1">
            ${ST.map((l, i) => `<button data-i="${i}" class="${S.st.includes(i) ? 'on' : ''}">${l}</button>`).join('')}
          </div>
        </div>
        <div class="wcount"></div>
        <div class="wlist"></div>
        <button class="fab no-print" data-add>+</button>`;

      const list = Store.query();
      root.querySelector('.wcount').textContent = `${list.length}개`;
      root.querySelector('.wlist').innerHTML = list.length ? list.map(w =>
        `<div class="w" data-w="${w.id}" style="border-left-color:${dcolor(w.deckId)}">
          <div class="w-top">
            <span class="w-en">${e(w.en)}</span>
            ${w.pos ? `<span class="w-pos">${e(w.pos)}</span>` : ''}
            <span class="w-imp">${IMP[w.imp || 2]}</span>
          </div>
          ${w.ko ? `<div class="w-ko">${e(w.ko)}</div>` : ''}
          ${w.syn ? `<div class="w-sub"><b>syn</b><span>${e(w.syn)}</span></div>` : ''}
          ${w.cf ? `<div class="w-sub"><b>cf.</b><span>${e(w.cf)}</span></div>` : ''}
          <div class="w-st no-print">
            ${ST.map((l, i) => `<button class="st-b ${(w.st || 0) === i ? 'on' : ''}" data-st="${i}">${l}</button>`).join('')}
          </div>
        </div>`).join('') : `<div class="empty">단어가 없습니다</div>`;

      root.querySelector('[data-deck]').onclick = ev => {
        const b = ev.target.closest('[data-d]'); if (!b) return;
        Store.set('deck', b.dataset.d); App.refresh();
      };
      root.querySelector('[data-sort]').onclick = ev => {
        const b = ev.target.closest('[data-s]'); if (!b) return;
        Store.set('sort', b.dataset.s); App.refresh();
      };
      root.querySelector('[data-st]').onclick = ev => {
        const b = ev.target.closest('[data-i]'); if (!b) return;
        const i = +b.dataset.i; let st = S.st.slice();
        st = st.includes(i) ? st.filter(x => x !== i) : st.concat(i);
        if (!st.length) st = [0, 1, 2];
        Store.set('st', st.sort()); App.refresh();
      };
      const q = root.querySelector('[data-q]');
      let qt; q.oninput = () => { clearTimeout(qt); qt = setTimeout(() => { Store.set('q', q.value); App.refresh(); }, 260); };

      root.querySelector('.wlist').onclick = ev => {
        const sb = ev.target.closest('[data-st]');
        const card = ev.target.closest('[data-w]'); if (!card) return;
        if (sb) {
          Store.setStatus(card.dataset.w, +sb.dataset.st); Sync.auto();
          card.querySelectorAll('.st-b').forEach(x => x.classList.toggle('on', x === sb));
          return;
        }
        form(card.dataset.w);
      };
      root.querySelector('[data-add]').onclick = () => form(null);
    }
  });
})();
