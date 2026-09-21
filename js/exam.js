/* 내신 대비 모의고사 편성기.
 *
 * 시험 10일 전부터는 약점 채우기를 멈추고 **매일 한 회씩 실전으로 푼다.**
 * 그 편성을 여기서 한다. 화면(exam.html)은 여기서 받은 것을 그리기만 한다.
 *
 * 편성 원칙 — 실제 내신을 흉내 낸다
 *   ① 이번 시험 범위(terra.scope) 안에서만 뽑는다
 *   ② 고1이 실제로 보는 문항만 — 통합사회(T)·예비시행(V)
 *   ③ 리프별 **기출 문항 수에 비례**해 배분한다. 기출이 많은 곳이 많이 나온다
 *   ④ 킬러 주제는 가중해 더 자주 낸다 (대표님이 지목한 것 + ★ 표시)
 *   ⑤ 같은 날은 **같은 시험지**다 — 날짜를 씨앗으로 고정한다.
 *      시험지가 새로고침마다 바뀌면 시험이 아니다.
 *   ⑥ 최근 회차에 나온 문항은 피한다. 다 소진되면 오래된 것부터 다시 낸다
 *
 * 배점 — 25문항 100점. 킬러 5점, 그 수만큼 쉬운 것 3점, 나머지 4점.
 *   5k + 3k + 4(25-2k) = 100  — k 가 몇이든 100이 된다.
 *
 * 재고 실측 (2026-09-01) — 고1 본 문항 1,001개.
 *   서문여고 범위(F·G·I, K 따라붙음) 327개 → 25문항 시험지 13회분.
 */
