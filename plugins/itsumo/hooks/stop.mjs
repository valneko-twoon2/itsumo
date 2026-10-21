// Stop フック: ファイルを変える作業は、エージェント自身のコミットで終える。作業ツリー（メインのチェックアウトか、その
// いずれかのワークツリー）に変更を残したまま終わろうとしたら、催促を返して（exit 2 で stderr が届く）先にコミットさせるか、
// しない理由を言わせる。セッション開始時からあって内容の変わっていない変更（hooks/snapshot.mjs が記録する）は数えない。すべてコミット済みなら、用済みのワークツリー（きれいでマージ済み、またはフォルダが消えたもの）の
// 削除を求める。催促は停止 1 回につき 1 度だけ: 催促の後の停止（`stop_hook_active`）は止めないので、コミットを断っても
// ループしない。マージ・リベース・チェリーピックの途中や Git リポジトリの外では止めない。
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadConfig, projectRoot } from '../lib/config.mjs';
import { defaultBranch, finished, git, isFresh, parseWorktrees, worktreeRoots } from '../lib/git.mjs';
import { changedSince, dirtyHashes, loadSnapshot } from '../lib/snapshot.mjs';

const WORKTREE = fileURLToPath(new URL('../lib/worktree.mjs', import.meta.url));

/** 返す催促。止まってよいときは null。 */
export function reminder(input, changed, inMerge, leftover = []) {
  if (input?.stop_hook_active || inMerge) return null;
  if (changed.length) {
    const shown = changed.slice(0, 12).join('\n');
    const more = changed.length > 12 ? `\n... ほか ${changed.length - 12} 件` : '';
    return [
      'ファイルを変える作業は自分のコミットで終えること。このセッションの間に変わった未コミットのファイルがある:',
      shown + more,
      '変更に合ったチェックを走らせ（itsumo:regression スキル）、落ちたものを直し、自分のファイルだけを itsumo:commit スキルの形のメッセージでコミットしてから報告すること。',
      '今コミットしてはいけない場合（ユーザーが止めた、自分のファイルではない、直せないチェックが落ちている）は、代わりに報告でそう書くこと。',
    ].join('\n');
  }
  if (leftover.length) {
    return [
      '次のワークツリーは用済み（きれいでマージ済み、またはフォルダが消えている）。今それぞれ削除すること:',
      ...leftover,
      `削除は node "${WORKTREE}" remove <path> で行う。先にリンクしたフォルダを外すので、メインのチェックアウトの中身は消えない。`,
    ].join('\n');
  }
  return null;
}

function inProgress(root) {
  const gitDir = git(root, ['rev-parse', '--absolute-git-dir']).trim();
  return ['MERGE_HEAD', 'rebase-merge', 'rebase-apply', 'CHERRY_PICK_HEAD', 'REVERT_HEAD'].some((f) => existsSync(join(gitDir, f)));
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
let raw = '';
if (isMain) process.stdin.on('data', (c) => (raw += c));
if (isMain)
  process.stdin.on('end', () => {
    try {
      const input = JSON.parse(raw || '{}');
      if (input?.stop_hook_active) return;
      const project = projectRoot();
      const config = loadConfig(project);
      const { stop } = config;
      if (!stop.commit && !stop.worktrees) return;
      git(project, ['rev-parse', '--is-inside-work-tree']);
      const roots = worktreeRoots(project);
      const before = loadSnapshot(input?.session_id);
      let inMerge = false;
      const changed = [];
      roots.forEach((root, i) => {
        inMerge ||= inProgress(root);
        if (!stop.commit) return;
        // セッション開始時と内容が同じファイルは、エージェントの変更ではないので数えない。
        const mine = changedSince(before?.[root] ?? null, dirtyHashes(root, stop.ignore));
        changed.push(...mine.map((p) => (i === 0 ? p : `${root}/${p}`)));
      });
      let leftover = [];
      if (stop.worktrees && !changed.length && roots.length > 1) {
        const base = config.worktree.base || defaultBranch(roots[0]);
        const trees = parseWorktrees(git(roots[0], ['worktree', 'list', '--porcelain']));
        const merged = new Set(git(roots[0], ['branch', '--merged', base, '--format=%(refname:short)']).split(/\r?\n/).map((b) => b.trim()).filter(Boolean));
        leftover = finished(trees, {
          merged,
          dirty: (p) => git(p, ['status', '--porcelain']).trim() !== '',
          missing: (p) => !existsSync(p),
          fresh: isFresh,
        }).map((t) => t.path);
      }
      const text = reminder(input, changed, inMerge, leftover);
      if (!text) return;
      process.stderr.write(`${text}\n`);
      process.exitCode = 2;
    } catch {
      // フック自体の失敗（や Git リポジトリの外）で作業を止めることはしない。
    }
  });
