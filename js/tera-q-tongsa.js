/* 통사 문제 화면 어댑터 (2026-11-10) — 공용 tera-q.js/css 를 통사 문제 화면에 잇는다.
 *   페이지는 문항을 그릴 때 TQT.q({...}), 채점한 뒤 TQT.done({...}) 만 부른다. 기존 채점·기록 코드는 그대로 둔다.
 *   · 개념어 형광 띠: notes.js 의 terms(window.TNQ) → TERA_Q.terms → 발문·선지에 TERA_Q.annotate
 *   · 중요도 별: 합격 지도와 같은 기준(중단원 해마다 문항 수 상위 20% = 별 셋)
 *   · 아래 줄: 헷갈림 · 해설 · 펜 + ‹ 2 / 5 ›
 *   · 확신도 세 단추는 화면에서 숨기고 「헷갈림」으로: 안 누르면 확실, 누르면 반반·찍었어요 중 고른다(기존 #conf 단추를 대신 눌러 기록)
 */
(function () {
  if (window.TQT) return;
  var d = document, Q = window.TERA_Q, cfg = null, cur = null, bar, T0 = Date.now(), tick = null, topSet = null;
  /* 중요도 별(공용 badge): 합격 지도와 같은 순위 — 해마다 문항 수 상위 20% = 별 셋, 다음 30% = 별 둘, 나머지 = 별 하나 */
  function $(s, r) { return (r || d).querySelector(s); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { } return null; }
  var SV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
  var IC = {
    q: SV + '<circle cx="12" cy="12" r="8.5"/><path d="M9.7 9.5a2.4 2.4 0 1 1 3.4 2.2c-.7.4-1.100.9-1.100 1.700M12 16.600h.01"/></svg>',
    book: SV + '<path d="M12 6.5C10.2 5 7.6 4.5 4.5 4.8v13c3.1-.3 5.7.2 7.5 1.7 1.8-1.5 4.4-2 7.5-1.7v-13c-3.1-.3-5.7.2-7.5 1.7zM12 6.5v13"/></svg>',
    pen: SV + '<path d="M4.5 19.5l1-4L16 5l3 3L8.5 18.5z"/><path d="M14.500 6.500l3 3"/></svg>'
  };

  /* ── 개념어 자료 ── */
  function loadTerms() {
    var n = 0;
    (window.TNQ || []).forEach(function (x) { if (x && x.terms) { Q.terms(x.terms); n++; } });
    if (window.DIAGRAM && DIAGRAM._terms) { try { Q.terms(DIAGRAM._terms); } catch (e) { } }
    return n;
  }

  /* ── 중요도 별: 중단원(합격 지도의 칸) 해마다 문항 수 순위 ── */
  function topMids() {
    if (topSet) return topSet;
    topSet = {};
    try {
      var T = window.TERRA, roots = (T.보이는대영역 ? T.보이는대영역() : T.ROOTS).filter(function (r) { return !r.cross; }), arr = [];
      roots.forEach(function (r) { r.mids.forEach(function (m) { var v = 0; m.leaves.forEach(function (lf) { v += (lf.vol != null ? lf.vol : (lf.n || 0)); }); arr.push([m.code, v]); }); });
      arr.sort(function (a, b) { return b[1] - a[1]; });
      arr.forEach(function (a, i) { if (a[1] > 0) topSet[a[0]] = i / arr.length < 0.2 ? 3 : i / arr.length < 0.5 ? 2 : 1; });
    } catch (e) { }
    return topSet;
  }
  function stars(leaf) {
    try { var lf = window.TERRA.BY[leaf]; return (lf && lf.mid && topMids()[lf.mid.code]) || 0; } catch (e) { return 0; }
  }
  function isTop(leaf) { return stars(leaf) === 3; }

  /* ── 아래 줄 ── */
  function ensureBar() {
    if (bar) return bar;
    bar = d.createElement("div"); bar.className = "tq-bar";
    bar.innerHTML =
      '<button type="button" class="tq-tool" data-t="doubt">' + IC.q + '<span>헷갈림</span></button>' +
      '<button type="button" class="tq-tool" data-t="exp">' + IC.book + '<span>해설</span></button>' +
      '<button type="button" class="tq-tool" data-t="pen">' + IC.pen + '<span>펜</span></button>' +
      '<span class="tq-sp"></span>' +
      '<button type="button" class="tq-nav" data-t="prev" aria-label="이전" disabled>‹</button>' +
      '<button type="button" class="tq-pos" data-t="pos"><span></span> <small></small></button>' +
      '<button type="button" class="tq-nav is-next" data-t="next" aria-label="다음" disabled>다음 ›</button>' +
      '<div class="tq-doubt" hidden><button type="button" data-c="half">반반</button><button type="button" data-c="guess">찍었어요</button></div>';
    d.body.appendChild(bar);
    d.body.classList.add("tqs");
    bar.addEventListener("click", function (e) {
      var b = e.target.closest("[data-t],[data-c]"); if (!b || !cur) return;
      var c = b.getAttribute("data-c");
      if (c) { setConf(c); return; }
      var t = b.getAttribute("data-t");
      if (t === "doubt") doubt();
      else if (t === "exp") exp();
      else if (t === "pen") pen(b);
      else if (t === "next") { if (b.disabled) return; hidePen(); if (cur.onNext) cur.onNext(); else { var n = $("#next"); if (n) n.click(); } }
      else if (t === "pos") { if (cur.omr) cur.omr.toggle(); }
    });
    return bar;
  }
  function tool(t) { return bar && bar.querySelector('[data-t="' + t + '"]'); }

  /* 헷갈림: 안 누르면 확실. 누르면 반반·찍었어요 중 고른다 */
  var conf = "sure";
  function clickConf(v) { var b = $('#conf button[data-c="' + v + '"]'); if (b) b.click(); }
  function setConf(v) {
    conf = v; var pop = bar.querySelector(".tq-doubt"); pop.hidden = true;
    [].forEach.call(pop.querySelectorAll("button"), function (x) { x.classList.toggle("is-on", x.getAttribute("data-c") === v); });
    tool("doubt").classList.toggle("is-on", v !== "sure");
    tool("doubt").querySelector("span").textContent = v === "half" ? "반반" : v === "guess" ? "찍었어요" : "헷갈림";
    if (cur && cur.hasConf) clickConf(v);
    if (cur && cur.id != null) { var m = {}; try { m = JSON.parse(ls("terra.q.confused") || "{}"); } catch (e) { } if (v === "sure") delete m[cur.id]; else m[cur.id] = v; ls("terra.q.confused", JSON.stringify(m)); }
  }
  function doubt() {
    if (cur.answered) return;
    var pop = bar.querySelector(".tq-doubt");
    if (conf !== "sure") { setConf("sure"); return; }
    pop.hidden = !pop.hidden;
  }
  function exp() {
    var v = $(cur.expSel || ".verdict, #v"); if (v && cur.answered) v.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  var penOn = false;
  function hidePen() { try { if (window.TERA_PAD && TERA_PAD.penHide) TERA_PAD.penHide(); } catch (e) { } penOn = false; var b = tool("pen"); if (b) b.classList.remove("is-on"); }
  function pen(b) {
    if (!window.TERA_PAD || !TERA_PAD.pen) return;
    try { TERA_PAD.pen({ key: String(cur.id || "q"), onChange: function (on) { penOn = !!on; b.classList.toggle("is-on", !!on); } }); } catch (e) { }
  }

  /* ── 답안 번호판 + 안 푼 문항으로(묶음 풀이 전용. O·X 한 문장씩 넘기는 화면에는 쓰지 않는다) ── */
  var omrObj = null;
  function makeOmr(c0) {
    var el = d.createElement("aside"); el.className = "tq-omr"; c0.mount.appendChild(el); c0.mount.classList.add("has-omr");
    var jp = Q.jump(el, { count: 0, onClick: function () {
      var c = omrObj.cfg, n = c.total, from = c.cur();
      for (var k = 1; k <= n; k++) { var j = (from + k) % n; if (!c.answered(j)) { open(false); c.onJump(j); return; } }
    } });
    var rows = d.createElement("div"); el.appendChild(rows);
    function open(v) { el.classList.toggle("is-open", v == null ? !el.classList.contains("is-open") : v); }
    function draw() {
      var c = omrObj.cfg, n = c.total, un = 0, h = "";
      for (var j = 0; j < n; j++) {
        var an = c.answered(j); if (!an) un++;
        h += '<div class="tq-omr-row' + (j === c.cur() ? " is-now" : "") + (an ? "" : " is-todo") + '" data-j="' + j + '"><span class="tq-qn">' + (j + 1) + '번</span>';
        for (var k = 0; k < c.nChoices; k++) h += '<i' + (c.pick(j) === k ? ' class="is-on"' : "") + '>' + (k + 1) + '</i>';
        h += "</div>";
      }
      rows.innerHTML = h; jp.setCount(un);
    }
    rows.onclick = function (e) { var r = e.target.closest(".tq-omr-row"); if (!r) return; var j = +r.dataset.j; if (!omrObj.cfg.answered(j) && j !== omrObj.cfg.cur()) { open(false); omrObj.cfg.onJump(j); } };
    omrObj = { cfg: c0, draw: draw, toggle: open, el: el };
    return omrObj;
  }

  /* ── 문항을 그릴 때마다 ── */
  function q(o) {
    if (!Q) return;
    o = o || {}; cur = o; cur.answered = false; ensureBar(); d.body.classList.remove("tqs-off");
    hidePen(); Q.hide();
    var host = o.host || $("#stage") || d.body;
    /* 번호 줄 */
    [].forEach.call(d.querySelectorAll(".tq-meta,.tq-prog,.tq-exptabs"), function (x) { x.remove(); });
    var anchor = o.before || $(o.stem || ".qstem,.sent,.stem", host);
    if (anchor) {
      var prog = d.createElement("div"); prog.className = "tq-prog";
      var left = Math.max(0, (o.total || 0) - (o.no || 1) + 1);
      prog.innerHTML = o.total ? '<i><u style="width:' + Math.round(((o.no || 1) - 1) * 100 / Math.max(1, o.total)) + '%"></u></i><span><b>' + left + '</b>문제 남았어요</span>' : "";
      if (!o.total) prog.style.display = "none";
      var meta = d.createElement("div"); meta.className = "tq-meta";
      meta.innerHTML = '<span class="tq-no">' + (o.no || 1) + '번 문제</span><span class="tq-b"></span><span class="tq-sp"></span><span class="tq-src">' + esc(o.src || "") + '</span><span class="tq-tg"></span>';
      var top = o.metaAt || anchor;
      top.parentNode.insertBefore(prog, top); top.parentNode.insertBefore(meta, top);
      var st = stars(o.leaf); if (st) Q.badge(meta.querySelector(".tq-b"), { stars: st });
      Q.toggle(meta.querySelector(".tq-tg"));
    }
    /* 개념어 형광 띠 */
    var n = 0;
    (o.annotate || [".qstem", ".sent", ".stem", ".qdata", ".qpick .tx", ".opt"]).forEach(function (s) { n += Q.annotate(host.querySelectorAll ? Array.prototype.slice.call(host.querySelectorAll(s)) : []); });
    /* 아래 줄 */
    var pos = tool("pos"); pos.firstChild.textContent = (o.no || 1); pos.querySelector("small").textContent = o.total ? "/ " + o.total : "";
    tool("next").disabled = true; tool("prev").disabled = true; tool("next").textContent = (o.total && o.no >= o.total) ? "결과 ›" : "다음 ›";
    tool("exp").classList.remove("is-on");
    var hasConf = !!$("#conf"); cur.hasConf = hasConf; conf = "sure"; setConf("sure");
    tool("doubt").style.opacity = ""; bar.classList.toggle("tq-bar-omr", !!o.omrCfg);
    if (o.omrCfg) { if (!omrObj) makeOmr(o.omrCfg); omrObj.cfg = o.omrCfg; omrObj.draw(); cur.omr = omrObj; }
    /* 시간(머리 오른쪽) */
    if (o.timer !== false && window.TERRA && TERRA.진행표시) {
      if (!tick) { T0 = Date.now(); tick = setInterval(function () { var s = Math.floor((Date.now() - T0) / 1000); try { TERRA.진행표시(("0" + Math.floor(s / 60)).slice(-2) + ":" + ("0" + (s % 60)).slice(-2)); } catch (e) { } }, 1000); }
    }
    /* 첫 사용 안내 — 한 번에 하나 */
    setTimeout(function () {
      if (!cur || d.querySelector(".tq-coach")) return;
      var t1 = $(".tq-term");
      if (t1 && Q.coach(t1, { key: "term", title: "표시된 말을 누르면 뜻이 나와요", text: "번호 줄의 단추로 개념어 표시를 끌 수 있어요." })) return;
      if (!cur.answered && Q.coach(tool("doubt"), { key: "doubt", title: "헷갈리면 헷갈림을 눌러요", text: "누르면 반반이나 찍었어요를 고를 수 있어요." })) return;
      Q.coach(tool("pen"), { key: "pen", title: "펜을 누르면 문제 위에 바로 써요", text: "다시 누르면 필기가 끝나요." });
    }, 700);
    return n;
  }
  /* 채점한 뒤 */
  function done(o) {
    if (!cur) return; o = o || {}; cur.answered = true;
    bar.querySelector(".tq-doubt").hidden = true;
    tool("next").disabled = false; tool("exp").classList.add("is-on"); if (cur.omr) cur.omr.draw();
    var v = $(cur.expSel || ".verdict, #v .verdict");
    if (v && !v.previousElementSibling) { }
    if (v && !v.querySelector(".tq-ans") && o.answer) { var a = d.createElement("span"); a.className = "tq-ans"; a.textContent = "정답 : " + o.answer; v.appendChild(a); }
    if (v && !d.querySelector(".tq-exptabs")) {
      var t = d.createElement("div"); t.className = "tq-tabs tq-exptabs";
      t.innerHTML = '<button type="button" class="is-on">해설</button>' + (o.conceptHref ? '<a href="' + o.conceptHref + '">개념</a>' : "");
      v.parentNode.insertBefore(t, v);
    }
    Q.annotate(v ? [v] : []);
    if (o.next) cur.onNext = o.next;
  }
  function off() { d.body.classList.add("tqs-off"); if (bar) bar.style.display = "none"; }
  function on() { d.body.classList.remove("tqs-off"); if (bar) bar.style.display = ""; }

  if (Q) loadTerms();
  window.TQT = { q: q, done: done, off: off, on: on, isTop: isTop, loadTerms: loadTerms, hidePen: hidePen };
})();
