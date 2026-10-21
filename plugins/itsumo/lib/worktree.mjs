// メインのチェックアウトに触れてはいけない作業（dev サーバーが見ている、サブエージェントが並行で動く）用の Git ワークツリー。
//   node worktree.mjs add <name> [--from <branch>]   隣のフォルダ ../<repo>-wt-<name> を日付付きの新しいブランチで作り、
//                                                    `worktree.link`（.claude/itsumo.json）のフォルダをメインからリンクする
//   node worktree.mjs remove <path> [--force]        先にリンクをすべて外してから、ワークツリーとブランチ（マージ済みのみ）を消す。
//                                                    未コミットの変更があれば --force 無しでは拒む
//   node worktree.mjs list                           用済みで消すべきワークツリー
// `git worktree remove` はジャンクションやシンボリックリンクをたどって、リンク先のフォルダを空にしうる。リンクが残ったまま
// だと、メインの node_modules（などリンクしたもの）が消える。`remove` は先にリンクを外す。ワークツリーを手で消さないこと。
import { existsSync, lstatSync, readdirSync, readlinkSync, rmdirSync, symlinkSync, unlinkSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadConfig } from '../lib/config.mjs';
import { defaultBranch, finished, git, isFresh, parseWorktrees } from '../lib/git.mjs';

/** `path` がシンボリックリンクか Windows のジャンクションか（readlink はリンクにだけ答える）。 */
export function isLink(path) {
  try {
    if (lstatSync(path).isSymbolicLink()) return true;
    readlinkSync(path);
    return true;
  } catch {
    return false;
  }
}

/** `dir` の中、`depth` 階層までにあるリンク。リンクはたどらない。 */
export function linksIn(dir, depth = 2) {
  const out = [];
  let names = [];
  try {
    names = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of names) {
    if (name === '.git') continue;
    const path = join(dir, name);
    if (isLink(path)) out.push(path);
    else if (depth > 1) {
      try {
        if (lstatSync(path).isDirectory()) out.push(...linksIn(path, depth - 1));
      } catch {
        // その間に消えた
      }
    }
  }
  return out;
}

/** リンクをたどらずに外す。ジャンクションは空のフォルダとして消え、リンク先には触れない。 */
function unlink(path) {
  try {
    unlinkSync(path);
  } catch {
    rmdirSync(path);
  }
}

const today = () => new Date().toISOString().slice(0, 10).replaceAll('-', '');

function main(argv) {
  const top = git(process.cwd(), ['rev-parse', '--show-toplevel']).trim();
  const trees = parseWorktrees(git(top, ['worktree', 'list', '--porcelain']));
  const mainTree = trees[0].path;
  const config = loadConfig(mainTree);
  const base = config.worktree.base || defaultBranch(mainTree);
  const [cmd, arg] = argv;
  if (cmd === 'add' && arg) {
    if (!/^[\w.-]+$/.test(arg)) throw new Error(`名前 "${arg}": 英数字と "."、"_"、"-" だけを使うこと`);
    const from = argv.includes('--from') ? argv[argv.indexOf('--from') + 1] : base;
    const dir = resolve(mainTree, '..', `${basename(mainTree)}-wt-${arg}`);
    git(mainTree, ['worktree', 'add', '-b', `${today()}_${arg}`, dir, from], 120000);
    for (const rel of config.worktree.link) {
      const src = join(mainTree, rel);
      const dst = join(dir, rel);
      if (!existsSync(src) || existsSync(dst)) continue;
      symlinkSync(src, dst, process.platform === 'win32' ? 'junction' : 'dir');
      console.log(`リンクした: ${rel}`);
    }
    console.log(dir);
  } else if (cmd === 'remove' && arg) {
    const dir = resolve(arg);
    const tree = trees.find((t) => t.path.toLowerCase() === dir.toLowerCase());
    if (!tree || tree === trees[0]) throw new Error(`${dir} はこのリポジトリのリンクされたワークツリーではない`);
    if (existsSync(dir) && !argv.includes('--force') && git(dir, ['status', '--porcelain']).trim()) {
      throw new Error(`${dir} に未コミットの変更がある。コミットするか、捨ててよいとユーザーが言ったときだけ --force を付けること。何も消していない`);
    }
    if (existsSync(dir)) {
      const links = [...new Set([...config.worktree.link.map((rel) => join(dir, rel)).filter(isLink), ...linksIn(dir)])];
      for (const link of links) unlink(link);
      const left = links.filter((l) => existsSync(l) || isLink(l));
      if (left.length) throw new Error(`${left.join(', ')} を外せなかった。何も消していない`);
      if (links.length) console.log(`リンクを ${links.length} 個外した`);
    }
    git(mainTree, ['worktree', 'remove', '--force', dir], 120000);
    git(mainTree, ['worktree', 'prune']);
    if (tree.branch) {
      try {
        console.log(git(mainTree, ['branch', '-d', tree.branch]).trim());
      } catch {
        console.log(`ブランチ ${tree.branch} はマージされていないので残した。消す前にユーザーに確認すること`);
      }
    }
    console.log(`削除した: ${dir}`);
  } else if (cmd === 'list') {
    const merged = new Set(git(mainTree, ['branch', '--merged', base, '--format=%(refname:short)']).split(/\r?\n/).filter(Boolean));
    const done = finished(trees, { merged, dirty: (p) => git(p, ['status', '--porcelain']).trim() !== '', missing: (p) => !existsSync(p), fresh: isFresh });
    for (const t of done) console.log(t.path);
  } else {
    console.error('使い方: node worktree.mjs add <name> [--from <branch>] | remove <path> [--force] | list');
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error(String(e?.stderr || e?.message || e).trim());
    process.exitCode = 1;
  }
}
