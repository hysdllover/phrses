/* view-settings.js — 동기화 / 백업 */
(() => {
  const fmt = t => t ? new Date(t).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '없음';

  App.register({
    id: 'set', name: '설정',
    render(root) {
      const c = Sync.cfg(), e = UI.esc;
      root.innerHTML =
        `<div class="sec">GITHUB GIST 동기화</div>
        <div class="fld"><label>토큰 <span class="tiny">(gist 권한만)</span></label>
          <input data-f="token" type="password" value="${e(c.token || '')}" placeholder="ghp_..." autocapitalize="off" spellcheck="false"></div>
        <div class="fld"><label>Gist ID <span class="tiny">(비우면 새로 생성)</span></label>
          <input data-f="gistId" value="${e(c.gistId || '')}" placeholder="자동 생성" autocapitalize="off" spellcheck="false"></div>
        <button class="btn full" data-a="save" style="margin-bottom:7px">저장</button>
        <button class="btn full" data-a="sync" style="margin-bottom:7px">지금 동기화 (병합 후 업로드)</button>
        <button class="btn full dim" data-a="pull">서버 데이터 가져오기</button>
        <div class="tiny" style="margin-top:7px">마지막 동기화 · ${fmt(c.at)}</div>

        <div class="sec">백업</div>
        <button class="btn full" data-a="export" style="margin-bottom:7px">JSON 내보내기</button>
        <button class="btn full" data-a="import" style="margin-bottom:7px">JSON 가져오기</button>
        <div class="tiny" style="margin:9px 2px 5px">자동 스냅샷 (최근 7일)</div>
        <div data-snaps></div>

        <div class="sec">데이터</div>
        <button class="btn full warn" data-a="reset">전체 초기화</button>
        <div class="tiny" style="margin-top:16px;line-height:1.7">
          단어·덱은 기기에 즉시 자동 저장됩니다.<br>
          기능을 추가·수정해도 저장된 기록은 그대로 유지됩니다.
        </div>`;

      const snaps = Store.snapKeys();
      root.querySelector('[data-snaps]').innerHTML = snaps.length
        ? snaps.map(k => `<button class="btn full dim" data-snap="${k}" style="margin-bottom:5px">${k.replace('vocab.snap.', '')} 복원</button>`).join('')
        : `<div class="tiny">아직 없음</div>`;

      root.onclick = async ev => {
        const s = ev.target.closest('[data-snap]');
        if (s) {
          if (await UI.confirm(`${s.dataset.snap.replace('vocab.snap.', '')} 시점으로 되돌릴까요?`, '복원')) {
            Store.restore(s.dataset.snap); UI.toast('복원됨'); App.refresh();
          } return;
        }
        const b = ev.target.closest('[data-a]'); if (!b) return;
        const a = b.dataset.a;
        const val = f => root.querySelector(`[data-f="${f}"]`).value.trim();

        if (a === 'save') { Sync.setCfg({ token: val('token'), gistId: val('gistId') }); UI.toast('저장됨'); App.refresh(); }

        if (a === 'sync' || a === 'pull') {
          Sync.setCfg({ token: val('token'), gistId: val('gistId') });
          b.textContent = '동기화 중…';
          try {
            if (a === 'pull') {
              const r = await Sync.pull();
              if (!r) throw new Error('가져올 데이터가 없습니다');
              Store.merge(r); UI.toast('가져오기 완료');
            } else { await Sync.run(); UI.toast('동기화 완료'); }
          } catch (err) { UI.toast(err.message || '실패'); }
          App.refresh();
        }

        if (a === 'export') {
          const blob = new Blob([JSON.stringify(Store.raw(), null, 1)], { type: 'application/json' });
          const url = URL.createObjectURL(blob), a2 = document.createElement('a');
          a2.href = url; a2.download = `vocab-${new Date().toISOString().slice(0, 10)}.json`;
          a2.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        }

        if (a === 'import') {
          const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
          inp.onchange = () => {
            const f = inp.files[0]; if (!f) return;
            const rd = new FileReader();
            rd.onload = () => {
              try { Store.merge(JSON.parse(rd.result)); UI.toast('병합 완료'); App.refresh(); }
              catch (err) { UI.toast('파일을 읽을 수 없습니다'); }
            };
            rd.readAsText(f);
          };
          inp.click();
        }

        if (a === 'reset') {
          if (await UI.confirm('모든 단어와 덱이 삭제됩니다.', '초기화')) {
            localStorage.removeItem('vocab.data'); location.reload();
          }
        }
      };
    }
  });
})();
