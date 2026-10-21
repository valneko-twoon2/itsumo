// PostToolUse フック（Agent / Task）: サブエージェントが戻ったとき、このセッションで作られたワークツリーのブランチに、
// 既定ブランチへ未マージのコミットがあれば、取り込む前に itsumo:merging-subagent-work の手順を通すよう、追加コンテキストで
// 思い出させる（報告だけを信じてマージしない）。未マージのものが無ければ何も言わない。失敗しても作業は止めない。
import { pathToFileURL } from 'node:url';
import { loadConfig, projectRoot } from '../lib/config.mjs';
import { defaultBranch, git, parseWorktrees } from '../lib/git.mjs';
import { createdSince, loadSnapshot } from '../lib/snapshot.mjs';

/** 追加コンテキストの文。`branches` は [{branch, path, ahead}]。無ければ null。 */
export function mergeNote(branches, base) {
  if (!branches.length) return null;
  const rows = branches.map((b) => `- ${b.branch}（${b.ahead} コミット。${b.path}）`);
  return [
    `サブエージェントの成果が、${base} にまだマージされていないブランチにある:`,
    ...rows,
    '取り込む前に itsumo:merging-subagent-work の手順を通すこと: 報告を差分と突き合わせ、プロジェクトの決まりを差分に当て、マージした結果でチェックをやり直す。報告だけを根拠にマージしない。',
  ].join('\n');
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
let raw = '';
if (isMain) process.stdin.on('data', (c) => (raw += c));
if (isMain)
  process.stdin.on('end', () => {
    try {
      const input = JSON.parse(raw || '{}');
      const project = projectRoot();
      const config = loadConfig(project);
      if (!config.guide) return;
      const before = loadSnapshot(input?.session_id);
      if (!before) return;
      const trees = parseWorktrees(git(project, ['worktree', 'list', '--porcelain']));
      const base = config.worktree.base || defaultBranch(trees[0].path);
      const mine = createdSince(before, trees.map((t) => t.path), project);
      const branches = [];
      for (const t of trees.filter((x) => mine.includes(x.path) && x.branch)) {
        const ahead = Number(git(trees[0].path, ['rev-list', '--count', `${base}..${t.branch}`]).trim());
        if (ahead > 0) branches.push({ branch: t.branch, path: t.path, ahead });
      }
      const text = mergeNote(branches, base);
      if (text) console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: text } }));
    } catch {
      // フック自体の失敗で作業を止めない。
    }
  });
