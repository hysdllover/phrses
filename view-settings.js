/* view-settings.js — 동기화 / 백업 */
(() => {
  const fmt = t => t ? new Date(t).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '없음';

  App.register({
    id: 'set', name: '설정',
    render(root) {
      const c = Sync.cfg(), e = UI.esc;
      const state = c.err ? `<div class="tiny" style="color:#a97b7b;line-height:1.6">⚠ ${e(c.err)}</div>`
        : (c.gistId ? `<div class="tiny">연결됨 · 마지막 동기화 ${fmt(c.at)}</div>`
          : `<div class="tiny">아직 연결되지 않음</div>`);

      root.innerHTML =
        `<div class="sec">GITHUB GIST 동기화</div>
        <div class="fld"><label>토큰 <span class="tiny">classic · gist 스코프</span></label>
          <input data-f="token" type="text" value="${e(c.token || '')}" placeholder="ghp_..."
            autocapitalize="off" autocorrect="off" spellcheck="false" autocomplete="off"
            style="font-family:ui-monospace,Menlo,monospace;font-size:11px"></div>
        <div class="fld"><label>Gist ID <span class="tiny">첫 기기는 비워둘 것</span></label>
          <input data-f="gistId" value="${e(c.gistId || '')}" placeholder="비우면 자동 생성"
            autocapitalize="off" autocorrect="off" spellcheck="false" autocomplete="off"
            style="font-family:ui-monospace,Menlo,monospace;font-size:11px"></div>
        <button class="btn full" data-a="test" style="margin-bottom:7px">연결 테스트</button>
        <button class="btn full" data-a="sync" style="margin-bottom:7px">지금 동기화 (병합 후 업로드)</button>
        <button class="btn full dim" data-a="pull" style="margin-bottom:7px">서버 데이터만 가져오기</button>
        ${state}

        <div class="sec">백업</div>
        <button class="btn full" data-a="export" style="margin-bottom:7px">JSON 내보내기</button>
        <button class="btn full" data-a="import" style="margin-bottom:7px">JSON 가져오기</button>
        <div class="tiny" style="margin:9px 2px 5px">자동 스냅샷 (최근 7일)</div>
        <div data-snaps></div>

        <div class="sec">데이터</div>
        <div class="tiny" style="margin-bottom:7px">단어 ${Store.allWords().length}개 · 덱 ${Store.decks().length}개</div>
        <button class="btn full warn" data-a="reset">전체 초기화</button>
        <div class="tiny" style="margin-top:16px;line-height:1.7">
          입력 즉시 기기에 저장되고, 연결된 경우 잠시 후 자동 업로드됩니다.<br>
          앱을 다시 열거나 화면으로 돌아올 때 서버 변경분을 자동으로 가져옵니다.
        </div>`;

      const snaps = Store.snapKeys();
      root.querySelector('[data-snaps]').innerHTML = snaps.length
        ? snaps.map(k => `<button class="btn full dim" data-snap="${k}" style="margin-bottom:5px">${k.replace('vocab.snap.', '')} 복원</button>`).join('')
        : `<div class="tiny">아직 없음</div>`;

      const saveInputs = () => {
        Sync.setCfg({
          token: Sync.cleanToken(root.querySelector('[data-f="token"]').value),
          gistId: Sync.cleanId(root.querySelector('[data-f="gistId"]').value)
        });
      };

      root.onclick = async ev => {
        const s = ev.target.closest('[data-snap]');
        if (s) {
          if (await UI.confirm(`${s.dataset.snap.replace('vocab.snap.', '')} 시점으로 되돌릴까요?`, '복원')) {
            Store.restore(s.dataset.snap); UI.toast('복원됨'); App.refresh();
          } return;
        }
        const b = ev.target.closest('[data-a]'); if (!b) return;
        const a = b.dataset.a, label = b.textContent;

        if (a === 'test' || a === 'sync' || a === 'pull') {
          saveInputs();
          b.textContent = '처리 중…';
          try {
            if (a === 'test') { UI.toast(await Sync.test(), 2600); Sync.setCfg({ err: '' }); }
            else if (a === 'pull') {
              const r = await Sync.pull();
              if (!r) throw new Error('Gist ID를 입력하거나 먼저 동기화하세요');
              UI.toast(Store.merge(r) + '건 반영됨');
              Sync.setCfg({ at: Date.now(), err: '' });
            } else { await Sync.run(); UI.toast('동기화 완료'); }
          } catch (err) {
            Sync.setCfg({ err: err.message || String(err) });
            UI.toast(err.message || '실패', 3200);
          }
          b.textContent = label;
          App.refresh();
          return;
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
              try { UI.toast(Store.merge(JSON.parse(rd.result)) + '건 병합됨'); App.refresh(); }
              catch (err) { UI.toast('파일을 읽을 수 없습니다'); }
            };
            rd.readAsText(f);
          };
          inp.click();
        }

        if (a === 'reset') {
          if (await UI.confirm('이 기기의 모든 단어와 덱이 삭제됩니다.', '초기화')) {
            localStorage.removeItem('vocab.data'); location.reload();
          }
        }
      };
    }
  });
})();
