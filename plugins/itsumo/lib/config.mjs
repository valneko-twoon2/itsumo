// itsumo のプロジェクト設定: プロジェクトの `.claude/itsumo.json` を下の既定値に重ねたもの。キーはすべて省略可で、
// ファイルが無い・壊れているときは既定値になる。環境変数 ITSUMO_DISABLE（カンマ区切り: map, eol, stop）で、
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
  stop: {
    // 未コミットの変更を残して止まろうとしたらコミットを求める。
    commit: true,
    // きれいでマージ済みのワークツリーの削除を求める。
    worktrees: true,
    // 未コミットとして数えないパスの前方一致（生成物、ユーザーデータ）。
    ignore: ['node_modules/', 'dist/', 'build/', 'target/', 'coverage/', 'test-results/'],
  },
  docs: {
    // アーキテクチャマップ: 作業の最初に読む短い案内（itsumo:syncing-docs スキル）。
    map: 'docs/architecture',
    // 設計ページ: 機能ごとに 1 枚、記述対象のコードを `covers:` に書く。
    design: 'docs/design',
    // マップの入口ページ（README.md）、他のマップページ、設計ページのバイト数上限。
    entryLimit: 7000,
    pageLimit: 14000,
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
  if (off.has('stop')) config.stop = { ...config.stop, commit: false, worktrees: false };
  return config;
}

/** フックが対象にするプロジェクトのフォルダ。 */
export function projectRoot(env = process.env) {
  return env.CLAUDE_PROJECT_DIR || process.cwd();
}
