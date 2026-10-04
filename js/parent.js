/* 학부모 리포트 — 계산 엔진 (2026-10-04 개편: 일간·주간 리포트, 마감·발송)
 *
 * ■ 무엇을 하나
 *   하루 공부에 **마감 시각**을 둔다(기본 24:00). 마감이 지난 하루를 **다음 날 아침**(기본 07:30)에
 *   일간 리포트로 보내고, 월~일 한 주는 **월요일 아침**에 주간 리포트로 보낸다.
 *   이 파일은 리포트를 **자료(JSON)** 로만 만든다. 그리는 것은 parent.html, 보내는 것은
 *   supabase/functions/parent-report 다. 자료로 만들어 두면 학부모 폰(링크)에서도 같은 리포트가 열린다.
 *
 * ■ 마감 시각의 뜻
 *   cut = 24 → 자정까지가 그날. cut = 26(새벽 2시) → 새벽 1시 공부는 전날로 센다.
 *   cut = 23 → 밤 11시 반 공부는 다음 날로 센다.
 *   사건의 날 = dayKey(at - (cut-24)시간). at 이 없는 옛 사건은 적힌 날(e.d) 그대로.
 *
 * ■ 지켜야 할 것
 *   ① 숫자를 지어내지 않는다. 모르면 「데이터 부족」.
 *   ② 보고만 한다 — 부탁·조언·위로 없음(2026-09-28 대표님 「학부모한텐 걍 니트하게 보고만 해」).
 *   ③ 한 리포트 안의 숫자는 한 집계에서 나온다 — 날마다 합 = 주간 합(학부모리포트_검사.py 가 본다).
 */
