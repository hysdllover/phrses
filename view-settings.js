/* view-settings.js — 동기화 / 백업 */
(() => {
  const fmt = t => t ? new Date(t).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '없음';

  App.register({
    id: 'set', name: '설정',
    render(root) {
      const c = Sync.cfg(), e = UI.esc;
      const state = c.err ? `<div class="tiny" style="color:#a97b7b;line-height:1.6">⚠ ${e(c.err)}</div>`
        : (c.gistId ? `<div class="tiny" style="line-height:1.7">연결됨${c.dirty ? ' · <span style="color:var(--mid)">업로드 대기 중</span>' : ''}<br>마지막 업로드 ${fmt(c.pushAt)} · 마지막 가져오기 ${fmt(c.pullAt || c.at)}</div>`
          : `<div class="tiny">아직 연결되지 않음</div>`);

      root.innerHTML =
        `<div class="sec">GITHUB GIST 동기화</div>
        <div class="fld"><label>토큰 <span class="tiny">classic · gist 스코프</span></label>
          <input data-f="token" type="password" value="${e(c.token || '')}" placeholder="ghp_..."
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
        ${c.token || c.gistId ? '<button class="btn full warn" data-a="unlink" style="margin-top:9px">동기화 연결 끊기</button>' : ''}

        <div class="sec">백업</div>
        <button class="btn full" data-a="export" style="margin-bottom:7px">JSON 내보내기</button>
        <button class="btn full" data-a="import" style="margin-bottom:7px">JSON 가져오기</button>
        <div class="tiny" style="margin:9px 2px 5px">자동 스냅샷 (최근 7일)</div>
        <div data-snaps></div>

        <div class="sec">진단</div>
        <div class="card" style="padding:10px 12px;font-size:11px;line-height:1.8;color:var(--tx2)">
          sync.js ${(typeof Sync !== 'undefined' && Sync.VERSION) || '구버전 ⚠'} ·
          app.js ${(typeof App !== 'undefined' && App.VERSION) || '구버전 ⚠'} ·
          store v${Store.raw().v}
          ${(typeof Sync === 'undefined' || Sync.VERSION !== 6 || typeof App === 'undefined' || App.VERSION !== 3)
            ? '<div style="color:#a97b7b;margin-top:4px">파일이 최신이 아닙니다. sync.js · app.js · view-settings.js를 다시 올리고 새로고침하세요.</div>' : ''}
          <div data-log style="margin-top:4px;word-break:break-all"></div>
        </div>

        <div class="sec">데이터</div>
        <div class="tiny" style="margin-bottom:7px">단어 ${Store.allWords().length}개 · 덱 ${Store.decks().length}개</div>
        <button class="btn full dim" data-a="clearlog" style="margin-bottom:7px">오류 기록 지우기</button>
        <button class="btn full warn" data-a="reset">전체 초기화</button>
        <div class="tiny" style="margin-top:16px;line-height:1.7">
          입력 즉시 기기에 저장됩니다. 동기화는 자동으로 하지 않습니다.<br>
          다른 기기와 맞추려면 '지금 동기화'를 누르세요 (가져와 병합한 뒤 업로드).
        </div>`;

      const snaps = Store.snapKeys();
      root.querySelector('[data-snaps]').innerHTML = snaps.length
        ? snaps.map(k => `<button class="btn full dim" data-snap="${k}" style="margin-bottom:5px">${k.replace('vocab.snap.', '')} 복원</button>`).join('')
        : `<div class="tiny">아직 없음</div>`;

      const saveInputs = () => {
        Sync.setCfg({
          token: (Sync.cleanToken || (x => String(x).trim()))(root.querySelector('[data-f="token"]').value),
          gistId: (Sync.cleanId || (x => String(x).trim()))(root.querySelector('[data-f="gistId"]').value)
        });
      };

      const lastErr = localStorage.getItem('vocab.lasterr');
      root.querySelector('[data-log]').innerHTML = lastErr
        ? '마지막 오류 · <span style="color:#a97b7b">' + e(lastErr) + '</span>' : '기록된 오류 없음';

      root.onclick = async ev => { try { await handle(ev); }
        catch (err) { App.logErr(err); UI.toast('오류: ' + (err.message || err), 3500); App.refresh(); } };

      // 가져오기 방식 선택: 중복 없이 병합 / 교체
      function importSheet(d, name) {
        const nd = (d.decks || []).filter(x => !x.d).length, nw = d.words.filter(x => !x.d).length;
        const sh = UI.sheet({ title: 'JSON 가져오기', ok: '' });
        sh.el.innerHTML =
          `<div class="tiny" style="margin-bottom:12px;line-height:1.7">${e(name)}<br>덱 ${nd}개 · 단어 ${nw}개</div>
           <button class="btn full" data-m="merge" style="margin-bottom:5px">병합 (중복 제외)</button>
           <div class="tiny" style="margin:0 2px 14px;line-height:1.6">기존 단어는 그대로 두고 새 단어만 추가합니다. 같은 영단어는 건너뛰고, 같은 이름 덱은 기존 덱에 합칩니다.</div>
           <button class="btn full warn" data-m="replace" style="margin-bottom:5px">교체</button>
           <div class="tiny" style="margin:0 2px;line-height:1.6">이 기기의 단어장을 파일 내용으로 바꿉니다. 파일에 없는 단어·덱은 지워집니다 (자동 스냅샷으로 복원 가능).</div>`;
        sh.el.onclick = async ev => {
          const b = ev.target.closest('[data-m]'); if (!b) return;
          if (b.dataset.m === 'merge') {
            const r = Store.importMerge(d); sh.close();
            if (r.added || r.updated || r.decks) Sync.auto();
            UI.toast(`추가 ${r.added} · 갱신 ${r.updated} · 중복 제외 ${r.skipped}` + (r.decks ? ` · 새 덱 ${r.decks}` : ''), 3000);
          } else {
            if (!(await UI.confirm('이 기기의 단어장을 파일 내용으로 교체할까요?', '교체'))) return;
            const t = Date.now();
            (d.decks || []).concat(d.words).forEach(x => { x.u = t; });
            Store.replaceAll(d); Sync.auto(); sh.close(); UI.toast('파일 내용으로 교체됨');
          }
          App.refresh();
        };
      }

      async function handle(ev) {
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
          // iOS는 accept 지정 시 .json이 비활성화되는 경우가 있어 제한 없이 열고, DOM에 붙여서 클릭
          const inp = document.createElement('input'); inp.type = 'file'; inp.hidden = true;
          document.body.appendChild(inp);
          inp.onchange = () => {
            const f = inp.files[0]; inp.remove(); if (!f) return;
            const rd = new FileReader();
            rd.onload = async () => {
              let d;
              try { d = JSON.parse(rd.result); if (!d || !Array.isArray(d.words)) throw 0; }
              catch (err) { UI.toast('단어장 JSON 파일이 아닙니다', 2600); return; }
              importSheet(d, f.name);
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

        if (a === 'unlink') {
          if (await UI.confirm('동기화 연결을 끊을까요?<br><span class="tiny">토큰·Gist ID가 이 기기에서 지워집니다. 단어 데이터와 Gist는 그대로 남습니다.</span>', '연결 끊기')) {
            localStorage.removeItem('vocab.sync'); UI.toast('연결 끊김'); App.refresh();
          }
        }

        if (a === 'clearlog') { localStorage.removeItem('vocab.lasterr'); App.refresh(); }
      }
    }
  });
})();
