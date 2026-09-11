/* ═══════════════════════════════════════════════════════════════════════
   OPUS.Z 登入頁角色動畫  login-characters.js
   ───────────────────────────────────────────────────────────────────────
   四隻角色會看著滑鼠、眨眼、互看，打字時湊過來，按「顯示密碼」時撇開頭
   不偷看，密碼錯了會沮喪，登入成功會跳。

   **這支完全不碰登入邏輯。** 它自己建立左邊的舞台、自己找表單欄位，
   靠「觀察錯誤訊息有沒有出現」來判斷登入失敗 —— 所以 Firebase 那段
   一行都不用改，也就不可能把登入弄壞。

   用法（放在 </body> 之前）：
     <script src="login-characters.js?v=1"></script>
   需要指定欄位時：
     <script src="login-characters.js?v=1"
             data-error="#errorMsg" data-success="#successState"></script>

   形狀與動態全部是逐格量參考影片得到的，細節見各段註解。
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
if (window.__opzCast) return; window.__opzCast = true;

var reduce=false; try{ reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){}
var ME = document.currentScript || (function(){ var t=document.getElementsByTagName('script'); return t[t.length-1]; })();
var OPT = {
  error:   (ME && ME.getAttribute('data-error'))   || '.error-msg,#errorMsg,#loginError,.err',
  success: (ME && ME.getAttribute('data-success')) || '#successState,.success-state',
  bg:      (ME && ME.getAttribute('data-bg'))      || '#EDEBEF',
  mount:   (ME && ME.getAttribute('data-mount'))   || ''   // 指定就掛進既有容器，不重排 body
};

/* ── 版面：把原本置中的內容推到右半邊，左半邊給角色 ───────────────── */
var css = document.createElement('style');
css.textContent =
  '.opz-cast-stage{background:'+OPT.bg+';display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative}'
+ '.opz-cast-stage svg{width:100%;height:100%;max-width:780px;max-height:640px;display:block;margin:auto}'
+ '.opz-cast-inline{position:absolute;left:0;right:0;bottom:0;height:58%;background:transparent;pointer-events:none;z-index:0}'
+ '.opz-cast-inline svg{height:100%}'
+ 'body.opz-cast-on:not(.opz-cast-inline-mode){display:grid!important;grid-template-columns:1fr 1fr;'
+   'align-items:stretch!important;justify-content:stretch!important;padding:0!important;min-height:100vh}'
+ '.opz-cast-right{display:flex;flex-direction:column;align-items:center;justify-content:center;'
+   'padding:48px 28px;min-width:0;overflow-y:auto}'
+ '@media (max-width:860px){body.opz-cast-on{grid-template-columns:1fr;grid-template-rows:38vh 1fr}'
+   '.opz-cast-right{padding:32px 20px}}'
+ '@media (max-height:560px){body.opz-cast-on{grid-template-columns:1fr;grid-template-rows:0 1fr}'
+   '.opz-cast-stage{display:none}}';
document.head.appendChild(css);

function boot(){
  var body = document.body;
  if (!body || body.classList.contains('opz-cast-on')) return;

  /* 頁面本來就有左欄的話（例如音樂家登入頁），直接掛進去，不動它的版面 */
  if (OPT.mount){
    var host = document.querySelector(OPT.mount);
    if (host){
      var st = document.createElement('div');
      st.className = 'opz-cast-stage opz-cast-inline';
      st.setAttribute('aria-hidden','true');
      var sv = document.createElementNS('http://www.w3.org/2000/svg','svg');
      sv.setAttribute('viewBox','38 52 444 358');
      sv.setAttribute('preserveAspectRatio','xMidYMax meet');
      st.appendChild(sv);
      host.appendChild(st);
      body.classList.add('opz-cast-on','opz-cast-inline-mode');   // inline：不重排 body
      start(sv);
      return;
    }
  }

  var right = document.createElement('div');
  right.className = 'opz-cast-right';
  // 把原本的內容整批搬進右欄（固定定位的返回鍵之類的留在原地，它們本來就貼著視窗）
  var kids = [], n;
  for (n = body.firstChild; n; n = n.nextSibling) kids.push(n);
  kids.forEach(function(k){
    if (k.nodeType === 1){
      var pos = getComputedStyle(k).position;
      if (pos === 'fixed') return;                  // 固定在視窗上的東西不要搬
      if (k.tagName === 'SCRIPT' || k.tagName === 'STYLE' || k.tagName === 'LINK') return;
    }
    right.appendChild(k);
  });

  var stage = document.createElement('div');
  stage.className = 'opz-cast-stage';
  stage.setAttribute('aria-hidden','true');
  var svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','38 52 444 358');
  svg.setAttribute('preserveAspectRatio','xMidYMid meet');
  stage.appendChild(svg);

  body.appendChild(stage);
  body.appendChild(right);
  body.classList.add('opz-cast-on');
  start(svg);
}

