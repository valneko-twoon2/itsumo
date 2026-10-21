// PreToolUse フック（Bash / PowerShell）: コミットの前に、次の 2 つを確認させる（permissionDecision: "ask"）。
//  1. `git add -A` / `git add .` / `git commit -a` が、セッションの前からあるユーザー自身の未コミットの変更を巻き込むとき
//     （開始時の記録は hooks/snapshot.mjs が残す）。
//  2. ステージした変更（`git commit -a` なら追跡中の変更すべて、同じコマンドの `git add` のパスも）に、秘密のファイル
//     （.env、鍵）や、形の決まった鍵・トークンが入っているとき。値そのものは表示しない。
// `.claude/itsumo.json` の `protect.stageAll` / `protect.secrets` か ITSUMO_DISABLE=protect で止める。失敗しても作業は止めない。
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadConfig, projectRoot } from '../lib/config.mjs';
import { git } from '../lib/git.mjs';
import { addTargets, addedByFile, commitsAll, isCommit, secretKinds, secretName, stagesEverything } from '../lib/protect.mjs';
import { dirtyHashes, loadSnapshot, snapshotFor, untouchedSince } from '../lib/snapshot.mjs';

// 中身を調べる 1 ファイルの大きさの上限（1 MiB）。これより大きいファイルは名前だけを見る。
const SCAN_MAX_BYTES = 1024 * 1024;
const SHOWN = 5;

const list = (items) => items.slice(0, SHOWN).join('、') + (items.length > SHOWN ? ` ほか ${items.length - SHOWN} 件` : '');

/** ユーザー自身の未コミットの変更を巻き込むなら、その理由。 */
function stageAllReason(input, cwd, ignore) {
  const top = resolve(git(cwd, ['rev-parse', '--show-toplevel']).trim());
  const before = snapshotFor(loadSnapshot(input?.session_id), top);
  if (!before) return null;
  const mine = untouchedSince(before, dirtyHashes(top, ignore));
  if (!mine.length) return null;
  return `セッションの前からあるあなたの未コミットの変更（${list(mine)}）を、このコマンドは丸ごとコミットに入れる。自分の変更だけを、名前を指定してステージすること（itsumo:committing-changes）。`;
}

/** ステージされる変更に秘密が入っていれば、その理由。 */
function secretReason(command, cwd) {
  const found = [];
  const all = commitsAll(command);
  const names = new Set();
  for (const args of [['diff', '--cached', '--name-only', '-z'], ...(all ? [['diff', '--name-only', '-z']] : [])]) {
    for (const n of git(cwd, args).split('\0').filter(Boolean)) names.add(n);
  }
  for (const target of addTargets(command)) {
    const path = resolve(cwd, target);
    if (existsSync(path) && statSync(path).isFile()) names.add(target);
  }
  for (const n of names) if (secretName(n)) found.push(`${n}（秘密を持ちやすいファイル）`);
  let diff = git(cwd, ['diff', '--cached', '-U0']);
  if (all) diff += `\n${git(cwd, ['diff', '-U0'])}`;
  for (const { path, text } of addedByFile(diff)) {
    const kinds = secretKinds(text);
    if (kinds.length) found.push(`${path}（${kinds.join('、')}の形）`);
  }
  for (const target of addTargets(command)) {
    const path = resolve(cwd, target);
    try {
      if (!statSync(path).isFile() || statSync(path).size > SCAN_MAX_BYTES) continue;
      const kinds = secretKinds(readFileSync(path, 'utf8'));
      if (kinds.length && !found.some((f) => f.startsWith(`${target}（`))) found.push(`${target}（${kinds.join('、')}の形）`);
    } catch {
      // 読めないファイルは名前だけで判定済み
    }
  }
  if (!found.length) return null;
  return `コミットに秘密が入っているかもしれない: ${list(found)}。本物の秘密なら、ステージから外し（git restore --staged）、コミットしないこと。見本や偽の値ならそのまま進めてよい。`;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
let raw = '';
if (isMain) process.stdin.on('data', (c) => (raw += c));
if (isMain)
  process.stdin.on('end', () => {
    try {
      const input = JSON.parse(raw || '{}');
      const command = input?.tool_input?.command;
      if (typeof command !== 'string') return;
      const project = projectRoot();
      const { protect, stop } = loadConfig(project);
      const reasons = [];
      const cwd = input?.cwd || project;
      if (protect.stageAll && stagesEverything(command)) reasons.push(stageAllReason(input, cwd, stop.ignore));
      if (protect.secrets && isCommit(command)) reasons.push(secretReason(command, cwd));
      const text = reasons.filter(Boolean).join('\n');
      if (!text) return;
      process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: `itsumo: ${text}` } }));
    } catch {
      // フック自体の失敗で作業を止めない。
    }
  });
