(function () {
  const WK = 'zeta_filter_words';

  function lw() { try { return JSON.parse(localStorage.getItem(WK)) || []; } catch (e) { return []; } }
  function sw(l) { localStorage.setItem(WK, JSON.stringify(l)); }

  // ---------- 설정 패널 UI ----------
  const old = document.getElementById('zeta-filter-panel');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.id = 'zeta-filter-panel';
  overlay.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);width:min(94vw,380px);max-height:88vh;overflow-y:auto;background:#ffffff;color:#111111;border:2px solid #333;border-radius:12px;padding:14px;z-index:2147483647;font-family:sans-serif;box-shadow:0 4px 24px rgba(0,0,0,0.35);box-sizing:border-box;';

  const style = document.createElement('style');
  style.textContent = `
    #zeta-filter-panel *{box-sizing:border-box;color:#111 !important;}
    #zeta-filter-panel input,#zeta-filter-panel select{background:#fff !important;border:1px solid #bbb;border-radius:6px;padding:6px;font-size:13px;width:100%;margin-bottom:6px;}
    #zeta-filter-panel button{border:none;border-radius:6px;padding:8px;font-size:13px;cursor:pointer;color:#fff !important;}
    #zeta-filter-panel h3{margin:0 0 8px 0;font-size:15px;}
    #zeta-filter-panel .row{display:flex;flex-direction:column;gap:4px;margin-bottom:10px;}
    #zeta-filter-panel .word-item{display:flex;align-items:center;gap:6px;font-size:12px;background:#f3f3f3;padding:6px;border-radius:6px;margin-bottom:4px;flex-wrap:wrap;}
    #zeta-filter-panel .word-item span{flex:1;min-width:0;word-break:break-all;}
    #zeta-status{font-size:11px;color:#673AB7;margin-top:6px;min-height:14px;}
    #zw-list{max-height:160px;overflow-y:auto;border:1px solid #eee;border-radius:6px;padding:4px;margin-bottom:10px;}
  `;
  overlay.appendChild(style);

  overlay.insertAdjacentHTML('beforeend', `
    <h3>🔧 자동 수정-저장 필터 (원본 치환 / 최신 메세지 전용)</h3>
    <div class="row">
      <input id="zw-banned" placeholder="금지어 입력 (AI가 출력하는 표현)">
      <input id="zw-replace" placeholder="대체어 (여러 개는 쉼표로 구분 → 랜덤 치환, 비워두면 삭제)">
      <select id="zw-mode">
        <option value="replace">바꾸기(대체어로 교체)</option>
        <option value="delete">삭제(그냥 지움)</option>
      </select>
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;margin-bottom:6px;">
        <input type="checkbox" id="zw-wholeword" style="width:auto;margin:0;">
        앞뒤가 공백(또는 문장 시작/끝)일 때만 치환 (독립 단어로 쓰였을 때만)
      </label>
      <button id="zw-add" style="background:#4CAF50;">단어 추가</button>
    </div>
    <div class="row">
      <button id="zw-save" style="background:#2196F3;">저장하고 자동감시 시작</button>
      <button id="zw-stop" style="background:#e53935;">자동감시 중지</button>
      <button id="zw-close" style="background:#999;">닫기</button>
    </div>
    <p id="zeta-status"></p>
    <hr>
    <div id="zw-list"></div>
    <p style="font-size:11px;color:#888;margin-top:6px;">
      ※ <b>가장 최근 메세지 1개만</b> 감시합니다. 새 메세지가 오면 금지어 포함 여부를 검사해서, 있으면 자동으로 <b>수정 버튼 → 텍스트 교체 → 저장 버튼</b>까지 눌러 원본 자체를 바꿈니다.<br>
      ※ 화면에 보이는 게 아니라 서버에 저장된 원본이 바뀌므로 새로고침해도 유지됩니다.<br>
      ※ 조사(은/는, 이/가, 을/를, 과/와, 로/으로, 이나/나, 이랑/랑, 이라도/라도, 이라서/라서)는 대체어의 받침 유무를 보고 자동 보정을 시도합니다(완벽하지 않을 수 있어요).<br>
      ※ 다만 UI 구조가 바뀌면 동작이 깨질 수 있어요.
    </p>
  `);
  document.body.appendChild(overlay);

  let words = lw();

  function renderWords() {
    const d = document.getElementById('zw-list');
    if (words.length === 0) { d.innerHTML = '<p style="font-size:12px;color:#999;">등록된 금지어가 없어요.</p>'; return; }
    d.innerHTML = words.map((w, i) => {
      const replList = (w.replacement || '').split(',').map(s => s.trim()).filter(Boolean);
      const modeLabel = w.mode === 'delete' ? '🗑삭제'
        : replList.length > 1 ? ('→ [랜덤] ' + replList.join(' / '))
        : ('→ ' + (replList[0] || '(빈칸)'));
      const wwLabel = w.wholeWord ? ' <i style="color:#2196F3;">[독립단어만]</i>' : '';
      return `<div class="word-item"><span><b>${w.banned}</b> ${modeLabel}${wwLabel}</span><button data-i="${i}" class="zw-del" style="background:#f44336;padding:4px 8px;">삭제</button></div>`;
    }).join('');
    document.querySelectorAll('.zw-del').forEach(b => {
      b.onclick = () => { words.splice(parseInt(b.dataset.i), 1); renderWords(); };
    });
  }
  renderWords();

  document.getElementById('zw-add').onclick = () => {
    const banned = document.getElementById('zw-banned').value.trim();
    const replacement = document.getElementById('zw-replace').value.trim();
    const mode = document.getElementById('zw-mode').value;
    const wholeWord = document.getElementById('zw-wholeword').checked;
    if (!banned) { alert('금지어를 입력해주세요.'); return; }
    words.push({ banned, replacement, mode, wholeWord });
    document.getElementById('zw-banned').value = '';
    document.getElementById('zw-replace').value = '';
    document.getElementById('zw-wholeword').checked = false;
    renderWords();
  };

  document.getElementById('zw-close').onclick = () => overlay.remove();

  function setStatus(msg) {
    const s = document.getElementById('zeta-status');
    if (s) s.textContent = msg;
    console.log('[zeta-auto-edit]', msg);
  }

  // ---------- 한글 받침 판별 & 조사 보정 ----------
  function batchimCode(ch) {
    if (!ch) return null;
    const code = ch.charCodeAt(0) - 0xAC00;
    if (code < 0 || code > 11171) return null;
    return code % 28;
  }
  function hasBatchim(ch) {
    const b = batchimCode(ch);
    return b === null ? null : b !== 0;
  }
  function isRieulBatchim(ch) {
    return batchimCode(ch) === 8;
  }

  const PARTICLE_RULES = [
    ['이라도', '라도'],
    ['이라서', '라서'],
    ['이랑', '랑'],
    ['이나', '나'],
    ['은', '는'],
    ['이', '가'],
    ['을', '를'],
    ['과', '와'],
    ['아', '야'],
  ];

  function fixParticleAt(fullText, pos, hasB, isRieul) {
    if (fullText.startsWith('으로', pos)) {
      return (hasB && !isRieul) ? null : { len: 2, text: '로' };
    }
    if (fullText.startsWith('로', pos)) {
      if (hasB && !isRieul) return { len: 1, text: '으로' };
      return null;
    }
    for (const [withB, noB] of PARTICLE_RULES) {
      if (fullText.startsWith(withB, pos)) {
        if (!hasB) return { len: withB.length, text: noB };
        return null;
      }
      if (fullText.startsWith(noB, pos)) {
        if (hasB) return { len: noB.length, text: withB };
        return null;
      }
    }
    return null;
  }

  // 매치 위치의 앞/뒤가 "공백이거나 문자열의 시작/끝"인지 확인.
  // 즉 그 단어가 다른 단어의 일부가 아니라 독립적으로 쓰였는지 판별.
  function isWhitespaceBoundary(ch) {
    return ch === undefined || /\s/.test(ch);
  }

  function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function applyOneReplacement(text, banned, replacementList, mode, wholeWord) {
    if (!banned) return { text, changed: false };
    let result = '';
    let idx = 0;
    let changed = false;
    while (true) {
      const found = text.indexOf(banned, idx);
      if (found === -1) { result += text.slice(idx); break; }

      if (wholeWord) {
        const beforeCh = found > 0 ? text[found - 1] : undefined;
        const afterCh = text[found + banned.length];
        if (!(isWhitespaceBoundary(beforeCh) && isWhitespaceBoundary(afterCh))) {
          // 독립된 단어가 아님 (앞이나 뒤에 다른 글자가 붙어있음) -> 건너뛰고 계속 찾기
          result += text.slice(idx, found + 1);
          idx = found + 1;
          continue;
        }
      }

      changed = true;
      result += text.slice(idx, found);
      let after = found + banned.length;

      if (mode === 'delete' || !replacementList || replacementList.length === 0) {
        idx = after;
        continue;
      }

      // 대체어가 여러 개면 매 등장마다 랜덤으로 하나 선택
      const replacement = pickRandom(replacementList);
      result += replacement;
      const lastCh = replacement[replacement.length - 1];
      const hb = hasBatchim(lastCh);
      if (hb !== null) {
        const isRieul = isRieulBatchim(lastCh);
        const fix = fixParticleAt(text, after, hb, isRieul);
        if (fix) {
          result += fix.text;
          after += fix.len;
        }
      }
      idx = after;
    }
    return { text: result, changed };
  }

  function localReplace(text, wordList) {
    let r = text;
    let changed = false;
    for (const w of wordList) {
      if (!w.banned) continue;
      const replList = w.mode === 'delete' ? [] : (w.replacement || '').split(',').map(s => s.trim()).filter(Boolean);
      const res = applyOneReplacement(r, w.banned, replList, w.mode, w.wholeWord);
      if (res.changed) changed = true;
      r = res.text;
    }
    return { text: r, changed };
  }

  function setNativeValue(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
  }

  function waitFor(fn, timeout = 3000, interval = 100) {
    return new Promise((resolve) => {
      const start = Date.now();
      const check = () => {
        let result;
        try { result = fn(); } catch (e) { result = null; }
        if (result) { resolve(result); return; }
        if (Date.now() - start > timeout) { resolve(null); return; }
        setTimeout(check, interval);
      };
      check();
    });
  }

  // ---------- (수정된 부분) 최근 메세지 "텍스트 미리보기용" 컨테이너 찾기 ----------
  // 수정 버튼을 기준으로 부모를 한 칸씩 올라가면서, 그 안에 수정버튼이 "정확히 1개"만
  // 있을 때까지만 올라감. 2개 이상이 잡히는 순간 = 다른 메세지까지 포함된 것이므로 멈춤.
  // (예전 버전은 무조건 6단계를 올라가서, 구조에 따라 다른 메세지/입력창까지 섞여
  //  "금지어 없는데 수정창 열림" 버그의 원인이 되었음)
  function findMessageContainer(editBtn) {
    let node = editBtn.parentElement;
    let best = node;
    for (let i = 0; i < 15 && node && node !== document.body; i++) {
      const cnt = node.querySelectorAll('[data-testid="edit-button"]').length;
      if (cnt > 1) break;
      best = node;
      node = node.parentElement;
    }
    return best;
  }

  function getLastMessageContainer() {
    const editButtons = document.querySelectorAll('[data-testid="edit-button"]');
    if (editButtons.length === 0) return null;
    const lastBtn = editButtons[editButtons.length - 1];
    return { container: findMessageContainer(lastBtn), editBtn: lastBtn };
  }

  // ---------- (수정된 부분) 실제 수정창의 textarea / 저장버튼 / 닫기버튼 찾기 ----------
  // 예전 버전은 "수정버튼의 부모 컨테이너 안에서" 저장/닫기 버튼을 찾았는데,
  // 실제 제타 UI는 수정창이 그 컨테이너 밖에(화면 전체 기준 다른 위치에) 렌더링되거나,
  // 이미 DOM에 숨어있다가 나타나는 방식이라 컨테이너 안에서 못 찾는 경우가 많았음
  // (→ 대체 안됨 / 저장버튼 안눌림 / 수정창 계속 뜨있는 버그의 원인).
  //
  // 그래서 "수정 버튼 누르기 전" 상태를 스냅샷으로 찍어두고, 누른 뒤에
  // "이전엔 없었거나 안 보였는데, 지금은 화면에 보이는" 요소를 문서 전체에서 찾는
  // 방식으로 바꿈. 이러면 수정창이 어디에 렌더링되든 정확히 찾을 수 있음.
  function snapshotVisibility(selector) {
    const map = new Map();
    document.querySelectorAll(selector).forEach(el => {
      map.set(el, el.offsetParent !== null);
    });
    return map;
  }

  function findNewlyVisible(beforeMap, selector) {
    const els = document.querySelectorAll(selector);
    for (const el of els) {
      if (el.offsetParent === null) continue; // 지금 안 보이면 후보 아님
      const wasVisible = beforeMap.get(el) === true;
      if (!wasVisible) return el; // 새로 생겼거나, 원래 숨겨져 있었음
    }
    return null;
  }

  // ---------- 감지 & 처리 (가장 최근 메세지 1개만) ----------
  const lastProcessed = new WeakMap();
  let busy = false;
  let pending = false;
  let debounceTimer = null;

  async function editOneMessage(container, editBtn, snapshotText) {
    busy = true;
    setStatus('금지어 발견, 자동 수정 중...');

    const beforeTextareas = snapshotVisibility('textarea');
    const beforeSaveBtns = snapshotVisibility('button.bg-primary-400');
    const beforeCloseBtns = snapshotVisibility('button.bg-gray-800');

    editBtn.click();

    const textarea = await waitFor(() => findNewlyVisible(beforeTextareas, 'textarea'), 3000);
    if (!textarea) {
      setStatus('수정창을 찾지 못했어요. (UI가 바뀌었을 수 있어요)');
      busy = false;
      return;
    }

    const original = textarea.value;
    const { text: replacedText, changed: reallyChanged } = localReplace(original, words);

    if (!reallyChanged) {
      // 실제 입력창 내용엔 금지어가 없었음 -> 그냥 닫기만 하고 종료
      const closeBtn = await waitFor(() => findNewlyVisible(beforeCloseBtns, 'button.bg-gray-800'), 2000);
      if (closeBtn) closeBtn.click();
      lastProcessed.set(container, snapshotText);
      setStatus('금지어 없음. 감시 계속 중.');
      busy = false;
      return;
    }

    setNativeValue(textarea, replacedText);
    // textarea 내용이 길어서 스크롤이 생겨도 저장 버튼 활성화 조건(값 변경 감지)이
    // 걸리도록 살짝 더 기다렸다가 저장 버튼을 찾음
    await new Promise(r => setTimeout(r, 250));

    const saveBtn = await waitFor(() => {
      const b = findNewlyVisible(beforeSaveBtns, 'button.bg-primary-400');
      return (b && !b.disabled) ? b : null;
    }, 4000, 150);

    if (!saveBtn) {
      setStatus('저장 버튼을 찾지 못했어요(비활성 상태일 수 있음). 수동으로 저장해주세요.');
      busy = false;
      return; // lastProcessed에 기록 안 함 -> 다음 기회에 재시도
    }

    saveBtn.click();
    setStatus('메세지 자동 수정 완료 ✅');
    lastProcessed.set(container, replacedText);
    busy = false;
  }

  async function checkLastMessage() {
    if (busy) { pending = true; return; }

    const found = getLastMessageContainer();
    if (!found) return;
    const { container, editBtn } = found;

    const currentText = container.innerText || '';
    if (lastProcessed.get(container) === currentText) return;

    const preCheck = localReplace(currentText, words);
    if (!preCheck.changed) {
      lastProcessed.set(container, currentText);
      return;
    }

    await editOneMessage(container, editBtn, currentText);

    if (pending) {
      pending = false;
      scheduleCheck();
    }
  }

  function scheduleCheck() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      checkLastMessage().catch(e => { console.error('[zeta-auto-edit]', e); busy = false; });
    }, 700);
  }

  let mo = null;

  function startWatching() {
    if (mo) mo.disconnect();
    scheduleCheck();

    mo = new MutationObserver(() => {
      scheduleCheck();
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    setStatus('자동감시 시작됨(최근 메세지만). 단어 ' + words.length + '개 등록됨.');
  }

  function stopWatching() {
    if (mo) mo.disconnect();
    mo = null;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = null;
    setStatus('자동감시 중지됨.');
  }

  document.getElementById('zw-save').onclick = () => {
    sw(words);
    startWatching();
  };

  document.getElementById('zw-stop').onclick = () => stopWatching();

  if (words.length > 0) {
    setStatus('저장된 단어 ' + words.length + '개 불러옴. "저장하고 자동감시 시작"을 눌러주세요.');
  }
})();
