---
type: llm
---
PASS if the answer says it will first read the existing code (users.ts, orders.ts, or similar files) and match its naming, structure, error handling and tests, and reuse existing helpers instead of writing from scratch or adding new libraries.
FAIL if it starts writing a generic implementation without looking at the existing files, or proposes new libraries or a new style.