(function () {
  "use strict";

  var 문항수 = 25;
  var 제한분 = 45;                 // 통합사회 내신 표준
  /* 최근 이만큼의 회차에 나온 문항은 뒤로 민다.
     ★ D-10 은 **열흘** 과정이다. 5회만 피하면 이레째부터 겹치기 시작해
       열흘째에는 25문항 중 14개가 이미 푼 문항이 된다(실측).
       10회로 올리면 되풀이가 32자리(13%) → 10자리(4%) 로 준다.
       12로 더 올려도 나아지지 않는다 — 열흘 과정이라 10이 끝이다.
     ★ '피한다'는 제외가 아니라 **뒤로 미는 것**이다(정렬 가중치).
       범위를 좁게 잡아 후보가 모자라도 시험지는 채워진다. */
  var 회피회차 = 10;
                                 // (제외가 아니라 뒤로 미는 것이라 후보가 마르지 않는다)
  /* 킬러 상한 — 실제 내신에서 킬러는 25문항 중 4~6개다.
     이걸 안 잡으면 사상가(K) 문항이 많은 범위에서 시험지의 3분의 2가
     킬러가 된다(실측 17/25). 그러면 시험지가 아니라 킬러 모음집이다. */
  var 킬러상한 = 6;
  var K_LOG = "terra.exam.log";    // 회차 기록
  var K_NOW = "terra.exam.now";    // 풀던 중간 답안

  var 통사표 = { "T": 1, "V": 1 };  // 고1 본 문항

  /* 이 문항이 지금 학생의 본 과목인가 — 판정은 store.js 한 곳에서 한다.
     store 가 아직 안 실렸으면(검사기 등) 통합사회로 본다. */
  function 과목맞나(q) {
    var T2 = window.TERRA;
    if (T2 && T2.본과목표) {
      var 표 = T2.본과목표();
      if (표 === null) return !통사표[q.s];
      return !!표[q.s];
    }
    return !!통사표[q.s];
  }

  /* ── 킬러 판정 ────────────────────────────────
     학교마다 킬러가 다르다. 그래서 설정으로 덮어쓸 수 있게 두고,
     설정이 없으면 아래 기본값을 쓴다.

     기본값의 근거 — 대표님이 서문여고 이번 중간고사에서 지목한 것:
       "사상가, 비교, 권력분립, 헌법재판소(위헌·헌소 포함), 노동법"
     여기에 개념트리가 ★ 로 표시해 둔 리프를 더한다. */
  /* 경향 숫자는 js/trend.js 한 곳에 있다 — 여기 박으면 네 벌로 갈라진다 */
  var 기본킬러 = (window.KILLER_PREFIX || [
    "K", "F2.3", "F3.", "F5.", "H2.", "H4.", "I3."
  ]);

  function 킬러설정() {
    try {
      var v = JSON.parse(localStorage.getItem("terra.killer") || "null");
      if (Array.isArray(v) && v.length) return v;
    } catch (e) {}
    return 기본킬러;
  }

  function 킬러인가(leaf) {
    if (/★/.test(leaf.name || "")) return true;      // 개념트리가 표시해 둔 것
    var pre = 킬러설정();
    for (var i = 0; i < pre.length; i++) {
      if (leaf.code.indexOf(pre[i]) === 0) return true;
    }
    return false;
  }

  /* ── 씨앗 난수 — 같은 날은 같은 시험지 ─────────
     Math.random 을 쓰면 새로고침마다 시험지가 바뀐다. 그건 시험이 아니다. */
  function 씨앗(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h;
  }
  function 난수기(seed) {
    var x = seed || 1;
    return function () {
      x ^= x << 13; x >>>= 0;
      x ^= x >> 17;
      x ^= x << 5;  x >>>= 0;
      return x / 4294967296;
    };
  }
  function 섞기(arr, rnd) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ── 회차 기록 ────────────────────────────────── */
  function log() {
    try { return JSON.parse(localStorage.getItem(K_LOG) || "[]") || []; }
    catch (e) { return []; }
  }
  function saveLog(v) {
    try { localStorage.setItem(K_LOG, JSON.stringify(v.slice(-40))); } catch (e) {}
  }

  /* 최근 회차에 나온 문항 id — 이번엔 피한다 */
  /* 최근에 나온 문항 — **얼마나 최근인지**를 값으로 돌려준다.
   *
   * ★ "나왔나/안 나왔나" 이진값이면 안 된다. 안 나온 것을 다 쓰고 나면
   *   남은 것끼리 순서가 없어 밀린 것들이 뒷날에 한꺼번에 쏟아진다 —
   *   범위를 세 단원으로 좁힌 열흘에서 **마지막 회차 25문항이 전부** 이미 푼 것이었다.
   *   마지막 회차는 시험 전날이다.
   *
   * 값이 클수록 최근이다. 정렬에서 작은 값이 앞서므로
   * 오래전에 푼 것부터 다시 나오고, 어제 푼 것은 가장 나중에 온다.
   */
  function 최근문항() {
    var out = {};
    var 최근 = log().slice(-회피회차);
    최근.forEach(function (r, i) {
      var 나이 = i + 1;                     // 1 = 가장 오래된 축, 클수록 최근
      (r.ids || []).forEach(function (id) {
        if (!out[id] || out[id] < 나이) out[id] = 나이;
      });
    });
    return out;
  }

  /* 되풀이 자리에 **무엇을** 넣을지 —
   *
   * ★ 겹침을 편성으로 없앨 수 없는 경우가 있다. 범위를 세 단원으로 잡으면
   *   재고가 159문항인데 열흘이면 250자리다. 7회차부터는 무엇을 어떻게
   *   정렬해도 반드시 겹친다(실측: 마지막 회차 25/25).
   *
   * 그래서 물음을 바꾼다 — 겹치는 자리에 **틀렸던 문항**을 넣는다.
   *   맞힌 문항이 또 오면 "아까 그 문제네" 하고 안 읽는다.
   *   틀린 문항이 또 오면 "저번에 틀린 것" 이라 다시 푼다.
   * 같은 겹침인데 하나는 상품을 죽이고 하나는 살린다.
   */
  function 틀린문항() {
    var out = {};
    log().slice(-회피회차).forEach(function (r) {
      (r.wrong || []).forEach(function (id) { out[id] = 1; });
    });
    return out;
  }

  /* ── 후보 문항 모으기 ────────────────────────────
     ★ 텍스트로 낼 수 있는 문항만 담는다. 시험지를 크롭 이미지로 때우지
        않기로 했으므로, 글이 온전하지 않으면 시험지에 못 올린다.
        발문이 "다음 자료를 보고…" 인데 자료가 없으면 못 푸는 문제다. */
  function 후보() {
    var T = window.TERRA, TREE = window.TREE, Q = window.QBANK || {};
    if (!TREE) return [];
    var roots = TREE.roots || TREE;
    var out = [], 버림 = 0;
    roots.forEach(function (r) {
      /* 이번 시험 범위 밖은 아예 안 뽑는다 */
      if (T && T.inScope && !T.inScope(r.code)) return;
      (r.mids || []).forEach(function (m) {
        (m.leaves || []).forEach(function (l) {
          if (l.grade === "제외") return;
          /* 중단원·심화 단위 범위(2026-09-17) */
          if (T && T.inScopeLeaf && !T.inScopeLeaf(l.code)) return;
          var kill = 킬러인가(l);
          (l.play || []).forEach(function (q) {
            /* ★ 어떤 과목이 본 문항인지는 store.js 가 정한다 —
               두 곳이 따로 갈라지면 화면에서 푸는 문항과
               시험지에 나오는 문항이 어긋난다.
               (고2가 확장팩을 켜면 그 과목이 시험지에도 들어와야 한다.) */
            if (!과목맞나(q)) return;
            if (window.QRENDER && !window.QRENDER.ok(Q[q.id], q)) { 버림++; return; }
            out.push({ q: q, leaf: l, mid: m, root: r, killer: kill });
          });
        });
      });
    });
    out.버림 = 버림;
    return out;
  }

  /* ── 편성 ──────────────────────────────────────
     리프별 기출 수에 비례해 뽑되, 킬러 리프는 가중한다.
     한 리프에서 몰아 뽑으면 시험지가 안 되므로 리프당 상한을 둔다. */
  function 편성(dayKey) {
    var all = 후보();
    if (all.length < 5) return null;

    var rnd = 난수기(씨앗("paper|" + dayKey));
    var 피할 = 최근문항();
    var 틀린것 = 틀린문항();

    /* 리프별로 묶는다 */
    var byLeaf = {};
    all.forEach(function (x) {
      var k = x.leaf.code;
      (byLeaf[k] = byLeaf[k] || { leaf: x.leaf, killer: x.killer, qs: [] }).qs.push(x);
    });
    var 리프들 = Object.keys(byLeaf);

    /* ── ① 대영역 몫을 **먼저** 나눈다 ─────────────
       리프 무게만으로 나누면 무게 큰 리프가 몫을 다 가져가
       대영역이 통째로 빠진다 — 실측 300문항에서 D·G·I·J 가 0개였다.
       실제 시험지는 전 단원에서 골고루 낸다. */
    var 영역무게 = window.ROOT_WEIGHT || {};
    var byRoot = {};
    all.forEach(function (x) {
      var c = x.root.code;
      (byRoot[c] = byRoot[c] || { n: 0, w: 0 }).n++;
    });
    var 영역들 = Object.keys(byRoot);
    var 영역총 = 0;
    영역들.forEach(function (c) {
      byRoot[c].w = byRoot[c].n * (영역무게[c] == null ? 1 : 영역무게[c]);
      영역총 += byRoot[c].w;
    });
    /* 범위 안 대영역은 적어도 한 문항 — 없는 단원처럼 보이면 안 된다 */
    var 영역몫 = {}, 남영역 = 문항수;
    영역들.sort(function (a, b) { return byRoot[b].w - byRoot[a].w; });
    영역들.forEach(function (c) {
      var v = Math.max(1, Math.round(문항수 * byRoot[c].w / 영역총));
      v = Math.min(v, byRoot[c].n, 남영역);
      영역몫[c] = v; 남영역 -= v;
    });
    for (var 돌 = 0; 돌 < 6 && 남영역 > 0; 돌++) {
      for (var vi = 0; vi < 영역들.length && 남영역 > 0; vi++) {
        var vc = 영역들[vi];
        if (영역몫[vc] >= byRoot[vc].n) continue;
        영역몫[vc]++; 남영역--;
      }
    }
    /* 몫이 넘치면 무게 작은 영역부터 덜어낸다 */
    var 넘침 = 영역들.reduce(function (t, c) { return t + 영역몫[c]; }, 0) - 문항수;
    for (var vj = 영역들.length - 1; vj >= 0 && 넘침 > 0; vj--) {
      var vd = 영역들[vj];
      var 뺄 = Math.min(넘침, Math.max(0, 영역몫[vd] - 1));
      영역몫[vd] -= 뺄; 넘침 -= 뺄;
    }

    /* 무게 = 기출 수 × (킬러면 1.8, 심화면 1.2, 아니면 1.0) × 대영역 무게
       ★ 대영역 무게는 **그해 경향**이다(js/trend.js).
         2026-09 모평 뒤 — 기후 0.75 · 경제 1.35 · 법 1.30 */
    var 영역무게 = window.ROOT_WEIGHT || {};

    /* ★ 그 학생이 **약한 리프**를 더 낸다.
       실측 — 이것이 없을 때, 성적이 81% 와 48% 로 갈린 두 학생이
       같은 범위에서 열흘 동안 97% 같은 문항을 받았다.
       개인 기록이 편성에 하나도 안 걸려 있었기 때문이다.

       ★ 대영역 비중은 건드리지 않는다 — 그것이 실전 시험지 꼴을 지킨다.
         약점은 **대영역 몫 안에서 리프를 고를 때만** 작용한다.
       ★ 아직 안 푼 리프는 중립(1.0)이다. 안 푼 것을 약점으로 읽으면
         처음 쓰는 학생에게 엉뚱한 편성이 나간다. */
    var 끌기 = (window.WEAK_PULL == null ? 0 : window.WEAK_PULL);
    function 약점배수(리프코드) {
      if (!끌기) return 1;
      var T2 = window.TERRA;
      if (!T2 || !T2.leafStat) return 1;
      var st = T2.leafStat(리프코드);
      if (!st || !st.solved) return 1;           // 안 푼 리프는 중립
      var 정답률 = st.correct / st.solved;       // 0~1
      return 1 + (1 - 정답률) * 끌기;
    }

    var 총무게 = 0;
    리프들.forEach(function (k) {
      var b = byLeaf[k];
      var w = b.qs.length *
        (b.killer ? 1.8 : (b.leaf.grade === "심화" ? 1.2 : 1.0)) *
        (영역무게[b.leaf.code.charAt(0)] == null ? 1 : 영역무게[b.leaf.code.charAt(0)]) *
        약점배수(k);
      b.w = w; 총무게 += w;
    });

    /* 리프당 상한 — 실제 내신도 한 소단원에서 2~3문항이다.
       4로 뒀더니 무게 큰 리프가 몫을 다 가져가 한 회차에 리프 20개만
       쓰였고(범위 안 리프는 47개), 10일치 겹침이 46% 였다.

       다만 **범위 넓이에 맞춰 움직여야** 한다. 3으로 고정했더니
       리프가 6개뿐인 좁은 범위에서 25문항을 채우려고 한 곳에서
       7문항을 몰아 뽑았다(3×6=18 < 25 라 채우기가 상한을 밀어냈다).
       고르게 퍼지는 최소값을 쓴다. */
    var 상한 = Math.max(3, Math.ceil(문항수 / Math.max(1, 리프들.length)));

    /* ── ② 대영역 몫 **안에서** 리프별로 나눈다 ───── */
    var 몫 = {}, 킬몫 = 0;
    리프들.forEach(function (k) { 몫[k] = 0; });
    영역들.forEach(function (c) {
      var 안리프 = 리프들.filter(function (k) {
        return byLeaf[k].leaf.code.charAt(0) === c;
      });
      if (!안리프.length) return;
      var 안총 = 안리프.reduce(function (t, k) { return t + byLeaf[k].w; }, 0) || 1;
      var 남c = 영역몫[c] || 0;
      안리프.sort(function (a, b) { return byLeaf[b].w - byLeaf[a].w; });
      안리프.forEach(function (k) {
        var b = byLeaf[k];
        var v = Math.min(상한, Math.round((영역몫[c] || 0) * b.w / 안총));
        v = Math.min(v, b.qs.length, 남c);
        if (b.killer) {                     // ★ 킬러는 다 합쳐 상한까지만
          v = Math.min(v, Math.max(0, 킬러상한 - 킬몫));
          킬몫 += v;
        }
        몫[k] = v; 남c -= v;
      });
      /* 그 영역 안에서 남은 자리를 채운다 */
      for (var p2 = 0; p2 < 4 && 남c > 0; p2++) {
        for (var i2 = 0; i2 < 안리프.length && 남c > 0; i2++) {
          var k2 = 안리프[i2], b2 = byLeaf[k2];
          if (b2.killer && 킬몫 >= 킬러상한) continue;
          if (몫[k2] >= Math.min(상한 + p2, b2.qs.length)) continue;
          몫[k2]++; 남c--;
          if (b2.killer) 킬몫++;
        }
      }
    });
    var 남 = 문항수 - 리프들.reduce(function (t, k) { return t + 몫[k]; }, 0);
    /* 반올림하다 남거나 모자란 것을 채운다 — 킬러 리프부터 */
    var 채울 = 리프들.slice().sort(function (a, b) {
      if (byLeaf[a].killer !== byLeaf[b].killer) return byLeaf[a].killer ? -1 : 1;
      return byLeaf[b].w - byLeaf[a].w;
    });
    /* 채울 때는 **비킬러부터**. 킬러는 상한까지만 채운다.
       (킬러를 먼저 채우면 상한을 잡아 둔 뜻이 없어진다) */
    채울.sort(function (a, b) {
      if (byLeaf[a].killer !== byLeaf[b].killer) return byLeaf[a].killer ? 1 : -1;
      return byLeaf[b].w - byLeaf[a].w;
    });
    for (var pass = 0; pass < 5 && 남 > 0; pass++) {
      for (var i = 0; i < 채울.length && 남 > 0; i++) {
        var k2 = 채울[i], b2 = byLeaf[k2];
        if (b2.killer && 킬몫 >= 킬러상한) continue;
        if (몫[k2] >= Math.min(상한 + pass, b2.qs.length)) continue;
        몫[k2]++; 남--;
        if (b2.killer) 킬몫++;
      }
    }

    /* 리프마다 실제 문항을 고른다 — 최근에 나온 것은 뒤로 민다.
       ★ 한 문항이 여러 리프에 배정돼 있다(실측 1,319건). id 로 걸러야
          같은 문항이 시험지에 두 번 나오지 않는다. */
    /* ★ 재고가 넉넉하면(안 나온 문항만으로 한 회차가 찬다) 리프 몫을 **그 리프의 안 나온 문항 수**로 묶는다(2026-09-19).
       못 푸는 문항 185개를 걷어낸 뒤 얇아진 리프가 제 몫을 채우느라 같은 문항을 되풀이했다(전 범위 열흘 되풀이 13%).
       모자란 자리는 아래 「나머지」가 다른 리프의 안 나온 문항으로 채운다. */
    var 안나온수 = all.filter(function (x) { return !피할[x.q.id]; }).length;
    if (안나온수 >= 문항수) {
      리프들.forEach(function (k) {
        var 새것 = byLeaf[k].qs.filter(function (x) { return !피할[x.q.id]; }).length;
        if ((몫[k] || 0) > 새것) 몫[k] = 새것;
      });
    }
    var 뽑힘 = [], 담음 = {};
    리프들.forEach(function (k) {
      var n = 몫[k] || 0;
      if (!n) return;
      var 목록 = 섞기(byLeaf[k].qs, rnd);
      목록.sort(function (a, b) {
        /* 0 = 아직 안 나온 것 · 클수록 최근에 나온 것.
           안 나온 것이 먼저 — 새 문항을 밀어내지 않는다. */
        var pa = 피할[a.q.id] ? 1 : 0, pb = 피할[b.q.id] ? 1 : 0;
        if (pa !== pb) return pa - pb;
        /* 둘 다 이미 나온 것이라면 — **틀렸던 것부터** 다시 낸다.
           어차피 겹칠 자리라면 맞힌 문제보다 틀린 문제가 값어치 있다. */
        if (pa === 1) {
          var wa = 틀린것[a.q.id] ? 0 : 1, wb = 틀린것[b.q.id] ? 0 : 1;
          if (wa !== wb) return wa - wb;
          /* 틀린 것끼리·맞힌 것끼리는 **오래전 것부터** — 어제 푼 것은 나중에 */
          var ra = 피할[a.q.id] || 0, rb = 피할[b.q.id] || 0;
          if (ra !== rb) return ra - rb;
        }
        var ia = a.q.img ? 0 : 1, ib = b.q.img ? 0 : 1;
        return ia - ib;                             // 자료 있는 것 먼저(실전 감각)
      });
      for (var i = 0; i < 목록.length && n > 0; i++) {
        var x = 목록[i];
        if (담음[x.q.id]) continue;                 // 다른 리프에서 이미 담았다
        담음[x.q.id] = 1; 뽑힘.push(x); n--;
      }
    });

    /* 모자라면 범위 안에서 더 뽑는다. 없으면 없는 대로 낸다 —
       억지로 채우면 글이 깨진 문항이 섞이고, 그건 크롭으로 때우던 것과 같다. */
    if (뽑힘.length < 문항수) {
      var 나머지 = 섞기(all.filter(function (x) { return !담음[x.q.id]; }), rnd);
      나머지.sort(function (a, b) { return (피할[a.q.id] ? 1 : 0) - (피할[b.q.id] ? 1 : 0); });   /* 안 나온 것부터 */
      /* 채울 때도 킬러 상한을 지킨다 — 첫 바퀴는 상한 안에서만, 그래도 모자라면 둘째 바퀴에 가리지 않고 */
      var 킬수 = 뽑힘.filter(function (x) { return x.killer; }).length;
      for (var 바퀴 = 0; 바퀴 < 2 && 뽑힘.length < 문항수; 바퀴++) {
        for (var j = 0; j < 나머지.length && 뽑힘.length < 문항수; j++) {
          if (담음[나머지[j].q.id]) continue;
          if (바퀴 === 0 && 나머지[j].killer && 킬수 >= 킬러상한) continue;
          담음[나머지[j].q.id] = 1; 뽑힘.push(나머지[j]);
          if (나머지[j].killer) 킬수++;
        }
      }
    }

    /* 자리 배치 — 쉬운 것부터. 실제 시험지도 앞이 쉽다 */
    뽑힘 = 섞기(뽑힘, rnd).slice(0, 문항수);
    뽑힘.sort(function (a, b) {
      if (a.killer !== b.killer) return a.killer ? 1 : -1;   // 킬러는 뒤로
      return 0;
    });

    /* 배점 — 킬러 5점, 그 수만큼 쉬운 것 3점, 나머지 4점 → 합 100.
         5k + 3k + 4(n-2k) = 4n  이므로 n=25 면 어떤 k 든 100 이 된다.
       ★ 단 k 는 **3점을 줄 비킬러가 그만큼 있을 때만** 성립한다.
         킬러가 절반을 넘으면 식이 깨져 배점이 음수가 됐다(실측 -4). */
    var 킬목록 = 뽑힘.filter(function (x) { return x.killer; });
    var 비킬수 = 뽑힘.length - 킬목록.length;
    var 킬수 = Math.min(킬목록.length, 비킬수, 킬러상한);
    /* 상한을 넘은 킬러는 배점에서만 보통으로 친다(표시는 그대로 둔다 —
       학생에게 "여기가 킬러다" 를 알려 주는 것은 그대로가 낫다) */
    var 오점남 = 킬수, 쉬움남 = 킬수;
    var items = 뽑힘.map(function (x, i) {
      var 점 = 4;
      if (x.killer && 오점남 > 0) { 점 = 5; 오점남--; }
      else if (!x.killer && 쉬움남 > 0) { 점 = 3; 쉬움남--; }
      return {
        no: i + 1, id: x.q.id, leaf: x.leaf.code, leafName: x.leaf.name,
        root: x.root.code, rootName: x.root.name,
        killer: !!x.killer, point: 점, img: x.q.img || "",
        fig: x.q.fig || "", ff: x.q.ff || "", gf: x.q.gf || 0,   /* gf 가 빠져 그래프형 그림이 안 나왔다(2026-09-21 코덱스 SYS-EXAM-FIG) */
        a: x.q.a, lb: x.q.lb || "", src: (x.q.g || "") + " " + (x.q.d || "")
      };
    });
    /* 합이 100이 아니면(문항이 모자란 회차) 골고루 나눠 맞춘다.
       한 문항에 몰아 주면 배점이 음수가 되거나 12점짜리가 생긴다. */
    var 합 = items.reduce(function (s, x) { return s + x.point; }, 0);
    for (var g = 0; items.length && 합 !== 100 && g < 400; g++) {
      var 위 = g % items.length, it = items[위];
      if (합 < 100 && it.point < 6) { it.point++; 합++; }
      else if (합 > 100 && it.point > 2) { it.point--; 합--; }
    }

    return {
      day: dayKey,
      round: log().length + 1,
      items: items,
      total: items.reduce(function (s, x) { return s + x.point; }, 0),
      minutes: 제한분,
      killerCount: items.filter(function (x) { return x.killer; }).length,
      /* 글이 온전하지 않아 뺀 문항 수 — 시험지가 짧을 때 왜 그런지 알려 준다 */
      dropped: all.버림 || 0,
      scope: (window.TERRA && window.TERRA.scopeName && window.TERRA.scopeName()) || ""
    };
  }

  /* ── 풀던 중간 답안 — 나갔다 와도 이어서 ────────── */
  function now() {
    try { return JSON.parse(localStorage.getItem(K_NOW) || "null"); }
    catch (e) { return null; }
  }
  function saveNow(v) {
    try {
      if (v) localStorage.setItem(K_NOW, JSON.stringify(v));
      else localStorage.removeItem(K_NOW);
    } catch (e) {}
  }

  /* ── 채점 ────────────────────────────────────── */
  function 채점(paper, picks) {
    var 맞 = 0, 점 = 0, 틀린 = [];
    paper.items.forEach(function (it) {
      var p = picks[it.id];
      var ok = (p !== undefined && p !== null && p === it.a);
      if (ok) { 맞++; 점 += it.point; }
      else 틀린.push({ no: it.no, id: it.id, leaf: it.leaf, leafName: it.leafName,
                       killer: it.killer, a: it.a, pick: (p === undefined ? null : p) });
    });
    /* 킬러만 따로 — 여기가 등급을 가른다 */
    var 킬 = paper.items.filter(function (x) { return x.killer; });
    var 킬맞 = 킬.filter(function (x) { return picks[x.id] === x.a; }).length;
    return {
      right: 맞, wrong: paper.items.length - 맞, score: 점,
      total: paper.total, pct: paper.total ? Math.round(점 / paper.total * 100) : 0,
      wrongList: 틀린,
      killer: { n: 킬.length, right: 킬맞 }
    };
  }

  /* 회차를 기록한다 — 점수 추이와 '최근에 나온 문항' 회피에 쓴다 */
  function 기록(paper, res, picks) {
    var L = log();
    /* 같은 날 두 번 내면 덮어쓴다 — 하루 한 회다 */
    L = L.filter(function (r) { return r.day !== paper.day; });
    L.push({
      day: paper.day, round: paper.round,
      score: res.score, total: res.total, pct: res.pct,
      right: res.right, n: paper.items.length,
      killer: res.killer,
      ids: paper.items.map(function (x) { return x.id; }),
      wrong: res.wrongList.map(function (x) { return x.id; })
    });
    saveLog(L);
    saveNow(null);
    return L;
  }

  window.TERRA_EXAM = {
    paper: 편성, grade: 채점, record: 기록,
    log: log, now: now, saveNow: saveNow,
    killerPrefix: 킬러설정, isKiller: 킬러인가,
    QUESTIONS: 문항수, MINUTES: 제한분
  };
})();