function start(SVG){

var NS  = 'http://www.w3.org/2000/svg';
var GROUND = 366;
var reduce=false; try{ reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){}
var STILL=false, FORCE='';
try{ var _q=new URLSearchParams(location.search);
     STILL = _q.get('still')==='1' || !!_q.get('mood');
     FORCE = _q.get('mood')||''; }catch(e){}

/* ══════════════════════════════════════════════════════════════════
   角色設定
   身體不是一張固定的圖，而是**每一格重新算出來的**：一條從腳底往上長的
   「脊椎」＋一條「寬度曲線」，每格用當下的歪斜／彎曲／壓扁／伸長參數重畫。
   所以它們會像有骨頭的生物一樣湊過去看、縮回來，而不是一整塊硬邦邦地轉。
   ══════════════════════════════════════════════════════════════════ */
var CAST = [
  { id:'purple', fill:'#6023E8', glow:'#C89BFF', baseX:198, topY:112, halfW:52, kind:'rect',
    eye:{ type:'dot', y:166, dx:19, r:6.4, color:'#16161A', hi:true },
    mouth:{ y:198, w:4.6, kind:'open' },
    gain:1.00, bend:1.00, bob:3.0, bobSpd:1.00,
    enter:{ x:-420, y:-60, rot:-30, squat:0.55, delay:0,   k:0.085 } },

  { id:'dark', fill:'#16161A', glow:'#9A9AAA', baseX:288, topY:172, halfW:34, kind:'rect',
    eye:{ type:'sclera', y:212, dx:14, r:8.2, pr:4.4, color:'#16161A', white:'#FFFFFF' },
    mouth:null,
    gain:0.66, bend:0.74, bob:2.3, bobSpd:1.33,
    enter:{ x:60,   y:-480, rot:22, squat:0.80, delay:210, k:0.115 } },

  { id:'yellow', fill:'#FFC91B', glow:'#FFE99A', baseX:372, topY:210, halfW:53, kind:'arch',
    eye:{ type:'dot', y:250, dx:0, ox:14, r:5.6, color:'#16161A', single:true },
    mouth:{ y:272, w:38, kind:'line', anchor:-0.76 },
    gain:0.82, bend:0.58, bob:2.6, bobSpd:0.82,
    enter:{ x:300,  y:80,  rot:12, squat:0.30, delay:95,  k:0.135 } },

  { id:'orange', fill:'#F4661E', glow:'#FFB489', baseX:178, topY:270, halfW:94, kind:'dome',
    eye:{ type:'dot', y:302, dx:27, r:7.2, color:'#16161A' },
    mouth:{ y:332, w:8.8, kind:'open' },
    gain:1.22, bend:0.40, bob:3.8, bobSpd:1.12,
    enter:{ x:-380, y:90,  rot:-14, squat:0.42, delay:330, k:0.10 } }
];

/* ── 彈簧：每個會動的數值都有重量，會過衝一點再回穩 ── */
function S(v,k,d){ this.v=v; this.t=v; this.z=0; this.k=k||0.14; this.d=d||0.76; }
S.prototype.step=function(){ this.z=(this.z+(this.t-this.v)*this.k)*this.d; this.v+=this.z; return this.v; };
S.prototype.set=function(t){ this.t=t; return this; };
S.prototype.jump=function(v){ this.v=this.t=v; this.z=0; return this; };
function rnd(a,b){ return a+Math.random()*(b-a); }
function clamp(v,a,b){ return v<a?a:(v>b?b:v); }

/* ══════════════════════════════════════════════════════════════════
   身體：脊椎 + 寬度曲線 → 每格重算的外框
   t = 0 在腳底、1 在頭頂
   dx(t) = lean*t   整個歪過去、腳仍釘在地上（＝平行四邊形）
         + bend*t²  再彎一點，越上面彎越多（＝真的有彈性）
   ══════════════════════════════════════════════════════════════════ */
function widthAt(c, t){
  if (c.kind === 'dome') return c.halfW * Math.sqrt(Math.max(0, 1 - t*t));       // 半圓
  if (c.kind === 'arch'){                                                        // 上緣半圓
    var hh = GROUND - c.topY, rr = c.halfW, tr = 1 - rr/hh;
    if (t <= tr) return c.halfW;
    var u = (t - tr) / (1 - tr);
    return c.halfW * Math.sqrt(Math.max(0, 1 - u*u));
  }
  return c.halfW;                                                                // 直角長方形
}

function bodyPath(c, lean, bend, hK, wK){
  var h = (GROUND - c.topY) * hK;
  var N = (c.kind === 'rect') ? 10 : 72;   // 圓弧取樣加密，不然邊緣會有稜角
  var L = [], R = [];
  for (var i=0; i<=N; i++){
    var t = i/N;
    var y = GROUND - h*t;
    var dx = lean*t + bend*t*t;
    var hw = widthAt(c, t) * wK;
    L.push([c.baseX + dx - hw, y]);
    R.push([c.baseX + dx + hw, y]);
  }
  var d = 'M ' + L[0][0].toFixed(1) + ' ' + L[0][1].toFixed(1);
  for (var a=1;a<=N;a++) d += ' L ' + L[a][0].toFixed(1) + ' ' + L[a][1].toFixed(1);
  for (var b=N;b>=0;b--) d += ' L ' + R[b][0].toFixed(1) + ' ' + R[b][1].toFixed(1);
  return d + ' Z';
}

/* 臉要跟著身體一起歪 —— 算出某個高度在變形後跑到哪 */
function spineAt(c, t, lean, bend, hK){
  return { x: c.baseX + lean*t + bend*t*t,
           y: GROUND - (GROUND - c.topY) * hK * t };
}

/* ── 建立 DOM ── */
var defs = document.createElementNS(NS,'defs');
SVG.appendChild(defs);

var chars = [];
CAST.forEach(function(c, idx){
  var g = document.createElementNS(NS,'g');

  // 同色系柔光暈（參考影片每隻外圈都有一層）
  var fid = 'glow'+idx;
  var f = document.createElementNS(NS,'filter');
  f.setAttribute('id', fid);
  f.setAttribute('x','-40%'); f.setAttribute('y','-40%');
  f.setAttribute('width','180%'); f.setAttribute('height','180%');
  var fd = document.createElementNS(NS,'feDropShadow');
  fd.setAttribute('dx','0'); fd.setAttribute('dy','0'); fd.setAttribute('stdDeviation','7');
  fd.setAttribute('flood-color', c.glow); fd.setAttribute('flood-opacity','0.5');
  f.appendChild(fd);
  defs.appendChild(f);

  var body = document.createElementNS(NS,'path');
  body.setAttribute('fill', c.fill);
  body.setAttribute('filter','url(#'+fid+')');
  g.appendChild(body);

  // 眼睛
  var eyes = [];
  var slots = c.eye.single ? [0] : [-1, 1];
  slots.forEach(function(s){
    var wrap = document.createElementNS(NS,'g');
    var white=null, pupil, hi=null, arc;
    if (c.eye.type === 'sclera'){
      white = document.createElementNS(NS,'ellipse');
      white.setAttribute('rx', c.eye.r); white.setAttribute('ry', c.eye.r*1.04);
      white.setAttribute('fill', c.eye.white);
      wrap.appendChild(white);
    }
    pupil = document.createElementNS(NS,'ellipse');
    var pr0 = (c.eye.type==='sclera') ? c.eye.pr : c.eye.r;
    pupil.setAttribute('rx', pr0); pupil.setAttribute('ry', pr0);
    pupil.setAttribute('fill', c.eye.color);
    wrap.appendChild(pupil);
    if (c.eye.hi){
      hi = document.createElementNS(NS,'circle');
      hi.setAttribute('r', c.eye.r*0.30);
      hi.setAttribute('fill','#FFFFFF'); hi.setAttribute('opacity','0.9');
      wrap.appendChild(hi);
    }
    // 情緒用的弧線眼（^ ^ 難過 / ∪ ∪ 開心），跟圓眼互相切換
    arc = document.createElementNS(NS,'path');
    arc.setAttribute('fill','none');
    arc.setAttribute('stroke', c.eye.type==='sclera' ? '#FFFFFF' : c.eye.color);
    arc.setAttribute('stroke-width', 2.8);
    arc.setAttribute('stroke-linecap','round');
    arc.setAttribute('opacity', 0);
    wrap.appendChild(arc);
    g.appendChild(wrap);
    eyes.push({ wrap:wrap, white:white, pupil:pupil, hi:hi, arc:arc, side:s });
  });

  // 嘴巴（實心、會開合變形）
  var mouth = null;
  if (c.mouth){
    mouth = document.createElementNS(NS,'path');
    mouth.setAttribute('fill', c.eye.color);
    g.appendChild(mouth);
  }

  SVG.appendChild(g);

  chars.push({
    c:c, g:g, body:body, eyes:eyes, mouth:mouth,
    lean:new S(0,0.10,0.80), bendS:new S(0,0.09,0.82),
    hK:new S(1,c.enter.k,0.76), wK:new S(1,c.enter.k,0.76),
    slideX:new S(0,0.11,0.78), lift:new S(0,0.11,0.78),
    ox:new S(0,0.15,0.70), oy:new S(0,0.15,0.70),
    lid:new S(1,0.40,0.55), curve:new S(0,0.16,0.72), open:new S(0,0.16,0.72),
    eyeMode:'round',
    blinkAt:rnd(900,3800), blinkT:0, nod:0, shake:0, phase:rnd(0,6.28),
    introRot:0, faceOp:1, startle:0
  });
});

/* ── 狀態 ── */
var MOOD='intro', lookAt=null, mouse={x:260,y:200}, moodUntil=0;
var glanceUntil=0, glancePair=null;
function setMood(m, ms){ MOOD=m; moodUntil = ms ? performance.now()+ms : 0; }

function toSvg(cx, cy){
  var r = SVG.getBoundingClientRect(), vb = SVG.viewBox.baseVal;
  var s = Math.min(r.width/vb.width, r.height/vb.height);
  var ox = r.left + (r.width - vb.width*s)/2, oy = r.top + (r.height - vb.height*s)/2;
  return { x: vb.x + (cx-ox)/s, y: vb.y + (cy-oy)/s };
}
window.addEventListener('pointermove', function(e){
  var p = toSvg(e.clientX, e.clientY); mouse.x=p.x; mouse.y=p.y;
}, {passive:true});

/* ── 每一格 ── */
var t0=performance.now(), last=t0;
function frame(now){
  var dt = Math.min(50, now-last); last=now;
  var el = now - t0;
  if (FORCE) MOOD = FORCE;
  else if (moodUntil && now>moodUntil) setMood(lookAt ? 'curious' : 'idle');

  if (!FORCE && (MOOD==='idle'||MOOD==='curious') && now>glanceUntil){
    if (glancePair){ glancePair=null; glanceUntil=now+rnd(2600,5200); }
    else { var gi=Math.floor(rnd(0,chars.length-1)); glancePair=[gi,gi+1]; glanceUntil=now+rnd(1200,2100); }
  }

  chars.forEach(function(ch, i){
   try {
    var c = ch.c;

    var tgt = lookAt || mouse, glanceTo = null;
    if (glancePair && (i===glancePair[0]||i===glancePair[1])){
      var o = chars[i===glancePair[0]?glancePair[1]:glancePair[0]];
      if (o){ tgt = { x:o.c.baseX, y:o.c.eye.y }; glanceTo = o; }
    }

    var ex = c.baseX, ey = c.eye.y;
    var dx = tgt.x-ex, dy = tgt.y-ey;
    var dist = Math.sqrt(dx*dx+dy*dy)||1;
    var ux = dx/dist, uy = dy/dist;
    var reach = Math.min(1, dist/200);
    // 眼珠能跑的範圍拉大 —— 要看得出來它們真的在盯著你
    var maxO = (c.eye.type==='sclera') ? (c.eye.r-c.eye.pr)*1.05 : c.eye.r*1.15;

    if (MOOD !== 'intro'){ ch.introRot = 0; ch.faceOp = 1; ch.slideX.set(0); }

    if (MOOD==='intro'){ applyIntro(ch, now); }

    else if (MOOD==='shy'){
      ch.lean.set(-26*c.bend); ch.bendS.set(-12*c.bend);
      ch.hK.set(0.965); ch.wK.set(1.02); ch.lift.set(0);
      ch.ox.set(-maxO); ch.oy.set(-maxO*0.2);
      // 「好吧我不看」：眼睛**閉成一條線**（不是瞇眼笑），嘴巴抿平
      ch.lid.set(1); ch.eyeMode='closed';
      ch.curve.set(-0.25); ch.open.set(0);
    }
    else if (MOOD==='sad'){
      ch.lean.set(0); ch.bendS.set(6*c.bend);
      ch.hK.set(0.90); ch.wK.set(1.06); ch.lift.set(0);
      ch.ox.set(ux*maxO*0.3); ch.oy.set(maxO*1.15);   // 眼珠垂到最下面
      // 「啊…我完蛋了」：眼睛垂下來變小，嘴角往下垮，整個人縮一圈
      ch.lid.set(0.48); ch.eyeMode='round';      // 眼皮垂下來一半
      ch.curve.set(-1); ch.open.set(0);
    }
    else if (MOOD==='happy'){
      var hop = Math.abs(Math.sin(el/135 + ch.phase));
      ch.lean.set(Math.sin(el/135+ch.phase)*10*c.bend);
      ch.bendS.set(0);
      ch.hK.set(1.03 + hop*0.05); ch.wK.set(0.98 - hop*0.03);
      ch.lift.set(-hop*17*c.gain);
      ch.ox.set(0); ch.oy.set(-maxO*0.3);
      ch.lid.set(1); ch.eyeMode='squint';       // ^ ^ 只有開心才用
      ch.curve.set(1); ch.open.set(1);
    }
    else if (MOOD==='aha'){
      // 「哦～原來如此」：眼睛睜大、嘴巴張成 O、身體往後仰一點點
      ch.lean.set(-10*c.bend); ch.bendS.set(-6*c.bend);
      ch.hK.set(1.045); ch.wK.set(0.985); ch.lift.set(0);
      ch.ox.set(ux*maxO*0.5); ch.oy.set(-maxO*0.45);
      ch.lid.set(1.34); ch.eyeMode='round';
      ch.curve.set(0.05); ch.open.set(1.7);    // 嘴巴張成 O（curve 不能為負，否則會走垮嘴那條）
    }
    else if (MOOD==='curious'){
      // 湊過去看：腳釘住、身體伸長並整個歪過去
      ch.lean.set(clamp(dx*0.14, -46, 46) * c.bend);
      ch.bendS.set(clamp(dx*0.07, -22, 22) * c.bend);
      ch.hK.set(1.055); ch.wK.set(0.975);
      ch.lift.set(0);
      ch.ox.set(ux*maxO); ch.oy.set(uy*maxO*0.85);
      ch.lid.set(1.12); ch.eyeMode='round';
      ch.curve.set(0.15); ch.open.set(0.7);
    }
    else { /* idle */
      if (glanceTo){
        // 望向彼此時身體也要動：比對方高的**彎腰低頭**，比對方矮的**挺身抬頭**
        var dir = (glanceTo.c.baseX > c.baseX) ? 1 : -1;
        var taller = (c.topY < glanceTo.c.topY);           // topY 越小 = 越高
        ch.lean.set(dir * (taller ? 26 : 12) * c.bend);
        ch.bendS.set(dir * (taller ? 16 : -6) * c.bend);
        ch.hK.set(taller ? 0.965 : 1.03);                  // 彎腰縮一點 / 挺身拉高
        ch.wK.set(taller ? 1.02 : 0.99);
        ch.lift.set(0);
      } else {
      ch.lean.set(clamp(dx*0.055, -20, 20) * c.bend);
      ch.bendS.set(clamp(dx*0.025, -9, 9) * c.bend);
      ch.hK.set(1); ch.wK.set(1); ch.lift.set(0);
      }
      ch.ox.set(ux*maxO*reach); ch.oy.set(uy*maxO*0.8*reach);
      ch.lid.set(1); ch.eyeMode='round';
      ch.curve.set(c.id==='orange'?1:0.15); ch.open.set(c.id==='orange'?0.75:0);
    }

    if (ch.startle > 0){
      ch.startle -= dt;
      // 驚訝：眼睛瞪很大、瞳孔往上、嘴巴張成明顯的 O（之前太小看不出來）
      ch.lid.set(1.85); ch.eyeMode='round';
      ch.ox.set(ux*maxO*0.25); ch.oy.set(-maxO*0.65);
      ch.curve.set(0.02); ch.open.set(2.6);
    }

    if (ch.startle <= 0 && MOOD!=='shy' && MOOD!=='sad' && MOOD!=='intro'){
      ch.blinkAt -= dt;
      if (ch.blinkAt<=0){ ch.blinkT=140; ch.blinkAt = rnd(2100,6200)*(Math.random()<0.2?0.1:1); }
      if (ch.blinkT>0){ ch.blinkT-=dt; ch.lid.set(0.06); }
    }
    var nodOff=0, shOff=0;
    if (ch.nod>0){ ch.nod-=dt; nodOff = Math.sin((1-ch.nod/600)*Math.PI*2)*8*c.gain; }
    if (ch.shake>0){ ch.shake-=dt; shOff = Math.sin((1-ch.shake/600)*Math.PI*3.2)*14*c.bend; }

    var bob = 0;   // Martin：不要上下飄，站在同一個平面上

    var lean = ch.lean.step() + shOff;
    var bend = ch.bendS.step();
    var hK   = ch.hK.step();
    var wK   = ch.wK.step();
    var lift = ch.lift.step() + bob + nodOff;

    ch.body.setAttribute('d', bodyPath(c, lean, bend, hK, wK));
    var slide = ch.slideX.step();
    var rr = ch.introRot || 0;
    var cy = (GROUND + c.topY)/2;
    ch.g.setAttribute('transform', 'translate('+slide.toFixed(2)+','+lift.toFixed(2)+')'
      + (rr ? ' rotate('+rr.toFixed(1)+' '+c.baseX+' '+cy.toFixed(0)+')' : ''));

    var eyeT = (GROUND - c.eye.y) / (GROUND - c.topY);
    var sp = spineAt(c, eyeT, lean, bend, hK);
    var ox = ch.ox.step(), oy = ch.oy.step();
    var lid = clamp(ch.lid.step(), 0.05, 1.3);
    var mode = ch.eyeMode;                       // round｜squint｜closed
    var showArc = (mode !== 'round');

    ch.eyes.forEach(function(e){
      var homeX = sp.x + (c.eye.single ? (c.eye.ox||0) : e.side*c.eye.dx);   // 不乘 wK：五官等比例，不跟著身體壓扁
      e.wrap.setAttribute('transform','translate('+homeX.toFixed(2)+','+sp.y.toFixed(2)+')');
      var fo = ch.faceOp;
      if (e.white) e.white.setAttribute('opacity', (showArc?0:1)*fo);
      e.pupil.setAttribute('opacity', (showArc?0:1)*fo);
      if (e.hi) e.hi.setAttribute('opacity', (showArc?0:0.9)*fo);
      e.arc.setAttribute('opacity', (showArc?1:0)*fo);
      if (showArc){
        var w = c.eye.r*1.2;
        if (mode === 'squint')                    // ^ ^ 開心的瞇眼（只有開心才用）
          e.arc.setAttribute('d','M '+(-w)+' 3 Q 0 -4.5 '+w+' 3');
        else                                      // — — 刻意閉上（不看）
          e.arc.setAttribute('d','M '+(-w)+' 0 Q 0 1.4 '+w+' 0');
      } else {
        var pr = (c.eye.type==='sclera') ? c.eye.pr : c.eye.r;
        e.pupil.setAttribute('rx', pr.toFixed(2));
        e.pupil.setAttribute('ry', (pr*lid).toFixed(2));
        e.pupil.setAttribute('cx', ox.toFixed(2));
        e.pupil.setAttribute('cy', oy.toFixed(2));
        if (e.white) e.white.setAttribute('ry', (c.eye.r*1.04*lid).toFixed(2));
        if (e.hi){ e.hi.setAttribute('cx',(ox-pr*0.34).toFixed(2)); e.hi.setAttribute('cy',(oy-pr*0.40).toFixed(2)); }
      }
    });

    paintMouth(ch, ox, hK, wK, lean, bend);
   } catch(e){ if(!window.__opzAnimErr){ window.__opzAnimErr=e; console.error('[characters]', e); } }
  });

  requestAnimationFrame(frame);
}

/* 嘴巴：照參考影片重畫。
   開心的嘴＝**上緣是直的、下緣是圓的實心塊**（像倒過來的 D），不是橄欖形。
   嘴角往下垮＝難過，往上＝開心；open 控制張多大。 */
function paintMouth(ch, ox, hK, wK, lean, bend){
  var c = ch.c; if (!ch.mouth) return;
  ch.mouth.setAttribute('opacity', ch.faceOp);
  var mT = (GROUND - c.mouth.y) / (GROUND - c.topY);
  var m  = spineAt(c, mT, lean, bend, hK);
  var x  = m.x + ox*0.45, y = m.y;
  var cur = ch.curve.step(), op = clamp(ch.open.step(), 0, 2.8);
  var f1 = function(v){ return v.toFixed(1); };

  if (c.mouth.kind === 'line' && ch.startle <= 0){
    // 黃色那隻：一條伸出身體外的橫桿，會依情緒微彎
    var w = c.mouth.w, a = c.mouth.anchor||0;
    var x1 = x + w*a, x2 = x + w*(a+1), xm = (x1+x2)/2, th = 3.2;
    var sag = -cur*3.5;
    ch.mouth.setAttribute('d','M '+f1(x1)+' '+f1(y)+
      ' Q '+f1(xm)+' '+f1(y+sag)+' '+f1(x2)+' '+f1(y)+
      ' L '+f1(x2)+' '+f1(y+th)+
      ' Q '+f1(xm)+' '+f1(y+sag+th)+' '+f1(x1)+' '+f1(y+th)+' Z');
    return;
  }

  /* 可愛的 Q 版嘴：**上緣是一條直線、下緣是半圓**，又短又厚。
     尺寸照參考影片量出來的比例：寬只有身體的 9%（大約兩顆眼睛寬），
     長寬比 1.75 —— 之前我畫成身體的 22%，難怪又長又醜。 */
  var w2 = c.mouth.w + op*1.6;
  if (cur < 0){
    // 垮下來：一條嘴角朝下的弧（∩），細細的一條就好
    var dip = 7.5*(-cur), th2 = 3.0;
    ch.mouth.setAttribute('d',
      'M '+f1(x-w2)+' '+f1(y+dip)+
      ' Q '+f1(x)+' '+f1(y-dip*0.6)+' '+f1(x+w2)+' '+f1(y+dip)+
      ' Q '+f1(x)+' '+f1(y-dip*0.6+th2)+' '+f1(x-w2)+' '+f1(y+dip)+' Z');
    return;
  }
  // 張開：上緣直線 + 下緣半橢圓。open 越大嘴巴越深，笑起來就越開
  var depth = 2.2 + op*7.5 + cur*1.5;
  var lip   = y - cur*1.0;
  ch.mouth.setAttribute('d',
    'M '+f1(x-w2)+' '+f1(lip)+
    ' L '+f1(x+w2)+' '+f1(lip)+
    ' A '+f1(w2)+' '+f1(depth)+' 0 0 1 '+f1(x-w2)+' '+f1(lip)+' Z');
}

/* ── 動畫曲線 ────────────────────────────────────────────────────
   全部都是「慢起步 → 加速 → 慢慢煞車」，沒有一段是等速的。
   等速就是廉價感的來源；有質感的動作一定有加速度。 */
function ease(t){ return t<0?0:(t>1?1:t); }

// 長大用：先微微下蹲（預備動作）→ 中段最快 → 收尾過衝一點再回穩
function inOutBack(t, s){
  s = (s==null?1.05:s) * 1.525; t = ease(t) * 2;
  if (t < 1) return 0.5 * (t*t*((s+1)*t - s));
  t -= 2;   return 0.5 * (t*t*((s+1)*t + s) + 2);
}
// 純粹的慢-快-慢，不過衝
function inOutCubic(t){ t=ease(t); return t<0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2; }
// 自由落體：等加速度（現實中東西就是這樣掉的，越掉越快）
function freeFall(t){ t=ease(t); return t*t; }

/* 真實的彈跳：第一段是自由落下，之後每次反彈只剩 e 倍的速度，
   所以彈得一次比一次矮、一次比一次快 —— 就跟真的球一樣。 */
var BOUNCE_E = 0.60;
function bounceSegs(){
  var segs=[1];
  for (var i=1;i<4;i++) segs.push(2*Math.pow(BOUNCE_E,i));
  return segs;
}
function bounceH(u){                      // 回傳 0..1 的高度
  var segs=bounceSegs(), total=0, i;
  for (i=0;i<segs.length;i++) total+=segs[i];
  var x=ease(u)*total, acc=0;
  for (i=0;i<segs.length;i++){
    if (x <= acc+segs[i]){
      var k=(x-acc)/segs[i];
      if (i===0) return 1-k*k;                                  // 第一次純落下
      return Math.pow(BOUNCE_E,2*i) * (1-Math.pow(2*k-1,2));    // 之後的拋物線
    }
    acc+=segs[i];
  }
  return 0;
}
function bounceSpeed(u){                  // 用高度變化率當速度，決定壓扁多少
  var d=0.012;
  return Math.min(1, Math.abs(bounceH(u+d)-bounceH(u-d))/d/2.2);
}

/* ══════════════════════════════════════════════════════════════════
   進場腳本：四隻各有各的節奏，總長約 1.7 秒。
   （比參考影片慢 —— Martin 要更有重量感，快就顯得廉價）
   ══════════════════════════════════════════════════════════════════ */
var INTRO = {
  // 橘色：小球依真實重力彈進來，落地後才慢慢撐開成大半圓
  orange: { dur:1680, pose:function(t){
    var BALL=0.52;
    if (t < BALL){
      var u=t/BALL, h=bounceH(u), sp=bounceSpeed(u);
      var squash = 1 - (1-h)*sp*0.5;                 // 接近地面且速度快 → 壓扁
      return { slide:-300*(1-inOutCubic(u*1.15)), lift:-190*h,
               hK:0.30*(2-squash), wK:0.34*(0.55+squash*0.8), lean:0, bend:0 };
    }
    var v=(t-BALL)/(1-BALL), e=inOutBack(v,1.15);
    return { slide:0, lift:0,
             hK:0.30+(1-0.30)*e, wK:0.34+(1-0.34)*inOutBack(v,1.55), lean:0, bend:0 };
  }},

  // 黃色：原地長高。寬度完全不變（照影片）；慢起步、中段快、收尾煞車
  yellow: { dur:820, delay:800, pose:function(t){
    return { slide:0, lift:0, hK:0.38+(1-0.38)*inOutBack(t,1.2), wK:1, lean:0, bend:0 };
  }},

  // 紫色：正方形晃兩下（有阻尼，越晃越小），再慢慢抽長；抽長時變瘦、回穩時彈回
  purple: { dur:980, delay:760, pose:function(t){
    var SQ=104/254, W=0.34;
    if (t < W){
      var u=t/W, w=Math.sin(u*Math.PI*2.4)*8*Math.pow(1-u,1.6);
      return { slide:0, lift:0, hK:SQ, wK:1, lean:w, bend:w*0.55 };
    }
    var v=(t-W)/(1-W), e=inOutBack(v,1.1);
    return { slide:0, lift:0, hK:SQ+(1-SQ)*e,
             wK:1-Math.sin(ease(v)*Math.PI)*0.085, lean:0, bend:0 };
  }},

  // 黑色：從天花板自由落體（越掉越快），落地壓扁再回彈
  dark: { dur:640, delay:560, tail:420, pose:function(t){
    if (t < 1){
      // 自由落體 + 邊掉邊翻一圈。空中沒有外力，所以**角速度是等速的**（轉一圈剛好落地），
      // 只有下墜是加速的 —— 這才符合物理。身體同時彎著，不是一根硬柱子。
      var e=freeFall(t);
      return { slide:26*(1-t), lift:-560*(1-e),
               rot:-372*(1-t),
               hK:1.02, wK:0.97,
               lean:16*Math.sin(t*Math.PI*1.4), bend:-22*Math.sin(t*Math.PI*1.4) };
    }
    var v=ease((t-1)/(420/640));
    var sq=Math.sin((1-v)*Math.PI)*(1-v)*0.22;      // 觸地那一下壓最扁，然後回彈
    return { slide:0, lift:0, rot:0, hK:1-sq, wK:1+sq*0.9,
             lean:9*Math.sin((1-v)*Math.PI*2)*(1-v), bend:0 };
  }}
};

function settleNow(){
  chars.forEach(function(ch){
    ch.lean.jump(0); ch.bendS.jump(0); ch.hK.jump(1); ch.wK.jump(1);
    ch.slideX.jump(0); ch.lift.jump(0); ch.lid.jump(1);
    ch.ox.jump(0); ch.oy.jump(0); ch.eyeMode='round';
  });
  setMood(FORCE || 'idle');
}

var introT0 = 0;
function startIntro(){
  if (STILL || reduce){ settleNow(); return; }
  introT0 = performance.now();
  var end = 0;
  chars.forEach(function(ch){
    var s = INTRO[ch.c.id]; if(!s) return;
    ch.lid.jump(0.05);
    var total = (s.delay||0) + s.dur*(1 + ((s.tail||0)/s.dur));
    if (total > end) end = total;
    setTimeout(function(){ ch.lid.set(1); }, (s.delay||0) + s.dur*0.75);   // 站定才睜眼
  });
  setTimeout(function(){ chars.forEach(function(ch){ ch.eyeMode='round'; }); setMood('idle'); }, end + 60);
}

/* 進場期間：直接照腳本擺位，不走彈簧（彈簧會把四種不同的節奏抹平成同一種） */
function applyIntro(ch, now){
  var s = INTRO[ch.c.id]; if(!s) return false;
  var t = (now - introT0 - (s.delay||0)) / s.dur;
  if (t < 0) t = 0;
  var span = 1 + ((s.tail||0)/s.dur);
  if (t > span){
    /* 進場已經結束。**一定要在這裡歸位**：瀏覽器在分頁沒被看的時候會跳格，
       只要「結束的那一格」被跳過，這隻角色就會永遠停在畫面外（橘色就是這樣消失的）。*/
    if (!ch.introDone){
      ch.introDone = true;
      ch.slideX.jump(0); ch.lift.jump(0);
      ch.hK.jump(1); ch.wK.jump(1); ch.lean.jump(0); ch.bendS.jump(0);
      ch.introRot = 0; ch.faceOp = 1;
    }
    return false;
  }
  var p = s.pose(Math.min(t, span));
  ch.slideX.jump(p.slide); ch.lift.jump(p.lift);
  ch.hK.jump(p.hK); ch.wK.jump(p.wK);
  ch.lean.jump(p.lean); ch.bendS.jump(p.bend);
  ch.introRot = p.rot || 0;
  // 身體長到 8 成之前不要露臉 —— 否則五官會跟著身體一起被壓扁。
  // 先有身體、再有生命（參考影片也是這樣）。
  ch.faceOp = (p.hK > 0.82 && p.wK > 0.82) ? 1 : 0;
  return true;
}


/* ── 自動接上表單（不改頁面的任何程式碼）────────────────────────────
   欄位靠型別找；「顯示密碼」的按鈕靠它在密碼欄附近找。
   登入失敗不去攔 Firebase，而是**觀察錯誤訊息有沒有跳出來** ——
   所以不管那頁的登入怎麼寫，這裡都不會把它弄壞。 */
var emailEl = document.querySelector('input[type=email]')
           || document.querySelector('input[name*=mail i],input[id*=mail i]');
var pwEls   = [].slice.call(document.querySelectorAll('input[type=password]'));
var pwEl    = pwEls[0] || null;
var revealed = false;

function fieldPoint(el){
  var r = el.getBoundingClientRect();
  return toSvg(r.left + Math.min(40, r.width*0.25), r.top + r.height/2);
}
function focusOn(el){ lookAt = fieldPoint(el); if (MOOD!=='shy') setMood('curious'); }
function focusOff(){ lookAt=null; if (MOOD==='curious') setMood('idle'); }

[emailEl].concat(pwEls).forEach(function(el){
  if (!el) return;
  el.addEventListener('focus', function(){
    if (el.type==='password' && revealed) return;
    focusOn(el);
    if (el.type==='password' && emailEl && emailEl.value) setMood('aha', 850);
  });
  el.addEventListener('blur', focusOff);
  var tick=0;
  el.addEventListener('input', function(){
    if (MOOD==='shy') return;
    if (lookAt) focusOn(el);
    if (++tick % 4 === 0){ var ch=chars[Math.floor(rnd(0,chars.length))]; if(ch) ch.nod=600; }
  });
});

if (emailEl) emailEl.addEventListener('change', function(){
  if (!emailEl.value) return;
  var ok = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailEl.value);
  if (ok) setMood('aha', 1000);
  chars.forEach(function(ch,i){ setTimeout(function(){ if(ok) ch.nod=600; else ch.shake=600; }, i*60); });
});

