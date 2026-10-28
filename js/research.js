/* 연구 데이터 수집 — 테라러닝 공용 (2026-10-27)
 *
 * 김동호 교수 연구실 제안서(연구협력_김동호)에 적은 데이터를 실제로 모으는 곳.
 * 서비스 하나에 묶이지 않게 만들었다 — 다른 앱(모두의 기사·공시·중개사 …)도
 *   <script src="js/research.js" data-service="gisa"></script>
 * 한 줄을 싣고, 답할 때 RESEARCH.answer(...) 를 부르면 같은 형식으로 쌓인다.
 *
 * 무엇을 하나
 *   1) 사건을 한 건씩 기기 안 대기열(localStorage "terra.rs.q")에 쌓는다 — 동의와 상관없이 기기 안에만.
 *   2) 학생이 연구 참여에 동의했고(research.html) 서버(window.SUPA)가 켜져 있으면 대기열을 learn_events 로 올린다.
 *      동의하지 않으면 한 건도 밖으로 나가지 않는다. 서버 쪽 RLS 도 동의 없는 쓰기를 막는다(supabase/research.sql).
 *   3) 모두의 통사는 store.js 가 쏘는 "terra:ev"(답·훈련) 를 받아 그대로 옮긴다 — 화면을 고치지 않는다.
 *   4) <video> 는 화면 어디에 있든 재생·멈춤·되감기·끝까지 봄을 구간 단위로 적는다.
 *   5) 접속 시작·끝, 화면 열기, 대시보드(개념트리·학부모 리포트) 머문 시간을 적는다.
 *
 * ★ 학생 화면에는 "서버·업로드" 같은 말을 쓰지 않는다(auth.js 와 같은 원칙). 동의 화면에서만 무엇을 모으는지 적는다.
 * ★ 서버가 꺼져 있으면(supa.config.js 의 url 이 빈 값) 대기열만 쌓이고 사이트는 그대로 돈다.
 */
