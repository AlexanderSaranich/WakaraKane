// データの整合性チェック：node tools/check.js
// 用語 ID の重複・関連語・漢字表・存在理由・問題集・学習リンク・問題の自己採点を確かめる。
"use strict";
const path = require("path");
global.window = {}; global.document = {};
const root = path.join(__dirname, "..");
for (const f of ["data", "kanji", "questions", "school1", "school2", "school3", "univ4", "univ5", "univ6",
  "levels", "motive1", "motive2", "motive3", "termprob", "sitelinks", "problems"]) require(path.join(root, f + ".js"));

const { TERMS, KANJI, PRACTICE, MOTIVE, TERM_PROBLEMS, SITE_LINKS, LEVEL_INFO, WK_PROBLEMS: W } = window;
const errors = [], warn = m => errors.push(m);
const ids = new Set();
for (const t of TERMS) { if (ids.has(t.id)) warn(`重複した ID: ${t.id}`); ids.add(t.id); }
for (const t of TERMS) {
  for (const r of t.rel || []) if (!ids.has(r)) warn(`${t.id}: 関連語 ${r} が存在しない`);
  for (const c of t.t) if (/\p{Script=Han}/u.test(c) && !KANJI[c]) warn(`${t.id}: 漢字「${c}」が kanji.js にない`);
  if (!MOTIVE[t.id]) warn(`${t.id}: 「なぜこの用語があるのか」がない`);
  if (!W.hasProblems(t.id)) warn(`${t.id}: 問題集の問題がない`);
  if (!/^[ぁ-ゟー]+$/.test(t.r)) warn(`${t.id}: 読みがひらがなでない（${t.r}）`);
}
for (const p of PRACTICE) if (!ids.has(p.term)) warn(`実践問題の term ${p.term} が存在しない`);
for (const k of Object.keys(TERM_PROBLEMS)) if (!ids.has(k)) warn(`termprob.js の ${k} が存在しない`);
for (const k of Object.keys(SITE_LINKS)) if (!ids.has(k)) warn(`sitelinks.js の ${k} が存在しない`);
for (const [lv, info] of Object.entries(LEVEL_INFO)) for (const k of info.key) if (!ids.has(k)) warn(`levels.js Lv${lv} の ${k} が存在しない`);

// 問題の自己採点：用意した答えが採点器で正解になるか
let fixed = 0;
for (const t of TERMS) for (const it of W.termItems(t.id)) {
  if (!it.fixed) continue; fixed++;
  const p = it.fixed, ans = p.type === "tset" ? p.a.map(x => x[0]).join("、") : p.type === "text" ? p.a[0] : String(p.a);
  if (!W.check(ans, p).ok) warn(`${t.id}: 問題「${p.q.slice(0, 30)}…」の模範解答が正解にならない`);
}
let gen = 0;
for (const u of W.U) {
  if (u.proof) continue;
  for (let i = 0; i < 200; i++) {
    const p = u.gen(); gen++;
    const ans = p.show.replace(/（.*?）/g, "").replace(/^f′\(x\) = /, "");
    if (!W.check(ans, p).ok) { warn(`単元 ${u.id}: 生成問題「${p.q}」が表示した答え「${p.show}」で正解にならない`); break; }
  }
}
for (const list of Object.values(W.PROOFS)) for (const pr of list) for (const s of pr.steps)
  if (!W.check(s.show, { type: s.type || "expr", a: s.a, exact: s.exact }).ok) warn(`証明「${pr.title}」の穴埋め答え ${s.show} が正解にならない`);

const byLv = TERMS.reduce((o, t) => (o[t.lv] = (o[t.lv] || 0) + 1, o), {});
console.log(`用語 ${TERMS.length}（${Object.entries(byLv).map(([l, n]) => `Lv${l}:${n}`).join(" ")}）／漢字 ${Object.keys(KANJI).length}`);
console.log(`問題集 ${W.U.length} 単元／用語別に確認した固定問題 ${fixed}／生成問題 ${gen} 題を検査`);
console.log(`学習リンクのある用語 ${Object.keys(SITE_LINKS).length}／歴史つきの存在理由 ${Object.values(MOTIVE).filter(m => m.hist).length}`);
if (errors.length) { console.error(`\n${errors.length} 件の問題:\n- ` + errors.join("\n- ")); process.exit(1); }
console.log("\nすべてのチェックに合格しました。");