(function () {
  var W = typeof window !== "undefined" ? window : globalThis;
  var CFG_KEY = "terra.parentcfg";
  var GAP_CAP = 120000, FIRST_MS = 25000;          // store.js spentOn 과 같은 값
  var 요일 = ["일", "월", "화", "수", "목", "금", "토"];

  function T() { return W.TERRA; }
  function 설정() {
    var c = { cut: 24, send: "07:30" };
    try {
      var v = JSON.parse(localStorage.getItem(CFG_KEY) || "{}") || {};
      if (v.cut >= 21 && v.cut <= 28) c.cut = +v.cut;
      if (/^\d{2}:\d{2}$/.test(v.send || "")) c.send = v.send;
    } catch (e) {}
    return c;
  }
  function 설정저장(c) {
    var cur = 설정();
    if (c && c.cut != null) cur.cut = +c.cut;
    if (c && c.send) cur.send = c.send;
    try { localStorage.setItem(CFG_KEY, JSON.stringify(cur)); } catch (e) {}
    return cur;
  }

  /* ── 날짜 ── */
  function 키(d) { return T().dayKey(d); }
  function 날(k) { return new Date(k + "T12:00:00"); }
  function 더하기(k, n) { var d = 날(k); d.setDate(d.getDate() + n); return 키(d); }
  function 월요일(k) { var d = 날(k); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return 키(d); }
  function 시각말(h) { h = ((h % 24) + 24) % 24; return (h < 10 ? "0" : "") + h + ":00"; }
  function 마감말(cut) { return cut === 24 ? "24:00" : (cut > 24 ? "다음 날 " + 시각말(cut) : 시각말(cut)); }
  function 보고일(e, cut) {
    if (e && e.at) return 키(new Date(e.at - (cut - 24) * 3600000));
    return e.d;
  }
  /* 지금 진행 중인 날 — 마감 전이면 오늘(혹은 전날) */
  function 지금날(cut, now) { return 보고일({ at: (now || new Date()).getTime() }, cut); }
  /* 마감이 지나 닫힌 가장 최근 날 */
  function 닫힌날(cut, now) { return 더하기(지금날(cut, now), -1); }
  /* 그 리포트가 나가는 시각 — 일간은 다음 날 아침, 주간은 그 주 다음 월요일 아침 */
  function 발송(kind, k, cfg) {
    var d = kind === "week" ? 더하기(k, 7) : 더하기(k, 1);
    return { day: d, at: cfg.send };
  }

  /* ── 하루 묶음: 보고일 → 사건들 ── */
  function 묶기(cut) {
    var by = {};
    (T().state().ev || []).forEach(function (e) {
      var k = 보고일(e, cut); if (!k) return;
      (by[k] = by[k] || []).push(e);
    });
    return by;
  }
  function 하루(evs) {
    var a = 0, o = 0, x = 0, lec = 0, ms = 0, ts = [], 처음 = null, 끝 = null;
    (evs || []).forEach(function (e) {
      if (e.k === "a") { a++; if (e.ok) o++; ts.push(e); }
      else if (e.k === "x") { x++; ts.push(e); }
      else if (e.k === "l") lec += (e.m || 0);
      if (e.at) { if (처음 == null || e.at < 처음) 처음 = e.at; if (끝 == null || e.at > 끝) 끝 = e.at; }
    });
    ts.sort(function (p, q) { return (p.at || 0) - (q.at || 0); });
    var prev = null;
    ts.forEach(function (e) {
      var gap = prev == null ? null : (e.at || 0) - (prev.at || 0);
      if (gap != null && gap >= 0 && gap <= GAP_CAP && e.at && prev.at) ms += gap;
      else ms += Math.min(e.ms || FIRST_MS, 90000);
      prev = e;
    });
    return { ans: a, ok: o, drills: x, solved: a + x, min: Math.round(ms / 60000) + lec,
             first: 처음, last: 끝 };
  }
  function 시분(at) {
    if (!at) return "";
    var d = new Date(at), h = d.getHours(), m = d.getMinutes();
    return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
  }

  /* ── 대영역별 문제풀이 (그 기간 사건) ── */
  function 대영역별(evs) {
    var t = T(), m = {};
    evs.forEach(function (e) {
      if (e.k !== "a" || !e.leaf) return;
      var r = String(e.leaf).charAt(0), R = t.BY[r];
      if (!R) return;
      var x = m[r] = m[r] || { name: R.name, ans: 0, ok: 0 };
      x.ans++; if (e.ok) x.ok++;
    });
    return Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return b.ans - a.ans; });
  }

  /* ── 시험 범위 진도: 그 날 마감까지의 누적(문항마다 마지막 풀이) ──
     지금 범위·지금 문항 수 기준이다. 범위를 바꾸면 지난 리포트도 새 범위로 다시 계산된다(링크로 보낸 것은 그때 값 그대로). */
  function 범위진도(끝날, cut) {
    var t = T();
    if (!t.scopeOn()) return null;
    var 마지막 = {};
    (t.state().ev || []).forEach(function (e) {
      if (e.k !== "a" || !e.q || !e.leaf) return;
      if (보고일(e, cut) > 끝날) return;
      var p = 마지막[e.q];
      if (!p || (e.at || 0) >= (p.at || 0)) 마지막[e.q] = { leaf: e.leaf, ok: !!e.ok, at: e.at || 0 };
    });
    var 리프푼 = {}, 밖 = { n: 0, names: [] }, 밖이름 = {};
    Object.keys(마지막).forEach(function (q) {
      var v = 마지막[q];
      if (!t.BY[v.leaf]) return;
      if (t.inScopeLeaf(v.leaf)) {
        var r = 리프푼[v.leaf] = 리프푼[v.leaf] || { s: 0, c: 0 };
        r.s++; if (v.ok) r.c++;
      } else {
        밖.n++;
        var R = t.BY[String(v.leaf).charAt(0)];
        if (R && !밖이름[R.name]) { 밖이름[R.name] = 1; 밖.names.push(R.name); }
      }
    });
    var groups = [], 합 = { play: 0, solved: 0, correct: 0 };
    t.ROOTS.forEach(function (R) {
      var rows = [];
      R.mids.forEach(function (m) {
        var a = { play: 0, solved: 0, correct: 0 }, 있음 = false;
        m.leaves.forEach(function (l) {
          if (!t.inScopeLeaf(l.code)) return;
          있음 = true;
          a.play += (l.play || []).length;
          var r = 리프푼[l.code]; if (r) { a.solved += r.s; a.correct += r.c; }
        });
        if (!있음 || !a.play) return;
        a.solved = Math.min(a.solved, a.play);
        var 심 = /\u2605/.test(m.name);
        rows.push({ name: String(m.name).replace(/\s*\u2605\s*심화|\s*\u2605/g, ""), deep: 심,
                    play: a.play, solved: a.solved, correct: a.correct });
        합.play += a.play; 합.solved += a.solved; 합.correct += a.correct;
      });
      if (rows.length) groups.push({ name: R.name, rows: rows });
    });
    return { play: 합.play, solved: 합.solved, correct: 합.correct, groups: groups, outside: 밖,
             scope: t.scopeName() };
  }

  function 학생() {
    var t = T(), st = t.state().student || {};
    return { name: st.name || "", grade: st.grade || "고1" };
  }
  function 시험(기준날) {
    var t = T(), 시 = t.nextExam ? t.nextExam() : null;
    if (!시 || !시.exam) return null;
    var e = 시.exam, dd = null;
    if (e.date) dd = Math.round((날(e.date) - 날(기준날)) / 86400000);
    return { name: e.name, date: e.date || "", dday: dd };
  }
  function 모의(from, to) {
    var lg = (W.TERRA_EXAM && W.TERRA_EXAM.log) ? W.TERRA_EXAM.log() : [];
    var 안 = lg.filter(function (r) { var k = String(r.day || "").slice(0, 10); return k >= from && k <= to; });
    var 누 = lg.filter(function (r) { return String(r.day || "").slice(0, 10) <= to; });
    return { in: 안.map(function (r) { return { day: String(r.day).slice(0, 10), pct: r.pct }; }),
             all: 누.length,
             avg: 누.length ? Math.round(누.reduce(function (s, r) { return s + r.pct; }, 0) / 누.length) : null,
             best: 누.length ? Math.max.apply(null, 누.map(function (r) { return r.pct; })) : null };
  }
  function 연속(by, 끝날) {
    var n = 0, k = 끝날;
    while (by[k] && 하루(by[k]).solved + 하루(by[k]).min > 0) { n++; k = 더하기(k, -1); }
    return n;
  }

  /* ══ 일간 리포트 ══ */
  function 일간(k, cfg) {
    cfg = cfg || 설정();
    k = k || 닫힌날(cfg.cut);
    var by = 묶기(cfg.cut), evs = by[k] || [];
    var d = 하루(evs), p = 하루(by[더하기(k, -1)] || []);
    var 주 = []; for (var i = 6; i >= 0; i--) { var kk = 더하기(k, -i); var h = 하루(by[kk] || []); 주.push({ d: kk, wd: 요일[날(kk).getDay()], solved: h.solved, min: h.min }); }
    return {
      kind: "day", v: 1, day: k, wd: 요일[날(k).getDay()], cut: cfg.cut, send: 발송("day", k, cfg),
      student: 학생(), exam: 시험(k),
      min: d.min, ans: d.ans, ok: d.ok, drills: d.drills, solved: d.solved,
      first: 시분(d.first), last: 시분(d.last),
      prev: { min: p.min, ans: p.ans, ok: p.ok, solved: p.solved },
      week: 주, streak: 연속(by, k),
      roots: 대영역별(evs), cov: 범위진도(k, cfg.cut), mock: 모의(k, k),
      made: Date.now()
    };
  }

  /* ══ 주간 리포트 — 월~일 ══ */
  function 주간(월, cfg) {
    cfg = cfg || 설정();
    if (!월) 월 = 더하기(월요일(지금날(cfg.cut)), -7);      // 지난주(닫힌 주)
    월 = 월요일(월);
    var 일 = 더하기(월, 6), by = 묶기(cfg.cut), evs = [], days = [], 합 = { min: 0, ans: 0, ok: 0, drills: 0, solved: 0 };
    for (var i = 0; i < 7; i++) {
      var k = 더하기(월, i), h = 하루(by[k] || []);
      evs = evs.concat(by[k] || []);
      days.push({ d: k, wd: 요일[날(k).getDay()], solved: h.solved, ans: h.ans, ok: h.ok, min: h.min });
      합.min += h.min; 합.ans += h.ans; 합.ok += h.ok; 합.drills += h.drills; 합.solved += h.solved;
    }
    var 전 = { min: 0, ans: 0, ok: 0, solved: 0 };
    for (var j = 1; j <= 7; j++) { var h2 = 하루(by[더하기(월, -j)] || []); 전.min += h2.min; 전.ans += h2.ans; 전.ok += h2.ok; 전.solved += h2.solved; }
    var cov = 범위진도(일, cfg.cut), cov0 = 범위진도(더하기(월, -1), cfg.cut);
    return {
      kind: "week", v: 1, from: 월, to: 일, cut: cfg.cut, send: 발송("week", 월, cfg),
      student: 학생(), exam: 시험(일),
      min: 합.min, ans: 합.ans, ok: 합.ok, drills: 합.drills, solved: 합.solved,
      active: days.filter(function (x) { return x.solved + x.min > 0; }).length,
      streak: 연속(by, 일),
      prev: 전, days: days, roots: 대영역별(evs),
      cov: cov, covPrev: cov0 ? cov0.solved : null,
      mock: 모의(월, 일), made: Date.now()
    };
  }

  /* 알림 한 줄 — 푸시·문자 본문. 보고만 한다 */
  function 한줄(r) {
    var 이름 = (r.student && r.student.name) || "학생";
    var 정 = r.ans ? Math.round(r.ok / r.ans * 100) + "%" : "-";
    if (r.kind === "week") {
      var a = 날(r.from), b = 날(r.to);
      return { t: 이름 + " 주간 리포트 " + (a.getMonth() + 1) + "/" + a.getDate() + "~" + (b.getMonth() + 1) + "/" + b.getDate(),
               b: "학습 " + r.active + "일, " + r.min + "분, " + r.solved + "문항, 정답률 " + 정 };
    }
    var d = 날(r.day);
    if (!r.solved && !r.min) return { t: 이름 + " " + (d.getMonth() + 1) + "/" + d.getDate() + "(" + r.wd + ") 일간 리포트", b: "학습 기록 없음" };
    return { t: 이름 + " " + (d.getMonth() + 1) + "/" + d.getDate() + "(" + r.wd + ") 일간 리포트",
             b: r.min + "분, " + r.solved + "문항, 정답률 " + 정 };
  }

  /* 서버에 올릴 묶음 — 최근 닫힌 이틀 + 진행 중인 오늘, 지난주 + 이번 주.
     마감 뒤 사건은 다음 날로 가므로, 마지막으로 올린 값이 곧 그날의 최종값이다. */
  function 스냅샷() {
    var cfg = 설정(), 오늘 = 지금날(cfg.cut), 월 = 월요일(오늘);
    return [일간(더하기(오늘, -2), cfg), 일간(더하기(오늘, -1), cfg), 일간(오늘, cfg),
            주간(더하기(월, -7), cfg), 주간(월, cfg)];
  }

  W.PARENT = {
    설정: 설정, 설정저장: 설정저장, 마감말: 마감말,
    지금날: 지금날, 닫힌날: 닫힌날, 월요일: 월요일, 더하기: 더하기, 발송: 발송,
    일간: 일간, 주간: 주간, 한줄: 한줄, 스냅샷: 스냅샷,

    /* ── 옛 문구 함수 — 검사기(학부모리포트_검사.py ②)가 빈 기록일 때 지어낸 숫자가 없는지 본다 ── */
    streakSay: function (연속, 최근7) {
      if (연속 >= 2) return { t: 연속 + "일 연속", d: "최근 7일 중 " + 최근7 + "일" };
      if (최근7 >= 1) return { t: "최근 7일 중 " + 최근7 + "일", d: "" };
      return { t: "최근 7일 학습 0일", d: "" };
    },
    scoreSay: function (푼문항, 정답률, 회차평균) {
      if (푼문항 < 30) return { t: "데이터 부족", d: "푼 문항 " + 푼문항 + "개", tone: "wait" };
      if (회차평균 != null) return { t: "모의고사 평균 " + Math.round(회차평균) + "점", d: "25문항, 100점 만점", tone: "ok" };
      return { t: "정답률 " + Math.round(정답률) + "%", d: "푼 문항 " + 푼문항 + "개 기준, 모의고사 기록 없음", tone: "ok" };
    }
  };
})();