(function () {
  "use strict";
  var 대기열키 = "terra.rs.q", 동의키 = "terra.rs.consent", 기기키 = "terra.rs.dev", 배정키 = "terra.rs.arm";
  var 최대 = 5000;                   // 기기에 쌓아 두는 사건 수 상한 — 넘으면 오래된 것부터 버린다
  var 판 = "2026-10-27";            // 동의문 판 번호(research.html 과 같아야 한다)

  var 내스크립트 = document.currentScript;
  var 서비스 = (내스크립트 && 내스크립트.getAttribute("data-service")) ||
    ((document.querySelector('meta[name="terra-service"]') || {}).content) || "tongsa";

  function 읽기(k, 기본) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : 기본; } catch (e) { return 기본; } }
  function 쓰기(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  function 무작위(n) {
    var a = new Uint8Array(n || 8);
    try { crypto.getRandomValues(a); } catch (e) { for (var i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256); }
    return Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
  }
  var 기기 = 읽기(기기키, null);
  if (!기기) { 기기 = 무작위(8); 쓰기(기기키, 기기); }
  var 접속 = 무작위(6), 접속시작 = Date.now();

  /* ── 동의 ───────────────────────────────────────────── */
  function 동의상태() { return 읽기(동의키, null); }
  function 동의함() { var c = 동의상태(); return !!(c && c.agreed && !c.withdrawn && c.version === 판); }

  /* ── 대기열 ─────────────────────────────────────────── */
  /* 사건마다 eid(무작위 16자)를 단다 — 올리기가 성공했는데 응답만 끊겨 다시 올려도 서버가 같은 eid 를 한 번만 받는다 */
  var 맥락 = null;                    // 모의고사처럼 화면이 정한 맥락. answer 에 data.ctx 로 붙는다
  function log(kind, data, 겉) {
    var e = { eid: 무작위(8), kind: kind, at: new Date().toISOString(), service: 서비스, session: 접속, device: 기기, data: data || {} };
    if (겉) { if (겉.q != null) e.q = String(겉.q); if (겉.leaf != null) e.leaf = String(겉.leaf); if (겉.ok != null) e.ok = !!겉.ok; }
    if (맥락 && kind === "answer") e.data.ctx = 맥락;
    var q = 읽기(대기열키, []);
    q.push(e);
    if (q.length > 최대) {
      /* 오래 못 올려 상한을 넘으면 오래된 것부터 버리고, 버린 개수와 구간을 gap 사건으로 남긴다 — 빈 구간을 분석에서 알아보게 */
      var 앞 = q[0] && q[0].kind === "gap" ? q.shift() : null;      // 이미 버린 구간이 맨 앞에 있으면 합친다
      var 버림 = q.splice(0, q.length - 최대 + 1);
      var 수 = 버림.length + (앞 ? 앞.data.dropped : 0), 처음 = 앞 ? 앞.data.from : 버림[0].at;
      q.unshift({ eid: 앞 ? 앞.eid : 무작위(8), kind: "gap", at: 버림[버림.length - 1].at, service: 서비스, session: 접속, device: 기기,
                  data: { dropped: 수, from: 처음, to: 버림[버림.length - 1].at } });
    }
    쓰기(대기열키, q);
    곧올리기();
    return e;
  }

  /* 다른 앱이 부르는 문항 응답 — 형식을 한 곳에서 고정한다.
     opt = { pick, first, conf: "sure"|"half"|"guess", ms, attempt, leaf, ok } */
  function answer(qid, opt) {
    opt = opt || {};
    return log("answer", { p: opt.pick, p0: opt.first, c: opt.conf || null, ms: opt.ms || null, n: opt.attempt || 1 },
               { q: qid, leaf: opt.leaf, ok: opt.ok });
  }

  /* ── 실험 배정 — 같은 기기·같은 실험이면 늘 같은 조건 ──────────── */
  function 해시(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function arm(exp, arms) {
    var 표 = 읽기(배정키, {});
    if (표[exp] && arms.indexOf(표[exp]) >= 0) return 표[exp];
    var a = arms[해시(기기 + "|" + exp) % arms.length];
    표[exp] = a; 쓰기(배정키, 표);
    log("assign", { exp: exp, arm: a });
    return a;
  }

  /* ── 올리기 ─────────────────────────────────────────── */
  var C = window.SUPA, 켜짐 = !!(C && C.url && C.anon);
  var sb = null;
  function 클라이언트() {
    if (sb) return sb;
    if (켜짐 && window.supabase) sb = window.supabase.createClient(C.url, C.anon);
    return sb;
  }
  /* 로그인한 학생은 그 계정으로, 로그인 안 한 학생은 익명 계정으로 올린다(이름·이메일 없음). */
  function 사용자() {
    var c = 클라이언트(); if (!c) return Promise.resolve(null);
    return c.auth.getSession().then(function (r) {
      var s = r.data && r.data.session;
      if (s) return s;
      if (!c.auth.signInAnonymously) return null;
      return c.auth.signInAnonymously().then(function (r2) { return (r2.data && r2.data.session) || null; });
    }).catch(function () { return null; });
  }
  var 올리는중 = false, 예약 = null;
  function 곧올리기() { if (!예약) 예약 = setTimeout(function () { 예약 = null; flush(); }, 15000); }
  function flush() {
    if (올리는중 || !켜짐 || !동의함()) return Promise.resolve(0);
    /* 지금 동의한 시각보다 앞선 사건은 올리지 않고 버린다 — 동의 전·철회 뒤 쌓인 것은 연구에 쓰지 않는다 */
    var 부터 = Date.parse(동의상태().at), q = 읽기(대기열키, []);   // 서버 시각(+00:00)과 기기 시각(Z) 형식이 달라 숫자로 견준다
    var 거른 = q.filter(function (e) { return Date.parse(e.at) >= 부터; });
    if (거른.length !== q.length) { 쓰기(대기열키, 거른); q = 거른; }
    if (!q.length) return Promise.resolve(0);
    올리는중 = true;
    return 사용자().then(function (s) {
      if (!s) return 0;
      var 묶음 = q.slice(0, 500);
      var rows = 묶음.map(function (e) {
        return { eid: e.eid || 무작위(8), user_id: s.user.id, device: e.device, service: e.service, session: e.session, kind: e.kind,
                 at: e.at, q: e.q || null, leaf: e.leaf || null, ok: e.ok == null ? null : e.ok, data: e.data };
      });
      return 클라이언트().from("learn_events").upsert(rows, { onConflict: "eid", ignoreDuplicates: true }).then(function (r) {
        if (r.error) return 0;
        var 남은 = 읽기(대기열키, []);
        남은.splice(0, 묶음.length);           // 올리는 사이 새로 쌓인 것은 뒤에 남는다
        쓰기(대기열키, 남은);
        return 묶음.length;
      });
    }).catch(function () { return 0; }).then(function (n) { 올리는중 = false; return n; });
  }

  /* 동의·철회 — research.html 이 부른다. 서버 표에도 같은 내용을 적는다. */
  /* 로그인한 학생이 새 기기에서 열면 서버에 적힌 동의 상태를 기기로 받아 온다 — 기기마다 다시 동의하지 않아도 이어서 모이고,
     다른 기기에서 철회했으면 이 기기도 멈춘다. 로그인 안 한 학생은 동의가 기기에만 있다(익명 계정을 새로 만들지 않는다). */
  function 서버동의맞추기() {
    var c = 클라이언트(); if (!c) return Promise.resolve(null);
    return c.auth.getSession().then(function (r) {
      var s = r.data && r.data.session; if (!s) return null;
      return c.from("research_consents").select("*").eq("user_id", s.user.id).maybeSingle().then(function (r2) {
        var d = r2 && r2.data; if (!d) return null;
        var 서버시각 = d.withdrawn_at || d.agreed_at, 로컬 = 동의상태();
        if (!서버시각 || (로컬 && Date.parse(로컬.at) >= Date.parse(서버시각))) return d;      // 기기 쪽이 더 새롭다
        쓰기(동의키, { version: d.version, agreed: !!d.agreed && !d.withdrawn_at, withdrawn: !!d.withdrawn_at, at: 서버시각, scope: d.scope || {} });
        if (d.withdrawn_at) 쓰기(대기열키, []);
        return d;
      });
    }).catch(function () { return null; });
  }

  function consent(agreed, scope) {
    var c = { version: 판, agreed: !!agreed, withdrawn: !agreed, at: new Date().toISOString(), scope: scope || {} };
    쓰기(동의키, c);
    log("consent", { agreed: !!agreed, version: 판 });
    if (!agreed) 쓰기(대기열키, []);          // 철회하면 기기에 남은 대기분도 버린다
    if (!켜짐) return Promise.resolve(false);
    return 서버동의맞추기().then(function (d) {
      /* 같은 판에 이미 동의해 있는 계정이면(다른 기기에서 동의) 동의 시각을 새로 찍지 않는다 —
         새로 찍으면 서버 뷰가 그 시각 앞의 기록을 모두 숨긴다 */
      if (agreed && d && d.agreed && !d.withdrawn_at && d.version === 판) {
        c.at = d.agreed_at; 쓰기(동의키, c); return flush();
      }
      return 사용자().then(function (s) {
      if (!s) return false;
      var row = { user_id: s.user.id, version: 판, agreed: !!agreed, scope: c.scope };
      if (agreed) { row.agreed_at = c.at; row.withdrawn_at = null; } else row.withdrawn_at = c.at;
      return 클라이언트().from("research_consents").upsert(row, { onConflict: "user_id" }).then(function () {
        /* 동의 전에 적어 둔 배경은 기기에만 있었다 — 동의하는 순간 한 번 올린다 */
        var p = agreed && 읽기("terra.rs.profile", null);
        if (p) 표에쓰기("research_profiles", { age_band: p.age_band, status: p.status, purpose: p.purpose, updated_at: new Date().toISOString() }, "user_id");
        return flush();
      });
    });
    }).catch(function () { return false; });
  }

  /* 배경·시험 결과·설문 — 표가 따로 있다. 동의가 없으면 기기에만 남는다. */
  function 표에쓰기(표, row, 충돌) {
    if (!켜짐 || !동의함()) return Promise.resolve(false);
    return 사용자().then(function (s) {
      if (!s) return false;
      row.user_id = s.user.id;
      var t = 클라이언트().from(표);
      return (충돌 ? t.upsert(row, { onConflict: 충돌 }) : t.insert(row)).then(function (r) { return !r.error; });
    }).catch(function () { return false; });
  }
  function profile(p) { 쓰기("terra.rs.profile", p); log("profile", p); return 표에쓰기("research_profiles", { age_band: p.age_band, status: p.status, purpose: p.purpose, updated_at: new Date().toISOString() }, "user_id"); }
  function outcome(o) { log("outcome", o); return 표에쓰기("research_outcomes", { exam_key: o.exam_key, took: o.took, score: o.score, passed: o.passed, reported_at: new Date().toISOString() }, "user_id,exam_key"); }
  function survey(instrument, wave, answers) { log("survey", { instrument: instrument, wave: wave }); return 표에쓰기("research_surveys", { instrument: instrument, wave: wave, answers: answers }); }

  /* ── 자동 수집 ───────────────────────────────────────── */
  /* 1) 모두의 통사 — store.js 가 답·훈련 때마다 쏘는 사건을 받는다 */
  window.addEventListener("terra:ev", function (ev) {
    var d = ev.detail || {};
    if (d.k === "a") log("answer", { p: d.p, p0: d.p0, c: d.c || null, ms: d.ms || null, n: d.n || 1 }, { q: d.q, leaf: d.leaf, ok: d.ok });
    else if (d.k === "x") log("drill", { t: d.t, r: d.r || null }, { ok: d.ok });
    else if (d.k === "l") log("lecture", { lec: d.lec, m: d.m }, { leaf: d.lec });
  });

  /* 2) 영상 — 화면에 있는 <video> 를 따로 고치지 않고 문서에서 잡는다(재생 이벤트는 거품이 안 오르므로 capture) */
  var 구간 = new WeakMap();
  function 영상정보(v) { return { src: (v.currentSrc || v.src || "").replace(location.origin, ""), rate: v.playbackRate }; }
  function 구간닫기(v, how) {
    var g = 구간.get(v); if (!g) return;
    var 끝 = v.currentTime;
    if (끝 > g.from + 0.5) { var d = 영상정보(v); d.from = Math.round(g.from * 10) / 10; d.to = Math.round(끝 * 10) / 10; d.how = how; d.len = Math.round((v.duration || 0) * 10) / 10; log("video", d); }
    구간.delete(v);
  }
  document.addEventListener("play", function (e) { var v = e.target; if (v.tagName === "VIDEO") 구간.set(v, { from: v.currentTime }); }, true);
  document.addEventListener("pause", function (e) { var v = e.target; if (v.tagName === "VIDEO") 구간닫기(v, "pause"); }, true);
  document.addEventListener("ended", function (e) { var v = e.target; if (v.tagName === "VIDEO") 구간닫기(v, "ended"); }, true);
  document.addEventListener("seeking", function (e) {
    var v = e.target; if (v.tagName !== "VIDEO") return;
    var g = 구간.get(v);
    if (g) { var d = 영상정보(v); d.from = Math.round(g.from * 10) / 10; d.to = Math.round((v._rsLast || g.from) * 10) / 10; d.how = "seek"; d.jump = Math.round(v.currentTime * 10) / 10; log("video", d); 구간.set(v, { from: v.currentTime }); }
  }, true);
  document.addEventListener("timeupdate", function (e) { var v = e.target; if (v.tagName === "VIDEO" && !v.seeking) v._rsLast = v.currentTime; }, true);

  /* 3) 접속·화면·대시보드 */
  var 보인시간 = 0, 보인때 = document.visibilityState === "visible" ? Date.now() : null;
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") 보인때 = Date.now();
    else if (보인때) { 보인시간 += Date.now() - 보인때; 보인때 = null; flush(); }
  });
  var 이름 = location.pathname.split("/").pop() || "index.html";
  var 대시보드 = { "skilltree.html": "개념트리", "skills.html": "스킬", "parent.html": "학부모 리포트", "index.html": "홈" };
  서버동의맞추기();
  log("session", { how: "start" });
  log("page", { path: 이름, ref: (document.referrer || "").replace(location.origin, "") });
  window.addEventListener("pagehide", function () {
    if (보인때) { 보인시간 += Date.now() - 보인때; 보인때 = null; }
    var 초 = Math.round((Date.now() - 접속시작) / 1000), 본초 = Math.round(보인시간 / 1000);
    document.querySelectorAll("video").forEach(function (v) { if (!v.paused) 구간닫기(v, "leave"); });
    if (대시보드[이름]) log("view", { what: 대시보드[이름], sec: 본초 });
    log("session", { how: "end", sec: 초, vis: 본초 });
    flush();
  });

  /* ── 학습 기록 활용 동의 할인 (2026-10-27 대표님) ──
     동의하면 할인해 준다. 단 **할인한 값이 대표님이 정한 가격**이다 — 화면의 정가를 그만큼 올려 적는다.
     정가 = 정한 가격 ÷ (1 − 할인율)을 …900원으로 올린 값. 결제 화면은 RESEARCH.price(정한 가격) 하나만 부른다.
     ★ 동의하지 않아도 기능은 똑같다(개인정보 보호법 제16조 — 필요 이상 수집에 동의하지 않았다고 서비스를 거부하지 못한다).
       동의에는 할인만 붙고, 미동의에 불이익은 붙이지 않는다. */
  var 할인율 = 0.2;
  function 정가(정한값) { return Math.ceil((정한값 / (1 - 할인율) + 100) / 1000) * 1000 - 100; }
  function price(정한값) {
    var L = 정가(정한값), ok = 동의함();
    return { list: L, pay: ok ? 정한값 : L, off: L - 정한값, consented: ok };
  }

  window.RESEARCH = {
    version: 판, service: 서비스, device: 기기, price: price, listPrice: 정가,
    log: log, answer: answer, arm: arm, flush: flush,
    ctx: function (v) { 맥락 = v || null; },
    consent: consent, consented: 동의함, consentState: 동의상태,
    profile: profile, outcome: outcome, survey: survey,
    pending: function () { return 읽기(대기열키, []).length; },
    on: function () { return 켜짐; }
  };
})();
