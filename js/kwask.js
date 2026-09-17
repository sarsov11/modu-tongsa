/* 핵심 개념어 쓰기 — **한 문항 화면**. card.html(카드 뒤)과 ox.html(개념 체크 세트 속)이 같이 쓴다.
 *
 *   설명(빈칸) → 개념어 입력 → 확신도 단추(누르면 채점) → 판정 · 정답 · 근거 한 줄 → 다음
 *
 * ★ 확신도는 **채점 전에** 받는다 — 답을 보고 고르면 편향된다(judge.js 설계와 같다).
 *   입력 → 확신도 단추가 곧 제출 단추다. 폰에서 누를 곳이 입력칸 바로 밑에 붙어 있어야 키보드에 안 가린다.
 * ★ 기록은 개념 체크와 같은 길 — `S.kw[id]` + `T.drill("kw", ok)` + `T.save()`.
 *   이해도는 문항으로만 찬다(대표님 원칙) — 개념어 쓰기는 훈련 기록이다.
 *   **반환값을 본다.** 모의고사·카드 확인 문항이 null 을 돌려받고도 몇 주를 조용히 버렸다(2026-09-05).
 * ★ 한국어 입력기 — 조합 중 Enter 는 채점하지 않는다(isComposing · keyCode 229).
 *   단추를 누르면 입력칸을 먼저 놓아 마지막 글자 조합을 끝낸 뒤 값을 읽는다.
 * ★ 문제를 푸는 동안에는 리프 이름을 띄우지 않는다 — 「시민 불복종의 정당화 조건」 머리가 답을 알려 준다.
 */
