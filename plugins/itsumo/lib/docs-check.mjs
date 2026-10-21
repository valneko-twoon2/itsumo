// リポジトリを説明する文書を、リポジトリと食い違わないよう機械で保つ（itsumo:docs-sync スキル）。フォルダは
// .claude/itsumo.json の `docs`（既定は docs/architecture と docs/design）で決まり、存在しないフォルダは調べない。
//
//   node docs-check.mjs                  マップの入口ページがトップレベルのフォルダをすべて挙げているか。マップと設計ページが
//                                        バッククォートで書いたリポジトリのパスと相対リンクが実在するか。ページが小さいか。
//                                        設計ページごとに、ファイルに当たる `covers:` があり、索引に載っているか
//   node docs-check.mjs --staged         加えて、ステージしたコードを扱う設計ページがコミットに入っていなければ警告する
//   node docs-check.mjs --find <path>... 各パスを扱う設計ページ（変更する前に読む）
//
// ページの中身が正しいかは分からない。問いを突きつけるだけ: 新しいトップレベルのフォルダはマップが挙げるまで落ち、
// 移したファイルは指していたページを直すまで落ち、設計ページが扱うコードを変えるとそのページがまだ正しいかを聞く。
import { existsSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadConfig } from '../lib/config.mjs';
import { git } from '../lib/git.mjs';

/** これらの変更では設計ページを求めない: テスト、そのデータ、文書そのもの。 */
const NOT_CODE = /(^docs\/|\.test\.|\.spec\.|\/tests?\/|\/e2e\/|__snapshots__|\.md$)/;

/** 追跡ファイルのうち、`prefix` 直下にあるフォルダの名前。 */
function foldersUnder(files, prefix) {
  const names = new Set();
  for (const f of files) {
    if (!f.startsWith(prefix)) continue;
    const rest = f.slice(prefix.length);
    const i = rest.indexOf('/');
    if (i > 0) names.add(rest.slice(0, i));
  }
  return [...names].sort();
}

