---
type: llm
---
PASS if the answer proposes a plan split into stages where each stage keeps the system working (for example supporting both session and JWT during the transition before removing sessions), with a way to verify each stage, and asks for agreement or raises open decisions before implementing.
FAIL if it proposes switching everything at once, or starts writing the full implementation without a staged plan.
