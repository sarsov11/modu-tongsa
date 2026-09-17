/* 내신 킬러드릴 — 이번 시험 범위 안에서 **어렵게 나오는 자리**만 모은다 (2026-09-17 대표님).
 *
 *   범위: T.scopeMids()/inScopeLeaf (중단원·심화까지).  자리 = 리프.
 *   어려운 정도는 지어내지 않는다 — 실제 기출의 **배점**(p ≥ 2.5, 학평 3점 문항)과 리프 등급(심화 ★),
 *   그리고 이 학생의 정답률(leafStat)로만 잰다.
 *   포인트마다: 왜 어려운가(3점 문항 수·심화·정답률) · 자주 묻는 것(출제의도 라벨 상위) · 풀 문항(3점부터, 글로 낼 수 있는 것만)
 */
(function () {
  function 포인트들() {
    var T = window.TERRA, Q = window.QBANK || {};
    if (!T) return [];
    var out = [];
    T.ROOTS.forEach(function (r) {
      if (!/^[A-J]$/.test(r.code)) return;
      if (T.scopeOn() && !T.inScope(r.code)) return;
      r.mids.forEach(function (m) {
        if (T.scopeOn() && !T.inScopeMid(m.code)) return;
        m.leaves.forEach(function (l) {
          if (l.grade === "제외") return;
          if (T.scopeOn() && !T.inScopeLeaf(l.code)) return;
          var 문항 = (l.play || []).filter(function (q) {
            var d = Q[q.id]; return d && q.id.charAt(0) === "T" && (!window.QRENDER || window.QRENDER.ok(d, q));
          });
          var 어려운 = 문항.filter(function (q) { return (q.p || 0) >= 2.5; });
          if (!어려운.length && l.grade !== "심화") return;          // 어렵게 나온 적이 없는 자리는 안 싣는다
          var st = T.leafStat ? T.leafStat(l.code) : { solved: 0, pct: null };
          var 라벨 = {};
          어려운.forEach(function (q) { if (q.lb) 라벨[q.lb] = (라벨[q.lb] || 0) + 1; });
          var 자주 = Object.keys(라벨).sort(function (a, b) { return 라벨[b] - 라벨[a]; }).slice(0, 2);
          var 점수 = 어려운.length * 2 + (l.grade === "심화" ? 3 : 0) + (st.pct == null ? 1 : (100 - st.pct) / 25);
          어려운.sort(function (a, b) { return (b.p || 0) - (a.p || 0) || String(b.d || "").localeCompare(String(a.d || "")); });
          var 나머지 = 문항.filter(function (q) { return 어려운.indexOf(q) < 0; }).sort(function (a, b) { return (b.p || 0) - (a.p || 0); });
          out.push({ root: r, mid: m, leaf: l, 어려운: 어려운, 풀거리: 어려운.concat(나머지).slice(0, 8), st: st, 자주: 자주, 점수: 점수 });
        });
      });
    });
    out.sort(function (a, b) { return b.점수 - a.점수; });
    return out;
  }
  window.NAESHIN = { 포인트들: 포인트들 };
})();
