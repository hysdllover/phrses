/* view-study.js — 플래시카드 (의미 가리기 / 단어 가리기 토글) */
(() => {
  const IMP = ['', '★', '★★', '★★★'];
  const ST = ['X', '?', 'O'];
  let queue = [], i = 0, open = false, sig = '';

  const signature = () => {
    const S = Store.settings;
    return [S.deck, S.st.join(''), S.sort, S.q].join('|');
  };

  function build(force) {
    const s = signature();
    if (force || s !== sig || !queue.length) {
      queue = Store.query(); if (Store.settings.sort === 'rand') queue = Store.shuffle(queue);
      i = 0; open = false; sig = s;
    }
    queue = queue.filter(w => Store.word(w.id));
    if (i >= queue.length) i = Math.max(0, queue.length - 1);
  }

  App.register({
    id: 'study', name: '학습',
    actions(el) {
      const S = Store.settings;
      el.innerHTML = `<button data-a="mask">${S.mask === 'ko' ? '뜻 가리기' : '단어 가리기'}</button><button data-a="sh">섞기</button>`;
      el.onclick = ev => {
        const a = ev.target.closest('[data-a]'); if (!a) return;
        if (a.dataset.a === 'mask') Store.set('mask', S.mask === 'ko' ? 'en' : 'ko');
        else { queue = Store.shuffle(queue); i = 0; }
        open = false; App.refresh();
      };
    },
    render(root) {
      const S = Store.settings, e = UI.esc, decks = Store.decks();
      build(false);

      root.innerHTML =
        `<div class="chips" data-deck>
          <button class="chip ${S.deck === 'all' ? 'on' : ''}" data-d="all">전체</button>
          ${decks.map(d => `<button class="chip ${S.deck === d.id ? 'on' : ''}" data-d="${d.id}"><i class="dot" style="background:${d.color}"></i>${e(d.name)}</button>`).join('')}
        </div>
        <div class="row" style="gap:7px;margin-top:8px">
          <div class="seg" data-st style="flex:1">
            ${ST.map((l, k) => `<button data-i="${k}" class="${S.st.includes(k) ? 'on' : ''}">${l}</button>`).join('')}
          </div>
          <div class="seg" data-sort style="flex:1">
            ${[['imp', '중요도'], ['rand', '랜덤']].map(([k, l]) => `<button data-s="${k}" class="${S.sort === k ? 'on' : ''}">${l}</button>`).join('')}
          </div>
        </div>
        <div class="study-wrap"></div>`;

      const wrap = root.querySelector('.study-wrap');

      if (!queue.length) { wrap.innerHTML = `<div class="empty">해당 조건의 단어가 없습니다</div>`; }
      else {
        const w = queue[i];
        const maskKo = S.mask === 'ko';
        const koBlock =
          `<div class="f-ko">${e(w.ko) || '<span class="muted">—</span>'}</div>
           ${w.syn ? `<div class="f-line"><b>syn</b>${e(w.syn)}</div>` : ''}
           ${w.cf ? `<div class="f-line"><b>cf.</b>${e(w.cf)}</div>` : ''}`;
        const enBlock = `<div class="f-en">${e(w.en)}</div>`;

        wrap.innerHTML =
          `<div class="prog" style="margin-top:14px"><i style="width:${((i + 1) / queue.length * 100).toFixed(1)}%"></i></div>
          <div class="flash" data-card style="border-left-color:${(Store.deck(w.deckId) || {}).color || 'var(--tx3)'}">
            <div class="f-meta">${e((Store.deck(w.deckId) || {}).name || '')} · ${IMP[w.imp || 2]} · ${w.pos ? e(w.pos) : '—'} · ${i + 1}/${queue.length}</div>
            ${maskKo
            ? enBlock + (open ? koBlock : `<div class="f-mask">탭하여 의미 보기</div>`)
            : (open ? enBlock : `<div class="f-mask">탭하여 단어 보기</div>`) + koBlock}
          </div>
          <div class="stbar">
            ${ST.map((l, k) => `<button data-set="${k}" ${(w.st || 0) === k ? 'style="border-color:var(--tx3)"' : ''}>${l}</button>`).join('')}
          </div>
          <div class="row" style="gap:7px;margin-top:8px">
            <button class="btn dim" data-nav="-1" style="flex:1">이전</button>
            <button class="btn dim" data-nav="1" style="flex:1">다음</button>
            <button class="btn dim" data-edit style="flex:1">수정</button>
          </div>`;

        wrap.querySelector('[data-card]').onclick = () => { open = !open; App.refresh(); };
        wrap.querySelector('.stbar').onclick = ev => {
          const b = ev.target.closest('[data-set]'); if (!b) return;
          Store.setStatus(w.id, +b.dataset.set); Sync.auto();
          if (i < queue.length - 1) i++; open = false; App.refresh();
        };
        wrap.onclick = ev => {
          const n = ev.target.closest('[data-nav]');
          if (n) { i = Math.min(queue.length - 1, Math.max(0, i + (+n.dataset.nav))); open = false; App.refresh(); }
          if (ev.target.closest('[data-edit]')) { Store.set('deck', S.deck); App.go('words'); }
        };
      }

      root.querySelector('[data-deck]').onclick = ev => {
        const b = ev.target.closest('[data-d]'); if (!b) return;
        Store.set('deck', b.dataset.d); build(true); App.refresh();
      };
      root.querySelector('[data-st]').onclick = ev => {
        const b = ev.target.closest('[data-i]'); if (!b) return;
        const k = +b.dataset.i; let st = S.st.slice();
        st = st.includes(k) ? st.filter(x => x !== k) : st.concat(k);
        if (!st.length) st = [0, 1, 2];
        Store.set('st', st.sort()); build(true); App.refresh();
      };
      root.querySelector('[data-sort]').onclick = ev => {
        const b = ev.target.closest('[data-s]'); if (!b) return;
        Store.set('sort', b.dataset.s); build(true); App.refresh();
      };
    }
  });
})();
