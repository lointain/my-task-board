import fs from "node:fs";
import path from "node:path";
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}
const used = new Set();
for (const f of walk("src")) {
  const t = fs.readFileSync(f, "utf8");
  for (const m of t.matchAll(/(?<![A-Za-z])t\("([^"]+)"/g)) used.add(m[1]);
}
function keysOf(file, marker) {
  const text = fs.readFileSync(file, "utf8");
  const slice = text.slice(text.indexOf(marker), text.indexOf("\n};", text.indexOf(marker)));
  const keys = new Set();
  const lines = slice.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s{2}(?:"([^"]+)"|([^\s:][^:]*?))\s*:\s*(.*)$/);
    if (!m) continue;
    keys.add(m[1] ?? m[2].trim());
  }
  return keys;
}
const en = keysOf("src/lib/i18n.ts", "const EN");
const ja = keysOf("src/lib/locales/ja.ts", "export const JA");
const missingEn = [...used].filter((k) => !en.has(k));
const missingJa = [...used].filter((k) => !ja.has(k));
console.log(`used=${used.size} en=${en.size} ja=${ja.size}`);
console.log("missing EN:", JSON.stringify(missingEn));
console.log("missing JA:", JSON.stringify(missingJa));
if (missingEn.length > 0 || missingJa.length > 0) {
  console.error("i18n: 有未翻译的文案，请在 EN / JA 字典中补齐。");
  process.exitCode = 1;
}
