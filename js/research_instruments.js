/* 연구 참여 화면(research.html)의 설문 척도 — 연구실이 정한 척도를 여기에 넣는다 (2026-10-27).
 *
 * 형식
 *   { id: "척도이름", title: "화면 제목", wave: "pre"|"post"|"2주차"…, active: true,
 *     points: 5, labels: ["전혀 아니다", …, "매우 그렇다"], items: ["문항 1", "문항 2", …] }
 *
 * active 가 true 인 첫 척도 하나만 화면에 나온다. 비어 있으면 설문 칸이 숨는다.
 * ★ 문항 문장은 연구실이 IRB 에 낸 척도를 그대로 옮긴다. 여기서 지어 넣지 않는다.
 */
window.RS_INSTRUMENTS = [];
