---
description: "fires-writing-pr-descriptions"
plugins: ["../../../plugins/itsumo"]
runs: 2
max_turns: 8
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
---
ブランチ fix/tax-rounding で、calcTax の端数を切り捨てから四捨五入に直した。この変更の PR の説明を書いて。
