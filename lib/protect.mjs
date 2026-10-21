// コミットの前と、ファイルの編集の前に確認させるための判定（hooks/confirm-commit.mjs、hooks/confirm-edit.mjs が使う）。
// ここは文字列だけを見る純粋な関数で、Git には触らない。
import { basename } from 'node:path';
import { ARGS, withoutMessages } from './shell.mjs';

// ユーザーの変更まで巻き込む形: `git add -A` / `--all` / `-u` / `.` / `*`、`git commit -a` / `--all`。
// `git add .claude/x` のようなパスや `--allow-empty` は、後ろが空白か行末でないので当たらない。
const END = String.raw`(?=\s|$|[|;&])`;
const STAGE_ALL = [
  new RegExp(String.raw`\bgit\b${ARGS}\badd\b${ARGS}\s(?:-A|--all|-u|--update|\.|\*)${END}`),
  new RegExp(String.raw`\bgit\b${ARGS}\bcommit\b${ARGS}\s(?:-[a-zA-Z]*a[a-zA-Z]*|--all)${END}`),
];
const COMMIT = new RegExp(String.raw`\bgit\b${ARGS}\bcommit\b`);
const ADD = new RegExp(String.raw`\bgit\b${ARGS}\badd\b([^|;&\n]*)`, 'g');

/** コマンドが、ユーザーの変更まで巻き込みうる `git add -A` / `git commit -a` の形か。 */
export function stagesEverything(command) {
  const text = withoutMessages(command);
  return STAGE_ALL.some((re) => re.test(text));
}

/** コマンドが `git commit` か。 */
export function isCommit(command) {
  return COMMIT.test(withoutMessages(command));
}

/** コマンドが `git commit -a`（追跡中の変更を全部入れる）か。 */
export function commitsAll(command) {
  return STAGE_ALL[1].test(withoutMessages(command));
}

/** `git add` に渡されたパス（フラグを除く）。同じコマンドで足してすぐコミットする形を見るため。 */
export function addTargets(command) {
  const out = [];
  for (const m of withoutMessages(command).matchAll(ADD)) {
    for (const token of m[1].match(/"[^"]*"|'[^']*'|\S+/g) ?? []) {
      const path = token.replace(/^["']|["']$/g, '');
      if (path && !path.startsWith('-')) out.push(path);
    }
  }
  return out;
}

/** `*` だけを使えるファイル名の一致。大文字小文字は区別しない。 */
export function globToRegExp(glob) {
  return new RegExp(`^${glob.replace(/[.+^${}()|[\]\\?]/g, '\\$&').replace(/\*/g, '.*')}$`, 'i');
}

// 値の入っていない見本は、秘密ではない。
const EXAMPLE_ENV = /^\.env\.(?:example|sample|template|dist|defaults)$/i;
const SECRET_NAMES = ['.env', '.env.*', '*.pem', '*.key', '*.p12', '*.pfx', '*.keystore', 'id_rsa', 'id_dsa', 'id_ecdsa', 'id_ed25519', '.netrc'].map(globToRegExp);

/** パスのファイル名が、秘密を持ちやすいもの（`.env`、鍵、証明書）か。 */
export function secretName(path) {
  const name = basename(path);
  return !EXAMPLE_ENV.test(name) && SECRET_NAMES.some((re) => re.test(name));
}

// 形が決まっている鍵やトークン。誤検出を減らすため、接頭辞と長さが合うものだけ。
const SECRET_FORMS = [
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS のアクセスキー'],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}/, 'GitHub のトークン'],
  [/\bgithub_pat_[A-Za-z0-9_]{22,}/, 'GitHub のトークン'],
  [/-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----/, '秘密鍵'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}/, 'Slack のトークン'],
  [/\bsk-ant-[A-Za-z0-9_-]{20,}/, 'Anthropic の API キー'],
  [/\bsk-[A-Za-z0-9]{32,}\b/, 'API キー（sk-...）'],
  [/\bAIza[0-9A-Za-z_-]{35}\b/, 'Google の API キー'],
];

/** テキストに含まれる鍵やトークンの種類。値そのものは返さない。 */
export function secretKinds(text) {
  return [...new Set(SECRET_FORMS.filter(([re]) => re.test(text)).map(([, kind]) => kind))];
}

/** `git diff -U0` の出力を、追加された行だけのファイルごとのテキストにする。 */
export function addedByFile(diff) {
  const files = new Map();
  let current = null;
  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith('+++ ')) {
      current = line.startsWith('+++ b/') ? line.slice(6) : null;
      if (current && !files.has(current)) files.set(current, []);
    } else if (current && line.startsWith('+')) files.get(current).push(line.slice(1));
  }
  return [...files].map(([path, lines]) => ({ path, text: lines.join('\n') }));
}

/** 編集の前に確認が要るファイルなら、その理由。要らなければ null。`protect` は設定の protect。 */
export function protectedReason(relPath, protect) {
  const parts = relPath.replaceAll('\\', '/').split('/').filter(Boolean);
  const name = parts.at(-1) ?? '';
  if (secretName(name)) return '秘密を含みうるファイル（.env、鍵、証明書）。中身を勝手に書き換えない';
  if (!EXAMPLE_ENV.test(name) && protect.files.some((glob) => globToRegExp(glob).test(name))) {
    return '保護の対象に指定されたファイル（ロックファイルなど）。手で書かず、決まった手順（パッケージマネージャのコマンドなど）で更新する';
  }
  const dir = parts.slice(0, -1).find((p) => protect.dirs.includes(p));
  if (dir) return `生成物のフォルダ（${dir}/）の中。元のソースを直して作り直す`;
  return null;
}
