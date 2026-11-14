// Checks the Russian and Polish word lists (src/lib/locales/*.ts) against the sentences the code uses:
//   node scripts/i18n-check.mjs            every sentence has a translation, with the same {placeholders}
//   node scripts/i18n-check.mjs --keys     also prints the sentences (as JSON), for writing a new list
// A sentence is the first text of tr("…"), trn(n, "…", "…"), rich("…", …) or m("…") / mark("…") in src/.
import { readdir, readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const SRC = new URL("src/", root).pathname;

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

/** sentence → { plural: whether it is counted (trn), where: the first place it is used } */
const used = new Map();
const problems = [];
for (const file of await walk(SRC)) {
  if (file.includes("/lib/locales/")) continue;
  const text = await readFile(file, "utf8");
  if (!/\b(tr|trn|rich|m|mark)\(/.test(text)) continue;
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const at = (n) => `${file.replace(SRC, "src/")}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`;
  const literal = (n) => (n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : null);
  const note = (key, plural, n) => {
    const had = used.get(key);
    if (had && had.plural !== plural) problems.push(`${at(n)}: "${key}" is used both as a count (trn) and as a plain sentence (tr)`);
    if (!had) used.set(key, { plural, where: at(n) });
  };
  // Every text a call might hand over: a literal, or either side of a ?: (and so on down).
  const texts = (n, out = []) => {
    if (!n) return out;
    const s = literal(n);
    if (s != null) out.push([s, n]);
    else if (ts.isConditionalExpression(n)) (texts(n.whenTrue, out), texts(n.whenFalse, out));
    else if (ts.isParenthesizedExpression(n)) texts(n.expression, out);
    return out;
  };
  const visit = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
      const name = n.expression.text;
      if (name === "tr" || name === "rich" || name === "m" || name === "mark") for (const [s, node] of texts(n.arguments[0])) note(s, false, node);
      if (name === "trn") {
        const one = literal(n.arguments[1]);
        const other = literal(n.arguments[2]);
        if (one == null || other == null) problems.push(`${at(n)}: trn() needs its two sentences written out`);
        else note(one, true, n);
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

// The lists, run as plain modules.
const dir = await mkdtemp(join(tmpdir(), "hyperanchor-i18n-"));
const lists = {};
for (const lang of ["ru", "pl"]) {
  const src = await readFile(new URL(`src/lib/locales/${lang}.ts`, root), "utf8");
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  await writeFile(join(dir, `${lang}.mjs`), js);
  lists[lang] = (await import(join(dir, `${lang}.mjs`)))[lang];
}
await rm(dir, { recursive: true });

const holes = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
for (const [lang, list] of Object.entries(lists)) {
  for (const [key, { plural, where }] of used) {
    const e = list[key];
    if (e === undefined) { problems.push(`${lang}: missing "${key}" (${where})`); continue; }
    if (plural !== Array.isArray(e)) { problems.push(`${lang}: "${key}" should be ${plural ? "three forms [one, few, many]" : "one sentence"} (${where})`); continue; }
    for (const form of plural ? e : [e]) {
      // A translation may leave a placeholder out (a language can say it without the value), never add one.
      const want = holes(key).split(",").filter(Boolean);
      const extra = holes(form).split(",").filter((h) => h && !want.includes(h) && !(plural && h === "n"));
      if (extra.length) problems.push(`${lang}: "${key}" → "${form}": {${extra.join("}, {")}} is not in the English sentence`);
    }
  }
  for (const key of Object.keys(list)) if (!used.has(key)) problems.push(`${lang}: "${key}" is not used in the code any more`);
}

if (process.argv.includes("--keys")) console.log(JSON.stringify([...used].map(([key, v]) => (v.plural ? [key] : key)), null, 0));
if (problems.length) {
  console.error(problems.join("\n"));
  console.error(`\n${problems.length} problem${problems.length === 1 ? "" : "s"}; ${used.size} sentences in the code.`);
  process.exit(1);
}
console.log(`${used.size} sentences, each in Russian and Polish.`);
