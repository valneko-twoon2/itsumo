---
description: "fires-reviewing-security-boundaries-web"
plugins: ["../../../plugins/itsumo"]
runs: 2
max_turns: 8
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
---
Express で、メールとパスワードのログイン API とセッションを実装する。セキュリティ上、何を確認して実装すればいい？
