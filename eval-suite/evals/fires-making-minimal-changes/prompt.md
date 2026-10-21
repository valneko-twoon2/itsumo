---
description: "fires-making-minimal-changes"
plugins: ["../../../plugins/itsumo"]
runs: 2
max_turns: 8
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
---
src/price.ts の calcTax が端数を切り捨てている。四捨五入に直すバグ修正をこれからやる。どこまで変えるべきか、進め方を教えて。
