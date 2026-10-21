// node --test tests/lib.test.mjs で走る。
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadConfig } from '../lib/config.mjs';
import { badEol, eolFromAttr, eolFromCheckAttr, withEol } from '../lib/eol.mjs';
import { finished, parseWorktrees, pending, rootHolding } from '../lib/git.mjs';
import { coversOf, covers, linksIn, pathsIn, stagedWarnings, structureProblems } from '../lib/docs-check.mjs';
import { rewritesFiles } from '../hooks/eol-after-shell.mjs';
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

test('ファイルを書き換えるシェルコマンドだけを調べる', () => {
  for (const c of ["sed -i 's/a/b/' x", 'echo hi > out.txt', 'Set-Content x.txt y', 'node -e "1"', 'python fix.py']) assert.equal(rewritesFiles(c), true, c);
  for (const c of ['git status', 'ls -la', 'npm test', 'cat a 2>&1', 'a && b']) assert.equal(rewritesFiles(c), false, c);
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

test('設定は既定値に重なり、ITSUMO_DISABLE で止められる', () => {
  const c = loadConfig('/no/such/dir', { ITSUMO_DISABLE: 'map,stop' });
  assert.equal(c.map, false);
  assert.equal(c.eol, true);
  assert.equal(c.stop.commit, false);
  assert.ok(c.stop.ignore.includes('node_modules/'));
});

test('covers: ファイル、フォルダ、* と **', () => {
  assert.equal(covers('src/a.ts', 'src/a.ts'), true);
  assert.equal(covers('src/engine', 'src/engine/x/y.ts'), true);
  assert.equal(covers('src/*.ts', 'src/a.ts'), true);
  assert.equal(covers('src/*.ts', 'src/x/a.ts'), false);
  assert.equal(covers('src/**', 'src/x/a.ts'), true);
  assert.equal(covers('src/**/a.ts', 'src/a.ts'), true);
  assert.equal(covers('src/**/a.ts', 'src/x/y/a.ts'), true);
  assert.equal(covers('src/**/a.ts', 'srcx/a.ts'), false);
});

test('coversOf はフロントマターの一覧を読む', () => {
  assert.deepEqual(coversOf('---\ncovers:\n  - src/a.ts\n  - "src/b/**"\ntitle: x\n---\n# T'), ['src/a.ts', 'src/b/**']);
  assert.equal(coversOf('# no front matter'), null);
});

test('pathsIn はトップレベルで始まるパスだけ、linksIn は相対リンクだけ', () => {
  const body = 'See `src/a.ts`, `npm run x`, `tools/list`, `foo/bar`, `src/<name>.ts`.\n```\n`src/ignored.ts`\n```\n[x](./b.md#h) [y](https://e.com)';
  assert.deepEqual(pathsIn(body, new Set(['src', 'tools'])), ['src/a.ts', 'tools/list', 'src/']);
  assert.deepEqual(linksIn(body), ['./b.md']);
});

test('structureProblems: 載っていないフォルダ、無いパス、covers、索引、サイズ', () => {
  const files = ['src/a.ts', 'lib/b.ts', 'docs/architecture/README.md', 'docs/design/README.md', 'docs/design/queue.md', 'docs/design/orphan.md'];
  const pages = {
    'docs/architecture/README.md': '`src/` is the app. `src/gone.ts`. See `docs/`.',
    'docs/design/README.md': '- queue.md',
    'docs/design/queue.md': '---\ncovers:\n  - src/a.ts\n  - src/missing/**\n---\n# Queue',
    'docs/design/orphan.md': '# no covers',
  };
  const problems = structureProblems(files, (p) => pages[p] ?? '', { map: 'docs/architecture', design: 'docs/design', entryLimit: 7000, pageLimit: 14000 });
  const has = (re) => assert.ok(problems.some((p) => re.test(p)), `${re} in\n${problems.join('\n')}`);
  has(/"lib\/"/);
  has(/src\/gone\.ts/);
  has(/src\/missing/);
  has(/orphan\.md: .*covers/);
  has(/orphan\.md が載っていない/);
  assert.equal(problems.length, 5);
});

test('stagedWarnings は扱うコードが変わりページが無いときだけ警告する', () => {
  const pages = [{ page: 'docs/design/q.md', covers: ['src/q/**'] }];
  assert.equal(stagedWarnings(['src/q/a.ts'], pages).length, 1);
  assert.equal(stagedWarnings(['src/q/a.ts', 'docs/design/q.md'], pages).length, 0);
  assert.equal(stagedWarnings(['src/q/a.test.ts'], pages).length, 0);
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
