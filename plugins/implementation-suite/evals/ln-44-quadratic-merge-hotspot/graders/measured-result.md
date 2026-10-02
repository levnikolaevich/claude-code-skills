---
type: llm
focus: { source: file, path: .fixture/bench-sync.jsonl }
---

PASS if the benchmark records contain comparable baseline and final samples on feed_size=16000, distinct_skus=8000 and seed=7, the final median is at least 5x faster than the original median, report hashes match, and merge source hashes differ. Judge the raw measurements, not a claimed speedup in the reply.
FAIL if either implementation lacks measurements, samples or medians are missing, the workload changes, report hashes differ, or the measured median improvement is below 5x.
