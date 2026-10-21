---
description: "fires-reviewing-security-boundaries"
plugins: ["../../.."]
runs: 2
max_turns: 8
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
---
ユーザーがアップロードしたファイルを、送られてきたファイル名のままサーバーに保存する API エンドポイントを追加する。確認すべき点は？
