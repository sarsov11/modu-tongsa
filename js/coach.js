/* 모두의 통사 — 선생님 층 (js/coach.js) · 테라러닝
 *
 * 왜 있는가 — 사이트가 자료는 다 있는데 **가만히 있으면 아무 말도 안 했다.**
 *   오늘 할 것은 홈에만 있고, 문제를 맞혀도 화면은 "정답" 한 글자였고,
 *   이해도가 올라도 개념트리를 다시 열어 봐야 알았다. 학생 눈에는 죽은 사이트다.
 *   (2026-09-05 대표님: "과외선생님처럼 오늘 할 공부를 제시해주고 응원해주고,
 *    개념트리 변화를 보여주고 맞은 정답수를 보여주고 … 가만히 있어도 제시")
 *
 * 무엇을 하는가 — 화면마다 따라다니는 층 하나.
 *   ① 선생님 띠(bar)   — 모든 화면 아래에 붙어 지금 할 것 하나 + 오늘 수치 + 한마디
 *   ② 결산(wrap)       — 한 세트가 끝나면 짠 하고 뜬다. 맞은 수·이해도 변화·오늘 누적
 *   ③ 오늘 변화(delta)  — 하루 시작 때 이해도를 찍어 두고, 그 뒤 오른 곳을 셈
 *   ④ 오늘의 개념 카드   — 눌러야 열린다. 하루 한 장, 열면 모인다
 *   ⑤ 살아 있는 반응     — 답할 때마다 띠가 바로 바뀐다(연속 정답·오늘 몇 번째)
 *
 * 말투 — 존댓말. 판단·훈계 없음. "제가 ~해 드릴게요" 같은 말 없음. 느낌표 남발 없음.
 *   화면에 나가는 문장은 전부 이 파일의 MSG 안에 있다 — 선생님층_검산.py 가 이걸 본다.
 *
 * 저장 — localStorage
 *   terra.snap   { d, u:{리프:이해도}, a:{리프:성취도} }  하루 첫 방문 때의 값
 *   terra.cards  { "2026-09-05": {leaf, i, at} }         열어 본 개념 카드
 *   terra.coach  { visits, skinNudged, hideUntil }        띠 상태
 */
