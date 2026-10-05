/* 학부모 리포트 — 계산 엔진 (2026-10-05 2차 개편)
 *
 * ■ 대표님 지시(2026-10-05)
 *   「학부모가 궁금해하는 걸 알려줘. 궁금해하지도 않을 문항 수 이런 거 말고. 정답률 정도는 알려줄 수 있음.」
 *   일간: 총 학습 시간(과목별로도) · 성취도 증가 추이 · 눈에 띄는 포인트
 *         (반응 속도·집중력, 어려웠던 단원을 제대로 해결했는지)
 *   주간: 내신·모의고사 예상 등급 변화 추이 · 시험마다 추이 그래프 · 원인 분석 · 앞으로의 푸시 방향
 *   \u2605 2026-09-28 「보고만 해」는 이 지시로 바뀌었다 — 원인 분석과 **서비스가 다음 주에 밀어줄 방향**은 쓴다.
 *     부모에게 무엇을 해 달라는 부탁은 여전히 쓰지 않는다(학부모리포트_검사.py ③).
 *
 * ■ 마감·발송 (2026-10-04)
 *   하루 공부에 마감 시각(cut, 기본 24시)을 둔다. 사건의 날 = dayKey(at - (cut-24)시간).
 *   일간 = 마감이 지난 하루 → 다음 날 아침(기본 07:30). 주간 = 월~일 → 월요일 아침.
 *   이 파일은 리포트를 **자료(JSON)** 로만 만든다. 그리기 parent.html, 보내기 supabase/functions/parent-report.
 *
 * ■ 성취도 — 사이트의 이해도(store.js 이해도)를 **그날 마감 시점으로 다시 센 것**
 *   리프 이해도 = min(1, 빠르기 가중 맞힌 문항 / 목표) × 정답률 × 100, 목표 = min(10, max(4, 문항×0.35)).
 *   빠르게 맞힌 것 1, 보통·모름 0.85, 느린 것 0.6(객관식 25초·45초 경계, store.js 반응대).
 *   성취도 = 대상 리프(시험 범위, 없으면 그 학년에 보이는 대영역) 이해도의 평균.
 *   \u2605 O·X 기록은 시각이 없어 넣지 않는다 — 홈 화면 이해도와 몇 점 다를 수 있다.
 *
 * ■ 예상 등급 — store.js forecast()·bandOf() 와 같은 식(가늠). 표본 30문항 미만이면 내지 않는다.
 */
