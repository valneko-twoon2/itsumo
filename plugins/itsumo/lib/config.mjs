// itsumo のプロジェクト設定: プロジェクトの `.claude/itsumo.json` を下の既定値に重ねたもの。キーはすべて省略可で、
// ファイルが無い・壊れているときは既定値になる。環境変数 ITSUMO_DISABLE（カンマ区切り: map, eol, stop, destructive）で、
// ファイルを触らずにそのシェルだけ一部を止められる。
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const DEFAULTS = {
  // セッションとサブエージェントの開始時に差し込むページ。存在する最初のものを使う。false で無効。
  map: ['docs/architecture/README.md', 'ARCHITECTURE.md', 'docs/ARCHITECTURE.md'],
  // 差し込むバイト数の上限。毎回の最初に入るので、読み切れる小ささに保つ目安。超えた分は注記付きで切る。
  mapLimit: 12000,
  // 改行は .gitattributes（`eol=lf` / `eol=crlf`）に従う。eol 属性の無いファイルには触らない。
  eol: true,
  // true なら Claude の署名行（Co-Authored-By など）をコミットと PR に付けてよい。既定は付けさせない（hooks/no-attribution.mjs）。
  attribution: false,
  destructive: {
    // 取り返しのつかないコマンドの前にユーザーへ確認させる（hooks/confirm-destructive.mjs）。
    confirm: true,
    // 再帰的な rm でも、これらの名前のフォルダだけを消すなら確認しない（作り直せる生成物）。
    safeDirs: ['node_modules', 'dist', 'build', 'target', 'coverage', 'test-results', '.next', '.turbo', '.cache', '__pycache__', '.pytest_cache'],
  },
  stop: {
    // 未コミットの変更を残して止まろうとしたらコミットを求める。
    commit: true,
    // きれいでマージ済みのワークツリーの削除を求める。
    worktrees: true,
    // 未コミットとして数えないパスの前方一致（生成物、ユーザーデータ）。
    ignore: ['node_modules/', 'dist/', 'build/', 'target/', 'coverage/', 'test-results/'],
    // 未コミットの変更がこれより大きいとき、最小の変更の見直しを促す（itsumo:making-minimal-changes）。false で無効。
    // 目安: レビューで見落としが増え始める 400 行前後と、一つの依頼で触るファイルの数として多めの 10 個。プロジェクトに合わせて変えてよい。
    largeDiff: { files: 10, lines: 400 },
  },
  worktree: {
    // 新しいワークツリーへメインのチェックアウトからリンクするフォルダ（Windows はジャンクション、他はシンボリックリンク）。
    link: [],
    // ワークツリーの起点かつマージ済み判定の基準になるブランチ。null ならリポジトリの既定ブランチ。
    base: null,
  },
};

function merge(base, over) {
  if (over === undefined) return base;
  if (Array.isArray(base) || typeof base !== 'object' || base === null || typeof over !== 'object' || over === null || Array.isArray(over)) return over;
  const out = { ...base };
  for (const key of Object.keys(over)) out[key] = merge(base[key], over[key]);
  return out;
}

/** `root` のプロジェクトの設定。例外を投げない。 */
export function loadConfig(root, env = process.env) {
  let file = {};
  try {
    const path = join(root, '.claude', 'itsumo.json');
    if (existsSync(path)) file = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    file = {};
  }
  const config = merge(DEFAULTS, file);
  const off = new Set(String(env.ITSUMO_DISABLE ?? '').split(',').map((s) => s.trim()).filter(Boolean));
  if (off.has('map')) config.map = false;
  if (off.has('eol')) config.eol = false;
  if (off.has('destructive')) config.destructive = { ...config.destructive, confirm: false };
  if (off.has('stop')) config.stop = { ...config.stop, commit: false, worktrees: false };
  return config;
}

/** フックが対象にするプロジェクトのフォルダ。 */
export function projectRoot(env = process.env) {
  return env.CLAUDE_PROJECT_DIR || process.cwd();
}
