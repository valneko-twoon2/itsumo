// フックとスクリプトが共有する Git の補助。Git ワークツリーでの作業は CLAUDE_PROJECT_DIR の外にあるので、
// そこだけを見るフックには何も見えない。だからどのフックもリポジトリの全ワークツリーを調べる。
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { resolve } from 'node:path';

// ほとんどの Git コマンドは 1 秒以内に終わる。数万ファイルのリポジトリの status でも収まるよう 15 秒まで待つ。
export const GIT_TIMEOUT_MS = 15000;
// 数万ファイルの status や ls-files の出力が収まる大きさ（64 MiB）。
export const GIT_MAX_BUFFER = 64 * 1024 * 1024;
// ワークツリーの作成と削除は、チェックアウトするファイルの量しだいで遅いので 2 分まで待つ。
export const GIT_SLOW_TIMEOUT_MS = 120000;
// 作ってから 1 時間以内で自前のコミットが無いワークツリーは、手つかずの新品とみなして用済みにしない。
// サブエージェントが最初のコミットをするまでの典型的な時間より長く取ってある。
export const FRESH_WORKTREE_MS = 3600_000;

export const git = (cwd, args, timeout = GIT_TIMEOUT_MS) => execFileSync('git', args, { cwd, encoding: 'utf8', timeout, maxBuffer: GIT_MAX_BUFFER, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });

/** `git worktree list --porcelain` の [{path, branch, prunable}]。先頭がメインのチェックアウト、detached HEAD は branch が null。 */
export function parseWorktrees(porcelain) {
  const trees = [];
  for (const block of porcelain.split(/\r?\n\r?\n/)) {
    const lines = block.split(/\r?\n/);
    const path = lines.find((l) => l.startsWith('worktree '))?.slice(9).trim();
    if (!path) continue;
    const branch = lines.find((l) => l.startsWith('branch '))?.slice(7).trim().replace(/^refs\/heads\//, '') ?? null;
    trees.push({ path: resolve(path), branch, prunable: lines.some((l) => l.startsWith('prunable')) });
  }
  return trees;
}

/** `root` のリポジトリの全ワークツリー（メインが先頭）。Git が答えられなければ [root]。例外を投げない。 */
export function worktreeRoots(root) {
  try {
    const found = parseWorktrees(git(root, ['worktree', 'list', '--porcelain'])).map((t) => t.path);
    return found.length ? found : [resolve(root)];
  } catch {
    return [resolve(root)];
  }
}

const norm = (p) => resolve(p).toLowerCase().replaceAll('\\', '/').replace(/\/$/, '');

/** `roots` のうち `file` を含むもの。無ければ null。入れ子のワークツリーに備えて最も長いものを選ぶ。 */
export function rootHolding(file, roots) {
  const f = norm(file);
  let best = null;
  for (const r of roots) {
    const prefix = norm(r);
    if ((f === prefix || f.startsWith(`${prefix}/`)) && (!best || r.length > best.length)) best = r;
  }
  return best;
}

/** 既定ブランチ: origin の HEAD、無ければ main、master、最後に現在のブランチ。 */
export function defaultBranch(root) {
  try {
    return git(root, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']).trim().replace(/^origin\//, '');
  } catch {
    // リモートの HEAD が無い
  }
  for (const name of ['main', 'master']) {
    try {
      git(root, ['rev-parse', '--verify', '--quiet', `refs/heads/${name}`]);
      return name;
    } catch {
      // このブランチは無い
    }
  }
  try {
    return git(root, ['branch', '--show-current']).trim() || 'main';
  } catch {
    return 'main';
  }
}

/** `git status --porcelain` のパス（ステージ済み・変更・新規）のうち、`ignore` の前方一致に当たらないもの。 */
export function pending(porcelain, ignore = []) {
  return porcelain
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.slice(3).replace(/^.* -> /, '').replace(/^"|"$/g, ''))
    .filter((path) => !ignore.some((prefix) => path === prefix.replace(/\/$/, '') || path.startsWith(prefix) || path.includes(`/${prefix}`)));
}

/** 用済みのワークツリー: フォルダが消えているか、きれいでブランチがマージ済み、かつ作ったばかりで自前のコミットが無いもの
 * ではないもの（`fresh`: 作りたてで手つかずのワークツリーは、終わったものと見分けがつかない）。 */
export function finished(trees, { merged, dirty, missing, fresh = () => false }) {
  return trees.slice(1).filter((t) => missing(t.path) || (!dirty(t.path) && (t.branch === null || merged.has(t.branch)) && !fresh(t.path)));
}

/** ワークツリーが 1 時間以内に作られ、ブランチがまだ作られたときのまま（reflog が作成の 1 件だけ）か。
 * 自前のコミットがあってマージ済みなら、若くても終わった作業。 */
export function isFresh(path, now = Date.now()) {
  try {
    if (now - statSync(path).birthtimeMs >= FRESH_WORKTREE_MS) return false;
    const branch = git(path, ['branch', '--show-current']).trim();
    if (!branch) return false;
    return git(path, ['reflog', 'show', '--format=%gs', `refs/heads/${branch}`]).split(/\r?\n/).filter(Boolean).length <= 1;
  } catch {
    return false;
  }
}