/* 「顯示密碼」：頁面自己的按鈕若存在就掛上去；找不到就算了，不影響其他功能 */
(function(){
  if (!pwEl) return;
  var box = pwEl.closest('div') || pwEl.parentNode;
  var btn = box && box.querySelector('button,[role=button],.toggle-pw,.peek,.eye');
  if (!btn) return;
  btn.addEventListener('click', function(){
    setTimeout(function(){
      revealed = (pwEl.type === 'text');
      if (revealed){ lookAt=null; setMood('shy'); }
      else { setMood('idle'); if (document.activeElement===pwEl) focusOn(pwEl); }
    }, 0);
  });
})();

/* 觀察錯誤訊息／成功畫面，決定難過還是開心 —— 完全不介入登入流程本身 */
(function(){
  function visible(el){
    if (!el) return false;
    var s = getComputedStyle(el);
    return s.display!=='none' && s.visibility!=='hidden' && +s.opacity>0.05 &&
           (el.textContent||'').trim().length > 0;
  }
  var errEls = [].slice.call(document.querySelectorAll(OPT.error));
  var okEls  = [].slice.call(document.querySelectorAll(OPT.success));
  var wasErr = errEls.some(visible), wasOk = okEls.some(visible);
  if (!errEls.length && !okEls.length) return;
  new MutationObserver(function(){
    var e = errEls.some(visible), o = okEls.some(visible);
    if (o && !wasOk){ lookAt=null; setMood('happy', 3000); }
    else if (e && !wasErr){
      lookAt=null; setMood('sad', 2600);
      chars.forEach(function(ch,i){ setTimeout(function(){ ch.shake=600; }, i*70); });
    }
    wasErr=e; wasOk=o;
  }).observe(document.body, { subtree:true, childList:true, characterData:true,
                              attributes:true, attributeFilter:['style','class'] });
})();


