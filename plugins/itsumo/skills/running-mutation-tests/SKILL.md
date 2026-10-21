---
name: running-mutation-tests
description: "ミューテーションテストで、テストが本物の変更に気づくかを 1 ファイルずつ確かめ、見逃したミュータントをテストにするか、理由付きの除外にする（Rust は cargo-mutants、JS/TS は StrykerJS、Python は mutmut、Java は PIT、Go は gremlins など）。あるモジュールのテストを書いた・変えた後、またはテストが弱そうなときに使う。"
argument-hint: "確かめるファイル（例: src/settings.rs）"
---

何を走らせるかは `/itsumo:running-regression-tests`、ケースの選び方は `/itsumo:designing-test-cases`。テストを通すために既存のテストを弱めたり消したりしない。

## 1. 前提

- 遅い。ミュータント 1 つごとにテストスイートを走らせるので、1 ファイルで数分から数時間かかる。普段のチェックや CI には入れず、テストに穴を残しうるモジュールにだけ走らせる。
- 結果は 4 つ: 捕捉（テストが落ちた）、見逃し（落ちなかった: 穴）、タイムアウト、実行不能（コンパイルできない）。

## 2. 道具

プロジェクトに設定済みのスクリプトや設定ファイルがあればそれを使う。無ければ:

| 言語 | 道具 | 1 ファイルの実行例 |
|---|---|---|
| Rust | cargo-mutants（`cargo install cargo-mutants`） | `cargo mutants -f src/<path>.rs`（結果は `mutants.out/` の `missed.txt`、`caught.txt`、`timeout.txt`、`unviable.txt`。除外は `.cargo/mutants.toml`） |
| JS/TS | StrykerJS（`@stryker-mutator/core` と使うテストランナーのプラグイン） | `npx stryker run --mutate src/<path>.ts`（結果は `reports/mutation/`） |
| Python | mutmut | `mutmut run --paths-to-mutate <path>.py` の後 `mutmut results`、`mutmut show <id>` |
| Java/Kotlin | PIT（pitest） | `targetClasses` を 1 クラスに絞って `mvn org.pitest:pitest-maven:mutationCoverage` |
| Go | gremlins、go-mutesting | 対象パッケージを指定して実行 |
| C# | Stryker.NET | `dotnet stryker --mutate <path>.cs` |

依存やツールを入れるのはプロジェクトの方針に従い、勝手に依存へ足す前にユーザーに確かめる。

## 3. 1 ファイルを走らせる

1. ファイルを 1 つ選ぶ。まず自分が変えたファイル。その領域で以前に見つかったものを示すテスト（`mutation_*` などの名前）があれば先に読む。
2. 時間がかかるのでバックグラウンドで始め、終わってから結果を読む。
3. 見逃し・捕捉・タイムアウト・実行不能の件数と、見逃しの一覧を読む。

## 4. 見逃したミュータントを 1 つずつ扱う

| 判定 | すること |
|---|---|
| 本物の振る舞いがテストされていない（上限、分岐、エラー経路） | このミュータントで落ち、本物のコードで通るテストを足す。既存の流儀に合わせ、規則にちなんで名付ける |
| ミュータントが振る舞いを変えない（コードと等価） | 残し、理由と共に報告で名指す |
| 本物のプロセス、ネットワーク、GPU、実環境が要る | 道具の設定ファイルで除外し、理由をそのファイルに書く。実行してノイズだと分かってからだけ |
| タイムアウト | まず見る。終わらないループはコードかテストの本物の発見。原因を直すか、理由付きで除外する |

除外には必ず理由を付ける。

## 5. 確かめる

1. 同じファイルをもう一度走らせる。見逃しは空か、名指した等価ミュータントだけのはず。
2. ファイルごとに報告する: 捕捉・見逃し・タイムアウト・実行不能の件数、足したテスト、足した除外とその理由。1 ファイルの結果でモジュール全体やクレート全体を網羅済みと言わない。

依頼: $ARGUMENTS
