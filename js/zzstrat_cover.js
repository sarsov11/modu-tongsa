/* 모두의 통사 — 합격 전략 창 덮개 (화면표준 9·14절)
   공용 zzstrat.js 는 그대로 두고, 창이 열릴 때 열린 Shadow DOM 안에 덮개 style 하나를 넣는다(흰 바탕 · 포인트 색 · 회색).
   「합격 전략」 입구는 떠 있는 알약이 아니라 오늘 화면 목록의 줄 하나와 설정 「공부」 판의 줄 하나. */
(function(){
  var P="#E5202E", PI="#B3141F", PS="rgba(229,32,46,.10)", P2="#F08A91";
  var 덮개=[
    "#zs,#zst,#zsy{--zs-bg:#FFFFFF;--zs-card:#FFFFFF;--zs-line:#E6E8EC;--zs-red:"+P+";--zs-blue:"+P2+";--zs-gold:#7C818C;--zs-soft:#F1F3F6;--zs-tx:#111419;--zs-sub:#5F6670}",
    "#zs .top .t{letter-spacing:0;font-size:13px}#zs .top button{border-radius:12px}",
    "#zs section{border-radius:18px;box-shadow:none}",
    "#zs .chip{border-radius:999px;background:#F1F3F6;color:#333941}#zs .chip.r{background:"+PS+";color:"+PI+"}",
    "#zs .pk{border:1px solid #E6E8EC;border-radius:14px;background:#FFFFFF}#zs .pk.on{border-color:"+P+";background:"+PS+";box-shadow:none}",
    "#zs .tg{border-radius:999px;font-size:11.5px}#zs .tg.a{background:"+P+";color:#fff}#zs .tg.l{background:rgba(229,32,46,.16);color:"+PI+";border:0}#zs .tg.g{background:#F1F3F6;color:#5F6670;border:0}",
    "#zs .sc,#zs .sc.s,#zs .sc.d{border:1px solid #E6E8EC;border-radius:14px}#zs .sc.on{background:#FFFFFF}#zs .sc .rb{border-radius:999px}",
    "#zs .sc.s .rb,#zs .sc.s .bar b{background:"+P+"}#zs .sc.d .rb,#zs .sc.d .bar b{background:"+P2+"}#zs .sc.b .bar b{background:#B4BAC3}",
    "#zs .det{border-radius:14px}#zs .vl i{background:"+P+";border-radius:50%}",
    "#zs .gauge .fl{background:rgba(229,32,46,.14)}#zs .stack i.s{background:"+P+"}#zs .stack i.d{background:"+P2+"}#zs .stack i.b{background:#B4BAC3}",
    "#zs .gp b{background:"+P+";border-radius:12px}#zs .gp::after{background:"+P+"}#zs .gb .gline b{border-radius:12px}",
    "#zs .gc .cd{border:1px solid #E6E8EC;border-radius:14px}",
    "#zs .gc .cd:nth-child(1){--c:"+P+"!important}#zs .gc .cd:nth-child(2){--c:#EE6A72!important}#zs .gc .cd:nth-child(3){--c:#F4A0A6!important}#zs .gc .cd:nth-child(n+4){--c:#9CA3AF!important}",
    "#zs .gc .cg{border-radius:999px}#zs .hit{border-radius:14px}",
    "#zs .q li.a::before{background:"+P+";border-color:"+P+"}#zs .q .st.f{color:"+PI+";border-color:"+PI+"}#zs .q{border-radius:14px}",
    "#zs .go{background:"+P+";border-radius:12px}#zst .nx{background:"+P+";border-radius:12px}#zst .hole{border-radius:14px}#zst .bub{border-radius:18px}",
    "#zsy .nx{background:"+P+"}#zsy .pg i{background:"+P+"}#zsy .pk{border:1px solid #E6E8EC}#zsy .pk.on{border-color:"+P+";box-shadow:none}",
    "#zsy .end button{border:1px solid "+P+";color:"+PI+"}#zsy .end .main{background:"+P+";color:#fff}"
  ].join("\n");
  function 글(root){ var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null,false), n; while((n=w.nextNode())){ if(n.nodeValue.indexOf("합격전략")>=0) n.nodeValue=n.nodeValue.replace(/합격전략/g,"합격 전략"); } }
  function 말(){
    var h=document.getElementById("zs-host");
    if(h && h.shadowRoot){
      if(!h.shadowRoot.getElementById("tn-ov")){ var st=document.createElement("style"); st.id="tn-ov"; st.textContent=덮개; h.shadowRoot.appendChild(st); }
      글(h.shadowRoot);
    }
  }
  new MutationObserver(말).observe(document.documentElement,{childList:true,subtree:true}); 말();
  /* 입구: [data-zs] 를 누르면 창이 열린다 */
  document.addEventListener("click",function(e){
    var a=e.target.closest&&e.target.closest("[data-zs]"); if(!a) return;
    e.preventDefault(); if(window.ZZSTRAT&&ZZSTRAT.open) ZZSTRAT.open("tongsa");
  });
})();
