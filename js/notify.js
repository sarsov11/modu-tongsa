/* 모두의 통사 — 알림 · 테라러닝
 *
 * 서버 없이 폰에서 울리게 하는 방법은 셋뿐이고, 셋 다 한계가 있다.
 * 셋을 겹쳐서 "웬만하면 울리게" 만든다. 어디까지 되는지는 설정 화면에 그대로 적는다.
 *
 *   1) 앱이 열려 있는 동안  — setTimeout 으로 그 시각에 띄운다. 확실하다.
 *   2) 앱을 다시 열었을 때  — 오늘 시각이 지났는데 아직 안 띄웠으면 그때 띄운다.
 *   3) 폰에 설치했을 때     — Periodic Background Sync 로 앱이 닫혀 있어도 깨운다.
 *      Chrome/Android 에 설치(A2HS)하고 자주 쓰는 앱이어야 브라우저가 허락한다.
 *      iOS 사파리는 이 기능이 없다 — 거기서는 1)과 2)만 된다.
 *
 * 서버 푸시(Web Push)는 백엔드가 붙으면 그때 얹는다. 지금 없는 걸 있는 척하지 않는다.
 */
(function () {
  "use strict";
  var K_TIME = "terra.notify.at";     // "08:00"
  var K_ON = "terra.notify.on";       // "1"
  var K_LAST = "terra.notify.last";   // 마지막으로 띄운 날 "2026-08-31"
  var timer = null;

  function get(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } }
  function set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} }

  function on() { return get(K_ON, "") === "1"; }
  function at() { return get(K_TIME, "08:00"); }
  function today() {
    var d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  }
  function supported() { return "Notification" in window; }
  function granted() { return supported() && Notification.permission === "granted"; }

  /* 오늘 몇 시 몇 분에 울릴 것인가 */
  function whenToday() {
    var p = at().split(":");
    var d = new Date();
    d.setHours(+p[0] || 8, +p[1] || 0, 0, 0);
    return d;
  }

  /* 시험 이야기를 며칠 전부터 할 것인가.
     내신은 3주 전부터 준비한다 — 2주로 잡으면 계획 세울 때 침묵한다. */
  var 시험알림일수 = 21;

  /* 가장 가까운 시험 — 지나간 것은 뺀다. 없으면 null */
  function 다가온시험() {
    var T = window.TERRA;
    if (!T || !T.exams || !T.dday) return null;
    var best = null;
    (T.exams() || []).forEach(function (e) {
      if (!e.date) return;
      var d = T.dday(e.date);
      if (!d || d.days < 0) return;              // 이미 지난 시험
      if (!best || d.days < best.d.days) best = { e: e, d: d };
    });
    return best;
  }

  /* 알림 문구는 그날 상태에서 만든다 — 매일 같은 말이면 무시하게 된다.
     ★ 시험이 다가오면 남은 날을 앞세운다. 시험 대비 앱이라는 것이
        알림 한 줄에서 드러나야 학생이 연다. */
  function line() {
    var T = window.TERRA;
    if (!T || !T.routine) return { t: "오늘 15분", b: "짧게 한 번 하고 갈까요?" };
    var r = T.routine();
    var 시 = 다가온시험();
    /* 실전 모드는 알림도 달라야 한다 — "오늘 몇 분" 이 아니라 "오늘 시험" 이다 */
    if (r.examMode === "real" && !r.done) {
      var 첫 = r.items[0] || {};
      return {
        t: (r.exam ? r.exam.name + " " + r.ddayLabel + " · " : "") +
           (첫.kind === "exam" ? "오늘의 모의고사" : "오늘 시험에서 틀린 것"),
        b: 첫.kind === "exam"
             ? "25문항 45분. 지금 앉으면 한 번에 끝나요."
             : (첫.n || "") + "문항 다시 보기 — 덮으면 남는 게 없어요."
      };
    }
    /* 머리말 — 시험이 2주 안이면 시험 이름과 남은 날을 앞에 둔다 */
    var 앞 = (시 && 시.d.days <= 시험알림일수)
      ? (시.e.name + " " + 시.d.label + " · ") : "";

    if (r.done) {
      return { t: 앞 + "오늘 몫 끝냈어요",
               b: 시 && 시.d.days <= 시험알림일수
                    ? "시험까지 " + 시.d.days + "일. 더 해 두면 그날이 가벼워져요."
                    : "더 해 두면 내일이 가벼워져요." };
    }
    var left = Math.max(1, r.goal - r.spent);
    var it = r.items[0];
    /* 알림은 한 줄에 40자 남짓만 보인다. 길면 정작 할 일이 잘린다.
       리프 이름에 붙은 부제(" — 아리스토텔레스·…")는 떼고, 그래도 길면 자른다. */
    function 짧게(t, 칸) {
      t = String(t || "");
      /* 리프 이름의 부제만 뗀다 — 뒤에 붙은 "…에서 틀렸던 N문항" 은 남겨야
         무엇을 할지가 보인다. 부제를 통째로 자르면 할 일이 사라진다. */
      t = t.replace(/ — [^ ]+(?=에서)/, "").replace(/ — /, " · ");
      return t.length > 칸 ? t.slice(0, 칸 - 1) + "…" : t;
    }
    /* 범위는 이름을 다 적지 않는다 — 몇 단원인지만.
       어느 단원인지는 앱을 열면 띠에 늘 적혀 있다. */
    var sc = (T.scope && T.scope()) || [];
    var 범위 = (T.scopeOn && T.scopeOn())
      ? " · 시험 범위 " + sc.length + "단원 안에서" : "";
    return {
      t: 앞 + "오늘 " + left + "분",
      b: (it ? (짧게(it.title, 12) + " · " + 짧게(it.say, 34))
             : "지금 시작하면 금방이에요.") + 범위
    };
  }

  function fire(force) {
    if (!granted() || (!on() && !force)) return false;
    if (!force && get(K_LAST, "") === today()) return false;
    var m = line();
    var body = m.b;
    try {
      var n = new Notification("모두의 통사 · " + m.t, {
        body: body, icon: "icons/icon-192.png", badge: "icons/icon-192.png",
        tag: "terra-daily", renotify: false
      });
      n.onclick = function () { window.focus(); location.href = "index.html?go=1"; n.close(); };  /* ★ 홈이 아니라 오늘 할 것으로 (대표님 2026-09-11) */
    } catch (e) {
      /* 안드로이드 크롬은 SW 를 거쳐야 뜬다 */
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then(function (reg) {
          reg.showNotification("모두의 통사 · " + m.t, {
            body: body, icon: "icons/icon-192.png", badge: "icons/icon-192.png",
            tag: "terra-daily", data: { url: "index.html?go=1" }
          });
        }).catch(function () {});
      } else { return false; }
    }
    if (!force) set(K_LAST, today());
    return true;
  }

  /* 앱이 열려 있는 동안 그 시각에 띄운다 */
  function arm() {
    clearTimeout(timer);
    if (!on() || !granted()) return;
    var t = whenToday(), now = new Date();
    if (t <= now) {                       // 이미 지난 시각 — 오늘 안 띄웠으면 지금
      fire();
      t.setDate(t.getDate() + 1);         // 다음은 내일
    }
    var wait = Math.min(t - now, 6 * 3600e3);   // 6시간마다 다시 잰다(잠자기 대비)
    timer = setTimeout(arm, Math.max(1000, wait));
  }

  /* 폰에 설치돼 있으면 앱이 닫혀 있어도 깨워 달라고 등록한다 */
  function askPeriodic() {
    if (!("serviceWorker" in navigator)) return Promise.resolve(false);
    return navigator.serviceWorker.ready.then(function (reg) {
      if (!reg.periodicSync) return false;
      return navigator.permissions.query({ name: "periodic-background-sync" })
        .then(function (st) {
          if (st.state !== "granted") return false;
          return reg.periodicSync.register("terra-daily", { minInterval: 12 * 3600e3 })
            .then(function () { return true; }).catch(function () { return false; });
        }).catch(function () { return false; });
    }).catch(function () { return false; });
  }

  function enable() {
    if (!supported()) return Promise.resolve("unsupported");
    return Notification.requestPermission().then(function (p) {
      if (p !== "granted") return p;
      set(K_ON, "1");
      arm();
      askPeriodic();
      return "granted";
    });
  }
  function disable() { set(K_ON, ""); clearTimeout(timer); }
  function setAt(v) { set(K_TIME, v); arm(); }

  /* 어디까지 되는지 — 화면에 그대로 쓴다 */
  function status() {
    var installed = window.matchMedia &&
      window.matchMedia("(display-mode: standalone)").matches;
    var ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    return {
      supported: supported(), granted: granted(), on: on(), at: at(),
      installed: !!installed, ios: ios,
      background: !!(navigator.serviceWorker && "periodicSync" in
        (window.ServiceWorkerRegistration ? ServiceWorkerRegistration.prototype : {})),
      say: !supported() ? "이 브라우저는 알림을 지원하지 않아요."
        : !granted() ? "알림을 켜면 정한 시각에 알려 드려요."
        : ios ? "아이폰은 앱을 켤 때 알려 드려요. (사파리 제한)"
        : installed ? "폰에 설치돼 있어서 앱을 닫아도 알림이 갑니다."
        : "지금은 앱을 켜 두거나 다시 열 때 알림이 갑니다. 홈 화면에 추가하면 닫아도 갑니다."
    };
  }

  window.TERRA_NOTIFY = {
    enable: enable, disable: disable, setAt: setAt, at: at, on: on,
    fire: fire, arm: arm, status: status, line: line
  };

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", arm);
  else arm();
})();