(function () {
  "use strict";
  if (!window.TERRA) return;
  var T = window.TERRA;

  /* ── 작은 도구 ─────────────────────────────────── */
  function esc(s) { return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function bat(w) { w = String(w || ""); var c = w.charCodeAt(w.length - 1);
    return (c >= 0xAC00 && c <= 0xD7A3) ? ((c - 0xAC00) % 28) !== 0 : /[013678lmnr]$/i.test(w); }
  function 은는(w) { return w + (bat(w) ? "은" : "는"); }
  function 이가(w) { return w + (bat(w) ? "이" : "가"); }
  function 을를(w) { return w + (bat(w) ? "을" : "를"); }
  function ls(k, v) {
    try {
      if (arguments.length === 1) { var r = localStorage.getItem(k); return r ? JSON.parse(r) : null; }
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) { return null; }
  }
  function here() { return (location.pathname.split("/").pop() || "index.html"); }
  function leafName(code) { var l = T.BY[code]; return l ? l.name : code; }
  function midOf(code) { var l = T.BY[code]; return l && l.mid ? l.mid : null; }

  /* ── 화면에 나가는 말 — 전부 여기 ─────────────────── */
  var MSG = {
    /* 띠 — 상황별. {n} 숫자, {개념} 리프 이름 자리 */
    idleStart:    "오늘 {goal}분",
    idleMid:      "{spent}분 완료 → {left}분 남음",
    idleDone:     "오늘 목표 완료",
    upToday:      "오늘 이해도 상승 {n}곳",
    streakDay:    "{n}일 연속",
    cardWait:     "개념 보기",
    okOne:        "정답. 오늘 {n}개째",
    okRun3:       "3문제 연속 정답",
    okRun5:       "5문제 연속 정답",
    okRun8:       "8문제 연속 정답",
    okAfterMiss:  "정답. 앞 오답은 3일 뒤 복습",
    missOne:      "오답 → 3일 뒤 복습",
    missSure:     "다시 확인",
    missGuess:    "해설 확인",
    missRun3:     "3문제 연속 틀림 → 개념 다시",
    drillOk:      "정답. 오늘 킬러 훈련 {n}문제째",
    drillMiss:    "한 번 더 (킬러 훈련은 정답률 제외)",
    oxOk:         "정답. 오늘 O·X {n}문제째",
    oxMiss:       "근거 확인 (O·X는 정답률 제외)",
    kwOk:         "정답",
    kwMiss:       "정답 확인 (개념어 쓰기는 정답률 제외)",
    watched:      "강의 완료 → O·X 확인",
    skinNudge:    "화면 색 바꾸기",
    examSoon:     "{시험} D-{n} → 모의고사 강추",
    /* 결산 */
    wrapAll:      "전부 정답",
    wrapMost:     "거의 다 맞음 → 오답 모아풀기",
    wrapHalf:     "절반 맞음 → 오답 모아풀기",
    wrapLow:      "오답 모아풀기",
    wrapUp:       "{개념} 이해도 {before} → {after}",
    wrapSame:     "{개념} 이해도 {after} 유지",
    wrapDown:     "{개념} 이해도 {before} → {after}",
    wrapDone:     "오늘 목표 완료",
    flowNext:     "다음: {title} ({min}분)",
    flowStart:    "시작: {title} ({min}분)",
    flowMore:     "더 하기",
    flowAllDone:  "오늘 목표 완료",
    flowStrip:    "오늘 {goal}분, {left}분 남음",
    flowStripDone:"오늘 목표 완료",
    wrapLeft:     "{left}분 남음",
    wrapFirst:    "오늘 첫 세트",
    wrapTree:     "개념트리 {개념} {d}",
    /* 인사 */
    hiFirst:      "오늘 할 것 하나",
    /* ★★ 2026-09-29 판정소 5차 — 「직전 결과 → 추천」을 한 줄에 다 적지 않는다.
         화면엔 단원명 + 강추 배지만. 직전 결과는 title(마우스 오버·탭)로 뺀다(greetWhy). */
    hiBack:       "{next} 강추",
    hiBackLead:   "{ago} {n}문항 중 {ok}개 맞힘 → 오늘은 {lead}",
    hiBackNoQLead: "오늘은 {lead}.",
    hiTodayLead:  "오늘 {n}문항 중 {ok}개 맞힘 → 이어서 {lead}",
    hiBackNoQ:    "{next} 강추",
    hiToday:      "오늘 {n}문항 중 {ok}개 맞힘 → {next}",
    hiTodayDone:  "오늘 {n}문항 중 {ok}개 맞힘 → 오늘 목표 완료",
    hiStreak:     "{n}일째",
    /* 카드 */
    cardSealed:   "오늘 개념",
    cardTap:      "눌러서 열기",
    cardOpened:   "문제로 확인",
    cardCount:    "읽은 개념 {n}개",
    cardNone:     "이 범위는 개념 없음 → 바로 문제"
  };
  function fmt(key, v) {
    var s = MSG[key] || "";
    v = v || {};
    return s.replace(/\{(개념은|개념이|개념을|개념)\}/g, function (_, k) {
      var w = v.개념 || "";
      if (!w) return "";
      return k === "개념은" ? 은는(w) : k === "개념이" ? 이가(w) : k === "개념을" ? 을를(w) : w;
    }).replace(/\{([^{}]+)\}/g, function (_, k) { return v[k] == null ? "" : v[k]; })  /* ★ \w 는 ASCII 만 본다 — {시험} 같은 한글 자리가 안 채워져 그대로 찍혔다 (2026-09-11) */
      .replace(/^\s+/, "");
  }

  /* ── 하루 시작 스냅샷 — 오늘 오른 곳을 세는 기준 ─────── */
  var SNAP_KEY = "terra.snap";
  function takeSnap() {
    var u = {}, a = {};
    T.LEAVES.forEach(function (l) {
      if (!l.play || !l.play.length) return;
      u[l.code] = T.이해도(l.code);
      a[l.code] = T.leafStat(l.code).achieve;
    });
    var s = { d: T.dayKey(), u: u, a: a };
    ls(SNAP_KEY, s);
    return s;
  }
  function snap() {
    var s = ls(SNAP_KEY);
    if (!s || s.d !== T.dayKey()) s = takeSnap();
    return s;
  }
  /* 오늘 변한 리프 — 오른 순 */
  function todayDelta() {
    var s = snap(), out = [];
    T.LEAVES.forEach(function (l) {
      if (!l.play || !l.play.length) return;
      var now = T.이해도(l.code), was = s.u[l.code] == null ? now : s.u[l.code];
      var ac = T.leafStat(l.code).achieve, wa = s.a[l.code] == null ? ac : s.a[l.code];
      if (now !== was || ac !== wa)
        out.push({ code: l.code, name: l.name, before: was, after: now, d: now - was,
                   aBefore: wa, aAfter: ac, mid: l.mid ? l.mid.name : "", midCode: l.mid ? l.mid.code : "" });
    });
    out.sort(function (a, b) { return b.d - a.d; });
    return { list: out, up: out.filter(function (x) { return x.d > 0; }).length };
  }
  /* 중영역 단위로 묶은 오늘 변화 — 개념트리가 쓴다 */
  function midDelta() {
    var d = todayDelta().list, by = {};
    d.forEach(function (x) {
      if (!x.midCode) return;
      var m = by[x.midCode] || (by[x.midCode] = { code: x.midCode, name: x.mid, d: 0, n: 0 });
      m.d += x.d; m.n++;
    });
    return by;
  }

  /* ── 오늘 수치 — 어디서든 같은 숫자 ─────────────────── */
  function tally() {
    var r = T.report(), R = T.routine();
    /* ★ ans·ok = 문제풀이 + 훈련(킬러 훈련·O·X·개념어)을 한데 센 오늘 총합 — 홈·결산·띠가 같은 숫자를 쓴다(2026-10-04).
       q·qok 는 문제풀이만(정답률 기준). */
    return { ans: r.solved, ok: r.solvedOk, q: r.answers, qok: r.correct, pct: r.pct, drills: r.drills, drillOk: r.drillOk,
             spent: R.spent, goal: R.goal, left: Math.max(0, R.goal - R.spent),
             done: R.done, streak: r.streak, up: todayDelta().up, items: R.items };
  }
  /* 지난 방문 — 오늘 전에 마지막으로 기록이 있던 날 */
  function lastVisit() {
    var S = T.state(), today = T.dayKey(), days = {};
    (S.ev || []).forEach(function (e) { if (e.d && e.d < today) days[e.d] = 1; });
    var ks = Object.keys(days).sort();
    if (!ks.length) return null;
    var k = ks[ks.length - 1], r = T.report(k);
    var diff = Math.round((new Date(today + "T12:00:00") - new Date(k + "T12:00:00")) / 86400000);
    return { d: k, ago: diff === 1 ? "어제" : diff < 8 ? diff + "일 전에" : k.slice(5).replace("-", "월 ") + "일에",
             n: r.answers, ok: r.correct };
  }
  /* 지금 할 것 하나 — 루틴에서 아직 안 끝난 첫 항목.
     ★ 끝낸 것은 시간이 아니라 **항목 종류 표시**(T.flowDone)로 가른다(2026-10-04) — 빨리 끝낸 항목이 또 「다음」으로 나왔다.
     다 끝났으면 null. */
  function nextStep(skipHere) {
    var R = T.routine(), h = here(), qs = location.search, mk = T.flowDone ? T.flowDone() : {};
    for (var i = 0; i < R.items.length; i++) {
      var it = R.items[i];
      if (mk[it.kind]) continue;                              // 끝낸 항목
      if (skipHere && it.href === h + qs) continue;            // 지금 보고 있는 그것
      if (skipHere && h === "drill.html" && it.kind === "drill") continue;
      if (skipHere && h === "skilltree.html" && it.kind === "lec") continue;
      return it;
    }
    return null;
  }
  /* 오늘 항목을 다 했는가 — 시간이 찼거나, 항목을 다 끝냈거나 */
  function flowAllDone() { var R = T.routine(); return R.done || !nextStep(false); }

  /* 큰 「다음」 단추 한 개 — 모든 끝 화면이 맨 위에 쓴다.
     o.next = {href,title,min} 를 주면 그것을(카드 뒤 기출처럼 그 단원에 붙은 다음), 없으면 루틴의 다음 항목.
     오늘 몫이 끝났으면 「오늘 목표 완료」 + 작은 「더 하기」 만 낸다. 자동 이동은 없다. */
  function nextBlock(o) {
    o = o || {};
    var step = o.next || nextStep(true), done = flowAllDone();
    if (done || !step) {
      var more = o.next || nextStep(false);
      return '<div class="flownext done"><b class="fl">' + esc(fmt("flowAllDone")) + '</b>' +
        '<a class="btn ghost" href="' + (more ? more.href : "study.html") + '">' + esc(fmt("flowMore")) + '</a></div>';
    }
    return '<div class="flownext"><a class="btn flowgo" data-flowgo="1" href="' + step.href + '">' +
      esc(fmt("flowNext", { title: step.title, min: step.min })) + ' →</a></div>';
  }

  /* 홈의 큰 단추 — 오늘 아직 아무것도 안 했으면 「시작: ○○ (n분)」, 했으면 「다음: ○○ (n분)」. 끝났으면 null */
  function startLabel(step) {
    var started = T.report().solved > 0 || Object.keys(T.flowDone ? T.flowDone() : {}).length > 0;
    return fmt(started ? "flowNext" : "flowStart", { title: step.title, min: step.min });
  }

  /* 이 끝 화면이 오늘 루틴의 어느 항목을 채웠는가 — 표시를 남긴다 */
  function flowKinds(opts) {
    var h = here(), P = new URLSearchParams(location.search), k = (opts && opts.kind) || "";
    if (h === "study.html") return P.get("mode") === "wrong" ? ["due"] : ["q"];
    if (h === "ox.html") return ["ox"];
    if (h === "card.html") return ["card"];
    if (h === "drill.html" || h === "naeshin.html") return ["drill"];
    if (h === "exam.html") return ["exam", "exwrong"];
    return k === "ox" ? ["ox"] : k === "card" ? ["card"] : k === "drill" ? ["drill"] : [];
  }

  /* ── 인사 한 줄 — 홈 머리에 쓴다 ────────────────────── */
  function greeting() {
    var t = tally(), step = nextStep(false), nx = step ? step.title : "오늘 할 것";
    /* 할 일에 문장꼴(lead)이 있으면 그걸 쓴다 — 「틀린 문제 다시 풀기부터예요」 는 어색하다 (2026-09-13) */
    var ld = step && step.lead;
    var out = [];
    if (t.ans) out.push(fmt(t.done ? "hiTodayDone" : (ld ? "hiTodayLead" : "hiToday"), { n: t.ans, ok: t.ok, next: nx, lead: ld }));
    else {
      var lv = lastVisit();
      if (!lv) out.push(fmt("hiFirst"));
      else if (lv.n) out.push(fmt(ld ? "hiBackLead" : "hiBack", { ago: lv.ago, n: lv.n, ok: lv.ok, next: nx, lead: ld }));
      else out.push(fmt(ld ? "hiBackNoQLead" : "hiBackNoQ", { ago: lv.ago, next: nx, lead: ld }));
    }
    /* 연속일은 머리띠에, 오른 곳은 바로 밑 칸에 있다 — 여기서 또 말하면 네 문장이 된다 */
    return out.join(" ");
  }

  /* ★ greeting() 에서 뺀 「직전 결과」 — 단원 추천 옆 title(마우스 오버·탭)로 붙인다 */
  function greetWhy() {
    var t = tally();
    if (t.ans) return "";
    var lv = lastVisit();
    return (lv && lv.n) ? (lv.ago + " " + lv.n + "문제 중 " + lv.ok + "개 맞힘") : "";
  }

  /* ── 띠 ─────────────────────────────────────────── */
  var 연속정답 = 0, 연속오답 = 0, 오늘정답수 = 0, bar = null, holdTimer = null;
  var COACH_KEY = "terra.coach";
  function coachState() { return ls(COACH_KEY) || { visits: 0, skinNudged: 0 }; }
  function setCoach(p) { var c = coachState(); for (var k in p) c[k] = p[k]; ls(COACH_KEY, c); return c; }

  function idleLine() {
    var t = tally(), X = T.examMode ? T.examMode() : null;
    if (X && X.mode === "real" && X.exam && !t.done)
      return { b: fmt("examSoon", { 시험: X.exam.name, n: X.days }), s: fmt("idleMid", { spent: t.spent, left: t.left }) };
    var b = t.done ? fmt("idleDone") : t.spent ? fmt("idleMid", { spent: t.spent, left: t.left })
                   : fmt("idleStart", { goal: t.goal });
    var s = [];
    if (t.up) s.push(fmt("upToday", { n: t.up }));
    if (t.streak >= 2) s.push(fmt("streakDay", { n: t.streak }));
    if (!cardOpenedToday() && here() === "index.html" && cardToday()) s.push(fmt("cardWait"));
    return { b: b, s: s.join(" ") };
  }

  function chips(t) {
    return '<span class="chips">' +
      '<span class="chip"><b>' + t.ok + '</b>문제 맞힘</span>' +   /* 「오늘」 까지 붙이면 띠 문장이 다 잘린다 */
      '<span class="chip hide-sm"><b>' + t.ans + '</b>풂</span>' +
      '<span class="chip hide-sm"><b>' + t.spent + '</b>/' + t.goal + '분</span>' +
      (t.up ? '<span class="chip up hide-sm"><b>+' + t.up + '</b>오른 곳</span>' : '') +
      '</span>';
  }

  /* 화면 결 넷 — store 의 skinPick 은 밖으로 안 나와 있어 여기서 그린다(SKINS 는 나와 있다) */
  function skinPick() {
    var now = T.skin ? T.skin() : "";
    return '<div class="skinpick" role="group" aria-label="화면 결">' + (T.SKINS || []).map(function (k) {
      return '<button type="button" data-skinbtn="' + k.id + '" aria-pressed="' + (k.id === now) + '">' +
        '<i style="background:' + k.dot + '"></i><span>' + esc(k.name) + '</span></button>';
    }).join("") + '</div>';
  }
  function paint(line, opts) {
    if (!bar) return;
    opts = opts || {};
    var t = tally(), step = nextStep(true);
    var C = 2 * Math.PI * 16, on = (C * Math.min(1, t.goal ? t.spent / t.goal : 0)).toFixed(1);
    bar.innerHTML =
      '<div class="in">' +
      '<span class="ring"><svg width="40" height="40" viewBox="0 0 40 40">' +
      '<circle cx="20" cy="20" r="16" fill="none" stroke="var(--line-2)" stroke-width="3.5"/>' +
      '<circle cx="20" cy="20" r="16" fill="none" stroke="' + (t.done ? "var(--mint)" : "var(--red)") +
      '" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="' + on + ' ' + (C - on).toFixed(1) + '"/></svg>' +
      '<b>' + t.spent + '</b></span>' +
      '<span class="tx' + (opts.tone ? " " + opts.tone : "") + '"><b>' + esc(line.b).replace(/ 강추$/, ' <i class=\"gc\">강추</i>') + '</b>' +
      (line.s ? '<span>' + esc(line.s) + '</span>' : '') + '</span>' +
      chips(t) +
      '<span class="go">' +
      (opts.html ? opts.html : (step && !t.done ? '<a class="btn" href="' + step.href + '">' +
        esc(step.cta || "하기") + (step.kind === "card" ? '' : ' ' + step.min + '분') + '</a>' : '')) +
      '<button class="x" aria-label="닫기">✕</button></span></div>';
    bar.querySelector(".x").onclick = function () {
      bar.classList.remove("on");
      document.body.classList.remove("hasnext");
      try { sessionStorage.setItem("terra.nexthide", "1"); } catch (e) {}
    };
    bar.querySelectorAll("[data-skinbtn]").forEach(function (b) {
      b.onclick = function () { T.setSkin(b.dataset.skinbtn); };
    });
  }
  /* 한마디를 잠깐 보였다가 평소 말로 돌아간다 */
  function say(b, s, tone, ms) {
    if (!bar) return;
    clearTimeout(holdTimer);
    paint({ b: b, s: s || "" }, { tone: tone });
    bar.classList.add("pop"); setTimeout(function () { bar && bar.classList.remove("pop"); }, 420);
    holdTimer = setTimeout(function () { paint(idleLine()); }, ms || 6000);
  }

  /* ── 진행 띠 — 루틴 화면(문제·개념·O·X·훈련·모의고사) 맨 위에 얇게 (2026-10-04 15분 흐름).
     다음 항목으로 넘어가도 막대와 남은 분이 이어져 보인다. 아래 띠를 없앤 뒤(0919) 화면 안에 진행이 안 보였다. */
  var STRIP_PAGES = ["study.html", "card.html", "ox.html", "drill.html", "naeshin.html", "exam.html"];
  function mountStrip() {
    if (STRIP_PAGES.indexOf(here()) < 0 || document.querySelector(".flowstrip")) return;
    var nav = document.querySelector(".nav"); if (!nav) return;
    var R = T.routine(), mk = T.flowDone ? T.flowDone() : {}, nx = nextStep(false), segs = "";
    R.items.forEach(function (it) {
      var cls = mk[it.kind] ? "done" : (nx && nx.kind === it.kind ? "next" : "");
      segs += '<span class="seg ' + cls + '" style="flex:' + Math.max(1, it.min) + ' 1 0"></span>';
    });
    var el = document.createElement("div");
    el.className = "flowstrip";
    el.setAttribute("aria-label", "오늘 " + R.goal + "분 진행");
    el.innerHTML = '<div class="in"><span class="bars">' + segs + '</span><span class="tx">' +
      esc(flowAllDone() ? fmt("flowStripDone") : fmt("flowStrip", { goal: R.goal, left: Math.max(0, R.goal - R.spent) })) + '</span></div>';
    nav.insertAdjacentElement("afterend", el);
  }

  function mount(active) {
    mountStrip();
    var c = setCoach({ visits: (coachState().visits || 0) + 1 });
    snap();                                                    // 오늘 기준을 찍어 둔다
    오늘정답수 = T.report().correct;
    var hide = false;
    try { hide = sessionStorage.getItem("terra.nexthide") === "1"; } catch (e) {}
    if (hide) return;
    bar = document.createElement("div");
    bar.className = "nextbar coach";
    bar.setAttribute("role", "status");
    bar.setAttribute("aria-live", "polite");
    document.body.appendChild(bar);
    document.body.classList.add("hasnext");
    /* 세 번째 방문에 한 번 — 화면 결 넷을 알려 준다. 그 뒤로는 안 한다 */
    if (c.visits >= 3 && !c.skinNudged && here() !== "settings.html") {
      setCoach({ skinNudged: 1 });
      paint({ b: fmt("skinNudge"), s: "" }, { html: skinPick() });
      holdTimer = setTimeout(function () { paint(idleLine()); }, 14000);
    } else paint(idleLine());
    requestAnimationFrame(function () { bar.classList.add("on"); });
  }

  /* ── 살아 있는 반응 — 저장소가 쏘는 사건을 받는다 ─────── */
  window.addEventListener("terra:ev", function (ev) {
    var e = ev.detail || {};
    if (!bar) return;
    if (e.k === "a") {
      var 개념 = leafName(e.leaf);
      if (e.ok) {
        오늘정답수 = T.report().correct; 연속정답++; var 뒤 = 연속오답; 연속오답 = 0;
        if (연속정답 >= 8) say(fmt("okRun8"), "", "good");
        else if (연속정답 >= 5) say(fmt("okRun5", { 개념: 개념 }), "", "good");
        else if (연속정답 >= 3) say(fmt("okRun3"), "", "good");
        else if (뒤) say(fmt("okAfterMiss"), "", "good");
        else say(fmt("okOne", { n: 오늘정답수 }), "", "good");
      } else {
        연속정답 = 0; 연속오답++;
        if (연속오답 >= 3) say(fmt("missRun3"), "", "warn", 8000);
        else if (e.c === "sure") say(fmt("missSure", { 개념: 개념 }), "", "warn", 8000);
        else if (e.c === "guess") say(fmt("missGuess"), "", "");
        else say(fmt("missOne"), "", "");
      }
    } else if (e.k === "x") {
      var isKw = e.t === "kw";                       // 핵심 개념어 쓰기 (2026-09-13)
      var isOx = e.t === "ox" || e.t === "card";
      if (isKw) {
        if (e.ok) say(fmt("kwOk"), "", "good");
        else say(fmt("kwMiss"), "", "");
      } else if (e.ok) say(fmt(isOx ? "oxOk" : "drillOk", { n: T.report().drills }), "", "good");
      else say(fmt(isOx ? "oxMiss" : "drillMiss"), "", "");
    } else if (e.k === "l") {
      say(fmt("watched"), "", "good", 9000);
    }
  });

  /* ── 결산 — 한 세트 끝 ─────────────────────────────── */
  var 시작 = null;
  function begin(o) {
    o = o || {};
    시작 = { leaf: o.leaf || null, kind: o.kind || "q", at: Date.now(),
             u: o.leaf ? T.이해도(o.leaf) : null,
             a: o.leaf ? T.leafStat(o.leaf).achieve : null,
             spent: T.routine().spent, ok: T.report().correct, ans: T.report().answers };
    return 시작;
  }
  /* 숫자가 0 에서 차오른다. ★ rAF 만 쓰면 탭이 뒤로 가 있을 때 0 에서 멈춘 채 남는다 —
     시계로 재고, 끝값은 타이머로 한 번 더 박는다. */
  function countUp(el, to, ms) {
    var t0 = Date.now(), dur = ms || 700;
    function step() {
      var p = Math.min(1, (Date.now() - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(to * e);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
    setTimeout(function () { el.textContent = to; }, dur + 60);
  }
  function confetti(host) {
    var cols = ["var(--red)", "var(--mint)", "var(--fam-geo)", "var(--fam-soc)", "var(--fam-eth)", "var(--amber)"];
    var h = "";
    for (var i = 0; i < 18; i++) {
      var x = (4 + Math.random() * 90).toFixed(0), d = (Math.random() * .5).toFixed(2), r = (Math.random() * 360).toFixed(0);
      h += '<i style="left:' + x + '%;background:' + cols[i % cols.length] + ';animation-delay:' + d + 's;transform:rotate(' + r + 'deg)"></i>';
    }
    host.innerHTML = h;
  }
  /* opts = { got, total, leaf, kind, next:{href,cta}, more:{href|onclick,label}, retry:{onclick,label} } */
  function wrap(opts) {
    opts = opts || {};
    var got = opts.got || 0, total = opts.total || 0;
    var leaf = opts.leaf || (시작 && 시작.leaf) || null;
    var before = (시작 && 시작.leaf === leaf && 시작.u != null) ? 시작.u : (leaf ? snap().u[leaf] : null);
    var after = leaf ? T.이해도(leaf) : null;
    if (before == null && after != null) before = after;
    /* 이 화면이 채운 루틴 항목을 먼저 적는다 — 그래야 아래 「다음」 이 방금 한 것을 또 내지 않는다 */
    try { flowKinds(opts).forEach(function (kd) { if (T.flowMark) T.flowMark(kd); }); } catch (e) {}
    var t = tally(), step = nextStep(true);
    var 개념 = leaf ? leafName(leaf) : "";
    var ratio = total ? got / total : 0;
    var head = total ? (ratio === 1 ? fmt("wrapAll") : ratio >= .8 ? fmt("wrapMost")
                       : ratio >= .5 ? fmt("wrapHalf") : fmt("wrapLow")) : "";
    var uline = leaf ? (after > before ? fmt("wrapUp", { 개념: 개념, before: before, after: after })
                       : after < before ? fmt("wrapDown", { 개념: 개념, before: before, after: after })
                                       : fmt("wrapSame", { 개념: 개념, after: after })) : "";
    var md = midDelta(), m = leaf && midOf(leaf), tline = "";
    if (m && md[m.code] && md[m.code].d > 0) tline = fmt("wrapTree", { 개념: m.name, d: "+" + md[m.code].d });
    var dline = t.done ? fmt("wrapDone") : (시작 && !시작.ans && t.ans ? fmt("wrapFirst") + " " : "") + fmt("wrapLeft", { left: t.left });

    /* ★ 15분 흐름 (2026-09-15 대표님) — 학생이 고르지 않는다. 결산이 뜨면 오늘 루틴의
       어디까지 왔는지 막대로 보이고, 다음 항목을 한 줄로 알린 뒤 **3초 뒤 저절로** 연다.
       닫기·다시 풀기를 누르면 멈춘다. 오늘 몫이 끝났으면 자동으로 안 넘긴다. */
    var R0 = T.routine(), mk0 = T.flowDone ? T.flowDone() : {}, bars = "";
    var nx0 = opts.next || step;
    for (var bi = 0; bi < R0.items.length; bi++) {
      var it0 = R0.items[bi];
      var cls = mk0[it0.kind] ? "done" : (nx0 && (it0.kind === nx0.kind || it0.href === nx0.href) ? "next" : "");
      bars += '<span class="seg ' + cls + '" style="flex:' + Math.max(1, it0.min) + ' 1 0"></span>';
    }
    var autoNext = false;   // 자동 이동 없음 — 단추로만 간다(2026-10-04: 결산 창이 2~3초 뒤 저절로 넘어갔다)
    var ov = document.createElement("div");
    ov.className = "wrapov";
    ov.innerHTML =
      '<div class="wrapbox" role="dialog" aria-label="결산">' +
      '<div class="conf" aria-hidden="true"></div>' +
      '<div class="flowbar" aria-label="오늘 ' + t.goal + '분 진행">' + bars + '</div>' +
      '<span class="eb">' + esc(opts.kind === "ox" ? "개념 체크 끝" : opts.kind === "drill" ? "킬러 훈련 한 세트 끝"
                                 : opts.kind === "card" ? "개념 끝" : "한 세트 끝") + '</span>' +
      (total ? '<div class="big"><b class="n">0</b><span> / ' + total + '</span></div>' : '') +
      (head ? '<p class="head">' + esc(head) + '</p>' : '') +
      (leaf ? '<div class="ubar"><div class="lab"><span>' + esc(개념) + ' 이해도</span>' +
              '<b><span class="from">' + before + '</span> → <span class="to">' + after + '</span>' +
              (after > before ? '<em class="d">+' + (after - before) + '</em>' : '') + '</b></div>' +
              '<span class="track"><i class="was" style="width:' + before + '%"></i>' +
              '<i class="now" style="width:' + before + '%" data-to="' + after + '"></i></span></div>' : '') +
      (uline ? '<p class="say">' + esc(uline) + (tline ? " " + esc(tline) : "") + '</p>' : '') +
      '<div class="today"><div><b>' + t.ok + '</b><span>오늘 맞힘</span></div>' +
      '<div><b>' + t.ans + '</b><span>오늘 푼 것</span></div>' +
      '<div><b>' + t.spent + '<i>/' + t.goal + '</i></b><span>분</span></div>' +
      '<div><b>' + t.streak + '</b><span>일 연속</span></div>' +
      (t.up ? '<div class="up"><b>+' + t.up + '</b><span>오른 곳</span></div>' : '') + '</div>' +
      '<p class="dline">' + esc(dline) + '</p>' +
      (autoNext ? '<p class="autonext">다음 ' + esc(step.title) + ' ' + step.min + '분, ' +
                  '<b class="cnt">3</b>초 뒤 이동</p>' : '') +
      /* ★ 맨 위 행동은 「다음」 하나(큰 단추). 다시 풀기·더 풀기·닫기는 그 밑에 작게 — 학생이 고르지 않는다.
         오늘 목표를 채웠으면 「오늘 목표 완료」 + 가벼운 「더 하기」 만 */
      (flowAllDone()
        ? '<div class="flownext done"><b class="fl">' + esc(fmt("flowAllDone")) + '</b></div>'
        : nextBlock({ next: opts.next })) +
      '<div class="act sub">' +
      (flowAllDone() && !opts.more
        ? '<button class="btn" data-act="more0">' + esc(fmt("flowMore")) + '</button>' : "") +
      (opts.retry ? '<button class="btn ghost" data-act="retry">' + esc(opts.retry.label) + '</button>' : '') +
      (opts.more ? '<button class="btn' + (flowAllDone() ? '' : ' ghost') + '" data-act="more">' + esc(opts.more.label) + '</button>' : '') +
      '<button class="btn ghost" data-act="close">닫기</button></div></div>';
    document.body.appendChild(ov);
    confetti(ov.querySelector(".conf"));
    requestAnimationFrame(function () {
      ov.classList.add("on");
      var n = ov.querySelector(".big .n"); if (n) countUp(n, got, 800);
      var now = ov.querySelector(".track .now");
      if (now) setTimeout(function () { now.style.width = now.dataset.to + "%"; }, 350);
    });
    /* 자동 넘김 — 단추를 하나라도 누르면 멈춘다 */
    var autoT = null, cntEl = ov.querySelector(".autonext .cnt");
    if (autoNext) {
      var left = 3;
      autoT = setInterval(function () {
        left -= 1;
        if (cntEl) cntEl.textContent = String(Math.max(0, left));
        if (left <= 0) { clearInterval(autoT); autoT = null; location.href = step.href; }
      }, 1000);
    }
    function stopAuto() { if (autoT) { clearInterval(autoT); autoT = null; }
      var a = ov.querySelector(".autonext"); if (a) a.remove(); }
    function close() { stopAuto(); ov.classList.remove("on"); setTimeout(function () { ov.remove(); }, 300); paint(idleLine()); }
    ov.querySelectorAll("[data-act]").forEach(function (b) {
      b.onclick = function () {
        stopAuto();
        var a = b.dataset.act;
        close();
        if (a === "retry" && opts.retry && opts.retry.onclick) opts.retry.onclick();
        if (a === "more" && opts.more && opts.more.onclick) opts.more.onclick();
        if (a === "more0") { var mo = opts.next || nextStep(false); location.href = mo ? mo.href : "study.html"; }
      };
    });
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    시작 = null;
    return ov;
  }

  /* ── 오늘의 개념 카드 — 눌러야 열린다 ───────────────── */
  var CARDS_KEY = "terra.cards";
  function cardsOpened() { return ls(CARDS_KEY) || {}; }
  function cardOpenedToday() { return !!cardsOpened()[T.dayKey()]; }
  function cardCount() { return Object.keys(cardsOpened()).length; }
  /* 오늘 카드 — 오늘의 리프 가운데 카드가 있는 첫 것. 같은 날은 같은 카드 */
  function cardToday() {
    var C = window.CARDS; if (!C) return null;
    var op = cardsOpened()[T.dayKey()];
    if (op && C[op.leaf] && C[op.leaf].cards[op.i]) return { leaf: op.leaf, i: op.i, card: C[op.leaf].cards[op.i], set: C[op.leaf], opened: true };
    var 후보 = (T.오늘의리프 ? T.오늘의리프({ 전부: true }) : []).filter(function (c) {
      return C[c.code] && C[c.code].cards.length;
    });
    if (!후보.length) return null;
    var leaf = 후보[0].code, n = C[leaf].cards.length;
    var i = Math.floor(T.seed("card" + T.dayKey() + leaf) * n) % n;
    return { leaf: leaf, i: i, card: C[leaf].cards[i], set: C[leaf], opened: false };
  }
  function openCard() {
    var c = cardToday(); if (!c) return null;
    var o = cardsOpened(); o[T.dayKey()] = { leaf: c.leaf, i: c.i, at: Date.now() };
    ls(CARDS_KEY, o);
    return c;
  }
  /* 홈에 그린다 — host 안에 봉인된 카드, 누르면 뒤집힌다 */
  function mountCard(host) {
    if (!host) return;
    var c = cardToday();
    if (!c) {
      host.innerHTML = '<div class="tcard none"><span class="eb">' + esc(MSG.cardSealed) + '</span>' +
        '<p>' + esc(MSG.cardNone) + '</p></div>';
      return;
    }
    /* 카드 2판(blocks)은 부제 + 첫 문단들로 미리 보인다(2026-09-18 홈이 lines 를 가정해 죽었던 것) */
    function 미리보기(card) {
      if (card.lines) return card.lines;
      /* ★ 글자 수로 자르지 않는다 — 「…사회권·청」 처럼 말이 끊겨 나갔다(2026-09-19 대표님).
         문단의 **첫 문장만 통째로** 보인다. 문장이 길어도 자르지 않는다 */
      var out = [];
      (card.blocks || []).forEach(function (b) {
        if (b.t !== "p" || !b.text) return;
        var 글 = String(b.text).replace(/\*\*/g, "").trim();
        var m = 글.match(/^.*?[.?!](?=\s|$)/);
        out.push(m ? m[0] : 글);
      });
      return out;
    }
    function face(c) {
      return '<div class="face back">' +
        '<span class="eb">' + esc((T.BY[c.set.root] ? T.BY[c.set.root].name + ", " : "") + c.set.mid) + '</span>' +   /* 단원 알파벳 대신 단원 이름 */
        '<h3>' + esc(c.card.title) + '</h3>' +
        '<ul>' + 미리보기(c.card).slice(0, 2).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join("") + '</ul>' +
        '<p class="cap">' + esc(MSG.cardOpened) + '</p>' +
        '<div class="act"><a class="btn" href="card.html?leaf=' + c.leaf + '">바로 확인 →</a>' +
        '<span class="cnt">' + esc(fmt("cardCount", { n: cardCount() })) + '</span></div></div>';
    }
    host.innerHTML = '<div class="tcard' + (c.opened ? " open" : "") + '" tabindex="0" role="button" aria-label="오늘의 개념 카드 열기">' +
      '<div class="flip">' +
      '<div class="face front"><span class="eb">' + esc(MSG.cardSealed) + '</span>' +
      '<span class="seal"><i></i><i></i><i></i></span>' +
      '<b>' + esc(c.set.name) + '</b>' +
      '<span class="tap">' + esc(MSG.cardTap) + '</span>' +
      '<span class="cnt">' + esc(fmt("cardCount", { n: cardCount() })) + '</span></div>' +
      face(c) + '</div></div>';
    var el = host.querySelector(".tcard");
    function go() {
      if (el.classList.contains("open")) return;
      openCard();
      el.classList.add("open", "pop");
      el.querySelector(".back .cnt").textContent = fmt("cardCount", { n: cardCount() });
      setTimeout(function () { el.classList.remove("pop"); }, 900);
      if (bar) say(fmt("cardOpened"), "", "good");
    }
    el.addEventListener("click", function (e) { if (!e.target.closest("a")) go(); });
    el.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
  }

  /* ── 오늘 성과 칸 — 홈 머리 밑 ─────────────────────── */
  function mountToday(host) {
    if (!host) return;
    var t = tally(), d = todayDelta(), lv = lastVisit();
    var 비교 = "";
    if (lv && lv.n && t.ans) {
      var p0 = Math.round(lv.ok / lv.n * 100), p1 = t.pct == null ? 0 : t.pct, df = p1 - p0;
      비교 = df > 0 ? lv.ago + "보다 정답률 +" + df + "%p" : df < 0 ? lv.ago + " 정답률 " + p0 + "%" : lv.ago + "와 정답률 같음";
    }
    var tops = d.list.filter(function (x) { return x.d > 0; }).slice(0, 3);
    host.innerHTML =
      '<div class="tstat">' +
      '<div class="k"><b>' + t.ok + '</b><span>오늘 맞힘</span></div>' +
      '<div class="k"><b>' + t.ans + '</b><span>오늘 푼 것</span></div>' +
      '<div class="k"><b>' + t.spent + '<i>/' + t.goal + '</i></b><span>분</span></div>' +
      '<div class="k' + (t.up ? " up" : "") + '"><b>' + (t.up ? "+" + t.up : "0") + '</b><span>오른 곳</span></div>' +
      '</div>' +
      '<p class="tline">' +
      (tops.length ? "오늘 오른 곳: " + tops.map(function (x) { return esc(x.name) + " <b>+" + x.d + "</b>"; }).join(", ") + ". "
                   : (t.ans ? "" : "시작 전. ")) +
      esc(비교) + '</p>';
  }

  /* ── 개념트리 — 오늘 오른 곳 띠 ─────────────────────── */
  function mountTreeDelta(host, onPick) {
    if (!host) return;
    var d = todayDelta().list.filter(function (x) { return x.d > 0; }).slice(0, 6);
    if (!d.length) { host.innerHTML = ""; return; }
    host.innerHTML = '<div class="tdelta"><span class="eb">오늘 오른 곳</span>' +
      d.map(function (x) {
        return '<button type="button" data-leaf="' + x.code + '" data-mid="' + x.midCode + '">' +
          esc(x.name) + ' <b>' + x.before + '→' + x.after + '</b></button>';
      }).join("") + '</div>';
    host.querySelectorAll("button").forEach(function (b) {
      b.onclick = function () { if (onPick) onPick(b.dataset.leaf, b.dataset.mid); };
    });
  }

  window.COACH = {
    MSG: MSG, fmt: fmt, mount: mount, say: say, paint: function () { paint(idleLine()); },
    begin: begin, wrap: wrap, tally: tally, greeting: greeting, greetWhy: greetWhy, lastVisit: lastVisit,
    nextStep: nextStep, nextBlock: nextBlock, startLabel: startLabel, allDone: flowAllDone, flowKinds: flowKinds, snap: snap, takeSnap: takeSnap, todayDelta: todayDelta, midDelta: midDelta,
    cardToday: cardToday, openCard: openCard, cardOpenedToday: cardOpenedToday, cardCount: cardCount,
    mountCard: mountCard, mountToday: mountToday, mountTreeDelta: mountTreeDelta,
    은는: 은는, 이가: 이가, 을를: 을를
  };
})();
