---
type: llm
focus: { source: file, path: docs/architecture/target-design.md }
---

PASS if the design (1) compares at least two alternatives including the existing single-process SQLite application, (2) rejects or defers microservices/Kafka with a reopen trigger grounded in the documented workload and staffing constraints, (3) defines atomic ownership of a freed place by one member without double booking, and (4) defines expiry detection and onward allocation. If the interaction of the two-hour confirmation window with the one-hour cutoff is unresolved, an exact product decision, explicitly conditional alternatives, and INCOMPLETE readiness are valid; inventing a settled policy is not required.
FAIL if it adopts new services, brokers or infrastructure without a requirement that pays for them, omits the exactly-one-offer mechanism or the expiry handling, or consists mainly of implementation code rather than boundaries, contracts and tradeoffs.
