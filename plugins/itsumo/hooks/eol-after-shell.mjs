// PostToolUse フック（Bash / PowerShell）: ファイルを書き換えるシェルコマンド（sed、awk、perl、python、リダイレクト、
// Set-Content など）は違う改行を残しうる（PowerShell は CRLF で書く）が、eol-after-edit.mjs はファイルツールしか見ない。
// そうしたコマンドの後、変更・新規ファイルのうち改行が .gitattributes の求めと違うものを、直すコマンドと一緒に
// エージェントへ返す（exit 2 で stderr が届く）。他のコマンドは調べないので、普段の呼び出しは速いまま。
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadConfig, projectRoot } from '../lib/config.mjs';
import { badEol } from '../lib/eol.mjs';
import { git, worktreeRoots } from '../lib/git.mjs';

const REWRITES = /\b(?:sed|awk|perl|python3?|tee|Set-Content|Out-File|Add-Content|WriteAllText)\b|(?<![<>=\d&|-])>{1,2}(?!&)\s*[^\s&|]|node\s+(?:-e|\S*\.(?:cjs|mjs|js))/;
const FIXER = fileURLToPath(new URL('../lib/fix-eol.mjs', import.meta.url));

export function rewritesFiles(command) {
  return typeof command === 'string' && REWRITES.test(command);
}

function listing(root) {
  // 変更された追跡ファイルと新規ファイルだけ。ツリー全体は一覧しない。
  return [git(root, ['ls-files', '--eol', '--modified']), git(root, ['ls-files', '--eol', '--others', '--exclude-standard'])].join('\n');
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
let raw = '';
if (isMain) process.stdin.on('data', (c) => (raw += c));
if (isMain)
  process.stdin.on('end', () => {
    try {
      const project = projectRoot();
      if (!loadConfig(project).eol) return;
      if (!rewritesFiles(JSON.parse(raw || '{}')?.tool_input?.command)) return;
      const roots = worktreeRoots(project);
      const bad = roots.flatMap((root, i) => badEol(listing(root)).map((b) => `${i === 0 ? b.path : `${root}/${b.path}`}  (${b.want} にする)`));
      if (!bad.length) return;
      process.stderr.write(`次のファイルの改行が .gitattributes の指定と違う。今すぐ node "${FIXER}" <path>... で直すこと:\n${bad.slice(0, 20).join('\n')}\n`);
      process.exitCode = 2;
    } catch {
      // 作業は決して止めない。
    }
  });
