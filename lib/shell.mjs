// フックが Bash / PowerShell のコマンド文字列を読むための共通の処理。実行される部分だけを見るため、
// 実行されない文字列（コミットのメッセージなど）を空にする。

// 1 つのコマンドの範囲（パイプや && の手前まで）。
export const ARGS = String.raw`[^|;&\n]*`;

const QUOTED = String.raw`(?:"(?:[^"\\]|\\.)*"|'[^']*')`;
// 実行されない文字列: コミットや PR のメッセージ（-m、--message、--body、--title など）と、echo / printf の引数。
// `psql -c "DROP TABLE x"` や `bash -c "..."` は実行されるので、ここには含めない。
const TEXT_ARGS = new RegExp(String.raw`((?:\s-[a-zA-Z]*[mtb]|\s--(?:message|body|title|notes|description))(?:\s+|=)|\b(?:echo|printf|Write-Host|Write-Output)\s+)${QUOTED}`, 'g');
// メッセージを渡すヒアドキュメント（`git commit -F - <<'EOF'` など）の本文。`psql <<EOF` のような実行される本文は残す。
const MESSAGE_HEREDOC = /(^[^\n]*(?:\bgit\b[^\n]*\bcommit\b|\bgh\s+(?:pr|issue)\b|\bcat\s*>)[^\n]*<<-?\s*['"]?(\w+)['"]?[^\n]*)\n[\s\S]*?\n[ \t]*\2[ \t]*(?=\n|$)/gm;

/** 実行されない文字列（メッセージ、echo の引数、メッセージ用のヒアドキュメント）を空にする。 */
export function withoutMessages(command) {
  return command.replace(MESSAGE_HEREDOC, '$1\n').replace(TEXT_ARGS, '$1""');
}

/** 引用符の中の文字列を、すべて空にする。フラグだけを見るため。 */
export function withoutQuoted(command) {
  return command.replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, '""');
}
