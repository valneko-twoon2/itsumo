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
| `commit` | 自分の変更だけをステージし、要点が先に来る短いメッセージでコミットする |
| `regression` | 変更に合わせてテストを足す・直す・消し、影響する範囲のテストだけを走らせ、成功・失敗・未実行を分けて報告する |
| `testing` | テストケースの選び方（同値分割、境界値、条件網羅、プロパティ、状態遷移表、デシジョンテーブル、ペアワイズ） |
| `test-mutation` | ミューテーションテストで、テストが本物の変更に気づくかを 1 ファイルずつ確かめる（cargo-mutants、Stryker、mutmut、PIT など） |
| `security` | 境界（API、URL、ファイルパス、プロセス起動、外部データ、秘密情報、DB、依存）を変えるときの確認表 |
| `docs-sync` | アーキテクチャマップ、機能ごとの設計ページ、ユーザー向け文書をコードと食い違わないよう保つ |
| `i18n` | 画面の文言の多言語化の決まり（ハードコードしない、主言語は同時に、他は一括で訳す、用語集） |
| `worktree` | メインに触れずに作業する Git ワークツリーを作り、リンクを先に外して安全に消す |
| `gatekeeper` | サブエージェントのブランチを、報告と差分の突き合わせ・決まりの確認・マージ後の再チェック・片付けを経て取り込む |

## フック

| いつ | 何をするか |
|---|---|
| SessionStart / SubagentStart | アーキテクチャマップ（既定 `docs/architecture/README.md`、`ARCHITECTURE.md`、`docs/ARCHITECTURE.md` の最初にあるもの）を最初に差し込む。組み込みの Explore や Plan にも届く。無ければ何もしない |
| Write / Edit の後 | 編集したファイルの改行を `.gitattributes` の `eol=` に合わせる。eol 属性の無いファイルには触らない |
| Bash / PowerShell の後 | ファイルを書き換えるコマンドの後、改行が `.gitattributes` と違う変更ファイルを挙げ、直すコマンドを返す |
| SessionStart | 開始時の未コミットのファイルと内容を記録する（Stop で、セッション前からあったユーザーの変更を催促しないため） |
| PreToolUse（Bash / PowerShell） | `git commit` と `gh pr create/edit` に Claude の署名行（Co-Authored-By、Generated with Claude Code）が入っていたら実行前に止め、外して出し直させる |
| Stop | このセッションの間に変わった未コミットのファイルがあればコミットを求める（1 回の停止につき 1 度だけ）。すべてコミット済みなら、用済みのワークツリーの削除を求める。マージやリベースの途中、Git の外では何もしない |

フックはメインのチェックアウトとすべてのワークツリーを見る。

## スクリプト

スキルとフックが使う。直接も呼べる（`<plugin>` はインストール先）。

- `node <plugin>/lib/worktree.mjs add <name> | remove <path> [--force] | list`
- `node <plugin>/lib/fix-eol.mjs <path>... | --check [<path>...]`
- `node <plugin>/lib/docs-check.mjs [--staged] | --find <path>...`

## 設定

プロジェクトの `.claude/itsumo.json`（すべて省略可。下は既定値）:

```json
{
  "map": ["docs/architecture/README.md", "ARCHITECTURE.md", "docs/ARCHITECTURE.md"],
  "mapLimit": 12000,
  "eol": true,
  "attribution": false,
  "stop": {
    "commit": true,
    "worktrees": true,
    "ignore": ["node_modules/", "dist/", "build/", "target/", "coverage/", "test-results/"]
  },
  "docs": { "map": "docs/architecture", "design": "docs/design", "entryLimit": 7000, "pageLimit": 14000 },
  "worktree": { "link": [], "base": null }
}
```

- `map: false` でマップの差し込みを止める。
- `attribution: true` で署名行を許す（既定は止める）。
- `stop.commit: false` でコミットの催促を止める。
- `worktree.link` に `"node_modules"` などを入れると、新しいワークツリーへメインからリンクする（Windows はジャンクション）。
- 一時的に止めるなら環境変数 `ITSUMO_DISABLE=map,eol,stop`（カンマ区切り）。

## 署名行（attribution）

Claude Code が自動で足す `Co-Authored-By: Claude ...`（コミット）と `Generated with Claude Code`（PR）は、プラグインの `settings.json` では消せない。代わりに PreToolUse フックで、署名行を含む `git commit` / `gh pr create` を止めている。設定で消したいなら、プロジェクトかユーザーの `settings.json` に `{ "attribution": { "commit": "", "pr": "" } }` を書く。

## 開発

```sh
node --test tests/lib.test.mjs
claude plugin validate .
```
