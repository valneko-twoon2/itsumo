# itsumo

いつもの定型作業をまとめた Claude Code プラグイン。特定のプロジェクトに依存せず、どのリポジトリでも使えるようにしてある。プロジェクト固有の決まり（`CLAUDE.md`、`AGENTS.md`、`CONTRIBUTING.md`、既存のスクリプト）があれば、スキルはそちらを優先する。

## インストール

```sh
claude plugin marketplace add <このリポジトリのパス か GitHub の owner/repo>
claude plugin install itsumo@itsumo
```

セッションの中なら `/plugin marketplace add ...` の後 `/plugin` パネルから入れる。動作には Node.js 18 以上と Git が要る。

## スキル

`/itsumo:<名前>` で呼べる。説明文に合う場面では Claude が自分で使う。

| スキル | 何をするか |
|---|---|
| `committing-changes` | 自分の変更だけをステージし、要点が先に来る短いメッセージでコミットする |
| `running-regression-tests` | 変更に合わせてテストを足す・直す・消し、影響する範囲のテストだけを走らせる。完了と言う前に実行して確かめ、成功・失敗・未実行を分けて報告する |
| `clarifying-requests` | 曖昧な依頼は、選択肢と推奨を添えて聞く。自由記述の回答がまだ曖昧なら、決まるまで深掘りして聞き直す |
| `planning-large-changes` | 大きな作業は、着手前に計画（目的、範囲、影響、段階、リスク）で合意を取り、各段階で全体が動く状態を保ってコミットしながら進める |
| `investigating-bugs` | 不具合は、再現し、仮説を証拠で絞って原因を確定してから直す（症状を消すだけの修正をしない） |
| `making-minimal-changes` | 既存のコードを直すとき、依頼に必要な最小の差分だけを入れる（ついでの整形・改名・リファクタをせず、気づいた別件は報告する） |
| `following-existing-code` | 新しくコードを書く前に同じ役割の既存コードを読み、命名・構造・エラー処理・テスト・使う道具をそれに合わせる |
| `refactoring-safely` | リファクタは、先にテストで振る舞いを固め、小さな段階ごとにテストを通してコミットする。機能の変更と混ぜない |
| `designing-test-cases` | テストケースの選び方（同値分割、境界値、条件網羅、プロパティ、状態遷移表、デシジョンテーブル、ペアワイズ） |
| `writing-pr-descriptions` | PR の説明を、概要・背景・変更点・確認・見てほしい点の順で書く（署名行は付けない） |
| `handling-destructive-operations` | 削除、強制 push、reset、DB の書き換え、本番への操作の前に、対象を見て、戻し方を用意し、了承を得てから実行する |
| `reviewing-security-boundaries` | 境界（API、URL、ファイルパス、プロセス起動、外部データ、秘密情報、DB、依存）を変えるときの確認表。Web 用とデスクトップ用の表を分けて持つ |
| `managing-worktrees` | メインに触れずに作業する Git ワークツリーを作り、リンクを先に外して安全に消す |
| `merging-subagent-work` | サブエージェントのブランチを、報告と差分の突き合わせ・決まりの確認・マージ後の再チェック・片付けを経て取り込む |

## フック

| いつ | 何をするか |
|---|---|
| SessionStart / SubagentStart | 依頼の言い回しとスキルの対応の短い案内（`lib/skill-guide.md`）を最初に差し込む。スキルを呼ばずに自力で答えてしまうのを減らす。組み込みの Explore や Plan にも届く |
| Write / Edit の後 | 編集したファイルの改行を `.gitattributes` の `eol=` に合わせる。eol 属性の無いファイルには触らない |
| SessionStart | 開始時の未コミットのファイルと内容を記録する（Stop で、セッション前からあったユーザーの変更を催促しないため） |
| PreToolUse（Bash / PowerShell） | `git commit` と `gh pr create/edit` に Claude の署名行（Co-Authored-By、Generated with Claude Code）が入っていたら実行前に止め、外して出し直させる |
| PreToolUse（Bash / PowerShell） | 取り返しのつかないコマンド（再帰的な削除、`push --force`、`reset --hard`、`clean -f`、`branch -D`、変更の破棄、`stash clear`、`DROP TABLE` など）と、コミットや push のチェック・署名を飛ばすフラグ（`--no-verify`、`commit -n`、`--no-gpg-sign`、`commit.gpgsign=false`）を、実行前にユーザーへ確認させる。生成物のフォルダ（`destructive.safeDirs`）だけを消す `rm` は確認しない |
| Stop | このセッションの間に変わった未コミットのファイルがあればコミットを求める。変更が大きい（既定は 10 ファイルか 400 行を超える）ときは、`making-minimal-changes` の手順で差分の見直しも求める（1 回の停止につき 1 度だけ）。すべてコミット済みなら、用済みのワークツリーの削除を求める。マージやリベースの途中、Git の外では何もしない |

フックはメインのチェックアウトとすべてのワークツリーを見る。

## スクリプト

スキルとフックが使う。直接も呼べる（`<plugin>` はインストール先）。

- `node <plugin>/lib/worktree.mjs add <name> | remove <path> [--force] | list`
- `node <plugin>/lib/fix-eol.mjs <path>... | --check [<path>...]`

## 設定

プロジェクトの `.claude/itsumo.json`（すべて省略可。下は既定値）:

```json
{
  "eol": true,
  "guide": true,
  "attribution": false,
  "destructive": {
    "confirm": true,
    "safeDirs": ["node_modules", "dist", "build", "target", "coverage", "test-results", ".next", ".turbo", ".cache", "__pycache__", ".pytest_cache"]
  },
  "stop": {
    "commit": true,
    "worktrees": true,
    "ignore": ["node_modules/", "dist/", "build/", "target/", "coverage/", "test-results/"],
    "largeDiff": { "files": 10, "lines": 400 }
  },
  "worktree": { "link": [], "base": null }
}
```

- `guide: false` でスキルの案内の差し込みを止める。
- `attribution: true` で署名行を許す（既定は止める）。
- `destructive.confirm: false` で、取り返しのつかないコマンドの確認を止める。
- `stop.commit: false` でコミットの催促を止める。
- `worktree.link` に `"node_modules"` などを入れると、新しいワークツリーへメインからリンクする（Windows はジャンクション）。
- 一時的に止めるなら環境変数 `ITSUMO_DISABLE=guide,eol,stop,destructive`（カンマ区切り）。

## 署名行（attribution）

Claude Code が自動で足す `Co-Authored-By: Claude ...`（コミット）と `Generated with Claude Code`（PR）は、プラグインの `settings.json` では消せない。代わりに PreToolUse フックで、署名行を含む `git commit` / `gh pr create` を止めている。設定で消したいなら、プロジェクトかユーザーの `settings.json` に `{ "attribution": { "commit": "", "pr": "" } }` を書く。

## 開発

テストと評価の走らせ方は、リポジトリ直下の [README.md](../../README.md) と [AGENTS.md](../../AGENTS.md)。
