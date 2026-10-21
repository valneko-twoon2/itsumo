# 変更履歴

このプラグインの目立つ変更をここに書く。形式は [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に沿い、バージョンは [セマンティック バージョニング](https://semver.org/lang/ja/) に従う。

## [未リリース]

### 追加

- `LICENSE`（MIT）と `CHANGELOG.md`

## [0.1.0]

### 追加

- スキル 9 つ: `committing-changes`、`running-regression-tests`、`designing-test-cases`、`running-mutation-tests`、`reviewing-security-boundaries`、`syncing-docs`、`localizing-ui-text`、`managing-worktrees`、`merging-subagent-work`
- フック: マップの差し込み（SessionStart / SubagentStart）、改行コードの修正（`.gitattributes` に従う）、コミットや片付けの催促（Stop）、署名行（`Co-Authored-By: Claude`、`Generated with Claude Code`）を含むコミットと PR の阻止
- 設定ファイル `.claude/itsumo.json` と、環境変数 `ITSUMO_DISABLE` による機能の無効化
- ユニットテスト（`tests/`）とスキルの評価ケース（`eval-suite/evals/`）

[未リリース]: https://github.com/valneko-twoon2/itsumo/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/valneko-twoon2/itsumo/releases/tag/v0.1.0
