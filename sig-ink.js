/* ═══════════════════════════════════════════════════════════════════════
   OPUS.Z 簽名「鋼筆」墨水引擎  opz-ink v1  (2026-08-19)
   輸入：扁平筆跡 [{x,y,b,p?}]  b=1=新筆畫起點, p=筆壓(Pencil, 選填)
   做法：① 去抖平滑 ② Catmull-Rom 曲線加密 ③ 等距重取樣
        ④ 每點筆寬 = 基寬 × 速度(慢粗快細) × 筆壓 × 筆尖角度(側鋒細/中鋒粗) × 起收筆收尖
        ⑤ 整筆用「左右外框連成封閉路徑 fill()」畫出 → 連續墨跡，沒有段接縫
   用法：OPZInk.render(canvas, strokes, opt)    // 直接畫完
        OPZInk.play(canvas, strokes, opt)      // 逐筆寫出來（回傳 cancel 函式）
   opt: {mode:'raw'|'fit', weight:1, color:'#111', pad:0.10, duration:2400}
        raw = 座標已用寬度正規化(簽名板用)；fit = bbox 置中縮放(公開頁用)
   ═══════════════════════════════════════════════════════════════════════ */
(function (g) {
  var NIB = -38 * Math.PI / 180;   // 筆尖角度：左下→右上為側鋒(細)，垂直方向最粗
  var NIB_MIN = 0.78;              // 側鋒最細比例（越小＝方向造成的粗細差越誇張。繞圈的簽名太小會「呼胖呼瘦」）
  var W_MIN = 0.62, W_MAX = 1.42;  // 速度造成的粗細範圍

  function split(flat) {
    var out = [], cur = null;
    for (var i = 0; i < flat.length; i++) {
      var p = flat[i];
      if (!cur || p.b) { cur = []; out.push(cur); }
      cur.push(p);
    }
    return out.filter(function (s) { return s.length; });
  }

  // [1,2,1]/4 平滑，端點保留
  function smooth(a, key, times) {
    for (var t = 0; t < times; t++) {
      var b = a.slice();
      for (var i = 1; i < a.length - 1; i++) b[i] = (a[i - 1] + 2 * a[i] + a[i + 1]) / 4;
      a = b;
    }
    return a;
  }

  /* 沿線長度做平滑：sigma 是「多少 px 之內算同一段筆勢」。
     這裡是關鍵——粗細必須在很長一段距離上慢慢變，才像真的筆；
     用點數平滑等於只平滑了幾 px，會留下一節一節的肉瘤。 */
  function blurLen(a, step, sigma) {
    var r = Math.max(1, Math.round(sigma / step));
    for (var pass = 0; pass < 3; pass++) {
      var pre = [0];
      for (var i = 0; i < a.length; i++) pre.push(pre[i] + a[i]);
      var b = new Array(a.length);
      for (var i = 0; i < a.length; i++) {
        var lo = Math.max(0, i - r), hi = Math.min(a.length - 1, i + r);
        b[i] = (pre[hi + 1] - pre[lo]) / (hi - lo + 1);
      }
      a = b;
    }
    return a;
  }

  function catmull(p0, p1, p2, p3, t) {
    var t2 = t * t, t3 = t2 * t;
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
  }

  /* 一筆 → 等距取樣點 [{x,y,v,pr}]（v=速度 px/sample, pr=筆壓） */
  function trace(pts, step) {
    var n = pts.length;
    if (n === 1) return [{ x: pts[0].x, y: pts[0].y, v: 0, pr: pts[0].pr }];

    // 速度（原始取樣間距）＋重平滑
    // 筆速用「前後各兩點的窗口」量：iPad/Safari 的時間戳常常好幾個點撞在同一毫秒，
    // 一點一點量會忽快忽慢（結果就是筆畫呼胖呼瘦）。
    var spd = [];
    for (var i = 0; i < n; i++) {
      var i0 = Math.max(0, i - 2), i1 = Math.min(n - 1, i + 2);
      var d = 0;
      for (var k = i0 + 1; k <= i1; k++) d += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y);
      var dt = (typeof pts[i0].t === 'number' && typeof pts[i1].t === 'number')
        ? Math.max(1, pts[i1].t - pts[i0].t) : Math.max(1, i1 - i0);
      spd.push(d / dt);
    }
    spd = smooth(spd, 0, 4);

    // 位置輕度去抖
    var xs = smooth(pts.map(function (p) { return p.x; }), 0, 1);
    var ys = smooth(pts.map(function (p) { return p.y; }), 0, 1);
    var prs = pts.map(function (p) { return (typeof p.pr === 'number' && p.pr > 0) ? p.pr : 0.5; });

    // Catmull-Rom 加密
    var dense = [];
    for (var i = 0; i < n - 1; i++) {
      var i0 = Math.max(0, i - 1), i1 = i, i2 = i + 1, i3 = Math.min(n - 1, i + 2);
      var seg = Math.hypot(xs[i2] - xs[i1], ys[i2] - ys[i1]);
      var sub = Math.max(2, Math.min(24, Math.ceil(seg / Math.max(0.5, step * 0.5))));
      for (var k = 0; k < sub; k++) {
        var t = k / sub;
        dense.push({
          x: catmull(xs[i0], xs[i1], xs[i2], xs[i3], t),
          y: catmull(ys[i0], ys[i1], ys[i2], ys[i3], t),
          v: spd[i1] + (spd[i2] - spd[i1]) * t,
          pr: prs[i1] + (prs[i2] - prs[i1]) * t
        });
      }
    }
    dense.push({ x: xs[n - 1], y: ys[n - 1], v: spd[n - 1], pr: prs[n - 1] });

    // 等距重取樣
    var out = [dense[0]], acc = 0;
    for (var i = 1; i < dense.length; i++) {
      var d = Math.hypot(dense[i].x - dense[i - 1].x, dense[i].y - dense[i - 1].y);
      if (d <= 1e-6) continue;
      acc += d;
      while (acc >= step) {
        var back = (acc - step) / d;
        out.push({
          x: dense[i].x - (dense[i].x - dense[i - 1].x) * back,
          y: dense[i].y - (dense[i].y - dense[i - 1].y) * back,
          v: dense[i].v, pr: dense[i].pr
        });
        acc -= step;
      }
    }
    if (out.length < 2) out.push({ x: dense[dense.length - 1].x + 0.01, y: dense[dense.length - 1].y, v: 0, pr: out[0].pr });
    return out;
  }

  /* 把扁平筆跡編譯成可畫的墨跡幾何 */
  function build(flat, o) {
    o = o || {};
    var W = o.W, H = o.H, weight = o.weight || 1;
    var groups = split(flat);
    if (!groups.length) return { strokes: [], total: 0 };

    var sc, ox, oy, base;
    if (o.mode === 'fit') {
      var minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
      for (var i = 0; i < flat.length; i++) {
        var p = flat[i];
        if (p.x < minx) minx = p.x; if (p.x > maxx) maxx = p.x;
        if (p.y < miny) miny = p.y; if (p.y > maxy) maxy = p.y;
      }
      var bw = (maxx - minx) || 1e-3, bh = (maxy - miny) || 1e-3;
      var pd = Math.min(W, H) * (o.pad != null ? o.pad : 0.10);
      sc = Math.min((W - pd * 2) / bw, (H - pd * 2) / bh);
      ox = (W - bw * sc) / 2 - minx * sc; oy = (H - bh * sc) / 2 - miny * sc;
      base = Math.max(0.9, bw * sc * 0.0125 * weight);
    } else {                       // raw：座標已以寬度正規化
      sc = W; ox = 0; oy = 0;
      base = Math.max(0.9, W * 0.0105 * weight);
    }

    var step = Math.max(0.55, base * 0.35);
    var strokes = [], total = 0;

    // 該簽名的「基準速度」→ 快慢是相對這個人的手速，不受裝置取樣率影響
    var allSpd = [];
    for (var gI = 0; gI < groups.length; gI++) {
      var G = groups[gI];
      for (var i = 2; i < G.length - 2; i++) {
        var i0 = i - 2, i1 = i + 2, d = 0;
        for (var k = i0 + 1; k <= i1; k++) d += Math.hypot((G[k].x - G[k - 1].x) * sc, (G[k].y - G[k - 1].y) * sc);
        var dt = (typeof G[i0].t === 'number' && typeof G[i1].t === 'number')
          ? Math.max(1, G[i1].t - G[i0].t) : Math.max(1, i1 - i0);
        allSpd.push(d / dt);
      }
    }
    allSpd.sort(function (a, b) { return a - b; });
    var refV = allSpd.length ? Math.max(0.05, allSpd[Math.floor(allSpd.length * 0.55)]) : 4;

    for (var gI = 0; gI < groups.length; gI++) {
      var raw = groups[gI].map(function (p) {
        return { x: p.x * sc + ox, y: p.y * sc + oy, pr: p.p, t: p.t };
      });
      var S = trace(raw, step);
      var m = S.length;

      if (m < 2) {                                  // 點 → 小墨點
        strokes.push({ dot: true, x: S[0].x, y: S[0].y, r: base * 0.55, len: base });
        total += base; continue;
      }

      var len = (m - 1) * step;
      var tip = Math.min(len * 0.22, base * 7);     // 起收筆收尖長度

      // 筆寬：先把「速度×筆壓×筆尖」這組調變在長距離上抹平（避免抽動），
      //       最後才乘上起收筆的收尖（收尖要保持乾脆，所以放在平滑之後）。
      var mod = new Array(m);
      for (var i = 0; i < m; i++) {
        var a = S[Math.max(0, i - 3)], b = S[Math.min(m - 1, i + 3)];
        var dir = Math.atan2(b.y - a.y, b.x - a.x);
        var nib = NIB_MIN + (1 - NIB_MIN) * Math.abs(Math.sin(dir - NIB));
        var sp = W_MAX - (W_MAX - W_MIN) * Math.min(1, S[i].v / (refV * 2.1));
        var pr = 0.86 + 0.28 * Math.min(1.2, S[i].pr);
        mod[i] = nib * sp * pr;
      }
      mod = blurLen(mod, step, Math.max(7, base * 4.5));

      var ws = new Array(m);
      for (var i = 0; i < m; i++) {
        var s2 = i * step, e2 = len - s2;
        var tp = Math.pow(Math.min(1, Math.min(s2, e2) / (tip || 1)), 0.55);
        ws[i] = Math.max(0.32, base * mod[i] * (0.22 + 0.78 * tp));
      }

      // 左右外框
      var L = new Array(m), R = new Array(m);
      for (var i = 0; i < m; i++) {
        var a = S[Math.max(0, i - 1)], b = S[Math.min(m - 1, i + 1)];
        var dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
        var nx = -dy / d, ny = dx / d, hw = ws[i] / 2;
        L[i] = [S[i].x + nx * hw, S[i].y + ny * hw];
        R[i] = [S[i].x - nx * hw, S[i].y - ny * hw];
      }
      strokes.push({ L: L, R: R, n: m, step: step, len: len });
      total += len + base * 3;                      // 筆與筆之間留一點空拍
    }
    return { strokes: strokes, total: total, base: base };
  }

  function fillStroke(ctx, s, n) {
    if (s.dot) { ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.2832); ctx.fill(); return; }
    n = Math.max(2, Math.min(s.n, n));
    ctx.beginPath();
    ctx.moveTo(s.L[0][0], s.L[0][1]);
    for (var i = 1; i < n; i++) ctx.lineTo(s.L[i][0], s.L[i][1]);
    for (var i = n - 1; i >= 0; i--) ctx.lineTo(s.R[i][0], s.R[i][1]);
    ctx.closePath();
    ctx.fill();
  }

  function paint(ctx, built, k, color, W, H) {
    ctx.clearRect(0, 0, W, H);
    if (!built.strokes.length) return;
    ctx.fillStyle = color || '#111';
    var target = (k >= 1 ? Infinity : k * built.total), acc = 0;
    for (var i = 0; i < built.strokes.length; i++) {
      var s = built.strokes[i];
      if (acc >= target) break;
      var avail = target - acc;
      fillStroke(ctx, s, s.dot ? 2 : Math.floor(avail / s.step) + 2);
      acc += (s.len || 0) + built.base * 3;
    }
  }

  function fit(c) {
    var r = c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    var W = Math.max(1, r.width), H = Math.max(1, r.height);
    var pw = Math.round(W * dpr), ph = Math.round(H * dpr);
    if (c.width !== pw || c.height !== ph) { c.width = pw; c.height = ph; }
    var x = c.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: x, W: W, H: H };
  }

  function render(canvas, flat, o) {
    o = o || {};
    var f = fit(canvas);
    f.ctx.clearRect(0, 0, f.W, f.H);
    if (!flat || !flat.length) return;
    var built = build(flat, { W: f.W, H: f.H, mode: o.mode || 'fit', weight: o.weight, pad: o.pad });
    paint(f.ctx, built, 1, o.color, f.W, f.H);
  }

  function play(canvas, flat, o) {
    o = o || {};
    var f = fit(canvas);
    f.ctx.clearRect(0, 0, f.W, f.H);
    if (!flat || !flat.length) return function () { };
    var built = build(flat, { W: f.W, H: f.H, mode: o.mode || 'fit', weight: o.weight, pad: o.pad });
    var dur = o.duration || 2400, t0 = null, raf = 0, dead = false;
    function frame(t) {
      if (dead) return;
      if (!t0) t0 = t;
      var k = Math.min(1, (t - t0) / dur);
      paint(f.ctx, built, k, o.color, f.W, f.H);
      if (k < 1) raf = requestAnimationFrame(frame);
      else if (o.onDone) o.onDone();
    }
    raf = requestAnimationFrame(frame);
    return function () { dead = true; cancelAnimationFrame(raf); };
  }

  /* ── 筆跡編輯：上一步 / 橡皮擦 ─────────────────────────────
     兩個都是「改點陣列」，不是把畫布塗白 → 資料還是乾淨的向量，之後重播照樣漂亮。 */

  // 移除最後一筆（可以連按）
  function undo(flat) {
    if (!flat || !flat.length) return [];
    var i = flat.length - 1;
    while (i > 0 && !flat[i].b) i--;
    return flat.slice(0, i);
  }

  // 擦掉半徑 r 之內的點；被擦斷的地方會自動變成兩筆（真的擦，不是整筆刪掉）
  function erase(flat, x, y, r) {
    if (!flat || !flat.length) return [];
    var out = [], broken = false, r2 = r * r;
    for (var i = 0; i < flat.length; i++) {
      var p = flat[i];
      if (p.b) broken = false;
      var dx = p.x - x, dy = p.y - y;
      if (dx * dx + dy * dy <= r2) { broken = true; continue; }
      var q = { x: p.x, y: p.y, b: (p.b || broken) ? 1 : 0 };
      if (typeof p.t === 'number') q.t = p.t;
      if (typeof p.p === 'number') q.p = p.p;
      out.push(q); broken = false;
    }
    // 只剩一個點的碎屑清掉（不然畫面會留一堆小黑點）
    var res = [], start = 0;
    for (var i = 0; i <= out.length; i++) {
      if (i === out.length || (i > start && out[i].b)) {
        if (i - start >= 2) for (var k = start; k < i; k++) res.push(out[k]);
        start = i;
      }
    }
    return res;
  }

  g.OPZInk = { render: render, play: play, build: build, paint: paint, fit: fit, undo: undo, erase: erase };
})(window);
