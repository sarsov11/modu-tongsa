/* 오늘의 루틴 카드 — 모두의 통사 홈 맨 위 (2026-10-11 대표님 「오늘 해야 할 일을 인식 못 함, 루틴이 없는 느낌」)
 *
 *  전에는 홈에 「다음: ○○」 단추 하나만 있어 오늘 할 일이 몇 개인지, 어디까지 했는지, 끝나면 무엇이 남는지가 안 보였다.
 *  루틴(T.routine().items)을 그대로 펼쳐 보여 준다 — 끝낸 것 ✓, 지금 할 것 크게, 남은 것 회색.
 *  밑에는 이번 주 7칸(매일 한 칸씩 채우는 습관)과 「끝내면 연속 N일」.
 *
 *  세 안: a 체크리스트 · b 길(듀오링고식 원 잇기) · c 막대(가로 단계 + 지금 할 것 카드)
 *  고르기: ?rt=a|b|c (localStorage terra.rt.view 에 남는다). 기본 a.
 *  ROUTINE.mount(기준요소)  — 기준요소 앞에 카드를 넣는다.
 */
(function () {
  "use strict";
  if (window.ROUTINE) return;
  var T = window.TERRA, D = document;
  function esc(t) { return String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { } return null; }
  var VIEWS = ["a", "b", "c"];
  function view() {
    var q = ""; try { q = (new URLSearchParams(location.search)).get("rt") || ""; } catch (e) { }
    if (VIEWS.indexOf(q) >= 0) ls("terra.rt.view", q);
    var v = ls("terra.rt.view"); return VIEWS.indexOf(v) >= 0 ? v : "a";
  }
  /* 항목 이름 앞 그림 — 글자 대신 모양으로 종류를 가른다 */
  var ICON = { due: "↺", card: "개", ox: "OX", q: "✎", drill: "⚡", exam: "시", exwrong: "↺", lec: "▶", weekly: "★", after: "↺" };
  var COL = { due: "#F59E0B", after: "#F59E0B", exwrong: "#F59E0B", card: "#3B82F6", lec: "#3B82F6", ox: "#8B5CF6", q: "#E5484D", drill: "#F97316", exam: "#0EA5E9", weekly: "#EAB308" };
  function shortSay(it) { return String(it.sayShort || it.say || "").split(" — ")[0]; }

  var css = [
    ".rtc{margin:16px 0 6px;border:1px solid var(--line);background:var(--surface);border-radius:20px;padding:18px 16px 14px;box-shadow:var(--shadow)}",
    ".rtc .hd{display:flex;align-items:center;gap:12px}",
    ".rtc .ring{position:relative;width:54px;height:54px;flex:0 0 auto}.rtc .ring svg{transform:rotate(-90deg)}",
    ".rtc .ring b{position:absolute;inset:0;display:grid;place-items:center;font:900 15px/1 var(--mono);color:var(--ink)}",
    ".rtc .ttl{flex:1;min-width:0}.rtc .ttl h2{margin:0;font-size:20px;font-weight:900;letter-spacing:-.03em;color:var(--ink)}",
    ".rtc .ttl p{margin:3px 0 0;font-size:14px;color:var(--ink-3);font-weight:600}",
    ".rtc .ttl p em{font-style:normal;color:var(--cta);font-weight:800}",
    /* A 체크리스트 */
    ".rtc ol.ls{list-style:none;margin:14px 0 0;padding:0;display:grid;gap:8px}",
    ".rtc ol.ls li{display:flex;align-items:center;gap:12px;padding:11px 12px;border-radius:14px;border:1.5px solid var(--line);background:var(--bg)}",
    ".rtc ol.ls li .ic{flex:0 0 auto;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font:900 13px/1 var(--mono);background:var(--surface-2,var(--surface));color:var(--ink-3);border:1.5px solid var(--line-2)}",
    ".rtc ol.ls li .tx{flex:1;min-width:0}.rtc ol.ls li .tx b{display:block;font-size:16px;font-weight:800;color:var(--ink);letter-spacing:-.02em}",
    ".rtc ol.ls li .tx span{display:block;font-size:13.5px;color:var(--ink-3);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".rtc ol.ls li .mn{font:800 13px/1 var(--mono);color:var(--ink-3)}",
    ".rtc ol.ls li.done{opacity:.62}.rtc ol.ls li.done .ic{background:#16B364;border-color:#16B364;color:#fff}.rtc ol.ls li.done .tx b{text-decoration:line-through;text-decoration-thickness:2px}",
    ".rtc ol.ls li.now{border-color:var(--cta);background:var(--cta-soft,rgba(229,72,77,.08));flex-wrap:wrap}",
    ".rtc ol.ls li.now .ic{background:var(--cta);border-color:var(--cta);color:#fff;animation:rtPulse 1.6s ease-out infinite}",
    "@keyframes rtPulse{0%{box-shadow:0 0 0 0 rgba(229,72,77,.55)}100%{box-shadow:0 0 0 12px rgba(229,72,77,0)}}",
    ".rtc .go{display:flex;align-items:center;justify-content:center;width:100%;margin-top:10px;padding:15px 16px;border-radius:14px;background:var(--cta);color:#fff;text-decoration:none;font-weight:900;font-size:17px;letter-spacing:-.02em}",
    /* A2 (2026-10-11 「짜침」 고침): 상자 안 상자를 걷고 세로 길 하나, 종류별 색 아이콘, 지금 할 것만 떠 있는 카드 */
    ".rtc.rt-a{background:var(--surface);border:0;box-shadow:0 10px 30px -14px rgba(0,0,0,.35),0 0 0 1px var(--line)}",
    ".rtc .hd2{display:flex;align-items:flex-end;gap:10px}.rtc .hd2 .k{font-size:13px;font-weight:800;color:var(--ink-3);letter-spacing:.02em}",
    ".rtc .hd2 .big{font:900 34px/1 var(--mono);color:var(--ink);letter-spacing:-.04em}.rtc .hd2 .big small{font-size:18px;color:var(--ink-3);font-weight:800}",
    ".rtc .hd2 .hr{margin-left:auto;text-align:right}.rtc .hd2 .chip{display:inline-block;padding:6px 11px;border-radius:999px;background:var(--bg);font:800 13.5px/1 var(--mono);color:var(--ink)}",
    ".rtc .seg4{display:flex;gap:5px;margin:12px 0 4px}.rtc .seg4 i{height:12px;border-radius:7px;background:var(--line-2)}",
    ".rtc .seg4 i.done{background:linear-gradient(90deg,#16B364,#3DD68C)}.rtc .seg4 i.now{background:var(--line-2);position:relative;overflow:hidden}",
    ".rtc .seg4 i.now::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,var(--cta),transparent);animation:rtSweep 1.6s ease-in-out infinite}",
    "@keyframes rtSweep{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}",
    ".rtc .tl{position:relative;margin:12px 0 0;padding:0;list-style:none}",
    ".rtc .tl::before{content:'';position:absolute;left:21px;top:22px;bottom:22px;width:3px;border-radius:3px;background:var(--line-2)}",
    ".rtc .tl li{position:relative;display:flex;align-items:center;gap:13px;padding:9px 4px}",
    ".rtc .tl .nd{position:relative;z-index:1;flex:0 0 auto;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;color:#fff;font:900 15px/1 var(--mono);background:var(--c);box-shadow:0 3px 0 rgba(0,0,0,.18)}",
    ".rtc .tl li.up .nd{background:var(--surface);color:var(--c);box-shadow:inset 0 0 0 2.5px var(--c)}",
    ".rtc .tl li.done .nd{background:#16B364;box-shadow:0 3px 0 #0E8A4B}",
    ".rtc .tl .tx{flex:1;min-width:0}.rtc .tl .tx b{display:block;font-size:16px;font-weight:800;letter-spacing:-.02em;color:var(--ink)}",
    ".rtc .tl .tx span{display:block;margin-top:2px;font-size:13.5px;color:var(--ink-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".rtc .tl .mn{font:800 13px/1 var(--mono);color:var(--ink-3)}.rtc .tl li.done .mn{color:#16B364}",
    ".rtc .tl li.done .tx b{color:var(--ink-2)}",
    ".rtc .tl li.now{flex-wrap:wrap;margin:6px -6px;padding:13px 10px 12px;border-radius:18px;background:var(--bg);box-shadow:0 12px 28px -12px rgba(0,0,0,.35),0 0 0 1px var(--line)}",
    ".rtc .tl li.now .nd{width:50px;height:50px;font-size:17px;margin-left:-3px;animation:rtPulse2 1.8s ease-out infinite}",
    "@keyframes rtPulse2{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--c) 60%,transparent),0 3px 0 rgba(0,0,0,.18)}100%{box-shadow:0 0 0 14px transparent,0 3px 0 rgba(0,0,0,.18)}}",
    ".rtc .tl li.now .tx b{font-size:18px}.rtc .tl li.now .k2{display:block;font-size:12.5px;font-weight:800;color:var(--c);margin-bottom:2px}",
    ".rtc .tl li.now .go{margin-top:12px;border-radius:14px;box-shadow:0 4px 0 color-mix(in srgb,var(--cta) 70%,#000)}",
    ".rtc.rt-a .wk div i{width:28px;height:28px;border:2px solid var(--line-2);font-size:13px;font-weight:900}",
    ".rtc.rt-a .wk div.full i{background:linear-gradient(160deg,#FFB020,#FF6A00);border:0;color:#fff;box-shadow:0 2px 6px rgba(255,106,0,.35)}",
    ".rtc.rt-a .wk div.part i{border-color:#FFB020}.rtc.rt-a .wk div.tdy i{border-color:var(--ink)}",
    ".rtc.rt-a .ft b{color:#FF6A00}",
    /* B 길 */
    ".rtc .path{position:relative;margin:16px 0 4px;padding:4px 0}",
    ".rtc .path .nd{position:relative;display:flex;align-items:center;gap:12px;margin:0 0 18px;text-decoration:none;color:inherit}",
    ".rtc .path .nd:nth-child(even){flex-direction:row-reverse;text-align:right}",
    ".rtc .path .nd .o{flex:0 0 auto;width:62px;height:62px;border-radius:50%;display:grid;place-items:center;font:900 18px/1 var(--mono);background:var(--bg);border:3px solid var(--line-2);color:var(--ink-3);box-shadow:0 5px 0 var(--line-2);position:relative;z-index:1}",
    ".rtc .path .nd.done .o{background:#16B364;border-color:#16B364;color:#fff;box-shadow:0 5px 0 rgba(0,0,0,.25)}",
    ".rtc .path .nd.now .o{width:76px;height:76px;background:var(--cta);border-color:var(--cta);color:#fff;font-size:22px;box-shadow:0 6px 0 rgba(0,0,0,.28);animation:rtPulse 1.6s ease-out infinite}",
    ".rtc .path .nd .l b{display:block;font-size:16px;font-weight:800;color:var(--ink)}.rtc .path .nd .l span{font-size:13.5px;color:var(--ink-3)}",
    ".rtc .path .nd.now .l b{color:var(--cta);font-size:17.5px}",
    ".rtc .path .nd{width:calc(50% + 31px)}.rtc .path .nd:nth-child(even){margin-left:auto}",
    /* C 막대 */
    ".rtc .bar{display:flex;gap:5px;margin:16px 0 6px}",
    ".rtc .bar i{flex:1;height:10px;border-radius:6px;background:var(--line-2)}.rtc .bar i.done{background:#16B364}.rtc .bar i.now{background:var(--cta);animation:rtBlink 1.4s ease-in-out infinite}",
    "@keyframes rtBlink{50%{opacity:.45}}",
    ".rtc .barl{display:flex;gap:5px}.rtc .barl span{flex:1;font-size:12px;color:var(--ink-3);font-weight:700;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rtc .barl span.now{color:var(--cta)}",
    ".rtc .nowcard{margin-top:12px;border-radius:16px;border:1.5px solid var(--cta);padding:14px;background:var(--cta-soft,rgba(229,72,77,.08))}",
    ".rtc .nowcard .k{font-size:13px;font-weight:800;color:var(--cta)}.rtc .nowcard h3{margin:4px 0 2px;font-size:19px;font-weight:900;color:var(--ink)}.rtc .nowcard p{margin:0;font-size:14px;color:var(--ink-3)}",
    /* 주간 칸 */
    ".rtc .wk{display:flex;justify-content:space-between;gap:4px;margin-top:14px;padding-top:12px;border-top:1px solid var(--line)}",
    ".rtc .wk div{flex:1;text-align:center;font-size:12px;font-weight:700;color:var(--ink-3)}",
    ".rtc .wk div i{display:grid;place-items:center;width:30px;height:30px;margin:4px auto 0;border-radius:50%;border:1.5px dashed var(--line-2);font-style:normal;font-size:15px}",
    ".rtc .wk div.full i{background:var(--amber);border:0;color:#fff}.rtc .wk div.part i{border:2px solid var(--amber)}",
    ".rtc .wk div.tdy{color:var(--ink)}.rtc .wk div.tdy i{border-color:var(--cta);border-style:solid;border-width:2px}",
    ".rtc .ft{margin:10px 0 0;font-size:13.5px;color:var(--ink-3);text-align:center}.rtc .ft b{color:var(--amber)}",
    ".rtc.alldone{border-color:#16B364}.rtc.alldone .ttl h2{color:#16B364}",
    /* 홈 대화 칸의 큰 단추는 카드가 대신한다 — 단추가 두 곳에 있으면 또 고르게 된다 */
    "body.has-rt #talk .bub,body.has-rt #talk .ans > a:first-child{display:none}",
    "body.has-rt #talk{margin-top:6px}"
  ].join("\n");

  function weekCells() {
    var out = [], now = new Date(), dow = (now.getDay() + 6) % 7, goal = T.goalMin ? T.goalMin() : 15;
    var cal = {};
    function fill(ym) { try { (T.calendar(ym).cells || []).forEach(function (c) { if (c) cal[c.key] = c; }); } catch (e) { } }
    var d0 = new Date(now); d0.setDate(now.getDate() - dow);
    fill(T.dayKey(d0).slice(0, 7)); fill(T.dayKey(now).slice(0, 7));
    var NM = ["월", "화", "수", "목", "금", "토", "일"];
    for (var i = 0; i < 7; i++) {
      var d = new Date(d0); d.setDate(d0.getDate() + i); var k = T.dayKey(d), c = cal[k];
      out.push({ nm: NM[i], lv: c ? c.lv : 0, today: i === dow, future: i > dow });
    }
    return out;
  }

  function render(host) {
    var R = T.routine(), items = R.items || [], C = window.COACH;
    var mk = T.flowDone ? T.flowDone() : {}, now = C && C.nextStep ? C.nextStep(false) : null;
    var allDone = C && C.allDone ? C.allDone() : !now;
    var n = items.length, nd = items.filter(function (it) { return mk[it.kind]; }).length;
    if (allDone) nd = n;
    var st = function (it) { return mk[it.kind] || allDone ? "done" : (now && it.kind === now.kind ? "now" : ""); };
    var spent = R.spent || 0, goal = R.goal || 15, rep = T.report ? T.report() : { streak: 0, solved: 0 };
    var streak = rep.streak || 0;
    var Cc = 2 * Math.PI * 23, on = (Cc * Math.min(1, n ? nd / n : 0)).toFixed(1);
    var ring = '<span class="ring"><svg width="54" height="54" viewBox="0 0 54 54"><circle cx="27" cy="27" r="23" fill="none" stroke="var(--line-2)" stroke-width="6"/>' +
      '<circle cx="27" cy="27" r="23" fill="none" stroke="' + (allDone ? "#16B364" : "var(--cta)") + '" stroke-width="6" stroke-linecap="round" stroke-dasharray="' + on + ' ' + (Cc - on).toFixed(1) + '"/></svg><b>' + nd + '/' + n + '</b></span>';
    var head = '<div class="hd">' + ring + '<div class="ttl"><h2>' + (allDone ? "오늘 루틴 끝" : "오늘의 루틴 " + goal + "분") + '</h2>' +
      '<p>' + (allDone ? spent + "분 공부, 내일 같은 시각에 다시"
        : nd ? nd + "개 끝, " + (n - nd) + "개 남음 <em>" + Math.max(1, goal - spent) + "분</em>"
        : n + "개, 위에서부터 차례로") + '</p></div></div>';
    var v = view(), body = "";
    if (v === "a") {
      /* 머리를 큰 숫자 + 칸 막대로 다시 그린다(작은 고리는 진행이 안 읽혔다) */
      head = '<div class="hd2"><div><span class="k">' + (allDone ? "오늘 루틴 끝" : "오늘의 루틴") + '</span><div class="big">' + nd + '<small> / ' + n + '</small></div></div>' +
        '<div class="hr"><span class="chip">' + (allDone ? spent + "분 공부" : Math.max(1, goal - spent) + "분 남음") + '</span></div></div>' +
        '<div class="seg4">' + items.map(function (it) { var s2 = st(it); return '<i class="' + s2 + '" style="flex:' + Math.max(1, it.min) + ' 1 0"></i>'; }).join("") + '</div>';
      body = '<ol class="tl">' + items.map(function (it, i) {
        var s2 = st(it) || "up", col = COL[it.kind] || "#6B7280";
        return '<li class="' + s2 + '" style="--c:' + col + '"><span class="nd">' + (s2 === "done" ? "✓" : (ICON[it.kind] || (i + 1))) + '</span>' +
          '<span class="tx">' + (s2 === "now" ? '<span class="k2">' + (i + 1) + '번째, 지금</span>' : '') + '<b>' + esc(it.title) + '</b><span>' + esc(shortSay(it)) + '</span></span>' +
          '<span class="mn">' + (s2 === "done" ? "완료" : it.min + "분") + '</span>' +
          (s2 === "now" ? '<a class="go" href="' + it.href + '">' + (nd ? "이어서 하기" : "시작하기") + ' →</a>' : '') + '</li>';
      }).join("") + '</ol>';
    } else if (v === "b") {
      body = '<div class="path">' + items.map(function (it, i) {
        var s = st(it);
        return '<a class="nd ' + s + '" href="' + it.href + '"><span class="o">' + (s === "done" ? "✓" : (ICON[it.kind] || (i + 1))) + '</span><span class="l"><b>' + esc(it.title) + '</b><span>' + it.min + '분' + (s === "now" ? ", 지금" : "") + '</span></span></a>';
      }).join("") + '</div>' + (now && !allDone ? '<a class="go" href="' + now.href + '">' + esc(now.title) + ' 시작 →</a>' : "");
    } else {
      body = '<div class="bar">' + items.map(function (it) { var s = st(it); return '<i class="' + s + '" style="flex:' + Math.max(1, it.min) + ' 1 0"></i>'; }).join("") + '</div>' +
        '<div class="barl">' + items.map(function (it) { var s = st(it); return '<span class="' + s + '" style="flex:' + Math.max(1, it.min) + ' 1 0">' + esc(it.title.replace(/^오늘 /, "")) + '</span>'; }).join("") + '</div>' +
        (now && !allDone ? '<div class="nowcard"><span class="k">' + (items.indexOf(items.filter(function (x) { return x.kind === now.kind; })[0]) + 1) + '번째, ' + now.min + '분</span><h3>' + esc(now.title) + '</h3><p>' + esc(shortSay(now)) + '</p>' +
          '<a class="go" href="' + now.href + '">' + (nd ? "이어서" : "시작") + ' →</a></div>' : "");
    }
    if (allDone) {
      var bn = C && C.bonusStep ? C.bonusStep() : null;
      if (bn) body += '<a class="go" style="background:#16B364;color:#fff" href="' + bn.href + '">한 세트 더: ' + esc(bn.title) + ' (' + bn.min + '분)</a>';
    }
    var wk = weekCells();
    if (allDone) wk.forEach(function (c) { if (c.today) c.lv = 2; });   /* 루틴을 다 끝낸 날은 분이 모자라도 그날 칸에 불을 켠다 */
    var 오늘함 = rep.solved > 0;
    var foot = '<div class="wk">' + wk.map(function (c) {
      return '<div class="' + (c.lv === 2 ? "full" : c.lv === 1 ? "part" : "") + (c.today ? " tdy" : "") + '">' + c.nm + '<i>' + (c.lv === 2 ? "✓" : "") + '</i></div>';
    }).join("") + '</div>' +
      '<p class="ft">' + (allDone ? "연속 <b>" + streak + "일</b>" : 오늘함 ? "연속 <b>" + streak + "일째</b>, 루틴을 끝내면 오늘 칸에 불이 켜짐"
        : streak ? "오늘 시작하면 연속 <b>" + (streak + 1) + "일</b>" : "오늘 루틴을 끝내면 이번 주 첫 칸에 불이 켜짐") +
      (window.TERRA_NOTIFY && TERRA_NOTIFY.on && TERRA_NOTIFY.on() ? ", 매일 " + TERRA_NOTIFY.at() + " 알림" : "") + '</p>';
    host.className = "rtc rt-" + v + (allDone ? " alldone" : "");
    host.innerHTML = head + body + foot;
    /* 그날 처음 「다 끝남」을 볼 때 한 번 — 짜잔 별 셋 */
    if (allDone && window.ZZ && ZZ.stars && ls("terra.rt.cele") !== T.dayKey()) { ls("terra.rt.cele", T.dayKey()); setTimeout(function () { ZZ.stars(3); }, 500); }
  }

  function mount(before) {
    if (!T || !T.routine || !before) return null;
    if (!D.getElementById("rtc-style")) { var s = D.createElement("style"); s.id = "rtc-style"; s.textContent = css; D.head.appendChild(s); }
    var host = D.getElementById("rtc") || D.createElement("section");
    host.id = "rtc"; host.setAttribute("aria-label", "오늘의 루틴");
    if (!host.parentNode) before.parentNode.insertBefore(host, before);
    try { render(host); D.body.classList.add("has-rt"); } catch (e) { host.remove(); return null; }
    return host;
  }
  window.ROUTINE = { mount: mount, view: view, VIEWS: VIEWS };
})();
