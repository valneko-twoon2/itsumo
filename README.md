<div align="center">

# itsumo

**「いつもの定型作業」を、Claude Code に任せる。**

コミット、テスト、デバッグ、PR、セキュリティ確認、ワークツリー。<br>
毎回同じことを頼まなくても、場面に合わせて Claude が自分で手順を呼び出す。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-plugin-D97757)](https://code.claude.com/docs)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A5%2018-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Skills](https://img.shields.io/badge/skills-15-blue)](#スキル)
[![Hooks](https://img.shields.io/badge/hooks-6-blue)](#フック)

[インストール](#インストール) ・
[スキル](#スキル) ・
[フック](#フック) ・
[設定](#設定) ・
[開発](#開発)

</div>

---

## 特長

- **自動で呼ばれる**: 手動でコマンドを打たなくても、依頼の内容に合うスキルを Claude が選ぶ。`/itsumo:<名前>` で直接呼ぶこともできる。
- **プロジェクトを選ばない**: 特定の言語・フレームワークに依存しない。`AGENTS.md` や `CONTRIBUTING.md` などプロジェクト固有の決まりがあれば、そちらを優先する。
- **フックで強制する**: 「お願い」では守られにくいこと（署名行を付けない、改行コード、コミットし忘れ）は、フックで機械的に守らせる。
- **評価つき**: 各スキルが場面に合わせて呼ばれるかを `claude plugin eval` で確かめている。
- 🇯🇵 **日本語**: スキルの本文もメッセージも日本語。

## こんなことを防ぐ

| よくある困りごと | itsumo の対処 |
|---|---|
| 「ここだけ直して」が、整形や改名まで巻き込んだ大きな差分になる | `making-minimal-changes` が最小の差分に抑え、フックが大きな変更を見直させる |
| 新しいコードだけ、既存と作りが違う | `following-existing-code` が先に手本を読ませる |
| 原因が分からないまま、症状だけ消す修正をする | `investigating-bugs` が再現→仮説→確定の順を守らせる |
| 「直しました」と言うが、実は動かしていない | `running-regression-tests` が実行して確かめてから報告させる |
| 曖昧な依頼を、推測で作り込んでしまう | `clarifying-requests` が選択肢つきで聞き、答えが曖昧なら深掘りする |
| `rm -rf` や `push --force` を、確かめずに実行する | フックが実行前にあなたへ確認し、スキルが戻し方を用意させる |
| コミットに `Co-Authored-By: Claude` が付く | フックが実行前に止める |
| 作業して、コミットしないまま終わる | Stop フックがコミットを促す |

## インストール

```sh
claude plugin marketplace add valneko-twoon2/itsumo
claude plugin install itsumo@itsumo
```

セッションの中なら `/plugin marketplace add valneko-twoon2/itsumo` のあと、`/plugin` パネルから入れる。

**前提**: Node.js 18 以上と Git（フックとスクリプトが使う）。

## スキル

| スキル | こんなときに使う | 何をするか |
|---|---|---|
| `setting-up-project` | 最初の 1 回（手動で実行） | 既存のコードと文書を調べ、指示ファイル（AGENTS.md か CLAUDE.md）と、プロジェクト固有の rules / skills を作る。指示ファイルが既にあれば変えず、変更を提案する。空のプロジェクトでは質問から最小の指示ファイルを作る |
| `clarifying-requests` | 「いい感じにして」のような曖昧な依頼 | 選択肢と推奨を添えて聞く。自由記述の回答がまだ曖昧なら、決まるまで深掘りする |
| `planning-large-changes` | 複数のファイルにまたがる大きな作業 | 着手前に計画で合意を取り、各段階で全体が動く状態を保ってコミットしながら進める |
| `making-minimal-changes` | 既存のコードを直す・変える | 依頼に必要な最小の差分だけを入れる。ついでの整形・改名・リファクタをせず、気づいた別件は報告する |
| `following-existing-code` | 新しくコードを書く | 同じ役割の既存コードを先に読み、命名・構造・エラー処理・テスト・使う道具を合わせる |
| `refactoring-safely` | リファクタを頼まれた | 先にテストで振る舞いを固め、小さな段階ごとにテストを通してコミットする。機能の変更と混ぜない |
| `investigating-bugs` | 不具合の原因を調べる | 再現し、仮説を証拠で絞って、原因を確定してから直す |
| `running-regression-tests` | テストの扱い、完了の報告 | テストを足す・直す・消し、影響する範囲だけを走らせる。完了と言う前に実行して確かめ、成功・失敗・未実行を分けて報告する |
| `designing-test-cases` | テストケースを選ぶ | 同値分割、境界値、条件網羅、プロパティ、状態遷移、デシジョンテーブル、ペアワイズ |
| `reviewing-security-boundaries` | API、URL、パス、プロセス起動などを足す | 共通の確認表に加えて、Web 用とデスクトップ用の表を持つ |
| `committing-changes` | コミットする | 自分の変更だけをステージし、要点が先に来る短いメッセージで書く |
| `writing-pr-descriptions` | PR を作る | 概要・背景・変更点・確認・見てほしい点の順で書く。署名行は付けない |
| `handling-destructive-operations` | 削除、強制 push、DB の書き換えなど | 対象を見て、弱い操作で足りないか考え、戻し方を用意し、了承を得てから実行する |
| `managing-worktrees` | 並行して作業する | メインに触れない Git ワークツリーを作り、リンクを先に外して安全に消す |
| `merging-subagent-work` | サブエージェントの成果を取り込む | 報告と差分の突き合わせ、決まりの確認、マージ後の再チェック、片付け |

## フック

| いつ | 何をするか |
|---|---|
| セッション・サブエージェントの開始 | 依頼の言い回しとスキルの対応の短い案内を最初に差し込む。スキルの呼び忘れを減らす |
| ファイル編集の後 | 改行コードを `.gitattributes` の `eol=` に合わせる |
| コミット・PR の作成の前 | `Co-Authored-By: Claude` や `Generated with Claude Code` が入っていたら止める |
| 危険なコマンドの前 | 再帰的な削除、`push --force`、`reset --hard`、`DROP TABLE` などと、`--no-verify` や `--no-gpg-sign` でチェックや署名を飛ばす操作を、実行前にあなたに確認させる |
| 作業を終えるとき | 未コミットの変更があればコミットを促す。変更が大きいときは、最小の変更の見直しも促す。用済みのワークツリーの削除も促す |

> [!NOTE]
> セッションの前からあった、あなた自身の未コミットの変更には催促しない（開始時に記録して、差分だけを見る）。

## スクリプト

スキルとフックが使う。直接も呼べる（`<プラグインのフォルダ>` はインストール先）。

- `node <プラグインのフォルダ>/lib/worktree.mjs add <name> | remove <path> [--force] | list`
- `node <プラグインのフォルダ>/lib/fix-eol.mjs <path>... | --check [<path>...]`

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

## 構成

```
.
├── .claude-plugin/marketplace.json   マーケットプレイスの定義
├── skills/                           スキル
├── hooks/                            フック
├── lib/                              フックとスクリプトの共有コード
├── .claude-plugin/plugin.json        プラグインの定義
├── tests/                            ユニットテスト
└── eval-suite/evals/                 スキルの評価ケース
```

## 開発

```sh
node --test tests/lib.test.mjs                 # ユニットテスト
claude plugin validate . --strict              # プラグインとマーケットプレイスの検証
```

スキルが場面に合わせて呼ばれるかの評価:

```sh
claude plugin eval . --eval-dir eval-suite/evals --ablation none --no-publish --trust-plugin -j 4
```

プラグインを直すときの決まりは [AGENTS.md](AGENTS.md)、変更の履歴は [CHANGELOG.md](CHANGELOG.md)。

## ライセンス

[MIT](LICENSE)
