---
type: llm
---
PASS if the answer points out that the file name must be validated against path escapes (such as ../, absolute paths, drive names) so that files stay inside a fixed folder, and mentions a size limit.
FAIL if it only talks about authentication or generic advice and does not mention path escapes.
