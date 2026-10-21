// .gitattributes が求める改行。`eol=lf` / `eol=crlf`（直接、または `text=auto eol=...` 経由）が付いたファイルはその改行に
// しなければならない。eol 属性の無いファイルやバイナリ指定（`-text`）のファイルには触らないので、改行を指定していない
// リポジトリが書き換えられることはない。

/** `git ls-files --eol` の属性欄（`attr/text=auto eol=lf`）から 'lf'、'crlf' または null。 */
export function eolFromAttr(attr) {
  if (/(^|\s)-text\b/.test(attr) || /(^|\s)binary\b/.test(attr)) return null;
  return /(^|\s)eol=(lf|crlf)\b/.exec(attr)?.[2] ?? null;
}

/** `git check-attr eol text -- <path>` の出力から 'lf'、'crlf' または null。 */
export function eolFromCheckAttr(output) {
  const values = Object.fromEntries(
    output
      .split(/\r?\n/)
      .map((line) => /: (eol|text): (.*)$/.exec(line))
      .filter(Boolean)
      .map((m) => [m[1], m[2].trim()]),
  );
  if (values.text === 'unset') return null;
  return values.eol === 'lf' || values.eol === 'crlf' ? values.eol : null;
}

/** すべての改行（LF、CRLF、混在）を `eol` にしたテキスト。 */
export function withEol(text, eol) {
  return text.replace(/\r?\n/g, eol === 'crlf' ? '\r\n' : '\n');
}

/** `git ls-files --eol` の一覧のうち、作業ツリーの改行が属性の求めるものと違うパスと、求める改行。 */
export function badEol(listing) {
  const bad = [];
  for (const line of listing.split(/\r?\n/)) {
    const tab = line.indexOf('\t');
    if (tab < 0) continue;
    const info = /^i\/\S*\s+w\/(\S*)\s+attr\/(.*)$/.exec(line.slice(0, tab).trimEnd());
    if (!info) continue;
    const [, work, attr] = info;
    const want = eolFromAttr(attr);
    if (want && ['lf', 'crlf', 'mixed'].includes(work) && work !== want) bad.push({ path: line.slice(tab + 1), want });
  }
  return bad;
}
