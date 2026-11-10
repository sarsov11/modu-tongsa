/* 모두의 대입 — 하루 공부 시간 단추 (화면표준 7절, 2026-11-10)
 *   과목 여섯 칩(통합사회·한국사·통합과학·수학·국어·영어) + 과목당 시간 단추 + 「고른 과목 3개 · 하루 합계 45분」
 *   같은 주소 아래 여섯 앱이 함께 쓰는 저장 키: tera_daeip_subjects(과목 id 배열) · tera_daeip_per_min(분)
 * 쓰는 법
 *   <script src="js/tera-daeip-time.js"></script>
 *   TERA_DAEIP.mount(요소, "tongsa", function(){ 바뀐 뒤 할 일 })
 *   TERA_DAEIP.perMin() · TERA_DAEIP.fmt(분) · TERA_DAEIP.subjects()
 */
(function () {
  if (window.TERA_DAEIP) return;
  var KS = "tera_daeip_subjects", KP = "tera_daeip_per_min", MAX = 480, DEF = 15;
  var OPTS = [15, 30, 45, 60, 90, 120];
  var SUBJ = [["tongsa", "통합사회"], ["hanguksa", "한국사"], ["tonggwa", "통합과학"], ["math", "수학"], ["gukeo", "국어"], ["english", "영어"]];
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { } return null; }
  function perMin() {
    var p = parseInt(ls(KP), 10);
    if (!(p >= OPTS[0])) return DEF;
    return Math.min(p, OPTS[OPTS.length - 1]);
  }
  function setPer(v) { ls(KP, String(v)); }
  function subjects(self) {
    var a = []; try { a = JSON.parse(ls(KS) || "[]"); } catch (e) { }
    if (!Array.isArray(a)) a = [];
    a = a.filter(function (x) { return SUBJ.some(function (s) { return s[0] === x; }); });
    if (self && a.indexOf(self) < 0) a.push(self);
    return a;
  }
  function save(a) { ls(KS, JSON.stringify(a)); }
  function fmt(m) {
    var h = Math.floor(m / 60), r = m % 60;
    return (h ? h + "시간" : "") + (h && r ? " " : "") + (r ? r + "분" : "");
  }
  function css() {
    if (document.getElementById("tdt-css")) return;
    var s = document.createElement("style"); s.id = "tdt-css";
    s.textContent = [
      ".tdt .lbl{font-size:13px;font-weight:700;color:var(--ink-3,#4B5563);margin:2px 0 8px}",
      ".tdt .chips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 16px}",
      ".tdt .chips button{height:34px;padding:0 14px;border-radius:999px;border:1px solid var(--line-2,#D3D7DD);background:var(--surface,#fff);color:var(--ink-2,#4B5563);font:700 14px/1 inherit;cursor:pointer}",
      ".tdt .chips button[aria-pressed=true]{border-color:transparent;background:var(--pt-soft,rgba(229,32,46,.10));color:var(--pt-ink,#B01822)}",
      ".tdt .chips button:disabled{cursor:default}.tdt .chips button.dim{opacity:.4}",
      ".tdt .per{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}",
      ".tdt .per button{height:44px;border-radius:12px;border:1.5px solid var(--line-2,#D3D7DD);background:var(--surface,#fff);color:var(--ink,#111419);font:700 15px/1 inherit;cursor:pointer}",
      ".tdt .per button[aria-pressed=true]{border-color:var(--pt,#E5202E);background:var(--pt-soft,rgba(229,32,46,.10));color:var(--pt-ink,#B01822)}",
      ".tdt .per button:disabled{opacity:.35;cursor:not-allowed}",
      ".tdt .sum{margin:14px 2px 0;font-size:14px;font-weight:800;color:var(--ink,#111419)}",
      ".tdt .sum span{display:block;margin-top:3px;font-size:12.5px;font-weight:600;color:var(--ink-3,#4B5563)}"
    ].join("");
    document.head.appendChild(s);
  }
  function mount(el, self, onchange) {
    if (!el) return; css();
    var cur = subjects(self);
    if (ls(KS) === null || JSON.stringify(cur) !== ls(KS)) save(cur);
    function draw() {
      var a = subjects(self), p = perMin(), n = a.length;
      el.className = (el.className + " tdt").replace(/(^| )tdt( tdt)+/, "$1tdt");
      el.innerHTML =
        '<div class="lbl">공부할 과목</div><div class="chips">' + SUBJ.map(function (s) {
          var on = a.indexOf(s[0]) >= 0, me = s[0] === self;
          var cant = me || (!on && p * (n + 1) > MAX);
          return '<button type="button" data-s="' + s[0] + '" aria-pressed="' + on + '"' + (cant ? ' disabled' : '') + (cant && !me ? ' class="dim"' : '') + '>' + s[1] + '</button>';
        }).join("") + '</div>' +
        '<div class="lbl">과목당 하루 시간</div><div class="per">' + OPTS.map(function (v) {
          return '<button type="button" data-p="' + v + '" aria-pressed="' + (v === p) + '"' + (v * n > MAX ? ' disabled' : '') + '>' + fmt(v) + '</button>';
        }).join("") + '</div>' +
        '<p class="sum">고른 과목 ' + n + '개 · 하루 합계 ' + fmt(p * n) + '<span>합계는 최대 8시간까지 고를 수 있습니다.</span></p>';
      el.querySelectorAll("[data-s]").forEach(function (b) {
        b.onclick = function () {
          var id = b.getAttribute("data-s"), x = subjects(self), i = x.indexOf(id);
          if (i >= 0) { if (id === self) return; x.splice(i, 1); } else { if (perMin() * (x.length + 1) > MAX) return; x.push(id); }
          save(x); draw(); if (onchange) onchange();
        };
      });
      el.querySelectorAll("[data-p]").forEach(function (b) {
        b.onclick = function () { var v = +b.getAttribute("data-p"); if (v * subjects(self).length > MAX) return; setPer(v); draw(); if (onchange) onchange(); };
      });
    }
    draw();
  }
  window.TERA_DAEIP = { mount: mount, perMin: perMin, setPer: setPer, subjects: subjects, fmt: fmt, OPTS: OPTS, MAX: MAX };
})();
