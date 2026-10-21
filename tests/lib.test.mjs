// node --test tests/lib.test.mjs で走る。
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadConfig } from '../lib/config.mjs';
import { badEol, eolFromAttr, eolFromCheckAttr, withEol } from '../lib/eol.mjs';
import { finished, isLarge, parseNumstat, parseWorktrees, pending, rootHolding } from '../lib/git.mjs';
import { reminder } from '../hooks/stop.mjs';

test('eol 属性が無いファイルには改行を求めない', () => {
  assert.equal(eolFromAttr('text=auto eol=lf'), 'lf');
  assert.equal(eolFromAttr('text eol=crlf'), 'crlf');
  assert.equal(eolFromAttr('text=auto'), null);
  assert.equal(eolFromAttr('-text'), null);
  assert.equal(eolFromAttr(''), null);
});

test('check-attr の出力から改行を読み、text が unset なら触らない', () => {
  assert.equal(eolFromCheckAttr('a.bat: eol: crlf\na.bat: text: set\n'), 'crlf');
  assert.equal(eolFromCheckAttr('a.txt: eol: unspecified\na.txt: text: auto\n'), null);
  assert.equal(eolFromCheckAttr('a.png: eol: lf\na.png: text: unset\n'), null);
});

test('withEol は混在した改行もそろえる', () => {
  assert.equal(withEol('a\r\nb\nc', 'lf'), 'a\nb\nc');
  assert.equal(withEol('a\r\nb\nc', 'crlf'), 'a\r\nb\r\nc');
});

test('badEol は属性と違う作業ツリーの改行だけを挙げる', () => {
  const listing = [
    'i/lf    w/crlf  attr/text=auto eol=lf \tsrc/a.ts',
    'i/lf    w/lf    attr/text=auto eol=lf \tsrc/b.ts',
    'i/crlf  w/lf    attr/text eol=crlf    \trun.bat',
    'i/lf    w/crlf  attr/                 \tfree.txt',
    'i/-text w/-text attr/-text            \tpic.png',
    'i/lf    w/mixed attr/text=auto eol=lf \tsrc/c.ts',
  ].join('\n');
  assert.deepEqual(badEol(listing), [
    { path: 'src/a.ts', want: 'lf' },
    { path: 'run.bat', want: 'crlf' },
    { path: 'src/c.ts', want: 'lf' },
  ]);
});

test('pending は無視する前方一致を除き、名前の変更は新しい方を取る', () => {
  const porcelain = ' M src/a.ts\n?? node_modules/x/y.js\nR  old.ts -> new.ts\n?? pkg/dist/out.js\n?? "with space.txt"\n';
  assert.deepEqual(pending(porcelain, ['node_modules/', 'dist/']), ['src/a.ts', 'new.ts', 'with space.txt']);
});

test('parseWorktrees と finished: きれいでマージ済みか、消えたものだけが用済み', () => {
  const trees = parseWorktrees('worktree /r\nHEAD 1\nbranch refs/heads/main\n\nworktree /r-wt-a\nHEAD 2\nbranch refs/heads/a\n\nworktree /r-wt-b\nHEAD 3\nbranch refs/heads/b\n\nworktree /r-wt-c\nHEAD 4\nbranch refs/heads/c\n');
  assert.equal(trees.length, 4);
  assert.equal(trees[1].branch, 'a');
  const done = finished(trees, {
    merged: new Set(['a', 'b']),
    dirty: (p) => p.endsWith('b'),
    missing: (p) => p.endsWith('c'),
  });
  assert.deepEqual(done.map((t) => t.branch), ['a', 'c']);
  assert.deepEqual(finished(trees, { merged: new Set(['a']), dirty: () => false, missing: () => false, fresh: () => true }), []);
});

test('rootHolding は最も深いワークツリーを選び、外のファイルは null', () => {
  const roots = ['/r', '/r/inner'];
  assert.equal(rootHolding('/r/inner/x.ts', roots), '/r/inner');
  assert.equal(rootHolding('/r/x.ts', roots), '/r');
  assert.equal(rootHolding('/rx/x.ts', roots), null);
});

test('停止の催促: 未コミットを先に、次に用済みワークツリー、催促後の停止は通す', () => {
  assert.match(reminder({}, ['a.ts'], false), /未コミット/);
  assert.match(reminder({}, [], false, ['/r-wt-a']), /ワークツリー/);
  assert.equal(reminder({ stop_hook_active: true }, ['a.ts'], false), null);
  assert.equal(reminder({}, ['a.ts'], true), null);
  assert.equal(reminder({}, [], false, []), null);
});

test('parseNumstat は追加と削除を足し、バイナリは数えない。isLarge は上限を超えたときだけ', () => {
  assert.equal(parseNumstat('3\t1\ta.ts\n-\t-\timg.png\n10\t0\tb.ts\n'), 14);
  assert.equal(parseNumstat(''), 0);
  const limit = { files: 10, lines: 400 };
  assert.equal(isLarge({ files: 10, lines: 400 }, limit), false);
  assert.equal(isLarge({ files: 11, lines: 5 }, limit), true);
  assert.equal(isLarge({ files: 2, lines: 401 }, limit), true);
  assert.equal(isLarge({ files: 99, lines: 9999 }, false), false);
});

