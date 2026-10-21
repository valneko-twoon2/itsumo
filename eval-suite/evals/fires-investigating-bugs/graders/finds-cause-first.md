---
type: llm
---
PASS if the answer says to reproduce the problem and identify the cause with evidence (logs, the error message, git history since it worked yesterday) before changing code, and does not jump straight to a fix.
FAIL if it proposes a fix first (such as adding a try/catch or null check) without establishing the cause.
