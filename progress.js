// 継続を支える機能：目標設定・連続達成日数・連勝ストリーク・これから復習（間隔反復）・おすすめ・数学者の名言
(function () {
  "use strict";
  const KEY = "wa-kan-progress-v1";
  const INTERVALS = [1, 3, 7, 14, 30];          // 正解するたびに次の復習までの日数が伸びる
  const MILESTONES = [5, 10, 20, 30, 50, 100];
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = n => String(n).padStart(2, "0");
  const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => dkey(new Date());
  const addDays = (k, n) => { const [y, mo, d] = k.split("-").map(Number); return dkey(new Date(y, mo - 1, d + n)); };
  const diffDays = (a, b) => { const p = k => { const [y, mo, d] = k.split("-").map(Number); return Date.UTC(y, mo - 1, d); }; return Math.round((p(a) - p(b)) / 864e5); };

  let S = { goal: 20, lv: 1, days: {}, streak: 0, best: 0, srs: {} };
  try { S = Object.assign(S, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } };
  const day = k => S.days[k] || (S.days[k] = { n: 0, ok: 0, hit: false });

  // ───── 数学者の名言（出典・伝承の別を明記） ─────
  const QUOTES = [
    { ja: "幾何学に王道なし。", orig: "There is no royal road to geometry.", who: "ユークリッド", src: "プロクロス『ユークリッド原論第 1 巻注釈』が伝える逸話（プトレマイオス 1 世への答え）" },
    { ja: "我々は知らねばならない。我々は知るであろう。", orig: "Wir müssen wissen. Wir werden wissen.", who: "ダフィット・ヒルベルト", src: "ケーニヒスベルクでの講演（1930）" },
    { ja: "数学に「我々は知ることがないだろう」はない。", orig: "In der Mathematik gibt es kein Ignorabimus.", who: "ダフィット・ヒルベルト", src: "国際数学者会議での講演「数学の問題」（1900）" },
    { ja: "哲学は、私たちの目の前に絶えず開かれているこの最も大きな書物（宇宙のことです）に書かれている。それは数学の言葉で書かれている。", orig: "Egli è scritto in lingua matematica.", who: "ガリレオ・ガリレイ", src: "『偽金鑑識官（Il Saggiatore）』（1623）" },
    { ja: "私に立つ場所を与えよ。そうすれば地球を動かしてみせよう。", orig: "Δός μοι πᾶ στῶ καὶ τὰν γᾶν κινάσω.", who: "アルキメデス", src: "パップス『数学集成』第 8 巻が伝える言葉（伝承）。てこの原理について。" },
    { ja: "この手紙が長くなったのは、短くする時間がなかったからにほかなりません。", orig: "Je n'ai fait celle-ci plus longue que parce que je n'ai pas eu le loisir de la faire plus courte.", who: "ブレーズ・パスカル", src: "『プロヴァンシアル』第 16 の手紙（1657）。短く明快な証明が難しい理由として。" },
    { ja: "検討する難問の一つ一つを、よりよく解くために必要なだけの小部分に分けること。", orig: "Diviser chacune des difficultés que j'examinerais en autant de parcelles qu'il se pourrait, et qu'il serait requis pour les mieux résoudre.", who: "ルネ・デカルト", src: "『方法序説』第 2 部・第 2 の規則（1637）" },
    { ja: "数学においては、問いを立てる技術は、それを解く技術よりも価値がある。", orig: "In re mathematica ars proponendi quaestionem pluris facienda est quam solvendi.", who: "ゲオルク・カントール", src: "学位論文の命題（1867）" },
    { ja: "オイラーを読め、オイラーを読め。彼こそ我々すべての師である。", orig: "Lisez Euler, lisez Euler, c'est notre maître à tous.", who: "ピエール＝シモン・ラプラス", src: "G. リブリがラプラスの言葉として伝える（伝承）" },
    { ja: "少なく、しかし熟したものを。", orig: "Pauca sed matura.", who: "カール・フリードリヒ・ガウス", src: "ガウスの印章の標語" },
    { ja: "論理によって証明し、直観によって発見する。", orig: "C'est par la logique qu'on démontre, c'est par l'intuition qu'on invente.", who: "アンリ・ポアンカレ", src: "ポアンカレの言葉として広く知られる（『科学と方法』などの論考）" },
    { ja: "整数は神が作った。ほかはすべて人間の業である。", orig: "Die ganzen Zahlen hat der liebe Gott gemacht, alles andere ist Menschenwerk.", who: "レオポルト・クロネッカー", src: "H. ウェーバーが伝える講演中の言葉（1886）" },
    { ja: "私はこの命題の真に驚くべき証明を見つけたが、この余白はそれを書くには狭すぎる。", orig: "Cuius rei demonstrationem mirabilem sane detexi. Hanc marginis exiguitas non caperet.", who: "ピエール・ド・フェルマー", src: "ディオファントス『算術』の余白への書き込み（1637 年頃）。証明されたのは 1995 年。" },
    { ja: "数学で進歩したいなら、弟子ではなく巨匠に学ぶべきだと私には思える。", orig: "It appears to me that if one wishes to make progress in mathematics, one should study the masters and not the pupils.", who: "ニールス・ヘンリク・アーベル", src: "アーベルのノートの余白の書き込みとして伝えられる（伝承）" },
    { ja: "魂において詩人でなければ、数学者であることはできない。", orig: "It is impossible to be a mathematician without being a poet in soul.", who: "ソフィア・コワレフスカヤ", src: "回想（書簡）より" }
  ];
  const quoteHTML = (q, label) => `<figure class="quote"><figcaption class="quote-l">${esc(label || "数学者の言葉")}</figcaption><blockquote><p class="quote-ja">${esc(q.ja)}</p><p class="quote-o">${esc(q.orig)}</p></blockquote><p class="quote-who">— ${esc(q.who)}<span>${esc(q.src)}</span></p></figure>`;
  let qi = Math.floor(Math.random() * QUOTES.length);
  const nextQuote = () => QUOTES[qi++ % QUOTES.length];
  const quoteOfDay = () => QUOTES[[...today()].reduce((s, c) => s + c.charCodeAt(0), 0) % QUOTES.length];

  // ───── トースト ─────
  function toast(msg) {
    let el = $("#wk-toast"); if (!el) { el = document.createElement("div"); el.id = "wk-toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.textContent = msg; el.classList.add("show"); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("show"), 3200);
  }

  // ───── 記録 ─────
  function record({ ok, term, unit }) {
    const k = today(), d = day(k), info = { ok, prevStreak: S.streak, term };
    d.n++; if (ok) d.ok++;
    if (ok) { S.streak++; if (S.streak > S.best) S.best = S.streak; } else { info.broke = S.streak; S.streak = 0; }
    if (term) {
      const cur = S.srs[term]; info.srsPrev = cur ? { ...cur } : null;
      if (!ok) S.srs[term] = { box: 0, due: k };
      else if (cur && cur.due <= k) { const box = cur.box + 1; if (box > INTERVALS.length) delete S.srs[term]; else S.srs[term] = { box, due: addDays(k, INTERVALS[box - 1]) }; info.promoted = box; }
    }
    if (!d.hit && d.n >= S.goal) { d.hit = true; info.goalHit = true; }
    info.streak = S.streak; info.best = S.best; save();
    if (info.goalHit) toast(`今日の目標 ${S.goal} 問を達成しました。連続 ${dayStreak()} 日`);
    else if (ok && MILESTONES.includes(S.streak)) toast(`${S.streak} 連勝！`);
    if (!ok) info.quote = nextQuote();
    return info;
  }
  // 「自分の答えも正しい」で誤答を取り消す
  function fix(info) {
    const d = day(today()); d.ok++;
    S.streak = info.prevStreak + 1; if (S.streak > S.best) S.best = S.streak;
    if (info.term) { if (info.srsPrev) S.srs[info.term] = info.srsPrev; else delete S.srs[info.term]; }
    save(); return { ok: true, streak: S.streak, best: S.best };
  }
  function fbHTML(info) {
    if (info.ok) return `<p class="streak-line"><b>連勝 ${info.streak}</b>${info.streak === info.best && info.streak > 1 ? "（自己ベスト更新中）" : `（ベスト ${info.best}）`}${info.promoted ? `・復習 ${info.promoted}/${INTERVALS.length} 段階目クリア` : ""}</p>`;
    return `${info.broke >= 3 ? `<p class="streak-line ng">連勝は ${info.broke} で止まりました。また 1 から積み上げましょう。</p>` : ""}${info.quote ? quoteHTML(info.quote) : ""}`;
  }
  function dayStreak() {
    let k = today(); if (!(S.days[k] && S.days[k].hit)) k = addDays(k, -1);
    let n = 0; while (S.days[k] && S.days[k].hit) { n++; k = addDays(k, -1); }
    return n;
  }
  const valid = id => window.TERMS && window.TERMS.some(t => t.id === id);
  const due = () => Object.entries(S.srs).filter(([id, s]) => s.due <= today() && valid(id)).sort((a, b) => a[1].due.localeCompare(b[1].due)).map(([id]) => id);
  const dueWithin = n => Object.entries(S.srs).filter(([id, s]) => valid(id) && diffDays(s.due, today()) > 0 && diffDays(s.due, today()) <= n).length;
  function seed(ids) { let ch = false; ids.forEach(id => { if (!S.srs[id]) { S.srs[id] = { box: 0, due: today() }; ch = true; } }); if (ch) save(); }

  // ───── おすすめ ─────
  function recommendations() {
    const recs = [], APP = window.WK_APP, PB = window.WK_PROBLEMS, MQ = window.WK_MONDAI;
    const d = due();
    if (d.length) recs.push({ title: `復習 ${d.length} 語`, why: "間違えた用語の復習日が来ています。間隔をあけて思い出すと記憶が定着します。", btn: "復習を始める", act: () => APP.startDrill({ ids: d.slice(0, 20) }) });
    const st = MQ && MQ.stats ? MQ.stats() : {}, units = PB ? PB.U : [];
    const weak = units.filter(u => st[u.id] && st[u.id].n >= 3 && st[u.id].ok / st[u.id].n < 0.7 && u.lv <= Math.min(4, S.lv + 1)).sort((a, b) => st[a.id].ok / st[a.id].n - st[b.id].ok / st[b.id].n)[0];
    if (weak) recs.push({ title: `苦手克服：${weak.name}`, why: `問題集の正答率が ${Math.round(100 * st[weak.id].ok / st[weak.id].n)}% です。もう一度挑戦しましょう。`, btn: "問題を解く", act: () => MQ.open(weak.id) });
    const ulv = Math.min(4, S.lv), fresh = units.filter(u => u.lv === ulv && !st[u.id] && u !== weak);
    if (fresh.length) { const u = fresh[0]; recs.push({ title: `新しい単元：${u.name}`, why: `学習中のレベル（Lv${S.lv}）でまだ解いていない単元です。${u.desc}。`, btn: "問題を解く", act: () => MQ.open(u.id) }); }
    if (APP) {
      const seen = APP.seen(), unseen = window.TERMS.filter(t => t.lv === S.lv && !seen[t.id]);
      if (unseen.length) { const pickN = unseen.sort(() => Math.random() - 0.5).slice(0, 8); recs.push({ title: `新しい用語 ${pickN.length} 語`, why: `Lv${S.lv} でまだ開いていない用語が ${unseen.length} 語あります。読み・定義・語源から出題します。`, btn: "覚え始める", act: () => APP.startDrill({ ids: pickN.map(t => t.id) }) }); }
    }
    if (S.lv >= 4 && units.length) { const pu = units.filter(u => u.proof).find(u => !st[u.id]) || units.find(u => u.id === "kinou_mon"); if (pu) recs.push({ title: `証明に挑戦：${pu.name}`, why: "穴埋めで要所を確かめ、模範解答と比べて自己採点します。", btn: "証明する", act: () => MQ.open(pu.id) }); }
    if (!recs.length) recs.push({ title: `Lv${S.lv} を 10 問`, why: "まずは今のレベルの用語から始めましょう。", btn: "練習する", act: () => APP.startDrill({ lv: S.lv }) });
    return recs.slice(0, 4);
  }

  // ───── 今日の画面 ─────
  function renderHome() {
    const root = $("#today-root"); if (!root) return;
    const k = today(), d = S.days[k] || { n: 0, ok: 0 }, pct = Math.min(100, Math.round(100 * d.n / S.goal)), ds = dayStreak(), dd = due();
    const week = Array.from({ length: 7 }, (_, i) => { const kk = addDays(k, i - 6), x = S.days[kk] || { n: 0, hit: false }; return { kk, n: x.n, hit: x.hit }; });
    const wmax = Math.max(S.goal, ...week.map(w => w.n));
    const LV = window.LEVELS || [];
    const recs = recommendations();
    root.innerHTML = `
      <div class="hm-stats">
        <div class="hm-card hm-goal"><p class="hm-l">今日の目標</p><p class="hm-big">${d.n}<small> / ${S.goal} 問</small></p>
          <div class="hm-bar${d.n >= S.goal ? " done" : ""}"><i style="width:${pct}%"></i></div>
          <p class="hm-s">${d.n >= S.goal ? "達成しました。この調子で続けましょう。" : `あと ${S.goal - d.n} 問で達成`}</p></div>
        <div class="hm-card"><p class="hm-l">連続達成</p><p class="hm-big">${ds}<small> 日</small></p><p class="hm-s">目標を達成した日が続いた日数</p></div>
        <div class="hm-card"><p class="hm-l">連勝ストリーク</p><p class="hm-big">${S.streak}<small> 連勝</small></p><p class="hm-s">自己ベスト ${S.best}</p></div>
      </div>

      <section class="hm-sec"><h3>これから復習</h3>
        ${dd.length ? `<p>今日復習する用語が <b>${dd.length}</b> 語あります。</p><div class="chips">${dd.slice(0, 16).map(id => { const t = window.TERMS.find(x => x.id === id); return `<button class="chip ng" data-term="${id}">${esc(t.t)}</button>`; }).join("")}${dd.length > 16 ? `<span class="muted">ほか ${dd.length - 16} 語</span>` : ""}</div>
          <div class="fb-act"><button class="btn primary" id="hm-review">今日の復習を始める（${Math.min(20, dd.length)} 語）</button></div>`
          : `<p class="muted">今日が期限の復習はありません。間違えた用語は 1 → 3 → 7 → 14 → 30 日の間隔で復習に戻ってきます。</p>`}
        <p class="hm-up">この先の復習：明日 ${dueWithin(1)} 語・3 日以内 ${dueWithin(3)} 語・1 週間以内 ${dueWithin(7)} 語</p>
      </section>

      <section class="hm-sec"><h3>おすすめ</h3><div class="hm-recs">${recs.map((r, i) => `<div class="hm-rec"><p class="hm-rt">${esc(r.title)}</p><p class="hm-rw">${esc(r.why)}</p><button class="btn" data-rec="${i}">${esc(r.btn)}</button></div>`).join("")}</div></section>

      <section class="hm-sec"><h3>目標設定</h3>
        <div class="ctrl">
          <label for="hm-goal">1 日の問題数<select id="hm-goal">${[5, 10, 20, 30, 50, 100].map(n => `<option value="${n}" ${n === S.goal ? "selected" : ""}>${n} 問</option>`).join("")}</select></label>
          <label for="hm-lv">学習中のレベル<select id="hm-lv">${LV.map(L => `<option value="${L.lv}" ${L.lv === S.lv ? "selected" : ""}>Lv${L.lv} ${L.name}</option>`).join("")}</select></label>
        </div>
        <p class="hm-s">練習問題と問題集の解答数を合わせて数えます。レベルはおすすめの選び方に使います。</p>
        <div class="hm-week" aria-label="直近 7 日の解答数">${week.map(w => `<div class="hm-day${w.hit ? " hit" : ""}${w.kk === k ? " today" : ""}"><span class="hm-dn">${w.n}</span><i style="height:${Math.round(56 * w.n / wmax)}px"></i><span class="hm-dl">${w.kk.slice(8)}日</span></div>`).join("")}<div class="hm-gl" style="bottom:${22 + Math.round(56 * S.goal / wmax)}px" title="目標"></div></div>
      </section>

      <section class="hm-sec">${quoteHTML(quoteOfDay(), "今日の名言")}</section>`;
    $("#hm-goal").onchange = e => { S.goal = +e.target.value; const dd2 = day(k); dd2.hit = dd2.n >= S.goal; save(); renderHome(); };
    $("#hm-lv").onchange = e => { S.lv = +e.target.value; save(); renderHome(); };
    const rv = $("#hm-review"); if (rv) rv.onclick = () => window.WK_APP.startDrill({ ids: dd.slice(0, 20) });
    root.querySelectorAll("[data-rec]").forEach(b => b.onclick = () => recs[+b.dataset.rec].act());
  }
  // 復習タブ用の予定表
  function renderSchedule() {
    const el = $("#review-sched"); if (!el) return;
    const rows = Object.entries(S.srs).filter(([id]) => valid(id)).sort((a, b) => a[1].due.localeCompare(b[1].due));
    if (!rows.length) { el.innerHTML = ""; return; }
    const k = today();
    el.innerHTML = `<h3 class="sched-h">これから復習（予定）</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>用語</th><th>次の復習</th><th class="num">段階</th></tr></thead><tbody>${rows.slice(0, 60).map(([id, s]) => { const t = window.TERMS.find(x => x.id === id), dd = diffDays(s.due, k); return `<tr><td><button class="linkish" data-term="${id}">${esc(t.t)}</button></td><td>${dd <= 0 ? "<b>今日</b>" : dd === 1 ? "明日" : `${dd} 日後`}（${s.due.slice(5).replace("-", "/")}）</td><td class="num">${s.box}/${INTERVALS.length}</td></tr>`; }).join("")}</tbody></table></div>`;
  }

  window.WK_PROGRESS = { record, fix, fbHTML, due, seed, renderHome, renderSchedule, settings: () => ({ goal: S.goal, lv: S.lv }), QUOTES };
})();
