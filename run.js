
(function () {
 try {
  const WK = 'zeta_filter_words';

  function lw() { try { return JSON.parse(localStorage.getItem(WK)) || []; } catch (e) { return []; } }
  function sw(l) { localStorage.setItem(WK, JSON.stringify(l)); }

  // ---------- 설정 패널 UI (Shadow DOM으로 격리: 다른 북마클릿 CSS 영향 안 받음) ----------
  const oldHost = document.getElementById('zeta-filter-host');
  if (oldHost) oldHost.remove();

  const host = document.createElement('div');
  host.id = 'zeta-filter-host';
  host.style.cssText = 'all:initial;position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;';

  // 다른 북마클릿이 <body>에 transform을 걸어두면 position:fixed가
  // 화면 기준이 아니라 그 조상 기준으로 틀어져서 화면 밖으로 밀려날 수 있음.
  // 이 경우 body 대신 <html>에 직접 붙여서 우회한다.
  let hasTransformAncestor = false;
  let __t = document.body;
  while (__t) {
    const cs = window.getComputedStyle(__t);
    if (cs && cs.transform && cs.transform !== 'none') { hasTransformAncestor = true; break; }
    __t = __t.parentElement;
  }
  if (hasTransformAncestor) {
    console.warn('[zeta-auto-edit] body(또는 조상)에 transform이 걸려있어 <html>에 직접 붙입니다.');
    document.documentElement.appendChild(host);
  } else {
    document.body.appendChild(host);
  }

  const shadow = host.attachShadow({ mode: 'closed' });

  const overlay = document.createElement('div');
  overlay.id = 'zeta-filter-panel';
  overlay.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);width:min(94vw,380px);max-height:88vh;overflow-y:auto;background:#ffffff;color:#111111;border:2px solid #333;border-radius:12px;padding:14px;z-index:2147483647;font-family:sans-serif;box-shadow:0 4px 24px rgba(0,0,0,0.35);box-sizing:border-box;';

  const style = document.createElement('style');
  style.textContent = `
    :host{all:initial;}
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
  shadow.appendChild(style);

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
      <button id="zw-save" style="background:#2196F3;">✅저장하고 자동감시 시작</button>
      <button id="zw-stop" style="background:#e53935;">자동감시 중지</button>
      <button id="zw-close" style="background:#999;">닫기</button>
    </div>
    <p id="zeta-status"></p>
    <hr>
    <div id="zw-list"></div>
    <p style="font-size:11px;color:#888;margin-top:6px;">
      ※ <b>가장 최근 메세지 1개만</b> 감시합니다. 새 메세지가 오면 금지어 포함 여부를 검사해서, 있으면 자동으로 <b>수정 버튼 → 텍스트 교체 → 저장 버튼</b>까지 눌러 원본 자체를 바꿉니다.<br>
      ※ 화면에 보이는 게 아니라 서버에 저장된 원본이 바뀌므로 새로고침해도 유지됩니다.<br>
      ※ 조사(은/는, 이/가, 을/를, 과/와, 로/으로, 이나/나, 이랑/랑, 이라도/라도, 이라서/라서)는 대체어의 받침 유무를 보고 자동 보정을 시도합니다(완벽하지 않을 수 있어요).<br>
      ※ 저장 버튼은 클래스명이 아니라 체크마크 아이콘 모양으로 찾기 때문에 색상/클래스가 바뀌어도 잘 안 깨집니다.<br>
      ※ 이 패널은 Shadow DOM으로 격리되어 있어 다른 북마클릿의 스타일에 영향받지 않습니다.
    </p>
  `);
  shadow.appendChild(overlay);

  let words = lw();

  function renderWords() {
    const d = shadow.querySelector('#zw-list');
    if (words.length === 0) { d.innerHTML = '<p style="font-size:12px;color:#999;">등록된 금지어가 없어요.</p>'; return; }
    d.innerHTML = words.map((w, i) => {
      const replList = (w.replacement || '').split(',').map(s => s.trim()).filter(Boolean);
      const modeLabel = w.mode === 'delete' ? '🗑삭제'
        : replList.length > 1 ? ('→ [랜덤] ' + replList.join(' / '))
        : ('→ ' + (replList[0] || '(빈칸)'));
      const wwLabel = w.wholeWord ? ' <i style="color:#2196F3;">[독립단어만]</i>' : '';
      return `<div class="word-item"><span><b>${w.banned}</b> ${modeLabel}${wwLabel}</span><button data-i="${i}" class="zw-del" style="background:#f44336;padding:4px 8px;">삭제</button></div>`;
    }).join('');
    shadow.querySelectorAll('.zw-del').forEach(b => {
      b.onclick = () => { words.splice(parseInt(b.dataset.i), 1); renderWords(); };
    });
  }
  renderWords();

  shadow.querySelector('#zw-add').onclick = () => {
    const banned = shadow.querySelector('#zw-banned').value.trim();
    const replacement = shadow.querySelector('#zw-replace').value.trim();
    const mode = shadow.querySelector('#zw-mode').value;
    const wholeWord = shadow.querySelector('#zw-wholeword').checked;
    if (!banned) { alert('금지어를 입력해주세요.'); return; }
    words.push({ banned, replacement, mode, wholeWord });
    shadow.querySelector('#zw-banned').value = '';
    shadow.querySelector('#zw-replace').value = '';
    shadow.querySelector('#zw-wholeword').checked = false;
    renderWords();
  };

  shadow.querySelector('#zw-close').onclick = () => host.remove();

  function setStatus(msg) {
    const s = shadow.querySelector('#zeta-status');
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

  // 사이트가 커스텀 Button 컴포넌트를 써서 순수 click 이벤트만으로는
  // 안 눌리는 경우가 있어, 실제 클릭처럼 이벤트를 순서대로 여러 개 발생시킴
  function robustClick(el) {
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'auto' });
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const base = { bubbles: true, cancelable: true, composed: true, view: window, clientX: cx, clientY: cy };

    // 모바일(터치) 대응: touchstart/touchend도 함께 발생시킴
    try {
      if (window.Touch && window.TouchEvent) {
        const touch = new Touch({ identifier: Date.now(), target: el, clientX: cx, clientY: cy });
        el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [touch], targetTouches: [touch], changedTouches: [touch] }));
        el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, touches: [], targetTouches: [], changedTouches: [touch] }));
      }
    } catch (e) {}

    try { el.dispatchEvent(new PointerEvent('pointerdown', { ...base, pointerId: 1, isPrimary: true })); } catch (e) {}
    el.dispatchEvent(new MouseEvent('mousedown', base));
    try { el.dispatchEvent(new PointerEvent('pointerup', { ...base, pointerId: 1, isPrimary: true })); } catch (e) {}
    el.dispatchEvent(new MouseEvent('mouseup', base));
    el.dispatchEvent(new MouseEvent('click', base));
    // 혹시 위 이벤트들도 안 먹히는 컴포넌트를 위한 최후 수단
    if (typeof el.click === 'function') el.click();
  }

  // 마크다운 이스케이프 제거: 수정창 원본 텍스트는 #, *, _ 등 특수문자 앞에
  // 백슬래시가 붙어있어 화면에 보이는 텍스트와 글자가 어긋남. 이를 제거해서
  // 감지할 때 봤던 텍스트와 최대한 같은 형태로 맞춰준다.
  function stripMarkdownEscapes(text) {
    return (text || '').replace(/\\([\\`*_{}\[\]()#+.!>~|-])/g, '$1');
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

  // ---------- 최근 메세지 컨테이너 찾기 ----------
  function findMessageContainer(editBtn) {
    // 1순위: id="message-MESSAGE-..." 형태의 안정적인 식별자를 가진 조상을 최우선으로 사용
    // (클래스명이나 글자 수보다 훨씬 안 바뀔 가능성이 높음)
    let idNode = editBtn.parentElement;
    let hops = 0;
    while (idNode && idNode !== document.body && hops < 25) {
      if (idNode.id && /^message-MESSAGE-/.test(idNode.id)) return idNode;
      idNode = idNode.parentElement;
      hops++;
    }

    // 메시지 길이가 짧을 때(20자)도, 길 때(800자+)도 안정적으로 맞도록
    // 글자 수 대신 구조(class)를 기준으로 찾는다.
    // 채팅 목록을 스크롤하는 최상위 영역은 보통 'overflow-y-auto'가 붙어있으므로,
    // 그 영역을 만나면 "바로 그 아래 자식"이 메시지 하나의 경계다.
    let node = editBtn.parentElement;
    let prevNode = node;
    let i = 0;
    while (node && node !== document.body && i < 25) {
      const cls = (typeof node.className === 'string') ? node.className : '';
      if (/overflow-y-auto/.test(cls)) {
        return prevNode;
      }
      prevNode = node;
      node = node.parentElement;
      i++;
    }

    // 혹시 overflow-y-auto를 못 만났으면(구조가 또 바뀐 경우) 예전 방식(텍스트 길이
    // 점프 감지)으로 대체 시도
    node = editBtn.parentElement;
    prevNode = node;
    let prevLen = (node.innerText || '').trim().length;
    node = node.parentElement;
    i = 0;
    while (node && node !== document.body && i < 25) {
      const len = (node.innerText || '').trim().length;
      if (prevLen > 10 && len > prevLen * 1.5 + 30) {
        return prevNode;
      }
      prevNode = node;
      prevLen = len;
      node = node.parentElement;
      i++;
    }
    return prevNode;
  }

  function getLastMessageContainer() {
    const editButtons = document.querySelectorAll('[data-testid="edit-button"]');
    if (editButtons.length === 0) return null;
    const lastBtn = editButtons[editButtons.length - 1];
    return { container: findMessageContainer(lastBtn), editBtn: lastBtn };
  }

  // ---------- 저장 버튼: 클래스명이 아니라 "체크마크 아이콘 모양"으로 찾음 ----------
  // 2026-07 기준 확인된 체크 아이콘: viewBox 0 0 16 16, stroke-width 1.3,
  // path d="M13.507 5 6.84 11.673 3 7.833" (좌표는 약간 달라질 수 있어 패턴으로 비교)
  function normalizeD(d) {
    return (d || '').replace(/\s+/g, ' ').trim();
  }

  function isCheckmarkPath(pathEl) {
    const d = normalizeD(pathEl.getAttribute('d'));
    if (!d) return false;
    const nums = d.match(/-?\d+(\.\d+)?/g);
    if (!nums || nums.length !== 6) return false; // M x y  x y  x y (좌표 3쌍)
    const [x1, y1, x2, y2, x3, y3] = nums.map(Number);
    // 체크마크 모양: 가운데 점(x2,y2)이 양 옆 점보다 아래(y값이 큼) -> V자 형태
    return y2 > y1 && y2 > y3;
  }

  function findSaveButton() {
    const buttons = document.querySelectorAll('button');
    for (const b of buttons) {
      if (b.offsetParent === null) continue; // 화면에 안 보이면 후보 아님
      const svg = b.querySelector('svg[viewBox="0 0 16 16"]');
      if (!svg) continue;
      const path = svg.querySelector('path[stroke]');
      if (!path) continue;
      if (isCheckmarkPath(path)) return b;
    }
    return null;
  }

  // ---------- 취소/닫기 버튼: 저장 버튼과 "같은 툴바"에 있는 다른 버튼으로 추정 ----------
  function findCancelButtonNear(saveBtn) {
    if (!saveBtn) return null;
    // 저장 버튼을 감싸는 가장 가까운 조상 중, 버튼이 2개 이상 모여있는 지점을 찾는다
    let el = saveBtn.parentElement;
    for (let i = 0; i < 6 && el; i++) {
      const btns = Array.from(el.querySelectorAll('button')).filter(b => b.offsetParent !== null);
      if (btns.length >= 2) {
        return btns.find(b => b !== saveBtn) || null;
      }
      el = el.parentElement;
    }
    return null;
  }

  // ---------- 감지 & 처리 (가장 최근 메세지 1개만) ----------
  const lastProcessed = new WeakMap();
  let busy = false;
  let pending = false;
  let debounceTimer = null;

  function snapshotVisibleButtons() {
    const set = new Set();
    document.querySelectorAll('button').forEach(b => {
      if (b.offsetParent !== null) set.add(b);
    });
    return set;
  }

  async function editOneMessage(container, editBtn, snapshotText) {
    busy = true;
    setStatus('금지어 발견, 자동 수정 중...');

    // 원래 화면에 이미 떠있던 textarea들(예: 하단 채팅 입력창)을 미리 기록해둠 ->
    // 나중에 "새로 나타난" textarea만 골라서 잘못된 입력창을 건드리지 않게 함
    const beforeTextareas = new Set();
    document.querySelectorAll('textarea').forEach(t => {
      if (t.offsetParent !== null) beforeTextareas.add(t);
    });

    robustClick(editBtn);

    // 정보상자(infobox)처럼 본문과 별도의 textarea가 있는 경우도 있어서,
    // 컨테이너 안의 textarea를 "전부" 찾아서 각각 검사한다.
    const textareas = await waitFor(() => {
      // 1) 가장 정확한 방법: 메시지 컨테이너 "안에서" 찾기
      const inContainer = Array.from(container.querySelectorAll('textarea')).filter(t => t.offsetParent !== null);
      if (inContainer.length > 0) return inContainer;
      // 2) 혹시 수정창이 컨테이너 밖(포탈 등)에 렌더링되는 경우 대비:
      //    원래 없었는데 새로 생긴 textarea들을 찾음 (하단 채팅 입력창은 원래부터 있었으므로 제외됨)
      const globalNew = Array.from(document.querySelectorAll('textarea')).filter(t => t.offsetParent !== null && !beforeTextareas.has(t));
      return globalNew.length > 0 ? globalNew : null;
    }, 3000, 30);

    if (!textareas) {
      setStatus('수정창을 찾지 못했어요. (UI가 바뀌었을 수 있어요)');
      busy = false;
      return;
    }

    // textarea 엘리먼트는 생겼어도 리액트가 실제 값을 채우는 데 약간
    // 시간이 걸릴 수 있어서, 값이 채워질 때까지만 짧게 기다림 (최대 800ms)
    await waitFor(() => textareas.some(t => t.value.length > 0) ? true : null, 500, 40);
    await new Promise(r => setTimeout(r, 15));

    // 수정창(textarea) 원본에는 마크다운 특수문자 앞에 백슬래시 이스케이프(\#, \*, \_ 등)가
    // 붙어있어서 화면에 보이는 텍스트랑 글자가 달라짐 -> 이스케이프를 제거한 뒤 비교/치환
    let anyChanged = false;
    for (const ta of textareas) {
      const original = stripMarkdownEscapes(ta.value);
      const { text: replacedText, changed: reallyChanged } = localReplace(original, words);
      if (reallyChanged) {
        setNativeValue(ta, replacedText);
        anyChanged = true;
        await new Promise(r => setTimeout(r, 25));
      }
    }

    if (!anyChanged) {
      console.log('[zeta-auto-edit] 못찾음. textarea 개수=' + textareas.length,
        textareas.map(t => stripMarkdownEscapes(t.value)));
      const saveBtnNow = findSaveButton();
      const cancelBtn = findCancelButtonNear(saveBtnNow);
      if (cancelBtn) robustClick(cancelBtn);
      lastProcessed.set(container, snapshotText);
      setStatus('금지어 없음. 감시 계속 중.');
      busy = false;
      return;
    }

    await new Promise(r => setTimeout(r, 40));

    const saveBtn = await waitFor(() => {
      const b = findSaveButton();
      return (b && !b.disabled) ? b : null;
    }, 4000, 150);

    if (!saveBtn) {
      setStatus('저장 버튼을 찾지 못했어요(비활성 상태일 수 있음). 수동으로 저장해주세요.');
      busy = false;
      return;
    }

    robustClick(saveBtn);
    setStatus('메세지 자동 수정 완료 ✅');
    lastProcessed.delete(container); // 저장 후 다음 검사 때 최신 화면 텍스트 기준으로 새로 비교
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
    }, 200);
  }

  let mo = null;
  let fallbackInterval = null;

  function startWatching() {
    if (mo) mo.disconnect();
    if (fallbackInterval) clearInterval(fallbackInterval);
    scheduleCheck();

    mo = new MutationObserver(() => {
      scheduleCheck();
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });

    // 다른 스크립트가 DOM을 계속 건드려서 디바운스가 영원히 리셋되는 경우를 대비해,
    // 일정 시간마다 무조건 한 번씩은 강제로 검사한다.
    fallbackInterval = setInterval(() => {
      checkLastMessage().catch(e => { console.error('[zeta-auto-edit]', e); busy = false; });
    }, 250);

    setStatus('자동감시 시작됨(최근 메세지만). 단어 ' + words.length + '개 등록됨.');
  }

  function stopWatching() {
    if (mo) mo.disconnect();
    mo = null;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = null;
    if (fallbackInterval) clearInterval(fallbackInterval);
    fallbackInterval = null;
    setStatus('자동감시 중지됨.');
  }

  shadow.querySelector('#zw-save').onclick = () => {
    sw(words);
    startWatching();
  };

  shadow.querySelector('#zw-stop').onclick = () => stopWatching();

  if (words.length > 0) {
    setStatus('저장된 단어 ' + words.length + '개 불러옴. "저장하고 자동감시 시작"을 눌러주세요.');
  }
 } catch (e) {
   console.error('[zeta-auto-edit] 초기화 중 오류:', e);
   alert('제타 필터 북마클릿 오류: ' + (e && e.message ? e.message : e) + '\n(다른 북마클릿과 충돌 가능성 - 콘솔에서 자세한 내용 확인 가능)');
 }
})();
