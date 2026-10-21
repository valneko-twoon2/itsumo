// セッション開始時の未コミットファイルの記録。Stop フックが、このセッションの前からあった（ユーザー自身の）変更まで
// 催促しないように、開始時に変更されていたファイルとその内容のハッシュを残し、停止時に違うものだけを挙げる。
// 記録はセッション ID ごとに CLAUDE_PLUGIN_DATA（無ければ OS の一時フォルダ）に置き、7 日で消す。
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { GIT_MAX_BUFFER, GIT_TIMEOUT_MS, pending } from './git.mjs';

// 記録はセッションごとに 1 つ。数日たったセッションは再開されないので 7 日で消す。
const KEEP_MS = 7 * 24 * 3600_000;

function dir(env = process.env) {
  return join(env.CLAUDE_PLUGIN_DATA || join(tmpdir(), 'itsumo'), 'sessions');
}

const fileFor = (sessionId, env) => join(dir(env), `${String(sessionId).replace(/[^\w.-]/g, '_')}.json`);

/** `root` の未コミットのファイル（追跡外も 1 つずつ）と、その内容のハッシュ（消えたファイルは 'deleted'）。 */
export function dirtyHashes(root, ignore = []) {
  const status = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: root, encoding: 'utf8', timeout: GIT_TIMEOUT_MS, maxBuffer: GIT_MAX_BUFFER, windowsHide: true });
  // 末尾が `/` のパスは入れ子のリポジトリやワークツリー（`.claude/worktrees/x/` など）。中身はそちらのルートで数えるので、ここでは数えない。
  const paths = pending(status, ignore).filter((p) => !p.endsWith('/'));
  const out = {};
  if (!paths.length) return out;
  let hashes = [];
  try {
    hashes = execFileSync('git', ['hash-object', '--stdin-paths'], { cwd: root, input: paths.join('\n'), encoding: 'utf8', timeout: GIT_TIMEOUT_MS, maxBuffer: GIT_MAX_BUFFER, windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] })
      .split(/\r?\n/)
      .filter(Boolean);
  } catch {
    // hash-object は消えたファイルがあると失敗（exit 128）するので、下で 1 つずつ聞き直す。
  }
  if (hashes.length === paths.length) paths.forEach((p, i) => (out[p] = hashes[i]));
  else for (const p of paths) {
    try {
      out[p] = execFileSync('git', ['hash-object', '--', p], { cwd: root, encoding: 'utf8', timeout: GIT_TIMEOUT_MS, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
      out[p] = 'deleted';
    }
  }
  return out;
}

/** 記録が無ければ `roots` の今の状態を記録する。圧縮や再開で SessionStart がまた来ても、最初の記録を保つ。 */
export function saveSnapshot(sessionId, roots, ignore, env = process.env) {
  if (!sessionId) return;
  const file = fileFor(sessionId, env);
  try {
    statSync(file);
    return;
  } catch {
    // まだ無い
  }
  mkdirSync(dir(env), { recursive: true });
  const data = {};
  for (const root of roots) {
    try {
      data[root] = dirtyHashes(root, ignore);
    } catch {
      // Git が答えないワークツリー（フォルダが消えたものなど）も、あったことだけは記録する。
      data[root] = {};
    }
  }
  writeFileSync(file, JSON.stringify(data));
  prune(env);
}

/** セッションの記録。無ければ null（プラグインをセッションの途中で入れた、など）。 */
export function loadSnapshot(sessionId, env = process.env) {
  if (!sessionId) return null;
  try {
    return JSON.parse(readFileSync(fileFor(sessionId, env), 'utf8'));
  } catch {
    return null;
  }
}

/** `now` の未コミットのうち、記録と内容が違うか、記録に無いもの。記録が無ければすべて。 */
export function changedSince(before, now) {
  return Object.keys(now).filter((p) => !before || before[p] !== now[p]);
}

const same = (a, b) => resolve(a).toLowerCase() === resolve(b).toLowerCase();

/** `paths` のうち、セッション開始時の記録に無かった（このセッションの間に作られた）ものと、`current`（今いる場所）以外。記録が無ければ空 */
export function createdSince(before, paths, current) {
  if (!before) return [];
  const known = Object.keys(before);
  return paths.filter((p) => !known.some((k) => same(k, p)) && !same(p, current));
}

function prune(env) {
  try {
    const now = Date.now();
    for (const name of readdirSync(dir(env))) {
      const path = join(dir(env), name);
      if (now - statSync(path).mtimeMs > KEEP_MS) rmSync(path, { force: true });
    }
  } catch {
    // 片付けの失敗は無視する
  }
}
