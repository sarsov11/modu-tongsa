/* 핵심 개념어 쓰기 — **채점기**. 화면(kwask.js)과 검산기(개념어_검산.py)가 같은 이것을 쓴다.
 *
 * 규칙 (2026-09-13)
 *   ① 공백·가운뎃점(·ㆍ)·괄호·따옴표·마침표·대소문자는 보지 않는다
 *      「사회보험」=「사회 보험」 · 「신·재생 에너지」=「신재생에너지」 · 「wto」=「WTO」
 *   ② 괄호 속은 있어도 없어도 된다 — 「세계 무역 기구(WTO)」=「세계 무역 기구」
 *   ③ 끝에 붙은 조사 **하나**는 봐준다 — 「사회 보험은」「공공 부조를」「정의의」
 *   ④ 허용 변형은 **교과서에 실제로 병기된 것**만(keyword.js 의 alt) — 「인공지능(AI)」→「AI」
 *   ⑤ 그 밖은 틀림. 한 글자만 다르면 near 를 달아 "한 글자 차이" 라고만 알려 준다(맞힘으로 치지 않는다)
 *
 * ★ 정규화는 개념어만들기.py 의 정규() 와 같은 규칙이다 — 둘이 어긋나면 노출 검사와 채점이 따로 논다.
 */
(function (root) {
  "use strict";

  var 지울것 = /[\s·ㆍ・•‧∙⋅.,‘’“”"'`\-_~?!:;()\[\]{}（）［］〔〕<>「」『』]/g;

  function norm(s) {
    s = String(s == null ? "" : s);
    if (s.normalize) s = s.normalize("NFC");
    return s.replace(지울것, "").toLowerCase();
  }

  /* 끝 조사 — 긴 것부터 떼 본다 */
  var 조사 = ["이라고", "이란", "라고", "으로서", "입니다", "에서", "에게", "에는", "으로", "로서", "이다",
             "란", "로", "에", "과", "와", "은", "는", "이", "가", "을", "를", "의", "도", "만", "요", "임"];

  function 꼴들(item) {
    var out = [];
    function add(x) { var n = norm(x); if (n && out.indexOf(n) < 0) out.push(n); }
    add(item.a);
    add(String(item.a || "").replace(/\s*\([^)]*\)/g, ""));
    (item.alt || []).forEach(add);
    return out;
  }

  /* 편집 거리 — 한 글자 차이를 알려 줄 때만 쓴다 */
  function 거리(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 9;
    var p = [], i, j;
    for (j = 0; j <= b.length; j++) p[j] = j;
    for (i = 1; i <= a.length; i++) {
      var q = [i];
      for (j = 1; j <= b.length; j++)
        q[j] = Math.min(p[j] + 1, q[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      p = q;
    }
    return p[b.length];
  }

  /* 채점 — { ok, how, near, empty }
       how: "정확" | "띄어쓰기" | "허용 변형" | "조사" | "빈칸" | "다름" */
  function check(item, input) {
    var raw = String(input == null ? "" : input).trim();
    if (!raw) return { ok: false, how: "빈칸", empty: true, near: false };
    var F = 꼴들(item), 본 = norm(item.a), 본괄호뺀 = norm(String(item.a).replace(/\s*\([^)]*\)/g, ""));
    var v1 = norm(raw), v2 = norm(raw.replace(/\s*\([^)]*\)/g, ""));
    var 후보 = [v1, v2];
    for (var k = 0; k < 후보.length; k++) {
      var v = 후보[k];
      if (!v) continue;
      if (F.indexOf(v) >= 0) {
        var how = (v === 본 || v === 본괄호뺀)
          ? (raw.replace(/\s+/g, " ") === String(item.a).replace(/\s+/g, " ") ? "정확" : "띄어쓰기")
          : "허용 변형";
        return { ok: true, how: how, near: false };
      }
    }
    for (var i = 0; i < 조사.length; i++) {
      var j = 조사[i];
      if (v1.length > j.length && v1.slice(-j.length) === j) {
        var 몸 = v1.slice(0, -j.length);
        if (F.indexOf(몸) >= 0) return { ok: true, how: "조사", near: false };
      }
    }
    var 가까움 = false;
    F.forEach(function (f) {
      var d = 거리(v1, f);
      if (f.length >= 3 && d === 1) 가까움 = true;
    });
    return { ok: false, how: "다름", near: 가까움 };
  }

  var API = { norm: norm, check: check, forms: 꼴들 };
  root.KWGRADE = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : this);