/** ページがバッククォートで書いたリポジトリのパス: 空白が無く、スラッシュを含み、先頭がトップレベルの項目のもの。 */
export function pathsIn(body, topLevel) {
  const out = new Set();
  for (const [, span] of body.replace(/```[\s\S]*?```/g, '').matchAll(/`([^`\n]+)`/g)) {
    if (/\s/.test(span) || !span.includes('/') || /^[a-z]+:/i.test(span)) continue;
    const clean = span.replace(/^\.\//, '').replace(/[<*{].*$/, '').replace(/[.,;:]+$/, '');
    if (clean && topLevel.has(clean.split('/')[0])) out.add(clean);
  }
  return [...out];
}

/** ページの Markdown リンクの相対的な行き先（Web アドレスとアンカーは除く）。 */
export function linksIn(body) {
  return [...body.replace(/```[\s\S]*?```/g, '').matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1].replace(/#.*$/, '')).filter((t) => t && !/^[a-z]+:/i.test(t));
}

/** 設計ページのフロントマターの `covers` 一覧。無ければ null。 */
export function coversOf(body) {
  const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(body);
  if (!front) return null;
  const list = [];
  let inList = false;
  for (const line of front[1].split(/\r?\n/)) {
    if (/^covers:\s*$/.test(line)) inList = true;
    else if (inList) {
      const item = /^\s+-\s+["']?(\S.*?)["']?\s*$/.exec(line);
      if (item) list.push(item[1]);
      else if (/^\S/.test(line)) inList = false;
    }
  }
  return list;
}

/** `path` が `entry` に当たるか: ファイルそのもの、フォルダ、またはグロブ（`**` はフォルダをまたぐ、`*` はまたがない）。 */
export function covers(entry, path) {
  if (!entry.includes('*')) return path === entry || path.startsWith(`${entry.replace(/\/$/, '')}/`);
  const source = entry
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '\u0000')
    .replace(/\*\*/g, '\u0001')
    .replace(/\*/g, '[^/]*')
    .replace(/\u0000/g, '(?:.*/)?')
    .replace(/\u0001/g, '.*');
  return new RegExp(`^${source}$`).test(path);
}

function designPagesOf(files, design) {
  return files.filter((f) => f.startsWith(`${design}/`) && f.endsWith('.md') && f !== `${design}/README.md` && !f.slice(design.length + 1).includes('/'));
}

/** すべての設計ページの `[{ page, covers }]`。 */
export function designCovers(files, read, design) {
  return designPagesOf(files, design).map((page) => ({ page, covers: coversOf(read(page) ?? '') ?? [] }));
}

/** ツリーに対する文書の問題。1 件 1 行で、直すページを名指しする。 */
export function structureProblems(files, read, docs) {
  const problems = [];
  const text = (path) => read(path) ?? '';
  const { map, design, entryLimit, pageLimit } = docs;
  const tracked = new Set(files);
  const exists = (path) => tracked.has(path) || files.some((f) => f.startsWith(`${path}/`));
  const topLevel = new Set(files.map((f) => f.split('/')[0]));
  const mapPages = map ? files.filter((f) => f.startsWith(`${map}/`) && f.endsWith('.md')) : [];
  const designPages = design ? designPagesOf(files, design) : [];
  const entry = `${map}/README.md`;

  if (map && tracked.has(entry)) {
    const body = text(entry);
    for (const name of foldersUnder(files, '')) {
      if (name.startsWith('.')) continue;
      if (!body.includes(`${name}/`)) problems.push(`${entry}: トップレベルのフォルダ "${name}/" に触れていない。何のフォルダかを 1 行で書くこと`);
    }
  }

  const index = design && tracked.has(`${design}/README.md`) ? [`${design}/README.md`] : [];
  for (const page of [...mapPages, ...designPages, ...index]) {
    const body = text(page);
    for (const path of pathsIn(body, topLevel)) {
      if (!exists(path.replace(/\/$/, ''))) problems.push(`${page}: パス "${path}" を挙げているが存在しない。ページを直すか項目を消すこと`);
    }
    for (const target of linksIn(body)) {
      const resolved = posix.normalize(posix.join(posix.dirname(page), target)).replace(/\/$/, '');
      if (!exists(resolved)) problems.push(`${page}: リンク先 "${target}" が存在しない`);
    }
  }

  for (const page of mapPages) {
    const size = Buffer.byteLength(text(page));
    const limit = page === entry ? entryLimit : pageLimit;
    if (size > limit) problems.push(`${page}: ${size} バイト（上限 ${limit}）。コード検索で分かること（ファイル一覧）を削り、分からないことを残すこと`);
  }

  const indexBody = index.length ? text(index[0]) : null;
  for (const page of designPages) {
    const list = coversOf(text(page));
    if (!list?.length) problems.push(`${page}: フロントマターに "covers:" 一覧（このページが記述するコードのファイルやフォルダ）が要る`);
    else for (const c of list) if (!files.some((f) => covers(c, f))) problems.push(`${page}: covers の "${c}" がどのファイルにも当たらない。フロントマターを直すこと`);
    const base = page.split('/').pop();
    if (indexBody !== null && !indexBody.includes(base)) problems.push(`${design}/README.md: ページ ${base} が載っていない`);
    const size = Buffer.byteLength(text(page));
    if (size > pageLimit) problems.push(`${page}: ${size} バイト（上限 ${pageLimit}）。機能ごとに分けること`);
  }
  return problems;
}

/** ステージしたパスへの警告: 設計ページが扱うコードが変わったのに、そのページがコミットに無い。 */
export function stagedWarnings(staged, pages) {
  const inCommit = new Set(staged);
  const warnings = [];
  for (const { page, covers: list } of pages) {
    if (inCommit.has(page)) continue;
    const touched = staged.filter((p) => !NOT_CODE.test(p) && list.some((c) => covers(c, p)));
    if (!touched.length) continue;
    const shown = touched.slice(0, 3).join(', ') + (touched.length > 3 ? ` ほか ${touched.length - 3} 件` : '');
    warnings.push(`${page} はこのコミットのコード（${shown}）を扱っている。読み直し、コードの実際と違っていれば直すこと`);
  }
  return warnings;
}

/** `path` を扱う設計ページ。 */
export function pagesCovering(path, pages) {
  const clean = path.replace(/\\/g, '/').replace(/^\.\//, '');
  return pages.filter(({ covers: list }) => list.some((c) => covers(c, clean))).map(({ page }) => page);
}

function main(argv) {
  const root = git(process.cwd(), ['rev-parse', '--show-toplevel']).trim();
  const { docs } = loadConfig(root);
  const files = git(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0').filter((f) => f && existsSync(join(root, f)));
  const read = (path) => (existsSync(join(root, path)) ? readFileSync(join(root, path), 'utf8') : null);
  const pages = docs.design ? designCovers(files, read, docs.design) : [];
  const find = argv.indexOf('--find');
  if (find >= 0) {
    for (const path of argv.slice(find + 1)) {
      const rel = posix.relative(root.replaceAll('\\', '/'), posix.resolve(process.cwd().replaceAll('\\', '/'), path.replaceAll('\\', '/')));
      const hit = pagesCovering(rel, pages);
      console.log(`${rel}: ${hit.length ? hit.join(', ') : '扱う設計ページは無い'}`);
    }
    return 0;
  }
  if (argv.includes('--staged')) {
    const staged = git(root, ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']).split('\0').filter(Boolean);
    for (const w of stagedWarnings(staged, pages)) console.warn(`docs-check（警告）: ${w}`);
  }
  const problems = structureProblems(files, read, docs);
  for (const p of problems) console.error(p);
  console.log(problems.length ? `docs-check: ${problems.length} 件の問題` : 'docs-check: OK');
  return problems.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    console.error(String(e?.stderr || e?.message || e).trim());
    process.exitCode = 1;
  }
}
