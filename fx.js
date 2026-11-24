// 数学的な演出：方眼紙＋フラクタル＋浮遊する数学記号の背景、π の画面切り替え、丸付け（○ / ✕ / はなまる）
(function () {
  "use strict";
  const mq = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  const reduce = () => mq.matches;
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || "#888";
  const SYMS = ["π", "∑", "∫", "√", "∞", "∂", "∇", "θ", "λ", "φ", "ε", "δ", "∀", "∃", "∈", "≅", "⊂", "∪", "∩", "≦", "≧", "±", "×", "÷", "e", "i", "ℝ", "ℤ", "ℚ", "ℂ", "ℕ", "Δ", "Ω", "α", "β", "ζ", "ℵ₀", "⊗", "∮", "x²", "n!", "sin", "log", "lim", "dx", "eⁱᵖ", "√2", "∅", "⇔", "f′"];
  const PI = "3.14159265358979323846264338327950288419716939937510582097494459230781640628620899862803482534211706798214808651328230664709384460955058223172535940812848111745028410270193852110555964462294895493038196";

  // ───── 背景 ─────
  const cv = document.createElement("canvas"); cv.id = "fx-bg"; cv.setAttribute("aria-hidden", "true");
  const off = document.createElement("canvas");
  let W = 0, H = 0, dpr = 1, parts = [], raf = 0, last = 0;

  function sierpinski(g, x, y, s, d) {
    if (d === 0) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + s, y); g.lineTo(x + s / 2, y - s * 0.866); g.closePath(); g.stroke(); return; }
    const h = s / 2; sierpinski(g, x, y, h, d - 1); sierpinski(g, x + h, y, h, d - 1); sierpinski(g, x + h / 2, y - h * 0.866, h, d - 1);
  }
  function koch(g, x1, y1, x2, y2, d) {
    if (d === 0) { g.moveTo(x1, y1); g.lineTo(x2, y2); return; }
    const dx = (x2 - x1) / 3, dy = (y2 - y1) / 3, ax = x1 + dx, ay = y1 + dy, bx = x1 + 2 * dx, by = y1 + 2 * dy;
    const px = ax + dx * 0.5 - dy * 0.866, py = ay + dy * 0.5 + dx * 0.866;
    koch(g, x1, y1, ax, ay, d - 1); koch(g, ax, ay, px, py, d - 1); koch(g, px, py, bx, by, d - 1); koch(g, bx, by, x2, y2, d - 1);
  }
  function snowflake(g, cx, cy, r, d) {
    const p = [0, 1, 2].map(k => [cx + r * Math.cos(-Math.PI / 2 + k * 2 * Math.PI / 3), cy + r * Math.sin(-Math.PI / 2 + k * 2 * Math.PI / 3)]);
    g.beginPath(); koch(g, p[0][0], p[0][1], p[2][0], p[2][1], d); koch(g, p[2][0], p[2][1], p[1][0], p[1][1], d); koch(g, p[1][0], p[1][1], p[0][0], p[0][1], d); g.stroke();
  }
  function goldenSpiral(g, cx, cy, a, turns) {
    // 黄金螺旋 r = a·φ^(2θ/π)（フィボナッチ数列の正方形に沿う螺旋の連続版）
    const phi = (1 + Math.sqrt(5)) / 2; g.beginPath();
    for (let k = 0; k <= turns * 120; k++) { const t = k * Math.PI / 60, r = a * Math.pow(phi, 2 * t / Math.PI), x = cx + r * Math.cos(t), y = cy - r * Math.sin(t); k ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
  }
  function unitCircle(g, cx, cy, r) {
    g.beginPath(); g.arc(cx, cy, r, 0, 2 * Math.PI); g.stroke();
    g.beginPath(); g.moveTo(cx - r * 1.2, cy); g.lineTo(cx + r * 1.2, cy); g.moveTo(cx, cy - r * 1.2); g.lineTo(cx, cy + r * 1.2); g.stroke();
    for (let k = 0; k < 12; k++) { const t = k * Math.PI / 6; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + r * Math.cos(t), cy - r * Math.sin(t)); g.stroke(); }
  }
  function drawFractals() {
    off.width = W * dpr; off.height = H * dpr;
    const g = off.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    g.strokeStyle = css("--ai"); g.lineWidth = 1; g.globalAlpha = 0.09;
    const m = Math.min(W, H);
    sierpinski(g, -m * 0.04, H + 2, m * 0.42, 6);
    snowflake(g, W - m * 0.16, m * 0.2, m * 0.15, 4);
    goldenSpiral(g, W - m * 0.2, H - m * 0.22, m * 0.004, 2.2);
    unitCircle(g, m * 0.16, m * 0.62, m * 0.09);
  }
  function seed() {
    const n = Math.min(70, Math.round(W * H / 24000));
    parts = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.12, vy: -0.05 - Math.random() * 0.12,
      s: 14 + Math.random() * 30, sym: SYMS[Math.floor(Math.random() * SYMS.length)], r: (Math.random() - 0.5) * 0.6, vr: (Math.random() - 0.5) * 0.002,
      a: 0.05 + Math.random() * 0.09
    }));
  }
  function frame(t) {
    raf = requestAnimationFrame(frame);
    if (t - last < 40) return; last = t;           // 25fps 程度で十分
    paint(true);
  }
  function paint(move) {
    const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    g.drawImage(off, 0, 0, W, H);
    g.fillStyle = css("--ink"); g.textAlign = "center"; g.textBaseline = "middle";
    for (const p of parts) {
      if (move) { p.x += p.vx; p.y += p.vy; p.r += p.vr; if (p.y < -40) { p.y = H + 40; p.x = Math.random() * W; } if (p.x < -40) p.x = W + 40; if (p.x > W + 40) p.x = -40; }
      g.save(); g.globalAlpha = p.a; g.translate(p.x, p.y); g.rotate(p.r);
      g.font = `${p.s}px "Shippori Mincho B1", "Hiragino Mincho ProN", serif`; g.fillText(p.sym, 0, 0); g.restore();
    }
  }
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + "px"; cv.style.height = H + "px";
    drawFractals(); if (!parts.length) seed(); paint(false);
  }
  function startBg() {
    document.body.prepend(cv); resize();
    addEventListener("resize", () => { clearTimeout(resize._t); resize._t = setTimeout(resize, 150); });
    const run = () => { cancelAnimationFrame(raf); if (!reduce() && !document.hidden) raf = requestAnimationFrame(frame); };
    document.addEventListener("visibilitychange", run);
    if (mq.addEventListener) mq.addEventListener("change", run);
    // テーマ（明暗）が変わったら描き直す
    const dark = matchMedia("(prefers-color-scheme: dark)"); if (dark.addEventListener) dark.addEventListener("change", () => { drawFractals(); paint(false); });
    new MutationObserver(() => { drawFractals(); paint(false); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    run();
  }

  // ───── π の画面切り替え ─────
  let piEl = null;
  function section() {
    if (reduce()) return;
    if (!piEl) { piEl = document.createElement("div"); piEl.id = "fx-pi"; piEl.setAttribute("aria-hidden", "true"); document.body.appendChild(piEl); }
    const off = Math.floor(Math.random() * 60);
    piEl.innerHTML = `<svg viewBox="0 0 200 200" width="200" height="200">
      <defs><path id="fx-pi-path" d="M100,100 m-74,0 a74,74 0 1,1 148,0 a74,74 0 1,1 -148,0"></path></defs>
      <circle class="pi-bg" cx="100" cy="100" r="88"></circle>
      <circle class="pi-c" cx="100" cy="100" r="56"></circle>
      <line class="pi-d" x1="44" y1="100" x2="156" y2="100"></line>
      <g class="pi-rot"><text class="pi-digits"><textPath href="#fx-pi-path">${PI.slice(off, off + 90)}</textPath></text></g>
      <text class="pi-g" x="100" y="104">π</text></svg>`;
    piEl.classList.remove("run"); void piEl.offsetWidth; piEl.classList.add("run");
  }

  // ───── 判子（はんこ）の丸付け ─────
  let inkN = 0;
  function inkFilter(id) {
    const s1 = Math.floor(Math.random() * 999), s2 = Math.floor(Math.random() * 999);
    // ゆがみ（にじみ）＋かすれ（朱肉のむら）
    return `<filter id="${id}" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="${s1}" result="n"></feTurbulence>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="3.2" xChannelSelector="R" yChannelSelector="G" result="d"></feDisplacementMap>
      <feTurbulence type="fractalNoise" baseFrequency="1.9" numOctaves="1" seed="${s2}" result="sp"></feTurbulence>
      <feColorMatrix in="sp" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 2.05" result="m"></feColorMatrix>
      <feComposite in="d" in2="m" operator="in"></feComposite></filter>`;
  }
  const SEAL = {
    ok: `<circle cx="60" cy="60" r="54" stroke-width="5.5" fill="none"></circle><circle cx="60" cy="60" r="46.5" stroke-width="1.8" fill="none"></circle>
         <text x="60" y="55" font-size="36">正</text><text x="60" y="93" font-size="36">解</text>`,
    ng: `<rect x="7" y="7" width="106" height="106" rx="9" stroke-width="5.5" fill="none"></rect><rect x="14.5" y="14.5" width="91" height="91" rx="5" stroke-width="1.8" fill="none"></rect>
         <path d="M35 26 L85 74 M85 26 L35 74" stroke-width="9" stroke-linecap="round" fill="none"></path><text x="60" y="100" font-size="17" letter-spacing="2">不正解</text>`,
    hana: `<path d="M60 4 C70 -2 82 8 79 16 C90 11 102 22 95 32 C107 34 110 49 100 54 C110 61 106 76 94 77 C100 88 90 100 79 96 C78 108 63 112 58 102 C51 112 36 108 36 96 C25 101 14 90 21 79 C9 77 4 62 14 56 C4 49 9 34 20 33 C14 22 25 11 36 16 C34 6 47 -2 54 6 Z" stroke-width="4.5" fill="none"></path>
         <circle cx="60" cy="58" r="37" stroke-width="1.6" fill="none"></circle><text x="60" y="54" font-size="17">大変よく</text><text x="60" y="77" font-size="17">できました</text>`
  };
  function mark(el, kind) {
    if (!el) return;
    el.querySelectorAll(".fx-mark").forEach(x => x.remove());
    const id = "fx-ink-" + (++inkN), rot = (kind === "ng" ? 6 : -6) + (Math.random() * 10 - 5);
    const d = document.createElement("div"); d.className = `fx-mark fx-stamp fx-${kind}${reduce() ? " still" : ""}`; d.setAttribute("aria-hidden", "true");
    d.style.setProperty("--r", rot.toFixed(1) + "deg");
    d.innerHTML = `<svg viewBox="0 0 120 120"><defs>${inkFilter(id)}</defs><g class="seal" filter="url(#${id})">${SEAL[kind]}</g></svg>`;
    if (getComputedStyle(el).position === "static") el.style.position = "relative";
    el.appendChild(d);
    if (!reduce()) { el.classList.remove("fx-thud"); void el.offsetWidth; el.classList.add("fx-thud"); setTimeout(() => el.classList.remove("fx-thud"), 420); }
  }

  // ───── 戻るときのフラクタル（コッホ雪片の逆反復） ─────
  let backEl = null, backRaf = 0;
  function back() {
    if (reduce()) return;
    if (!backEl) { backEl = document.createElement("div"); backEl.id = "fx-back"; backEl.setAttribute("aria-hidden", "true"); backEl.innerHTML = `<canvas width="440" height="440"></canvas><span>Koch snowflake  n → 0</span>`; document.body.appendChild(backEl); }
    const c = backEl.querySelector("canvas"), g = c.getContext("2d"), lab = backEl.querySelector("span");
    const ink = css("--ai"), soft = css("--ai-soft"), D = 950, t0 = performance.now();
    cancelAnimationFrame(backRaf); backEl.classList.add("on");
    const step = now => {
      const t = Math.min(1, (now - t0) / D), depth = Math.max(0, 5 - Math.floor(t / 0.13));
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 440, 440);
      g.beginPath(); g.arc(220, 220, 206, 0, 2 * Math.PI); g.fillStyle = css("--surface"); g.globalAlpha = 0.96; g.fill(); g.lineWidth = 2; g.strokeStyle = css("--line"); g.stroke(); g.globalAlpha = 1;
      g.save(); g.translate(220, 220); g.rotate(-t * Math.PI * 0.75); g.scale(1 - 0.25 * t, 1 - 0.25 * t); g.translate(-220, -220);
      g.lineWidth = 2.5; g.strokeStyle = ink; g.fillStyle = soft; g.globalAlpha = 1;
      const r = 150, p = [0, 1, 2].map(k => [220 + r * Math.cos(-Math.PI / 2 + k * 2 * Math.PI / 3), 220 + r * Math.sin(-Math.PI / 2 + k * 2 * Math.PI / 3)]);
      g.beginPath(); koch(g, p[0][0], p[0][1], p[2][0], p[2][1], depth); koch(g, p[2][0], p[2][1], p[1][0], p[1][1], depth); koch(g, p[1][0], p[1][1], p[0][0], p[0][1], depth); g.closePath(); g.fill(); g.stroke();
      g.restore();
      lab.textContent = `Koch snowflake  n = ${depth}`;
      backEl.style.opacity = t < 0.12 ? t / 0.12 : t > 0.78 ? Math.max(0, (1 - t) / 0.22) : 1;
      if (t < 1) backRaf = requestAnimationFrame(step); else backEl.classList.remove("on");
    };
    backRaf = requestAnimationFrame(step);
  }

  window.WK_FX = { section, mark, back };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startBg); else startBg();
})();