test('大きい変更の催促には、最小の変更の見直しが添えられる', () => {
  assert.match(reminder({}, ['a.ts'], false, [], { files: 12, lines: 600 }), /itsumo:making-minimal-changes/);
  assert.doesNotMatch(reminder({}, ['a.ts'], false), /変更が大きい/);
});

test('設定は既定値に重なり、ITSUMO_DISABLE で止められる', () => {
  const c = loadConfig('/no/such/dir', { ITSUMO_DISABLE: 'eol,stop' });
  assert.equal(c.eol, false);
  assert.equal(c.attribution, false);
  assert.equal(c.stop.commit, false);
  assert.ok(c.stop.ignore.includes('node_modules/'));
});

test('changedSince: 開始時と内容が同じものは除き、記録が無ければすべて', async () => {
  const { changedSince } = await import('../lib/snapshot.mjs');
  const before = { 'a.ts': 'h1', 'b.ts': 'h2' };
  assert.deepEqual(changedSince(before, { 'a.ts': 'h1', 'b.ts': 'h9', 'c.ts': 'h3' }), ['b.ts', 'c.ts']);
  assert.deepEqual(changedSince(null, { 'a.ts': 'h1' }), ['a.ts']);
});

test('署名行を含む commit / PR の作成だけを止める', async () => {
  const { hasSignature } = await import('../hooks/no-attribution.mjs');
  assert.equal(hasSignature('git commit -m "x\n\nCo-Authored-By: Claude Opus <noreply@anthropic.com>"'), true);
  assert.equal(hasSignature('gh pr create --body "Generated with [Claude Code](https://claude.com/claude-code)"'), true);
  assert.equal(hasSignature('git commit -m "Add x"'), false);
  assert.equal(hasSignature('echo Co-Authored-By: Claude'), false);
});

test('スキルの案内は全スキルを挙げ、開始のイベントにだけ差し込み、設定で止められる', async () => {
  const { readdirSync } = await import('node:fs');
  const { contextFor } = await import('../hooks/skill-guide.mjs');
  const on = loadConfig('/no/such/dir', {});
  const answer = contextFor('SessionStart', on);
  const text = answer.hookSpecificOutput.additionalContext;
  assert.equal(answer.hookSpecificOutput.hookEventName, 'SessionStart');
  for (const name of readdirSync(new URL('../skills', import.meta.url))) assert.ok(text.includes(`itsumo:${name}`), `案内に無いスキル: ${name}`);
  assert.equal(contextFor('SubagentStart', on).hookSpecificOutput.hookEventName, 'SubagentStart');
  assert.equal(contextFor('PreToolUse', on), null);
  assert.equal(contextFor('SessionStart', loadConfig('/no/such/dir', { ITSUMO_DISABLE: 'guide' })), null);
});

test('取り返しのつかないコマンドだけを確認に回し、生成物のフォルダの削除は通す', async () => {
  const { destructiveReason } = await import('../hooks/confirm-destructive.mjs');
  const safe = loadConfig('/no/such/dir', {}).destructive.safeDirs;
  const asks = (c) => assert.ok(destructiveReason(c, safe), `確認されるべき: ${c}`);
  const passes = (c) => assert.equal(destructiveReason(c, safe), null, `通るべき: ${c}`);
  asks('git push --force origin main');
  asks('git push -f');
  asks('git push origin +main');
  asks('git reset --hard HEAD~1');
  asks('git clean -fd');
  asks('git branch -D feature');
  asks('git checkout -- .');
  asks('git restore .');
  asks('git stash clear');
  asks('psql -c "DROP TABLE users"');
  asks('rm -rf src');
  asks('rm -rf node_modules src');
  asks('Remove-Item -Recurse -Force C:\\work\\app');
  asks('cd app && rm -r docs');
  passes('git push --force-with-lease');
  passes('git push origin main');
  passes('git reset HEAD~1');
  passes('git branch -d feature');
  passes('git checkout main');
  passes('git restore --staged a.ts');
  passes('rm -rf node_modules');
  passes('rm -rf ./dist build/');
  passes('Remove-Item -Recurse -Force node_modules');
  passes('rm a.txt');
  passes('git status');
  asks('git commit --no-verify -m "x"');
  asks('git commit -n -m x');
  asks('git commit -an -m x');
  asks('git push --no-verify');
  asks('git commit --no-gpg-sign -m x');
  asks('git -c commit.gpgsign=false commit -m x');
  passes('git commit -m "skip --no-verify and -n handling"');
  passes('git commit -m "fix: -n option"');
  passes('git push -n');
  passes('git commit -m x');
});
