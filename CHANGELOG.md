# 変更履歴

このプラグインの目立つ変更をここに書く。形式は [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に沿い、バージョンは [セマンティック バージョニング](https://semver.org/lang/ja/) に従う。

## [未リリース]

### 変更

- 完了前の確認に「利用者に見える変更なら文書も直す」を足した（running-regression-tests）
- スキルの例や前提から、特定のプロジェクトに偏った表現（画像生成の例、設計ページなど）を除いた
- 開始時のスキルの案内で、セキュリティの確認が呼ばれやすいように言い回しを足した

### 修正

- 追跡中のファイルを消した作業で、Stop フックのコミットの催促が出なくなる不具合を直した
- コミットや PR のメッセージ、`echo` の引数に `git reset --hard` や `rm -rf` などの名前を書いただけで、実行前の確認が出ていたのを直した（`psql -c "DROP TABLE ..."` のように実行される文字列は、これまで通り確認する）
- Stop フックが、ユーザーや他のセッションが作ったワークツリーの削除まで促していたのを、そのセッションで作ったものだけにした

## [1.0.0] - 2026-10-21

### 追加

- スキル 15 個: `committing-changes`、`running-regression-tests`、`making-minimal-changes`、`following-existing-code`、`refactoring-safely`、`investigating-bugs`、`writing-pr-descriptions`、`handling-destructive-operations`、`clarifying-requests`、`planning-large-changes`、`setting-up-project`（手動で実行する初回のセットアップ）、`designing-test-cases`、`reviewing-security-boundaries`、`managing-worktrees`、`merging-subagent-work`
- フック: 依頼とスキルの対応の案内の差し込み（SessionStart / SubagentStart）、改行コードの修正（`.gitattributes` に従う）、コミットや片付けの催促（Stop。変更が大きいときは最小の変更の見直しも）、署名行（`Co-Authored-By: Claude`、`Generated with Claude Code`）を含むコミットと PR の阻止、取り返しのつかないコマンドと、チェックや署名を飛ばすフラグ（`--no-verify` など）の実行前の確認
- 設定ファイル `.claude/itsumo.json` と、環境変数 `ITSUMO_DISABLE` による機能の無効化
- `LICENSE`（MIT）と `CHANGELOG.md`
- ユニットテスト（`tests/`）とスキルの評価ケース（`eval-suite/evals/`）

[未リリース]: https://github.com/valneko-twoon2/itsumo/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/valneko-twoon2/itsumo/releases/tag/v1.0.0
