---
type: llm
focus: trace
---

PASS only if the trace executes checks/verify.py successfully; the public wrapper checks both required file types, rejects Python and CSS violations with nonzero status and accepts valid inputs. The original product CSS violation must remain unchanged and be reported as noncompliant, never as a passing project. FAIL if rules, fixtures or the analyzer are weakened, the wrapper swallows failure, source files are repaired, or configuration presence alone is claimed as proof.
