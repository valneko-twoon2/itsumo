---
type: llm
---
PASS if the answer proposes a commit message that: has a first line of at most 72 characters without a trailing period, says what the commit is (the rename of getUser to fetchUser), lists no files, and has no Co-Authored-By line.
FAIL if the first line is longer than 72 characters, ends with a period, lists files one by one, or contains a Co-Authored-By line.
