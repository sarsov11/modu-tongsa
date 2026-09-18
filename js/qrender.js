/* 문항 조판기 — **텍스트로 짠다.**
 *
 * 그동안은 기출 지면을 통째로 크롭한 이미지를 붙였다. 그러면
 *   · 문항마다 글꼴·크기·여백이 제각각이다(출처가 다 다르다)
 *   · 확대·복사·검색이 안 되고 화면 폭에 맞춰 흐르지도 않는다
 *   · 다크 화면에서 반전 같은 꼼수가 필요하다
 *   · 지면을 그대로 베끼는 방식이다
 * 그래서 발문·자료·보기·표·선지를 **우리 글꼴로 다시 짠다.**
 *
 * 그림이 꼭 필요한 문항(지도·그래프·도식)은 그 자리에만 이미지를 쓴다.
 * 발문과 선지는 언제나 텍스트다 — 그래야 답이 그림 속에 숨지 않는다.
 *
 * 화면(study.html·exam.html)이 이것을 함께 쓴다. 조판이 두 벌로 갈리면
 * 같은 문항이 화면마다 다르게 보인다.
 */
(function () {
  "use strict";

  var 동그라미 = "①②③④⑤";

  function esc(t) {
    return String(t == null ? "" : t)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* 본문 안의 기호를 살려 둔다 — ㉠ㄱ(가) 같은 것은 문항이 가리키는 표지다.
     밑줄 친 부분은 지면에서 밑줄이었다. 텍스트에는 그 정보가 없으므로
     ㉠ 같은 표지만 도드라지게 한다. */
  /* 지면에서 딸려 온 쓰레기 — 말풍선·아이콘이 폰트 전용 글리프로 온다.
     추출기에서도 걷어내지만, 이미 만들어진 자료에는 남아 있다.
     화면에서 한 번 더 거른다. */
  /* 시험지 쪽 바닥에 인쇄된 글자가 선지·자료 꼬리에 딸려 온다(실측 5개) —
     "ㄷ, ㄹ 제 4 교시 성명 수험 번호 3 제 [ ] 선택 1".
     ★ 앞에서부터 지우면 "제3조" 같은 조문 번호를 지운다. **꼬리에서만** 자른다. */
  var _쪽바닥 = /\s*(?:제\s*\d+\s*교시|사회\s*탐구\s*영역|성명\s*수험\s*번호)[\s\S]*$/;

  function 쪽바닥빼기(t) {
    var s = String(t == null ? "" : t);
    var 자른 = s.replace(_쪽바닥, "").trim();
    /* 비율로 재면 안 된다 — 선지 "ㄷ, ㄹ" 는 짧아서 잘라 낸 쪽이 더 길다.
       "제 N 교시"·"수험 번호" 는 시험지 인쇄 문구라 본문에 나올 일이 없으니,
       자른 뒤에 **글이 남기만 하면** 자른다. 통째로 사라지면 잘못 잡은 것이다.
       ★ 한 글자도 남기면 자른다 — 선지 "갑"·"무" 는 원래 한 글자다(실측 G0084). */
    return 자른.length >= 1 ? 자른 : s;
  }

  function 쓰레기빼기(t) {
    return 쪽바닥빼기(String(t == null ? "" : t))
      .replace(/[\ue000-\uf8ff]/g, " ")        // 사용자 정의 영역(폰트 전용)
      .replace(/[\u00ad\u200b-\u200f\ufeff]/g, "")  // 눈에 안 보이는 것
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  /* 아이콘이 **한글로 잘못 매핑**된 것 — 위 규칙으로는 못 잡는다.
     "…말해 보세요. 붯 갑 A의 주민…" 에서 "붯"(U+BD2F)은 화자 앞 말풍선이다.
     같은 한 글자가 한 자료에서 세 번 넘게 홀로 서면 아이콘으로 본다 —
     뜻 있는 한 글자가 그렇게 되풀이되는 일은 드물다. */
  var _흔한한글자 = ("그이저수것때등및또약안못더덜첫끝앞뒤위중반전후" +
                   "갑을병정무").split("");

  function 아이콘글자빼기(t) {
    var s = String(t == null ? "" : t);
    var 센다 = {}, m;
    /* ① 홀로 서서 되풀이되는 글자 */
    var re1 = /(?:^|\s)([가-힣])(?=\s|$)/g;
    while ((m = re1.exec(s)) !== null) {
      var c = m[1];
      if (_흔한한글자.indexOf(c) >= 0) continue;
      센다[c] = (센다[c] || 0) + 1;
    }
    /* ② 화자 표시 **바로 앞**에 붙은 한 글자 — 말풍선 아이콘이다.
       "붯갑:", "붯을:" 처럼 붙어 버린 것은 ①로 못 잡는다.
       띄어쓰기 교정이 아이콘 제거보다 먼저 돌면 이렇게 붙는다(실측). */
    var re2 = /([가-힣])(?=(?:갑|을|병|정|무|교사|학생)\s*[::])/g;
    while ((m = re2.exec(s)) !== null) {
      var c2 = m[1];
      if (_흔한한글자.indexOf(c2) >= 0) continue;
      센다[c2] = (센다[c2] || 0) + 2;   // 이 자리는 아이콘일 가능성이 크다
    }
    /* ★ 판정은 '고립되어 되풀이되는가' 로 하고, 지울 때는 **붙어 있어도** 지운다.
       실측 — 같은 자료에서 "붯 을:" 은 띄어져 있는데 "붯갑:" 은 붙어 있었다.
       고립된 것만 지우면 "붯갑:" 이 남아 화자 나누기까지 어긋난다. */
    Object.keys(센다).forEach(function (c) {
      if (센다[c] >= 3) {
        s = s.split(c).join(" ");
      }
    });
    return s.replace(/\s{2,}/g, " ").replace(/\s+([::,.])/g, "$1").trim();
  }

  function 본문(t) {
    var s = esc(쓰레기빼기(t));
    s = s.replace(/([㉠-㉭ⓐ-ⓩ])/g, '<b class="mk box">$1</b>');
    s = s.replace(/(\([가-힣]\))/g, '<b class="mk">$1</b>');
    /* 홑 대문자 A~H 자리표시(「A 를 침해」 「A ~ C」)는 상자로 — 글 사이에 묻혀 안 보인다(2026-09-18 대표님).
       EU·GDP 처럼 영문 낱말의 일부는 손대지 않는다. */
    s = s.replace(/(^|[^A-Za-z0-9&#;])([A-H])(?![A-Za-z0-9;])/g, '$1<b class="mk box">$2</b>');
    return s;
  }

  /* 자료 안에 "갑: … 을: …" 처럼 화자가 있으면 줄을 나눈다.
     한 덩어리로 두면 누가 무슨 말을 했는지 안 보인다. */
  /* 화자는 갑·을·병뿐이 아니다. 수업 장면 문항은 "교사:" 로 시작한다.
     빠뜨리면 첫 조각에 이름이 안 붙어 누가 한 말인지 안 보인다(실측). */
  var _화자 = "갑|을|병|정|무|교사|학생|사회자|기자|진행자|사장|아버지|어머니";
  var _화자앞 = new RegExp("(?:^|\\s)(" + _화자 + ")\\s*[::]");

  /* ── (가)(나)(다) 갈래 자료 · ◦ 항목 자료 (2026-09-18) ────────────────
     시험지는 (가)·(나)·(다)를 줄을 바꿔 보여 준다. 글로 옮기며 한 줄로 이어진 것을 되돌린다.
     조건: 갈래 표시가 둘 이상이고 갈래마다 글이 25자 이상(「(가) 시기와 비교한 (나) 시기」 같은 본문 속 참조는 손대지 않는다)
           또는 ◦ 항목이 갈래 안에 있을 때. */
  var _갈래머리 = /\((가|나|다|라|마|바)\)/g;
  var _불릿 = /[◦•▪■]/;
  function 갈래나누기(t) {
    var s = String(t || "");
    var marks = s.match(_갈래머리) || [];
    var 가짓수 = {}; marks.forEach(function (m) { 가짓수[m] = 1; });
    if (Object.keys(가짓수).length < 2) return null;
    var i0 = s.indexOf("(가)");
    if (i0 < 0) return null;
    var 머리 = s.slice(0, i0).trim();
    var 조각 = s.slice(i0).split(/(?=\((?:가|나|다|라|마|바)\)\s)/).filter(function (x) { return x.trim(); });
    if (조각.length < 2) return null;
    var 항목있음 = _불릿.test(s);
    var 짧은 = 조각.filter(function (x) { return x.trim().length < 25; }).length;
    if (!항목있음 && 짧은 > 0) return null;
    if (머리.length > 80) return null;
    /* 지면이 두 단이라 (가)(나)(라)(다) 순으로 뽑힌 것을 가나다 순으로 되돌린다 */
    var 차례 = "가나다라마바";
    조각.sort(function (a, b) { return 차례.indexOf(a.trim().charAt(1)) - 차례.indexOf(b.trim().charAt(1)); });
    return (머리 ? '<p class="dhead">' + 본문(머리) + '</p>' : '') +
      '<div class="gnd">' + 조각.map(function (x) {
        var m = x.trim().match(/^\((가|나|다|라|마|바)\)\s*([\s\S]*)$/);
        var lab = m ? m[1] : "", body = m ? m[2] : x;
        return '<div class="gd"><span class="glab">(' + lab + ')</span><div class="gbody">' + 항목나누기(body) + '</div></div>';
      }).join("") + '</div>';
  }
  function 항목나누기(t) {
    var s = String(t || "").trim();
    var parts = s.split(/\s*(?=[◦•▪■])/).filter(function (x) { return x.trim(); });
    var bullets = parts.filter(function (x) { return /^[◦•▪■]/.test(x); });
    if (bullets.length >= 2) {
      var lead = parts.filter(function (x) { return !/^[◦•▪■]/.test(x); }).join(" ").trim();
      return (lead ? '<p>' + 본문(lead) + '</p>' : '') +
        '<ul class="bul">' + bullets.map(function (x) { return '<li>' + 본문(x.replace(/^[◦•▪■]\s*/, "")) + '</li>'; }).join("") + '</ul>';
    }
    var 대화 = 화자나누기(s);
    return 대화 || 본문(s);
  }

  function 화자나누기(t) {
    var s = String(t || "");
    if (!_화자앞.test(s)) return null;
    var 조각 = s.split(new RegExp("(?=(?:^|\\s)(?:" + _화자 + ")\\s*[::])"))
      .filter(function (x) { return x.trim(); });
    if (조각 .length < 2) return null;
    return 조각.map(function (x) {
      var m = x.trim().match(new RegExp("^(" + _화자 + ")\\s*[::]\\s*([\\s\\S]*)$"));
      if (!m) return '<p class="say"><span class="who"></span>' + 본문(x.trim()) + '</p>';
      /* 이름이 길면 동그라미에 안 들어간다 — 두 글자까지만 넣고 나머지는 자른다 */
      var 이름 = m[1].length > 2 ? m[1].slice(0, 2) : m[1];
      return '<p class="say"><span class="who" title="' + esc(m[1]) + '">' +
             esc(이름) + '</span>' + 본문(m[2].trim()) + '</p>';
    }).join("");
  }

  /* 보기 상자에 발문 꼬리·자료가 섞여 들어온 것을 갈라 낸다.
   *
   * 들어온 b 가 이런 꼴일 때만 손댄다 —
   *   "에서 있는 대로 고른 것은? 갑: … 을: … <보 기> ㄱ. …"
   *    └ 발문 꼬리 ┘ └─── 자료 ───┘ └상자┘ └ 진짜 보기 ┘
   *
   * 손대지 않는 경우 —
   *   · b 안에 `<보 기>` 가 없다 (정상. 1,139 중 1,115 개)
   *   · 갈라 봤더니 뒤가 비었다 (잘못 가른 것이니 원래대로 둔다)
   */
  /* 상자 머리 — 꺾쇠가 있는 것이 보통이지만, 맨 글자 "보 기" 로 뽑힌 것도 있다.
     "보기" 는 본문에도 나오는 말이라, 맨 글자일 때는 **곧 `ㄱ.` 이 따를 때만** 머리로 본다. */
  var 보기표 = /[<〈＜]\s*보\s*기\s*[>〉＞]|보\s*기(?=\s*ㄱ\s*\.)/;

  function 보기되돌리기(발문, 자료, 보기) {
    var 그대로 = { 발문: 발문, 자료: 자료, 보기: 보기 };
    if (!보기) return 그대로;
    var m = 보기.match(보기표);
    if (!m) return 그대로;

    var 앞 = 보기.slice(0, m.index).trim();
    var 뒤 = 보기.slice(m.index + m[0].length).trim();
    if (!뒤) return 그대로;                    // 상자가 비면 가른 뜻이 없다

    /* 앞부분을 발문 꼬리와 자료로 다시 가른다 — 첫 물음표까지가 발문이다.
       물음표가 없으면 통째로 자료로 본다(발문은 이미 온전하다는 뜻). */
    var 꼬리 = "", 남 = 앞;
    var qm = 앞.match(/^([\s\S]*?\?)\s*/);
    /* ★ 발문이 이미 물음표로 끝나 있으면 꼬리를 또 붙이지 않는다 —
       "…가장 적절한 것은? <보 기>에서 고른 것은?" 처럼 물음이 두 번 된다(실측 S1453). */
    if (qm && !/\?\s*$/.test(발문)) { 꼬리 = qm[1].trim(); 남 = 앞.slice(qm[0].length).trim(); }
    /* 배점은 발문에 붙인다 — 자료 상자 안에 "[3점]" 이 뜨면 자료의 일부처럼 보인다 */
    var 배점 = 남.match(/^\[\s*\d+\s*점\s*\]/);
    if (배점) { 꼬리 = (꼬리 + " " + 배점[0]).trim(); 남 = 남.slice(배점[0].length).trim(); }

    /* 발문에는 `<보 기>` 참조를 되살려 넣는다 —
       빼면 "옳은 것만을 에서 고른 것은?" 처럼 이가 빠진 말이 된다. */
    return {
      발문: 꼬리 ? (발문 + " <보 기>" + (/^에서|^에\s/.test(꼬리) ? "" : " ") + 꼬리)
                   .replace(/\s+/g, " ").trim() : 발문,
      자료: [자료, 남].filter(Boolean).join(" ").trim(),
      보기: 뒤
    };
  }

  /* 보기 상자 — "ㄱ. … ㄴ. …" 을 줄로 나눈다 */
  function 보기나누기(t) {
    var s = String(t || "").trim();
    if (!s) return "";
    /* ★ 기호가 항목 **뒤에** 붙은 꼴을 먼저 되돌린다(실측 1개) —
       원문이 2×2 로 배치돼 추출 순서가 밀린 것이다.
         "석회암이 … 기암괴석 ㄱ. 최대 20m … 간헐천 ㄴ."
       기호 앞의 글이 그 기호의 항목이다. 끝이 기호로 닫히는지까지 보고 판정한다 —
       넓게 잡으면 멀쩡한 문항의 첫 항목을 잘라 먹는다. */
    if (/\S\s+ㄱ\s*\.\s*\S/.test(s) && /[ㄱ-ㅎ]\s*\.\s*$/.test(s)) {
      var 토막 = s.split(/\s*([ㄱ-ㅎ])\s*\.\s*/);
      var 다시 = [];
      for (var i2 = 0; i2 + 1 < 토막.length; i2 += 2) {
        var 글 = 토막[i2].trim(), 기호 = 토막[i2 + 1];
        if (글) 다시.push(기호 + ". " + 글);
      }
      if (다시.length >= 2) s = 다시.join(" ");
    }
    var 조각 = s.split(/(?=[ㄱ-ㅎ]\s*\.)/).filter(function (x) { return x.trim(); });
    if (조각.length < 2) return '<div class="boki">' + 본문(s) + '</div>';
    return '<div class="boki">' + 조각.map(function (x) {
      var m = x.match(/^([ㄱ-ㅎ])\s*\.\s*([\s\S]*)$/);
      if (!m) return '<p>' + 본문(x.trim()) + '</p>';
      return '<p><span class="bk">' + esc(m[1]) + '</span>' + 본문(m[2].trim()) + '</p>';
    }).join("") + '</div>';
  }

  /* 표 — 첫 행이 머리인지 가린다. 숫자만 있는 행은 머리가 아니다. */
  function 표그리기(표들) {
    if (!표들 || !표들.length) return "";
    return 표들.map(function (tb) {
      var rows = (tb['값'] || tb.rows || tb || []);
      if (!rows.length) return "";
      var head = rows[0], body = rows.slice(1);
      var 머리 = head.some(function (c) {
        return c && !/^[\d.,%\s()\-]*$/.test(String(c));
      });
      var h = 머리 ? '<thead><tr>' + head.map(function (c) {
        return '<th>' + esc(c) + '</th>';
      }).join("") + '</tr></thead>' : '';
      var rest = 머리 ? body : rows;
      return '<div class="qtab"><table>' + h + '<tbody>' +
        rest.map(function (r) {
          return '<tr>' + r.map(function (c) {
            return '<td>' + esc(c) + '</td>';
          }).join("") + '</tr>';
        }).join("") + '</tbody></table></div>';
    }).join("");
  }

  /* ── 본체 ────────────────────────────────────
     d : 문제은행 상세 {q 발문, d 자료, b 보기, t 표, o 선지, g 그림필요}
     q : 문항 메타 {img 크롭파일, a 정답, …}
     opt: {number 문항번호, point 배점, showPicks 선지단추, name 이름표}   */
  function 문항HTML(d, q, opt) {
    d = d || {}; q = q || {}; opt = opt || {};
    var 발문 = String(d.q || "").trim();
    var 자료 = String(d.d || "").trim();
    var 보기 = String(d.b || "").trim();
    var 표 = d.t || [];
    var 선지 = d.o || [];

    /* ★ 보기 상자에 발문 꼬리와 자료가 통째로 딸려 온 문항을 되돌린다(실측 24개).
       발문 안의 `<보 기>` 참조를 상자의 시작으로 오인해 거기서 끊긴 것이다 —
       `<보 기>` 는 한 문항에 두 번 나온다. 뒤엣것이 진짜 상자다.
       `<보 기>` 가 한 번뿐이면 손대지 않는다(멀쩡한 1,115 개를 지킨다). */
    /* 발문 앞에 붙은 문항 번호를 뗀다 — 우리 지면의 번호와 어긋난다("15." 실측). */
    발문 = 발문.replace(/^\s*\d{1,2}\s*\.\s*(?=\S)/, "");
    /* 발문 `q` 에 자료·보기가 통째로 든 문항이 있다(실측 1개) —
       b 가 비어 있으면 발문에서 상자를 갈라 낸다. */
    if (!보기 && 보기표.test(발문)) {
      var 나눔 = 발문.split(보기표);
      var 앞말 = 나눔[0].trim(), 뒷말 = 발문.slice(나눔[0].length).replace(보기표, "").trim();
      if (뒷말) {
        /* 앞말에서 물음표까지가 발문, 나머지가 자료 */
        var qm2 = 앞말.match(/^([\s\S]*?\?[^?]*?)(?=\s*\S)/);
        var 물 = 앞말.indexOf("?");
        발문 = 물 >= 0 ? 앞말.slice(0, 물 + 1).trim() : 앞말;
        var 남2 = 물 >= 0 ? 앞말.slice(물 + 1).trim() : "";
        /* 배점 표시는 발문에 남긴다 — 자료로 보내면 엉뚱한 자리에 뜬다 */
        var 점 = 남2.match(/^\[\d+점\]/);
        if (점) { 발문 += " " + 점[0]; 남2 = 남2.slice(점[0].length).trim(); }
        자료 = [자료, 남2].filter(Boolean).join(" ").trim();
        보기 = 뒷말;
      }
    }
    var 다시 = 보기되돌리기(발문, 자료, 보기);
    발문 = 다시.발문; 자료 = 다시.자료; 보기 = 다시.보기;

    var 몸 = "";
    if (발문) 몸 += '<p class="stem">' + 본문(발문) + '</p>';

    /* ★ 선지가 **표나 사진**이라 글로 못 나누는 문항 —
       "① 흙벽돌집 / ② 이동식 가옥 …" 처럼 선지가 그림인 것,
       "① ② ③ ④ ⑤ / A A B B C" 처럼 표로 짜인 것(실측 67개).
       이런 문항은 자료와 선지를 **함께** 잘라 한 장으로 낸다.
       발문은 텍스트로 있으므로 답이 새지 않는다.
       화면은 이 그림을 보여 주고 ①~⑤ 번호 단추만 낸다 — 실제 시험지와 같다. */
    if (q.ff) {
      몸 += '<figure class="qfig qfull">' +
        '<img src="assets/qfull/' + esc(String(q.ff).replace(/\.png$/, ".webp")) +
        '" alt="문항 자료와 선지" loading="lazy">' +
        '<figcaption>자료와 선지 원본 · 발문은 위의 글을 보세요</figcaption>' +
        '</figure>';
      return 몸;                     // 선지는 그림 안에 있다 — 글로 또 내지 않는다
    }

    /* ★ 자료를 글로 보일지 그림으로 보일지 **먼저** 정한다.
       뭉개진 글과 그림을 같이 내면 같은 자료가 두 번 나오고,
       뒤섞인 글이 오히려 헷갈리게 한다. */
    var 글만으로되나 = 텍스트로되나(d, {});
    var 그림쓴다 = !!(q.fig && !글만으로되나);

    /* 자료 — 화자 대화면 줄을 나누고, 아니면 한 상자로.
       그리기 전에 아이콘으로 잘못 들어온 한 글자를 걷어낸다("붯" 6회 실측). */
    if (자료 && !그림쓴다) {
      자료 = 아이콘글자빼기(자료);
      /* (가)(나)(다) 갈래는 상자로, ◦ 항목은 줄로 — 한 문단으로 흘리면 무엇이 (가)인지 안 읽힌다(2026-09-18 대표님) */
      var 갈래 = 갈래나누기(자료);
      var 대화 = 갈래 ? null : 화자나누기(자료);
      몸 += '<div class="data">' + (갈래 || 대화 || 항목나누기(자료)) + '</div>';
    }
    if (표.length) 몸 += 표그리기(표);
    if (보기) 몸 += 보기나누기(보기);

    /* 그림은 **텍스트로 못 담을 때만** 쓴다.
       ★ 자료가 글로 온전한데 그림까지 붙이면 같은 내용이 두 번 나오고,
         문항 통째 크롭은 발문·선지까지 들어가 답이 샌다.
         (실측: 1번 문항이 텍스트 조판 아래에 같은 지면을 또 보여 줬다)

       ★★ 쓰는 그림은 **자료 크롭**(assets/qfig)이다 — 발문 끝과 첫 선지
         사이만 잘라낸 것이라 답이 새지 않는다. 말풍선 도식·지도·그래프처럼
         글로 옮길 수 없는 자료가 여기 들어간다.
         문항 통째 크롭(assets/q)은 **쓰지 않는다.** */
    /* ★ "글이 길면 충분" 이 아니다. 글자 수만 보면 **뭉개진 자료**도 통과한다 —
       실측 T0725 는 자료가 395자인데 그 내용이 "갑을 병 자료는 지난 시간에…" 로
       화자와 발언이 뒤섞여 못 푼다. 그런데도 그림을 안 써서 못 푸는 채로 남았다.
       그래서 위에서 잰 `그림쓴다`(ok 와 같은 잣대)를 그대로 쓴다. */
    if (그림쓴다) {
      몸 += '<figure class="qfig">' +
        '<img src="assets/qfig/' + esc(String(q.fig).replace(/\.png$/, ".webp")) +
        '" alt="문항 자료" loading="lazy">' +
        '<figcaption>자료 원본 · 발문과 선지는 위아래 글을 보세요</figcaption>' +
        '</figure>';
    }

    /* 선지 — 언제나 텍스트 */
    if (선지.length) {
      몸 += '<ol class="opts5">' + 선지.map(function (o, k) {
        return '<li><span class="n">' + 동그라미.charAt(k) + '</span>' +
               '<span class="t">' + 본문(o) + '</span></li>';
      }).join("") + '</ol>';
    }
    return 몸;
  }

  /* 선지를 누를 수 있는 단추로 (시험지·문제풀이용) */
  function 선지단추(d, opt) {
    opt = opt || {};
    var 선지 = (d && d.o) || [];
    /* 선지가 그림 안에 있으면 번호 단추만 낸다 — 글은 그림에 있다 */
    if (opt.numbersOnly) 선지 = [];
    var 열 = 선지.length && 선지.every(function (o) {
      return String(o).length <= 14;      // 짧으면 가로로 늘어놓는다
    }) ? " row" : "";
    /* 선지 수만큼만 그린다 — 4지선다에 빈 칸을 만들지 않는다 */
    var 자리 = [];
    /* 선지가 그림 안에 있으면 다섯 칸 — 글이 없다고 네 칸으로 줄이면 안 된다 */
    var 칸수 = opt.numbersOnly ? 5 : Math.max(4, Math.min(5, 선지.length));
    for (var z = 0; z < 칸수; z++) 자리.push(z);
    return '<div class="picks' + 열 + '" style="--n:' + 자리.length + '">' +
      자리.map(function (k) {
      var t = 선지[k];
      return '<button type="button" class="pick" data-v="' + k + '"' +
        (opt.qid ? ' data-q="' + esc(opt.qid) + '"' : '') + '>' +
        '<span class="n">' + 동그라미.charAt(k) + '</span>' +
        (t ? '<span class="t">' + 본문(t) + '</span>' : '') +
        '</button>';
    }).join("") + '</div>';
  }

  /* 이 문항을 텍스트로 낼 수 있는가 — 못 내면 시험지에 넣지 않는다.
   *
   * ★ "조각이 있는가" 만 보면 못 푸는 문항이 새어 나간다. 실제로 났다 —
   *   선지가 "① ㄱ, ㄴ" 인데 보기 상자가 통째로 없어, ㄱ·ㄴ 이 무슨 말인지
   *   화면 어디에도 없었다. 자료가 있으니 검사를 통과해 버렸다.
   *   그래서 **선지가 가리키는 것이 지면에 실재하는지**까지 본다.
   */
  function 텍스트로되나(d, q) {
    if (!d) return false;
    var 발문 = String(d.q || "").trim();
    var 선지 = d.o || [];
    if (발문.length < 6) return false;

    /* ★ 선지가 표·사진이라 글로 못 나누는 문항 — 자료와 선지를 함께 자른
       그림(q.ff)이 있으면 낼 수 있다. 발문만 글로 있으면 된다.
       (실측 67개. 지리·경제에 많다 — "① 흙벽돌집 / ② 이동식 가옥 …") */
    if (q && q.ff) return true;

    /* ★ 늘 다섯 개는 아니다 — 4지선다 문항이 있다(실측 8개).
       정확히 5개를 요구하면 멀쩡한 문항이 걸린다. */
    if (선지.length < 4 || 선지.length > 5) return false;
    for (var i = 0; i < 선지.length; i++) {
      if (!String(선지[i] || "").trim()) return false;
    }
    var 자료 = String(d.d || "").trim();
    var 보기 = String(d.b || "").trim();
    var 표 = (d.t || []).length;
    var 몸 = 발문 + " " + 자료 + " " + 보기;

    /* ★ 자료 크롭이 있으면 자료가 지면에 실재한다.
       발문 끝과 첫 선지 사이만 잘라낸 것이라 답이 새지 않는다.
       말풍선 도식·지도처럼 글로 못 옮기는 자료가 여기 담긴다. */
    var 자료그림 = !!(q && q.fig);

    /* 발문이 무언가를 가리키는데 지면에 아무것도 없으면 못 낸다 */
    if (/다음|아래|위의|제시된|자료|그림|표|지도|그래프|대화/.test(발문)) {
      if (!자료 && !보기 && !표 && !자료그림) return false;
    }

    /* ① 선지가 ㄱㄴㄷ 조합형 — 보기 항목이 지면에 있어야 한다 */
    var 보기형 = 선지.some(function (o) {
      return /^\s*[ㄱ-ㅎ]\s*[,、·]/.test(String(o));
    });
    if (보기형 && !자료그림) {
      var 항 = 0;
      ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ'].forEach(function (p) {
        if (new RegExp(p + '\\s*[.\\)]').test(몸)) 항++;
      });
      if (항 < 2) return false;
    }

    /* ② 선지가 갑·을 조합형 — 누가 무슨 말을 했는지 있어야 한다 */
    var 사람형 = 선지.some(function (o) {
      return /^\s*[갑을병정무]\s*[,、·]/.test(String(o));
    });
    if (사람형 && !자료그림) {
      var 명 = 0;
      ['갑', '을', '병', '정'].forEach(function (p) {
        if (new RegExp(p + '\\s*[::]').test(몸)) 명++;
      });
      if (명 < 2) return false;
    }

    /* ③ 발문이 ㉠ 같은 표지를 가리키는데 **발문 밖**(자료·보기·표)에 그 표지가 없으면 못 낸다.
       ★ 전에는 발문까지 넣고 찾아서 "밑줄 친 ㉠지역" 이 제 발문의 ㉠ 을 보고 통과했다(2026-09-18 대표님 "23년 9월 11번 뭐임"). */
    var 표글 = (d.t || []).map(function (r) { return Array.isArray(r) ? r.join(" ") : String(r); }).join(" ");
    var 지면 = 자료 + " " + 보기 + " " + 표글;
    var 표지 = 발문.match(/[㉠-㉭ⓐ-ⓩ]/g);
    if (표지 && !자료그림) {
      var 있음 = 표지.some(function (k) { return 지면.indexOf(k) >= 0; });
      if (!있음) return false;
    }
    /* ④ 발문이 A ~ C · (가), (나) · 갑, 을 처럼 이름표를 가리키면 지면에 그 이름표가 둘 이상 있어야 한다.
       T0451 "기본권 유형 A ～C" 는 자료가 그림에만 있어 글로는 풀 수 없는데 그대로 나갔다. */
    if (!자료그림) {
      var 범위형 = /\b([A-H])\s*[～~∼-]\s*([A-H])\b|\b[A-H]\s*,\s*[A-H]\b/.test(발문);
      var 홑형 = /\b[A-H]\b\s*(는|은|에|의|와|과|,|에게)/.test(발문);
      if (범위형 || 홑형) { var 알파수 = (지면.match(/(^|[^A-Za-z])[A-H](?![A-Za-z])/g) || []).length; if (알파수 < (범위형 ? 2 : 1)) return false; }
      var 갈래 = /\((가|나|다|라|마)\)/.test(발문);
      if (갈래) { var 갈래수 = (지면.match(/\((가|나|다|라|마)\)/g) || []).length; if (갈래수 < 1) return false; }
      var 사람 = /[갑을병정]\s*[,·、～~]\s*[갑을병정]|\b[갑을병정]\s*(은|는|이|의)\b/.test(발문);
      /* 「을」은 조사로도 쓰이니 「갑」이 낱말로 서 있는지 본다 — 「갑: …」 이나 「갑은」 */
      if (사람) { var 갑있음 = /(^|[^가-힣])갑(?![가-힣])/.test(지면) || /갑\s*[::]/.test(지면); if (!갑있음) return false; }
    }
    return true;
  }

  /* 출처 한 줄 — "고1 2024년 3월 학력평가 12번" (2026-09-18 대표님: 문제 출처 표기) */
  function 출처(q) {
    if (!q) return "";
    var g = q.g || "", d = String(q.d || ""), n = q.n ? q.n + "번" : "";
    if (/예시문항|예비/.test(g) || /^예비/.test(String(q.img || ""))) return "2028학년도 수능 예시문항 " + n;
    var m = d.match(/^(\d{4})-(\d{2})/);
    var 언제 = m ? (m[1] + "년 " + String(parseInt(m[2], 10)) + "월 학력평가") : d;
    return [g, 언제, n].filter(Boolean).join(" ");
  }
  window.QRENDER = {
    출처: 출처,
    html: 문항HTML, picks: 선지단추, ok: 텍스트로되나,
    esc: esc, body: 본문, MARK: 동그라미
  };
})();