(function () {
  "use strict";
  var G = window.KWGRADE;

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* 빈칸 표시 ［　？　］ → 칸 모양 */
  function 설명그리기(x) {
    var n = Math.max(2, Math.min(9, x.n || 3));
    return esc(x.d).replace(/［[\s　]*？[\s　]*］/g,
      '<span class="kwblank" style="min-width:' + (n * 1.05 + 0.6).toFixed(1) + 'em" aria-label="빈칸">？</span>');
  }

  /* ── 기록 ── */
  function 기록(T, x, 입력, conf, ms, ok) {
    var S = T.state();
    if (!S.kw) S.kw = {};
    var 앞 = S.kw[x.id];
    var 시도 = (앞 && 앞.n ? 앞.n : 0) + 1;
    var v = String(입력 == null ? "" : 입력).slice(0, 40);
    S.kw[x.id] = { ok: ok, c: conf || null, ms: ms || null, n: 시도, at: Date.now(), v: v,
                   v0: 앞 ? (앞.v0 != null ? 앞.v0 : 앞.v) : v, leaf: x.leaf };
    T.drill && T.drill("kw", ok);
    T.save && T.save();
    return S.kw[x.id];
  }

  /* ── 고르기 ─────────────────────────────────────
     한 리프에서 몇 개 — 안 푼 것, 틀렸던 것 먼저, 방금 읽은 카드에 정답 낱말이 있으면 앞으로.
     같은 날 같은 순서(날짜 씨앗)라 새로고침해도 문항이 바뀌지 않는다. */
  function 씨(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 10000) / 10000;
  }
  function 오늘() {
    var d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
  function 점수(T, x, 글) {
    var r = ((T.state().kw) || {})[x.id];
    var s = r ? (r.ok ? -1 : 0.8) : 0.4;
    if (r && r.at && Date.now() - r.at < 10 * 60000) s -= 3;      // 방금 푼 것은 다시 안 낸다
    if (글 && G.norm(글).indexOf(G.norm(x.a)) >= 0) s += 0.5;       // 방금 읽은 카드에 있던 낱말
    return s + 씨(x.id + 오늘()) * 0.3;
  }
  function 리프에서(T, leaf, 몇, 글) {
    var K = window.KEYWORD;
    if (!K || !K.byLeaf || !K.byLeaf[leaf]) return [];
    var 목록 = K.byLeaf[leaf].map(function (id) { return 찾기(id); }).filter(Boolean);
    목록.sort(function (a, b) { return 점수(T, b, 글) - 점수(T, a, 글); });
    return 목록.filter(function (x) { return 점수(T, x, 글) > -2; }).slice(0, 몇);
  }
  /* 시험 범위 안에서 몇 개 — 약한 리프 먼저. 사상가(K)는 배우는 단원(sroot)으로 본다 */
  function 범위에서(T, 몇, 뺄) {
    var K = window.KEYWORD;
    if (!K || !K.items) return [];
    뺄 = 뺄 || {};
    var 후보 = K.items.filter(function (x) {
      if (뺄[x.id]) return false;
      if (T.scopeOn && T.scopeOn() && T.inScope && !(T.inScopeItem ? T.inScopeItem(x) : T.inScope(x.sroot || x.root))) return false;
      return true;
    });
    function 약점(x) {
      var st = T.leafStat ? T.leafStat(x.leaf) : null;
      return (st && st.solved) ? (1 - st.correct / st.solved) * 0.6 : 0.3;
    }
    후보.sort(function (a, b) { return (점수(T, b) + 약점(b)) - (점수(T, a) + 약점(a)); });
    var 나 = [], 리프 = {};
    for (var i = 0; i < 후보.length && 나.length < 몇; i++) {
      if (리프[후보[i].leaf] || 점수(T, 후보[i]) <= -2) continue;   // 한 세트에 한 리프 하나
      리프[후보[i].leaf] = 1;
      나.push(후보[i]);
    }
    return 나;
  }
  var 색인 = null;
  function 찾기(id) {
    if (!색인) {
      색인 = {};
      ((window.KEYWORD || {}).items || []).forEach(function (x) { 색인[x.id] = x; });
    }
    return 색인[id] || null;
  }

  /* ── 한 문항 그리기 ──────────────────────────────
     host 안을 **통째로 바꾼다** — 카드가 같은 화면에 남아 있으면 카드 문장이 답을 알려 준다.
     opt = { idx, total, next:"다음 →", onDone(res), onNext(res) } */
  function render(host, x, opt) {
    opt = opt || {};
    var T = window.TERRA, J = window.JUDGE;
    var 확신단계 = (J && J.확신단계) || [{ v: "sure", name: "확실해요" }, { v: "half", name: "반반" }, { v: "guess", name: "찍었어요" }];
    var 시작 = Date.now(), 끝남 = false, 조합중 = false;

    host.innerHTML =
      '<div class="kwq" id="kwq">' +
        '<div class="kwtag"><b>핵심 개념어 쓰기</b>' +
          (opt.total ? '<span>· ' + (opt.idx || 1) + ' / ' + opt.total + '</span>' : '') +
          '<span class="kwsrc">' + esc(x.how === "개념 카드" ? "개념 문장" : "교과서") + '</span></div>' +
        '<p class="kwd">' + 설명그리기(x) + '</p>' +
        '<p class="kwhint">빈칸에 들어갈 개념어를 쓰세요, ' + (x.n || "") + '글자, 띄어쓰기는 안 봐요</p>' +
        '<div class="kwbox" id="kwbox">' +
          '<input class="kwin" id="kwin" type="text" inputmode="text" autocomplete="off" autocorrect="off" ' +
            'autocapitalize="off" spellcheck="false" enterkeyhint="done" maxlength="40" ' +
            'aria-label="개념어 입력" placeholder="개념어 입력">' +
          '<p class="kwlab" id="kwlab">얼마나 확신하나요? 누르면 채점해요</p>' +
          '<div class="kwconf" id="kwconf">' +
            확신단계.map(function (c) {
              return '<button type="button" data-c="' + c.v + '">' + esc(c.name) + '</button>';
            }).join("") +
          '</div>' +
          '<button type="button" class="kwskip" id="kwskip">모르겠어요 — 정답 보기</button>' +
        '</div>' +
      '</div>';

    document.body.classList.add("kw-open");
    var inp = host.querySelector("#kwin"), lab = host.querySelector("#kwlab");
    var box = host.querySelector("#kwbox");

    inp.addEventListener("compositionstart", function () { 조합중 = true; });
    inp.addEventListener("compositionend", function () { 조합중 = false; });
    inp.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      if (e.isComposing || 조합중 || e.keyCode === 229) return;     // 조합 중 Enter — 글자 확정일 뿐
      e.preventDefault();
      if (!inp.value.trim()) return;
      lab.textContent = "확신도를 누르면 채점해요";
      lab.classList.remove("pulse"); void lab.offsetWidth; lab.classList.add("pulse");
    });
    /* 폰 키보드 — 입력칸을 누르면 아래 고정 띠·탭을 치우고, 입력칸+단추를 보이는 곳으로 올린다 */
    function 보이게() {
      try { box.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) { box.scrollIntoView(); }
    }
    var 치움 = null;
    inp.addEventListener("focus", function () {
      clearTimeout(치움);
      document.body.classList.add("kwtyping");
      setTimeout(보이게, 280);
    });
    inp.addEventListener("blur", function () {
      clearTimeout(치움);
      치움 = setTimeout(function () { document.body.classList.remove("kwtyping"); }, 400);
    });
    if (window.visualViewport) {
      var vv = function () { if (document.activeElement === inp) 보이게(); };
      window.visualViewport.addEventListener("resize", vv);
    }

    function 내기(conf) {
      if (끝남) return;
      /* 마지막 글자 조합을 끝낸다 — 입력칸을 놓으면 입력기가 글자를 확정한다 */
      if (document.activeElement === inp) inp.blur();
      setTimeout(function () { 채점(conf); }, 30);
    }
    host.querySelectorAll("#kwconf button").forEach(function (b) {
      /* 누르는 순간 처리한다 — 키보드가 내려가며 단추가 움직여 click 이 빗나가는 것을 막는다 */
      b.addEventListener("pointerdown", function (e) {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        e.preventDefault(); 내기(b.dataset.c);
      });
      b.addEventListener("click", function () { 내기(b.dataset.c); });
    });
    host.querySelector("#kwskip").addEventListener("click", function () { inp.value = ""; 내기("guess"); });

    function 채점(conf) {
      if (끝남) return;
      var 입력 = inp.value;
      if (!입력.trim() && conf !== "guess") {
        lab.textContent = "개념어를 먼저 쓰거나, 모르면 아래 단추를 누르세요";
        lab.classList.remove("pulse"); void lab.offsetWidth; lab.classList.add("pulse");
        inp.focus();
        return;
      }
      끝남 = true;
      var ms = Date.now() - 시작;
      var g = G.check(x, 입력);
      var rec = 기록(T, x, 입력, conf, ms, g.ok);
      inp.disabled = true;
      host.querySelectorAll("#kwconf button, #kwskip").forEach(function (b) {
        b.disabled = true; if (b.dataset.c === conf) b.classList.add("pick");
      });
      document.body.classList.remove("kw-open");
      document.body.classList.remove("kwtyping");

      var st = T.leafStat ? T.leafStat(x.leaf) : null;
      var v = J ? J.판정({
        ok: g.ok, conf: conf, ms: ms, attempt: rec ? rec.n : 1, qid: x.id,
        /* 멘트의 {개념} 자리는 **정답 낱말**로 — 리프 이름(「해결 방안 — 복지·적극적 우대·지역 정책」)을 넣으니
           「…정책이 확실해질 때까지」 처럼 길고 어색했다(화면 실측 2026-09-13). 채점 뒤라 답을 말해도 된다. */
        leafName: String(x.a || x.leafName || "").replace(/\s*\([^)]*\)/g, ""),
        mastery: (st && st.solved) ? (st.correct / st.solved) : null,
        streak: T.연속오답 ? T.연속오답(x.leaf) : 0
      }) : { kind: g.ok ? "정답" : "오답", say: "", tone: g.ok ? "good" : "bad", next: "forward" };

      var 원문 = esc(x.why).replace(new RegExp(esc(x.a).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*"), "g"),
        function (m) { return "<mark>" + m + "</mark>"; });
      var 덧말 = "";
      var 띄어씀 = String(x.a).indexOf(" ") >= 0 && 입력.indexOf(String(x.a)) < 0;
      if (g.ok && (g.how === "띄어쓰기" || (g.how === "조사" && 띄어씀))) 덧말 = "교과서에서는 「" + esc(x.a) + "」처럼 띄어 써요.";
      else if (g.ok && g.how === "허용 변형") 덧말 = "교과서 표기는 「" + esc(x.a) + "」예요.";
      else if (!g.ok && g.near) 덧말 = "한 글자 차이예요.";
      else if (!g.ok && g.empty) 덧말 = "정답을 보고 가면 다음에 쓸 수 있어요.";

      var 판정칸 = document.createElement("div");
      판정칸.className = "verdict kwv " + v.tone;
      판정칸.innerHTML =
        '<div class="top"><span class="mark">' + (g.ok ? "○ 맞았어요" : "✕ 아니에요") + '</span>' +
          '<span class="kind">' + esc(v.kind) + '</span></div>' +
        (v.say ? '<p class="say">' + esc(v.say) + '</p>' : '') +
        '<p class="kwans"><span>정답</span><b>' + esc(x.a) + '</b>' +
          (x.alt && x.alt.length ? '<em>' + esc(x.alt.join(", ")) + '도 맞아요</em>' : '') + '</p>' +
        (!g.ok && 입력.trim() ? '<p class="kwmine">쓴 답 — ' + esc(입력.trim()) + '</p>' : '') +
        (덧말 ? '<p class="kwnote">' + 덧말 + '</p>' : '') +
        '<div class="why"><b>근거</b> — ' + 원문 + '<span class="src">' + esc(x.src) + '</span></div>' +
        '<div class="kwnext"><button type="button" class="kwgo" id="kwgo">' + esc(opt.next || "다음 →") + '</button></div>';
      host.querySelector("#kwq").appendChild(판정칸);
      var 결과 = { ok: g.ok, how: g.how, kind: v.kind, next: v.next, conf: conf, ms: ms, leaf: x.leaf,
                  id: x.id, rec: rec, verdict: v };
      if (!rec) {         // ★ 기록이 안 남았으면 조용히 넘기지 않는다
        판정칸.insertAdjacentHTML("beforeend", '<p class="kwnote">이 답은 기록에 안 남았어요. 새로고침 뒤 다시 풀어 주세요.</p>');
      }
      var go = host.querySelector("#kwgo");
      go.addEventListener("click", function () { opt.onNext && opt.onNext(결과); });
      try { 판정칸.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) { }
      setTimeout(function () { try { go.focus({ preventScroll: true }); } catch (e) { } }, 350);
      opt.onDone && opt.onDone(결과);
    }
    return { input: inp, submit: 내기 };
  }

  window.KWASK = { render: render, 리프에서: 리프에서, 범위에서: 범위에서, 찾기: 찾기, 기록: 기록 };
})();
