# AGENTS.md

このリポジトリは、Claude Code プラグイン `itsumo` の配布元。中身は `plugins/itsumo/`（スキル、フック、共有スクリプト）で、インストール時にコピーされるのもここだけ。使い方は `plugins/itsumo/README.md`。

## 構成

| 場所 | 中身 |
|---|---|
| `.claude-plugin/marketplace.json` | マーケットプレイスの定義 |
| `plugins/itsumo/` | プラグイン本体。ここに置いたものは利用者に配られる |
| `tests/` | `lib/` と `hooks/` のユニットテスト。**プラグインの外に置く**（中に置くと配布物に入る） |
| `eval-suite/evals/` | スキルの評価ケース（`claude plugin eval` 用）。**プラグインの外に置く**。結果の `results/` は Git の対象外 |

## plugins を修正するとき

スキルの書き方は、公式のベストプラクティスを参考にする: https://platform.claude.com/docs/ja/agents-and-tools/agent-skills/best-practices

スキルを足す・直すときに特に守ること:

- `name` は 64 文字以内、小文字・数字・ハイフンのみ、`claude` と `anthropic` を含めない。XML タグを入れない。
- `description` は 1024 文字以内、三人称で、「何をするか」と「いつ使うか」の両方を具体的な言葉で書く。曖昧な説明（「文書を扱う」など）にしない。
- 本文は 500 行未満。超えるなら別ファイルに分け、SKILL.md から 1 階層で直接リンクする。100 行を超える参照ファイルには先頭に目次を付ける。
- 簡潔にする。Claude がすでに知っていること（一般的な説明、よくあるコマンドの意味）は書かず、このプロジェクト固有の判断と手順だけを書く。
- 壊れやすい手順は低い自由度（正確なコマンド）、判断が要る手順は高い自由度（方針だけ）で書く。選択肢を並べすぎず、既定を 1 つ示す。
- 複数ステップの作業にはチェックリストを付け、検証→修正→再検証のループを入れる。出力の形は入力→出力の例で示す。
- 用語を 1 つに決めてそろえる（例: 「ワークツリー」と「作業ツリー」を混ぜない）。時間で古くなる書き方（「2026 年までは〜」）をしない。
- パスは常にスラッシュで書く。前提のツール（Node.js、Git など）は書く。MCP ツールは `サーバー名:ツール名` で書く。
- スクリプトは失敗を自分で処理し、定数には根拠をコメントで書く（理由の無い数字を置かない）。スキルからは「実行する」のか「読む」のかをはっきり書く。
- 直したら、実際に Claude に使わせて確かめる。Haiku・Sonnet・Opus のどれでも動く書き方にする。

直した後に必ず走らせる:

```sh
node --test tests/lib.test.mjs
claude plugin validate plugins/itsumo --strict
claude plugin validate . --strict
```

フックやスクリプトを変えたら、テストを `tests/` に足す。ファイルは LF で書く。

## 評価（eval）

スキルが場面に合わせて呼ばれるか、回答が期待を満たすかを `claude plugin eval` で確かめる。ケースは `eval-suite/evals/<ケース名>/` に置く（`prompt.md` と `graders/*.md`）。各ケースの `plugins` で `plugins/itsumo` を指す。

```sh
claude plugin eval . --eval-dir eval-suite/evals --ablation none --no-publish --trust-plugin -j 4 --max-cost-usd 5
```

- スキルを足す・名前や `description` を変えたら、そのスキルのケースを足す・直して走らせる。スキルごとに「呼ばれる」ケース（`tool_used: Skill`）を 1 つ以上、必要なら回答の質を見る `llm` や `regex` の採点者を付ける。関係ない依頼で呼ばれないことを見るケース（`max: 0` と `min: 0`）も 1 つ置く。
- 1 ケースだけ試すには `--case <名前> --runs 1`（`--case` は 1 つだけ。複数指定すると最後のものだけが使われる）。モデルは `--model haiku|sonnet|opus` で変える。Haiku・Sonnet・Opus のどれでも確かめる。
- 全 10 ケースで、Sonnet は約 $0.5、Opus は約 $1、Haiku は数セント（1 回ずつ）。
- Windows では Bash を許可するケースは動かせない。ケースの `allowed_tools` は `Read, Glob, Grep, Skill` に限る。
- 直近の結果: Sonnet と Opus は全件通る。Haiku は説明文を強めた後も、スキルを呼ばずに自力で答えることがある（`committing-changes` `reviewing-security-boundaries` `running-regression-tests` で 3 回中 1〜2 回）。

## コミット

- **作業の区切りごとに、必ず自分でコミットする。** ファイルを変える作業は、コミットで終える。未コミットの変更を残したまま「完了」と報告しない。
- 区切りの目安: スキルを 1 つ足す・直す、フックやスクリプトを直してテストが通る、評価ケースを足して走らせた、名前の変更など複数ファイルにまたがる変更が終わった。大きな変更は、1 つのコミットに詰め込まず、意味のある単位に分ける。
- コミットの前に、上の「直した後に必ず走らせる」3 つのコマンドを走らせ、通ってからコミットする。落ちたまま、またはチェックを飛ばしてコミットしない（`--no-verify` も使わない）。
- コミットしてはいけない場合（ユーザーが止めた、自分のファイルではない、直せないチェックが落ちている）だけ、コミットせず、そのことと理由を報告に書く。
- `master` に直接コミットしない。作業用のブランチを切ってコミットする。
- コミットメッセージは**日本語**で書く。
- 1 行目は `feat:`、`fix:`、`chore:`、`docs:`、`refactor:`、`test:` のどれかで始め、72 文字以内、句点で終えない。
- 本文が要るときだけ、空行を挟んで最大 8 行の箇条書き（`- ` で始め、1 行 100 文字以内）。
- **`Co-Authored-By:` の行は付けない。** PR の説明にも「Generated with Claude Code」を付けない。
- 自分が変えたファイルだけをステージする。`.env*`、キー、生成物はコミットしない。
- 詳しい形は `plugins/itsumo/skills/committing-changes/SKILL.md`。