/* ══════════════════════════════════════════════════════════════════
   戳一下 —— 果凍感
   被戳的那隻：嚇一跳（眼睛睜大、嘴巴變 O），身體被壓一下。
   旁邊的：被推得晃一下，離越近推越大。

   作法是**往彈簧裡注入速度**（不是設定目標值），讓彈簧自己的阻尼
   產生逐漸變小的來回擺動 —— 那就是果凍晃動的物理。
   ══════════════════════════════════════════════════════════════════ */
function poke(hitIdx, px){
  chars.forEach(function(ch, i){
    var c = ch.c, d = Math.abs(c.baseX - chars[hitIdx].c.baseX);
    if (i === hitIdx){
      ch.startle = 900;
      ch.lean.z  += (px > c.baseX ? -1 : 1) * 6.5 * c.bend;   // 往被戳的反方向退（力道減半）
      ch.bendS.z += (px > c.baseX ? -1 : 1) * 4.0 * c.bend;
      ch.hK.z    -= 0.026;                                     // 被壓一下
      ch.wK.z    += 0.020;
      ch.lift.z  -= 1.8;                                       // 輕輕一跳
    } else {
      var dir = (c.baseX > chars[hitIdx].c.baseX) ? 1 : -1;   // 被推開
      var f = Math.max(0.18, 1 - d/230);                      // 越近推越大
      ch.lean.z  += dir * 4.8 * f * c.bend;                   // 被推開（力道減半）
      ch.bendS.z += dir * 2.6 * f * c.bend;
      ch.hK.z    -= 0.010 * f;
      ch.wK.z    += 0.008 * f;
      if (f > 0.55) ch.startle = 520;                          // 很近的也小驚一下
    }
  });
}

chars.forEach(function(ch, i){
  ch.g.style.pointerEvents = 'auto';
  ch.g.addEventListener('pointerdown', function(e){
    var p = toSvg(e.clientX, e.clientY);
    poke(i, p.x);
  });
});

startIntro();
requestAnimationFrame(frame);
}   /* start() */

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})();