(function () {
  var W = typeof window !== "undefined" ? window : globalThis;
  var CFG_KEY = "terra.parentcfg";
  var GAP_CAP = 120000, FIRST_MS = 25000, 이음 = 300000;    // 5분 넘게 쉬면 다른 공부 덩어리
  var 요일 = ["일", "월", "화", "수", "목", "금", "토"];
  var BANDS = [[90, 1], [78, 2], [62, 3], [45, 4], [0, 5]];  // store.js bandOf 와 같다
  /* 훈련 종류 → 대영역(과목 가르기용) */
  var 훈련영역 = { power: "F", rights: "F", consti: "F", consticase: "F", labor: "H", laborcase: "H",
                   econ: "H", econcase: "H", justice: "G", disobey: "G", thinker: "K", climate: "J", peace: "I" };

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
  function 보고일(e, cut) { return (e && e.at) ? 키(new Date(e.at - (cut - 24) * 3600000)) : e.d; }
  function 지금날(cut, now) { return 보고일({ at: (now || new Date()).getTime() }, cut); }
  function 닫힌날(cut, now) { return 더하기(지금날(cut, now), -1); }
  function 발송(kind, k, cfg) { return { day: kind === "week" ? 더하기(k, 7) : 더하기(k, 1), at: cfg.send }; }
  function 시분(at) { if (!at) return ""; var d = new Date(at); return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2); }

  /* ── 사건 → 과목(fam: 윤리·지리·일반사회) ── */
  function 영역(e) {
    var t = T(), c = "";
    if (e.k === "a" && e.leaf) c = String(e.leaf).charAt(0);
    else if (e.k === "x") c = 훈련영역[e.t] || "";
    else if (e.k === "l" && e.lec) c = String(e.lec).charAt(0);
    return t.BY[c] && t.BY[c].mids ? c : "";
  }
  function 과목(e) { var c = 영역(e); return c ? (T().BY[c].fam || "기타") : "기타"; }

  /* ── 날별 묶음 ── */
  function 묶기(cut) {
    var by = {};
    (T().state().ev || []).forEach(function (e) {
      var k = 보고일(e, cut); if (!k) return;
      (by[k] = by[k] || []).push(e);
    });
    return by;
  }
  /* 하루(혹은 여러 날) 사건 → 시간·과목별 시간·정답률·속도·집중 */
  function 재기(evs) {
    var a = 0, o = 0, x = 0, lec = 0, ms = 0, fam = {}, ts = [], 처음 = null, 끝 = null, 속도 = [];
    (evs || []).forEach(function (e) {
      if (e.k === "a") { a++; if (e.ok) o++; ts.push(e); if (e.ms) 속도.push(e.ms); }
      else if (e.k === "x") { x++; ts.push(e); }
      else if (e.k === "l") { lec += (e.m || 0); var f = 과목(e); fam[f] = (fam[f] || 0) + (e.m || 0) * 60000; }
      if (e.at) { if (처음 == null || e.at < 처음) 처음 = e.at; if (끝 == null || e.at > 끝) 끝 = e.at; }
    });
    ts.sort(function (p, q) { return (p.at || 0) - (q.at || 0); });
    var prev = null, 덩어리 = 0, 최장 = 0, 덩시작 = null;
    ts.forEach(function (e) {
      var gap = prev == null ? null : (e.at || 0) - (prev.at || 0), add;
      if (gap != null && gap >= 0 && gap <= GAP_CAP && e.at && prev.at) add = gap;
      else add = Math.min(e.ms || FIRST_MS, 90000);
      ms += add;
      var f = 과목(e); fam[f] = (fam[f] || 0) + add;
      /* 집중 — 5분 넘게 쉬지 않고 이어 간 가장 긴 덩어리 */
      if (prev == null || gap == null || gap > 이음 || !e.at || !prev.at) { 덩어리 = add; 덩시작 = e.at; }
      else 덩어리 += add;
      if (덩어리 > 최장) 최장 = 덩어리;
      prev = e;
    });
    /* 전반·후반 정답률 — 문제풀이 사건을 시간순으로 반 가른다 */
    var qs = ts.filter(function (e) { return e.k === "a"; }), h = Math.floor(qs.length / 2);
    var 전 = qs.slice(0, h), 후 = qs.slice(h);
    function 률(l) { return l.length ? Math.round(l.filter(function (e) { return e.ok; }).length / l.length * 100) : null; }
    속도.sort(function (p, q) { return p - q; });
    var 중앙 = 속도.length ? 속도[Math.floor(속도.length / 2)] : null;
    var 느림 = 속도.length ? Math.round(속도.filter(function (v) { return v >= 45000; }).length / 속도.length * 100) : null;
    var 과목분 = Object.keys(fam).map(function (k) { return { name: k, min: Math.round(fam[k] / 60000) }; })
      .filter(function (x) { return x.min > 0; }).sort(function (p, q) { return q.min - p.min; });
    return { min: Math.round(ms / 60000) + lec, ans: a, ok: o, drills: x, fam: 과목분,
             pct: a ? Math.round(o / a * 100) : null, first: 처음, last: 끝,
             speed: { med: 중앙, slow: 느림, n: 속도.length },
             focus: { longest: Math.round(최장 / 60000), front: 률(전), back: 률(후), n: qs.length } };
  }

  /* ── 대상 리프: 시험 범위, 없으면 그 학년에 보이는 대영역 ── */
  function 대상리프() {
    var t = T(), out = [];
    var 보임 = {}; (t.보이는대영역 ? t.보이는대영역() : t.ROOTS).forEach(function (r) { 보임[r.code] = 1; });
    t.LEAVES.forEach(function (l) {
      if (!(l.play || []).length) return;
      if (t.scopeOn()) { if (t.inScopeLeaf(l.code)) out.push(l); }
      else if (보임[String(l.code).charAt(0)]) out.push(l);
    });
    return out;
  }
  function 속도무게(ms) { return ms == null ? 0.85 : ms < 25000 ? 1 : ms < 45000 ? 0.85 : 0.6; }
  /* 그날 마감까지 문항마다 마지막 풀이 → 리프별 이해도 */
  function 상태(끝날, cut, 대상) {
    var 마지막 = {};
    (T().state().ev || []).forEach(function (e) {
      if (e.k !== "a" || !e.q || !e.leaf) return;
      if (보고일(e, cut) > 끝날) return;
      var p = 마지막[e.q];
      if (!p || (e.at || 0) >= (p.at || 0)) 마지막[e.q] = e;
    });
    var 리프 = {};
    Object.keys(마지막).forEach(function (q) {
      var e = 마지막[q], r = 리프[e.leaf] = 리프[e.leaf] || { n: 0, ok: 0, w: 0 };
      r.n++; if (e.ok) { r.ok++; r.w += 속도무게(e.ms); }
    });
    var 합 = 0, 풀 = 0, 맞 = 0, 리프값 = {};
    대상.forEach(function (l) {
      var r = 리프[l.code] || { n: 0, ok: 0, w: 0 };
      var 목표 = Math.min(10, Math.max(4, Math.round(l.play.length * 0.35)));
      var v = r.n ? Math.round(Math.min(1, r.w / 목표) * (r.ok / r.n) * 100) : 0;
      리프값[l.code] = v; 합 += v; 풀 += r.n; 맞 += r.ok;
    });
    return { ach: 대상.length ? Math.round(합 / 대상.length) : 0, leaf: 리프값, raw: 리프,
             solved: 풀, pct: 풀 ? Math.round(맞 / 풀 * 100) : null };
  }
  /* 중영역(단원)별 이해도 평균 */
  function 단원값(st, 대상) {
    var t = T(), m = {};
    대상.forEach(function (l) {
      var mc = l.mid && l.mid.code ? l.mid.code : (t.BY[l.code].mid || {}).code;
      if (!mc) return;
      var x = m[mc] = m[mc] || { code: mc, sum: 0, n: 0, solved: 0 };
      x.sum += st.leaf[l.code] || 0; x.n++; x.solved += (st.raw[l.code] || { n: 0 }).n;
    });
    return Object.keys(m).map(function (k) {
      var x = m[k], M = t.BY[k];
      return { code: k, name: String(M.name).replace(/\s*\u2605\s*심화|\s*\u2605/g, ""), root: (t.BY[k.charAt(0)] || {}).name || "",
               v: Math.round(x.sum / x.n), solved: x.solved, wt: M.wt || 1 };
    });
  }
  function bandOf(p) { if (p == null) return null; for (var i = 0; i < BANDS.length; i++) if (p >= BANDS[i][0]) return BANDS[i][1]; return 5; }
  /* 예상 등급 — forecast() 와 같은 식: 누적 정답률 0.6 + 최근 7일 0.4 + 기울기 0.35 */
  function 예상(끝날, cut, 대상, by) {
    var st = 상태(끝날, cut, 대상);
    if (st.solved < 30) return { pct: null, band: null, solved: st.solved };
    function 주률(끝) {
      var a = 0, o = 0;
      for (var i = 0; i < 7; i++) (by[더하기(끝, -i)] || []).forEach(function (e) { if (e.k === "a") { a++; if (e.ok) o++; } });
      return a ? o / a * 100 : null;
    }
    var 최근 = 주률(끝날), 전 = 주률(더하기(끝날, -7));
    var 기울기 = (최근 != null && 전 != null) ? 최근 - 전 : 0;
    var base = 최근 != null ? st.pct * 0.6 + 최근 * 0.4 : st.pct;
    var proj = Math.max(20, Math.min(97, Math.round(base + 기울기 * 0.35)));
    return { pct: proj, band: bandOf(proj), cum: st.pct, recent: 최근 == null ? null : Math.round(최근), solved: st.solved };
  }

  /* ── 어려웠던 문항을 제대로 해결했나: 그 기간에 다시 푼 「전에 틀린 문항」 ── */
  function 재도전(from, to, cut) {
    var t = T(), 틀림 = {}, 시도 = 0, 해결 = 0, 단원 = {};
    var ev = (t.state().ev || []).slice().sort(function (p, q) { return (p.at || 0) - (q.at || 0); });
    var 본 = {};
    ev.forEach(function (e) {
      if (e.k !== "a" || !e.q) return;
      var k = 보고일(e, cut);
      if (k < from) { if (!e.ok) 틀림[e.q] = 1; else delete 틀림[e.q]; return; }
      if (k > to) return;
      if (틀림[e.q] && !본[e.q]) {
        본[e.q] = 1; 시도++;
        if (e.ok) {
          해결++;
          var M = t.BY[e.leaf] && t.BY[e.leaf].mid;
          var nm = M ? String(M.name).replace(/\s*\u2605\s*심화|\s*\u2605/g, "") : "";
          if (nm) 단원[nm] = (단원[nm] || 0) + 1;
        }
      }
      if (!e.ok) 틀림[e.q] = 1;
    });
    return { tried: 시도, solved: 해결,
             units: Object.keys(단원).sort(function (p, q) { return 단원[q] - 단원[p]; }).slice(0, 3) };
  }

  function 학생() { var st = T().state().student || {}; return { name: st.name || "", grade: st.grade || "고1" }; }
  function 시험(기준날) {
    var t = T(), 시 = t.nextExam ? t.nextExam() : null;
    if (!시 || !시.exam) return null;
    var e = 시.exam;
    return { name: e.name, date: e.date || "", dday: e.date ? Math.round((날(e.date) - 날(기준날)) / 86400000) : null };
  }
  function 모의목록(to) {
    var lg = (W.TERRA_EXAM && W.TERRA_EXAM.log) ? W.TERRA_EXAM.log() : [];
    return lg.filter(function (r) { return String(r.day || "").slice(0, 10) <= to; })
      .map(function (r) { return { day: String(r.day).slice(0, 10), pct: r.pct, band: bandOf(r.pct) }; });
  }
  function 연속(by, 끝날) {
    var n = 0, k = 끝날;
    while (by[k] && 재기(by[k]).min > 0) { n++; k = 더하기(k, -1); }
    return n;
  }

  /* ══ 일간 리포트 ══ */
  function 일간(k, cfg) {
    cfg = cfg || 설정();
    k = k || 닫힌날(cfg.cut);
    var by = 묶기(cfg.cut), 대상 = 대상리프();
    var d = 재기(by[k] || []), p = 재기(by[더하기(k, -1)] || []);
    /* 최근 7일 학습 시간·속도 기준값 */
    var 이전evs = []; for (var i = 1; i <= 7; i++) 이전evs = 이전evs.concat(by[더하기(k, -i)] || []);
    var 기준 = 재기(이전evs);
    /* 성취도 추이 — 최근 14일 마감 시점 */
    var 추이 = [];
    for (var j = 13; j >= 0; j--) { var kk = 더하기(k, -j); 추이.push({ d: kk, v: 상태(kk, cfg.cut, 대상).ach, min: 재기(by[kk] || []).min }); }
    var 오늘st = 상태(k, cfg.cut, 대상), 어제st = 상태(더하기(k, -1), cfg.cut, 대상);
    /* 이해도가 크게 오른 단원 · 아직 막힌 단원(이날 풀었는데 이해도 40 미만) */
    var u1 = 단원값(오늘st, 대상), u0 = 단원값(어제st, 대상), 전값 = {};
    u0.forEach(function (x) { 전값[x.code] = x.v; });
    var 오른 = u1.map(function (x) { return { name: x.name, from: 전값[x.code] || 0, to: x.v }; })
      .filter(function (x) { return x.to - x.from >= 5; }).sort(function (a, b) { return (b.to - b.from) - (a.to - a.from); }).slice(0, 3);
    var 이날리프 = {}; (by[k] || []).forEach(function (e) { if (e.k === "a" && e.leaf && T().BY[e.leaf] && T().BY[e.leaf].mid) 이날리프[T().BY[e.leaf].mid.code] = 1; });
    var 막힌 = u1.filter(function (x) { return 이날리프[x.code] && x.v < 40; }).sort(function (a, b) { return a.v - b.v; }).slice(0, 2)
      .map(function (x) { return { name: x.name, v: x.v }; });
    var r = {
      kind: "day", v: 2, day: k, wd: 요일[날(k).getDay()], cut: cfg.cut, send: 발송("day", k, cfg),
      student: 학생(), exam: 시험(k),
      min: d.min, fam: d.fam, prevMin: p.min, avgMin: Math.round(기준.min / 7),
      first: 시분(d.first), last: 시분(d.last), streak: 연속(by, k),
      ach: { now: 오늘st.ach, prev: 어제st.ach, series: 추이 },
      pct: d.pct, prevPct: p.pct, ans: d.ans, ok: d.ok,
      speed: { med: d.speed.med, base: 기준.speed.med, slow: d.speed.slow, baseSlow: 기준.speed.slow, n: d.speed.n },
      focus: d.focus, fix: 재도전(k, k, cfg.cut), rise: 오른, stuck: 막힌,
      made: Date.now()
    };
    r.points = 포인트(r);
    return r;
  }
  /* 눈에 띄는 포인트 — 사실에서만 만든다. tone: up(좋아짐) · dn(살필 것) · eq */
  function 포인트(r) {
    var out = [];
    if (!r.min) return [{ tone: "eq", tag: "학습", text: "이날 학습 기록 없음" }];
    var s = r.speed;
    if (s.med != null && s.n >= 5) {
      var 초 = Math.round(s.med / 1000), 기 = s.base != null ? Math.round(s.base / 1000) : null;
      if (기 != null && Math.abs(초 - 기) >= 3)
        out.push({ tone: 초 < 기 ? "up" : "dn", tag: "반응 속도", text: "문항당 " + 초 + "초, 최근 7일 평균 " + 기 + "초보다 " + (초 < 기 ? "빨라짐" : "느려짐") });
      else out.push({ tone: "eq", tag: "반응 속도", text: "문항당 " + 초 + "초" + (기 != null ? ", 최근 7일과 비슷" : "") });
    }
    var f = r.focus;
    if (f.longest >= 10) out.push({ tone: f.longest >= 30 ? "up" : "eq", tag: "집중", text: "쉬지 않고 이어 간 최장 " + f.longest + "분" });
    if (f.n >= 16 && f.front != null && f.back != null && Math.abs(f.front - f.back) >= 15)
      out.push(f.back < f.front
        ? { tone: "dn", tag: "집중", text: "후반 정답률 하락, 전반 " + f.front + "% → 후반 " + f.back + "%" }
        : { tone: "up", tag: "집중", text: "후반으로 갈수록 정답률 상승, 전반 " + f.front + "% → 후반 " + f.back + "%" });
    var x = r.fix;
    if (x.tried) out.push({ tone: x.solved / x.tried >= 0.6 ? "up" : "dn", tag: "어려웠던 문제",
      text: "전에 틀린 문제 " + x.tried + "개 다시 풀어 " + x.solved + "개 해결" + (x.units.length ? " (" + x.units.join(", ") + ")" : "") });
    r.rise.forEach(function (u) { out.push({ tone: "up", tag: "성취도", text: u.name + " 이해도 " + u.from + " → " + u.to }); });
    r.stuck.forEach(function (u) { out.push({ tone: "dn", tag: "막힌 단원", text: u.name + " 이해도 " + u.v + ", 이날 풀었으나 아직 낮음" }); });
    return out;
  }

  /* ══ 주간 리포트 — 월~일 ══ */
  function 주간(월, cfg) {
    cfg = cfg || 설정();
    if (!월) 월 = 더하기(월요일(지금날(cfg.cut)), -7);
    월 = 월요일(월);
    var 일 = 더하기(월, 6), by = 묶기(cfg.cut), 대상 = 대상리프();
    var evs = [], 전evs = [], days = [];
    for (var i = 0; i < 7; i++) {
      var k = 더하기(월, i), h = 재기(by[k] || []);
      evs = evs.concat(by[k] || []); 전evs = 전evs.concat(by[더하기(월, i - 7)] || []);
      days.push({ d: k, wd: 요일[날(k).getDay()], min: h.min, ach: 상태(k, cfg.cut, 대상).ach });
    }
    /* 학습 시간·과목별 시간은 **일간 7장의 합**이다 — 주 전체를 한 번에 반올림하면 일간 합과 1~2분 어긋난다 */
    function 합치기(list) {
      var w = 재기(list.evs), m = 0, f = {};
      list.keys.forEach(function (k) { var h = 재기(by[k] || []); m += h.min; h.fam.forEach(function (x) { f[x.name] = (f[x.name] || 0) + x.min; }); });
      w.min = m;
      w.fam = Object.keys(f).map(function (k) { return { name: k, min: f[k] }; }).filter(function (x) { return x.min > 0; })
        .sort(function (p, q) { return q.min - p.min; });
      return w;
    }
    var 이번키 = [], 전키 = []; for (var z = 0; z < 7; z++) { 이번키.push(더하기(월, z)); 전키.push(더하기(월, z - 7)); }
    var w = 합치기({ evs: evs, keys: 이번키 }), pw = 합치기({ evs: 전evs, keys: 전키 });
    var 시작st = 상태(더하기(월, -1), cfg.cut, 대상), 끝st = 상태(일, cfg.cut, 대상);
    /* 예상 등급 추이 — 최근 8주, 주마다 일요일 마감 */
    var 등급 = [];
    for (var j = 7; j >= 0; j--) { var e = 더하기(일, -7 * j); var f = 예상(e, cfg.cut, 대상, by); 등급.push({ to: e, pct: f.pct, band: f.band }); }
    var 지금등급 = 등급[등급.length - 1], 전등급 = 등급[등급.length - 2];
    /* 단원 변화 */
    var u1 = 단원값(끝st, 대상), u0 = 단원값(시작st, 대상), 전값 = {};
    u0.forEach(function (x) { 전값[x.code] = x.v; });
    var 단원 = u1.map(function (x) { return { code: x.code, name: x.name, root: x.root, from: 전값[x.code] || 0, to: x.v, solved: x.solved, wt: x.wt }; });
    var 시 = 시험(일), fix = 재도전(월, 일, cfg.cut);
    var r = {
      kind: "week", v: 2, from: 월, to: 일, cut: cfg.cut, send: 발송("week", 월, cfg),
      student: 학생(), exam: 시,
      min: w.min, fam: w.fam, prevMin: pw.min, prevFam: pw.fam,
      active: days.filter(function (x) { return x.min > 0; }).length, days: days,
      pct: w.pct, prevPct: pw.pct, ans: w.ans, ok: w.ok,
      ach: { from: 시작st.ach, to: 끝st.ach },
      grade: { series: 등급, now: 지금등급, prev: 전등급, label: 학생().grade === "고1" ? "내신 예상 등급" : "예상 등급" },
      mocks: 모의목록(일),
      speed: { med: w.speed.med, base: pw.speed.med, slow: w.speed.slow, baseSlow: pw.speed.slow },
      focus: w.focus, fix: fix,
      units: 단원.sort(function (a, b) { return (b.to - b.from) - (a.to - a.from); }),
      made: Date.now()
    };
    r.causes = 원인(r);
    r.plan = 방향(r);
    return r;
  }
  function 원인(r) {
    var out = [], 이름;
    var 오른 = r.units.filter(function (u) { return u.to - u.from >= 5; }).slice(0, 2);
    var 내린 = r.units.filter(function (u) { return u.to - u.from <= -5; }).slice(0, 2);
    var g = r.grade;
    if (g.now.band && g.prev && g.prev.band && g.now.band !== g.prev.band)
      out.push({ tone: g.now.band < g.prev.band ? "up" : "dn", text: g.label + " " + g.prev.band + "등급 → " + g.now.band + "등급" });
    if (r.ach.to !== r.ach.from)
      out.push({ tone: r.ach.to > r.ach.from ? "up" : "dn",
        text: "성취도 " + r.ach.from + " → " + r.ach.to + (오른.length ? ", " + 오른.map(function (u) { return u.name + " +" + (u.to - u.from); }).join(", ") + "에서 상승" : "") });
    if (내린.length) out.push({ tone: "dn", text: 내린.map(function (u) { return u.name + " " + (u.to - u.from); }).join(", ") + ", 다시 풀며 틀린 문항이 늘어 이해도 하락" });
    if (r.prevMin || r.min) {
      var d = r.min - r.prevMin;
      if (Math.abs(d) >= 20) {
        var 빈 = r.days.filter(function (x) { return !x.min; }).map(function (x) { return x.wd; });
        out.push({ tone: d > 0 ? "up" : "dn", text: "학습 시간 지난주보다 " + Math.abs(d) + "분 " + (d > 0 ? "늘어남" : "줄어듦") + (빈.length && 빈.length < 7 ? ", 쉰 요일 " + 빈.join("·") : "") });
      }
    }
    var s = r.speed;
    if (s.slow != null && s.baseSlow != null && Math.abs(s.slow - s.baseSlow) >= 8)
      out.push({ tone: s.slow < s.baseSlow ? "up" : "dn", text: "45초 넘게 걸린 문항 비율 " + s.baseSlow + "% → " + s.slow + "%" });
    if (r.fix.tried >= 3) out.push({ tone: r.fix.solved / r.fix.tried >= 0.6 ? "up" : "dn",
      text: "전에 틀린 문제 재도전 해결률 " + Math.round(r.fix.solved / r.fix.tried * 100) + "%" });
    if (!out.length) out.push({ tone: "eq", text: r.min ? "지난주와 큰 변화 없음" : "이번 주 학습 기록 없음" });
    return out;
  }
  /* 다음 주 서비스가 밀어줄 방향 — 시험까지 남은 날 · 비중 큰데 이해도 낮은 단원 · 속도 · 재도전 */
  function 방향(r) {
    var out = [], e = r.exam, dd = e && e.dday != null ? e.dday - 1 : null;   // 다음 주 월요일 기준
    var 단계 = dd == null ? "범위 복습" : dd < 0 ? "다음 시험 준비" : dd <= 10 ? "실전 모의고사" : dd <= 24 ? "약점 메우기" : "범위 진도";
    out.push({ tag: "단계", text: 단계 + (dd != null && dd >= 0 ? ", " + e.name + " D-" + dd : "") +
      (단계 === "실전 모의고사" ? ", 매일 25문항 모의고사 1회" : 단계 === "약점 메우기" ? ", 이해도 낮은 단원부터 재출제" : 단계 === "범위 진도" ? ", 아직 안 푼 단원 먼저" : "") });
    var 후보 = r.units.slice().map(function (u) { return { u: u, s: (100 - u.to) * u.wt }; })
      .sort(function (a, b) { return b.s - a.s; }).slice(0, 3);
    후보.forEach(function (x, i) {
      out.push({ tag: "집중 단원 " + (i + 1), text: x.u.name + (x.u.solved ? ", 이해도 " + x.u.to : ", 아직 안 푼 단원") + (x.u.wt >= 18 ? ", 시험 비중 큼" : "") });
    });
    if (r.speed.slow != null && r.speed.slow >= 30) out.push({ tag: "속도", text: "45초 넘는 문항 " + r.speed.slow + "%, 제한 시간 훈련 비중 확대" });
    if (r.fix.tried >= 3 && r.fix.solved / r.fix.tried < 0.6) out.push({ tag: "재도전", text: "틀린 문제 재출제 간격 단축" });
    return out;
  }

  /* 알림 한 줄 — 푸시 본문 */
  function 한줄(r) {
    var 이름 = (r.student && r.student.name) || "학생";
    function 시(m) { return m >= 60 ? Math.floor(m / 60) + "시간 " + (m % 60) + "분" : m + "분"; }
    if (r.kind === "week") {
      var a = 날(r.from), b = 날(r.to), g = r.grade && r.grade.now;
      return { t: 이름 + " 주간 리포트 " + (a.getMonth() + 1) + "/" + a.getDate() + "~" + (b.getMonth() + 1) + "/" + b.getDate(),
               b: "학습 " + 시(r.min) + ", 성취도 " + r.ach.from + "→" + r.ach.to + (g && g.band ? ", " + r.grade.label + " " + g.band + "등급" : "") };
    }
    var d = 날(r.day), t = 이름 + " " + (d.getMonth() + 1) + "/" + d.getDate() + "(" + r.wd + ") 일간 리포트";
    if (!r.min) return { t: t, b: "학습 기록 없음" };
    return { t: t, b: "학습 " + 시(r.min) + ", 성취도 " + r.ach.prev + "→" + r.ach.now + (r.pct != null ? ", 정답률 " + r.pct + "%" : "") };
  }

  /* 서버에 올릴 묶음 — 최근 닫힌 이틀 + 진행 중인 오늘, 지난주 + 이번 주 */
  function 스냅샷() {
    var cfg = 설정(), 오늘 = 지금날(cfg.cut), 월 = 월요일(오늘);
    return [일간(더하기(오늘, -2), cfg), 일간(더하기(오늘, -1), cfg), 일간(오늘, cfg),
            주간(더하기(월, -7), cfg), 주간(월, cfg)];
  }

  W.PARENT = {
    설정: 설정, 설정저장: 설정저장, 마감말: 마감말,
    지금날: 지금날, 닫힌날: 닫힌날, 월요일: 월요일, 더하기: 더하기, 발송: 발송,
    일간: 일간, 주간: 주간, 한줄: 한줄, 스냅샷: 스냅샷, bandOf: bandOf,

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
