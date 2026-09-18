/* 모두의 통사 — 오프라인 캐시.
   틀(HTML·CSS)은 새것을 먼저 보고, 자료(js)는 캐시를 먼저 준 뒤 뒤에서 갱신한다.
   문항 그림은 미리 받지 않고 본 것만 남긴다(1,600장을 통째로 받으면 안 된다). */
var VER = "terra-5efc17fe";   // 종이 스킨(모두의 수학 이식)·Pretendard 가 들어가 캐시를 새로 판다   // 회원·저장·서버 푸시(auth.js·supa.config.js) 가 들어가 캐시를 새로 판다   // 핵심 개념어 쓰기(keyword·kwgrade·kwask·keyword.css)가 들어가 캐시를 새로 판다 //   // 첫 설정(start.html)·아래 탭이 들어가 캐시를 새로 판다 //   // 선생님 층(coach.js·coach.css·card·ox)이 들어가 캐시를 새로 판다   // 확장팩·루틴 주기·훈련 개인화가 들어가 캐시를 새로 판다   // 루틴·알림이 들어가 캐시를 새로 판다
var SHELL = [
  "./", "./index.html", "./skilltree.html", "./study.html",
  "./drill.html", "./settings.html", "./card.html", "./ox.html", "./exam.html", "./login.html", "./start.html", "./skills.html", "./js/skills.js", "./naeshin.html", "./js/naeshin.js", "./js/cardox.js", "./js/qrender.js",
  "./css/base.css", "./css/coach.css", "./js/auth.js", "./js/supa.config.js", "./js/loginui.js", "./css/login.css", "./css/keyword.css", "./js/coach.js",
  "./js/keyword.js", "./js/kwgrade.js", "./js/kwask.js", "./js/cards.js", "./js/judge.js", "./js/oxbank.js",
  "./js/store.js", "./js/tree.js", "./js/lecture.js",
  "./js/atlas.js", "./js/thinker.js", "./js/subkiller.js", "./js/notify.js",
  "./js/trend.js", "./js/packs.js", "./js/drills.js", "./js/pool.js",
  "./manifest.webmanifest", "./icons/icon-192.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VER).then(function (c) {
    return c.addAll(SHELL).catch(function () { /* 하나 빠져도 설치는 계속 */ });
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== VER; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;

  var isDoc = req.mode === "navigate" || /\.html$/.test(url.pathname);
  var isBig = /\.(js|css)$/.test(url.pathname);
  var isImg = /\/assets\//.test(url.pathname);

  if (isDoc) {                       // 화면은 새것 먼저
    e.respondWith(fetch(req).then(function (r) {
      var cp = r.clone();
      caches.open(VER).then(function (c) { c.put(req, cp); });
      return r;
    }).catch(function () { return caches.match(req); }));
    return;
  }
  if (isBig || isImg) {              // 자료·그림은 캐시 먼저, 뒤에서 갱신
    e.respondWith(caches.match(req).then(function (hit) {
      var net = fetch(req).then(function (r) {
        var cp = r.clone();
        caches.open(VER).then(function (c) { c.put(req, cp); });
        return r;
      }).catch(function () { return hit; });
      return hit || net;
    }));
  }
});

/* ── 알림 ────────────────────────────────────────
   앱이 닫혀 있어도 하루 한 번 깨워 달라고 브라우저에 부탁해 둔 것(periodicSync).
   Chrome/Android 에 설치돼 있고 자주 쓰는 앱일 때만 브라우저가 허락한다.
   울릴 문구는 창(js/notify.js)이 계산하지만, 창이 없으면 여기서 기본 문구를 쓴다. */
self.addEventListener("periodicsync", function (e) {
  if (e.tag !== "terra-daily") return;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true })
    .then(function (cs) {
      if (cs.length) { cs[0].postMessage({ t: "terra-daily" }); return; }  // 창이 있으면 창이 띄운다
      return self.registration.showNotification("모두의 통사 · 오늘 15분", {
        body: "짧게 한 번 하고 갈까요?",
        icon: "./icons/icon-192.png", badge: "./icons/icon-192.png",
        tag: "terra-daily", data: { url: "./index.html?go=1" }
      });
    }));
});

self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || "./index.html?go=1";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true })
    .then(function (cs) {
      for (var i = 0; i < cs.length; i++)
        if ("focus" in cs[i]) {
          /* ★ 떠 있는 창도 오늘 할 것으로 옮겨 준다 — focus 만 하면 보던 화면 그대로다 */
          if ("navigate" in cs[i]) { try { cs[i].navigate(url); } catch (err) {} }
          return cs[i].focus();
        }
      return self.clients.openWindow(url);
    }));
});


/* ★ 서버 푸시(Supabase push-daily) — 앱이 닫혀 있어도 온다 (2026-09-15) */
self.addEventListener("push", function (e) {
  var d = {}; try { d = e.data ? e.data.json() : {}; } catch (err) {}
  e.waitUntil(self.registration.showNotification("모두의 통사, " + (d.t || "오늘 15분"), {
    body: d.b || "오늘 할 것이 준비됐어요.", icon: "icons/icon-192.png", badge: "icons/icon-192.png",
    tag: "terra-daily", data: { url: d.url || "./index.html?go=1" }
  }));
});
