/* Supabase 연결 — 꺼 둠 (2026-10-13).
   프로젝트 oeiebutgervwbljpqxum 는 쉬는 중이라 도메인이 사라졌다(DNS 조회 실패, 10/4 실측 · 10/13 재확인).
   url 이 비어 있으면 auth.js 는 서버를 한 번도 부르지 않고(ON=false), 로그인·저장 칸은 화면에 나오지 않는다.
   서버를 되살리면 아래 off 값을 url·anon 으로 옮기고 각 화면의 supabase.min.js 를 다시 싣는다. */
window.SUPA = {
  url: "",
  anon: "",
  vapid: "",
  off: {
    url: "https://oeiebutgervwbljpqxum.supabase.co",
    anon: "sb_publishable_NFpZLgSRWrkyXEZbjKYUfw_ni8Wrn7A",
    vapid: "BFh3VUZQlO_eMJcumm898UvbxY-trWxDIoV_MbIUHqkktYfhxDkBXL7av9RBuwcV-1d-z1790UzaMySd7AEN9Ro"
  }
};
