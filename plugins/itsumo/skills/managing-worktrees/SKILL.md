---
name: managing-worktrees
description: "メインのチェックアウトに触れずに作業する Git ワークツリーを作り、終わったら安全に消す（node_modules などのリンクを先に外す）。ユーザーの dev サーバーがメインを見ているとき、サブエージェントに並行で作業させるとき、Stop フックが用済みのワークツリーを挙げたときに使う。"
argument-hint: "add <name> / remove <path> / list"
---

スクリプトは `node "${CLAUDE_PLUGIN_ROOT}/lib/worktree.mjs"`（Node.js 18 以上と Git が要る）。設定はプロジェクトの `.claude/itsumo.json` の `worktree`:

```json
{ "worktree": { "link": ["node_modules", "frontend/node_modules"], "base": "main" } }
```

- `link`: メインからリンクするフォルダ（Windows はジャンクション、他はシンボリックリンク）。重い依存フォルダを入れ直さずに済む。既定は無し。
- `base`: 起点とマージ済み判定の基準。既定はリポジトリの既定ブランチ（origin の HEAD、無ければ main / master）。

## 1. 作る

1. `node "${CLAUDE_PLUGIN_ROOT}/lib/worktree.mjs" add <name>`（`--from <branch>` で起点を変える）。隣のフォルダ `../<repo>-wt-<name>` に、日付付きの新しいブランチ `<yyyymmdd>_<name>` を作り、`link` のフォルダをつなぐ。最後の行が絶対パス。
2. Agent ツールの `isolation: "worktree"` が使えない環境（パスの大文字小文字の食い違いなどで拒まれる）でも、これで作れる。サブエージェントにはその絶対パスを渡し、そこで作業するよう言う。
3. ワークツリーでの注意:
   - 開発サーバーや E2E テストは別のポートで動かす。同じポートだとメインのサーバーを再利用して、違うコードを試してしまう。
   - ビルドの増分キャッシュ（`tsconfig.tsbuildinfo` など）がワークツリーに残ったらコミットしない。
   - itsumo のフックはすべてのワークツリーを見る（改行、未コミットの変更）。

## 2. 消す

**ワークツリーは必ず `node "${CLAUDE_PLUGIN_ROOT}/lib/worktree.mjs" remove <path>` で消す。** `git worktree remove` を手で使わない: ジャンクションやシンボリックリンクをたどって、リンク先（メインの `node_modules` など）を空にしうる。

- `remove` は、`link` のフォルダと、2 階層までに見つかったリンクを先にすべて外す。外せなければ何も消さずに止まる。
- 未コミットの変更があるワークツリーは消さずに止まる。コミットするか、ユーザーが捨ててよいと言ったときだけ `--force` を付ける。
- ブランチはマージ済みなら消す。マージされていなければ残し、そう出力する。そのときは `-D` で消さず、ユーザーに聞く。
- 消した後、リンクしていたフォルダがメインにまだ中身ごとあることを確かめる（例: `ls node_modules`）。
- フォルダがプロセスに掴まれていて消せないときは、掴んでいるプロセスをコマンドラインで探し、自分（かサブエージェント）が起こしたものだけを止める。ユーザーのアプリや dev サーバーは止めない。

## 3. 一覧

`node "${CLAUDE_PLUGIN_ROOT}/lib/worktree.mjs" list` は用済みのワークツリー（きれいでブランチがマージ済み、またはフォルダが消えたもの）を挙げる。作って 1 時間以内で自前のコミットが無いものは、手つかずの新品とみなして挙げない。itsumo の Stop フックも、すべてコミット済みのときに同じものの削除を求める。

依頼: $ARGUMENTS
