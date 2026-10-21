// PostToolUse フック（Write / Edit / MultiEdit）: ファイルツールは LF で書くので、.gitattributes の求めと違う改行の
// ファイルができることがある（CRLF 指定のリポジトリで新しい .bat が LF になる）。編集直後にそのファイルを変換する。
// 触るのはリポジトリ（かそのワークツリー）の中で eol 属性が付いたファイルだけで、バイナリには触らない。
// ツール呼び出しを失敗させることはない。
import { readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadConfig, projectRoot } from '../lib/config.mjs';
import { eolFromCheckAttr, withEol } from '../lib/eol.mjs';
import { git, rootHolding, worktreeRoots } from '../lib/git.mjs';

function main(input) {
  const file = input?.tool_input?.file_path;
  if (typeof file !== 'string') return;
  const project = projectRoot();
  if (!loadConfig(project).eol) return;
  const path = resolve(project, file);
  const root = rootHolding(path, worktreeRoots(project));
  if (!root) return;
  const rel = relative(root, path).replaceAll('\\', '/');
  if (!rel || rel.startsWith('..') || /(^|\/)\.git\//.test(rel)) return;
  const want = eolFromCheckAttr(git(root, ['check-attr', 'eol', 'text', '--', rel]));
  if (!want) return;
  const bytes = readFileSync(path);
  if (bytes.subarray(0, 8000).includes(0)) return; // バイナリ
  const text = bytes.toString('utf8');
  const fixed = withEol(text, want);
  if (fixed !== text) writeFileSync(path, fixed);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
let raw = '';
if (isMain) process.stdin.on('data', (c) => (raw += c));
if (isMain)
  process.stdin.on('end', () => {
    try {
      main(JSON.parse(raw || '{}'));
    } catch {
      // 無視する: コミット時のチェックが残っている。
    }
  });
