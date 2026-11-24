(function () {
  "use strict";
  const TERMS = window.TERMS, LEVELS = window.LEVELS, KANJI = window.KANJI, PRACTICE = window.PRACTICE, NLAB = window.NLAB || {}, SITE = window.SITE_LINKS || {};
  const byId = Object.fromEntries(TERMS.map(t => [t.id, t]));
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const isHan = c => /\p{Script=Han}/u.test(c);
  const hasKana = s => /[゠-ヿ]/.test(s);

  // ───── 保存（ブラウザ内のみ） ─────
  const store = {
    load() { try { return JSON.parse(localStorage.getItem("wa-kan-v1")) || {}; } catch (e) { return {}; } },
    save() { try { localStorage.setItem("wa-kan-v1", JSON.stringify(state)); } catch (e) { } }
  };
  const state = Object.assign({ known: {}, wrong: {}, seen: {}, answered: 0, correct: 0 }, store.load());

  // ───── 外部リンク ─────
  function links(t) {
    const q = encodeURIComponent;
    const jaQ = t.t.length === 1 || ["和", "差", "積", "商", "比", "逆", "元", "系", "核", "像", "群", "環", "体", "束", "圏", "層"].includes(t.t) ? t.t + " 数学" : t.t;
    const enQ = t.en.replace(/\s*\(.*?\)/g, "").split(" / ")[0];
    const L = [
      { k: "定義", n: "Wikipedia（日本語）", u: "https://ja.wikipedia.org/w/index.php?search=" + q(jaQ) },
      { k: "定義", n: "Wikipedia（英語）", u: "https://en.wikipedia.org/w/index.php?search=" + q(enQ + " mathematics") },
      { k: "辞書", n: "コトバンク", u: "https://kotobank.jp/search?q=" + q(t.t) },
      { k: "英語", n: "Wolfram MathWorld", u: "https://mathworld.wolfram.com/search/?query=" + q(enQ) }
    ];
    if (NLAB[t.id]) L.push({ k: "専門", n: "nLab", u: "https://ncatlab.org/nlab/show/" + NLAB[t.id] });
    L.push({ k: "語源", n: "Earliest Known Uses of Some of the Words of Mathematics（J. Miller）", u: "https://jeff560.tripod.com/mathword.html" });
    L.push({ k: "歴史", n: "MacTutor 数学史アーカイブ", u: "https://mathshistory.st-andrews.ac.uk/Search/?query=" + q(enQ) });
    return L;
  }

  // ───── 共通部品 ─────
  const ruby = t => hasKana(t.t) && !/\p{Script=Han}/u.test(t.t) ? esc(t.t) : `<ruby>${esc(t.t)}<rt>${esc(t.r)}</rt></ruby>`;
  const lvChip = lv => `<span class="lv lv${lv}">Lv${lv} ${esc(LEVELS[lv - 1].name)}</span>`;

  function kanjiBreakdown(t) {
    const chars = [...t.t].filter(isHan);
    if (!chars.length) return `<p class="muted">カタカナ語（外来語）です。原語の語源は下の「歴史・原語」を見てください。</p>`;
    return `<div class="kj-row">${chars.map(c => {
      const k = KANJI[c] || {};
      return `<a class="kj" href="https://ja.wiktionary.org/wiki/${encodeURIComponent(c)}" target="_blank" rel="noopener">
        <span class="kj-c">${esc(c)}</span>
        <span class="kj-r">${esc(k.on || "")}${k.kun ? "／" + esc(k.kun) : ""}</span>
        <span class="kj-m">${esc(k.m || "")}</span></a>`;
    }).join("")}</div>`;
  }

  // この用語を学べるサイト（各サイトの実在ページのみ。数学の景色に記事がない用語はサイト内検索）
  function learnBlock(t) {
    const s = SITE[t.id] || {}, items = [];
    if (s.m5) items.push({ n: "中学校数学・学習サイト", d: "中学数学の要点と例題", u: s.m5 });
    if (s.ml) items.push({ n: "数学の景色", d: "定義・具体例・証明（大学数学）", u: s.ml });
    if (s.mif) items.push({ n: "Math is Fun", d: "英語・図解でやさしく", u: s.mif });
    if (!s.ml && (t.lv >= 3 || !items.length)) items.push({ n: "数学の景色で検索", d: "専用の記事がないため、サイト内検索を開きます", u: "https://mathlandscape.com/?s=" + encodeURIComponent(t.t), search: true });
    return `<section class="learn"><h3>この用語を学べるサイト</h3><div class="learn-row">${items.map(i =>
      `<a class="learn-card${i.search ? " is-search" : ""}" href="${i.u}" target="_blank" rel="noopener"><span class="learn-n">${esc(i.n)}</span><span class="learn-d">${esc(i.d)}</span><span class="learn-u">${esc(i.u.replace(/^https:\/\//, "").replace(/\/$/, ""))}</span></a>`).join("")}</div></section>`;
  }

  function etyBlock(t) {
    return `<div class="ety">
      <h4>字解（一字ずつ）</h4>${kanjiBreakdown(t)}
      <h4>歴史・原語</h4><p>${esc(t.ety)}</p>
      <h4>深掘りできるサイト</h4>
      <ul class="links">${links(t).map(l => `<li><span class="lk">${esc(l.k)}</span><a href="${l.u}" target="_blank" rel="noopener">${esc(l.n)}</a></li>`).join("")}</ul>
    </div>`;
  }

  // ───── 用語詳細 ─────
  const dlg = $("#detail");
  function openTerm(id, opts = {}) {
    const t = byId[id]; if (!t) return;
    state.seen[id] = 1; store.save();
    const known = !!state.known[id];
    $("#detail-body").innerHTML = `
      <div class="d-head">
        <div class="d-meta">${lvChip(t.lv)}<span class="field">${esc(t.f)}</span></div>
        <h2 class="d-term">${ruby(t)}</h2>
        <p class="d-en en-t">${esc(t.en)}</p>
      </div>
      <section><h3>定義</h3><p>${esc(t.d)}</p></section>
      <section><h3>例</h3><p class="ex">${esc(t.ex)}</p></section>
      ${(window.MOTIVE || {})[t.id] ? `<section class="motive"><h3>なぜこの用語があるのか</h3><p>${esc(window.MOTIVE[t.id].why)}</p>${window.MOTIVE[t.id].hist ? `<p class="motive-h"><span>歴史</span>${esc(window.MOTIVE[t.id].hist)}</p>` : ""}</section>` : ""}
      ${t.note ? `<section class="note"><h3>注意</h3><p>${esc(t.note)}</p></section>` : ""}
      ${learnBlock(t)}
      <details class="ety-wrap" ${opts.ety ? "open" : ""}><summary>語源をチェック</summary>${etyBlock(t)}</details>
      ${t.rel && t.rel.length ? `<section><h3>関連語</h3><div class="chips">${t.rel.filter(r => byId[r]).map(r => `<button class="chip" data-term="${r}">${esc(byId[r].t)}</button>`).join("")}</div></section>` : ""}
      <div class="d-actions">
        <button class="btn ${known ? "" : "primary"}" id="toggle-known">${known ? "「覚えた」を取り消す" : "覚えた"}</button>
        <button class="btn" id="drill-this">この用語の練習問題</button>
        ${window.WK_MONDAI && window.WK_MONDAI.hasProblems(id) ? `<button class="btn" id="mondai-this">問題集で解く</button>` : ""}
      </div>`;
    $("#toggle-known").onclick = () => { if (state.known[id]) delete state.known[id]; else state.known[id] = 1; store.save(); openTerm(id); renderLadder(); renderList(); };
    $("#drill-this").onclick = () => { dlg.close(); startDrill({ only: id }); location.hash = "drill"; };
    const mt = $("#mondai-this"); if (mt) mt.onclick = () => { dlg.close(); window.WK_MONDAI.openTerm(id); };
    if (!dlg.open) dlg.showModal();
    $("#detail-body").scrollTop = 0;
  }
  $("#detail-close").onclick = () => dlg.close();
  dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });
  document.addEventListener("click", e => {
    const mq = e.target.closest("[data-mondai]"); if (mq) { e.preventDefault(); if (dlg.open) dlg.close(); window.WK_MONDAI.openTerm(mq.dataset.mondai); return; }
    const b = e.target.closest("[data-term]"); if (b) { e.preventDefault(); openTerm(b.dataset.term, { ety: b.dataset.ety === "1" }); }
  });

  // ───── レベルの階段 ─────
  // レベルの階段。クリックすると詳細パネルを開き、ほかのレベルはサイドバーへ
  let openLv = 0;
  function stepHTML(L, cls = "") {
    const ts = TERMS.filter(t => t.lv === L.lv), k = ts.filter(t => state.known[t.id]).length;
    const pct = Math.round(100 * k / ts.length);
    return `<button class="step s${L.lv} ${cls}" data-lv="${L.lv}" aria-label="Lv${L.lv} ${L.name}"${cls.includes("cur") ? ' aria-current="true"' : ""}>
        <span class="step-k">${esc(L.sample)}</span>
        <span class="step-n">Lv${L.lv} ${esc(L.name)}</span>
        <span class="step-s">${esc(L.sub)}・${ts.length}語</span>
        <span class="bar"><i style="width:${pct}%"></i></span>
        <span class="step-p">覚えた ${k}/${ts.length}</span></button>`;
  }
  function levelPanel(lv) {
    const L = LEVELS[lv - 1], I = (window.LEVEL_INFO || {})[lv] || {}, ts = TERMS.filter(t => t.lv === lv);
    const k = ts.filter(t => state.known[t.id]).length, seen = ts.filter(t => state.seen[t.id]).length;
    const fields = {}; ts.forEach(t => { fields[t.f] = (fields[t.f] || 0) + 1; });
    const units = window.WK_PROBLEMS ? window.WK_PROBLEMS.U.filter(u => u.lv === lv) : [];
    const nextL = LEVELS[lv];
    return `<section class="lv-panel s${lv}" aria-label="Lv${lv} ${esc(L.name)} の解説">
      <div class="lvp-head">
        <span class="lvp-k">${esc(L.sample)}</span>
        <div><p class="lvp-eyebrow">Lv${lv}・${esc(L.sub)}</p><h2>${esc(L.name)}<span>${esc(I.theme || "")}</span></h2></div>
        <button class="btn lvp-close" id="lvp-close" aria-label="レベル一覧に戻る">一覧に戻る</button>
      </div>
      <p class="lvp-sum">${esc(I.summary || "")}</p>
      <div class="lvp-grid">
        <div><h3>学ぶこと</h3><ul class="lvp-topics">${(I.topics || []).map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>
        <div>
          <h3>この段階の記録</h3>
          <div class="lvp-stats"><p><b>${ts.length}</b><span>用語</span></p><p><b>${seen}</b><span>開いた</span></p><p><b>${k}</b><span>覚えた</span></p></div>
          <div class="bar lvp-bar"><i style="width:${Math.round(100 * k / ts.length)}%"></i></div>
          <h3>分野</h3><div class="chips">${Object.entries(fields).sort((a, b) => b[1] - a[1]).map(([f, n]) => `<button type="button" class="chip" data-lvf="${esc(f)}">${esc(f)} <span class="muted">${n}</span></button>`).join("")}</div>
        </div>
      </div>
      <h3>まず押さえたい用語</h3>
      <div class="chips">${(I.key || []).filter(id => byId[id]).map(id => `<button type="button" class="chip" data-term="${id}">${esc(byId[id].t)}</button>`).join("")}</div>
      ${units.length ? `<h3>問題集の単元</h3><div class="chips">${units.map(u => `<button type="button" class="chip" data-lvunit="${u.id}">${esc(u.name)}</button>`).join("")}</div>`
        : `<p class="muted lvp-note">この段階の用語は、用語の詳細画面の「問題集で解く」から 1 語ずつ問題を解けます。</p>`}
      <div class="fb-act lvp-act">
        <button class="btn primary" id="lvp-terms">この段階の用語を見る（${ts.length} 語）</button>
        <button class="btn" id="lvp-drill">練習問題を解く</button>
        ${nextL ? `<button class="btn" data-lv="${nextL.lv}" id="lvp-next">次の段階：Lv${nextL.lv} ${esc(nextL.name)} →</button>` : ""}
      </div>
      ${I.next ? `<p class="lvp-nexttxt">${esc(I.next)}</p>` : ""}
    </section>`;
  }
  function renderLadder() {
    const lad = $("#ladder");
    lad.classList.toggle("open", !!openLv);
    if (!openLv) lad.innerHTML = LEVELS.map(L => stepHTML(L)).join("");
    else lad.innerHTML = `<nav class="lv-side" aria-label="ほかのレベル">${LEVELS.map(L => stepHTML(L, L.lv === openLv ? "cur" : "mini")).join("")}</nav>${levelPanel(openLv)}`;
    lad.querySelectorAll("[data-lv]").forEach(b => b.onclick = () => {
      const lv = +b.dataset.lv; if (lv === openLv && b.classList.contains("cur")) return;
      openLv = lv; renderLadder();
      const pnl = lad.querySelector(".lv-panel"); if (pnl && !matchMedia("(prefers-reduced-motion: reduce)").matches) pnl.classList.add("enter");
      if (lad.getBoundingClientRect().top < 0) lad.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    const cur = lad.querySelector(".lv-side .cur"); if (cur && matchMedia("(max-width: 760px)").matches) { const sd = cur.parentElement; sd.scrollLeft = cur.offsetLeft - (sd.clientWidth - cur.offsetWidth) / 2; }
    const cl = $("#lvp-close"); if (cl) cl.onclick = () => { openLv = 0; if (window.WK_FX) window.WK_FX.back(); renderLadder(); };
    const goTerms = f => { filt.lv = openLv; filt.f = f || ""; syncFilters(); renderList(); location.hash = "terms"; setTimeout(() => $("#terms").scrollIntoView({ behavior: "smooth" }), 50); };
    const tb = $("#lvp-terms"); if (tb) tb.onclick = () => goTerms("");
    lad.querySelectorAll("[data-lvf]").forEach(b => b.onclick = () => goTerms(b.dataset.lvf));
    const db = $("#lvp-drill"); if (db) db.onclick = () => { $("#d-lv").value = String(openLv); startDrill({ lv: openLv }); };
    lad.querySelectorAll("[data-lvunit]").forEach(b => b.onclick = () => window.WK_MONDAI.open(b.dataset.lvunit));
    const total = TERMS.length, known = Object.keys(state.known).filter(k => byId[k]).length;
    $("#stat").innerHTML = `<b>${total}</b>語収録 ・ 覚えた <b>${known}</b> ・ 解答 <b>${state.answered}</b>問（正答率 ${state.answered ? Math.round(100 * state.correct / state.answered) : 0}%）`;
  }

  // ───── 用語一覧 ─────
  const filt = { lv: 0, f: "", q: "", only: "" };
  function syncFilters() {
    $("#f-lv").value = String(filt.lv); $("#f-field").value = filt.f; $("#f-q").value = filt.q; $("#f-only").value = filt.only;
  }
  function renderList() {
    const q = filt.q.trim().toLowerCase();
    const list = TERMS.filter(t => (!filt.lv || t.lv === filt.lv) && (!filt.f || t.f === filt.f) &&
      (!filt.only || (filt.only === "known" ? state.known[t.id] : !state.known[t.id])) &&
      (!q || [t.t, t.r, t.en, t.d].some(s => s.toLowerCase().includes(q))));
    $("#count").textContent = `${list.length} 語`;
    $("#list").innerHTML = list.length ? list.map(t => `
      <article class="card ${state.known[t.id] ? "known" : ""}">
        <button class="card-main" data-term="${t.id}">
          <span class="c-top">${lvChip(t.lv)}<span class="field">${esc(t.f)}</span>${state.known[t.id] ? '<span class="ok">覚えた</span>' : ""}</span>
          <span class="c-term">${ruby(t)}</span>
          <span class="c-en en-t">${esc(t.en)}</span>
          <span class="c-def">${esc(t.d)}</span>
        </button>
        <button class="c-ety" data-term="${t.id}" data-ety="1">語源をチェック →</button>
      </article>`).join("") : `<p class="empty">条件に合う用語がありません。検索語やレベルを変えてみてください。</p>`;
  }
  function initFilters() {
    $("#f-lv").innerHTML = `<option value="0">すべてのレベル</option>` + LEVELS.map(L => `<option value="${L.lv}">Lv${L.lv} ${L.name}</option>`).join("");
    $("#f-field").innerHTML = `<option value="">すべての分野</option>` + window.FIELDS.map(f => `<option>${f}</option>`).join("");
    $("#f-lv").onchange = e => { filt.lv = +e.target.value; renderList(); };
    $("#f-field").onchange = e => { filt.f = e.target.value; renderList(); };
    $("#f-only").onchange = e => { filt.only = e.target.value; renderList(); };
    $("#f-q").oninput = e => { filt.q = e.target.value; renderList(); };
  }

  // ───── 問題生成（記述式フラッシュカード） ─────
  const MODES = {
    mix: "ミックス",
    practice: "実践問題（概念）",
    read: "漢字 → 読み",
    def: "定義 → 用語",
    ety: "語源 → 用語",
    ja2en: "日本語 → 英語",
    en2ja: "英語 → 日本語"
  };
  const EN_MODES = ["ja2en", "en2ja"];
  // 別表記・同義語として正解に認める語
  const ALT = {
    kumiawase: ["組み合わせ"], senkeikukan: ["線型空間", "ベクトル空間"], senkeishazo: ["線型写像"], gen: ["要素"],
    kakangun: ["アーベル群"], kansu: ["函数", "写像"], shazo: ["関数"], zentanshya: ["双射"], fiber: ["ファイバーバンドル"],
    ken: ["範疇"], doukei: ["同形"], amari: ["剰余"], heikin: ["相加平均", "算術平均"], sanheiho: ["ピタゴラスの定理"],
    seisokugyoretsu: ["可逆行列"], gcd: ["gcd"], lcm: ["lcm"], pi: ["π"], tai: ["可換体"], ichiyo: [], vector: []
  };
  const norm = s => String(s ?? "").normalize("NFKC").toLowerCase()
    .replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[−–—－]/g, "-").replace(/[\s「」『』。、．・"'`^]/g, "").replace(/です$|だ$/, "");
  const enVariants = t => t.en.split(" / ").flatMap(s => {
    const base = s.replace(/\s*\(.*?\)\s*/g, " ").trim(), p = (s.match(/\((.*?)\)/) || [])[1];
    const out = [base];
    if (p) { if (p.length <= 4 || /[^\x00-\x7F]/.test(p)) out.push(p); else out.push(base.replace(/^\S+/, p)); }
    return out;
  }).map(x => x.replace(/^(a|an|the)\s+/i, ""));
  const jaAnswers = t => [t.t, ...(ALT[t.id] || []), ...(/\p{Script=Han}/u.test(t.t) ? [t.r] : [])];
  function mask(text, t) {
    let s = text;
    [t.t, ...(ALT[t.id] || []).filter(a => a.length > 1), ...enVariants(t)].filter(v => v && v.length > 1)
      .sort((a, b) => b.length - a.length).forEach(v => { s = s.split(v).join("＿＿"); });
    return s;
  }
  function makeQ(t, mode) {
    const han = /\p{Script=Han}/u.test(t.t);
    switch (mode) {
      case "read": if (!han) return null;
        return { t, kind: "読み", front: t.t, big: true, q: "読みをひらがなで答えよ", a: [t.r], hint: "ひらがな" };
      case "ja2en":
        return { t, kind: "日→英", front: t.t, big: true, q: "英語で答えよ", a: enVariants(t), hint: "英語", en: 1 };
      case "en2ja": {
        // 同じ英語をもつ別の用語（例：square → 平方・正方形）も正解にする
        const ev = new Set(enVariants(t).map(x => x.toLowerCase()));
        const same = TERMS.filter(x => x.id !== t.id && enVariants(x).some(v => ev.has(v.toLowerCase())));
        return { t, kind: "英→日", front: t.en, big: true, q: "日本語の用語で答えよ", a: [...jaAnswers(t), ...same.flatMap(jaAnswers)], hint: "用語", en: 1 };
      }
      case "def":
        return { t, kind: "定義", q: "この定義に当てはまる用語は？", front: mask(t.d, t), a: jaAnswers(t), hint: "用語" };
      case "ety":
        return { t, kind: "語源", q: "この語源をもつ用語は？", front: mask(t.ety, t), a: jaAnswers(t), hint: "用語" };
    }
    return null;
  }
  const practiceQ = p => ({ t: byId[p.term], kind: "実践", q: "", front: p.q, a: p.a || [], set: p.set, exp: p.e, hint: p.set ? "読点（、）かカンマで区切ってすべて" : "答え" });
  function check(q, input) {
    const n = norm(input); if (!n) return false;
    if ((q.a || []).some(a => norm(a) === n)) return true;
    if (q.set) {
      const toks = String(input).normalize("NFKC").split(/[,、，\s]+|と|および|and/).map(norm).filter(Boolean);
      if (toks.length !== q.set.length) return false;
      const used = new Set();
      return toks.every(tk => { const i = q.set.findIndex((alts, k) => !used.has(k) && alts.some(a => norm(a) === tk)); if (i < 0) return false; used.add(i); return true; });
    }
    return false;
  }
  const showAnswer = q => q.set ? q.set.map(s => s[0]).join("、") : q.a[0];
  const otherAnswers = q => q.set ? [] : q.a.slice(1).filter(a => !(state.hideEn && /[a-z]/i.test(a) && !/[a-z]/i.test(q.a[0])));

  // ───── ドリル ─────
  let drill = null;
  function initDrillControls() {
    $("#d-mode").innerHTML = Object.entries(MODES).map(([k, v]) => `<option value="${k}" ${EN_MODES.includes(k) ? 'data-en="1"' : ""}>${v}</option>`).join("");
    $("#d-lv").innerHTML = `<option value="0">全レベル</option>` + LEVELS.map(L => `<option value="${L.lv}">Lv${L.lv} ${L.name}</option>`).join("") + `<option value="-1">間違えた用語だけ</option><option value="-2">今日の復習（期限が来た用語）</option>`;
    $("#d-start").onclick = () => startDrill({});
  }
  function syncEnModes() {
    $("#d-mode").querySelectorAll("[data-en]").forEach(o => { o.disabled = !!state.hideEn; });
    if (state.hideEn && EN_MODES.includes($("#d-mode").value)) $("#d-mode").value = "mix";
  }
  function startDrill(opt) {
    const P = window.WK_PROGRESS;
    if (opt.ids || opt.lv) location.hash = "drill";
    const mode = opt.only || opt.ids ? "mix" : $("#d-mode").value;
    const lv = opt.only || opt.ids ? 0 : opt.lv || +$("#d-lv").value;
    if (lv === -2) opt = { ids: P.due() };
    const n = +$("#d-n").value || 10;
    let pool = TERMS.filter(t => !lv || lv === -1 || t.lv === lv);
    if (lv === -1) pool = TERMS.filter(t => state.wrong[t.id]);
    if (opt.only) pool = [byId[opt.only]];
    if (opt.ids) pool = opt.ids.map(id => byId[id]).filter(Boolean);
    if (!pool.length) { $("#drill-area").innerHTML = `<p class="empty">${opt.ids ? "今日が期限の復習はありません。" : "間違えた用語はまだありません。まずは通常の練習を解いてください。"}</p>`; return; }
    const ids = new Set(pool.map(t => t.id));
    const prac = PRACTICE.filter(p => ids.has(p.term) && !(state.hideEn && p.en));
    const vocab = ["read", "def", "ety", ...(state.hideEn ? [] : EN_MODES)];
    let qs = [];
    if (mode === "practice") {
      qs = shuffle(prac).slice(0, n).map(practiceQ);
      if (!qs.length) { $("#drill-area").innerHTML = `<p class="empty">この範囲の実践問題はありません。別の出題形式を選んでください。</p>`; return; }
    } else if (opt.ids) {
      // 1 語につき 1 問。形式はランダム
      qs = pool.map(t => { for (let k = 0; k < 8; k++) { const q = makeQ(t, vocab[Math.floor(Math.random() * vocab.length)]); if (q) return q; } return null; }).filter(Boolean);
    } else if (opt.only) {
      qs = vocab.map(m => makeQ(pool[0], m)).filter(Boolean).concat(prac.map(practiceQ));
    } else {
      const ms = mode === "mix" ? vocab : [mode];
      let guard = 0;
      while (qs.length < n && guard++ < 500) {
        let q;
        if (mode === "mix" && prac.length && Math.random() < 0.35) q = practiceQ(prac[Math.floor(Math.random() * prac.length)]);
        else q = makeQ(pool[Math.floor(Math.random() * pool.length)], ms[Math.floor(Math.random() * ms.length)]);
        if (q && !qs.some(x => x.front === q.front && x.kind === q.kind)) qs.push(q);
      }
    }
    drill = { qs: shuffle(qs), i: 0, score: 0, miss: [] };
    renderQ();
  }
  function renderQ() {
    const d = drill, q = d.qs[d.i];
    if (!q) return renderResult();
    $("#drill-area").innerHTML = `
      <div class="q-prog"><span>${d.i + 1} / ${d.qs.length}</span><span class="q-kind">${esc(q.kind)}</span>${lvChip(q.t.lv)}<span class="q-score">正解 ${d.score}</span></div>
      <div class="q-bar"><i style="width:${100 * d.i / d.qs.length}%"></i></div>
      <div class="flash" id="flash">
        <div class="flash-front">
          ${q.q ? `<p class="f-q">${esc(q.q)}</p>` : ""}
          <p class="${q.big ? "f-big" : "f-text"}">${esc(q.front).replace(/\n/g, "<br>")}</p>
        </div>
        <div class="flash-back" id="q-fb" hidden></div>
      </div>
      <form id="q-form" class="q-input">
        <label class="sr" for="q-ans">答え</label>
        <input id="q-ans" autocomplete="off" autocapitalize="off" spellcheck="false" lang="${q.kind === "日→英" ? "en" : "ja"}" placeholder="${esc(q.hint)}を入力">
        <button class="btn primary" type="submit">答える</button>
        <button class="btn" type="button" id="q-reveal">答えを見る</button>
      </form>`;
    $("#q-ans").focus();
    $("#q-form").onsubmit = e => { e.preventDefault(); if (q.done) return; const v = $("#q-ans").value; if (!v.trim()) { $("#q-ans").focus(); return; } answer(check(q, v), v); };
    $("#q-reveal").onclick = () => { if (!q.done) answer(false, ""); };
  }
  function record(q, ok, undo) {
    if (undo) { state.correct++; drill.score++; const w = state.wrong[q.t.id] - 1; if (w > 0) state.wrong[q.t.id] = w; else delete state.wrong[q.t.id]; drill.miss = drill.miss.filter(x => x !== q); store.save(); return; }
    state.answered++;
    if (ok) { state.correct++; drill.score++; } else { state.wrong[q.t.id] = (state.wrong[q.t.id] || 0) + 1; drill.miss.push(q); }
    store.save();
  }
  function answer(ok, given) {
    const d = drill, q = d.qs[d.i];
    q.done = true; record(q, ok);
    let info = window.WK_PROGRESS.record({ ok, term: q.t.id });
    $("#q-form").hidden = true;
    const t = q.t, others = otherAnswers(q);
    const fb = $("#q-fb"); fb.hidden = false;
    $("#flash").className = "flash flipped " + (ok ? "is-ok" : "is-ng");
    fb.innerHTML = `
      <p class="fb-h">${ok ? "正解" : given ? "不正解" : "答え"}</p>
      <p class="fb-ans">${esc(showAnswer(q))}</p>
      ${others.length ? `<p class="fb-alt">ほかに認める答え：${others.map(esc).join("、")}</p>` : ""}
      ${q.set ? `<p class="fb-alt">順不同。すべて答えて正解。</p>` : ""}
      ${given ? `<p class="fb-you">あなたの答え：${esc(given)}</p>` : ""}
      ${q.exp ? `<p class="fb-exp">${esc(q.exp)}</p>` : ""}
      <div id="q-prog-fb">${window.WK_PROGRESS.fbHTML(info)}</div>
      <div class="fb-term-box"><p class="fb-term">${ruby(t)} <span class="muted en-t">${esc(t.en)}</span></p><p class="fb-def">${esc(t.d)}</p></div>
      <div class="fb-act">
        ${!ok && given ? `<button class="btn" id="q-override">自分の答えも正しい（正解にする）</button>` : ""}
        <button class="btn" data-term="${t.id}" data-ety="1">語源をチェック</button>
        ${window.WK_MONDAI && window.WK_MONDAI.hasProblems(t.id) ? `<button class="btn" data-mondai="${t.id}">問題集で解く</button>` : ""}
        <button class="btn primary" id="q-next">${d.i + 1 < d.qs.length ? "次の問題" : "結果を見る"}</button>
      </div>`;
    const ov = $("#q-override");
    if (ov) ov.onclick = () => { record(q, true, true); info = window.WK_PROGRESS.fix(info); $("#q-prog-fb").innerHTML = window.WK_PROGRESS.fbHTML(info); if (window.WK_FX) window.WK_FX.mark($("#flash"), "ok"); ov.remove(); $("#flash").className = "flash flipped is-ok"; $(".fb-h").textContent = "正解（自己判定）"; renderLadder(); };
    if (window.WK_FX) window.WK_FX.mark($("#flash"), ok ? (info.streak > 0 && info.streak % 5 === 0 ? "hana" : "ok") : "ng");
    $("#q-next").onclick = () => { d.i++; renderQ(); };
    $("#q-next").focus();
    renderLadder();
  }
  function renderResult() {
    const d = drill, pct = Math.round(100 * d.score / d.qs.length);
    $("#drill-area").innerHTML = `
      <div class="result"><p class="r-big">${d.score} / ${d.qs.length}</p><p>正答率 ${pct}%</p>
      ${d.miss.length ? `<h3>間違えた用語</h3><div class="chips">${[...new Set(d.miss.map(q => q.t.id))].map(id => `<button class="chip ng" data-term="${id}" data-ety="1">${esc(byId[id].t)}</button>`).join("")}</div>` : `<p>全問正解です。次のレベルに進みましょう。</p>`}
      <div class="fb-act"><button class="btn primary" id="again">同じ設定でもう一度</button></div></div>`;
    $("#again").onclick = () => startDrill({});
  }

  // ───── 英語の表示切替 ─────
  function applyEn() {
    document.body.classList.toggle("no-en", !!state.hideEn);
    const b = $("#toggle-en"); b.setAttribute("aria-pressed", state.hideEn ? "true" : "false");
    b.textContent = state.hideEn ? "英語訳を表示する" : "英語訳を隠す";
    syncEnModes();
  }
  $("#toggle-en").onclick = () => { state.hideEn = !state.hideEn; store.save(); applyEn(); if (drill && location.hash === "#drill") startDrill({}); };

  // ───── 復習 ─────
  function renderReview() {
    const ws = Object.entries(state.wrong).filter(([id]) => byId[id]).sort((a, b) => b[1] - a[1]);
    $("#review-list").innerHTML = ws.length ? `<table class="tbl"><thead><tr><th>用語</th><th>読み</th><th class="en-t">英語</th><th class="num">誤答</th><th></th></tr></thead><tbody>${ws.map(([id, n]) => { const t = byId[id]; return `<tr><td><button class="linkish" data-term="${id}">${esc(t.t)}</button></td><td>${esc(t.r)}</td><td class="en-t">${esc(t.en)}</td><td class="num">${n}</td><td><button class="linkish" data-clear="${id}">克服した</button></td></tr>`; }).join("")}</tbody></table>`
      : `<p class="empty">まだ間違えた用語はありません。「練習」で問題を解くと、間違えた用語がここに集まります。</p>`;
    window.WK_PROGRESS.renderSchedule();
    $("#review-list").querySelectorAll("[data-clear]").forEach(b => b.onclick = () => { delete state.wrong[b.dataset.clear]; store.save(); renderReview(); });
  }
  $("#reset").onclick = () => {
    const b = $("#reset");
    if (b.dataset.armed) { Object.assign(state, { known: {}, wrong: {}, seen: {}, answered: 0, correct: 0 }); store.save(); renderAll(); b.textContent = "学習記録を消去"; delete b.dataset.armed; }
    else { b.dataset.armed = "1"; b.textContent = "もう一度押すと消去します"; setTimeout(() => { if (b.dataset.armed) { delete b.dataset.armed; b.textContent = "学習記録を消去"; } }, 4000); }
  };

  // ───── タブ（ハッシュ） ─────
  const VIEWS = ["today", "terms", "drill", "mondai", "review", "sites", "about"];
  let lastView = null, histIdx = null;
  function route() {
    let h = location.hash.slice(1);
    if (h.startsWith("term-")) { const id = h.slice(5); if (byId[id]) openTerm(id); h = "terms"; }
    else if (dlg.open) dlg.close();
    if (!VIEWS.includes(h)) h = "today";
    // 履歴の位置で「進む／戻る」を判定（戻るときはフラクタルの逆再生）
    let dir = "fwd";
    try {
      const st = history.state;
      if (st && typeof st.wkIdx === "number") { if (histIdx !== null && st.wkIdx < histIdx) dir = "back"; histIdx = st.wkIdx; }
      else { histIdx = (histIdx === null ? 0 : histIdx) + 1; history.replaceState({ wkIdx: histIdx }, ""); }
    } catch (e) { }
    if (lastView !== null && lastView !== h && window.WK_FX) (dir === "back" ? window.WK_FX.back : window.WK_FX.section)();
    lastView = h;
    VIEWS.forEach(v => { $("#" + v).hidden = v !== h; });
    document.querySelectorAll(".tabs a").forEach(a => a.setAttribute("aria-current", a.getAttribute("href") === "#" + h ? "page" : "false"));
    { const nav = document.querySelector("nav.tabs"), act = nav && nav.querySelector(`a[href="#${h}"]`);
      if (act && nav.scrollWidth > nav.clientWidth) { const l = act.offsetLeft - nav.offsetLeft, r = l + act.offsetWidth; if (l < nav.scrollLeft || r > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = l - (nav.clientWidth - act.offsetWidth) / 2; } }
    if (h === "review") renderReview();
    if (h === "today") window.WK_PROGRESS.renderHome();
    if (h === "mondai" && window.WK_MONDAI) window.WK_MONDAI.show();
    if (h === "drill" && !drill) startDrill({});
  }
  window.addEventListener("hashchange", route);

  function renderAll() { renderLadder(); renderList(); renderReview(); }
  // このサイトについて：言語切替と数値
  function setAboutLang(l) {
    document.querySelectorAll("[data-ab]").forEach(x => { x.hidden = x.dataset.ab !== l; });
    document.querySelectorAll("[data-ablang]").forEach(b => b.setAttribute("aria-pressed", b.dataset.ablang === l ? "true" : "false"));
    try { localStorage.setItem("wa-kan-about-lang", l); } catch (e) { }
  }
  document.querySelectorAll("[data-ablang]").forEach(b => b.onclick = () => setAboutLang(b.dataset.ablang));
  { let l = "ja"; try { l = localStorage.getItem("wa-kan-about-lang") || "ja"; } catch (e) { } setAboutLang(l); }
  {
    const PB = window.WK_PROBLEMS, TP = window.TERM_PROBLEMS || {};
    const fixed = Object.values(TP).reduce((s, a) => s + a.length, 0) + PRACTICE.length + (PB ? Object.values(PB.PROOFS).reduce((s, a) => s + a.length, 0) : 0);
    const vals = { terms: TERMS.length, levels: LEVELS.length, units: PB ? PB.U.length : 0, fixed };
    document.querySelectorAll("[data-stat]").forEach(el => { if (vals[el.dataset.stat] !== undefined) el.textContent = vals[el.dataset.stat]; });
  }

  window.WK_APP = { startDrill, seen: () => state.seen };
  window.WK_PROGRESS.seed(Object.keys(state.wrong).filter(id => byId[id]));
  initFilters(); initDrillControls(); applyEn(); renderAll(); route();
})();
