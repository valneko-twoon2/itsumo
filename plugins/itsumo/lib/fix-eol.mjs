// 指定したファイルやフォルダに、.gitattributes が求める改行（`eol=lf` / `eol=crlf`）を付ける。eol 属性の無いファイル、
// バイナリ、無視されたファイルには触らない。
//   node fix-eol.mjs <file-or-dir>...        変換する
//   node fix-eol.mjs --check [<path>...]     違うものを一覧するだけ（あれば exit 1）。パス無しはリポジトリ全体
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BINARY_SNIFF_BYTES, badEol, withEol } from '../lib/eol.mjs';
import { git } from '../lib/git.mjs';

function main(argv) {
  const check = argv.includes('--check');
  const paths = argv.filter((a) => a !== '--check').map((p) => resolve(p));
  if (!check && !paths.length) {
    console.error('使い方: node fix-eol.mjs <file-or-dir>... | --check [<path>...]');
    return 2;
  }
  const top = git(process.cwd(), ['rev-parse', '--show-toplevel']).trim();
  const bad = badEol(git(top, ['ls-files', '--eol', '--cached', '--others', '--exclude-standard', '--', ...paths]));
  if (check) {
    for (const b of bad) console.error(`${b.path}  (${b.want} にする)`);
    console.log(bad.length ? `eol: ${bad.length} 件が違う` : 'eol: OK');
    return bad.length ? 1 : 0;
  }
  let changed = 0;
  for (const b of bad) {
    const file = resolve(top, b.path);
    const bytes = readFileSync(file);
    if (bytes.subarray(0, BINARY_SNIFF_BYTES).includes(0)) continue;
    const text = bytes.toString('utf8');
    const fixed = withEol(text, b.want);
    if (fixed !== text) {
      writeFileSync(file, fixed);
      changed++;
      console.log(`${b.path} -> ${b.want}`);
    }
  }
  console.log(`eol: ${changed} 件を変換した`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    console.error(String(e?.stderr || e?.message || e).trim());
    process.exitCode = 1;
  }
}
