/* 회원 · 기록 동기화 · 푸시 구독 — Supabase 하나로 (2026-09-15 대표님 지시)
 *
 * ★ 키는 js/supa.config.js 에 둔다 (배포꾸리기.py 가 같이 싣는다).
 *      window.SUPA = { url: "https://xxxx.supabase.co", anon: "eyJ...", vapid: "B..." };
 *   이 파일이 없거나 비어 있으면 **아무 일도 안 한다** — 사이트는 지금처럼 기기 안에서만 돈다.
 *
 * 무엇을 하나
 *   로그인   구글 · 카카오 (Supabase Auth 내장). 네이버는 내장이 없어 2단계.
 *   동기화   localStorage 의 학습 키 다섯을 `records` 표에 통째로 올리고 내려받는다.
 *            충돌은 「최근에 저장한 쪽」이 이긴다 — 기기 둘을 번갈아 쓰는 학생이 있다.
 *   푸시     서비스워커 pushManager 구독을 `push_subs` 표에 적는다. 보내는 쪽은 Edge Function
 *            (supabase/functions/push-daily) 이 정한 시각에 돈다.
 *
 * ★ 학생 화면에 "계정·동기화·서버" 라는 말을 쓰지 않는다 — "저장" 하나로 말한다.
 */
(function () {
  var C = window.SUPA;
  var ON = !!(C && C.url && C.anon && window.supabase);
  var 키들 = ["terra.state", "terra.scope", "terra.snap", "terra.cards", "terra.axis", "terra.onboarded"];
  var sb = ON ? window.supabase.createClient(C.url, C.anon) : null;

  function 사용자() {
    if (!ON) return Promise.resolve(null);
    return sb.auth.getUser().then(function (r) { return (r.data && r.data.user) || null; })
      .catch(function () { return null; });
  }

  /* ── 로그인 ────────────────────────────────────────────── */
  function 로그인(어디) {              // "google" | "kakao"
    if (!ON) return Promise.resolve(false);
    return sb.auth.signInWithOAuth({
      provider: 어디,
      /* login.html 로 돌아온다 — 첫 실행 가드(start.html)에 안 걸리는 화면이고, 내려받기가 끝나면 거기서 갈 곳을 정한다 */
      options: { redirectTo: location.origin + location.pathname.replace(/[^/]*$/, "") + "login.html" }
    }).then(function () { return true; });
  }
  function 로그아웃() { return ON ? sb.auth.signOut() : Promise.resolve(); }

  /* ── 기록 동기화 ────────────────────────────────────────── */
  function 꾸러미() {
    var o = {};
    키들.forEach(function (k) { try { o[k] = localStorage.getItem(k); } catch (e) {} });
    return o;
  }
  function 풀기(o) {
    Object.keys(o || {}).forEach(function (k) {
      if (키들.indexOf(k) < 0 || o[k] == null) return;
      try { localStorage.setItem(k, o[k]); } catch (e) {}
    });
  }
  var 마지막올림 = 0;
  function 올리기() {
    if (!ON) return Promise.resolve(false);
    return 사용자().then(function (u) {
      if (!u) return false;
      var now = Date.now();
      if (now - 마지막올림 < 4000) return false;          // 답할 때마다 부르므로 묶어서
      마지막올림 = now;
      return sb.from("records").upsert({
        user_id: u.id, data: 꾸러미(), saved_at: new Date().toISOString()
      }, { onConflict: "user_id" }).then(function () { return true; });
    });
  }
  function 내려받기() {
    if (!ON) return Promise.resolve(false);
    return 사용자().then(function (u) {
      if (!u) return false;
      return sb.from("records").select("data,saved_at").eq("user_id", u.id).maybeSingle()
        .then(function (r) {
          var row = r.data;
          if (!row) return 올리기();                       // 서버가 비었으면 이 기기 것을 올린다
          var 서버 = new Date(row.saved_at).getTime();
          var 여기 = 0;
          try { 여기 = JSON.parse(localStorage.getItem("terra.state") || "{}").savedAt || 0; } catch (e) {}
          if (서버 > 여기) { 풀기(row.data); return "내려받음"; }
          return 올리기();
        });
    });
  }

  /* ── 푸시 구독 ─────────────────────────────────────────── */
  function b64(s) {
    var p = "=".repeat((4 - s.length % 4) % 4), b = (s + p).replace(/-/g, "+").replace(/_/g, "/");
    var raw = atob(b), a = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) a[i] = raw.charCodeAt(i);
    return a;
  }
  function 푸시켜기(시각) {              // "19:30"
    if (!ON || !C.vapid || !("serviceWorker" in navigator) || !("PushManager" in window))
      return Promise.resolve(false);
    return 사용자().then(function (u) {
      if (!u) return false;
      return navigator.serviceWorker.ready.then(function (reg) {
        return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(C.vapid) });
      }).then(function (sub) {
        var j = sub.toJSON();
        return sb.from("push_subs").upsert({
          user_id: u.id, endpoint: j.endpoint, keys: j.keys,
          hour: parseInt((시각 || "19:30").split(":")[0], 10),
          minute: parseInt((시각 || "19:30").split(":")[1], 10),
          tz: "Asia/Seoul"
        }, { onConflict: "endpoint" }).then(function () { return true; });
      });
    }).catch(function () { return false; });
  }

  /* 답할 때마다 올린다 — store.js 가 쏘는 사건 */
  window.addEventListener("terra:ev", function () { 올리기(); });
  if (ON) sb.auth.onAuthStateChange(function (ev) {
    if (ev === "SIGNED_IN") 내려받기().then(function () {
      window.dispatchEvent(new CustomEvent("terra:synced"));
    });
  });

  window.AUTH = { on: ON, 사용자: 사용자, 로그인: 로그인, 로그아웃: 로그아웃,
                  올리기: 올리기, 내려받기: 내려받기, 푸시켜기: 푸시켜기 };
})();
