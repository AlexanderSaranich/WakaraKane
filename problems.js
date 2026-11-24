// 数学問題集：計算問題の自動生成・記述式の自動採点・証明問題
// 採点は式として評価して比べる（並べ方・表記が違っても同値なら正解）。
(function () {
  "use strict";

  // ═════════ 数式エンジン（複素数・多変数） ═════════
  const C = (re, im = 0) => ({ re, im });
  const add = (a, b) => C(a.re + b.re, a.im + b.im);
  const sub = (a, b) => C(a.re - b.re, a.im - b.im);
  const mul = (a, b) => C(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
  const div = (a, b) => { const d = b.re * b.re + b.im * b.im; return d === 0 ? C(NaN, NaN) : C((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
  function pow(a, b) {
    if (b.im === 0 && Number.isInteger(b.re) && Math.abs(b.re) <= 64) {
      let r = C(1), n = Math.abs(b.re); for (let k = 0; k < n; k++) r = mul(r, a);
      return b.re < 0 ? div(C(1), r) : r;
    }
    if (a.im === 0 && b.im === 0 && a.re >= 0) return C(Math.pow(a.re, b.re));
    return C(NaN, NaN);
  }
  const sqrtC = a => a.im !== 0 ? C(NaN, NaN) : a.re >= 0 ? C(Math.sqrt(a.re)) : C(0, Math.sqrt(-a.re));

  // 入力の表記ゆれをそろえる
  function normalize(s) {
    return String(s ?? "")
      .replace(/²/g, "^2").replace(/³/g, "^3").replace(/⁴/g, "^4").replace(/⁵/g, "^5")
      .normalize("NFKC")
      .replace(/[−–—‐]/g, "-").replace(/[×・]/g, "*").replace(/÷/g, "/")
      .replace(/π/g, "pi").replace(/\s+/g, "");
  }
  function tokenize(s) {
    const t = []; let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/[0-9.]/.test(c)) { let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++; t.push({ k: "n", v: parseFloat(s.slice(i, j)) }); i = j; continue; }
      if (s.startsWith("sqrt", i)) { t.push({ k: "sqrt" }); i += 4; continue; }
      if (s.startsWith("pi", i)) { t.push({ k: "n", v: Math.PI }); i += 2; continue; }
      if (c === "√") { t.push({ k: "sqrt" }); i++; continue; }
      if (/[a-z]/i.test(c)) { t.push(c === "i" ? { k: "i" } : { k: "v", v: c.toLowerCase() }); i++; continue; }
      if ("+-*/^()".includes(c)) { t.push({ k: c }); i++; continue; }
      throw new Error("bad char " + c);
    }
    return t;
  }
  function parse(str) {
    const t = tokenize(normalize(str)); let p = 0;
    const peek = () => t[p], eat = k => { if (t[p] && t[p].k === k) return t[p++]; throw new Error("expected " + k); };
    const startsAtom = x => x && (x.k === "n" || x.k === "v" || x.k === "i" || x.k === "(" || x.k === "sqrt");
    function expr() {
      let n = term();
      while (peek() && (peek().k === "+" || peek().k === "-")) { const o = t[p++].k; n = { t: o === "+" ? "add" : "sub", a: n, b: term() }; }
      return n;
    }
    function term() {
      let n = unary();
      for (;;) {
        const x = peek();
        if (x && (x.k === "*" || x.k === "/")) { p++; n = { t: x.k === "*" ? "mul" : "div", a: n, b: unary() }; }
        else if (startsAtom(x)) n = { t: "mul", a: n, b: power() };
        else return n;
      }
    }
    function unary() { const x = peek(); if (x && x.k === "-") { p++; return { t: "neg", a: unary() }; } if (x && x.k === "+") { p++; return unary(); } return power(); }
    function power() { const b = atom(); if (peek() && peek().k === "^") { p++; return { t: "pow", a: b, b: unary() }; } return b; }
    function atom() {
      const x = t[p++]; if (!x) throw new Error("end");
      if (x.k === "n") return { t: "n", v: C(x.v) };
      if (x.k === "i") return { t: "n", v: C(0, 1) };
      if (x.k === "v") return { t: "v", n: x.v };
      if (x.k === "(") { const n = expr(); eat(")"); return n; }
      if (x.k === "sqrt") return { t: "sqrt", a: atom() };
      throw new Error("unexpected " + x.k);
    }
    const n = expr(); if (p !== t.length) throw new Error("trailing"); return n;
  }
  function ev(n, env) {
    switch (n.t) {
      case "n": return n.v;
      case "v": return env[n.n] !== undefined ? env[n.n] : C(NaN, NaN);
      case "add": return add(ev(n.a, env), ev(n.b, env));
      case "sub": return sub(ev(n.a, env), ev(n.b, env));
      case "mul": return mul(ev(n.a, env), ev(n.b, env));
      case "div": return div(ev(n.a, env), ev(n.b, env));
      case "pow": return pow(ev(n.a, env), ev(n.b, env));
      case "neg": { const v = ev(n.a, env); return C(-v.re, -v.im); }
      case "sqrt": return sqrtC(ev(n.a, env));
    }
  }
  function vars(n, s = new Set()) { if (!n) return s; if (n.t === "v") s.add(n.n); vars(n.a, s); vars(n.b, s); return s; }
  const close = (a, b) => isFinite(a.re) && isFinite(b.re) && isFinite(a.im) && isFinite(b.im) &&
    Math.abs(a.re - b.re) <= 1e-7 * (1 + Math.abs(b.re)) && Math.abs(a.im - b.im) <= 1e-7 * (1 + Math.abs(b.im));
  function tryParse(s) { try { return parse(s); } catch (e) { return null; } }
  // 2 式が同値か（変数にいくつかの値を代入して比較）
  function equivalent(sa, sb) {
    const A = typeof sa === "string" ? tryParse(sa) : sa, B = typeof sb === "string" ? tryParse(sb) : sb;
    if (!A || !B) return false;
    const vs = [...new Set([...vars(A), ...vars(B)])];
    const samples = vs.length ? [0.37, 1.61, 2.83, -1.29, 3.47] : [0];
    for (let k = 0; k < samples.length; k++) {
      const env = {}; vs.forEach((v, j) => { env[v] = C(samples[(k + j * 2) % samples.length] + j * 0.11); });
      if (!close(ev(A, env), ev(B, env))) return false;
    }
    return true;
  }
  // 積の形か（因数分解の判定）：定数でない因数の個数を数える
  function factors(n) { if (n.t === "neg") return factors(n.a); if (n.t === "mul") return [...factors(n.a), ...factors(n.b)]; return [n]; }
  const nonConst = n => vars(n).size > 0;
  function nonConstFactorCount(n) {
    return factors(n).reduce((s, f) => s + (!nonConst(f) ? 0 : f.t === "pow" && f.b.t === "n" ? f.b.v.re : 1), 0);
  }

  // ═════════ 答えの照合 ═════════
  const stripVarEq = s => s.replace(/^[a-z]=/i, "");
  const stripTail = s => s.replace(/(円|個|本|度|°|km|m|分|時間|秒|%|パーセント|通り|cm\^?\d?|cm²|cm³)$/u, "");
  function checkNum(given, p) {
    let s = stripTail(stripVarEq(normalize(given).replace(/^[\u3040-\u30ff\u4e00-\u9fff]+/, "")));
    if (p.exact && /\d\.\d/.test(s)) return { ok: false, msg: "小数の近似ではなく、分数や √ を使った正確な値で答えましょう。" };
    const ok = equivalent(s, p.a);
    if (ok && p.simplest) {
      const roots = [...s.matchAll(/(?:√|sqrt)\(?(\d+)/g)].map(x => +x[1]);
      if (roots.some(N => { for (let k = 2; k * k <= N; k++) if (N % (k * k) === 0) return true; return false; })) return { ok: false, msg: "値は合っていますが、√ の中をできるだけ小さい自然数にしましょう（例：√12 → 2√3）。" };
      if (/\/(?:\(?\d*\)?\*?)?(?:√|sqrt)/.test(s)) return { ok: false, msg: "値は合っていますが、分母に √ が残らない形（有理化した形）で答えましょう。" };
    }
    return { ok };
  }
  function checkExpr(given, p) {
    let s = normalize(given).replace(/^[a-z]['′]?(\([a-z]\))?=/i, "");
    const g = tryParse(s); if (!g) return { ok: false, msg: "式として読み取れませんでした。かけ算は 2x、累乗は x^2 のように書けます。" };
    if (!equivalent(g, p.a)) return { ok: false };
    if (p.type === "expand" && /\(/.test(s)) return { ok: false, msg: "値は合っていますが、かっこを外して展開した形で答えましょう。" };
    if (p.type === "factor") {
      const need = nonConstFactorCount(parse(p.a));
      if (nonConstFactorCount(g) < need || !["mul", "pow", "neg"].includes(g.t)) return { ok: false, msg: "値は合っていますが、積の形（因数分解した形）で答えましょう。" };
      const constPart = n => factors(n).filter(f => !nonConst(f)).reduce((v, f) => v * Math.abs(ev(f, {}).re), 1);
      if (Math.abs(constPart(g) - constPart(parse(p.a))) > 1e-9) return { ok: false, msg: "値は合っていますが、共通因数をすべてくくり出しましょう。" };
    }
    return { ok: true };
  }
  function splitPieces(s) { return s.split(/,|、|;|または|or|∨/).map(x => x.trim()).filter(Boolean); }
  function expandPM(piece) { return piece.includes("±") ? [piece.replace("±", "+"), piece.replace("±", "-")] : [piece]; }
  function parseSetValues(given) {
    let s = normalize(given).replace(/^[a-z]=/i, "").replace(/[{}]/g, "");
    if (/^(∅|φ|空集合|なし)?$/.test(s)) return [];
    const vals = [];
    for (const piece of splitPieces(s)) for (const q of expandPM(piece.replace(/^[a-z]=/i, ""))) {
      const n = tryParse(q); if (!n || vars(n).size) return null; vals.push(ev(n, {}));
    }
    return vals.filter((v, i) => !vals.slice(0, i).some(w => close(v, w)));
  }
  function checkSet(given, p) {
    const g = parseSetValues(given); if (!g) return { ok: false, msg: "要素をカンマで区切って書きましょう（例：{1, 3, 5}、2, -3、1±2i）。" };
    const e = p.a.map(x => ev(parse(x), {}));
    const ok = g.length === e.length && e.every(v => g.some(w => close(v, w)));
    return { ok };
  }
  // 不等式の解：述語に直して境界付近の点で比べる
  function ineqPred(str, v) {
    let s = normalize(str);
    if (/^(すべての実数|全ての実数|実数全体|全実数|任意の実数)$/.test(s)) return { f: () => true, cs: [] };
    if (/^(解なし|なし|∅|φ)$/.test(s)) return { f: () => false, cs: [] };
    s = s.replace(/≦|≤|=</g, "<=").replace(/≧|≥|=>/g, ">=").replace(/≠/g, "!=").replace(/＜/g, "<").replace(/＞/g, ">");
    const ors = [], cs = [];
    for (const piece of splitPieces(s)) {
      const ands = [];
      for (const part of piece.split(/かつ|and|∧/)) {
        const toks = part.split(/(<=|>=|!=|<|>|=)/);
        if (toks.length < 3) return null;
        const exprs = [], ops = [];
        for (let k = 0; k < toks.length; k++) {
          if (k % 2 === 0) { const n = tryParse(toks[k]); if (!n) return null; exprs.push(n); if (!vars(n).size) cs.push(ev(n, {}).re); }
          else ops.push(toks[k]);
        }
        ands.push(x => {
          const env = { [v]: C(x) };
          for (let k = 0; k < ops.length; k++) {
            const a = ev(exprs[k], env).re, b = ev(exprs[k + 1], env).re, o = ops[k], eps = 1e-9;
            const r = o === "<" ? a < b - eps : o === ">" ? a > b + eps : o === "<=" ? a <= b + eps : o === ">=" ? a >= b - eps : o === "!=" ? Math.abs(a - b) > eps : Math.abs(a - b) <= eps;
            if (!r) return false;
          }
          return true;
        });
      }
      ors.push(x => ands.every(f => f(x)));
    }
    return { f: x => ors.some(f => f(x)), cs };
  }
  function checkIneq(given, p) {
    const g = ineqPred(given, p.v), e = ineqPred(p.a, p.v);
    if (!g) return { ok: false, msg: `「${p.v} > 3」「-1 ≦ ${p.v} < 2」「${p.v} < 1, 4 < ${p.v}」のように書きましょう。` };
    const cs = [...new Set([...g.cs, ...e.cs].filter(isFinite))].sort((a, b) => a - b);
    const pts = [];
    if (!cs.length) pts.push(-7.3, 0.1, 9.7);
    cs.forEach((c, i) => { const gap = i + 1 < cs.length ? (cs[i + 1] - c) / 3 : 0.5; pts.push(c, c - Math.min(0.5, i ? (c - cs[i - 1]) / 3 : 0.5), c + Math.min(0.5, gap)); });
    if (cs.length) pts.push(cs[0] - 50, cs[cs.length - 1] + 50);
    return { ok: pts.every(x => g.f(x) === e.f(x)) };
  }
  function checkPair(given, p) {
    const s = normalize(given);
    let xs = null;
    const mx = s.match(/x=([^,、]+)/i), my = s.match(/y=([^,、]+)/i);
    if (mx && my) xs = [mx[1], my[1]];
    else { const t = s.replace(/^\(x,y\)=/i, "").replace(/[()]/g, "").split(/,|、/); if (t.length === 2) xs = t; }
    if (!xs) return { ok: false, msg: "「x = 3, y = -2」または「(3, -2)」の形で答えましょう。" };
    return { ok: equivalent(xs[0], p.a[0]) && equivalent(xs[1], p.a[1]) };
  }
  function checkQR(given, p) {
    const t = normalize(given).split(/あまり|余り|…|\.\.\.|r|,|、/i).filter(Boolean);
    if (t.length === 1 && p.a[1] === 0) return { ok: equivalent(t[0], String(p.a[0])) };
    if (t.length !== 2) return { ok: false, msg: "「12 あまり 3」の形で答えましょう。" };
    return { ok: equivalent(t[0], String(p.a[0])) && equivalent(t[1], String(p.a[1])) };
  }
  // 語句の答え（用語の練習と同じ正規化）
  const tnorm = s => String(s ?? "").normalize("NFKC").toLowerCase()
    .replace(/[\u30A1-\u30F6]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[\u2212\u2013\u2014\uFF0D]/g, "-").replace(/[\s「」『』。、．・"'`^()（）]/g, "").replace(/です$|だ$/, "");
  function checkText(given, p) {
    const g = tnorm(given); if (!g) return { ok: false };
    if (p.a.some(x => tnorm(x) === g)) return { ok: true };
    // 数式の答えは値で比較（例：6+5x+x^2 と x^2+5x+6）
    if (!/[\u3040-\u30ff\u4e00-\u9fff]/.test(given)) {
      const strip = s => normalize(s).replace(/^[a-z]=/i, "");
      if (p.a.some(x => !/[\u3040-\u30ff\u4e00-\u9fff]/.test(x) && /[0-9]/.test(x + given) && !/[<>=≦≧,{}]/.test(strip(x)) && equivalent(strip(given), strip(x)))) return { ok: true };
    }
    return { ok: false };
  }
  function checkTSet(given, p) {
    const toks = String(given).normalize("NFKC").split(/[,、，\s]+|と|および|and/).map(tnorm).filter(Boolean);
    if (toks.length !== p.a.length) return { ok: false };
    const used = new Set();
    return { ok: toks.every(tk => { const i = p.a.findIndex((alts, k) => !used.has(k) && alts.some(a => tnorm(a) === tk)); if (i < 0) return false; used.add(i); return true; }) };
  }
  function check(given, p) {
    if (!String(given).trim()) return { ok: false, msg: "答えを入力してください。" };
    try {
      switch (p.type) {
        case "text": return checkText(given, p);
        case "tset": return checkTSet(given, p);
        case "num": return checkNum(given, p);
        case "expr": case "expand": case "factor": return checkExpr(given, p);
        case "set": return checkSet(given, p);
        case "ineq": return checkIneq(given, p);
        case "pair": return checkPair(given, p);
        case "qr": return checkQR(given, p);
      }
    } catch (e) { return { ok: false, msg: "読み取れない入力でした。" }; }
    return { ok: false };
  }

  // ═════════ 表示用の書式 ═════════
  const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const nz = (a, b) => { let x; do x = R(a, b); while (x === 0); return x; };
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
  const lcm = (a, b) => a / gcd(a, b) * b;
  const SUP = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "-": "⁻" };
  const SUB = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "-": "₋" };
  const sup = n => String(n).split("").map(c => SUP[c] || c).join("");
  const subs = n => String(n).split("").map(c => SUB[c] || c).join("");
  const m = n => n < 0 ? "−" + Math.abs(n) : String(n);            // 負号を − で
  const par = n => n < 0 ? "(" + m(n) + ")" : String(n);              // 負なら括弧
  function frac(n, d) { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d) || 1; n /= g; d /= g; return d === 1 ? m(n) : m(n) + "/" + d; }
  const fracA = (n, d) => frac(n, d).replace("−", "-");               // 照合用（ASCII）
  // 多項式（係数は高次から）
  function poly(cs, v = "x") {
    const deg = cs.length - 1; let s = "";
    cs.forEach((c, i) => {
      if (!c) return; const e = deg - i, a = Math.abs(c);
      const body = e === 0 ? String(a) : (a === 1 ? "" : a) + v + (e > 1 ? sup(e) : "");
      s += s ? (c < 0 ? " − " : " + ") + body : (c < 0 ? "−" : "") + body;
    });
    return s || "0";
  }
  function polyA(cs, v = "x") {
    const deg = cs.length - 1;
    return cs.map((c, i) => c ? `${c >= 0 ? "+" : ""}${c}*${v}^${deg - i}` : "").join("") || "0";
  }
  function cpx(a, b) {
    if (!b) return m(a);
    const bi = (Math.abs(b) === 1 ? "" : Math.abs(b)) + "i";
    return a ? m(a) + (b < 0 ? " − " : " + ") + bi : (b < 0 ? "−" : "") + bi;
  }
  const cpxA = (a, b) => `${a}+(${b})*i`;
  const setStr = a => a.length ? "{" + a.join(", ") + "}" : "∅";
  const linFactor = (r, v = "x") => r === 0 ? v : `(${v} ${r > 0 ? "−" : "+"} ${Math.abs(r)})`;   // (x − r)
  const fmtNum = x => { const s = (Math.round(x * 1e6) / 1e6).toString(); return s; };

  // ═════════ 単元（問題の生成） ═════════
  const U = [];
  const unit = (o) => U.push(o);
  const KP = { basic: ["(", ")", "/", "−"], frac: ["/", "−"], root: ["√", "/", "(", ")", "^"], poly: ["^", "(", ")", "−", "/"], set: ["{", "}", ",", "∅", "−"], ineq: ["<", ">", "≦", "≧", ",", "−", "/", "√"], cpx: ["i", "±", "√", ",", "−", "/"], pair: ["x =", "y =", ",", "−"] };

  // ── Lv1 算数 ──
  unit({ id: "tashizan", lv: 1, name: "たし算", desc: "2〜3 けたの加法", fmt: "数で答えます。", kp: [], gen() {
    const k = pick([2, 2, 3]), a = Array.from({ length: k }, () => k === 3 ? R(10, 99) : R(100, 999)); const s = a.reduce((x, y) => x + y, 0);
    return { q: a.join(" + ") + " =", type: "num", a: String(s), show: String(s), e: `一の位から順に足し、くり上がりに注意します。${a.join(" + ")} = ${s}` };
  } });
  unit({ id: "hikizan", lv: 1, name: "ひき算", desc: "3〜4 けたの減法", fmt: "数で答えます。", kp: [], gen() {
    const big = Math.random() < 0.4, a = big ? R(1000, 9999) : R(100, 999), b = R(10, a - 1);
    return { q: `${a} − ${b} =`, type: "num", a: String(a - b), show: String(a - b), e: `くり下がりに注意します。${a} − ${b} = ${a - b}` };
  } });
  unit({ id: "kakezan", lv: 1, name: "かけ算", desc: "九九から 2 けた × 2 けたまで", fmt: "数で答えます。", kp: [], gen() {
    const k = R(0, 3), a = k === 0 ? R(2, 9) : k === 3 ? R(101, 999) : R(11, 99), b = k <= 1 ? R(2, 9) : k === 2 ? R(11, 99) : R(2, 9);
    return { q: `${a} × ${b} =`, type: "num", a: String(a * b), show: String(a * b), e: `${a} × ${b} = ${a * b}` };
  } });
  unit({ id: "warizan", lv: 1, name: "わり算（あまり）", desc: "商とあまりを求める", fmt: "「17 あまり 3」の形。割り切れるときは商だけでも可。", kp: [], gen() {
    const b = R(2, 12), qq = R(3, 60), r = R(0, b - 1), a = b * qq + r;
    return { q: `${a} ÷ ${b} の商とあまりは？`, type: "qr", a: [qq, r], show: r ? `${qq} あまり ${r}` : `${qq}（割り切れる）`, e: `${b} × ${qq} + ${r} = ${a}。あまり ${r} は割る数 ${b} より小さい。` };
  } });
  unit({ id: "shisoku", lv: 1, name: "四則の混じった計算", desc: "計算の順序（かっこ → ×÷ → ＋−）", fmt: "数で答えます。", kp: [], gen() {
    const t = R(0, 4); let q, v, e;
    if (t === 0) { const a = R(2, 30), b = R(2, 9), c = R(2, 9); q = `${a} + ${b} × ${c}`; v = a + b * c; e = `かけ算が先：${b} × ${c} = ${b * c}、${a} + ${b * c} = ${v}`; }
    else if (t === 1) { const a = R(2, 20), b = R(2, 20), c = R(2, 9); q = `(${a} + ${b}) × ${c}`; v = (a + b) * c; e = `かっこが先：${a + b} × ${c} = ${v}`; }
    else if (t === 2) { const d = R(2, 9), k = R(2, 9), c = d * k, a = R(2, 9), b = R(2, 9); q = `${a} × ${b} − ${c} ÷ ${d}`; v = a * b - k; if (v < 0) return this.gen(); e = `${a * b} − ${k} = ${v}`; }
    else if (t === 3) { const b = R(2, 9), c = R(2, 9), a = b * c + R(1, 40), d = R(1, 30); q = `${a} − ${b} × ${c} + ${d}`; v = a - b * c + d; e = `${b} × ${c} = ${b * c} を先に計算：${a} − ${b * c} + ${d} = ${v}`; }
    else { const c = R(2, 9), k = R(2, 15), b = R(1, 30), a = c * k + b; q = `(${a} − ${b}) ÷ ${c}`; v = k; e = `${a - b} ÷ ${c} = ${k}`; }
    return { q: q + " =", type: "num", a: String(v), show: String(v), e };
  } });
  unit({ id: "bunsuu_keisan", lv: 1, name: "分数の計算", desc: "通分・約分・逆数", fmt: "「3/4」のように分数で（約分した形が模範解答。同じ値なら正解）。", kp: KP.frac, gen() {
    const D = [2, 3, 4, 5, 6, 8, 9, 10, 12], b = pick(D), d = pick(D), a = R(1, b * 2 - 1), c = R(1, d * 2 - 1), op = pick(["+", "−", "×", "÷"]);
    let n, dd, e;
    if (op === "+" || op === "−") {
      const L = lcm(b, d), A = a * L / b, Cc = c * L / d;
      if (op === "−" && A < Cc) return this.gen();
      n = op === "+" ? A + Cc : A - Cc; dd = L; e = `通分して ${A}/${L} ${op} ${Cc}/${L} = ${n}/${L} = ${frac(n, dd)}`;
    } else if (op === "×") { n = a * c; dd = b * d; e = `分子どうし・分母どうしを掛けて ${n}/${dd} = ${frac(n, dd)}`; }
    else { n = a * d; dd = b * c; e = `割る数の逆数 ${d}/${c} を掛けて ${n}/${dd} = ${frac(n, dd)}`; }
    return { q: `${a}/${b} ${op} ${c}/${d} =`, type: "num", exact: true, a: fracA(n, dd), show: frac(n, dd), e };
  } });
  unit({ id: "shousuu_keisan", lv: 1, name: "小数の計算", desc: "小数の四則", fmt: "小数で答えます。", kp: [], gen() {
    const t = R(0, 2); let q, v;
    if (t === 0) { const a = R(11, 999) / 10, b = R(11, 999) / 100; q = `${a} + ${b}`; v = (Math.round(a * 100) + Math.round(b * 100)) / 100; }
    else if (t === 1) { const a = R(11, 99), b = R(2, 99); q = `${a / 10} × ${b / 10}`; v = a * b / 100; }
    else { const b = R(2, 9), qq = R(2, 40); q = `${b * qq / 100} ÷ ${b / 10}`; v = qq / 10; }
    return { q: q + " =", type: "num", a: String(v), show: fmtNum(v), e: `小数点の位置に気をつけます。${q} = ${fmtNum(v)}` };
  } });
  unit({ id: "gcdlcm", lv: 1, name: "最大公約数・最小公倍数", desc: "素因数分解や連除法で", fmt: "数で答えます。", kp: [], gen() {
    const g = R(2, 12); let x, y; do { x = R(2, 9); y = R(2, 9); } while (x === y || gcd(x, y) !== 1);
    const A = g * x, B = g * y, isG = Math.random() < 0.5;
    return { q: `${A} と ${B} の${isG ? "最大公約数" : "最小公倍数"}は？`, type: "num", a: String(isG ? g : g * x * y), show: String(isG ? g : g * x * y), e: `${A} = ${g} × ${x}、${B} = ${g} × ${y}。最大公約数 ${g}、最小公倍数 ${g} × ${x} × ${y} = ${g * x * y}。` };
  } });
  unit({ id: "wariai_mon", lv: 1, name: "割合・百分率", desc: "もとにする量・比べる量", fmt: "数で答えます（単位は付けても付けなくても可）。", kp: [], gen() {
    const t = R(0, 2);
    if (t === 0) { const P = R(8, 60) * 100, r = pick([10, 20, 25, 30, 40]), v = P * (100 - r) / 100; return { q: `定価 ${P} 円の品物を ${r}% 引きで買うと何円？`, type: "num", a: String(v), show: v + " 円", e: `${P} × (1 − ${r / 100}) = ${v}` }; }
    if (t === 1) { const B = R(2, 20) * 100, r = pick([5, 15, 20, 35, 60, 75, 120]), A = B * r / 100; return { q: `${A} は ${B} の何 % ですか。`, type: "num", a: String(r), show: r + " %", e: `${A} ÷ ${B} = ${r / 100} → ${r}%` }; }
    const x = R(2, 30) * 10, p = pick([2, 3, 4, 6, 7]), V = x * p / 10; return { q: `ある数の ${p} 割が ${V} のとき、ある数は？`, type: "num", a: String(x), show: String(x), e: `ある数 × ${p / 10} = ${V} より ${V} ÷ ${p / 10} = ${x}` };
  } });
  unit({ id: "hayasa_mon", lv: 1, name: "速さ・時間・道のり", desc: "は・じ・き", fmt: "数で答えます（単位は付けても可）。", kp: [], gen() {
    const t = R(0, 2);
    if (t === 0) { const v = R(3, 20) * 4, h = pick([1.5, 2, 2.5, 3, 0.75]); return { q: `時速 ${v} km で ${h} 時間進むと何 km？`, type: "num", a: String(v * h), show: v * h + " km", e: `道のり = 速さ × 時間 = ${v} × ${h} = ${v * h}` }; }
    if (t === 1) { const sp = R(6, 20) * 10, mm = R(5, 25); return { q: `${sp * mm} m を ${mm} 分で歩いた。分速何 m？`, type: "num", a: String(sp), show: "分速 " + sp + " m", e: `速さ = 道のり ÷ 時間 = ${sp * mm} ÷ ${mm} = ${sp}` }; }
    const v = R(4, 12) * 5, h = R(2, 6); return { q: `${v * h} km を時速 ${v} km で進むと何時間かかる？`, type: "num", a: String(h), show: h + " 時間", e: `時間 = 道のり ÷ 速さ = ${v * h} ÷ ${v} = ${h}` };
  } });

  // ── Lv2 中学 ──
  unit({ id: "seifu_keisan", lv: 2, name: "正負の数の計算", desc: "符号・累乗・計算順序", fmt: "数で答えます（負の数は −5 のように）。", kp: ["−", "(", ")", "^"], gen() {
    const t = R(0, 3); let q, v;
    if (t === 0) { const a = nz(-9, 9), b = nz(-9, 9), d = nz(-6, 6), c = d * nz(-6, 6); q = `${par(a)} × ${par(b)} − ${par(c)} ÷ ${par(d)}`; v = a * b - c / d; }
    else if (t === 1) { const a = R(2, 5), b = R(2, 5); q = `−${a}² + (−${b})²`; v = -a * a + b * b; }
    else if (t === 2) { const a = nz(-9, 9), b = nz(-9, 9), c = nz(-9, 9); q = `${m(a)} − ${par(b)} × ${par(c)}`; v = a - b * c; }
    else { const a = R(2, 3), b = nz(-6, 6); q = `(−${a})³ × ${par(b)}`; v = -(a ** 3) * b; }
    return { q: q + " =", type: "num", a: String(v), show: m(v), e: `累乗 → かけ算・わり算 → たし算・ひき算の順。符号に注意して ${m(v)}。（−a² は −(a²)、(−a)² は a²）` };
  } });
  unit({ id: "ichiji_ho", lv: 2, name: "一次方程式", desc: "移項して解く", fmt: "「x = 4」または「4」。", kp: ["−", "/"], gen() {
    const s = R(-9, 9); let a, c; do { a = nz(-7, 7); c = nz(-7, 7); } while (a === c);
    const b = R(-15, 15), d = a * s + b - c * s;
    const L = poly([a, b]), Rr = poly([c, d]);
    return { q: `${L} = ${Rr}`, type: "num", a: String(s), show: `x = ${m(s)}`, e: `x の項を左辺、数を右辺に移項：${poly([a - c, 0])} = ${m(d - b)}、x = ${m(s)}` };
  } });
  unit({ id: "ichiji_futou", lv: 2, name: "一次不等式", desc: "負の数で割ると向きが変わる", fmt: "「x > 3」「x ≦ −2」の形。", kp: KP.ineq, gen() {
    const a = nz(-6, 6), s = R(-8, 8), b = R(-10, 10), op = pick(["<", ">", "≦", "≧"]), c = a * s + b;
    const flip = { "<": ">", ">": "<", "≦": "≧", "≧": "≦" }, res = a > 0 ? op : flip[op];
    const asc = { "<": "<", ">": ">", "≦": "<=", "≧": ">=" };
    return { q: `${poly([a, b])} ${op} ${m(c)}`, type: "ineq", v: "x", a: `x${asc[res]}${s}`, show: `x ${res} ${m(s)}`, e: `${poly([a, 0])} ${op} ${m(c - b)}。両辺を ${m(a)} で割る${a < 0 ? "（負の数なので不等号の向きが変わる）" : ""}と x ${res} ${m(s)}。` };
  } });
  unit({ id: "renritsu_ho", lv: 2, name: "連立方程式", desc: "加減法・代入法", fmt: "「x = 3, y = −2」または「(3, −2)」。", kp: KP.pair, gen() {
    const x = R(-6, 6), y = R(-6, 6); let a1, b1, a2, b2;
    do { a1 = nz(-5, 5); b1 = nz(-5, 5); a2 = nz(-5, 5); b2 = nz(-5, 5); } while (a1 * b2 - a2 * b1 === 0);
    const eq = (a, b) => `${poly([a, 0])} ${b < 0 ? "−" : "+"} ${Math.abs(b) === 1 ? "" : Math.abs(b)}y = ${m(a * x + b * y)}`;
    return { q: `${eq(a1, b1)}\n${eq(a2, b2)}`, type: "pair", a: [String(x), String(y)], show: `x = ${m(x)}, y = ${m(y)}`, e: `どちらかの文字の係数をそろえて消去します。答え (x, y) = (${m(x)}, ${m(y)})。代入して両方の式が成り立つか確かめましょう。` };
  } });
  unit({ id: "tenkai_mon", lv: 2, name: "式の展開", desc: "乗法公式", fmt: "展開した形（例：x^2 − 5x + 6）。順序は自由。", kp: KP.poly, gen() {
    const t = R(0, 3); let q, cs;
    if (t === 0) { const a = nz(-9, 9), b = nz(-9, 9); q = `(x ${a < 0 ? "−" : "+"} ${Math.abs(a)})(x ${b < 0 ? "−" : "+"} ${Math.abs(b)})`; cs = [1, a + b, a * b]; }
    else if (t === 1) { const a = nz(-9, 9); q = `(x ${a < 0 ? "−" : "+"} ${Math.abs(a)})²`; cs = [1, 2 * a, a * a]; }
    else if (t === 2) { const a = R(1, 9); q = `(x + ${a})(x − ${a})`; cs = [1, 0, -a * a]; }
    else { const p = R(2, 4), a = nz(-6, 6), r = R(1, 3), b = nz(-6, 6); q = `(${p}x ${a < 0 ? "−" : "+"} ${Math.abs(a)})(${r === 1 ? "" : r}x ${b < 0 ? "−" : "+"} ${Math.abs(b)})`; cs = [p * r, p * b + a * r, a * b]; }
    return { q: q + " を展開せよ。", type: "expand", a: polyA(cs), show: poly(cs), e: `分配法則（乗法公式）で展開すると ${poly(cs)}。` };
  } });
  unit({ id: "inbun_mon", lv: 2, name: "因数分解", desc: "共通因数・公式", fmt: "積の形（例：(x − 2)(x − 3)）。", kp: KP.poly, gen() {
    const t = R(0, 3); let cs, ans, ansA;
    if (t === 0) { let p, q; do { p = nz(-9, 9); q = nz(-9, 9); } while (p === q); cs = [1, -(p + q), p * q]; ans = linFactor(p) + linFactor(q); ansA = `(x-(${p}))(x-(${q}))`; }
    else if (t === 1) { const a = R(1, 9); cs = [1, 0, -a * a]; ans = `(x + ${a})(x − ${a})`; ansA = `(x+${a})(x-${a})`; }
    else if (t === 2) { const a = nz(-9, 9); cs = [1, -2 * a, a * a]; ans = linFactor(a) + "²"; ansA = `(x-(${a}))^2`; }
    else { const k = R(2, 5); let p, q; do { p = nz(-5, 5); q = nz(-5, 5); } while (p === q); cs = [k, -k * (p + q), k * p * q]; ans = k + linFactor(p) + linFactor(q); ansA = `${k}(x-(${p}))(x-(${q}))`; }
    return { q: poly(cs) + " を因数分解せよ。", type: "factor", a: ansA, show: ans, e: `${t === 3 ? "まず共通因数をくくり出し、" : ""}和と積の関係（または公式 a² − b² = (a + b)(a − b)、a² ± 2ab + b² = (a ± b)²）を使って ${ans}。` };
  } });
  function simplifySqrt(N) { let c = 1, f = N; for (let k = 2; k * k <= f; k++) while (f % (k * k) === 0) { f /= k * k; c *= k; } return [c, f]; }
  const rootStr = (c, f) => f === 1 ? String(c) : (c === 1 ? "" : c) + "√" + f;
  unit({ id: "heihokon_keisan", lv: 2, name: "平方根の計算", desc: "a√b の形・有理化", fmt: "√ を使って（例：6√2、√3/3）。小数の近似は不可。", kp: KP.root, gen() {
    const t = R(0, 3), sq = [2, 3, 5, 6, 7];
    if (t === 0) { const a = R(2, 7), b = pick(sq), N = a * a * b; return { q: `√${N} を a√b の形にせよ。`, type: "num", exact: true, simplest: true, a: `${a}*sqrt(${b})`, show: rootStr(a, b), e: `${N} = ${a}² × ${b} より √${N} = ${rootStr(a, b)}` }; }
    if (t === 1) { const x = pick([2, 3, 6, 8, 12, 18, 10, 15]), y = pick([2, 3, 6, 8, 12, 18, 5, 20]), [c, f] = simplifySqrt(x * y); return { q: `√${x} × √${y} =`, type: "num", exact: true, simplest: true, a: `${c}*sqrt(${f})`, show: rootStr(c, f), e: `√${x * y} = ${rootStr(c, f)}` }; }
    if (t === 2) { const b = pick([2, 3, 5]); let p, q; do { p = R(2, 6); q = R(1, 5); } while (p === q); const op = pick(["+", "−"]), r = op === "+" ? p + q : p - q; return { q: `√${p * p * b} ${op} √${q * q * b} =`, type: "num", exact: true, simplest: true, a: `${r}*sqrt(${b})`, show: rootStr(r, b).replace(/^-/, "−"), e: `${rootStr(p, b)} ${op} ${rootStr(q, b)} = ${rootStr(r, b)}` }; }
    const b = pick([2, 3, 5, 6, 7]), k = pick([1, 2, 3, 4, 6, b, 2 * b]), g = gcd(k, b), num = k / g, den = b / g;
    const show = den === 1 ? rootStr(num, b) : `${num === 1 ? "" : num}√${b}/${den}`;
    return { q: `${k}/√${b} の分母を有理化せよ。`, type: "num", exact: true, simplest: true, a: `${k}*sqrt(${b})/${b}`, show, e: `分母と分子に √${b} を掛けて ${k}√${b}/${b} = ${show}` };
  } });
  unit({ id: "niji_ho", lv: 2, name: "二次方程式", desc: "因数分解・解の公式", fmt: "解をすべてカンマ区切りで（例：2, −3）。", kp: ["−", ",", "√", "±", "/"], gen() {
    const t = R(0, 2);
    if (t === 2) { const a = R(2, 5), b = pick([2, 3, 5, 6, 7]); return { q: `x² + ${2 * a}x + ${a * a - b} = 0`, type: "set", a: [`${-a}+sqrt(${b})`, `${-a}-sqrt(${b})`], show: `x = −${a} ± √${b}`, e: `解の公式（b = 2b′）で x = −${a} ± √(${a * a} − (${a * a - b})) = −${a} ± √${b}` }; }
    let p, q; do { p = R(-9, 9); q = R(-9, 9); } while (t === 0 && p === q);
    if (t === 1) { if (!p) p = 1; q = p; }
    const cs = [1, -(p + q), p * q], roots = [...new Set([p, q])];
    return { q: `${poly(cs)} = 0`, type: "set", a: roots.map(String), show: "x = " + roots.map(m).join(", "), e: `${linFactor(p)}${linFactor(q)} = 0 と因数分解できるので x = ${roots.map(m).join(", ")}${p === q ? "（重解）" : ""}` };
  } });
  unit({ id: "ichiji_kansu", lv: 2, name: "一次関数の式", desc: "2 点を通る直線", fmt: "「y = 2x − 3」の形。", kp: ["y =", "x", "−", "/"], gen() {
    const a = nz(-5, 5), b = R(-9, 9), x1 = R(-5, 5); let x2; do x2 = R(-5, 5); while (x2 === x1);
    return { q: `2 点 (${m(x1)}, ${m(a * x1 + b)}), (${m(x2)}, ${m(a * x2 + b)}) を通る直線の式は？`, type: "expr", a: `${a}*x+(${b})`, show: "y = " + poly([a, b]), e: `傾き = (${m(a * x2 + b)} − ${par(a * x1 + b)}) ÷ (${m(x2)} − ${par(x1)}) = ${m(a)}。y = ${m(a)}x + b に (${m(x1)}, ${m(a * x1 + b)}) を代入して b = ${m(b)}。` };
  } });

  // ── Lv3 高校 ──
  unit({ id: "shugo_mon", lv: 3, name: "集合", desc: "共通部分・和集合・補集合・ド・モルガン", fmt: "要素をカンマ区切りで（例：{2, 4, 6}）。空集合は ∅。", kp: KP.set, gen() {
    const Uu = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const defs = [
      () => { const k = pick([2, 3, 4]); return [`{x ∈ U | x は ${k} の倍数}`, Uu.filter(x => x % k === 0)]; },
      () => [`{x ∈ U | x は奇数}`, Uu.filter(x => x % 2)],
      () => [`{x ∈ U | x は素数}`, [2, 3, 5, 7]],
      () => { const n = pick([12, 18, 20, 24, 30]); return [`{x ∈ U | x は ${n} の約数}`, Uu.filter(x => n % x === 0)]; },
      () => { const a = Uu.filter(() => Math.random() < 0.45); return a.length ? [setStr(a), a] : [setStr([1, 5]), [1, 5]]; }
    ];
    const [An, A] = pick(defs)(), [Bn, B] = pick(defs)();
    if (An === Bn) return this.gen();
    const cA = Uu.filter(x => !A.includes(x)), cB = Uu.filter(x => !B.includes(x));
    const ops = [["A ∩ B", A.filter(x => B.includes(x))], ["A ∪ B", Uu.filter(x => A.includes(x) || B.includes(x))], ["Ā（A の補集合）", cA], ["A ∩ B̄", A.filter(x => !B.includes(x))], ["Ā ∩ B̄", cA.filter(x => cB.includes(x))], ["Ā ∪ B̄", Uu.filter(x => cA.includes(x) || cB.includes(x))]];
    const [on, ov] = pick(ops);
    return { q: `全体集合 U = {1, 2, …, 10}\nA = ${An}\nB = ${Bn}\nのとき、${on} を求めよ。`, type: "set", a: ov.map(String), show: setStr(ov), e: `A = ${setStr(A)}、B = ${setStr(B)}。${on.includes("Ā ∩ B̄") ? "ド・モルガンの法則より Ā ∩ B̄ = (A ∪ B) の補集合。" : on.includes("Ā ∪ B̄") ? "ド・モルガンの法則より Ā ∪ B̄ = (A ∩ B) の補集合。" : ""}答え ${setStr(ov)}` };
  } });
  unit({ id: "niji_futou", lv: 3, name: "二次不等式", desc: "グラフと x 軸の位置関係", fmt: "「2 < x < 3」「x < 1, 4 < x」「x ≠ 2」「すべての実数」「解なし」など。", kp: KP.ineq, gen() {
    const t = R(0, 5);
    if (t === 4) { const p = R(-4, 4), op = pick([">", "≦"]); const cs = [1, -2 * p, p * p];
      return op === ">" ? { q: `${poly(cs)} > 0`, type: "ineq", v: "x", a: `x!=${p}`, show: `x ≠ ${m(p)}（${m(p)} 以外のすべての実数）`, e: `${linFactor(p)}² > 0 は x = ${m(p)} 以外で成り立つ。` }
        : { q: `${poly(cs)} ≦ 0`, type: "ineq", v: "x", a: `x=${p}`, show: `x = ${m(p)}`, e: `${linFactor(p)}² ≦ 0 となるのは x = ${m(p)} のときだけ。` }; }
    if (t === 5) { const p = R(-3, 3), k = R(1, 6), cs = [1, -2 * p, p * p + k], op = pick(["<", ">"]);
      return { q: `${poly(cs)} ${op} 0`, type: "ineq", v: "x", a: op === ">" ? "x=x" : "x!=x", show: op === ">" ? "すべての実数" : "解なし", e: `平方完成すると ${linFactor(p)}² + ${k} で、つねに正（判別式 D < 0）。` }; }
    let p, q; do { p = R(-6, 6); q = R(-6, 6); } while (p >= q);
    const op = pick(["<", ">", "≦", "≧"]), cs = [1, -(p + q), p * q], A = { "<": "<", ">": ">", "≦": "<=", "≧": ">=" }[op];
    const inside = op === "<" || op === "≦";
    const a = inside ? `${p}${A === "<" ? "<" : "<="}x${A === "<" ? "<" : "<="}${q}` : `x${A === ">" ? "<" : "<="}${p},${q}${A === ">" ? "<" : "<="}x`;
    const s = op === "<" ? "<" : "≦";
    const show = inside ? `${m(p)} ${s} x ${s} ${m(q)}` : `x ${op === ">" ? "<" : "≦"} ${m(p)}, ${m(q)} ${op === ">" ? "<" : "≦"} x`;
    return { q: `${poly(cs)} ${op} 0`, type: "ineq", v: "x", a, show, e: `${linFactor(p)}${linFactor(q)} ${op} 0。放物線が x 軸と x = ${m(p)}, ${m(q)} で交わるので、${inside ? "2 解の間" : "2 解の外側"}が答え：${show}` };
  } });
  unit({ id: "hanbetsu_mon", lv: 3, name: "判別式", desc: "実数解の個数・条件", fmt: "数、または「k ≦ 4」のような不等式。", kp: KP.ineq, gen() {
    const t = R(0, 2);
    if (t === 0) { const a = nz(-4, 4), b = R(-8, 8), c = R(-8, 8), D = b * b - 4 * a * c; return { q: `${poly([a, b, c])} = 0 の判別式 D の値は？`, type: "num", a: String(D), show: `D = ${m(D)}`, e: `D = b² − 4ac = ${par(b)}² − 4·${par(a)}·${par(c)} = ${m(D)}` }; }
    if (t === 1) { const a = nz(-3, 3), b = R(-8, 8), c = R(-6, 6), D = b * b - 4 * a * c, n = D > 0 ? 2 : D === 0 ? 1 : 0; return { q: `${poly([a, b, c])} = 0 の異なる実数解の個数は？`, type: "num", a: String(n), show: `${n} 個`, e: `D = ${m(D)} ${D > 0 ? "> 0 なので 2 個" : D === 0 ? "= 0 なので重解 1 個" : "< 0 なので実数解なし（0 個）"}` }; }
    const mm = nz(-5, 5), kind = pick(["実数解をもつ", "異なる 2 つの実数解をもつ", "実数解をもたない"]), op = kind === "実数解をもつ" ? "<=" : kind === "実数解をもたない" ? ">" : "<";
    const so = { "<=": "≦", "<": "<", ">": ">" }[op];
    return { q: `x² ${mm < 0 ? "−" : "+"} ${Math.abs(2 * mm)}x + k = 0 が${kind}ような定数 k の値の範囲は？`, type: "ineq", v: "k", a: `k${op}${mm * mm}`, show: `k ${so} ${mm * mm}`, e: `D/4 = ${mm * mm} − k。${kind === "実数解をもつ" ? "D ≧ 0" : kind === "実数解をもたない" ? "D < 0" : "D > 0"} より k ${so} ${mm * mm}。` };
  } });
  unit({ id: "kyokon_mon", lv: 3, name: "虚数解（虚根）", desc: "判別式が負の二次方程式", fmt: "2 つの解をカンマ区切り、または ±（例：1 ± 2i）。", kp: KP.cpx, gen() {
    if (Math.random() < 0.25) { const k = R(1, 9); return { q: `x² + ${k * k} = 0`, type: "set", a: [`${k}*i`, `-${k}*i`], show: `x = ±${k === 1 ? "" : k}i`, e: `x² = −${k * k} より x = ±√(−${k * k}) = ±${k === 1 ? "" : k}i` }; }
    const p = R(-5, 5), q = R(1, 5), cs = [1, -2 * p, p * p + q * q];
    return { q: `${poly(cs)} = 0`, type: "set", a: [cpxA(p, q), cpxA(p, -q)], show: `x = ${p ? m(p) + " ± " : "±"}${q === 1 ? "" : q}i`, e: `D/4 = ${p * p} − ${p * p + q * q} = −${q * q} < 0 なので虚数解。x = ${m(p)} ± √(−${q * q}) = ${p ? m(p) + " ± " : "±"}${q === 1 ? "" : q}i（互いに共役）` };
  } });
  unit({ id: "fukuso_keisan", lv: 3, name: "複素数の計算", desc: "i² = −1", fmt: "a + bi の形（例：3 − 2i）。", kp: KP.cpx, gen() {
    const t = R(0, 3);
    if (t === 0) { const a = R(-5, 5), b = nz(-5, 5), c = R(-5, 5), d = nz(-5, 5), re = a * c - b * d, im = a * d + b * c; return { q: `(${cpx(a, b)})(${cpx(c, d)}) =`, type: "num", a: cpxA(re, im), show: cpx(re, im), e: `展開して i² = −1 を使う：${m(a * c)} + ${par(a * d + b * c)}i + ${par(b * d)}i² = ${cpx(re, im)}` }; }
    if (t === 1) { const n = R(2, 30), r = [[1, 0], [0, 1], [-1, 0], [0, -1]][n % 4]; return { q: `i${sup(n)} =`, type: "num", a: cpxA(r[0], r[1]), show: cpx(r[0], r[1]), e: `i⁴ = 1 なので i${sup(n)} = i${sup(n % 4)} = ${cpx(r[0], r[1])}` }; }
    if (t === 2) { const a = R(-5, 5), b = nz(-5, 5); return { q: `(${cpx(a, b)})² =`, type: "num", a: cpxA(a * a - b * b, 2 * a * b), show: cpx(a * a - b * b, 2 * a * b), e: `${a * a} + ${m(2 * a * b)}i + ${b * b}i² = ${cpx(a * a - b * b, 2 * a * b)}` }; }
    const e1 = R(-4, 4), f1 = nz(-4, 4), c = R(-3, 3), d = nz(-3, 3), na = e1 * c - f1 * d, nb = e1 * d + f1 * c;
    return { q: `(${cpx(na, nb)}) ÷ (${cpx(c, d)}) =`, type: "num", a: cpxA(e1, f1), show: cpx(e1, f1), e: `分母の共役複素数 ${cpx(c, -d)} を分母・分子に掛けて実数化する。答え ${cpx(e1, f1)}` };
  } });
  unit({ id: "joyo_mon", lv: 3, name: "剰余の定理・因数定理", desc: "P(a) を計算する", fmt: "数で答えます。", kp: ["−"], gen() {
    const cs = [R(1, 3), R(-5, 5), R(-5, 5), R(-6, 6)], a = nz(-3, 3), v = cs.reduce((s, c) => s * a + c, 0);
    return { q: `P(x) = ${poly(cs)} を ${linFactor(a)} で割った余りは？`, type: "num", a: String(v), show: m(v), e: `剰余の定理より余りは P(${m(a)}) = ${m(v)}${v === 0 ? "。余り 0 なので " + linFactor(a) + " は P(x) の因数（因数定理）。" : "。"}` };
  } });
  unit({ id: "warizan_poly", lv: 3, name: "多項式の割り算", desc: "商と余り", fmt: "商は多項式（例：x^2 + 2x − 1）、余りは数。", kp: KP.poly, gen() {
    const a = nz(-3, 3), Q = [R(1, 2), R(-4, 4), R(-5, 5)], r = R(-6, 6);
    const P = [Q[0], Q[1] - a * Q[0], Q[2] - a * Q[1], -a * Q[2] + r];
    const askQ = Math.random() < 0.6;
    return askQ ? { q: `${poly(P)} を ${linFactor(a)} で割ったときの商は？`, type: "expand", a: polyA(Q), show: poly(Q), e: `筆算（または組立除法）で商 ${poly(Q)}、余り ${m(r)}。確かめ：${linFactor(a)}(${poly(Q)}) + ${par(r)} = ${poly(P)}` }
      : { q: `${poly(P)} を ${linFactor(a)} で割ったときの余りは？`, type: "num", a: String(r), show: m(r), e: `剰余の定理より P(${m(a)}) = ${m(r)}。商は ${poly(Q)}。` };
  } });
  unit({ id: "kaitokei_mon", lv: 3, name: "解と係数の関係", desc: "α + β と αβ から計算", fmt: "数で答えます（分数可）。", kp: ["/", "−"], gen() {
    const b = R(-7, 7), c = nz(-6, 6), s = -b, p = c, t = R(0, 3);
    const asks = [["α + β", fracA(s, 1), "−b/a"], ["αβ", fracA(p, 1), "c/a"], ["α² + β²", fracA(s * s - 2 * p, 1), "(α + β)² − 2αβ"], ["1/α + 1/β", fracA(s, p), "(α + β)/αβ"]][t];
    return { q: `x² ${b < 0 ? "−" : "+"} ${Math.abs(b)}x ${c < 0 ? "−" : "+"} ${Math.abs(c)} = 0 の 2 解を α, β とするとき、${asks[0]} の値は？`, type: "num", a: asks[1], show: asks[1].replace("-", "−"), e: `α + β = ${m(s)}、αβ = ${m(p)}。${asks[0]} = ${asks[2]} = ${asks[1].replace("-", "−")}` };
  } });
  const binom = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return Math.round(r); };
  unit({ id: "nikou_mon", lv: 3, name: "二項定理", desc: "展開式の係数", fmt: "数で答えます。", kp: ["−"], gen() {
    const n = R(3, 7), k = R(1, n - 1), a = pick([1, 2, 3]), b = nz(-3, 3), v = binom(n, k) * a ** k * b ** (n - k);
    return { q: `(${a === 1 ? "" : a}x ${b < 0 ? "−" : "+"} ${Math.abs(b)})${sup(n)} の展開式における x${k > 1 ? sup(k) : ""} の係数は？`, type: "num", a: String(v), show: m(v), e: `一般項 ${n}C${k}·(${a}x)${sup(k)}·(${m(b)})${sup(n - k)} より ${binom(n, k)} × ${a ** k} × ${par(b ** (n - k))} = ${m(v)}` };
  } });
  unit({ id: "taisu_mon", lv: 3, name: "指数・対数の計算", desc: "対数の性質", fmt: "数で答えます（分数可）。", kp: ["/", "−"], gen() {
    const t = R(0, 3);
    if (t === 0) { const a = pick([2, 3, 5]), k = R(-3, 5); const N = k >= 0 ? String(a ** k) : "1/" + a ** -k; return { q: `log${subs(a)} ${N} =`, type: "num", a: String(k), show: m(k), e: `${N} = ${a}${sup(k)} なので ${m(k)}` }; }
    if (t === 1) { const x = pick([2, 4, 8, 16]), y = pick([2, 4, 8, 16, 32]), v = Math.log2(x * y); return { q: `log₂ ${x} + log₂ ${y} =`, type: "num", a: String(v), show: String(v), e: `log₂ (${x} × ${y}) = log₂ ${x * y} = ${v}` }; }
    if (t === 2) { const k = R(1, 4), y = pick([2, 4, 5, 7]); return { q: `log₃ ${3 ** k * y} − log₃ ${y} =`, type: "num", a: String(k), show: String(k), e: `log₃ (${3 ** k * y} ÷ ${y}) = log₃ ${3 ** k} = ${k}` }; }
    const [b, x, v] = pick([[4, 8, "3/2"], [8, 4, "2/3"], [9, 27, "3/2"], [27, 9, "2/3"], [4, 32, "5/2"], [25, 125, "3/2"]]);
    return { q: `log${subs(b)} ${x} =`, type: "num", a: v, show: v, e: `底の変換：log ${x} ÷ log ${b}（同じ素数の底でそろえる）= ${v}` };
  } });
  unit({ id: "bibun_mon", lv: 3, name: "微分の計算", desc: "多項式の導関数", fmt: "f′(x) の式（例：6x^2 − 2x + 1）、または数。", kp: KP.poly, gen() {
    const cs = [R(-3, 3) || 1, R(-5, 5), R(-6, 6), R(-9, 9)], d = [3 * cs[0], 2 * cs[1], cs[2]];
    if (Math.random() < 0.65) return { q: `f(x) = ${poly(cs)} のとき f′(x) は？`, type: "expr", a: polyA(d), show: "f′(x) = " + poly(d), e: `(xⁿ)′ = nxⁿ⁻¹ を各項に使う：${poly(d)}` };
    const a = R(-3, 3), v = d[0] * a * a + d[1] * a + d[2];
    return { q: `f(x) = ${poly(cs)} のとき f′(${m(a)}) の値は？`, type: "num", a: String(v), show: m(v), e: `f′(x) = ${poly(d)} に x = ${m(a)} を代入して ${m(v)}` };
  } });
  unit({ id: "sekibun_mon", lv: 3, name: "定積分", desc: "多項式の定積分", fmt: "数で答えます（分数可）。", kp: ["/", "−"], gen() {
    const cs = [R(-3, 3), R(-4, 4), R(-5, 5)], a = R(-2, 1), b = a + R(1, 3);
    const F = x => cs[0] * x ** 3 / 3 + cs[1] * x ** 2 / 2 + cs[2] * x; const v = F(b) - F(a);
    const n = Math.round(v * 6); return { q: `∫${subs(a)}${sup(b)} (${poly(cs)}) dx =`, type: "num", a: fracA(n, 6), show: frac(n, 6), e: `原始関数 F(x) = ${cs[0] ? frac(cs[0], 3) + "x³" : ""}${cs[1] ? " + " + frac(cs[1], 2) + "x²" : ""}${cs[2] ? " + " + m(cs[2]) + "x" : ""} について F(${m(b)}) − F(${m(a)}) = ${frac(n, 6)}` };
  } });
  unit({ id: "suretsu_mon", lv: 3, name: "数列と Σ", desc: "等差・等比・Σ の計算", fmt: "数で答えます。", kp: ["−"], gen() {
    const t = R(0, 2);
    if (t === 0) { const a = R(-10, 10), d = nz(-5, 5), n = R(10, 30), v = a + (n - 1) * d; return { q: `初項 ${m(a)}、公差 ${m(d)} の等差数列の第 ${n} 項は？`, type: "num", a: String(v), show: m(v), e: `aₙ = a + (n − 1)d = ${m(a)} + ${n - 1} × ${par(d)} = ${m(v)}` }; }
    if (t === 1) { const a = R(1, 5), r = pick([2, 3, -2]), n = R(4, 7), v = a * (r ** n - 1) / (r - 1); return { q: `初項 ${a}、公比 ${m(r)} の等比数列の初項から第 ${n} 項までの和は？`, type: "num", a: String(v), show: m(v), e: `Sₙ = a(rⁿ − 1)/(r − 1) = ${a}(${par(r)}${sup(n)} − 1)/(${m(r)} − 1) = ${m(v)}` }; }
    const p = nz(-4, 4), q = R(-5, 5), n = R(5, 20), v = p * n * (n + 1) / 2 + q * n;
    return { q: `Σ (${poly([p, q], "k")})　（k = 1 から ${n} までの和）=`, type: "num", a: String(v), show: m(v), e: `${m(p)} × ${n}·${n + 1}/2 + ${par(q)} × ${n} = ${m(v)}` };
  } });

  // ── Lv4 大学基礎 ──
  unit({ id: "gyoretsushiki_mon", lv: 4, name: "行列式", desc: "2 次・3 次の行列式", fmt: "数で答えます。", kp: ["−"], gen() {
    const n = pick([2, 2, 3]), M = Array.from({ length: n }, () => Array.from({ length: n }, () => R(-4, 5)));
    const det = n === 2 ? M[0][0] * M[1][1] - M[0][1] * M[1][0]
      : M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
    const w = Math.max(...M.flat().map(x => m(x).length));
    const rows = M.map(r => "| " + r.map(x => m(x).padStart(w)).join("  ") + " |").join("\n");
    return { q: `次の行列式の値を求めよ。\n${rows}`, mono: true, type: "num", a: String(det), show: m(det), e: n === 2 ? `ad − bc = ${M[0][0]}·${par(M[1][1])} − ${par(M[0][1])}·${par(M[1][0])} = ${m(det)}` : `サラスの方法（または第 1 行での余因子展開）で ${m(det)}` };
  } });

  // 証明問題：穴埋めで要所を確かめ、模範解答と自己採点
  const PROOFS = {
    hairi: [
      { title: "√2 は無理数", stmt: "√2 が無理数であることを背理法で証明せよ。",
        hint: "√2 = p/q（p, q は互いに素な自然数）と仮定し、p と q がともに偶数になることを導く。",
        steps: [{ q: "√2 = p/q の両辺を 2 乗して分母を払うと p² = ？", a: "2q^2", show: "2q²" }, { q: "p が偶数なので p = 2m とおくと q² = ？", a: "2m^2", show: "2m²" }],
        proof: ["√2 が有理数であると仮定する。すると互いに素な自然数 p, q を用いて √2 = p/q と表せる。", "両辺を 2 乗して p² = 2q²。よって p² は偶数であり、p も偶数である（p が奇数なら p² も奇数）。", "p = 2m とおくと 4m² = 2q²、すなわち q² = 2m²。よって q も偶数である。", "p, q がともに偶数となり、互いに素であることに矛盾する。したがって √2 は無理数である。∎"] },
      { title: "√3 は無理数", stmt: "√3 が無理数であることを背理法で証明せよ。",
        hint: "p² = 3q² から p が 3 の倍数、さらに q も 3 の倍数になることを示す。3 は素数なので「3 | p² ⇒ 3 | p」が使える。",
        steps: [{ q: "√3 = p/q とおくと p² = ？", a: "3q^2", show: "3q²" }, { q: "p = 3m とおくと q² = ？", a: "3m^2", show: "3m²" }],
        proof: ["√3 = p/q（p, q は互いに素な自然数）と仮定する。", "p² = 3q² より 3 | p²。3 は素数なので 3 | p。", "p = 3m とおくと 9m² = 3q²、q² = 3m²。同様に 3 | q。", "p, q がともに 3 の倍数となり矛盾。よって √3 は無理数。∎"] },
      { title: "素数は無限に存在する", stmt: "素数が無限に存在することを背理法で証明せよ（ユークリッド）。",
        hint: "素数が p₁, …, pₙ の有限個だけだと仮定し、N = p₁p₂⋯pₙ + 1 を考える。",
        steps: [{ q: "N = p₁p₂⋯pₙ + 1 を各 pᵢ で割った余りは？", a: "1", show: "1" }],
        proof: ["素数が有限個 p₁, p₂, …, pₙ しかないと仮定する。", "N = p₁p₂⋯pₙ + 1 とおく。N > 1 なので N は少なくとも 1 つの素因数 p をもつ。", "仮定より p はある pᵢ に等しいが、N を pᵢ で割ると余り 1 なので pᵢ は N を割り切らない。矛盾。", "したがって素数は無限に存在する。∎"] },
      { title: "log₂3 は無理数", stmt: "log₂ 3 が無理数であることを証明せよ。",
        hint: "log₂ 3 = p/q（p, q は自然数）と仮定して指数の形に直し、偶奇を比べる。",
        steps: [{ q: "log₂ 3 = p/q より 2^(p/q) = 3。両辺を q 乗すると 3^q = 2^？", a: "p", show: "p" }],
        proof: ["log₂ 3 > 0 なので、log₂ 3 が有理数なら自然数 p, q で log₂ 3 = p/q と書ける。", "2^(p/q) = 3 より 2^p = 3^q。", "左辺は偶数（p ≥ 1）、右辺は奇数であり矛盾。よって log₂ 3 は無理数。∎"] },
      { title: "有理数 + 無理数 は無理数", stmt: "a が有理数、b が無理数のとき、a + b は無理数であることを証明せよ。",
        hint: "a + b = r（有理数）と仮定して b について解く。",
        steps: [{ q: "a + b = r と仮定すると b = ？（a, r で）", a: "r-a", show: "r − a" }],
        proof: ["a + b が有理数 r であると仮定する。", "b = r − a であり、有理数どうしの差は有理数なので b は有理数となる。", "これは b が無理数であることに矛盾する。よって a + b は無理数。∎"] },
      { title: "n² が偶数なら n は偶数", stmt: "整数 n について、n² が偶数ならば n は偶数であることを背理法で示せ。",
        hint: "n が奇数 n = 2m + 1 と仮定して n² を計算する。",
        steps: [{ q: "n = 2m + 1 とすると n² = ？（展開した形）", a: "4m^2+4m+1", show: "4m² + 4m + 1", type: "expand" }],
        proof: ["n² が偶数で n が奇数であると仮定する。n = 2m + 1（m は整数）と書ける。", "n² = 4m² + 4m + 1 = 2(2m² + 2m) + 1 は奇数となり、n² が偶数であることに矛盾する。", "よって n は偶数。∎（対偶「n が奇数なら n² は奇数」を示すのと同じ内容）"] },
      { title: "x³ + x + 1 = 0 は有理数解をもたない", stmt: "方程式 x³ + x + 1 = 0 が有理数の解をもたないことを証明せよ。",
        hint: "有理数解 p/q（既約）があると仮定し、p | 1、q | 1 を導く（有理根定理）。候補は ±1 だけ。",
        steps: [{ q: "P(x) = x³ + x + 1 について P(1) = ？", a: "3", show: "3" }, { q: "P(−1) = ？", a: "-1", show: "−1" }],
        proof: ["有理数解 x = p/q（p, q は互いに素、q > 0）があると仮定する。", "代入して分母を払うと p³ + pq² + q³ = 0。p³ = −q²(p + q) より q | p³、互いに素なので q = 1。同様に p | q³ より p = ±1。", "よって解の候補は ±1 だが、P(1) = 3、P(−1) = −1 でどちらも 0 でない。矛盾。∎"] },
      { title: "√2 + √3 は無理数", stmt: "√2 + √3 が無理数であることを証明せよ（√6 が無理数であることは用いてよい）。",
        hint: "√2 + √3 = r（有理数）と仮定し、両辺を 2 乗する。",
        steps: [{ q: "(√2 + √3)² = ？（a + b√6 の形）", a: "5+2*sqrt(6)", show: "5 + 2√6", type: "num", exact: true }],
        proof: ["√2 + √3 = r が有理数であると仮定する。", "両辺を 2 乗して 5 + 2√6 = r²、よって √6 = (r² − 5)/2 は有理数となる。", "これは √6 が無理数であることに矛盾する。よって √2 + √3 は無理数。∎"] }
    ],
    kinou: [
      { title: "1 + 2 + ⋯ + n = n(n + 1)/2", stmt: "すべての自然数 n について 1 + 2 + ⋯ + n = n(n + 1)/2 を数学的帰納法で証明せよ。",
        hint: "n = k で成り立つと仮定し、両辺に k + 1 を加える。",
        steps: [{ q: "n = 1 のとき右辺の値は？", a: "1", show: "1", type: "num" }, { q: "k(k + 1)/2 + (k + 1) を因数分解した形は？", a: "(k+1)(k+2)/2", show: "(k + 1)(k + 2)/2" }],
        proof: ["[1] n = 1 のとき 左辺 = 1、右辺 = 1·2/2 = 1 で成り立つ。", "[2] n = k で成り立つと仮定する：1 + ⋯ + k = k(k + 1)/2。", "両辺に k + 1 を加えると 1 + ⋯ + k + (k + 1) = k(k + 1)/2 + (k + 1) = (k + 1)(k + 2)/2。これは n = k + 1 の式である。", "[1][2] よりすべての自然数 n で成り立つ。∎"] },
      { title: "奇数の和は平方数", stmt: "1 + 3 + 5 + ⋯ + (2n − 1) = n² を証明せよ。",
        hint: "n = k + 1 では、k 番目までの和に 2k + 1 を加える。",
        steps: [{ q: "k² + (2k + 1) = ？（平方の形）", a: "(k+1)^2", show: "(k + 1)²" }],
        proof: ["[1] n = 1：1 = 1² で成り立つ。", "[2] n = k で 1 + 3 + ⋯ + (2k − 1) = k² と仮定する。", "両辺に 2(k + 1) − 1 = 2k + 1 を加えると k² + 2k + 1 = (k + 1)²。よって n = k + 1 でも成り立つ。∎"] },
      { title: "平方和の公式", stmt: "1² + 2² + ⋯ + n² = n(n + 1)(2n + 1)/6 を証明せよ。",
        hint: "k(k + 1)(2k + 1)/6 + (k + 1)² を (k + 1) でくくる。",
        steps: [{ q: "k(k + 1)(2k + 1)/6 + (k + 1)² を因数分解すると (k + 1)(k + 2)(？)/6。？に入る式は？", a: "2k+3", show: "2k + 3" }],
        proof: ["[1] n = 1：1 = 1·2·3/6 で成り立つ。", "[2] n = k で成り立つと仮定する。両辺に (k + 1)² を加えると", "k(k + 1)(2k + 1)/6 + (k + 1)² = (k + 1){k(2k + 1) + 6(k + 1)}/6 = (k + 1)(2k² + 7k + 6)/6 = (k + 1)(k + 2)(2k + 3)/6。", "これは n = k + 1 の右辺 (k + 1)((k + 1) + 1)(2(k + 1) + 1)/6 に等しい。∎"] },
      { title: "2ⁿ ≥ n + 1", stmt: "すべての自然数 n について 2ⁿ ≥ n + 1 を証明せよ。",
        hint: "2^(k+1) = 2·2^k ≥ 2(k + 1) を使い、2(k + 1) と k + 2 の差を調べる。",
        steps: [{ q: "2(k + 1) − (k + 2) = ？", a: "k", show: "k" }],
        proof: ["[1] n = 1：2 ≥ 2 で成り立つ。", "[2] 2^k ≥ k + 1 と仮定する。2^(k+1) = 2·2^k ≥ 2(k + 1) = (k + 2) + k ≥ k + 2。", "よって n = k + 1 でも成り立つ。∎"] },
      { title: "4ⁿ − 1 は 3 の倍数", stmt: "すべての自然数 n について 4ⁿ − 1 は 3 の倍数であることを証明せよ。",
        hint: "4^(k+1) − 1 を 4(4^k − 1) + □ の形に変形する。",
        steps: [{ q: "4^(k+1) − 1 = 4(4^k − 1) + ？", a: "3", show: "3", type: "num" }],
        proof: ["[1] n = 1：4 − 1 = 3 で成り立つ。", "[2] 4^k − 1 = 3m（m は整数）と仮定する。", "4^(k+1) − 1 = 4(4^k − 1) + 3 = 12m + 3 = 3(4m + 1) は 3 の倍数。∎"] },
      { title: "n³ − n は 6 の倍数", stmt: "すべての自然数 n について n³ − n は 6 の倍数であることを証明せよ。",
        hint: "{(k + 1)³ − (k + 1)} − (k³ − k) を計算すると 3k(k + 1) になる。k(k + 1) は偶数。",
        steps: [{ q: "{(k + 1)³ − (k + 1)} − (k³ − k) を展開すると？", a: "3k^2+3k", show: "3k² + 3k", type: "expand" }],
        proof: ["[1] n = 1：0 は 6 の倍数。", "[2] k³ − k = 6m と仮定する。(k + 1)³ − (k + 1) = (k³ − k) + 3k² + 3k = 6m + 3k(k + 1)。", "連続する 2 整数の積 k(k + 1) は偶数なので 3k(k + 1) は 6 の倍数。よって n = k + 1 でも成り立つ。∎"] },
      { title: "ベルヌーイの不等式", stmt: "h > −1 のとき、すべての自然数 n について (1 + h)ⁿ ≥ 1 + nh を証明せよ。",
        hint: "(1 + h)^(k+1) ≥ (1 + kh)(1 + h) を展開する（1 + h > 0 なので不等号の向きは保たれる）。",
        steps: [{ q: "(1 + kh)(1 + h) = 1 + (k + 1)h + ？", a: "k*h^2", show: "kh²" }],
        proof: ["[1] n = 1：1 + h ≥ 1 + h で成り立つ。", "[2] (1 + h)^k ≥ 1 + kh と仮定する。1 + h > 0 を両辺に掛けて (1 + h)^(k+1) ≥ (1 + kh)(1 + h) = 1 + (k + 1)h + kh² ≥ 1 + (k + 1)h。∎"] },
      { title: "部分分数の和", stmt: "1/(1·2) + 1/(2·3) + ⋯ + 1/(n(n + 1)) = n/(n + 1) を証明せよ。",
        hint: "k/(k + 1) + 1/((k + 1)(k + 2)) を通分する。",
        steps: [{ q: "k/(k + 1) + 1/((k + 1)(k + 2)) を簡単にすると？", a: "(k+1)/(k+2)", show: "(k + 1)/(k + 2)" }],
        proof: ["[1] n = 1：1/2 = 1/2 で成り立つ。", "[2] n = k で成り立つと仮定し、両辺に 1/((k + 1)(k + 2)) を加える。", "k/(k + 1) + 1/((k + 1)(k + 2)) = (k² + 2k + 1)/((k + 1)(k + 2)) = (k + 1)/(k + 2)。これは n = k + 1 の右辺。∎"] }
    ]
  };
  unit({ id: "hairiho_mon", lv: 4, name: "背理法", desc: "否定を仮定して矛盾を導く", fmt: "要所の穴埋めは式で答えます。証明は紙に書いてから模範解答と比べましょう。", kp: ["^", "√", "(", ")", "−", "/"], proof: "hairi" });
  unit({ id: "kinou_mon", lv: 4, name: "数学的帰納法", desc: "n = 1 と n = k ⇒ k + 1", fmt: "要所の穴埋めは式で答えます。証明は紙に書いてから模範解答と比べましょう。", kp: ["^", "(", ")", "−", "/"], proof: "kinou" });

  // 各単元が扱う用語（用語 ⇄ 問題集の相互リンク用）
  const UNIT_TERMS = {"tashizan": ["wa", "kahou"], "hikizan": ["sa", "genpou"], "kakezan": ["seki", "jouhou"], "warizan": ["sho", "amari", "johou"], "shisoku": ["kahou", "jouhou", "johou"], "bunsuu_keisan": ["bunsu", "tsuubun", "yakubun", "gyakusu", "shinbunsu", "kabunsu"], "shousuu_keisan": ["shosu"], "gcdlcm": ["gcd", "lcm", "yakusu", "baisu"], "wariai_mon": ["wariai", "hyakubunritsu", "buai"], "hayasa_mon": ["hayasa"], "seifu_keisan": ["seinosu", "funosu", "ruijo", "fugou"], "ichiji_ho": ["hoteishiki", "ichijihoteishiki", "ikou", "kai"], "ichiji_futou": ["futoushiki", "futougou"], "renritsu_ho": ["renritsu"], "tenkai_mon": ["tenkai", "jouhoukoushiki"], "inbun_mon": ["insubunkai"], "heihokon_keisan": ["heihokon", "yuurika", "murisu"], "niji_ho": ["nijihoteishiki", "kainokoushiki", "juukai"], "ichiji_kansu": ["ichijikansu", "katamuki", "seppen"], "shugo_mon": ["shugo", "kyoutsuububun", "washuugou", "hokanshuugou", "de_morgan", "bubunshugo"], "niji_futou": ["futoushiki", "jissuu"], "hanbetsu_mon": ["hanbetsushiki"], "kyokon_mon": ["kyosu", "kyouyaku"], "fukuso_keisan": ["fukusosu"], "joyo_mon": ["joyonoteiri", "insuuteiri"], "warizan_poly": ["takoushiki"], "kaitokei_mon": ["kaitokeisu"], "nikou_mon": ["nikou"], "taisu_mon": ["taisu", "shisu", "tei", "shinsuu"], "bibun_mon": ["bibun", "dokansu", "bibunkeisuu"], "sekibun_mon": ["sekibun", "teisekibun", "genshikansu"], "suretsu_mon": ["tosa", "tohi", "sigma", "kousa", "kouhi"], "gyoretsushiki_mon": ["gyoretsushiki"], "hairiho_mon": ["hairiho", "murisu", "sosu"], "kinou_mon": ["kinoho"]};
  U.forEach(u => { u.terms = UNIT_TERMS[u.id] || []; });
  // 実践問題のうち、読み・英訳・語源・人名などではない「解く問題」
  const isTextQ = q => q.en || /読み|英語|語源|原語|日本語訳|漢字|英訳|何という|名づけ|数学者は|誰|名前|フルネーム|別名|由来|何と訳|何を訳|雑誌|呼ぶ|略記/.test(q.q);
  function termItems(id) {
    const items = [];
    (window.TERM_PROBLEMS && window.TERM_PROBLEMS[id] || []).forEach(x => items.push({ fixed: Object.assign({ terms: [id] }, x) }));
    (window.PRACTICE || []).filter(q => q.term === id && !isTextQ(q)).forEach(q => items.push({ fixed: { q: q.q, type: q.set ? "tset" : "text", a: q.set || q.a, show: q.set ? q.set.map(s => s[0]).join("、") : q.a[0], e: q.e, terms: [id] } }));
    U.filter(u => u.terms.includes(id)).forEach(u => items.push({ unit: u }));
    return items;
  }
  const hasProblems = id => termItems(id).length > 0;

  window.WK_PROBLEMS = { U, PROOFS, check, parse, equivalent, normalize, termItems, hasProblems };

  // ═════════ 画面 ═════════
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const KEY = "wa-kan-mondai-v1";
  let st = {}; try { st = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { st = {}; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { } };
  const rec = (id, ok) => { const s = st[id] || (st[id] = { n: 0, ok: 0 }); s.n++; if (ok) s.ok++; save(); };
  const LVN = { 1: "算数（小学校）", 2: "中学", 3: "高校", 4: "大学" };
  let cur = null;
  const root = () => $("#mondai-root");

  function renderList() {
    cur = null;
    root().innerHTML = `<p class="prose mq-intro">問題は毎回ランダムに作られます（証明問題を除く）。答えは式として採点するので、同じ値・同じ式なら書き方が違っても正解です。</p>
      <div class="mq-search"><label for="mq-q">用語から問題を探す</label><input id="mq-q" type="search" placeholder="例：判別式、ring、きょすう" autocomplete="off"><div id="mq-hits" class="chips"></div></div>` +
      [1, 2, 3, 4].map(lv => `<h3 class="mq-lv">Lv${lv} ${LVN[lv]}</h3><div class="mq-units">${U.filter(u => u.lv === lv).map(u => {
        const s = st[u.id]; return `<button class="mq-unit" data-unit="${u.id}"><span class="mq-un">${esc(u.name)}</span><span class="mq-ud">${esc(u.desc)}</span><span class="mq-us">${s ? `解答 ${s.n}・正解 ${s.ok}` : "未挑戦"}</span></button>`;
      }).join("")}</div>`).join("");
    root().querySelectorAll("[data-unit]").forEach(b => b.onclick = () => openUnit(b.dataset.unit));
    $("#mq-q").oninput = e => {
      const q = e.target.value.trim().toLowerCase(), hits = $("#mq-hits");
      if (!q) { hits.innerHTML = ""; return; }
      const ts = (window.TERMS || []).filter(t => [t.t, t.r, t.en].some(s => s.toLowerCase().includes(q))).slice(0, 15);
      hits.innerHTML = ts.length ? ts.map(t => `<button type="button" class="chip" data-tp="${t.id}">${esc(t.t)} <span class="muted">Lv${t.lv}</span></button>`).join("") : `<span class="muted">見つかりません</span>`;
      hits.querySelectorAll("[data-tp]").forEach(b => b.onclick = () => openTermProblems(b.dataset.tp));
    };
  }
  const DEFKP = ["^", "√", "/", "(", ")", "−", ",", "i", "≦", "≧"];
  function openTermProblems(id) {
    const t = (window.TERMS || []).find(x => x.id === id); if (!t) return;
    const items = termItems(id); if (!items.length) return;
    let k = 0;
    const u = { id: "term:" + id, lv: t.lv, name: `「${t.t}」の問題`, fmt: "問題ごとの答え方に従って入力します。", kp: DEFKP, terms: [id], termMode: true,
      gen() {
        const it = items[k++ % items.length];
        if (it.fixed) return Object.assign({}, it.fixed, { done: false });
        if (it.unit.proof) { const pr = PROOFS[it.unit.proof][0]; return { q: pr.stmt + "\n（この証明は「" + it.unit.name + "」の単元で穴埋めと模範解答つきで練習できます）", type: "text", a: ["__proof__"], show: "単元「" + it.unit.name + "」へ", e: pr.hint, unitLink: it.unit.id, terms: it.unit.terms }; }
        return Object.assign(it.unit.gen(), { fmt: it.unit.fmt, kp: it.unit.kp, unitLink: it.unit.id, unitName: it.unit.name, terms: it.unit.terms });
      } };
    cur = { u, n: 0, ok: 0, termId: id, total: items.length };
    location.hash = "mondai";
    next();
  }
  const termChips = ids => ids.filter(id => (window.TERMS || []).some(t => t.id === id)).map(id => { const t = window.TERMS.find(x => x.id === id); return `<button type="button" class="chip" data-term="${id}">${esc(t.t)}</button>`; }).join("");
  function openUnit(id) {
    const u = U.find(x => x.id === id);
    cur = { u, n: 0, ok: 0, order: u.proof ? shuffleIdx(PROOFS[u.proof].length) : null, pi: 0 };
    next();
  }
  function shuffleIdx(n) { const a = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function head() {
    const u = cur.u;
    const p = cur.p || {}, fmt = p.fmt || u.fmt;
    const terms = [...new Set([...(u.terms || []), ...(p.terms || [])])];
    return `<div class="mq-head"><button class="btn" id="mq-back">← 単元一覧</button><div class="mq-title"><span class="lv lv${u.lv}">Lv${u.lv}</span> <b>${esc(u.name)}</b>${u.termMode && p.unitName ? `<span class="muted">（単元：${esc(p.unitName)}）</span>` : ""}</div><span class="mq-score">この回 ${cur.ok} / ${cur.n}</span></div>
      ${terms.length ? `<div class="mq-terms"><span>関連する用語</span>${termChips(terms)}</div>` : ""}
      <p class="mq-fmt"><b>答え方</b> ${esc(fmt)}</p>`;
  }
  const keypad = kp => kp.length ? `<div class="mq-keys" aria-label="記号の入力">${kp.map(k => `<button type="button" class="mq-key" data-k="${esc(k)}">${esc(k)}</button>`).join("")}</div>` : "";
  function bindKeys(inputSel) {
    root().querySelectorAll(".mq-key").forEach(b => b.onclick = () => {
      const inp = $(inputSel, b.closest(".mq-step") || root()) || $(inputSel); if (!inp) return;
      const k = b.dataset.k, s = inp.selectionStart ?? inp.value.length, e = inp.selectionEnd ?? s;
      inp.value = inp.value.slice(0, s) + k + inp.value.slice(e); inp.focus(); inp.setSelectionRange(s + k.length, s + k.length);
    });
  }
  function next() { if (cur.u.proof) return renderProof(); const p = cur.u.gen(); cur.p = p; renderQ(); }
  function renderQ() {
    const p = cur.p;
    root().innerHTML = head() + `
      <div class="mq-card"><p class="mq-q${p.mono ? " mono" : ""}">${esc(p.q).replace(/\n/g, "<br>")}</p></div>
      <form id="mq-form" class="q-input"><label class="sr" for="mq-ans">答え</label><input id="mq-ans" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="答えを入力"><button class="btn primary">答える</button><button type="button" class="btn" id="mq-reveal">答えを見る</button></form>
      ${keypad(p.kp || cur.u.kp)}<div id="mq-fb"></div>`;
    $("#mq-back").onclick = () => { if (window.WK_FX) window.WK_FX.back(); renderList(); }; bindKeys("#mq-ans"); $("#mq-ans").focus();
    if (p.a && p.a[0] === "__proof__") { $("#mq-form").outerHTML = `<div class="fb-act"><button class="btn primary" id="mq-go-unit">「${esc(p.show.replace(/^単元「|」へ$/g, ""))}」で証明する</button><button class="btn" id="mq-skip">次の問題</button></div>`; $("#mq-go-unit").onclick = () => openUnit(p.unitLink); $("#mq-skip").onclick = next; return; }
    $("#mq-form").onsubmit = e => {
      e.preventDefault(); if (p.done) { next(); return; }
      const r = check($("#mq-ans").value, p);
      if (!r.ok && r.msg) { $("#mq-fb").innerHTML = `<p class="mq-warn">${esc(r.msg)}</p>`; return; }
      finish(r.ok, r.msg);
    };
    $("#mq-reveal").onclick = () => { if (!p.done) finish(false, "", true); };
  }
  function finish(ok, msg, revealed) {
    const p = cur.p; p.done = true; cur.n++; if (ok) cur.ok++; rec(cur.u.id, ok);
    const info = window.WK_PROGRESS ? window.WK_PROGRESS.record({ ok, unit: cur.u.id, term: cur.termId }) : null;
    $("#mq-ans").readOnly = true; $("#mq-reveal").remove(); $("#mq-form button.primary").textContent = "次の問題";
    $("#mq-fb").innerHTML = `<div class="fb ${ok ? "fb-ok" : "fb-ng"}"><p class="fb-h">${ok ? "正解" : revealed ? "答え" : "不正解"}</p>
      ${msg ? `<p>${esc(msg)}</p>` : ""}<p class="mq-ans-show">答え：${esc(p.show)}</p><p class="fb-exp">${esc(p.e)}</p>${info ? window.WK_PROGRESS.fbHTML(info) : ""}
      <div class="fb-act"><button class="btn primary" id="mq-next">次の問題</button>${cur.u.termMode && p.unitLink ? `<button class="btn" id="mq-more">単元「${esc(p.unitName)}」をもっと解く</button>` : ""}</div></div>`;
    $(".mq-score").textContent = `この回 ${cur.ok} / ${cur.n}`;
    if (window.WK_FX) window.WK_FX.mark($(".mq-card"), ok ? (info && info.streak > 0 && info.streak % 5 === 0 ? "hana" : "ok") : "ng");
    $("#mq-next").onclick = next; $("#mq-next").focus();
    const more = $("#mq-more"); if (more) more.onclick = () => openUnit(p.unitLink);
  }
  function renderProof() {
    const list = PROOFS[cur.u.proof], pr = list[cur.order[cur.pi % list.length]];
    root().innerHTML = head() + `
      <div class="mq-card"><p class="mq-ptitle">${esc(pr.title)}</p><p class="mq-q">${esc(pr.stmt)}</p></div>
      <details class="mq-det"><summary>方針（ヒント）</summary><p>${esc(pr.hint)}</p></details>
      <h4 class="mq-h">要所の穴埋め</h4>
      ${pr.steps.map((s, i) => `<div class="mq-step" data-i="${i}"><p>${i + 1}. ${esc(s.q)}</p><form class="q-input"><input class="mq-sin" autocomplete="off" spellcheck="false" aria-label="穴埋め ${i + 1}" placeholder="式を入力"><button class="btn">確かめる</button></form><div class="mq-sfb"></div></div>`).join("")}
      ${keypad(cur.u.kp)}
      <details class="mq-det" id="mq-model"><summary>模範解答</summary><ol class="mq-proof">${pr.proof.map(x => `<li>${esc(x)}</li>`).join("")}</ol></details>
      <div class="mq-self"><p>自己採点</p><div class="fb-act"><button class="btn" data-g="2">自力で証明できた</button><button class="btn" data-g="1">ヒントを見てできた</button><button class="btn" data-g="0">まだできない</button><button class="btn primary" id="mq-next">次の問題</button></div></div>`;
    $("#mq-back").onclick = () => { if (window.WK_FX) window.WK_FX.back(); renderList(); };
    root().querySelectorAll(".mq-step").forEach(div => {
      const s = pr.steps[+div.dataset.i], inp = $(".mq-sin", div);
      inp.onfocus = () => { root().querySelectorAll(".mq-sin").forEach(x => x.classList.remove("kp-target")); inp.classList.add("kp-target"); };
      $("form", div).onsubmit = e => {
        e.preventDefault();
        const r = check(inp.value, { type: s.type || "expr", a: s.a, exact: s.exact });
        if (window.WK_FX) window.WK_FX.mark(div, r.ok ? "ok" : "ng");
        $(".mq-sfb", div).innerHTML = `<p class="${r.ok ? "ok-t" : "ng-t"}">${r.ok ? "正解" : "もう一度"}${r.msg ? "：" + esc(r.msg) : ""}${r.ok ? "" : `<button type="button" class="linkish mq-show">答えを見る</button>`}</p>`;
        const sh = $(".mq-show", div); if (sh) sh.onclick = () => { $(".mq-sfb", div).innerHTML = `<p class="ng-t">答え：${esc(s.show)}</p>`; };
      };
    });
    root().querySelectorAll(".mq-key").forEach(b => b.onclick = () => {
      const inp = root().querySelector(".mq-sin.kp-target") || root().querySelector(".mq-sin"); if (!inp) return;
      const k = b.dataset.k, s = inp.selectionStart ?? inp.value.length; inp.value = inp.value.slice(0, s) + k + inp.value.slice(s); inp.focus();
    });
    root().querySelectorAll("[data-g]").forEach(b => b.onclick = () => {
      if (cur.graded) return; cur.graded = true; const g = +b.dataset.g; cur.n++; if (g === 2) cur.ok++; rec(cur.u.id, g === 2);
      b.classList.add("primary"); $(".mq-score").textContent = `この回 ${cur.ok} / ${cur.n}`; $("#mq-model").open = true;
      if (window.WK_FX && g !== 1) window.WK_FX.mark($(".mq-card"), g === 2 ? "ok" : "ng");
      if (window.WK_PROGRESS) { const info = window.WK_PROGRESS.record({ ok: g === 2, unit: cur.u.id }); $(".mq-self").insertAdjacentHTML("beforeend", window.WK_PROGRESS.fbHTML(g === 2 ? info : Object.assign(info, { broke: info.broke }))); }
    });
    $("#mq-next").onclick = () => { cur.pi++; cur.graded = false; renderProof(); };
  }
  window.WK_MONDAI = { show() { if (!cur) renderList(); }, stats: () => st, open(id) { location.hash = "mondai"; openUnit(id); }, openTerm: openTermProblems, hasProblems };
})();
