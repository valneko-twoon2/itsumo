// PreToolUse フック（Bash / PowerShell）: `git commit` と `gh pr create/edit` のコマンドに、Claude Code の署名行
// （`Co-Authored-By: Claude ...`、`Generated with [Claude Code]`）が入っていたら実行前に止め、外して出し直させる。
// プラグインは settings.json の `attribution` を設定できないので、その代わりにこのフックで強制する。
// `.claude/itsumo.json` の `attribution: true` で止める（署名を付けたいプロジェクト向け）。
import { pathToFileURL } from 'node:url';
import { loadConfig, projectRoot } from '../lib/config.mjs';

const COMMITS = /\bgit\b[^|;&\n]*\bcommit\b|\bgh\s+pr\s+(?:create|edit)\b/;
const SIGNATURE = /Co-Authored-By:\s*Claude|Generated with \[?Claude Code/i;

/** コマンドが署名行を含む commit / PR の作成か。 */
export function hasSignature(command) {
  return typeof command === 'string' && COMMITS.test(command) && SIGNATURE.test(command);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
let raw = '';
if (isMain) process.stdin.on('data', (c) => (raw += c));
if (isMain)
  process.stdin.on('end', () => {
    try {
      if (loadConfig(projectRoot()).attribution) return;
      if (!hasSignature(JSON.parse(raw || '{}')?.tool_input?.command)) return;
      process.stderr.write('このプロジェクトではコミットと PR に Claude の署名行（Co-Authored-By: Claude ...、Generated with Claude Code）を付けない。その行を外して、もう一度実行すること。\n');
      process.exitCode = 2;
    } catch {
      // 作業は決して止めない。
    }
  });
