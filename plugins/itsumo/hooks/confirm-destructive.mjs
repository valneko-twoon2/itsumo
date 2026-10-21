// PreToolUse フック（Bash / PowerShell）: 取り返しのつかないコマンド（再帰的な削除、強制 push、reset --hard、
// clean -f、ブランチの強制削除、作業ツリーの変更の破棄、stash の削除、テーブルの DROP / TRUNCATE）を、実行前に
// ユーザーへ確認させる（permissionDecision: "ask"）。エージェントには止めずに理由を見せ、判断はユーザーがする。
// 生成物のフォルダ（`destructive.safeDirs`）だけを消す rm は確認しない。`.claude/itsumo.json` の
// `destructive.confirm: false` か ITSUMO_DISABLE=destructive で止める。
import { basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadConfig, projectRoot } from '../lib/config.mjs';

// 1 つのコマンドの範囲（パイプや && の手前まで）。
const ARGS = String.raw`[^|;&\n]*`;
const RULES = [
  [new RegExp(String.raw`\bgit\b${ARGS}\bpush\b${ARGS}(?:\s--force(?!-with-lease)\b|\s-[a-zA-Z]*f\b|\s\+[^\s]+)`), 'git push の強制（リモートの履歴を上書きする）'],
  [new RegExp(String.raw`\bgit\b${ARGS}\breset\b${ARGS}\s--hard\b`), 'git reset --hard（未コミットの変更を捨てる）'],
  [new RegExp(String.raw`\bgit\b${ARGS}\bclean\b${ARGS}\s-[a-zA-Z]*f`), 'git clean -f（未追跡のファイルを消す）'],
  [new RegExp(String.raw`\bgit\b${ARGS}\bbranch\b${ARGS}(?:\s-D\b|\s--delete\b${ARGS}\s--force\b)`), 'git branch -D（マージしていないブランチも消す）'],
  [new RegExp(String.raw`\bgit\b${ARGS}\b(?:checkout|restore)\s+(?:--\s+)?\.(?=\s|$|[|;&])`), '作業ツリーの変更をすべて捨てる'],
  [new RegExp(String.raw`\bgit\b${ARGS}\bstash\s+(?:drop|clear)\b`), 'stash の削除'],
  [/\b(?:DROP\s+(?:TABLE|DATABASE|SCHEMA)|TRUNCATE(?:\s+TABLE)?\s+\w)/i, 'テーブルやデータベースの削除'],
];
const RECURSIVE_RM = [
  /\brm\s+(?:-[a-zA-Z]*[rR][a-zA-Z]*|--recursive)\b/,
  /\bRemove-Item\b.*\s-Recurse\b/i,
  /\b(?:rmdir|rd)\s+\/s\b/i,
  /\bdel\s+(?:\/[a-z]\s+)*\/s\b/i,
];

/** 1 つのコマンドの削除先が、すべて生成物のフォルダか。フラグ（`-r`、`-Recurse`、`/s`）は削除先に数えない。 */
function onlySafeTargets(segment, safeDirs) {
  const targets = segment.trim().split(/\s+/).slice(1).filter((a) => !a.startsWith('-') && !/^\/[a-z]$/i.test(a));
  const names = targets.map((a) => basename(a.replace(/^["']|["']$/g, '').replace(/[\\/]+$/, '')));
  return names.length > 0 && names.every((n) => safeDirs.includes(n));
}

/** 確認が要るなら、その理由。要らなければ null。 */
export function destructiveReason(command, safeDirs = []) {
  if (typeof command !== 'string') return null;
  for (const [re, why] of RULES) if (re.test(command)) return why;
  for (const segment of command.split(/&&|\|\||;|\||\n/)) {
    if (RECURSIVE_RM.some((re) => re.test(segment)) && !onlySafeTargets(segment, safeDirs)) return '再帰的な削除';
  }
  return null;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
let raw = '';
if (isMain) process.stdin.on('data', (c) => (raw += c));
if (isMain)
  process.stdin.on('end', () => {
    try {
      const { destructive } = loadConfig(projectRoot());
      if (!destructive.confirm) return;
      const command = JSON.parse(raw || '{}')?.tool_input?.command;
      const why = destructiveReason(command, destructive.safeDirs);
      if (!why) return;
      const reason = `itsumo: 取り返しのつかない操作（${why}）なので、実行前に確認する。対象と戻し方を確かめてから許可すること（itsumo:handling-destructive-operations）。`;
      process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: reason } }));
    } catch {
      // フック自体の失敗で作業を止めない。
    }
  });
