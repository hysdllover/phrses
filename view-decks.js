/* view-decks.js — 덱 관리 (이름/색상) */
(() => {
  function form(id) {
    const d = id ? Object.assign({}, Store.deck(id)) : { name: '', color: Store.PALETTE[0] };
    const sh = UI.sheet({
      title: id ? '덱 수정' : '덱 추가', ok: '저장',
      onOk: box => {
        const name = box.querySelector('[data-f="name"]').value.trim();
        if (!name) { UI.toast('이름을 입력하세요'); return false; }
        d.name = name;
        d.color = box.querySelector('[data-f="color"]').value;
        Store.saveDeck(d); Sync.auto(); App.refresh();
      }
    });
    sh.el.innerHTML =
      `<div class="fld"><label>덱 이름</label><input data-f="name" value="${UI.esc(d.name)}" placeholder="WICS / 파피루스 / 서바 / 기출"></div>
       <div class="fld"><label>색상</label>
         <div class="pal">${Store.PALETTE.map(c => `<button data-c="${c}" style="background:${c}" class="${c === d.color ? 'on' : ''}"></button>`).join('')}</div>
       </div>
       <div class="fld"><label>직접 지정</label>
         <input type="color" data-f="color" value="${d.color}" style="height:38px;padding:3px"></div>
       ${id ? '<button class="btn full warn" data-del style="margin-top:12px">덱 삭제</button>' : ''}`;

    const picker = sh.el.querySelector('[data-f="color"]');
    sh.el.querySelector('.pal').onclick = ev => {
      const b = ev.target.closest('[data-c]'); if (!b) return;
      sh.el.querySelectorAll('.pal button').forEach(x => x.classList.toggle('on', x === b));
      picker.value = b.dataset.c;
    };
    const del = sh.el.querySelector('[data-del]');
    if (del) del.onclick = async () => {
      const n = Store.countOf(id);
      if (await UI.confirm(`덱과 단어 ${n}개가 함께 삭제됩니다.`)) {
        Store.delDeck(id); Sync.auto(); sh.close();
        if (Store.settings.deck === id) Store.set('deck', 'all');
        App.refresh();
      }
    };
  }

  App.register({
    id: 'decks', name: '덱',
    actions(el) {
      el.innerHTML = `<button class="pri" data-a="add">추가</button>`;
      el.onclick = ev => { if (ev.target.closest('[data-a]')) form(null); };
    },
    render(root) {
      const decks = Store.decks(), e = UI.esc, all = Store.allWords();
      const stat = id => {
        const l = all.filter(w => w.deckId === id);
        const o = l.filter(w => (w.st || 0) === 2).length;
        return `${l.length}개 · 암기 ${l.length ? Math.round(o / l.length * 100) : 0}%`;
      };
      root.innerHTML = decks.length ? decks.map(d =>
        `<div class="dk" data-d="${d.id}">
          <i class="dk-sw" style="background:${d.color}"></i>
          <div style="flex:1"><div class="dk-n">${e(d.name)}</div><div class="dk-c">${stat(d.id)}</div></div>
          <button class="btn dim" data-edit="${d.id}" style="padding:5px 10px;font-size:11px">수정</button>
        </div>`).join('') : `<div class="empty">덱이 없습니다</div>`;

      root.innerHTML += `<div class="sec">전체</div>
        <div class="dk" data-d="all"><div style="flex:1"><div class="dk-n">${all.length}개</div>
        <div class="dk-c">X ${all.filter(w => (w.st || 0) === 0).length} · ? ${all.filter(w => w.st === 1).length} · O ${all.filter(w => w.st === 2).length}</div></div></div>`;

      root.onclick = ev => {
        const eb = ev.target.closest('[data-edit]');
        if (eb) { form(eb.dataset.edit); return; }
        const c = ev.target.closest('[data-d]');
        if (c) { Store.set('deck', c.dataset.d); Store.set('q', ''); App.go('words'); }
      };
    }
  });
})();
