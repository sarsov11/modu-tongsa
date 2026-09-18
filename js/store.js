/* 모두의 통사 — 학습 상태 저장소 (개념트리 축) · 테라러닝
 *
 * 축이 바뀌었다. 예전에는 교재 편성 소단원이 단위였는데, 이제는
 * 개념트리의 리프(A1.1 · C1.4 …)가 단위다. 리프마다 기출 문항이 실측으로 붙어 있고
 * 등급(핵심/심화/참고)과 과목 분포가 데이터에 들어 있다.
 *
 * 백엔드가 붙으면 그쪽이 정본, 없으면 로컬에 쌓고 화면은 그대로 돈다(소방센세 api.js 와 같은 방식).
 */
(function () {
  "use strict";
  var T = window.TREE;
  var KEY = "terra.tree.v1";

  /* ── 색인 ─────────────────────────────────────── */
  var ROOTS = T.roots;
  var MIDS = [], LEAVES = [], BY = {}, QOF = {};
  ROOTS.forEach(function (r) {
    r.mids.forEach(function (m) {
      m.root = r; MIDS.push(m); BY[m.code] = m;
      m.leaves.forEach(function (l) {
        l.mid = m; l.root = r; LEAVES.push(l); BY[l.code] = l;
        l.play.forEach(function (q) { q.leaf = l.code; QOF[q.id] = q; });
      });
    });
    BY[r.code] = r;
  });

  function seed(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 10000) / 10000;
  }

  /* ── 상태 ─────────────────────────────────────── */
  var S = load();
  function blank() {
    return { v: 1, seeded: false,
             student: { name: "김서준", grade: "고1" },
             ans: {}, ev: [], exams: null, last: null };
  }
  function load() {
    try { var raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw); } catch (e) { }
    return blank();
  }
  var timer = null;
  function flush() { clearTimeout(timer); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } }
  function save() { clearTimeout(timer); timer = setTimeout(flush, 120); }

  function dayKey(d) {
    d = d || new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
  function mins(sec) { return Math.round(sec / 60); }
  /* ★ 사건을 창에 알린다 — 선생님 층(js/coach.js)이 이걸 받아 띠를 바로 바꾼다.
     화면마다 따로 알리면 어긋나므로 저장소가 한 곳에서 쏜다. */
  function tell(detail) {
    try { window.dispatchEvent(new CustomEvent("terra:ev", { detail: detail })); } catch (e) { }
  }
  function ago(ts) {
    if (!ts) return "아직 없음";
    var a = new Date(ts), n = new Date();
    var d0 = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    var d1 = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    var days = Math.round((d0 - d1) / 86400000);
    if (days <= 0) return "오늘";
    if (days === 1) return "어제";
    if (days < 8) return days + "일 전";
    return (a.getMonth() + 1) + "월 " + a.getDate() + "일";
  }

  /* ── 채점 ─────────────────────────────────────── */
  /* 답을 받는다.
   *
   * ★ 셋을 더 받는다 — **확신도 · 걸린 시간 · 몇 번째 시도인가**.
   *   판정 엔진(js/judge.js)이 이것 없이는 돌지 않는다.
   *   확신 오답(오개념)과 찍은 오답은 같은 '오답' 이지만 해야 할 일이 정반대다 —
   *   앞은 믿고 있는 것을 깨야 하고, 뒤는 처음부터 가르쳐야 한다.
   *
   * opt = { conf: "sure"|"half"|"guess", ms: 걸린시간 }
   *
   * ★ 기록을 불리지 않는다. 시도는 **횟수와 첫 답**만 남긴다 —
   *   전부 쌓으면 localStorage 가 금방 찬다(옮기기 코드가 이미 11,711자다).
   */
  function answer(qid, pick, opt) {
    var q = QOF[qid]; if (!q) return null;
    opt = opt || {};
    var ok = (pick === q.a);
    var 앞 = S.ans[qid] || null;
    var 시도 = (앞 && 앞.n ? 앞.n : (앞 ? 1 : 0)) + 1;

    S.ans[qid] = {
      ok: ok, p: pick, at: Date.now(),
      n: 시도,                                   // 몇 번째 시도인가
      c: opt.conf || null,                       // 확신도
      ms: opt.ms || null,                        // 걸린 시간(밀리초)
      /* 처음에 무엇을 골랐는가 — 나중에 오개념을 분류할 때 쓴다.
         다시 풀어 맞혔어도 **처음 고른 것**이 그 학생의 오개념이다. */
      p0: 앞 ? (앞.p0 == null ? 앞.p : 앞.p0) : pick,
      c0: 앞 ? (앞.c0 == null ? 앞.c : 앞.c0) : (opt.conf || null)
    };
    S.ev.push({ k: "a", d: dayKey(), leaf: q.leaf, q: qid, ok: ok,
                c: opt.conf || null, ms: opt.ms || null, n: 시도, at: Date.now() });
    S.last = { leaf: q.leaf, at: Date.now() };
    save();
    tell({ k: "a", leaf: q.leaf, q: qid, ok: ok, c: opt.conf || null, n: 시도 });
    return { ok: ok, correct: q.a, q: q, n: 시도 };
  }

  /* 그 리프에서 **연달아 몇 번 틀렸는가** — 판정 엔진이 '강의로 돌릴 때' 를 정할 때 쓴다.
     맞히면 0 으로 돌아간다. */
  function 연속오답(leafCode) {
    var n = 0;
    for (var i = S.ev.length - 1; i >= 0; i--) {
      var e = S.ev[i];
      if (e.k !== "a" || e.leaf !== leafCode) continue;
      if (e.ok) break;
      n++;
      if (n >= 10) break;
    }
    return n;
  }

  /* 판정 엔진에 넘길 것을 한 번에 모은다 — 화면마다 따로 모으면 어긋난다 */
  function 판정거리(qid, ok, conf, ms) {
    var q = QOF[qid];
    var leaf = q ? q.leaf : null;
    var st = leaf ? leafStat(leaf) : null;
    var 앞 = S.ans[qid] || null;
    return {
      qid: qid, ok: ok, conf: conf || null, ms: ms || null,
      attempt: (앞 && 앞.n) ? 앞.n : 1,
      mastery: (st && st.solved) ? (st.correct / st.solved) : null,
      streak: leaf ? 연속오답(leaf) : 0,
      leaf: leaf
    };
  }
  function drill(type, ok) {
    S.ev.push({ k: "x", d: dayKey(), t: type, ok: !!ok, at: Date.now() }); save();
    tell({ k: "x", t: type, ok: !!ok });
  }
  /* 강의를 본 만큼 적는다. 같은 강의를 이어 보면 분이 쌓인다. */
  function watch(code, min) {
    min = Math.max(1, Math.round(min || 0));
    S.lec = S.lec || {};
    S.lec[code] = (S.lec[code] || 0) + min;
    S.ev.push({ k: "l", d: dayKey(), lec: code, m: min, at: Date.now() });
    save();
    tell({ k: "l", lec: code, m: min });
  }
  function watched(code) { return (S.lec || {})[code] || 0; }
  function drillStat(type) {
    /* last 는 **마지막으로 그 훈련을 한 시각**이다.
       잘하던 것도 오래 두면 잊는다 — 무엇을 권할지 정할 때 쓴다. */
    var n = 0, ok = 0, last = null;
    S.ev.forEach(function (e) {
      if (e.k === "x" && (!type || e.t === type)) {
        n++; if (e.ok) ok++;
        if (e.at && (!last || e.at > last)) last = e.at;
      }
    });
    return { n: n, ok: ok, pct: n ? Math.round(ok / n * 100) : null, last: last };
  }

  /* ── 지금 이 학생이 어느 수준인가 ────────────────
     킬러는 못하는 학생에게 밀면 안 된다. 무너지면 안 돌아온다.
     그래서 **누적 학습량과 준킬러 성취도**로 문을 연다.

       기초 — 아직 킬러를 줄 때가 아니다. 준킬러만.
       도전 — 준킬러가 섰다. 킬러를 섞는다.
       숙련 — 킬러도 선다. 약한 킬러를 집중한다.

     문턱은 `js/trend.js` 에 둔다 — 경향 상수를 한 곳에 모으는 규칙 그대로다. */
  function 훈련합(티어) {
    var D = window.DRILLS || [], n = 0, ok = 0;
    D.forEach(function (d) {
      var 준 = (d.tier === "준킬러");
      if (티어 === "준킬러" ? !준 : 준) return;
      var st = drillStat(d.id);
      n += st.n; ok += st.ok;
    });
    return { n: n, ok: ok, pct: n ? Math.round(ok / n * 100) : null };
  }

  function 훈련수준() {
    var G = window.DRILL_GATE || {};
    var 기초누적 = G.기초누적 == null ? 30 : G.기초누적;
    var 준킬러선 = G.준킬러선 == null ? 60 : G.준킬러선;
    var 킬러누적 = G.킬러누적 == null ? 20 : G.킬러누적;
    var 킬러선 = G.킬러선 == null ? 55 : G.킬러선;

    var 준 = 훈련합("준킬러"), 킬 = 훈련합("킬러");
    var 누적 = 준.n + 킬.n;

    /* 아직 적게 했거나, 준킬러가 흔들리면 기초다 */
    if (누적 < 기초누적) return { level: "기초", 준: 준, 킬: 킬, 누적: 누적,
      why: "아직 " + 누적 + "문항이에요. 준킬러부터 다지고 킬러로 갑니다." };
    if (준.n >= 10 && 준.pct != null && 준.pct < 준킬러선)
      return { level: "기초", 준: 준, 킬: 킬, 누적: 누적,
        why: "준킬러 정답률이 " + 준.pct + "%예요. 여기가 서면 킬러가 쉬워집니다." };

    /* 킬러를 아직 덜 했거나 흔들리면 도전 단계 */
    if (킬.n < 킬러누적 || (킬.pct != null && 킬.pct < 킬러선))
      return { level: "도전", 준: 준, 킬: 킬, 누적: 누적,
        why: "준킬러가 섰어요(" + (준.pct == null ? "-" : 준.pct + "%") +
             "). 이제 킬러를 섞습니다." };

    return { level: "숙련", 준: 준, 킬: 킬, 누적: 누적,
      why: "킬러 정답률 " + 킬.pct + "%. 약한 갈래만 집어서 갑니다." };
  }

  /* ── 무엇을 권할 것인가 ───────────────────────
     점수 = 못하는 정도 × 2 + 묵은 정도
    , 안 해본 것은 0.6(중간값). 1등으로 두면 늘 새것만 돌고 틀린 것을 안 준다.
    , 묵은 정도는 마지막으로 한 지 며칠인가(14일이면 만점).
    , 수준에 안 맞는 티어는 0.3 을 곱해 뒤로 민다(아주 막지는 않는다). */
  function 훈련점수(d, level) {
    var st = drillStat(d.id);
    /* ★ 안 해본 것을 너무 높이 두면 **약점이 뒤로 밀린다.**
       0.6 으로 뒀더니 강점이 정반대인 두 학생에게 같은 새 훈련이 나갔다.
       0.45 도 정답률 40% 짜리에 1.85 대 1.80 으로 근소하게 이겼다 —
       40% 면 누가 봐도 약점인데 밀리면 안 된다.
       0.40 이면 경계가 정답률 43% 근처로 내려간다. */
    var 못함 = (st.n === 0) ? 0.40 : (1 - (st.pct || 0) / 100);
    var 묵음 = 0;
    if (st.last) 묵음 = Math.min(1, (Date.now() - st.last) / DAY / 14);
    else if (st.n === 0) 묵음 = 0.5;
    /* ★ 안 해본 훈련끼리는 점수가 같아 **누구에게나 같은 것**이 나갔다.
       훈련 기록만 봐서는 가를 수 없으니, 그 훈련이 속한 **대영역의 성취도**를 본다.
       그동안 푼 문항 전체가 무엇을 권할지 정하게 된다.
       ★ 아직 안 푼 영역은 0.5(중립) — 안 푼 것을 약점으로 읽으면 안 된다. */
    var 영역못함 = 0.5;
    if (d.root) {
      var rs = rootStat(d.root);
      if (rs && rs.solved) 영역못함 = 1 - (rs.correct / rs.solved);
    }

    var 준 = (d.tier === "준킬러");
    var 맞음 = 1;
    if (level === "기초") 맞음 = 준 ? 1 : 0.3;          // 킬러를 뒤로
    else if (level === "숙련") 맞음 = 준 ? 0.5 : 1;      // 준킬러를 뒤로
    return (못함 * 3 + 묵음 + 영역못함 * 1.5) * 맞음;
  }

  /* 오늘 권할 훈련 하나 — 범위 안에서, 수준에 맞게, 약한 것부터.
     같은 것만 되풀이되지 않도록 **최근에 권한 것**은 뒤로 민다. */
  function 훈련추천(범위걸림) {
    var D = window.DRILLS || [];
    if (!D.length) return null;
    var 수준 = 훈련수준();
    var 쓸것 = D;
    if (범위걸림) {
      var 안 = D.filter(function (d) { return !d.root || inScope(d.root); });
      if (안.length) 쓸것 = 안;
    }
    var 점수 = 쓸것.map(function (d) {
      return { d: d, s: 훈련점수(d, 수준.level), st: drillStat(d.id) };
    });
    점수.sort(function (a, b) { return b.s - a.s; });
    return { pick: 점수[0].d, stat: 점수[0].st, level: 수준.level,
             why: 수준.why, 순위: 점수.slice(0, 5).map(function (x) {
               return { id: x.d.id, s: Math.round(x.s * 100) / 100 }; }) };
  }

  /* ── 성적 ─────────────────────────────────────── */
  var GRADE_W = { "핵심": 1, "심화": 0.7, "참고": 0.4 };

  function leafStat(code) {
    var l = BY[code], solved = 0, correct = 0, last = null;
    l.play.forEach(function (q) {
      var a = S.ans[q.id];
      if (a) { solved++; if (a.ok) correct++; if (!last || a.at > last) last = a.at; }
    });
    var play = l.play.length;
    var pct = solved ? Math.round(correct / solved * 100) : null;
    var prog = play ? Math.round(solved / play * 100) : 0;
    /* 성취도 = 얼마나 풀었나(55) + 얼마나 맞았나(45) */
    var achieve = play ? Math.round(prog * 0.55 + (pct === null ? 0 : pct) * 0.45) : 0;
    return {
      leaf: l, code: code, name: l.name, grade: l.grade,
      n: l.n, play: play, solved: solved, correct: correct,
      pct: pct, prog: prog, achieve: achieve, lastAt: last,
      state: !play ? "none" : achieve >= 80 ? "done" : achieve > 0 ? "wip" : "none"
    };
  }
  /* ★★ 오늘 풀 리프 하나 — **고르는 시간을 없애기 위한 함수**다(2026-09-04 대표님 지시).
     화면마다 따로 고르면 홈과 문제풀이가 서로 다른 것을 권한다. 점수를 한 곳에 둔다.

     점수 = 못함 × 무게. 큰 것부터 —
       ① **틀린 자리**가 가장 급하다(정답률이 낮을수록)
       ② 아직 **안 댄 자리**는 그 다음 (풀 것이 많을수록)
       ③ **묵은 자리** — 마지막으로 푼 지 오래됐으면 되돌릴 때다
       ④ 시험 **범위 안**이면 크게 올린다. 범위 밖은 지금 급하지 않다
       ⑤ 이미 **다 잡은 자리**(이해도 높음)는 내린다 — 아는 것을 또 시키지 않는다 */
  /* 반응 시간대(2026-09-18 대표님 "맞춘 시간도 다 체크해서 반응시간대별로 이해도에 반영") —
     O·X 7초·14초, 개념어 12초·22초, 객관식 25초·45초를 경계로 빠름·보통·느림. 시간이 없으면 null */
  function 반응대(kind, ms) {
    if (ms == null) return null;
    var t = kind === "ox" ? [7000, 14000] : kind === "kw" ? [12000, 22000] : [25000, 45000];   // 제한 20·30·60초의 약 1/3·2/3
    return ms < t[0] ? "빠름" : ms < t[1] ? "보통" : "느림";
  }
  function 속도무게(kind, ms) {
    var b = 반응대(kind, ms);
    return b === "빠름" ? 1 : b === "느림" ? 0.6 : 0.85;   // 보통·모름 0.85
  }
  function 이해도(code) {
    /* 대표님 말대로 "뭘로 하건 문제만 제대로 맞추면 이해도 100" 이다.
       그래서 이해도는 **맞힌 문항 수**로 찬다 — 강의를 봤는지 카드를 봤는지는 안 본다.
       열 문항을 맞히면 100. 적게 풀고 다 맞힌 것과 많이 풀고 다 맞힌 것을 가른다. */
    var st = leafStat(code);
    var 목표 = Math.min(10, Math.max(4, Math.round(st.play * 0.35)));
    /* 맞힌 문항을 반응 시간대로 무게를 매겨 센다 — 빠르게 맞힌 것 1, 보통 0.85, 느린 것 0.6.
       리프가 적힌 O·X 기록(배치 시험)은 0.4 문항으로 센다. */
    var 맞힘 = 0;
    st.leaf.play.forEach(function (q) { var a = S.ans[q.id]; if (a && a.ok) 맞힘 += 속도무게("q", a.ms); });
    var ox = S.ox || {};
    for (var id in ox) { var r = ox[id]; if (r && r.leaf === code && r.ok) 맞힘 += 0.4 * 속도무게("ox", r.ms); }
    var 찬것 = Math.min(1, 맞힘 / (목표 || 1));
    var 정확 = st.pct === null ? 0 : st.pct / 100;
    return Math.round(찬것 * 100 * (0.55 + 0.45 * 정확));
  }

  function 오늘의리프(opt) {
    opt = opt || {};
    var 이제 = Date.now(), 후보 = [];
    /* ★ 그 학년 지도에 **보이는 대영역**만 고른다. 안 그러면 고1에게
       사상가(K)가 나간다 — K 는 고1·고2 지도에서 숨기는 축이다.
       화면에 없는 것을 오늘 할 일로 주면 학생이 찾아갈 데가 없다. */
    var 보임 = {};
    보이는대영역().forEach(function (r) { 보임[r.code] = 1; });
    LEAVES.forEach(function (l) {
      if (!l.play || !l.play.length) return;
      if (!보임[l.mid.root.code]) return;
      var st = leafStat(l.code);
      var u = 이해도(l.code);
      /* ★ 못함과 안댐을 **겹쳐 세지 않는다.** 처음에 안 댄 자리에도 못함 0.55 를
         줬더니 안 댄 것이 늘 이겨서, 정답률 30% 인 자리보다 앞에 섰다 —
         두 학생을 만들어 재 보니 갑·을이 **같은 것**을 받았다.
         안 댄 자리는 못함이 0 이고 안댐만 받는다. 대신 못하는 자리의 무게를 키운다. */
      var 못함 = st.pct === null ? 0 : (1 - st.pct / 100);
      var 안댐 = st.solved === 0 ? 1.1 : 0;
      var 묵음 = st.lastAt ? Math.min(0.35, (이제 - st.lastAt) / 86400000 / 30 * 0.35) : 0.2;
      var 범위 = (!scopeOn() || inScopeLeaf(l.code)) ? 1 : 0.25;
      var 잡힘 = u >= 85 ? 0.15 : (u >= 60 ? 0.6 : 1);
      var 양 = Math.min(1, l.play.length / 40);
      var 점수 = (못함 * 2.2 + 안댐 + 묵음) * 범위 * 잡힘 * (0.6 + 0.4 * 양);
      후보.push({ leaf: l, code: l.code, st: st, 이해도: u, 점수: 점수,
                  범위안: 범위 === 1 });
    });
    후보.sort(function (a, b) { return b.점수 - a.점수; });
    if (opt.전부) return 후보;
    return 후보[0] || null;
  }

  /* 화면에 적을 한 줄짜리 까닭 — "왜 이게 나왔는지" 를 학생이 납득해야 한다 */
  function 오늘의까닭(c) {
    if (!c) return "";
    var st = c.st;
    if (st.solved === 0)
      return c.범위안
        ? "시험 범위인데 아직 손을 안 댄 자리예요. 여기부터 열면 점수가 가장 많이 움직여요."
        : "아직 손을 안 댄 자리예요. 문항이 " + st.play + "개 있어요.";
    if (st.pct !== null && st.pct < 60)
      return "여기서 " + (st.solved - st.correct) + "번 틀렸어요"
           + (c.범위안 ? " — 시험 범위이기도 하고요." : ".");
    if (st.lastAt && (Date.now() - st.lastAt) > 12 * 86400000)
      return "마지막으로 푼 지 "
           + Math.round((Date.now() - st.lastAt) / 86400000) + "일 됐어요. 다시 볼 때예요.";
    return c.범위안 ? "시험 범위 안에서 지금 가장 값이 큰 자리예요."
                    : "지금 가장 값이 큰 자리예요.";
  }

  function agg(list) {
    var n = 0, play = 0, solved = 0, correct = 0, ach = 0, cnt = 0, last = null;
    list.forEach(function (c) {
      var st = leafStat(c);
      n += st.n; play += st.play; solved += st.solved; correct += st.correct;
      ach += st.achieve; cnt++;
      if (st.lastAt && (!last || st.lastAt > last)) last = st.lastAt;
    });
    return { n: n, play: play, solved: solved, correct: correct,
             pct: solved ? Math.round(correct / solved * 100) : null,
             achieve: cnt ? Math.round(ach / cnt) : 0, leaves: cnt, lastAt: last };
  }
  function midStat(code) { return agg(BY[code].leaves.map(function (l) { return l.code; })); }
  function rootStat(code) {
    var cs = [];
    BY[code].mids.forEach(function (m) { m.leaves.forEach(function (l) { cs.push(l.code); }); });
    return agg(cs);
  }
  function overall() {
    var o = agg(LEAVES.map(function (l) { return l.code; }));
    o.total = LEAVES.length;
    o.done = LEAVES.filter(function (l) { return leafStat(l.code).state === "done"; }).length;
    o.progress = o.play ? Math.round(o.solved / o.play * 100) : 0;
    return o;
  }

  /* ── 등급 환산 · 랭크 · 추세 ─────────────────────
     ★ 고교 내신은 2025학년도부터 **5등급제**다(2026-09-03 대표님 지적).
       9등급으로 환산하면 고1이 자기 위치를 잘못 읽는다.

     ★★ 이 값은 **가늠일 뿐이다.** 실제 내신 등급은 그 학교 응시자 분포로 갈린다 —
       같은 점수라도 학교마다 등급이 다르고, 우리는 그 분포를 모른다.
       그래서 화면에 "가늠" 이라고 밝히고, **"다음 등급까지 몇 점" 같은 것은 내지 않는다.**
       모르는 것을 숫자로 내면 그게 거짓말이 된다. */
  var BANDS = [[90, 1], [78, 2], [62, 3], [45, 4], [0, 5]];
  function bandOf(pct) {
    if (pct === null || pct === undefined) return null;
    for (var i = 0; i < BANDS.length; i++) if (pct >= BANDS[i][0]) return BANDS[i][1];
    return 5;
  }
  function setGrade(g) { S.student.grade = g; flush(); }

  var LADDER = [
    { min: 0, name: "언랭", short: "UR", color: "#7C8A94" },
    { min: 12, name: "브론즈 Ⅲ", short: "B3", color: "#C08552" },
    { min: 22, name: "브론즈 Ⅱ", short: "B2", color: "#C08552" },
    { min: 32, name: "브론즈 Ⅰ", short: "B1", color: "#C08552" },
    { min: 42, name: "실버 Ⅲ", short: "S3", color: "#AEBCC6" },
    { min: 50, name: "실버 Ⅱ", short: "S2", color: "#AEBCC6" },
    { min: 58, name: "실버 Ⅰ", short: "S1", color: "#AEBCC6" },
    { min: 66, name: "골드 Ⅲ", short: "G3", color: "#E3B04B" },
    { min: 74, name: "골드 Ⅱ", short: "G2", color: "#E3B04B" },
    { min: 82, name: "골드 Ⅰ", short: "G1", color: "#E3B04B" },
    { min: 90, name: "다이아", short: "DIA", color: "#5FD0F5" }
  ];
  function rank() {
    var o = overall();
    var lp = Math.round(o.achieve * 0.45 + (o.pct || 0) * 0.35 + o.progress * 0.20);
    var idx = 0;
    for (var i = 0; i < LADDER.length; i++) if (lp >= LADDER[i].min) idx = i;
    var cur = LADDER[idx], next = LADDER[idx + 1] || null;
    return { lp: lp, index: idx, tier: cur, next: next, ladder: LADDER,
             toNext: next ? next.min - lp : 0,
             fill: next ? Math.round((lp - cur.min) / (next.min - cur.min) * 100) : 100,
             parts: { achieve: o.achieve, accuracy: o.pct, progress: o.progress } };
  }
  function daysBack(n, endKey) {
    var out = [], d = endKey ? new Date(endKey + "T12:00:00") : new Date();
    for (var i = n - 1; i >= 0; i--) { var x = new Date(d); x.setDate(d.getDate() - i); out.push(dayKey(x)); }
    return out;
  }
  function trend() {
    var recent = {}, prev = {};
    daysBack(7).forEach(function (k) { recent[k] = 1; });
    daysBack(14).slice(0, 7).forEach(function (k) { prev[k] = 1; });
    var ra = [], rb = [];
    S.ev.forEach(function (e) {
      if (e.k !== "a") return;
      if (recent[e.d]) ra.push(e); else if (prev[e.d]) rb.push(e);
    });
    var p = function (a) { return a.length ? a.filter(function (e) { return e.ok; }).length / a.length * 100 : null; };
    var pa = p(ra), pb = p(rb);
    return { slope: (pa !== null && pb !== null) ? Math.round(pa - pb) : 0,
             recent: pa === null ? null : Math.round(pa), n: ra.length };
  }
  function forecast() {
    var o = overall(), t = trend(), g = S.student.grade || "고1";
    var days = {}; S.ev.forEach(function (e) { days[e.d] = 1; });
    var active = Math.max(1, Object.keys(days).length);
    var perWeek = Math.max(1, Math.round(o.solved / active * 7));
    var remain = Math.max(0, o.play - o.solved);
    var weeks = Math.max(1, Math.ceil(remain / perWeek));
    var eta = new Date(); eta.setDate(eta.getDate() + weeks * 7);
    var cum = o.pct || 0;
    var base = t.recent !== null ? (cum * 0.6 + t.recent * 0.4) : cum;
    var proj = Math.max(20, Math.min(97, Math.round(base + t.slope * 0.35)));
    return { grade: g, isSenior: g === "고3",
             now: { pct: o.pct, band: bandOf(o.pct) },
             projected: { pct: proj, band: bandOf(proj) },
             perWeek: perWeek, remain: remain, weeks: weeks,
             eta: eta.getFullYear() + "년 " + (eta.getMonth() + 1) + "월",
             trend: t, overall: o };
  }

  /* ── 학년마다 배우는 것이 다르다 ───────────────────
     통합사회는 고1 과목이다. 고2~3 은 선택과목(세계시민과 지리 등)을 듣고,
     고3 은 수능을 본다. 그래서 문항 풀·목표일·파는 것이 학년마다 갈린다. */
  /* 리프 이름의 부제 「 — 」 를 괄호로 묶는다 — 한 줄 설명에 대시가 두 번 들어가면 읽기 어렵다 (2026-09-13) */
  function 부제괄호(n) { n = String(n || ""); var k = n.indexOf(" — "); return k < 0 ? n : n.slice(0, k) + "(" + n.slice(k + 3) + ")"; }

  var GRADES = {
    /* ★ 학년마다 공부 방식에 이름을 붙인다 — REMIND · REWIND · REWIRE (대표님 2026-09-13).
         고1 은 배운 것을 시험 전에 다시 떠올리고(내신), 고2 는 고1 통합사회를 되감아 수능 꼴로 바꾸고,
         고3 은 공부 회로를 수능 실전으로 통째로 바꾼다. 하루 몫 비율은 js/trend.js 의 GRADE_MIX 가 같은 뜻으로 갈린다. */
    "고1": { key: "고1", subject: "통합사회 1·2",
      re: "REMIND", reKo: "내신 대비형",
      reSay: "학교에서 배운 개념을 시험 전에 다시 떠올려요.",
      say: "학교 진도에 맞춰 개념을 다지고, 내신 시험을 겨눕니다.",
      focus: "내신", pool: "통합사회 학평", ddayName: "내신 시험",
      sell: { kind: "book", id: "naesin", name: "범위별 내신 모의고사",
              say: "학교에서 나간 범위만 잘라 만든 실전 대비 모의고사" } },
    "고2": { key: "고2", subject: "통합사회 되감기, 수능 전환",
      re: "REWIND", reKo: "복습, 수능 전환형",
      reSay: "고1에 배운 통합사회를 되감아, 수능 문항 꼴로 바꿔 풀어요.",
      say: "통합사회는 고1에 다 배웠습니다. 잊은 곳을 되감고 수능 꼴로 바꿔 풉니다.",
      focus: "수능 전환", pool: "통합사회 학평, 예비시행", ddayName: "내신 시험",
      sell: { kind: "pack", id: "elective", name: "선택과목 확장팩",
              say: "듣는 과목만 골라 저렴하게 붙이는 확장팩" } },
    "고3": { key: "고3", subject: "수능 사회탐구",
      re: "REWIRE", reKo: "수능 완전 대비형",
      reSay: "공부 방식을 수능 실전으로 통째로 바꿔요.",
      say: "기출을 대량으로 돌립니다. 남은 날짜에 맞춰 분량을 잡아 드립니다.",
      focus: "수능", pool: "평가원·교육청 기출", ddayName: "수능",
      sell: { kind: "book", id: "silmo", name: "실전 모의고사",
              say: "시간을 재고 푸는 수능 꼴 실전 세트" } }
  };
  /* 고2~3 이 듣는 사회과 선택과목 — 2022 개정 고시 기준.
     확장팩은 아직 만들기 전이라 상태를 '준비 중'으로 둔다. */
  /* ── 선택과목 확장팩 ──────────────────────────────
     ★ 대표님 판단(2026-09-03) —
       "선택과목 확장팩은 어쩔 수 없이 **범위에 맞는 고3 기출**로 채울 수밖에 없다.
        고2 기출만으로는 자료가 부족하다."

     실측이 그 판단을 뒷받침한다. 선택과목 문항 3,236개 중 **고3이 2,168개**이고
     고2는 1,074개뿐이다 — 고2 것만 쓰면 한 과목에 100~300개밖에 안 된다.

     ★ 2022 개정에서 과목 이름과 편제가 바뀌었다. 옛 과목 기출을 새 과목에 쓰는 것이므로
       **얼마나 겹치는지를 밝혀 둔다**(`fit`). 감추면 나중에 못 고친다.

       같음  과목이 사실상 그대로다
       대응  이름이 바뀌고 내용이 재편됐지만 주된 축이 이어진다
       분할  옛 한 과목이 둘로 갈렸다 — 개념트리 리프로 가른다
       없음  대응하는 옛 과목이 없다 (문항 0 — 열지 않는다)

     `subj` 는 문제은행의 과목 코드, `leaf` 는 리프 코드 앞자리(분할 과목만).  */
  var PACKS = [
    { id: "geo",  name: "세계시민과 지리", group: "일반선택",
      subj: ["G"], fit: "대응", was: "세계지리" },
    { id: "cul",  name: "사회와 문화",     group: "일반선택",
      subj: ["S"], fit: "대응", was: "사회·문화" },
    { id: "eth",  name: "현대사회와 윤리", group: "일반선택",
      subj: ["L"], fit: "대응", was: "생활과 윤리" },
    { id: "his",  name: "세계사",          group: "일반선택",
      subj: [],   fit: "없음", was: null },
    /* ★ 옛 '정치와 법' 이 둘로 갈렸다. 리프 코드로 가른다 —
       국회·정부·지방자치·국제정치는 정치, 기본권·법원·헌재·노동법은 법과 사회.
       헌법의 기본 원리(F2.4)는 **양쪽에 둔다** — 두 과목에서 다 다룬다. */
    { id: "pol",  name: "정치",            group: "진로선택",
      subj: ["P"], fit: "분할", was: "정치와 법",
      leaf: ["F3.2", "F3.3", "F3.6", "F2.4", "I2."] },
    { id: "law",  name: "법과 사회",       group: "진로선택",
      subj: ["P"], fit: "분할", was: "정치와 법",
      leaf: ["F2.1", "F2.2", "F2.3", "F2.4", "F3.4", "F3.5", "F5."] },
    { id: "eco",  name: "경제",            group: "진로선택",
      subj: ["C"], fit: "같음", was: "경제" },
    { id: "kgeo", name: "한국지리 탐구",   group: "진로선택",
      subj: ["K"], fit: "대응", was: "한국지리" },
    { id: "idea", name: "윤리와 사상",     group: "진로선택",
      subj: ["E"], fit: "같음", was: "윤리와 사상" },
    { id: "clim", name: "기후변화와 지속가능한 세계", group: "융합선택",
      subj: [],   fit: "없음", was: null }
  ];

  /* 확장팩마다 지금 몇 문항을 낼 수 있는가 — **세어서** 말한다.
     "준비 중" 인지 "쓸 수 있는지" 를 사람 손으로 적으면 곧 어긋난다. */
  function packCount(p) {
    if (!p || !p.subj || !p.subj.length) return { n: 0, g3: 0, g2: 0 };
    /* ★ 미리 세어 둔 것이 있으면 그것을 쓴다(js/packs.js · 443바이트).
       설정 화면은 문제은행 5.7MB 를 싣지 않는다 — 싣게 하면 화면 하나가 6MB가 된다.
       js/pool.js 와 같은 방식이다. 문항이 늘면 `확장팩집계.py` 를 다시 돌린다. */
    var PN = window.PACKN && window.PACKN[p.id];
    if (PN) return { n: PN[0], g3: PN[1], g2: PN[2] };
    var TREE2 = window.TREE, Q2 = window.QBANK || {};
    if (!TREE2) return { n: 0, g3: 0, g2: 0 };
    var roots = TREE2.roots || TREE2, 본것 = {}, n = 0, g3 = 0, g2 = 0;
    roots.forEach(function (r) {
      (r.mids || []).forEach(function (m) {
        (m.leaves || []).forEach(function (l) {
          /* 분할 과목은 리프 앞자리로 한 번 더 거른다 */
          if (p.leaf && p.leaf.length) {
            var 맞 = false;
            for (var i = 0; i < p.leaf.length; i++) {
              if (String(l.code).indexOf(p.leaf[i]) === 0) { 맞 = true; break; }
            }
            if (!맞) return;
          }
          (l.play || []).forEach(function (q) {
            if (본것[q.id]) return;
            if (p.subj.indexOf(q.s) < 0) return;
            if (window.QRENDER && !window.QRENDER.ok(Q2[q.id], q)) return;
            본것[q.id] = 1; n++;
            if (q.g === "고3") g3++; else if (q.g === "고2") g2++;
          });
        });
      });
    });
    return { n: n, g3: g3, g2: g2 };
  }

  /* 화면에 낼 상태 — 문항이 있으면 열고, 없으면 준비 중이다. */
  function packState(p) {
    var c = packCount(p);
    return c.n >= 60 ? "ready" : (c.n > 0 ? "thin" : "soon");
  }
  /* 파는 것 — 아직 제작 전이라 값을 적지 않는다. 지어내면 그게 거짓말이 된다. */
  var BOOKS = [
    { id: "naesin", grade: "고1", name: "범위별 내신 모의고사",
      say: "학교에서 나간 범위만 잘라 만든 실전 세트. 시험 2주 전에 맞춰 나옵니다.",
      state: "soon" },
    { id: "silmo", grade: "고3", name: "실전 모의고사",
      say: "수능 꼴 그대로, 시간을 재고 푸는 세트.", state: "soon" },
    { id: "basic", grade: "*", name: "순환 기본서",
      say: "전 범위를 세 번 도는 기본서. 권마다 깊이만 달라집니다.", state: "soon" }
  ];
  function gradeInfo(g) { return GRADES[g || (S.student.grade || "고1")] || GRADES["고1"]; }
  function packs() { if (!S.packs) { S.packs = []; } return S.packs; }

  /* 확장팩 목록에 **실측한 문항 수와 상태**를 얹어 돌려준다.
     화면이 "준비 중" 을 손으로 적지 않게 한다. */
  function packList() {
    return PACKS.map(function (p) {
      var c = packCount(p);
      return { id: p.id, name: p.name, group: p.group, fit: p.fit, was: p.was,
               n: c.n, g3: c.g3, g2: c.g2, state: packState(p),
               on: packs().indexOf(p.id) >= 0 };
    });
  }
  function togglePack(id) {
    var a = packs(), i = a.indexOf(id);
    if (i >= 0) a.splice(i, 1); else a.push(id);
    flush(); return a;
  }
  function plan() {
    if (!S.plan) { S.plan = { sub: false, since: null }; }
    return S.plan;
  }
  function setPlan(on) { plan().sub = !!on; plan().since = on ? dayKey() : null; flush(); }

  /* ── 시험 일정 ─────────────────────────────────── */
  function plusDays(n) { var d = new Date(); d.setDate(d.getDate() + n); return dayKey(d); }
  /* 수능은 11월 셋째 목요일에 치러 왔다. 확정일은 교육부가 따로 발표하므로
     여기 값은 '예상'이고, 학생이 눌러 고칠 수 있게 둔다. */
  function suneungGuess() {
    var y = new Date().getFullYear();
    function third(yy) {
      var d = new Date(yy, 10, 1), c = 0;
      while (true) {
        if (d.getDay() === 4) { c++; if (c === 3) return d; }
        d.setDate(d.getDate() + 1);
      }
    }
    var d = third(y);
    if (d < new Date()) d = third(y + 1);
    return dayKey(d);
  }
  function defaultExams(grade) {
    if (grade === "고3") {
      return [{ id: "su", name: "수능", date: suneungGuess(),
                note: "11월 셋째 목요일로 잡은 예상일 — 확정되면 눌러서 바꾸세요" },
              { id: "mo", name: "다음 모의고사", date: "",
                note: "시행일을 넣으면 함께 표시됩니다" }];
    }
    /* 처음 온 학생에게는 남의 날짜다. 첫 화면에서 제일 큰 숫자가 남의 것이면 안 된다.
       — 눌러서 고치라고 대놓고 말한다. */
    /* ★ 학기까지 나눈다(2026-09-04 대표님 지시). 고1은 1학기에 통합사회 1,
       2학기에 통합사회 2 를 배운다 — 같은 "중간고사"라도 범위가 통째로 다르므로
       시험 하나에 범위 하나가 붙으려면 학기가 있어야 한다.
       날짜는 지난 학기 것을 비워 둔다 — 남의 날짜를 큰 숫자로 띄우지 않는다. */
    return [{ id: "s1mid", name: "1학기 중간고사", date: "", note: "눌러서 내 시험일로 바꾸세요" },
            { id: "s1fin", name: "1학기 기말고사", date: "", note: "눌러서 내 시험일로 바꾸세요" },
            { id: "s2mid", name: "2학기 중간고사", date: plusDays(18), note: "눌러서 내 시험일로 바꾸세요" },
            { id: "s2fin", name: "2학기 기말고사", date: plusDays(74), note: "눌러서 내 시험일로 바꾸세요" }];
  }

  /* 옛 판에서 넘어온 학생 — 시험이 mid·fin 둘뿐이었다. 2학기 것으로 옮기고
     빠진 1학기 둘을 채운다. 넣어 둔 날짜는 그대로 살린다. */
  function 시험판올리기(list) {
    if (!list || !list.length) return list;
    var 옛 = { mid: "s2mid", fin: "s2fin" }, 바뀜 = false;
    list.forEach(function (e) {
      if (옛[e.id]) { e.id = 옛[e.id]; 바뀜 = true; }
    });
    var 있음 = {};
    list.forEach(function (e) { 있음[e.id] = 1; });
    [["s1mid", "1학기 중간고사"], ["s1fin", "1학기 기말고사"]].forEach(function (x) {
      if (!있음[x[0]]) {
        list.unshift({ id: x[0], name: x[1], date: "", note: "눌러서 내 시험일로 바꾸세요" });
        바뀜 = true;
      }
    });
    if (바뀜) {
      /* 학기 · 중간기말 차례로 세운다 */
      var 순 = { s1mid: 1, s1fin: 2, s2mid: 3, s2fin: 4 };
      list.sort(function (a, b) { return (순[a.id] || 9) - (순[b.id] || 9); });
    }
    return list;
  }
  /* ── 시험 범위 기본값 ───────────────────────────
     ★ 학교마다 범위가 다르다. 안 정하면 **서문여고 기준**으로 세팅한다
       (2026-09-03 대표님 지시). 통사2 단원 ↔ 대영역은 실측으로 확인했다 —
         1단원 F 인권 보장과 헌법, 2단원 G 사회 정의와 불평등
         3단원 H 시장경제, 4단원 I 세계화와 평화, 5단원 J 미래와 지속가능

       서문여고 — 중간 1·2·4단원 = **F·G·I** / 기말 3·5단원 = **H·J**

     ★ 이것이 기본값이라는 사실을 **감추지 않는다.** 화면에 "서문여고 기준" 이라 적고
       자기 학교로 고치라고 알린다. 남의 학교 범위로 공부하면 안 된다. */
  var 기본범위 = {
    학교: "서문여고",
    /* ★ 2학기(통합사회 2) 는 서문여고 **실측**이다 — 대표님이 알려 주신 값. */
    s2mid: { name: "2학기 중간고사", 과목: "통합사회 2", 단원: "1단원(헌법의 역할까지)·2·4단원",
             roots: ["F", "G", "I"], 근거: "실측",
             /* ★ 1단원은 권력분립(F3)까지 — 준법·시민 참여(F4)·노동권(F5)·국내외 인권(F6)은 이번 범위 밖(2026-09-17 대표님) */
             mids: ["F1", "F2", "F3", "G", "I"],
             /* ★ "권력 분립까지" — 국가 기관(F3) 가운데 지방 자치·주민 참여(F3.6)는 시민 참여 쪽이라 뺀다(2026-09-18 대표님) */
             drop: ["F3.6"] },
    s2fin: { name: "2학기 기말고사", 과목: "통합사회 2", 단원: "3·5단원",
             roots: ["H", "J"], 근거: "실측" },
    /* ★ 1학기(통합사회 1) 는 **추정**이다. 서문여고에서 확인된 것은 통사2 뿐이라,
       교과서 진도 순서대로 앞 셋·뒤 둘로 갈랐다. 화면에서 추정이라고 밝힌다 —
       모르는 것을 아는 척 내면 그게 거짓말이 된다. */
    s1mid: { name: "1학기 중간고사", 과목: "통합사회 1", 단원: "1·2·3단원",
             roots: ["A", "B", "C"], 근거: "추정" },
    s1fin: { name: "1학기 기말고사", 과목: "통합사회 1", 단원: "4·5단원",
             roots: ["D", "E"], 근거: "추정" }
  };

  /* 시험 id 로 그 시험의 기본 범위를 돌려준다(없으면 null) */
  function 범위_시험별(id) {
    var b = 기본범위[id];
    if (!b) return null;
    return { key: id, name: b.name, 과목: b.과목, 단원: b.단원,
             roots: b.roots.slice(), mids: (b.mids || b.roots).slice(), 근거: b.근거, 학교: 기본범위.학교 };
  }

  /* 지금 다가온 시험에 맞는 기본 범위를 돌려준다 */
  function 기본범위지금() {
    var x = 다가온시험();
    var id = (x && x.exam && x.exam.id) || "";
    /* 옛 id 로 들어오는 자리가 남아 있을 수 있다 */
    if (id === "mid") id = "s2mid";
    if (id === "fin") id = "s2fin";
    return 범위_시험별(id) || 범위_시험별("s2mid");
  }

  /* 범위를 **한 번도 안 정했으면** 기본값을 넣는다.
     ★ 학생이 고른 값은 절대 덮지 않는다 — `scopeAt` 이 있으면 손대지 않는다. */
  function 범위기본값채우기() {
    if (S.scopeAt) return null;                 // 이미 정한 적이 있다
    /* ★ 자동으로 넣어 둔 옛 값(대영역 통째)이면 새 기본값(중단원까지)으로 바꿔 준다 — 학생이 정한 값은 안 건드린다 */
    if (scopeOn() && S.scopeAuto) {
      var b0 = 기본범위지금();
      if (b0 && b0.mids && JSON.stringify(scope().slice().sort()) === JSON.stringify(b0.roots.slice().sort()) &&
          JSON.stringify(b0.mids.slice().sort()) !== JSON.stringify(b0.roots.slice().sort())) {
        try { localStorage.setItem("terra.scope", JSON.stringify(b0.mids)); } catch (e) {}
        return b0;
      }
    }
    if (scopeOn()) return null;                 // 어떤 이유로든 이미 켜져 있다
    var g = (S.student && S.student.grade) || "고1";
    if (g !== "고1") return null;               // 고1 기준이다
    var b = 기본범위지금();
    /* ★ 범위는 `S` 가 아니라 localStorage["terra.scope"] 에 산다(scope() 가 읽는 곳).
       S.scope 에 넣으면 값이 들어가도 scopeOn() 이 false 다.
       ★ setScope() 를 부르면 안 된다 — 그 함수는 scopeAt 을 남겨
         "학생이 직접 정했다" 로 기록한다. 자동 기본값은 그 표시를 남기지 않는다. */
    try { localStorage.setItem("terra.scope", JSON.stringify(b.mids || b.roots)); } catch (e) {}
    S.scopeAuto = true;                          // ★ 자동으로 넣은 값이라는 표시
    save();
    return b;
  }

  /* 지금 범위가 **자동으로 넣은 것**인가 — 화면이 "서문여고 기준" 이라 밝힐 때 쓴다 */
  function 범위자동인가() { return !!S.scopeAuto && !S.scopeAt; }

  /* ★★ 개념트리가 그릴 대영역 (2026-09-04 대표님 지시)
     전에는 학년 필터(`보이는대영역`)만 걸고 **시험 범위를 아예 안 봤다** —
     설정에서 범위를 F·G·I 로 잡아도 지도는 A~J 를 다 그렸다.
     시험을 고르면 그 범위만 그린다. 범위를 지우면 다시 전부 나온다.
     ★ 범위 안에 아무것도 안 남으면(자료가 없는 조합) 전부를 돌려준다 —
       빈 지도를 내는 것보다 낫다. */
  function 스킬트리대영역() {
    var rs = 보이는대영역();
    if (!scopeOn()) return rs;
    var 안 = rs.filter(function (r) { return inScope(r.code); });
    return 안.length ? 안 : rs;
  }

  function exams() {
    var g = S.student.grade || "고1";
    if (!S.exams) S.exams = {};
    if (!S.exams[g]) { S.exams[g] = defaultExams(g); flush(); }
    /* 옛 판(mid·fin 둘) 에서 넘어온 학생을 학기 넷으로 올린다 */
    if (g === "고1") {
      var 전 = JSON.stringify(S.exams[g]);
      시험판올리기(S.exams[g]);
      if (JSON.stringify(S.exams[g]) !== 전) flush();
    }
    return S.exams[g];
  }
  function setExam(id, patch) {
    exams().forEach(function (e) {
      if (e.id === id) { for (var k in patch) e[k] = patch[k]; if (patch.date) e.note = "직접 입력한 일정"; }
    });
    flush();
  }
  function addExam(name, date) {
    exams().push({ id: "e" + Date.now(), name: name || "새 일정", date: date || "", note: "직접 입력한 일정" });
    flush();
  }
  function dday(dateStr) {
    if (!dateStr) return null;
    var t = new Date(dateStr + "T00:00:00"), n = new Date();
    var a = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    var diff = Math.round((t - a) / 86400000);
    return { days: diff, label: diff === 0 ? "D-DAY" : diff > 0 ? "D-" + diff : "D+" + (-diff),
             past: diff < 0,
             pretty: (t.getMonth() + 1) + "월 " + t.getDate() + "일 (" +
                     ["일", "월", "화", "수", "목", "금", "토"][t.getDay()] + ")" };
  }

  /* ── 리포트 ───────────────────────────────────── */
  function aggregate(keys) {
    var set = {}; keys.forEach(function (k) { set[k] = 1; });
    var dk = keys[keys.length - 1];
    var ev = S.ev.filter(function (e) { return set[e.d]; });
    var ans = 0, ok = 0, drills = 0, dok = 0, leaves = {}, wrong = [];
    ev.forEach(function (e) {
      if (e.k === "a") {
        ans++; if (e.ok) ok++; leaves[e.leaf] = (leaves[e.leaf] || 0) + 1;
        if (!e.ok) wrong.push({ leaf: e.leaf, name: BY[e.leaf] ? BY[e.leaf].name : e.leaf, q: e.q });
      }
      if (e.k === "x") { drills++; if (e.ok) dok++; }
    });
    var weak = LEAVES.map(function (l) { return leafStat(l.code); })
      .filter(function (s) { return s.solved >= 2 && s.pct !== null && s.pct < 65; })
      .sort(function (a, b) { return a.pct - b.pct; });
    return { date: dk, answers: ans, correct: ok, pct: ans ? Math.round(ok / ans * 100) : null,
             drills: drills, drillOk: dok, leaves: Object.keys(leaves), leafMap: leaves,
             wrong: wrong, weak: weak.slice(0, 3), streak: streak(dk) };
  }
  function report(dk) { return aggregate([dk || dayKey()]); }
  function rangeReport(kind, endKey) {
    var n = kind === "week" ? 7 : kind === "month" ? 30 : kind === "quarter" ? 90 : 1;
    var keys = daysBack(n, endKey), r = aggregate(keys);
    var seen = {}; S.ev.forEach(function (e) { seen[e.d] = 1; });
    r.kind = kind; r.days = n; r.from = keys[0]; r.to = keys[keys.length - 1];
    r.activeDays = keys.filter(function (k) { return seen[k]; }).length;
    return r;
  }
  function streak(dk) {
    var days = {}; S.ev.forEach(function (e) { days[e.d] = 1; });
    var n = 0, d = new Date(dk + "T12:00:00");
    while (days[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function weekSeries(dk) {
    dk = dk || dayKey();
    var out = [], d = new Date(dk + "T12:00:00");
    d.setDate(d.getDate() - 6);
    for (var i = 0; i < 7; i++) {
      var k = dayKey(d), a = 0, o = 0;
      S.ev.forEach(function (e) { if (e.d === k && e.k === "a") { a++; if (e.ok) o++; } });
      out.push({ d: k, ans: a, ok: o,
                 label: ["일", "월", "화", "수", "목", "금", "토"][new Date(k + "T12:00:00").getDay()] });
      d.setDate(d.getDate() + 1);
    }
    return out;
  }

  /* ══════════════════════════════════════════════
     시연용 표본 — 최근 14일. 실제 계정이 붙으면 이 블록만 지운다.
     ══════════════════════════════════════════════ */
  function seedDemo(force) {
    if (S.seeded && !force) return;
    S = blank(); S.seeded = true;
    var now = new Date();
    /* 핵심 등급 리프부터 앞에서 순서대로, 최근일수록 최근 날짜 */
    var order = LEAVES.filter(function (l) { return l.play.length; })
      .sort(function (a, b) {
        var w = (GRADE_W[b.grade] || 0) - (GRADE_W[a.grade] || 0);
        return w || a.code.localeCompare(b.code);
      }).slice(0, 26);
    order.forEach(function (l, i) {
      var back = Math.round((order.length - 1 - i) * 13 / Math.max(1, order.length - 1));
      var d = new Date(now); d.setDate(d.getDate() - back);
      d.setHours(back === 0 ? now.getHours() : 20, 0, 0, 0);
      var take = Math.max(2, Math.round(l.play.length * (0.35 + seed("t" + l.code) * 0.5)));
      l.play.slice(0, take).forEach(function (q, k) {
        var r = seed("q" + q.id);
        var ok = r > (l.grade === "심화" ? 0.42 : 0.26);
        S.ans[q.id] = { ok: ok, p: ok ? q.a : (q.a + 1) % 5, at: d.getTime() + k * 60000 };
        S.ev.push({ k: "a", d: dayKey(d), leaf: l.code, q: q.id, ok: ok, at: d.getTime() + k * 60000 });
      });
      S.last = { leaf: l.code, at: d.getTime() };
    });
    flush();
  }

  /* ── 백엔드 (있으면) ──────────────────────────── */
  var BASE = window.TERRA_API ||
    (location.hostname === "localhost" || location.hostname === "127.0.0.1" ? "http://localhost:4100" : "/api");
  var alive = null;
  function available() {
    if (alive !== null) return Promise.resolve(alive);
    if (!window.fetch) { alive = false; return Promise.resolve(false); }
    return fetch(BASE + "/health/live", { credentials: "include" })
      .then(function (r) { alive = r.ok; return alive; }).catch(function () { alive = false; return false; });
  }

  /* ── 공통 네비 ────────────────────────────────── */
  /* ── 스킨 ──
     내용은 그대로 두고 옷만 갈아입는다. 고른 값은 이 브라우저에 남는다.
     화면이 뜨기 전에 <head> 안 한 줄이 먼저 입혀 준다(깜빡임 방지). */
  var SKINS = [{id: "paper", name: "종이", dot: "#FAF8F3"},   /* 기본 — 모두의 수학 모눈 노트 (2026-09-16) */
               {id: "", name: "밤", dot: "#0B1120"},
               {id: "note", name: "모눈 노트", dot: "#F0EBDA"},
               {id: "jelly", name: "젤리", dot: "#FFC2DC"},
               {id: "white", name: "화이트", dot: "#FFFFFF"}];
  function skin() {
    try {
      var v = localStorage.getItem("terra.skin");
      if (v === null || v === "") v = "paper";   // 아무것도 안 골랐거나 옛 빈 값이면 종이(기본)
      if (v === "night") v = "";              // 밤을 직접 고른 학생은 "night" 로 남겨 둔다
      if (v === "diary") { v = "jelly"; localStorage.setItem("terra.skin", v); }  // 옛 값 이사
      if (v && !SKINS.some(function (k) { return k.id === v; })) v = "";
      return v;
    } catch (e) { return ""; }
  }
  function setSkin(v) {
    try { localStorage.setItem("terra.skin", v || "night"); }   /* 밤은 "night" — 비워 두면 기본(종이)이 된다 */
    catch (e) {}
    if (v) document.documentElement.dataset.skin = v;
    else delete document.documentElement.dataset.skin;
    document.querySelectorAll("[data-skinbtn]").forEach(function (b) {
      b.setAttribute("aria-pressed", b.dataset.skinbtn === v);
    });
    window.dispatchEvent(new CustomEvent("terra:skin", {detail: v}));
  }
  function skinPick() {
    var now = skin();
    return '<div class="skinpick" role="group" aria-label="화면 옷">' + SKINS.map(function (k) {
      return '<button data-skinbtn="' + k.id + '" aria-pressed="' + (k.id === now) + '">' +
        '<i style="background:' + k.dot + ';box-shadow:0 0 0 1px rgba(128,128,128,.45)"></i>' +
        '<span>' + k.name + '</span></button>';
    }).join("") + '</div>';
  }

  /* ══════ 처방 ══════
     학생은 "무엇을 얼마나" 를 스스로 못 정한다. 목표일에서 역산해 정해 준다.

     오늘 할 일의 순서
       1) 복습    틀린 지 3일·7일·21일이 지난 문항 — 가장 먼저 되돌린다
       2) 이어서  마지막으로 보던 단원
       3) 새로    아직 손 안 댄 단원 가운데 학습 무게가 큰 곳
       4) 트레이닝 하루 한 세트
     분량은 남은 문항 ÷ 남은 날. 너무 크면 하루 상한에서 자른다. */
  var DAY = 86400000;
  var SPACING = [3, 7, 21];           // 틀린 뒤 며칠에 되돌릴 것인가
  var CAP = 60, FLOOR = 10;           // 하루 상한·하한

  function dueList() {
    /* 되돌릴 때가 된 문항 — 틀린 지 3·7·21일이 지났고 그 뒤로 안 푼 것 */
    var out = [], now = Date.now();
    for (var qid in S.ans) {
      var a = S.ans[qid];
      if (a.ok) continue;
      var days = (now - (a.at || now)) / DAY;
      var step = 0;
      for (var i = 0; i < SPACING.length; i++) if (days >= SPACING[i]) step = i + 1;
      if (!step) continue;
      var q = QOF[qid];
      if (!q) continue;
      out.push({ q: qid, leaf: q.leaf, days: Math.floor(days), step: step });
    }
    out.sort(function (x, y) { return y.days - x.days; });
    return out;
  }

  function quota() {
    /* 오늘 몇 문항 — 목표일까지 남은 날로 나눈다 */
    var o = overall(), list = exams().filter(function (e) { return e.date; });
    var d = null;
    list.sort(function (a, b) { return (a.date || "").localeCompare(b.date || ""); });
    for (var i = 0; i < list.length; i++) {
      var dd = dday(list[i].date);
      if (dd && dd.days >= 0) { d = { name: list[i].name, days: dd.days, date: list[i].date }; break; }
    }
    var remain = Math.max(0, o.play - o.solved);
    var perDay = d && d.days > 0 ? Math.ceil(remain / d.days) : Math.ceil(remain / 60);
    var target = Math.max(FLOOR, Math.min(CAP, perDay));
    return { target: target, remain: remain, exam: d, raw: perDay,
             capped: perDay > CAP, done: report().answers + report().drills };
  }

  function prescribe() {
    /* 오늘의 차례 — 앞에서부터 하나씩 내민다 */
    var q = quota(), due = dueList(), steps = [];
    var byLeaf = {};
    due.forEach(function (d) { (byLeaf[d.leaf] = byLeaf[d.leaf] || []).push(d.q); });
    var leaves = Object.keys(byLeaf).sort(function (a, b) {
      return byLeaf[b].length - byLeaf[a].length;
    });
    if (leaves.length) {
      var l0 = BY[leaves[0]];
      steps.push({ kind: "due", n: byLeaf[leaves[0]].length, leaf: leaves[0],
        title: "복습할 때가 됐어요",
        say: (l0 ? l0.name : leaves[0]) + " 에서 틀린 " + byLeaf[leaves[0]].length +
             "문항이 다시 나올 차례예요.",
        href: "study.html?leaf=" + leaves[0] + "&mode=wrong", cta: "복습하기" });
    }
    if (S.last && S.last.leaf && BY[S.last.leaf]) {
      var ls = leafStat(S.last.leaf);
      if (ls.solved < ls.play)
        steps.push({ kind: "cont", leaf: S.last.leaf,
          title: "보던 데를 마저",
          say: BY[S.last.leaf].name + " — " + ls.solved + " / " + ls.play + "문항까지 왔어요.",
          href: "study.html?leaf=" + S.last.leaf, cta: "이어서 풀기" });
    }
    var fresh = LEAVES.filter(function (l) {
      return leafStat(l.code).solved === 0 && l.play.length >= 5;
    }).sort(function (a, b) { return (b.vol || 0) - (a.vol || 0); })[0];
    if (fresh)
      steps.push({ kind: "new", leaf: fresh.code,
        title: "처음 배우는 개념",
        say: fresh.name + " — 아직 손 안 댄 곳 가운데 시험에서 제일 무겁습니다.",
        href: "study.html?leaf=" + fresh.code, cta: "시작하기" });
    var dr = drillStat();
    steps.push({ kind: "drill",
      title: "하루 한 세트",
      say: dr.n ? "Killer Drill을 " + dr.n + "문항 풀었어요. 오늘 한 세트 더?"
                : "킬러 유형은 하루 한 세트씩만 해도 감이 붙어요.",
      href: "drill.html", cta: "Killer Drill" });
    return { quota: q, steps: steps, due: due.length };
  }

  /* ══════ 하루 15분 루틴 ══════
     개수가 아니라 **시간**으로 말한다. 끝이 보여야 매일 한다.
     분은 추정이다 — 문항 50초, 강의는 편성 길이, 트레이닝 한 세트 3분.  */
  var SEC_PER_Q = 50;                    // 문항 하나에 쓰는 시간(추정)
  var DRILL_MIN = 3;                     // 트레이닝 한 세트
  var GOAL_DEFAULT = 15;

  function goalMin() {
    try { var v = parseInt(localStorage.getItem("terra.goalmin"), 10);
          if (v >= 5 && v <= 60) return v; } catch (e) {}
    return GOAL_DEFAULT;
  }
  function setGoalMin(v) {
    /* 읽을 때와 같은 범위로 잘라서 넣는다 — 안 그러면 저장은 됐는데
       읽으면 기본값이 나와 "바꿨는데 안 바뀐다" 가 된다 */
    v = Math.max(5, Math.min(60, parseInt(v, 10) || GOAL_DEFAULT));
    try { localStorage.setItem("terra.goalmin", String(v)); } catch (e) {}
    return v;
  }

  /* 그날 실제로 쓴 분 — 문항·트레이닝·강의를 합친다 */
  function spentOn(dk) {
    var q = 0, x = 0, l = 0;
    S.ev.forEach(function (e) {
      if (e.d !== dk) return;
      if (e.k === "a") q++;
      else if (e.k === "x") x++;
      else if (e.k === "l") l += (e.m || 0);
    });
    return { min: Math.round((q * SEC_PER_Q + x * 12) / 60) + l,
             q: q, drill: x, lec: l };
  }

  /* 오늘의 15분을 어떻게 채울 것인가 */
  /* ── 시험이 며칠 남았나 · 지금 어느 모드인가 ─────────────
     시험 10일 전부터는 매일 한 회씩 실전으로 푼다.
     그 전에는 15분씩 약점을 채운다. 경계는 대표님이 정한 10일. */
  var 실전시작일 = 10;

  function 다가온시험() {
    var best = null;
    (exams() || []).forEach(function (e) {
      if (!e.date) return;
      var d = dday(e.date);
      if (!d || d.days < 0) return;             // 이미 지난 시험
      if (!best || d.days < best.days) best = { exam: e, days: d.days, label: d.label };
    });
    return best;
  }

  /* "fill" = 약점 채우기 · "real" = 실전 모의고사 */
  /* ── 지금이 어느 철인가 ─────────────────────────
     달로 판단한다. 학사 일정은 학교마다 조금 다르지만 방학 달은 거의 같다.
     자동 판정이 틀릴 수 있으므로 **끌 수 있어야** 한다(설정의 season.off). */
  function 방학인가(d) {
    if (S.season && S.season.off) return false;
    var 달 = (d || new Date()).getMonth() + 1;
    var 목록 = (window.SEASON || {}).방학달 || [];
    return 목록.indexOf(달) >= 0;
  }

  /* 방학의 앞쪽 절반은 **보충**, 뒤쪽 절반은 **선행**이다.
     진도 압박이 없는 유일한 시기라 하는 일이 아예 다르다. */
  function 방학단계(d) {
    var 날 = (d || new Date()).getDate();
    return 날 <= 15 ? "보충" : "선행";
  }

  /* 고3은 시기마다 하는 일이 다르다 — 3~6 개념기출 · 7~9 실전 · 10~11 마무리 */
  function 고3시기(d) {
    var 달 = (d || new Date()).getMonth() + 1;
    var 목록 = (window.SEASON || {}).고3시기 || [];
    for (var i = 0; i < 목록.length; i++) if (달 <= 목록[i].until) return 목록[i];
    return 목록[목록.length - 1] || null;
  }

  /* 오늘이 주간 점검 날인가 — 그리고 이번 주에 이미 했는가 */
  function 주간점검날(d) {
    var 요일 = (window.WEEKLY_DAY == null ? 0 : window.WEEKLY_DAY);
    return (d || new Date()).getDay() === 요일;
  }
  function 주간점검함(dk) {
    return !!(S.weekly && S.weekly[dk]);
  }
  function 주간점검끝(dk) {
    if (!S.weekly) S.weekly = {};
    S.weekly[dk || dayKey()] = 1;
    save();
  }

  /* 시험 범위가 낡았는가 — 학교 진도는 나가는데 범위를 그대로 두면
     **안 배운 데를 푼다.** 마지막으로 정한 날을 본다. */
  function 범위낡음() {
    if (!scopeOn()) return null;
    var at = S.scopeAt || null;
    if (!at) return null;
    var 지남 = Math.floor((Date.now() - at) / DAY);
    var 한도 = (window.SCOPE_STALE_DAYS == null ? 30 : window.SCOPE_STALE_DAYS);
    return 지남 >= 한도 ? { days: 지남, limit: 한도 } : null;
  }

  /* 방금 지나간 시험 — 오늘로부터 며칠 전이었나.
     시험이 끝나면 그대로 손을 놓는다. 그 자리를 메우려면 먼저 알아야 한다. */
  function 지나간시험() {
    var list = (exams() || []).filter(function (e) { return e.date; });
    var 오늘 = dayKey(), 가장가까운 = null;
    list.forEach(function (e) {
      if (e.date >= 오늘) return;                     // 아직 안 지났다
      var d = Math.round((new Date(오늘) - new Date(e.date)) / DAY);
      if (가장가까운 == null || d < 가장가까운.ago) 가장가까운 = { exam: e, ago: d };
    });
    return 가장가까운;
  }

  function examMode() {
    var x = 다가온시험();
    if (x && x.days <= 실전시작일) {
      return { mode: "real", exam: x.exam, days: x.days, label: x.label,
               since: 실전시작일 };
    }
    /* ★ 시험 직후 — 끝난 자리에서 다음으로 건너가게 한다.
       이 모드가 없으면 D-10 이 풀리고 그냥 평시로 돌아간다(가장 큰 이탈 지점). */
    var 뒤 = 지나간시험();
    var 며칠 = (window.AFTER_EXAM_DAYS == null ? 3 : window.AFTER_EXAM_DAYS);
    if (뒤 && 뒤.ago >= 1 && 뒤.ago <= 며칠) {
      return { mode: "after", exam: 뒤.exam, ago: 뒤.ago, days: null,
               label: "시험 뒤 " + 뒤.ago + "일", since: 실전시작일,
               next: x ? x.exam : null };
    }
    /* ★ 방학이면 채우기 모드의 성격이 아예 다르다 —
       진도 압박이 없으니 앞쪽 절반은 보충, 뒤쪽 절반은 선행이다. */
    if (방학인가()) {
      return { mode: "vacation", stage: 방학단계(), exam: x ? x.exam : null,
               days: x ? x.days : null, label: "방학, " + 방학단계(),
               since: 실전시작일,
               untilReal: x ? Math.max(0, x.days - 실전시작일) : null };
    }
    return { mode: "fill", exam: x ? x.exam : null,
             days: x ? x.days : null, label: x ? x.label : "",
             since: 실전시작일,
             untilReal: x ? Math.max(0, x.days - 실전시작일) : null };
  }

  /* 실전 모드의 하루 몫 — 모의고사 45분 + 오답 15분.
     채우기 모드의 15분을 그대로 두면 시험 한 회로 목표가 300% 초과가 되고
     달력이 첫날부터 다 칠해져 숫자가 뜻을 잃는다. */
  var 실전목표분 = 60;

  /* 오늘 모의고사를 이미 봤는가 — 목표 크기와 루틴 내용이 여기서 갈린다 */
  function 오늘시험기록(dk) {
    try {
      var lg = JSON.parse(localStorage.getItem("terra.exam.log") || "[]") || [];
      for (var i = lg.length - 1; i >= 0; i--) if (lg[i].day === dk) return lg[i];
    } catch (e) {}
    return null;
  }

  /* 오늘 시간을 어떤 몫으로 나눌 것인가.
     학년으로 정하되, **고3은 시기마다 다시 갈린다**(3~6 개념기출, 7~9 실전, 10~11 마무리). */
  function 오늘몫표() {
    var 학년 = (S.student && S.student.grade) || "고1";
    if (학년 === "고3") {
      var 시기 = 고3시기();
      if (시기 && 시기.mix) return 시기.mix;
    }
    return (window.GRADE_MIX || {})[학년] ||
           { due: 0.3, lec: 0.45, q: 0.05, drill: 0.2 };
  }

  function routine() {
    var XM = examMode();
    var dk = dayKey();
    var 오늘시험 = XM.mode === "real" ? 오늘시험기록(dk) : null;
    /* 시험을 아직 안 봤으면 45분+오답, 이미 봤으면 오답 정리 크기(20분).
       끝냈는데 60분 그대로 두면 남는 시간을 새 단원으로 채우게 된다. */
    var goal = XM.mode !== "real" ? goalMin()
      : (오늘시험 ? Math.max(goalMin(), 20) : Math.max(goalMin(), 실전목표분));
    var sp = spentOn(dk);
    var items = [], left = goal;
    var due = dueList();

    /* ★ 이번 시험 범위 안인가. 리프 코드는 "C1.1" 처럼 대영역 글자로 시작한다.
       범위를 안 정했으면 inScope 가 늘 참이라 아래는 그대로 지나간다. */
    function 범위안(code) { return inScopeLeaf(code); }
    function 범위로걸러(목록, 코드꺼내기) {
      if (!scopeOn()) return 목록;
      var 안 = 목록.filter(function (x) { return 범위안(코드꺼내기(x)); });
      return 안.length ? 안 : 목록;      // 범위 안에 없으면 넘어간다
    }

    /* ★ 0) 실전 모드면 **모의고사가 맨 앞**이다.
       시험이 열흘 안이면 약점 채우기를 멈추고 매일 한 회씩 실전으로 푼다.
       25문항 45분이라 그날 몫을 거의 다 쓴다 — 그게 맞다.
       이미 오늘 회차를 끝냈으면 오답 보기로 넘어간다. */
    if (XM.mode === "real") {
      var 지난회차 = 오늘시험;
      if (!지난회차) {
        var 분 = 45;
        items.push({ kind: "exam", min: 분,
          title: XM.exam.name + " " + XM.label,
          say: "오늘의 모의고사 25문항",
          why: XM.days <= 3
                 ? "시험이 코앞이에요. 실전처럼 한 번에 풀어 보세요."
                 : "열흘 남았으니 매일 한 회씩. 오늘 틀린 곳이 내일 할 일이 됩니다.",
          href: "exam.html", cta: "시험 보기" });
        left -= Math.min(left, 분);
      } else if (지난회차 && (지난회차.wrong || []).length) {
        /* 오늘 회차를 끝냈다 — 남은 시간은 틀린 것에 쓴다 */
        var 틀린수 = 지난회차.wrong.length;
        var 분2 = Math.max(3, Math.min(left, Math.round(틀린수 * SEC_PER_Q / 60)));
        items.push({ kind: "exwrong", min: 분2, n: 틀린수,
          title: "오늘 시험에서 틀린 것",
          say: 틀린수 + "문항 다시 보기",
          why: "채점하고 덮으면 남는 게 없어요. 틀린 것만 다시 보는 게 제일 빠릅니다.",
          href: "exam.html", cta: "다시 보기" });
        left -= 분2;
      }
    }

    /* ★ 0-2) 시험 직후 — 끝난 시험을 되짚고 다음 범위로 건너간다.
       여기서 아무 말도 안 하면 학생은 그대로 그만둔다. */
    if (XM.mode === "after") {
      var 지난기록 = null;
      try {
        var lg2 = JSON.parse(localStorage.getItem("terra.exam.log") || "[]") || [];
        for (var z = lg2.length - 1; z >= 0; z--) {
          if (lg2[z].wrong && lg2[z].wrong.length) { 지난기록 = lg2[z]; break; }
        }
      } catch (e) {}
      if (지난기록 && 지난기록.wrong.length) {
        var 틀 = 지난기록.wrong.length;
        var 분3 = Math.max(3, Math.min(left, Math.round(틀 * SEC_PER_Q / 60)));
        items.push({ kind: "after", min: 분3, n: 틀,
          title: XM.exam.name + " 끝났어요 — 틀린 것부터",
          say: 틀 + "문항 되짚기",
          why: "시험이 끝난 다음이 가장 잘 남습니다. 답을 아직 기억할 때 보는 게 빠릅니다.",
          href: "exam.html", cta: "되짚기" });
        left -= 분3;
      }
      if (XM.next) {
        items.push({ kind: "nextscope", min: 1,
          title: "다음은 " + XM.next.name,
          say: "시험 범위를 새로 정할 때예요",
          why: "범위를 그대로 두면 이미 끝난 단원을 계속 풉니다.",
          href: "settings.html#scope", cta: "범위 정하기" });
        left -= 1;
      }
    }

    /* ★ 0-3) 주간 점검 — 일요일에 그 주 가장 약한 영역 하나를 묶어서 본다.
       매일 조금씩만 하면 약점이 정리되지 않는다. */
    if (주간점검날() && !주간점검함(dk) && XM.mode !== "real") {
      var 약한영역 = null, 낮은값 = 2;
      ROOTS.forEach(function (r) {
        if (scopeOn() && !inScope(r.code)) return;
        var st = rootStat(r.code);
        if (!st || !st.solved) return;
        var p = st.correct / st.solved;
        if (p < 낮은값) { 낮은값 = p; 약한영역 = r; }
      });
      if (약한영역) {
        var 주분 = Math.max(5, Math.round(goal * 0.5));
        items.push({ kind: "weekly", min: 주분, root: 약한영역.code,
          title: "이번 주 점검",
          say: 약한영역.name + " 집중 정리",
          why: "이번 주 가장 약한 곳이에요(정답률 " + Math.round(낮은값 * 100) + "%). " +
               "한 주에 한 번은 묶어서 봐야 정리됩니다.",
          href: "study.html?root=" + 약한영역.code, cta: "정리하기" });
        left -= 주분;
      }
    }

    /* ★ 0-4) 범위가 낡았다 — 학교 진도는 나가는데 범위를 그대로 두면
       **안 배운 데를 푼다.** 알리기만 하고 시간은 거의 안 쓴다. */
    var 낡 = 범위낡음();
    if (낡 && XM.mode !== "real") {
      items.push({ kind: "scopeold", min: 1,
        title: "시험 범위를 다시 볼 때",
        say: 낡.days + "일째 그대로예요",
        why: "학교 진도는 나갔을 텐데 범위가 그대로면 안 배운 데를 풀게 됩니다.",
        href: "settings.html#scope", cta: "범위 고치기" });
      left -= 1;
    }

    /* ★ 0-5) 방학 — 진도 압박이 없는 유일한 시기다.
       앞쪽 절반은 지난 학기 보충, 뒤쪽 절반은 다음 학기 선행. */
    if (XM.mode === "vacation") {
      items.push({ kind: "vacation", min: 1, stage: XM.stage,
        title: XM.stage === "보충" ? "방학 — 지난 학기 메우기"
                                   : "방학 — 다음 학기 미리 보기",
        say: XM.stage === "보충" ? "약한 곳부터 복습합니다"
                                 : "다음 단원을 미리 훑습니다",
        why: XM.stage === "보충"
          ? "진도 압박이 없는 유일한 시기예요. 밀린 것을 지금 메웁니다."
          : "지금 한 번 훑어 두면 개학 뒤 진도가 쉬워집니다.",
        href: "skilltree.html", cta: "고르기" });
      left -= 1;
    }

    /* 1) 되돌리기 — 학년별 몫만큼 */
    if (due.length) {
      var byLeaf = {};
      due.forEach(function (d) { (byLeaf[d.leaf] = byLeaf[d.leaf] || []).push(d.q); });
      var 리프들 = 범위로걸러(Object.keys(byLeaf), function (x) { return x; });
      var top = 리프들.sort(function (a, b) {
        return byLeaf[b].length - byLeaf[a].length; })[0];
      /* ★ 되돌리기 몫도 학년마다 다르다 — 고3은 '틀린 걸 안 보는 것' 으로 실패한다 */
      var 몫표 = 오늘몫표();
      var due분 = Math.max(3, Math.round(goal * (몫표.due || 0.3)));
      var take = Math.min(byLeaf[top].length, Math.floor(due분 * 60 / SEC_PER_Q));
      var m = Math.max(1, Math.round(take * SEC_PER_Q / 60));
      items.push({ kind: "due", min: m, n: take, leaf: top,
        title: "틀린 문제 다시 풀기", lead: "틀린 문제부터 다시 풀어요",
        say: 부제괄호(BY[top] ? BY[top].name : top) + "에서 틀렸던 " + take + "문항",
        sayShort: String(BY[top] ? BY[top].name : top).split(" — ")[0] + " " + take + "문항",
        why: due[0].days + "일 전에 틀린 문제예요. 잊기 전에 다시 풀어요.",
        href: "study.html?leaf=" + top + "&mode=wrong", cta: "다시 풀기" });
      left -= m;
    }

    /* 2) 오늘 강의 — 안 들은 것 가운데 무게 큰 순, 남은 시간만큼만 */
    var LEC = window.LECT || {}, VID = window.VIDEO || {};
    var cand = [];
    for (var mk in LEC) {
      (LEC[mk].lectures || []).forEach(function (v) {
        var vd = VID[v.code];
        if (!vd) return;                                   // 영상이 없으면 권하지 않는다
        var len = Math.max(1, Math.round(vd.min || v.min || 0));
        var seen = watched(v.code);
        if (seen >= len) return;                           // 다 봤다
        cand.push({ mid: mk, midName: LEC[mk].name, root: LEC[mk].rootName,
                    fam: LEC[mk].fam, v: v, seen: seen, len: len,
                    title: vd.title || v.title, sum: vd.sum || "",
                    rest: len - seen, wt: v.vol || 0 });
      });
    }
    /* 시험 범위를 정했으면 그 범위의 강의만 권한다 */
    cand = 범위로걸러(cand, function (c) { return c.v.code; });
    /* 보던 것이 있으면 그것부터, 없으면 무게 큰 것부터 */
    cand.sort(function (a, b) {
      if ((b.seen > 0) !== (a.seen > 0)) return b.seen > 0 ? 1 : -1;
      return b.wt - a.wt;
    });
    /* ★ 강의 몫도 학년마다 다르다.
       고1은 처음 배우는 것이 계속 나오므로 강의가 절반이고,
       고3은 이미 다 배웠으므로 **기본 배치에서 뺀다**(몫 0). */
    var 몫표2 = 오늘몫표();
    var lec몫 = Math.round(goal * (몫표2.lec == null ? 0.45 : 몫표2.lec));
    var lecMin = Math.max(0, Math.min(left - DRILL_MIN, lec몫));
    if (cand.length && lecMin >= 3) {
      var c = cand[0], part = Math.min(c.rest, lecMin);
      /* ★ 학년마다 강의의 **뜻이 다르다.**
         고1은 처음 배우는 것이고, 고2·고3은 **이미 배운 것을 되짚는 것**이다.
         "오늘 들을 강의" 라고 하면 고2에게는 틀린 말이 된다. */
      var 학년2 = (S.student && S.student.grade) || "고1";
      var 강의제목 = c.seen ? "보던 강의 이어서"
        : (학년2 === "고1" ? "오늘 들을 강의" : "잊었으면 다시 보기");
      items.push({ kind: "lec", min: part, code: c.v.code, mid: c.mid,
        title: 강의제목,
        say: c.title,
        why: c.seen ? ("전체 " + c.len + "분 가운데 " + c.seen + "분까지 봤어요.")
                    : (c.sum ? c.sum
                             : c.root + ", " + c.midName + ", " + c.v.grade) +
                      (c.rest > part ? (", 전체 " + c.len + "분 중 오늘 " + part + "분") : ""),
        href: "skilltree.html?lec=" + c.v.code, cta: c.seen ? "이어 보기" : "보기" });
      left -= part;
    }

    /* ★ 2-2) 개념 체크(OX) — **배운 직후에 확인하는 자리**다.
       강의를 봤으면 바로 뒤에 넣는다. 그때가 가장 잘 남는다.
       강의가 없었으면 되돌릴 것도 없고 시간이 남을 때만 넣는다 —
       아무 때나 넣으면 15분이 넘친다.

       ★ 확신도를 함께 묻기 때문에 그냥 문제풀이와 다르다.
         "확실하다고 했는데 틀린 것"(오개념)을 잡아내는 것이 이 항목의 값어치다. */
    var 강의봄 = items.some(function (x) { return x.kind === "lec"; });
    /* 2-2) ★ 강의가 없으면 **개념 카드**가 배우는 자리다(2026-09-06 — 드림3기 영상 전부 폐기로
       VIDEO 가 비었다. 대표님: "강의 선호하면 강의, 개념카드 보고 공부하고 싶으면 그걸로").
       카드가 있는 리프 가운데 오늘의리프 점수가 가장 큰 것 하나. 카드 없는 화면(cards.js 안 실림)에서는
       권하지 않는다 — 없는 것을 권하면 "준비 중" 함정과 같다. */
    var 배움 = 강의봄;
    /* 카드 몫은 강의 몫과 같다 — 학년마다 다르다(고1 절반 · 고2 되짚기 · 고3 0).
       고정 4분으로 두면 고1의 문항 시간이 고2보다 길어져 학년 차이가 뒤집힌다(검산기가 잡았다). */
    var CARD몫 = Math.max(0, Math.min(left - DRILL_MIN, lec몫));
    if (!강의봄 && window.CARDS && CARD몫 >= 3 && XM.mode !== "real") {
      var 카드후보 = 오늘의리프({ 전부: true }).filter(function (c) {
        return window.CARDS[c.code] && window.CARDS[c.code].cards.length;
      });
      if (카드후보.length) {
        var cc = 카드후보[0], 장 = Math.min(5, window.CARDS[cc.code].cards.length, Math.max(2, Math.round(CARD몫 / 1.4)));
        var 학년3 = (S.student && S.student.grade) || "고1";
        items.push({ kind: "card", min: CARD몫, leaf: cc.code, n: 장,
          title: 학년3 === "고1" ? "오늘 개념 읽기" : "개념 다시 읽기",
          say: cc.st.name + " " + 장 + "개",
          why: "읽고 바로 확인해요. 강의 대신 이걸로 배우고, 다 맞히면 문제로 넘어가요.",
          href: "card.html?leaf=" + cc.code, cta: "읽기" });
        left -= CARD몫; 배움 = true;
      }
    }

    var OX몫 = 3;
    if (left >= OX몫 && (배움 || !due.length) && XM.mode !== "real") {
      /* ★ 홈은 **개수만** 알면 된다 — "여덟 문장이 되는가".
         그 한 가지 때문에 800KB 짜리 전문을 첫 화면에 싣지 않는다.
         `js/oxindex.js` 가 단원별 개수표(0.4KB)다. 전문이 이미 실려 있으면
         (개념 체크 화면) 그것을 쓴다. 둘 다 사상가를 **배우는 단원**으로 센다. */
      var 몇개 = (function () {
        if (window.OXBANK && window.OXBANK.length) {
          return window.OXBANK.filter(function (z) {
            return !scopeOn() || inScopeItem(z);
          }).length;
        }
        var IX = window.OXINDEX;
        if (!IX) return 0;
        if (!scopeOn()) return IX.n || 0;
        var n = 0;
        Object.keys(IX.byRoot || {}).forEach(function (r) {
          if (inScope(r)) n += IX.byRoot[r];
        });
        return n;
      })();
      if (몇개 >= 8) {
        items.push({ kind: "ox", min: OX몫, n: 8,
          title: 배움 ? "O·X로 바로 확인" : "개념 체크",
          say: "O·X 여덟 문장",
          why: 배움
            ? (강의봄 ? "방금 본 강의를 확인하는 자리예요. 지금이 제일 잘 남습니다."
                      : "방금 읽은 개념을 O·X로 확인해요.")
            : "얼마나 확신하는지도 함께 고르면, 틀렸을 때 무엇을 할지 바로 알려 드려요.",
          href: "ox.html", cta: "개념 체크" });
        left -= OX몫;
      }
    }

    /* 3) 트레이닝 한 세트 — **어느 훈련인지 집어 준다.**
       "킬러 유형 5문항" 이라고만 하면 학생이 또 알아서 골라야 한다.
       시험 범위가 있으면 그 안에서, 아직 손 안 댄 것부터 권한다. */
    if (left >= DRILL_MIN) {
      /* ★ 그 학생에 맞춰 고른다 — 수준(누적·성취도)과 파트(약점·묵은 정도).
         전에는 "아직 손 안 댄 것 중 첫 번째" 였다. 잘하는 학생과 못하는 학생에게
         같은 것이 나갔다(2026-09-03 대표님 지적). */
      var 골라 = 훈련추천(true);
      var 하나 = 골라 ? 골라.pick : null;
      /* 고1은 범위가 정해지면 유형 훈련 대신 **내신 킬러드릴**(범위 안 3점 자리)로 간다 (2026-09-17 대표님) */
      var 내신킬러 = scopeOn() && ((S.student && S.student.grade) || "고1") === "고1";
      if (하나) {
        var st9 = 골라.stat || drillStat(하나.id);
        /* ★ **왜 이것이 나왔는지** 말해 준다. 수준과 약점으로 골랐으므로
           "안 해 본 것" 한 마디로는 설명이 안 된다 — 학생이 납득해야 한다. */
        var 까닭 = st9.n === 0
          ? "아직 안 해 본 Killer Drill이에요."
          : (st9.pct != null && st9.pct < 60
              ? "지난번 정답률이 " + st9.pct + "%였어요. 여기가 지금 제일 약합니다."
              : "해 둔 지 좀 됐어요. 잊기 전에 한 번 돌립니다.");
        items.push({ kind: "drill", min: DRILL_MIN, drill: 하나.id,
          title: scopeOn() ? (내신킬러 ? "내신 킬러드릴" : "시험 범위 Killer Drill")
                           : (골라.level === "기초" ? "준킬러부터" : "오늘의 킬러"),
          say: 내신킬러 ? "시험 범위에서 어렵게 나오는 자리" : 하나.name + " 한 세트",
          why: 내신킬러 ? "실제 기출에서 3점으로 나온 자리부터 풀어요." : (하나.tier ? "준킬러예요. " : "킬러예요. ") + 까닭,
          href: 내신킬러 ? "naeshin.html" : "drill.html?type=" + 하나.id, cta: "Killer Drill" });
      } else {
        items.push({ kind: "drill", min: DRILL_MIN,
          title: "마무리 한 세트", say: "킬러 유형 5문항",
          why: "짧게 매일 하는 게 몰아서 하는 것보다 오래 남아요.",
          href: "drill.html", cta: "Killer Drill" });
      }
      left -= DRILL_MIN;
    }

    /* 남으면 문제풀이로 채운다.
       ★ 실전 모드에서는 **새 단원을 열지 않는다.** 시험이 코앞이면
         아는 것을 굳히고 틀린 것을 메우는 편이 낫다. 여드레 남은 학생에게
         새 단원 61문항을 시키는 것은 나쁜 조언이다. */
    if (left >= 2) {
      var tgt = null, 왜 = "", 제목 = "";
      if (XM.mode === "real") {
        /* 범위 안에서 이미 풀어 봤고 정답률이 낮은 곳 — 굳힐 자리다 */
        var 약한 = 범위로걸러(LEAVES.filter(function (l) {
          var st = leafStat(l.code);
          return st.solved >= 3 && st.pct !== null && st.pct < 80;
        }), function (l) { return l.code; })
          .sort(function (a, b) { return leafStat(a.code).pct - leafStat(b.code).pct; })[0];
        tgt = 약한;
        제목 = "약한 곳 굳히기";
        왜 = 약한 ? ("여기 정답률이 " + leafStat(약한.code).pct + "%예요. " +
                    "시험 전에는 새로 벌이는 것보다 이걸 메우는 게 빠릅니다.") : "";
        if (!tgt && S.last && BY[S.last.leaf]) {
          tgt = BY[S.last.leaf]; 제목 = "보던 데 마저";
          왜 = "시험이 가까우니 새로 열지 말고 보던 것부터 끝냅시다.";
        }
      } else {
        var fresh = 범위로걸러(LEAVES.filter(function (l) {
          return leafStat(l.code).solved === 0 && l.play.length >= 5;
        }), function (l) { return l.code; })
          .sort(function (a, b) { return (b.vol || 0) - (a.vol || 0); })[0];
        tgt = fresh || (S.last && BY[S.last.leaf]);
        제목 = fresh ? "처음 배우는 개념" : "보던 데 마저";
        왜 = fresh ? "아직 손 안 댄 곳 가운데 시험에서 제일 무거워요."
                   : "여기까지 하면 오늘 몫이 끝나요.";
      }
      if (tgt) {
        var nq = Math.max(2, Math.floor(left * 60 / SEC_PER_Q));
        items.push({ kind: "q", min: left, n: nq, leaf: tgt.code,
          title: 제목, say: tgt.name + " " + nq + "문항", why: 왜,
          href: "study.html?leaf=" + tgt.code +
                (XM.mode === "real" ? "&mode=wrong" : ""), cta: "풀기" });
      }
    }

    /* 화면이 "이건 범위 밖이에요" 를 적을 수 있게 알려 준다 */
    var 밖 = items.filter(function (it) {
      var code = it.leaf || it.code;
      return scopeOn() && code && !범위안(code);
    }).length;
    return { goal: goal, spent: sp.min, done: sp.min >= goal,
             pct: Math.min(1, goal ? sp.min / goal : 0),
             items: items, detail: sp, dueCount: due.length,
             scoped: scopeOn(), outOfScope: 밖,
             examMode: XM.mode, exam: XM.exam, dday: XM.days, ddayLabel: XM.label,
             untilReal: XM.untilReal };
  }

  /* 이번 달 달력 — 채운 날은 칠한다 */
  function calendar(ym) {
    var now = new Date();
    var y = ym ? +ym.slice(0, 4) : now.getFullYear();
    var m = ym ? +ym.slice(5, 7) - 1 : now.getMonth();
    var first = new Date(y, m, 1), last = new Date(y, m + 1, 0);
    var goal = goalMin(), out = [], tk = dayKey();
    for (var i = 0; i < first.getDay(); i++) out.push(null);
    for (var d = 1; d <= last.getDate(); d++) {
      var k = dayKey(new Date(y, m, d));
      var sp = spentOn(k);
      out.push({ day: d, key: k, min: sp.min,
                 lv: sp.min >= goal ? 2 : (sp.min > 0 ? 1 : 0),
                 today: k === tk, future: k > tk });
    }
    var days = out.filter(Boolean);
    return { y: y, m: m + 1, cells: out,
             full: days.filter(function (c) { return c.lv === 2; }).length,
             some: days.filter(function (c) { return c.lv === 1; }).length,
             streak: report().streak, goal: goal };
  }

  /* ══════ 학년별 문항 갈래 ══════
     고1 에게 통합사회는 **지금 학교에서 배우는 과목**이고,
     고3 에게는 **선택과목 수능**이 시험이다. 같은 문항 더미를 그대로 주면
     고1 은 안 배운 과목 문제를 80% 풀게 된다(실측 2026-09-01).

       T 통합사회 학평, V 예비시행 — 고1·고2 의 본 문항
       그 밖(G 세계지리·E 윤리와사상 …)  — 고3 의 본 문항

     심화를 감추지는 않는다. 고1 도 수능에 통합사회가 나오므로,
     본 문항이 모자라면 덧붙이고 **왜 붙였는지 밝힌다.** */
  var 통사표 = { "T": 1, "V": 1 };

  /* ── 개념트리에 세울 대영역 ─────────────────────
     ★ 사상가(K)는 `cross: true` — **단원이 아니라 여러 단원을 가로지르는 축**이다.
       롤스는 정의(G)에서, 칸트는 평화(I)에서 만난다.
       별도 축으로 세우면 고1이 "이건 몇 단원이지?" 하고 헷갈린다
       (2026-09-03 대표님 지적).

     ★ 그런데 지우지는 않는다. K 문항 1,106개 중 757개가 K 에만 달려 있고,
       그 대부분은 **고3 선택과목**이다. 고1이 보는 통합사회 문항은 3개뿐이다.
       → **고1·고2 지도에서만 감춘다.** 고3에게는 그대로 둔다. */
  function 보이는대영역(g) {
    g = g || (S.student && S.student.grade) || "고1";
    if (g === "고3") return ROOTS.slice();
    return ROOTS.filter(function (r) { return !r.cross; });
  }

  /* ── 지금 이 학생에게 **본 문항인 과목 코드** ──────────
     한 곳에서 정해야 한다. 화면과 모의고사가 따로 갈라지면
     푸는 문항과 시험지 문항이 어긋난다.

       고1   통합사회
       고2   통합사회 + **켠 확장팩의 과목**  (통합사회는 복습으로 남는다)
       고3   선택과목 전부

     ★ 고2에게 통합사회를 빼지 않는다. 다 배운 과목이지만
       되돌리기가 그 학년의 축이다(2026-09-03 대표님 지적). */
  function 켠확장팩과목() {
    var 켠것 = packs(), out = {};
    PACKS.forEach(function (p) {
      if (켠것.indexOf(p.id) < 0) return;
      (p.subj || []).forEach(function (c) { out[c] = 1; });
    });
    return out;
  }

  function 본과목표(g) {
    g = g || (S.student && S.student.grade) || "고1";
    if (g === "고3") return null;              // null = 통합사회를 뺀 나머지 전부
    if (g === "고2") {
      var 더 = 켠확장팩과목();
      var t = { "T": 1, "V": 1 };
      for (var k in 더) t[k] = 1;
      return t;
    }
    return { "T": 1, "V": 1 };
  }

  function isMain(q, g) {
    g = g || (S.student && S.student.grade) || "고1";
    var 표 = 본과목표(g);
    if (표 === null) return !통사표[q.s];       // 고3 — 선택과목이 본 문항
    return !!표[q.s];
  }
  function splitPool(list, g) {
    var main = [], extra = [];
    (list || []).forEach(function (q) { (isMain(q, g) ? main : extra).push(q); });
    return { main: main, extra: extra };
  }
  /* 그 리프에서 이 학년이 **본 문항으로 실제로 풀 수 있는** 수.
     play 만 세면 문제은행에 안 담긴 것까지 들어가 화면 말("지금 풀 수 있는")과 어긋난다. */
  function mainCount(leaf, g) {
    g = g || (S.student && S.student.grade) || "고1";
    // 미리 집계해 둔 것이 있으면 그것을 쓴다(js/pool.js · 2KB).
    // 문제은행은 3.9MB 라 지도 화면에 통째로 싣지 않는다.
    var P = window.POOL && window.POOL[leaf.code];
    if (P) return g === "고3" ? P[1] : P[0];
    var Q = window.QBANK, n = 0;
    (leaf.play || []).forEach(function (q) {
      if (!isMain(q, g)) return;
      if (Q && !Q[q.id]) return;
      n++;
    });
    return n;
  }

  /* ══════ 시험 범위 ══════
     내신 범위는 학교마다 다르다 — 그래서 **개인 설정**이다.
     고른 대단원 코드를 그대로 담는다. 비어 있으면 전 범위로 본다.

     K(사상가)는 교과서 대단원이 아니라 단원을 가로지르는 축이다.
     정의(G)나 행복(B)이 범위에 들면 사상가도 따라 든다. */
  var 사상가딸림 = { "B": 1, "G": 1, "K": 1 };
  function scope() {
    try {
      var v = JSON.parse(localStorage.getItem("terra.scope") || "[]");
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }
  function setScope(list) {
    /* 학생이 직접 정했다 — 더는 자동 기본값이 아니다 */
    S.scopeAuto = false;
    /* 언제 정했는지 남긴다 — 범위가 낡으면 다시 보라고 해야 한다 */
    S.scopeAt = Date.now();
    try { localStorage.setItem("terra.scope", JSON.stringify(list || [])); } catch (e) {}
  }
  function scopeOn() { return scope().length > 0; }
  /* ★ 범위는 대영역("F")과 중영역("F1")을 섞어 담는다(2026-09-17 대표님: 서문여고는 1단원에서 권력분립까지).
     심화(★) 리프는 중영역마다 넣고 뺄 수 있다 — terra.deep {"F3": false}. 학교마다 다르다. */
  function scopeMids() {
    var out = {};
    scope().forEach(function (c) {
      var x = BY[c]; if (!x) return;
      if (x.mids) x.mids.forEach(function (m) { out[m.code] = 1; });
      else if (x.leaves) out[c] = 1;
    });
    return out;
  }
  function deepMap() { try { return JSON.parse(localStorage.getItem("terra.deep") || "{}") || {}; } catch (e) { return {}; } }
  function deepOn(mid) { return deepMap()[mid] !== false; }
  function setDeep(mid, on) {
    var d = deepMap(); if (on) delete d[mid]; else d[mid] = false;
    try { localStorage.setItem("terra.deep", JSON.stringify(d)); } catch (e) {}
  }
  /* 그 대영역이 이번 시험 범위인가(일부라도) */
  function inScope(rootCode) {
    var sc = scope();
    if (!sc.length) return true;                 // 안 정했으면 전 범위
    if (sc.indexOf(rootCode) >= 0) return true;
    if (sc.some(function (c) { return c.charAt(0) === rootCode && BY[c] && BY[c].leaves; })) return true;
    // 사상가는 정의·행복이 범위면 따라 든다
    if (rootCode === "K") return sc.some(function (c) { return 사상가딸림[c.charAt(0)]; });
    return false;
  }
  function inScopeMid(midCode) {
    if (!scope().length) return true;
    if (scopeMids()[midCode]) return true;
    if (String(midCode).charAt(0) === "K") return inScope("K");
    return false;
  }
  /* 리프 하나가 범위 안인가 — 중영역이 범위 안이고, 심화(★) 리프면 그 중영역의 심화가 켜져 있어야 한다 */
  /* 지금 범위가 학교 프리셋과 같은 묶음이면 그 프리셋이 빼기로 한 리프(drop)를 적용한다 */
  function 범위드롭() {
    var sc = scope().slice().sort().join(","), B = 기본범위;
    for (var k in B) {
      var b = B[k]; if (!b || !b.drop || !b.mids) continue;
      if (b.mids.slice().sort().join(",") === sc) return b.drop;
    }
    return [];
  }
  function inScopeLeaf(leafCode) {
    if (!scope().length) return true;
    if (범위드롭().indexOf(leafCode) >= 0) return false;
    var l = BY[leafCode];
    if (!l || !l.mid) return inScope(String(leafCode || "").charAt(0));
    if (!inScopeMid(l.mid.code)) return false;
    if (l.grade === "심화" && !deepOn(l.mid.code)) return false;
    return true;
  }
  /* 문항·OX·개념어처럼 leaf 를 아는 것은 리프로, 모르면 대영역으로 */
  function inScopeItem(x) {
    if (x && x.leaf && BY[x.leaf]) return inScopeLeaf(x.leaf);
    return inScope((x && (x.sroot || x.root)) || "");
  }
  function scopeName() {
    var sc = scope();
    if (!sc.length) return "";
    var 전체 = scopeMids(), roots = [], seen = {};
    sc.forEach(function (c) { var r = c.charAt(0); if (!seen[r]) { seen[r] = 1; roots.push(r); } });
    return roots.map(function (r) {
      var R = BY[r]; if (!R || !R.mids) return r;
      var 든 = R.mids.filter(function (m) { return 전체[m.code]; });
      if (든.length === R.mids.length) return R.name;
      return R.name + "(" + 든.map(function (m) { return m.name; }).join("·") + ")";
    }).join(", ");
  }

  function nav(active) {
    /* ★ 학부모는 **학생 나비에서 뺀다**(2026-09-03 대표님 지시).
       학부모 리포트는 보호자가 보는 화면이고, 학생이 만질 자리가 아니다.
       보호자에게 보여 줄 때는 설정 안쪽에서 연다. */
    /* ★ 개념 카드 — 강의 대신 **읽고 바로 확인**하는 길(2026-09-04 대표님 지시).
       "강의 선호하면 강의, 개념카드 보고 공부하고 싶으면 그걸로" 하려면
       학생이 찾아갈 자리가 있어야 한다. 강의(개념트리) 바로 뒤에 둔다. */
    /* ★ 나비는 넷(2026-09-06 대표님: "개념카드, 문제풀이, 어쩌구 존나 많아서 더 정신없음").
       개념 카드·문제풀이·개념 체크는 홈의 '지금 할 것' 과 개념트리에서 간다. */
    var items = [["index.html", "홈"], ["skilltree.html", "개념트리"], ["skills.html", "스킬트리"],
                 ["drill.html", "Killer Drill"], ["settings.html", "설정"]];
    return '<nav class="nav"><div class="wrap">' +
      '<a class="logo" href="index.html"><span class="dot"></span>모두의 통사<small>테라러닝</small></a>' +
      '<div class="navlinks">' + items.map(function (it) {
        return '<a href="' + it[0] + '"' + (it[0] === active ? ' class="on"' : '') + '>' + it[1] + '</a>';
      }).join("") + '</div>' +
      '<div class="navact">' +
      '<span class="chip mono hide-sm" id="navgrade"></span>' +
      (S.seeded ? '<span class="srcflag hide-sm" id="srcflag">시연 데이터</span>' : '') +
      '<span class="chip mono" id="navstreak"></span></div></div></nav>';
  }
  /* 지금 화면에서 할 만한 다음 것을 골라 아래에 띄운다.
     지금 있는 화면과 같은 것은 건너뛴다 — 이미 하고 있는 걸 또 권하면 안 된다. */
  function mountNext(active) {
    var here = (location.pathname.split("/").pop() || "index.html");
    if (here === "index.html" || here === "") return;   // 리포트엔 오늘 카드가 이미 있다
    var R = routine(), qs = location.search;
    var step = null;
    for (var i = 0; i < R.items.length; i++) {
      var st = R.items[i];
      if (st.href === here + qs) continue;                 // 지금 보고 있는 그것
      if (here === "drill.html" && st.kind === "drill") continue;
      if (here === "skilltree.html" && st.kind === "lec") continue;
      step = st; break;
    }
    if (!step) step = R.items[R.items.length - 1];
    if (!step) return;

    var pct = R.pct, done = R.spent;
    var C = 2 * Math.PI * 16, on = (C * pct).toFixed(1);
    var full = R.done;

    var el = document.createElement("div");
    el.className = "nextbar";
    el.innerHTML =
      '<div class="in"><span class="ring">' +
      '<svg width="40" height="40" viewBox="0 0 40 40">' +
      '<circle cx="20" cy="20" r="16" fill="none" stroke="var(--line-2)" stroke-width="3.5"/>' +
      '<circle cx="20" cy="20" r="16" fill="none" stroke="' +
        (full ? "var(--mint)" : "var(--red)") + '" stroke-width="3.5" stroke-linecap="round"' +
        ' stroke-dasharray="' + on + ' ' + (C - on).toFixed(1) + '"/></svg>' +
      '<b>' + done + '</b></span>' +
      '<span class="tx"><b>' + (full ? "오늘 몫을 다 했어요"
          : step.title + " " + step.min + "분") + '</b>' +
      '<span>' + step.say + '</span></span>' +
      '<span class="go"><a class="btn" href="' + step.href + '">' + step.cta + '</a>' +
      '<button class="x" aria-label="닫기">✕</button></span></div>';
    document.body.appendChild(el);
    document.body.classList.add("hasnext");
    requestAnimationFrame(function () { el.classList.add("on"); });
    el.querySelector(".x").onclick = function () {
      el.classList.remove("on");
      document.body.classList.remove("hasnext");
      try { sessionStorage.setItem("terra.nexthide", "1"); } catch (e) {}
    };
  }

  /* ★ 처음 온 학생은 설정 화면(start.html)부터 본다 — 이름·학년·시험·범위·하루 분·알림 시각을
     한 화면에 하나씩 묻고, 끝나면 오늘 할 것 하나를 내민다(헤이링 첫 UX, 2026-09-06 대표님).
     검사기(헤드리스)는 건너뛴다 — navigator.webdriver. ?skip 으로도 건너뛴다. */
  function 처음인가() {
    try {
      if (localStorage.getItem("terra.onboarded") === "1") return false;
      if (navigator.webdriver) return false;
      /* 크롬을 직접 headless 로 띄운 검사기는 webdriver 가 false 다 — UA 로 가린다 */
      if (/HeadlessChrome/.test(navigator.userAgent || "")) return false;
      if (/[?&]skip\b/.test(location.search)) return false;
    } catch (e) { return false; }
    return true;
  }
  function mountNav(active) {
    var here0 = (location.pathname.split("/").pop() || "index.html");
    if (here0 !== "start.html" && here0 !== "parent.html" && here0 !== "login.html" && 처음인가()) {
      location.replace("start.html"); return;
    }
    /* ★ 고1이 범위를 한 번도 안 정했으면 **서문여고 기본값**을 넣는다.
       모든 화면이 이 함수를 부르므로 여기 한 줄이면 전부에 걸린다.
       학생이 직접 정한 값은 절대 덮지 않는다(scopeAt 이 있으면 손대지 않는다). */
    try { 범위기본값채우기(); } catch (e) {}
    document.body.insertAdjacentHTML("afterbegin", nav(active));
    document.querySelectorAll("[data-skinbtn]").forEach(function (b) {
      b.onclick = function () { setSkin(b.dataset.skinbtn); };
    });
    var gb = document.getElementById("navgrade");
    if (gb) gb.textContent = (S.student.grade || "고1") + " " + (gradeInfo().re || gradeInfo().focus);
    var hide = false;
    try { hide = sessionStorage.getItem("terra.nexthide") === "1"; } catch (e) {}
    /* ★ 선생님 층(js/coach.js)이 실려 있으면 띠는 그쪽이 맡는다 — 모든 화면, 홈 포함.
       없으면 예전 '다음 할 일' 띠로 돌아간다. */
    if (!hide) setTimeout(function () {
      try { if (window.COACH) window.COACH.mount(active); else mountNext(active); } catch (e) {}
    }, 500);
    var el = document.getElementById("navstreak");
    if (el) { var 연 = report().streak; el.textContent = 연 + "일 연속"; el.style.display = 연 ? "" : "none"; }   // 0일 연속은 숨긴다 (.chip 의 display 가 hidden 을 덮는다)
    available().then(function (ok) {
      var f = document.getElementById("srcflag");
      if (f) f.textContent = ok ? "실데이터 연결됨" : "시연 데이터";
    });
  }

  /* ── 기록 꺼내기·되돌리기 ─────────────────────────────
     기록이 이 기기에만 있다. 폰을 바꾸면 사라진다 —
     계정이 생기기 전까지의 안전장치다. */
  var 저장키들 = [KEY, "terra.exam.log", "terra.goalmin", "terra.scope", "terra.skin"];

  function 기록모으기() {
    flush();                              // 미룬 저장을 먼저 내린다
    var 짐 = { 판: 1, 만든때: new Date().toISOString(), 값: {} };
    저장키들.forEach(function (k) {
      try { var v = localStorage.getItem(k); if (v != null) 짐.값[k] = v; } catch (e) { }
    });
    return 짐;
  }

  /* 되돌리기 전에 **무엇을 덮는지** 알려 줄 수 있게 요약을 낸다 */
  function 짐요약(짐) {
    var 요약 = { 문항: 0, 훈련: 0, 시험: 0, 만든때: 짐 && 짐.만든때 };
    try {
      var st = JSON.parse(짐.값[KEY] || "{}");
      (st.ev || []).forEach(function (e) {
        if (e.k === "a") 요약.문항++; else if (e.k === "x") 요약.훈련++;
      });
      요약.시험 = JSON.parse(짐.값["terra.exam.log"] || "[]").length;
    } catch (e) { }
    return 요약;
  }

  function 기록되돌리기(짐) {
    if (!짐 || !짐.값 || !짐.값[KEY]) throw new Error("학습 기록이 없는 파일이에요");
    JSON.parse(짐.값[KEY]);               // 깨진 파일이면 여기서 멈춘다 — 덮기 전에
    저장키들.forEach(function (k) {
      try {
        if (짐.값[k] != null) localStorage.setItem(k, 짐.값[k]);
      } catch (e) { }
    });
    S = load();
    return 짐요약(짐);
  }

  /* 파일을 주고받기 어려운 폰끼리는 글자로 옮긴다.
     한글이 섞이므로 바이트로 바꾼 뒤 base64 로 만든다 — 그냥 btoa 는 한글에서 터진다.

     ★ 압축하지 않으면 **11만 자**가 된다(실측 83,668자 → base64 111,680자).
       메신저 한 통에 안 들어가고, 붙여 넣다 잘리면 통째로 못 쓴다.
       gzip 을 거치면 11,708자로 90% 줄어든다.
     ★ CompressionStream 을 모르는 브라우저가 있으므로 압축 없이도 낼 수 있게 하고,
       받는 쪽은 **머리 글자로 가려** 둘 다 읽는다.  T1: 그대로, T2: gzip */
  function 바이트를글자로(b) {
    var s2 = "", 조각 = 0x8000;          // 한 번에 다 넘기면 인자 수 한도에 걸린다
    for (var i = 0; i < b.length; i += 조각)
      s2 += String.fromCharCode.apply(null, b.subarray(i, i + 조각));
    return s2;
  }
  function 글자를바이트로(s2) {
    var a = new Uint8Array(s2.length);
    for (var i = 0; i < s2.length; i++) a[i] = s2.charCodeAt(i);
    return a;
  }

  /* 압축은 비동기다 — 코드를 받는 쪽은 Promise 를 기다린다 */
  function 옮기기코드() {
    var 짐 = new TextEncoder().encode(JSON.stringify(기록모으기()));
    if (typeof CompressionStream !== "function")
      return Promise.resolve("T1:" + btoa(바이트를글자로(짐)));
    var cs = new CompressionStream("gzip");
    var w = cs.writable.getWriter(); w.write(짐); w.close();
    return new Response(cs.readable).arrayBuffer().then(function (buf) {
      return "T2:" + btoa(바이트를글자로(new Uint8Array(buf)));
    });
  }

  /* 코드를 **읽기만** 한다 — 덮지 않는다.
     덮기 전에 무엇이 들어오는지 보여 주려면 읽는 일과 덮는 일이 나뉘어야 한다. */
  function 코드읽기(코드) {
    var v = String(코드 || "").replace(/\s+/g, "");
    var 압축 = v.slice(0, 3) === "T2:";
    if (v.slice(0, 3) === "T1:" || 압축) v = v.slice(3);
    var b = 글자를바이트로(atob(v));
    if (!압축) return Promise.resolve(JSON.parse(new TextDecoder().decode(b)));
    if (typeof DecompressionStream !== "function")
      return Promise.reject(new Error("이 브라우저는 압축된 코드를 못 읽어요"));
    var ds = new DecompressionStream("gzip");
    var w2 = ds.writable.getWriter(); w2.write(b); w2.close();
    return new Response(ds.readable).arrayBuffer().then(function (buf) {
      return JSON.parse(new TextDecoder().decode(new Uint8Array(buf)));
    });
  }

  function 코드로되돌리기(코드) {
    return 코드읽기(코드).then(기록되돌리기);
  }

  function 파일로내보내기() {
    var 짐 = 기록모으기();
    var 이름 = "모두의통사_기록_" + dayKey().replace(/-/g, "") + ".json";
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(짐)],
      { type: "application/json" }));
    a.download = 이름;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    return 이름;
  }

  window.TERRA = {
    T: T, ROOTS: ROOTS, MIDS: MIDS, LEAVES: LEAVES, BY: BY, QOF: QOF,
    state: function () { return S; }, save: save, flush: flush, seedDemo: seedDemo,
    reset: function () { S = blank(); if (시연켜짐()) seedDemo(true); },
    answer: answer, drill: drill, drillStat: drillStat,
    /* 판정 엔진에 넘길 거리 — 확신도·시간·시도·숙련도·연속오답 */
    판정거리: 판정거리, 연속오답: 연속오답,
    leafStat: leafStat, midStat: midStat, rootStat: rootStat, overall: overall,
    rank: rank, forecast: forecast, bandOf: bandOf, setGrade: setGrade, LADDER: LADDER,
    exams: exams, setExam: setExam, addExam: addExam, dday: dday,
    report: report, rangeReport: rangeReport, weekSeries: weekSeries,
    dayKey: dayKey, mins: mins, ago: ago, seed: seed, available: available, mountNav: mountNav,
    skin: skin, setSkin: setSkin, SKINS: SKINS,
    GRADES: GRADES, PACKS: PACKS, BOOKS: BOOKS, gradeInfo: gradeInfo,
    packs: packs, togglePack: togglePack, plan: plan, setPlan: setPlan,
    packList: packList, packCount: packCount, packState: packState,
    본과목표: 본과목표, 켠확장팩과목: 켠확장팩과목,
    suneungGuess: suneungGuess,
    quota: quota, dueList: dueList, prescribe: prescribe, mountNext: mountNext,
    isMain: isMain, splitPool: splitPool, mainCount: mainCount,
    scope: scope, setScope: setScope, scopeOn: scopeOn,
    /* 고1 흐름 — 보이는 대영역 · 서문여고 기본 범위 */
    오늘의리프: 오늘의리프, 오늘의까닭: 오늘의까닭, 이해도: 이해도, 반응대: 반응대,
    보이는대영역: 보이는대영역, 스킬트리대영역: 스킬트리대영역,
    기본범위: 기본범위, 기본범위지금: 기본범위지금, 범위_시험별: 범위_시험별,
    범위기본값채우기: 범위기본값채우기, 범위자동인가: 범위자동인가,
    inScope: inScope, inScopeMid: inScopeMid, inScopeLeaf: inScopeLeaf, inScopeItem: inScopeItem,
    scopeMids: scopeMids, deepOn: deepOn, setDeep: setDeep, scopeName: scopeName,
    routine: routine, calendar: calendar, goalMin: goalMin, setGoalMin: setGoalMin,
    examMode: examMode, nextExam: 다가온시험,
    watch: watch, watched: watched, spentOn: spentOn,
    /* 훈련 개인화 — 수준과 파트를 따로 정한다 */
    훈련수준: 훈련수준, 훈련추천: 훈련추천, 훈련점수: 훈련점수,
    /* 주기 — 방학·고3 시기·주간 점검·범위 낡음 */
    방학인가: 방학인가, 방학단계: 방학단계, 고3시기: 고3시기,
    주간점검날: 주간점검날, 주간점검함: 주간점검함, 주간점검끝: 주간점검끝,
    범위낡음: 범위낡음, 오늘몫표: 오늘몫표, 지나간시험: 지나간시험,
    /* 기록 꺼내기·되돌리기 — 계정이 생기기 전까지의 안전장치 */
    기록모으기: 기록모으기, 짐요약: 짐요약, 기록되돌리기: 기록되돌리기,
    옮기기코드: 옮기기코드, 코드읽기: 코드읽기, 코드로되돌리기: 코드로되돌리기,
    파일로내보내기: 파일로내보내기
  };
  /* ★ 시연 표본은 **명시 플래그**가 있을 때만 (2026-09-17 감사: 새 학생이 "14일 연속·24문항 맞힘" 가짜 기록을 봤다).
     ?demo 로 열면 이 브라우저에 켜지고(terra.demo=1), ?nodemo 로 끈다. 검사기(webdriver·HeadlessChrome)는 그대로 시연을 본다. */
  function 시연켜짐() {
    try {
      if (/[?&]nodemo\b/.test(location.search)) { localStorage.removeItem("terra.demo"); return false; }
      if (/[?&]demo\b/.test(location.search)) { localStorage.setItem("terra.demo", "1"); return true; }
      if (localStorage.getItem("terra.demo") === "1") return true;
      if (navigator.webdriver || /HeadlessChrome|node|jsdom/i.test(navigator.userAgent || "")) return true;   /* 검사기(헤드리스·node) */
    } catch (e) {}
    return false;
  }
  if (시연켜짐()) seedDemo();
  else if (S.seeded) { S = blank(); save(); }   /* 예전에 심긴 시연 기록은 걷어낸다 */
  window.TERRA.시연켜짐 = 시연켜짐;
})();
