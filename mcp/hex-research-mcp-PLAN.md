# hex-research-mcp — План создания

> **Автор плана:** Claude (Cowork) при участии Lev Nikolaevich
> **Связанные пакеты:** `@levnikolaevich/hex-common`, `@levnikolaevich/hex-graph-mcp`
>
> **Приложение A** — примеры файлов после миграции (H##.md, G##.md).
> **Приложение B** — пример MCP wire format (B.1) и human-readable rendering (B.2).
> **Приложение C** — архитектурное обоснование: сравнение с прайор-артом, FAIR-aligned coverage, reproducibility checklist.
> **Приложение D** — каталог заимствованных паттернов из изученных продуктов с обоснованием каждого решения.

## Implementation Status

**Current state (2026-05-08): MVP implemented and committed.**

- Implementation commit: `63b5439 feat(mcp): add hex research server MVP`.
- Implemented package: `mcp/hex-research-mcp`.
- Workspace wiring: `mcp/package.json` includes the new `hex-research-mcp` workspace and root test script coverage.
- Implemented MCP surface: all 15 tools from this plan are registered with strict Zod input schemas, output schemas, and explicit annotations.
- Implemented storage/indexing: markdown hypotheses/goals and run manifests are indexed into `.hex-skills/researchgraph/index.db` with SQLite tables, FTS, synthetic nodes, edges, tasks, sources, and comprehensive-run goal metrics.
- Implemented validation: status/task invariants, `decision: refine` handling, status-verdict drift, run manifest distinctions between targeted and comprehensive runs, lowercase `reason`/`warnings[].code` wire contract.
- Implemented docs/tests: `README.md`, `PROTOCOL.md`, fixture corpus, smoke/schema/indexing/tools/audit/export tests.
- Verification passed before the implementation commit: `npm --prefix mcp --workspace @levnikolaevich/hex-research-mcp test`, `run check`, `run lint`, `run build`, `npm --prefix mcp test`, `npm --prefix mcp audit --audit-level=moderate`, and `git diff --check`.

**MVP scope notes.** The committed MVP intentionally excludes btc-trader migration, npm publish, Phase 7 pull-up into `hex-common`, and a new skill package. Those remain follow-up work. The historical design below still describes the broader release vision; when it conflicts with the committed MVP, this status block is authoritative for the current repository state.

**Dependency snapshot note.** The plan target was latest stable npm packages as of 2026-05-08. The committed package uses current workspace-compatible versions and root overrides: MCP SDK `^1.29.0`, `better-sqlite3 ^12.9.0`, `chokidar ^5.0.0`, `gray-matter ^4.0.3`, `picomatch ^4.0.4`, and `zod ^4.3.6`. `npm view zod version` reports `4.4.3`; bumping the workspace-wide Zod override to `^4.4.3` should be handled as a separate dependency-maintenance change if required.

## 0. TL;DR

Создаём четвёртый пакет в семье `hex-*` — `@levnikolaevich/hex-research-mcp`. Это **MCP-сервис для goal-directed дерева исследования**, дополняющий `hex-graph-mcp` (код) и опирающийся на `hex-common` (runtime, output-contract, hash, file-text).

Ключевые принципы:

1. **Goal-directed navigation.** В корне дерева — измеримая цель (`Goal`, `docs/goals/G##.md`) с конкретными метриками (Calmar, DD и т.п.). Каждая гипотеза явно ссылается через `goals: [G##]` field на цели которым служит. `inspect_goal G1` отвечает «насколько мы близко к цели». См. §1.5, §4.4.
2. **Source of truth — markdown с YAML frontmatter.** Гипотезы — `docs/hypotheses/H##.md`, цели — `docs/goals/G##.md`. Коммитится в git. SQLite-индекс — rebuildable cache в `.hex-skills/researchgraph/index.db` (`.gitignored`).
3. **Тяжёлые результаты — отдельные артефакты** в `benchmark/runs/<run_id>/` (JSON / parquet / графики). Гипотеза ссылается на них по path; индекс знает мост `hypothesis → run → metrics`.
4. **Методология — Strong Inference (Platt 1964)** с расширениями: 16 edge-types (см. §6) — H↔H (`parent_of`, `refines`, `supersedes`, `refutes`, `competes_with`, `depends_on`, `blocks`), H↔Run/Symbol/Branch/Metric/Task/Source (`tested_by`, `implemented_in`, `runs_in`, `gated_by`, `tracked_by`, `cites`), Goal (`serves_goal`, `decomposes_goal`, `achieves`).
5. **Кросс-walk с кодом** через `workspace_qualified_name` — те же canonical selectors, что у `hex-graph-mcp`.
6. **Pull-up в hex-common** делается по факту появления второго потребителя (store, watcher, cycles, output-contract — см. §11).
7. **MCP — навигация и память, не автономия.** Решения «что тестировать дальше» принимает человек+Claude в conversation, используя tools для извлечения контекста. См. §14.3.

Первичный validation target — `btc-trader`: 33 гипотезы из `docs/research-map.md` индексируются вместе с 1 целью из `docs/objective.md` (конвертированной в `docs/goals/G1.md`); пакет отдаёт 15 tool-surface, drift-проверка, кросс-walk pointers на `hex-graph-mcp`.

### 0.1. Универсальность vs конкретные примеры

**hex-research-mcp — domain-agnostic.** Schema не знает про Calmar, drawdown, ML metrics, p-values, Bayesian priors, или какой-либо конкретный domain. Tools оперируют на абстрактных полях:

- `Goal.metrics_target.primary: { <metric_name: string>: <threshold_expr: string> }` — произвольные имена и пороги
- `Hypothesis.gate.results.<level>.<metric_name>: <number>` — произвольные numeric metrics
- `Run.comprehensive: bool` + `included_hypotheses: [string]` — universal coherence flag

Aggregation алгоритм (§4.4.3) работает для любого домена где есть:
1. Цель с измеримыми метриками
2. Несколько компонентов которые могут быть «live» одновременно
3. Способ запустить их все вместе и получить совместные метрики

Это покрывает ML training pipelines, drug discovery, A/B testing, climate modeling, supply chain optimization, algorithmic trading — любую goal-directed research deathmarch.

**btc-trader — это конкретный validation target и иллюстрация.** Все примеры в этом плане (H04 funding filter, G1 Calmar/DD, comprehensive runs на master branch) взяты из `btc-trader` потому что:

1. План валидируется на реальном проекте (§15 DoD: «33 гипотезы из btc-trader индексируются за <2с»)
2. Без конкретики методологические тонкости (типа «fictional aggregation») нельзя объяснить
3. Lev — primary user, его use case — primary acceptance criterion

Если читаешь Calmar/DD/funding/L4-L5 — это btc-trader specifics, иллюстрация. Если читаешь `metrics_target`/`gate.results`/`comprehensive`/`serves_goal` — это universal schema.

---

## 1. Контекст и мотивация

### 1.1. Проблема

В `btc-trader` уже накопилось 33 гипотезы (H01–H33) в одном плоском markdown (`docs/research-map.md`, ~1200 строк). Каждая содержит mechanism / test / gate / status / subsystem / source плюс зависимости через ASCII-граф в конце файла. Дальнейший рост приведёт к:

- потере связности (ASCII-стрелки руками не масштабируются)
- невозможности быстрых запросов («какие гипотезы прошли L4 ≥ 80%?»)
- дрейфу между описанием гейта и реальными результатами sweep'ов
- слабой связи с реализацией в коде (`subsystem:` — текстовая ссылка, не отслеживается)

### 1.2. Методологическая основа

То, что Lev делает на практике — это **Strong Inference** (John R. Platt, *Science*, 1964): дерево альтернативных гипотез, crucial experiments на каждой развилке, отвергнутые ветки сохраняются в реестре, валидированные порождают подгипотезы. Это и есть формальная рамка, которую дерево гипотез воплощает.

Сопутствующие фреймворки, которые включаются опционально через расширения схемы:
- **Opportunity Solution Tree** (Teresa Torres) — outcome → opportunity → solution → experiment
- **Bayesian belief network** — `prior_belief` + `confidence_post` для калибровки
- **IBIS / Argument Mapping** — узлы Issue / Position / Argument через edges типа `refutes` (`supports`/argument-mapping расширения — кандидат на v1.0+ через `arguments: []` field, см. D.2 справочно)

### 1.3. Цель пакета

Дать AI-агенту (Claude, Cursor, Cody, любой MCP-клиент) ту же интероперабельность с **деревом исследования**, которую `hex-graph-mcp` даёт с **кодом**: дешёвые, детерминированные, summary-first запросы вместо чтения 1000-строчного markdown-файла.

### 1.4. FAIR-aligned дизайн

План следует [FAIR Guiding Principles (Wilkinson et al. 2016)][wilkinson-fair] как engineering direction, но не заявляет полную FAIR compliance без PID/license/access-rights слоя:

- **Findable** — канонический `id` (H##, G##), FTS5 индекс по claim/mechanism/tags
- **Accessible** — plain markdown без зависимости от инструмента (даже без `hex-research-mcp` файлы читаемы)
- **Interoperable** — open YAML / JSON Canvas / Mermaid; никакого proprietary lock-in
- **Reusable** — `evidence` + `runs` ссылки на воспроизводимые артефакты; `git_commit` в каждом run manifest позволяет пересобрать любой результат

### 1.5. Goal-directed research navigation

Принципиальное концептуальное решение: дерево исследования не «висит в воздухе», а **тянется измеримой целью**. Цель формализуется как первоклассный node-kind `Goal` (`docs/goals/G##.md`), параллельный `Hypothesis`. Каждая гипотеза явно декларирует `goals: [G##]` — какой цели служит.

**Семантика.** Goal — это то, к чему мы стремимся (e.g. «Production-ready BTC long-only с Calmar ≥ 2.0 и max_drawdown ≤ 25%»). Hypothesis — это **ставка на путь** к цели (e.g. «funding-rate ENTRY filter улучшит Calmar на ≥0.15»). Цель имеет **измеримые метрики**, которые `inspect_goal` берёт из **latest comprehensive run** покрывающего все live-гипотезы цели (см. §4.4.3 для алгоритма; не «best-per-metric от разных runs» — это даёт fictional config):

```
inspect_goal G1
metrics_target: { calmar: ">=2.0", max_drawdown: "<=25%" }
metrics_current: { calmar: 2.34, max_drawdown: -23.4 }   # из run 2026-05-07_master_combo_l4
achievement: { primary: 2/2, secondary: 1/2, verdict: "primary_achieved" }
hypotheses: { linked: 12, status_live: 4, in_progress: 2, not_started: 6 }
provenance: { source: "comprehensive_run", run_id: "2026-05-07_master_combo_l4", git_commit: "5eba9d6" }
```

**Распределение ответственности (важно):**

| Кто/что | Зона ответственности |
|---|---|
| **Человек (Lev)** | Формулирует цель, оценивает её актуальность, решает каждый раз «что брать следующим из ranked backlog» |
| **Claude в conversation** | Помогает рассуждать о вариантах, генерировать гипотезы, формулировать гейты, интерпретировать результаты |
| **`hex-research-mcp`** | Память + карта: хранит, индексирует, отвечает на запросы о текущем состоянии дерева; берёт `metrics_current` из latest comprehensive run покрывающего live-гипотезы цели (§4.4.3); flag'ит расфокус через `audit_goal_alignment` |

То есть **MCP — это навигационный инструмент**, а не автономный агент. Метафора амёбы корректна для **связки человек+Claude**: они выкидывают ложноножки (новые гипотезы), MCP — это пространственная память амёбы (где была, что нашла, куда не стоит ползти повторно). См. §14.3 — автономность не входит в scope.

**Workflow в общих чертах:**

```
1. Lev формулирует G1 → docs/goals/G1.md (измеримые primary/secondary metrics)
2. Lev + Claude в conversation: "что попробовать первым для G1?"
   → агент вызывает find_hypotheses goal=G1 status=not_started priority_tier=1
   → MCP отдаёт ranked backlog с rationale
3. Lev выбирает H##, тестирует через свой /btc-experiment workflow
4. Lev + Claude заполняют gate.results, last_verdict.decision
5. Если decision=proceed → запустить comprehensive run на master с обновлённой live-комбинацией; следующий `index_hypotheses` обновит `goals.metrics_current` для G1 из этого нового run; `inspect_goal G1` показывает свежий snapshot
6. Если decision=pivot → создаётся docs/hypotheses/H##.md с parents: [previous] и goals: [G1]
7. audit_goal_alignment периодически — нет ли осиротевших или расфокусированных
8. Когда `metrics_current` (из latest comprehensive run) покрывает все `metrics_target.primary` → goal `status: achieved`
```

Это превращает hex-research-mcp из «filing system гипотез» в **goal-directed research navigation system**.

---

## 2. Архитектура и место в семье hex-*

```
@levnikolaevich/hex-common (workspace, private)
  ├── runtime/mcp-bootstrap        ← переиспользуется
  ├── runtime/results              ← переиспользуется
  ├── runtime/error-classifier     ← переиспользуется
  ├── runtime/schema (Zod)         ← переиспользуется
  ├── output/normalize             ← переиспользуется (PROTOCOL grammar)
  ├── text-protocol/hash           ← переиспользуется (incrementality)
  ├── text/file-text               ← переиспользуется
  ├── parser/tree-sitter           ← НЕ используется research-mcp
  ├── parser/languages             ← НЕ используется
  ├── parser/outline               ← НЕ используется
  └── git/semantic-diff            ← опционально (для analyze_progress)

@levnikolaevich/hex-graph-mcp (published)
  └── имеет: store.mjs, watcher.mjs, cycles.mjs ← кандидаты на pull-up

@levnikolaevich/hex-research-mcp (NEW)
  ├── server.mjs                   ← MCP server (stdio)
  ├── lib/
  │   ├── store.mjs                ← SQLite (копия hex-graph + research schema)
  │   ├── watcher.mjs              ← chokidar (копия hex-graph)
  │   ├── cycles.mjs               ← graph cycles (копия hex-graph)
  │   ├── frontmatter-parser.mjs   ← gray-matter + Zod валидация
  │   ├── schema/
  │   │   ├── hypothesis.mjs       ← Zod schema гипотезы
  │   │   ├── goal.mjs             ← Zod schema цели
  │   │   ├── task.mjs             ← Zod schema task reference
  │   │   ├── source.mjs           ← Zod schema external source
  │   │   ├── evidence.mjs         ← Zod schema evidence
  │   │   ├── run.mjs              ← Zod schema run reference
  │   │   └── tool-outputs.mjs     ← Zod outputSchema для каждого из 15 tools (§8.3)
  │   ├── tools/
  │   │   # Hypothesis tools
  │   │   ├── index_hypotheses.mjs
  │   │   ├── find_hypotheses.mjs
  │   │   ├── inspect_hypothesis.mjs
  │   │   ├── trace_lineage.mjs
  │   │   ├── find_evidence.mjs
  │   │   ├── find_runs.mjs
  │   │   ├── analyze_topology.mjs
  │   │   ├── audit_orphans.mjs
  │   │   ├── analyze_progress.mjs
  │   │   ├── analyze_proposed.mjs
  │   │   ├── verify_index.mjs
  │   │   ├── export_canvas.mjs
  │   │   # Goal tools
  │   │   ├── inspect_goal.mjs
  │   │   ├── trace_goal_tree.mjs
  │   │   └── audit_goal_alignment.mjs
  │   └── render/
  │       ├── canvas.mjs           ← JSON Canvas (Obsidian)
  │       └── mermaid.mjs          ← Mermaid graph для research-map.md
  ├── PROTOCOL.md                  ← research-extension grammar
  ├── README.md                    ← в стиле hex-graph
  ├── HEX_RESEARCH_AGENTS.md       ← ACP-agent onboarding contract (см. Appendix D, pattern D4)
  ├── package.json
  ├── test/                        ← node:test, semantic suite
  ├── evals/                       ← capability matrix, quality targets
  ├── benchmark/                   ← workflow token-savings benchmark
  └── scripts/                     ← generate-quality-report, sync-quality-docs, migrate-research-map
```

### 2.1. Зависимости

```json
{
  "name": "@levnikolaevich/hex-research-mcp",
  "version": "0.1.0",
  "type": "module",
  "main": "server.mjs",
  "bin": { "hex-research-mcp": "server.mjs" },
  "dependencies": {
    "@levnikolaevich/hex-common": "workspace:*",
    "@modelcontextprotocol/sdk": "^1.29.0",
    "better-sqlite3": "^12.9.0",
    "chokidar": "^5.0.0",
    "gray-matter": "^4.0.3",
    "picomatch": "^4.0.4",
    "zod": "^4.4.3"
  }
}
```

Версии MCP npm-зависимостей в примере отражают latest stable на момент ревизии 2026-05-08 (`npm view`: SDK 1.29.0, better-sqlite3 12.9.0, chokidar 5.0.0, gray-matter 4.0.3, picomatch 4.0.4, zod 4.4.3). Runtime policy: Node.js — latest compatible stable, production default = latest Active LTS (Node 24 на 2026-05-08); Current Node 26 разрешён только после CI на native deps. При реализации обновлять до latest stable; pre-release/beta/alpha брать только по явному решению.

`gray-matter` — единственная новая внешняя зависимость относительно `hex-graph-mcp`.

---

## 3. Источник правды и хранение тяжёлых результатов

### 3.1. Раскладка в проекте-потребителе (например, `btc-trader/`)

```
btc-trader/
├── docs/
│   ├── goals/                     ← goal-directed navigation
│   │   ├── G1.md                  ← committed (root goal)
│   │   └── G1.1_signal.md         ← committed (sub-goal, опц.)
│   ├── hypotheses/
│   │   ├── H01.md                 ← committed (source of truth)
│   │   ├── H02.md                 ← committed
│   │   ├── ...
│   │   └── H33.md                 ← committed
│   └── research-map.md            ← committed (curated overview, можно автогенерить)
├── benchmark/
│   ├── runs/
│   │   ├── 2026-05-07_funding_l4/
│   │   │   ├── manifest.yaml      ← committed (descriptor)
│   │   │   ├── results.json       ← committed (numeric outcomes)
│   │   │   ├── equity_curves.parquet  ← committed или git-lfs
│   │   │   ├── trades.csv         ← committed или .gitignored (по размеру)
│   │   │   └── stdout.log         ← .gitignored
│   │   └── 2026-05-07_h26_multi_symbol/
│   │       └── ...
│   └── README.md                  ← правила именования run_id
├── src/                           ← committed
└── .hex-skills/
    ├── codegraph/index.db         ← .gitignored (hex-graph-mcp)
    └── researchgraph/index.db     ← .gitignored (hex-research-mcp)
```

### 3.2. Что коммитится / что нет

| Артефакт | Где живёт | Git |
|---|---|---|
| Карточка цели (frontmatter + проза) | `docs/goals/G##.md` | ✅ commit |
| Полная карточка гипотезы (frontmatter + проза) | `docs/hypotheses/H##.md` | ✅ commit |
| Run descriptor (manifest, config, agent reviews) | `benchmark/runs/<run_id>/manifest.yaml` | ✅ commit |
| Numeric outcomes (Calmar, DD, pass-rate) | `benchmark/runs/<run_id>/results.json` | ✅ commit |
| Equity curves, trade lists | `benchmark/runs/<run_id>/*.parquet,*.csv` | commit или git-lfs (по размеру) |
| stdout / stderr логи | `benchmark/runs/<run_id>/*.log` | ⛔ .gitignore |
| Generated research-map.md (Mermaid + сводка) | `docs/research-map.md` | ✅ commit (overview) |
| SQLite индекс (гипотезы + цели + runs) | `.hex-skills/researchgraph/index.db` | ⛔ .gitignore |
| SQLite индекс кода | `.hex-skills/codegraph/index.db` | ⛔ .gitignore |

**Важно:** `docs/goals/G##.md` коммитится с `metrics_target` (что писали руками), но БЕЗ `metrics_current` (агрегируется индексом). Если кто-то случайно записал `metrics_current` в файл — `verify_index --strict` репортит warning «derived field in source», предлагает удалить. Это инвариант source-of-truth.

### 3.3. Run reference — мост frontmatter → benchmark artifact

Гипотеза не дублирует тяжёлые результаты внутрь YAML, а **ссылается** на них:

```yaml
runs:
  - id: 2026-05-07_funding_l4
    type: l4_multi_entry
    summary: "L4 28/30 PASS @ donch tied"
    metrics:
      pass_rate: 0.93
      single_path_return: 154.3
      drawdown: -23.4
    artifact: benchmark/runs/2026-05-07_funding_l4/
  - id: 2026-05-07_funding_l5_n12
    type: l5_walk_forward
    summary: "9/12 OOS calmar wins"
    metrics:
      pass_rate: 0.75
    artifact: benchmark/runs/2026-05-07_funding_l5_n12/
```

`metrics` хранятся inline (это резюме, нужное для быстрых запросов), полные данные — в artifact-папке. `find_runs filter="l4_pass_rate>=0.8"` SQL-запрос к индексу не лезет в parquet, отвечает за миллисекунды.

### 3.4. Manifest run'a

Каждый run — это директория с `manifest.yaml` (committed):

```yaml
# benchmark/runs/2026-05-07_funding_l4/manifest.yaml
id: 2026-05-07_funding_l4
created_at: 2026-05-07T14:23:11Z
hypothesis: H04                # primary hypothesis for targeted runs; null/omitted for comprehensive goal snapshots
goals: [G1]                       # goal ids this run contributes to; maps to SQL runs.goal_ids
type: l4_multi_entry           # l0_unit | l1_smoke | l2_sweep | l3_live_xcheck | l4_multi_entry | l5_walk_forward

# Coherence flags (для goal metrics_current агрегации, см. §4.4.3)
comprehensive: false           # true только если run воспроизводит ПОЛНУЮ live-стратегию
included_hypotheses: [H04]     # какие H##s активны в этом run (для comprehensive=true должны включать все live)
branch: feature/H04-funding    # ветка где run проводился (master = production strategy)

config:
  detector: funding_avg_7d
  threshold: 0.0004
  N: 30
  symbol: BTCUSDT
  period: "2020-01-01..2026-05-07"
results_path: results.json     # relative to manifest dir
artifacts:
  - kind: equity_curves
    path: equity_curves.parquet
    rows: 1481
  - kind: trades
    path: trades.csv
    rows: 1481
agent_reviews:
  - reviewer: ln-500
    date: 2026-05-07
    issues_found: 4
    severity: high
    resolved: true
git_commit: 5eba9d6

# Reproducibility (опционально, по checklist из arxiv 2405.18077)
runner_environment:           # optional benchmark-runner provenance; MCP stores it but does not interpret it
  toolchain: project-specific
  lockfile: path/to/lockfile
data_snapshot:                 # exact data identity, not just cutoff dates
  - name: funding_rates
    source: binance
    artifact: data/snapshots/funding_rates_2026-05-06.parquet
    through: 2026-05-06
    sha256: "..."
  - name: klines
    source: binance
    artifact: data/snapshots/klines_2026-05-07.parquet
    through: 2026-05-07
    sha256: "..."
random_seed: 42
```

`hex-research-mcp.index_hypotheses` индексирует **И** `docs/hypotheses/*.md` **И** `benchmark/runs/*/manifest.yaml`, строит граф `Hypothesis --tested_by--> Run --runs_in--> BranchOrCommit` с метриками в edges/properties.

---

## 4. Schema гипотезы

### 4.1. YAML frontmatter (один файл = одна гипотеза)

```yaml
# docs/hypotheses/H04.md
---
id: H04
claim: "Funding rate ENTRY filter — skip ENTRY when 7d mean of 8h funding > 0.0004"
category: signal              # regime | signal | sizing | exit | composition | robustness | meta
status: live                  # см. §4.6 для полного lifecycle: not_started | in_progress | validated_branch | pending_implementation | live | rejected | deferred | mixed

# Goals served — какие цели обслуживает эта гипотеза (см. §1.5, §4.4)
goals: [G1, G1.1_signal]
goal_contribution:               # явный вклад в метрики целей (опц., но ценно для ranking)
  G1:
    calmar: "+0.18"
    max_drawdown_pp: "+0.7"

# Tree position — ТОЛЬКО source-fields (становятся edges в графе при индексации)
parents: [H02]                  # source — что эта гипотеза уточняет
supersedes: []                  # source — что эта гипотеза заменяет
competes_with: [H08]            # source — какие альтернативы тестировались в одной арене
refutes: []                     # source — что эта гипотеза опровергает
blocked_by: []                  # source — на какие гипотезы зависим до тестирования; materializes as depends_on edge
# === НЕ ПИСАТЬ ВРУЧНУЮ ===
# children — derived (агрегируется из parents других H##; см. §4.4.3)
# superseded_by — derived (обратное к supersedes)
# blocks — derived reverse edge from blocked_by/depends_on
# inspect_hypothesis отдаёт эти поля в structuredContent, но в файл не попадают

# Theory
mechanism: |
  Crypto-specific contrarian filter. Overheated long positioning
  (high funding) → skip ENTRY. Unavailable in TSMOM literature.
assumptions:
  - "funding rate is contrarian, not momentum signal"
  - "8h aggregation captures positioning"
prior_belief: 0.6             # 0..1, опционально (Bayesian flavor)

# Test design
test_protocol: ["L2_sweep", "L4_multi_entry", "L5_walk_forward", "live_xcheck"]
test_scripts:
  - benchmark/scripts/multi_entry_compare
  - benchmark/scripts/walk_forward

# Variables — независимые/контрольные/зависимые (Falsifiable ML reproducibility checklist)
variables:
  independent: [funding_threshold]                    # что варьируем
  control: [regime_classifier, step_size, period]    # что фиксируем
  dependent: [calmar, drawdown, single_path_return]  # что измеряем

gate:
  metric: ["calmar_advantage", "single_path_return", "plateau"]
  thresholds:
    l4_pass_rate: ">=70%"
    l5_n12_pass_rate: ">=70%"
    plateau_required: true
  kills_on_fail: []                # Strong Inference: какие H## рейтятся down при провале
  validates_on_pass: [H02]         # H02 (macro filter) подтверждается ещё раз если H04 проходит
  results:
    l4: { pass: 28, total: 30, ratio: 0.93, tier: t1 }       # tier — verification level (см. §7.6)
    l5_n12: { pass: 9, total: 12, ratio: 0.75, tier: t1 }
    l5_n20: { pass: 16, total: 20, ratio: 0.80, tier: t1 }
    single_path_return: 154.3
    drawdown: -23.4
    plateau_threshold_set: [0.0004, 0.0008, 0.0016]
    live_cross_check_delta_pp: 1.6

# Last verdict — PIVOT/REFINE/PROCEED/REJECT/HOLD decision after testing
last_verdict:
  decision: proceed              # pivot | refine | proceed | reject | hold
  date: 2026-05-07
  rationale: "Все три гейта прошли с margin; plateau подтверждён; live cross-check в 1.6pp."
  next_hypothesis: H28           # породила H28 как развитие per-symbol

# Run references
runs:
  - id: 2026-05-07_funding_l4
    type: l4_multi_entry
    metrics: { pass_rate: 0.93, single_path_return: 154.3 }
    artifact: benchmark/runs/2026-05-07_funding_l4/
  - id: 2026-05-07_funding_l5_n12
    type: l5_walk_forward
    metrics: { pass_rate: 0.75 }
    artifact: benchmark/runs/2026-05-07_funding_l5_n12/
  - id: 2026-05-07_funding_live_xcheck
    type: l3_live_xcheck
    metrics: { delta_pp: 1.6 }
    artifact: benchmark/runs/2026-05-07_funding_live_xcheck/

# Evidence (легковесные ссылки, не run'ы)
evidence:
  - type: commit
    ref: 5eba9d6
    date: 2026-05-07
    summary: "macro filter promoted (related H02)"
  - type: agent_review
    ref: ln-500
    date: 2026-05-07
    issues: 4
    severity: high
    resolved: true
    summary: "boundary look-ahead, threshold sensitivity, pre-funding L4, cross-check"
  - type: paper
    ref: "v2.1 archive R-04"
    summary: "funding fusion (HMM + indicator ensemble)"

# Implementation (мост на hex-graph-mcp)
implementation:
  branch: master
  merged_commits: [5eba9d6]
  feature_flag: null
  symbols:                    # workspace_qualified_name format hex-graph-mcp
    - "src/data/funding.py:BinanceFundingFetcher"
    - "src/db/repo.py:FundingRatesRepo"
    - "src/pipeline.py:_classify_macro_regime"
  config_keys:
    - Settings.funding_filter_max_8h
    - Settings.funding_avg_window_days

# Tasks — мост на task tracker (см. §4.5)
tasks:
  - id: LIN-1234
    system: linear            # linear | jira | github | file | other
    url: "https://linear.app/btc-trader/issue/LIN-1234"
    type: implementation      # implementation | refinement | research | rollback
    title: "Implement funding rate filter in production pipeline (H04)"
    status_snapshot:
      state: done             # open | in_progress | done | cancelled
      at: 2026-05-07T14:23:11Z
    created_at: 2026-04-20
    closed_at: 2026-05-06

# Sources — структурированные external refs (см. §4.7)
# Типизированный список того что мотивировало гипотезу:
# paper/video/website/book/podcast/code/dataset/archive
sources:
  - type: paper
    title: "Funding rate predictive power in crypto perpetuals"
    authors: ["Hirsa", "Xu", "Malhotra"]
    year: 2024
    arxiv_id: "2404.12345"
    url: "https://arxiv.org/abs/2404.12345"
    accessed_at: 2026-04-15
    notes: "Section 4.2 motivates the 7-day window threshold"
  - type: archive
    ref: "v2.1::R-04"
    system: "internal_v2.1"
    notes: "Original 2025 formulation: funding fusion (HMM + indicator ensemble)"
  - type: website
    title: "Binance funding rate methodology"
    url: "https://academy.binance.com/en/articles/funding-rates-explained"
    accessed_at: 2026-04-15

# Lifecycle
created_at: 2026-04-15
promoted_at: 2026-05-07
last_touched: 2026-05-07
priority_tier: 1              # 1 | 2 | 3 | null

# Optional (расширения)
risks:
  - "regime change in 2027+ may invert signal"
  - "ETH/BNB structurally different (see H26 mixed)"
tags: ["crypto-specific", "contrarian", "macro-derived"]
---

# H04 — Funding rate ENTRY filter

[Свободная проза. История идеи, обсуждение, ссылки на статьи,
скриншоты, всё что не помещается в frontmatter. Индекс читает только
frontmatter — остальное доступно агенту через `inspect_hypothesis verbosity=full`.]
```

### 4.2. Что обязательно vs опционально

| Категория | Поля | Required |
|---|---|---|
| Identity | `id`, `claim`, `category`, `status` | ✅ |
| Goals | `goals: [G##]` | ✅ хотя бы один (иначе hypothesis — orphan, см. `audit_goal_alignment`) |
| Goal contribution | `goal_contribution.G##.{metric_delta}` | желательно для `status: live` (информативно для ranking/audit; не используется в `metrics_current` агрегации, та берётся из comprehensive runs) |
| Theory | `mechanism` | ✅ |
| Test | `gate` (минимум `metric` и `thresholds`) | ✅ для тестируемых; для `not_started` — может быть только `metric:` |
| Tree (source) | `parents`, `supersedes`, `competes_with`, `refutes`, `blocked_by` | ✅ хотя бы пустые списки (только source-поля; `children`/`superseded_by`/`blocks` — derived, не в файле) |
| Test | `test_protocol`, `test_scripts` | желательно |
| Variables | `variables.independent`, `.control`, `.dependent` | желательно для тестированных (reproducibility) |
| Gate results | `gate.results` (структурно, с `tier`) | желательно для тестированных |
| Crucial design | `gate.kills_on_fail`, `gate.validates_on_pass` | опционально, но ценно для Strong Inference |
| Last verdict | `last_verdict.{decision, date, rationale, next_hypothesis}` | ✅ для status ∈ {pending_implementation, live, rejected, deferred, mixed}; ✅ для `in_progress` если verdict=refine. **Не требуется** для `not_started`, `validated_branch` (в validated_branch verdict — переходное состояние; запись verdict сразу триггерит транзицию в pending_implementation/in_progress/rejected/deferred per §4.6 lifecycle) |
| Runs | `runs: []` | желательно для тестированных |
| Evidence | `evidence: []` | желательно |
| Implementation | `implementation.symbols` | если status ∈ {validated_branch, pending_implementation, live} |
| Tasks | `tasks: []` (см. §4.5) | ✅ status-based invariant: ≥1 task с `type: implementation` и `state ∈ {open, in_progress}` обязательно для `status: pending_implementation`; ≥1 task с `type: implementation` и `state: done` обязательно для `status: live`; ≥1 task с `type: refinement` и `state ∈ {open, in_progress}` обязательно для `status: in_progress` если `last_verdict.decision: refine`; иначе `IMPLEMENTATION_GAP` / `TASK_DRIFT`. Опционально для остальных статусов. |
| Sources | `sources: []` (см. §4.7) | желательно (FAIR-aligned metadata, citation export) |
| Lifecycle | `created_at`, `last_touched` | ✅ |
| Bayesian | `prior_belief`, `confidence_post`, `assumptions`, `risks` | опционально |
| Meta | `tags` | опционально |

### 4.3. Валидация

Zod-схема в `lib/schema/hypothesis.mjs`. `index_hypotheses` валидирует каждый файл и возвращает по нарушающим (structured-first per §8):

```json
{
  "status": "INVALID",
  "reason": "frontmatter_validation_failed",
  "next_action": "fix_frontmatter",
  "summary": { "total_files": 33, "valid": 31, "invalid": 2 },
  "warnings": [
    {
      "code": "missing_required_field",
      "message": "docs/hypotheses/H07.md: field 'category' is required",
      "details": { "file": "docs/hypotheses/H07.md", "field": "category" }
    },
    {
      "code": "missing_required_field",
      "message": "docs/hypotheses/H12.md: field 'goals' is required",
      "details": { "file": "docs/hypotheses/H12.md", "field": "goals" }
    }
  ],
  "follow_ups": [
    { "tool": "mcp__hex-research__verify_index", "args": { "path": ".", "strict": true } }
  ]
}
```

CI hook опционально: вызвать `verify_index` tool через MCP CLI с флагом `--strict` (падает с non-zero exit code если drift или validation errors). Унифицировано: одна точка истины — `verify_index`, отдельный `validate` tool не вводим.

### 4.4. Schema цели (Goal) — параллельный node-kind

Цели живут в отдельной папке `docs/goals/G##.md` (параллельно `docs/hypotheses/H##.md`). Это не `category: meta` гипотеза, а другой **kind** узла графа со своей семантикой.

**Различение Goal vs Hypothesis:**

| Свойство | Goal (G##) | Hypothesis (H##) |
|---|---|---|
| Семантика | «Куда мы идём» (цель + метрики достижения) | «Ставка на путь» (testable claim) |
| Метрики | Target thresholds + `metrics_current` (snapshot из latest comprehensive run) | Per-run results vs gate |
| Status lifecycle | active → achieved \| paused \| abandoned | not_started → in_progress → live/rejected/... |
| Дочерние узлы | Sub-goals (G1 → G1.1) И гипотезы (`serves_goal`) | Только sub-hypotheses |
| Размер | 1-5 в проекте | 30-300 в проекте |

#### 4.4.1. YAML frontmatter цели

```yaml
# docs/goals/G1.md
---
id: G1
claim: "Production-ready BTC long-only strategy"
status: active                  # active | achieved | paused | abandoned
deadline: 2026-Q4
priority: primary               # primary | secondary | exploratory

# Измеримые метрики (target — то к чему стремимся)
metrics_target:
  primary:                      # обязательные для achievement
    calmar: ">=2.0"
    max_drawdown: "<=25%"
  secondary:                    # nice-to-have
    single_path_return_annual: ">=50%"
    plateau_robustness: required

# === metrics_current НЕ ПИШЕТСЯ СЮДА ===
# Это derived field — живёт только в SQLite (`goals.metrics_current`) и в
# `inspect_goal` output. См. §4.4.3 для алгоритма агрегации.
# verify_index --strict падает с warning "derived_field_in_source" если кто-то
# случайно записал metrics_current в G##.md.

# Дерево целей (Goal может декомпозироваться)
parents: []                     # G1 — корневая (source-of-truth)
# children — derived field, агрегируется из других G##.parents; не писать руками

# Lifecycle
created_at: 2025-10-01
last_touched: 2026-05-07

# Контекст
rationale: |
  Личный R&D проект. Production-ready = можно запустить с реальными деньгами
  без stop-выключения каждые 2 недели. Calmar — risk-adjusted return.
  Max DD 25% — психологический предел оператора.
sources:                            # унифицированный schema, тот же что у H## (см. §4.7)
  - type: archive
    ref: "docs/objective.md"
    system: "internal_docs"
    notes: "Исходный документ, конвертированный в этот goal"
  - type: book
    title: "Systematic Trading"
    authors: ["Carver, Robert"]
    edition: "2nd"
    year: 2023
---

# G1 — Production-ready BTC long-only strategy

## Бизнес-контекст

[свободный текст: почему именно эти метрики, как формулировались, история]
```

#### 4.4.2. Что обязательно

| Поле | Required | Зачем |
|---|---|---|
| `id` (G##) | ✅ | canonical identity |
| `claim` | ✅ | человеческое описание |
| `status` | ✅ | lifecycle |
| `metrics_target.primary` | ✅ | без этого Goal — wishlist, не цель |
| `priority` | желательно | для multi-goal проекта (1 ↔ N целей) |
| `deadline` | опционально | если есть hard deadline |
| `parents` (только) | хотя бы пустой `[]` | для дерева целей; `children` — derived, **НЕ писать руками** |
| `metrics_current` | **НЕ писать руками** | агрегируется индексом из comprehensive runs |
| `sources: []` | желательно | то же поле что у H## (см. §4.7) — структурированные external refs |

#### 4.4.3. Агрегация `metrics_current` — coherent snapshot, НЕ best-per-metric

**Критичное методологическое решение.** Наивная агрегация «best Calmar от любой live-гипотезы + best max_drawdown от любой другой» создаёт fictional config: эти метрики могут быть от **несовместимых** конфигураций, которые вместе никогда не запускались. Для трейдинговой стратегии это особенно опасно — вы получите «achieved goal», которого реально нет.

Правильный подход — **comprehensive run**: один coherent backtest полной live-комбинации.

**Concept of comprehensive run.** В run manifest добавляется флаг:

```yaml
# benchmark/runs/2026-05-07_master_combo_l4/manifest.yaml
id: 2026-05-07_master_combo_l4
hypothesis: null                         # comprehensive goal snapshot, not owned by one H##
goals: [G1]                              # maps to SQL runs.goal_ids
type: l4_multi_entry
comprehensive: true                     # ← ключевой флаг
included_hypotheses: [H01, H02, H04, H05, H08]   # все live H##s в этом run
branch: master
git_commit: 5eba9d6
config:
  # полная конфигурация live-стратегии
  ...
results_path: results.json
# ...
```

`comprehensive: true` означает «этот run воспроизводит полную текущую live-стратегию для целей из `goals`, а его метрики являются source of truth для этих goal-level snapshots; `included_hypotheses` фиксирует покрытие live H##s».

**Алгоритм агрегации `metrics_current` при `index_hypotheses`:**

1. Найти goal G##
2. Собрать множество гипотез которые `serves_goal G##` И имеют `status: live` → set `LiveH(G##)`
3. Найти **latest comprehensive run** где `goal_ids` содержит G## и `included_hypotheses ⊇ LiveH(G##)`:
   - Если найден → его `results.json` метрики записываются в `goals.metrics_current` (с `provenance: { run_id, git_commit, run_date }`)
   - Если НЕ найден → `metrics_current = null` И `verify_index` репортит warning `no_comprehensive_run_for_goal G##`
4. Achievement status вычисляется из `metrics_current` vs `metrics_target.primary` ТОЛЬКО когда coherent snapshot существует

**Что это даёт:**
- Невозможно «случайно достичь» цель fictional aggregation'ом
- `inspect_goal G1` всегда либо показывает coherent metrics с прямой ссылкой на их source-run, либо явно сообщает «no comprehensive run yet — измерить нечем»
- Принуждает workflow «после каждого live-promotion прогнать comprehensive run» — методологически правильно

**Workflow следствия:**

После каждого `last_verdict.decision: proceed` для гипотезы H##, которая попадает в `live`:
1. Запускается comprehensive run на `master` после merge
2. Run manifest помечается `comprehensive: true` с `included_hypotheses: [...full live list...]`
3. `index_hypotheses` обновляет `metrics_current` для всех goals из `goals: [...]` этого run

Это явно фиксируется в `HEX_RESEARCH_AGENTS.md` (Phase 6 deliverable) как обязательный шаг.

**Граница source vs derived:**

| Поле | Источник | Где живёт |
|---|---|---|
| `gate.results.l4` гипотезы | Source (sweep-script пишет в frontmatter) | `H##.md` |
| `runs[].metrics` гипотезы | Source (manifest.yaml) | `H##.md` + `benchmark/runs/<id>/manifest.yaml` |
| `metrics_current` цели | Derived (latest comprehensive run) | `goals.metrics_current` SQLite + `inspect_goal` |
| `goals.children` | Derived (aggregated from G##.parents) | SQLite + `inspect_goal` |
| `hypotheses.children` | Derived (aggregated from H##.parents) | SQLite + `inspect_hypothesis` |

`verify_index --strict` репортит warning `derived_field_in_source` если в файле обнаружено `metrics_current`, `children` (где expected derived), или `achievement_status`.

#### 4.4.4. Goal node в SQLite schema

Добавляется отдельная таблица `goals` (см. обновлённый §9). Edges типа `serves_goal` (Hypothesis → Goal) и `decomposes_goal` (Goal → Goal) индексируются в общей `edges` таблице.

### 4.5. Task tracker bridge

**Принцип:** «hypothesis without task = museum piece, не execution tool» — стандартное предупреждение из OKR-практики ([Atlassian OKR Guide][atlassian-okr]). Гипотеза которая прошла gate'ы и `last_verdict.decision: proceed` записан → status переходит в `pending_implementation` и **обязательно** требует ≥1 task `type: implementation` в `state ∈ {open, in_progress}`. Когда implementation task закрывается и comprehensive run проведён → status переходит в `live` и task должен быть `state: done`.

**`decision: refine` НЕ переводит в `pending_implementation`** — refine означает «перезапустить sweep с другими параметрами», это не «awaiting merge/deploy». Гипотеза при refine остаётся в `in_progress` (или возвращается из `validated_branch` → `in_progress`) и требует ≥1 task `type: refinement` в `state ∈ {open, in_progress}`. Это invariant'но проверяется отдельно (см. §4.6 matrix).

Без моста на трекер дерево гипотез не интегрировано с продуктовым потоком.

**Поддерживаемые трекеры:** Linear, Jira, GitHub Issues, File Mode (per repo `AGENTS.md` config-driven Agile management). Любой другой через `system: other` + opaque url.

**Schema поля `tasks: []`:**

```yaml
tasks:
  - id: <tracker-specific id>      # 'LIN-1234', 'PROJ-567', 'owner/repo#123', 'tasks/2026-05-07-funding.md'
    system: linear | jira | github | file | other
    url: "https://..."             # canonical link
    type: implementation | refinement | research | rollback
    title: "Human-readable одна строка"     # required
    status_snapshot:                # optional in YAML, required after parser normalization before SQL insert
      state: open | in_progress | done | cancelled    # default 'open' если автор не указал явно
      at: 2026-05-07T14:23:11Z      # required when status_snapshot supplied; no current_time default
    created_at: 2026-04-20          # required if status_snapshot omitted; parser derives stable snapshot_at from it
    closed_at: 2026-05-06           # опц., обязательно если status_snapshot.state == 'done' или 'cancelled'
```

**Schema rationale (зачем status_snapshot нормализуется до required):**
- SQL `tasks` table имеет `state TEXT NOT NULL` и `state_snapshot_at TEXT NOT NULL` — это сохраняет фастовые queries `find_hypotheses task_state=open` без NULL handling
- Frontmatter может содержать task без `status_snapshot`; parser тогда ставит `state='open'` и `at=created_at`. Если нет ни `status_snapshot.at`, ни `created_at`, это `INVALID/missing_required_field`. Parser никогда не использует `current_time`, чтобы reindex не маскировал stale tracker state.
- `tasks[].id` — tracker-specific id. Normalized SQL/node id строится как `<system>:<tracker_id>` (например `linear:LIN-1234`), где `tracker_id = tasks[].id`.

**Type vocabulary:**
- `implementation` — `decision: proceed`, нужно заmerge'ить и задеплоить (типичный случай для `pending_implementation` status)
- `refinement` — `decision: refine`, нужно перезапустить sweep с другими параметрами
- `research` — `decision: pivot`, нужно spike/research новое направление до формулировки следующей H##
- `rollback` — production live-гипотеза показала regress, нужно откатить (редкий случай)

**Status snapshot semantics:**

`status_snapshot` — это **денормализованный кэш**, обновляется ручной правкой файла, внешним tracker MCP workflow, или будущим post-v0.6 helper'ом из roadmap. НЕ считается source of truth — реальный source это сам трекер. `verify_index` репортит warning `task_status_stale` если `status_snapshot.at < (now - 30d)` и tracker MCP доступен. Порог 30 дней выбран намеренно — ручное обновление каждый месяц это разумный SLA, переопределяется через config.

**Drift checks (через `audit_orphans`):**

| Условие | Категория |
|---|---|
| `status: pending_implementation` И нет ни одной `tasks[].type=implementation, state ∈ {open, in_progress}` | `implementation_gap` |
| `status: validated_branch` И `last_verdict.decision: proceed` | `status_verdict_drift` (нужно переходить в `pending_implementation`) |
| `status: validated_branch` И `last_verdict.decision: refine` | `status_verdict_drift` (нужно возвращаться в `in_progress` с `type: refinement` task) |
| `status: in_progress` И `last_verdict.decision: refine` И нет ни одной `tasks[].type=refinement, state ∈ {open, in_progress}` | `implementation_gap` (refine verdict без refinement task) |
| `status: in_progress` И `last_verdict.decision ∈ {proceed, reject, hold}` | `status_verdict_drift` (non-refine verdict должен транзитнуть status: `proceed` → `pending_implementation`, `reject` → `rejected`, `hold` → `deferred`) |
| `status: pending_implementation` И все `tasks[].state ∈ {done, cancelled}` | `task_drift` (можно promotion на `live` или `rejected`) |
| `status: live` И **нет ни одной `tasks[]` с `type: implementation` И `state: done`** | `task_drift` (live без завершённой implementation task — не соответствует invariant из §4.5) |
| `status: live` И есть `tasks[]` с `state ∈ {open, in_progress}` | `task_drift` (live'нулись без закрытия задачи?) |
| `task.status_snapshot.at < now - 30d` | `task_status_stale` |

**Federation pattern для cross-MCP:**

`inspect_hypothesis` возвращает в `follow_ups[]` pointer на установленный tracker MCP:

```json
{
  "follow_ups": [
    { "tool": "mcp__linear__get_issue", "args": { "id": "LIN-1234" } },
    { "tool": "mcp__hex-graph__inspect_symbol", "args": { "path": "/btc-trader", "workspace_qualified_name": "src/data/funding.py:BinanceFundingFetcher" } }
  ]
}
```

Агент решает вызвать ли — мы **не зависим** от tracker MCP, но даём готовый pointer когда он есть. Так же как с `hex-graph-mcp` — convention over coupling.

**Что обязательно vs опционально (status-based, не verdict-based):**

Инвариант привязан к **`status`**, не к `last_verdict.decision`, чтобы избежать промежуточных drift-состояний:

- `tasks: []` ≥1 запись с `type: implementation` И `state ∈ {open, in_progress}` — **required для `status: pending_implementation`**; иначе `IMPLEMENTATION_GAP`
- `tasks: []` ≥1 запись с `type: implementation` И `state: done` — **required для `status: live`** (implementation task должна быть завершена); И не должно быть `state ∈ {open, in_progress}` на момент `live`; иначе `TASK_DRIFT`
- `tasks: []` ≥1 запись с `type: refinement` И `state ∈ {open, in_progress}` — **required для `status: in_progress` если `last_verdict.decision: refine`** (refine означает перезапустить sweep, требует refinement task); иначе `IMPLEMENTATION_GAP`
- Для `status ∈ {not_started, in_progress (без verdict), validated_branch (без verdict), rejected, deferred}` — `tasks` опционально
- **Status-verdict drift detection:** если verdict записан, но status не транзитнулся:
  - `last_verdict.decision: proceed` И `status: validated_branch` → `STATUS_VERDICT_DRIFT` (нужно `pending_implementation`)
  - `last_verdict.decision: refine` И `status: validated_branch` → `STATUS_VERDICT_DRIFT` (нужно вернуться в `in_progress` с refinement task)
  - `last_verdict.decision ∈ {proceed, reject, hold}` И `status: in_progress` → `STATUS_VERDICT_DRIFT` (non-refine verdict должен транзитнуть status)
  - `last_verdict.decision: reject` И `status ∉ {rejected}` → `STATUS_VERDICT_DRIFT`
  - `last_verdict.decision: hold` И `status ∉ {deferred}` → `STATUS_VERDICT_DRIFT`
  - `pivot` — старая гипотеза остаётся `validated_branch` (verdict не пишется на ней; новая H## создаётся с `parents: [old]`)
- `tasks[].title` обязательно (минимальная human-readable идентификация)

### 4.6. Status lifecycle

```
not_started
    ↓ (выбран из priority_tier=1 backlog для тестирования)
in_progress  ←─────────────────────────────────────┐
    ↓ (L0–L3 пройдены на feature-ветке)             │
validated_branch                                    │
    │                                               │
    ├── decision: proceed → pending_implementation  │
    │                          ↓ (impl task done;   │
    │                           merge to master;    │
    │                           comprehensive run)  │
    │                       live                    │
    │                          ↓ (опционально       │
    │                           regress detected)   │
    │                       deferred / rejected     │
    │                                               │
    ├── decision: refine ─────────────────────────→─┘
    │   (вернуться в in_progress, создать refinement task,
    │    перезапустить sweep с другими параметрами)
    │
    ├── decision: reject → rejected
    ├── decision: hold → deferred
    └── decision: pivot → старая остаётся validated_branch (verdict не пишется),
                          новая H## создаётся отдельно с parents: [old]
```

Альтернативные пути:
- `validated_branch` → `mixed` (часть symbols pass, часть fail; см. H26 в btc-trader)
- любой → `superseded_by: [H_new]` (заменена другой гипотезой через `supersedes` edge)

**Status × Tasks matrix (инвариант):**

| status | `tasks: []` ожидание |
|---|---|
| `not_started` | пусто (ничего не делаем) |
| `in_progress` (без verdict) | пусто или 1 research-task |
| `in_progress` (с `verdict: refine`) | **минимум 1 task с `type: refinement` И `state ∈ {open, in_progress}`** |
| `in_progress` (с `verdict: proceed/reject/hold`) | drift — non-refine verdict должен транзитнуть status (`pending_implementation`/`rejected`/`deferred`) |
| `validated_branch` (без verdict) | пусто; verdict не записан, status переходный |
| `validated_branch` (с verdict) | drift — должен был транзитнуться (см. status_verdict_drift в drift table) |
| `pending_implementation` | **минимум 1 task с `type: implementation` И `state ∈ {open, in_progress}`** |
| `live` | ≥1 task с `type: implementation` И `state: done`; нет open/in_progress |
| `mixed` | task'и могут быть в разных состояниях (per-symbol decisions) |
| `rejected` / `deferred` | пусто или task с `state: cancelled` |

`audit_orphans` репортит нарушения этой матрицы.

### 4.7. External sources (унифицированный schema для H## и G##)

Поле `sources: []` применяется к **обоим** node-kind: hypothesis (`H##.md`) и goal (`G##.md`). Это входы (inputs) которые мотивировали узел дерева — отличаются от `evidence: []` (outputs/proofs о hypothesis testing).

Один schema для обоих kind упрощает агентскую работу: `inspect_hypothesis` и `inspect_goal` возвращают `sources` в одном формате; `find_hypotheses cited_source_type=paper` работает одинаково.

**Type vocabulary:**

```yaml
sources:
  - type: paper
    title: "..."
    authors: ["...", "..."]
    year: 2024
    doi: "10.xxx/yyy"           # опц.
    arxiv_id: "2404.12345"       # опц.
    journal: "..."               # опц.
    url: "https://..."
    pages: "§4.2"                # опц.
    accessed_at: 2026-04-15
    notes: "Почему важно для гипотезы"

  - type: video
    title: "..."
    channel: "..."
    url: "https://www.youtube.com/watch?v=..."
    timestamp: "12:34"           # точка где relevant content
    duration: "PT45M"            # ISO 8601 опц.
    accessed_at: 2026-04-15

  - type: website
    title: "..."
    url: "https://..."
    accessed_at: 2026-04-15
    notes: "..."

  - type: book
    title: "..."
    authors: ["..."]
    year: 2023
    edition: "2nd"
    pages: "§8.3"
    isbn: "978-..."              # опц.

  - type: podcast
    title: "..."
    show: "..."
    url: "https://..."
    timestamp: "01:23:45"
    accessed_at: 2026-04-15

  - type: code
    repo: "owner/repo"
    url: "https://github.com/..."
    commit: "abc123"             # опц., для воспроизводимости
    notes: "..."

  - type: dataset
    name: "..."
    source: "exchange-export"     # опц., identity fallback когда url отсутствует
    url: "https://..."
    snapshot_date: 2026-05-07     # data versioning
    format: "parquet"             # опц.

  - type: archive
    ref: "v2.1::R-04"            # internal opaque ID
    system: "internal_v2.1"      # какая archive system
    notes: "..."
```

**Зачем структурированно:**

- Агент может фильтровать через `find_hypotheses cited_source_type=paper cited_source_year_min=2024` — невозможно с opaque strings (отдельный `find_sources` tool НЕ вводим; sources discoverable через filter parameters в `find_hypotheses`)
- FAIR-aligned metadata: `accessed_at` + url/doi/isbn делают source воспроизводимым
- Citation export — BibTeX/RIS из одного запроса через extension `inspect_hypothesis verbosity=full export_citations=true`
- Audit «hypothesis claim says X, но ни один source не упоминает X» — quality check

**Source identity и dedup (важно для §9 SQL):**

`sources.id` в SQL — это **canonical content hash построенный ТОЛЬКО по identity-полям** (что делает source уникальным), не по всему YAML object'у. Per-source `notes` (которое описывает «зачем именно эта гипотеза цитирует этот source») хранится в **`node_sources.notes`** как per-node поле, а не в `sources` table.

Identity-поля для hash по типу:

| `type` | Identity-поля (включаются в hash) | Per-node поля (только в `node_sources`) |
|---|---|---|
| `paper` | `type` + (приоритетно: `doi` ИЛИ `arxiv_id` ИЛИ `url` ИЛИ `title+authors+year`) | `notes`, `accessed_at` (cite-specific) |
| `video` | `type` + `url` | `timestamp` (per-cite), `notes`, `accessed_at` |
| `website` | `type` + `url` | `notes`, `accessed_at` |
| `book` | `type` + (приоритетно: `isbn` ИЛИ `title+authors+edition`) | `pages` (per-cite), `notes`, `accessed_at` |
| `podcast` | `type` + `url` | `timestamp` (per-cite), `notes`, `accessed_at` |
| `code` | `type` + `repo` + (опц. `commit`) | `notes`, `accessed_at` |
| `dataset` | `type` + (`url` или `name+source`) + `snapshot_date` | `notes`, `accessed_at` |
| `archive` | `type` + `ref` + `system` | `notes` |

Это даёт правильный dedup: если 5 гипотез цитируют один paper (Hirsa 2024), но каждая с разной заметкой («motivates 7-day window» vs «contradicts our hypothesis on ETH») — будет **1 row в `sources`** + 5 rows в `node_sources` с разными `notes`. Без этой нормализации hash включал бы notes и было бы 5 дубликатов одного paper'а.

`accessed_at` тоже per-cite (один paper мог быть прочитан в разное время разными гипотезами), поэтому он в `node_sources`, не в `sources`.

---

## 5. Schema evidence и run references

### 5.1. Evidence — лёгкие ссылки

Evidence — это **факт** или **внешний документ**, не имеющий своих метрик. Размер inline.

```yaml
evidence:
  - type: commit | pr | issue | paper | agent_review | live_check | discussion | doc
    ref: <stable_id>           # SHA / URL / archive ID
    date: 2026-05-07
    summary: "..."             # одна строка
    # доп. поля по типу:
    # agent_review: { reviewer, issues, severity, resolved }
    # live_check: { delta_pp, period }
```

### 5.2. Run reference — тяжёлые результаты

Run — это **прогон эксперимента** с собственным descriptor'ом и артефактами. Inline в гипотезе только summary-метрики; полные данные — в `benchmark/runs/<run_id>/`.

Type-vocabulary (соответствует L0..L5):

| `type` | Что это | Типичные `metrics` |
|---|---|---|
| `l0_unit` | unit-тест | `pass: bool` |
| `l1_smoke` | smoke на 1 конфиге | `single_path_return`, `drawdown` |
| `l2_sweep` | grid search по гиперпараметрам | `best_config`, `plateau_count` |
| `l3_live_xcheck` | live cross-check vs vectorized | `delta_pp` |
| `l4_multi_entry` | N разных entry seeds | `pass`, `total`, `ratio` |
| `l5_walk_forward` | OOS rolling window | `pass`, `total`, `ratio`, `oos_blowups` |

`hex-research-mcp` не парсит `*.parquet` / `*.csv` — это работа внешнего sweep-script'а. Manifest несёт сводные метрики и path до сырых данных. Если нужно глубже — агент использует project-specific tooling вне MCP server runtime.

### 5.3. Mapping run → hypothesis

Двунаправленный:

- В YAML гипотезы: `runs: [{id, ...}]` ← фронтальный список
- В manifest run'a: `hypothesis: H04` ← обратная ссылка

Index-time проверка: оба направления должны совпадать. `verify_index` репортит drift.

---

## 6. Типы рёбер графа

### 6.1. Hypothesis ↔ Hypothesis edges

| Edge | Domain → Range | Семантика | Edge properties |
|---|---|---|---|
| `parent_of` | H_parent → H_child | детская гипотеза уточняет / расширяет родителя | `created_at` |
| `refines` | H_new → H_old | new — улучшение old (но old не отвергнута) | `aspect` (что уточняется) |
| `supersedes` | H_new → H_old | new заменяет old; old → status=rejected | `reason` |
| `refutes` | H_a → H_b | результаты H_a опровергают H_b | `evidence_run_id` |
| `competes_with` | H_a ↔ H_b | оба тестировались в одной арене (L4 / L5) | `arena_run_id` |
| `depends_on` | H_a → H_b | H_a нельзя тестировать пока H_b не валидирована; materialized from YAML `blocked_by` | `blocker_kind` |
| `blocks` | H_a → H_b | derived reverse of `depends_on` / YAML `blocked_by` | — |

### 6.2. Hypothesis ↔ Run / Symbol / Branch / Metric / Task / Source edges

| Edge | Domain → Range | Семантика | Edge properties |
|---|---|---|---|
| `tested_by` | H → Run | гипотеза имеет run в evidence | `run_type`, `metrics` |
| `implemented_in` | H → Symbol | продукт-сабсистема (мост на hex-graph) | `symbol_qn`, `confidence` |
| `runs_in` | Run → BranchOrCommit | run воспроизводим из git-state | `commit_sha` |
| `gated_by` | H → Metric | гейт описан критерием | `metric`, `threshold` |
| `tracked_by` | H → Task | гипотеза имеет task в tracker'e (см. §4.5) | `system`, `type`, `state` |
| `cites` | H/G → Source | гипотеза или цель опирается на external source (см. §4.7) | `source_type`, `accessed_at` |

### 6.3. Goal edges

| Edge | Domain → Range | Семантика | Edge properties |
|---|---|---|---|
| `serves_goal` | H → G | гипотеза служит цели (из `goals: [G##]` field) | `goal_contribution` (per-metric delta) |
| `decomposes_goal` | G_parent → G_child | sub-goal: G1 → G1.1 (декомпозиция большой цели) | `aspect` (по какой оси разделено) |
| `achieves` | G → MetricSnapshot | цель достигнута (computed когда `metrics_current` ≥ `metrics_target.primary`) | `achieved_at`, `contributing_hypotheses` |

### 6.4. Cycle invariants

`cycles.mjs` детектирует случайные циклы по edge-types которые должны быть acyclic:
- `parent_of` / `supersedes` / `depends_on` / `refines` — дерево гипотез не должно быть петлевым (refines: H_new → H_old, обратное создаст semantic cycle)
- `decomposes_goal` — дерево целей тоже не петлевое
- `tracked_by` (H→Task), `cites` (H/G→Source), `tested_by` (H→Run), `implemented_in` (H→Symbol), `serves_goal` (H→G), `runs_in` (Run→Branch), `gated_by` (H→Metric), `achieves` (G→Metric) — однонаправленные между разными kind узлов, петли невозможны по типу
- `competes_with` — symmetric, петля concept'уально валидна (a competes b ↔ b competes a) — НЕ проверяется

При обнаружении цикла — `cycle_detected` reason в `index_hypotheses` и `verify_index`.

---

## 7. MCP tool surface (15 инструментов)

Маппинг с `hex-graph-mcp` в стиле use-case-first контракта: 12 hypothesis tools + 3 goal tools.

### 7.1. Hypothesis tools (12)

| Tool | Use case | Аналог в hex-graph-mcp |
|---|---|---|
| `index_hypotheses` | Build / refresh research graph index (включая goals) | `index_project` |
| `find_hypotheses` | Discover hypotheses by name/category/status/goal/task_state/cited_source_type | `find_symbols` |
| `inspect_hypothesis` | Full hypothesis card | `inspect_symbol` |
| `find_evidence` | All evidence (commit, paper, agent_review, run) for a hypothesis | `find_references` |
| `find_runs` | All runs matching filter (type, metric threshold, date) | (новый) |
| `trace_lineage` | Path from root to hypothesis OR descendants of hypothesis | `trace_paths` |
| `analyze_topology` | Categories, coupling, cycles, orphans summary | `analyze_architecture` |
| `audit_orphans` | 8 категорий: orphan, stale, dead-branch, missing-evidence, **implementation_gap**, **status_verdict_drift**, **task_drift**, **task_status_stale** | `audit_workspace` |
| `analyze_progress` | Status delta between two git refs | `analyze_changes` |
| `analyze_proposed` | What does adding H## affect / who will be its parents | `analyze_edit_region` |
| `verify_index` | Drift check: files vs DB vs run-manifests | (новый) |
| `export_canvas` | Dump JSON Canvas / Mermaid for human view | `export_scip` (по духу) |

### 7.2. Goal tools (3)

| Tool | Use case | Что возвращает |
|---|---|---|
| `inspect_goal` | Full goal card with `metrics_current` from latest comprehensive run (§4.4.3) | sections: `metrics_target`, `metrics_current`, `hypotheses` (linked counts by status), `achievement` (verdict), `provenance` (run_id + git_commit), `sources` (структурированные external refs §4.7), `follow_ups` на contributing H## |
| `trace_goal_tree` | Дерево гипотез служащих цели (filtered `trace_lineage` по `goals` field) | `.G1->H02->H04 depth=3 contribution_calmar=+0.18` rows; group by category |
| `audit_goal_alignment` | Гипотезы без `goals:` (orphan) или с потерянной целью (parent.goals не пересекается) | `.orphan_hypothesis H17 reason=no_goals` / `.misaligned H29 expected=[G1] actual=[]` |

### 7.3. Primary selectors

Как у `hex-graph-mcp`, requirement `path` для всех (root проекта, где живут `docs/hypotheses/` и `docs/goals/`). Selector tools принимают ровно один из:

- `id` (canonical, e.g. `H04` или `G1`)
- `claim_substring` (резерв на случай, если ID не помнится)
- `qualified_name` (`signal/H04` если будем поддерживать иерархию категорий)

Все tools валидируют kind через префикс ID (`H` vs `G`); `inspect_hypothesis id=G1` вернёт ошибку `WRONG_NODE_KIND` (используй `inspect_goal`).

Ambiguous → возвращаем `status: "ERROR"` с `reason: "ambiguous_hypothesis"` или `"ambiguous_goal"` (не silent first-match).

### 7.4. Heavy tools — summary-first

`audit_orphans`, `audit_goal_alignment`, `analyze_topology`, `trace_lineage`, `trace_goal_tree`, `inspect_goal` — те же принципы, что у hex-graph: возвращаем counts + bounded preview + provenance + executable `>` follow-up pointers, не дамп графа.

### 7.5. MCP annotations

Каждый tool регистрируется с явными [MCP annotations][mcp-spec] для корректной risk-классификации клиентами. Это advisory metadata: клиенты могут применять более консервативный UX/policy без hints, но annotations не являются enforcement boundary и должны считаться untrusted для недоверенных серверов.

| Tool | `readOnlyHint` | `destructiveHint` | `idempotentHint` | `openWorldHint` |
|---|:---:|:---:|:---:|:---:|
| `index_hypotheses` | ❌ | ✅² | ✅ | ❌ |
| `verify_index` | ✅ | ❌ | ✅ | ❌ |
| `find_hypotheses` | ✅ | ❌ | ✅ | ❌ |
| `inspect_hypothesis` | ✅ | ❌ | ✅ | ❌ |
| `find_evidence` | ✅ | ❌ | ✅ | ❌ |
| `find_runs` | ✅ | ❌ | ✅ | ❌ |
| `trace_lineage` | ✅ | ❌ | ✅ | ❌ |
| `analyze_topology` | ✅ | ❌ | ✅ | ❌ |
| `audit_orphans` | ✅ | ❌ | ✅ | ❌ |
| `analyze_progress` | ✅ | ❌ | ✅ | ❌ |
| `analyze_proposed` | ✅ | ❌ | ✅ | ❌ |
| `inspect_goal` | ✅ | ❌ | ✅ | ❌ |
| `trace_goal_tree` | ✅ | ❌ | ✅ | ❌ |
| `audit_goal_alignment` | ✅ | ❌ | ✅ | ❌ |
| `export_canvas` | ❌ | ✅¹ | ✅ | ❌ |

**Объяснение колонок:**
- `readOnlyHint=true` — tool не модифицирует state (13 из 15 — pure queries)
- ² `index_hypotheses` rebuilds SQLite cache rows, so it is static-annotated `destructiveHint=true` per MCP semantics. This is destructive only to rebuildable cache state, not to user-authored markdown/run artifacts.
- ¹ **`export_canvas` имеет explicit destructive contract:**
  - В default режиме (`mode: "merge"`) tool читает существующий `.canvas` файл, сохраняет позиции (x/y/width/height) для known nodes и добавляет только новые узлы. Поведение additive, но tool всё равно аннотируется `destructiveHint: true`, потому что тот же tool поддерживает `mode: "overwrite"` и MCP annotations — static hints на уровне tool definition, не per-call contract (см. Appendix D, pattern D1).
  - В режиме `mode: "overwrite"` (явный opt-in пользователя) tool полностью перезаписывает `.canvas` файл. Опасно: уничтожает ручную раскладку.
  - Runtime response всегда возвращает `{ mode_used: "merge"|"overwrite", layout_preserved_count: N }` для прозрачности.
  - Опциональный input flag `dry_run: true` возвращает diff что было бы записано без модификации файла.
- `destructiveHint=false` для всех остальных — ни один tool не удаляет user-written данные. Frontmatter и run manifests редактируются только пользователем извне.
- `idempotentHint=true` везде — повторный вызов с теми же аргументами даёт тот же эффект.
- `openWorldHint=false` везде — все tools оперируют только на indexed project, не делают сетевых запросов.

Регистрация в коде использует `server.registerTool(name, options, handler)` API (как в существующих repo MCPs, см. `hex-line-mcp/server.mjs:174`):

```js
server.registerTool("inspect_hypothesis", {
  description: "Full hypothesis card with tree, gate, runs, evidence, implementation",
  inputSchema: InspectHypothesisInput,        // Zod schema (без app-level zod-to-json-schema)
  outputSchema: InspectHypothesisOutput,      // Zod schema
  annotations: {
    title: "Inspect Hypothesis",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
}, async (input) => {
  // ... возвращает через hex-common's result(structured)
});
```

### 7.6. Quality metadata

Каждый tool, который рапортует evidence, добавляет inline `quality` (как `hex-graph-mcp`).

Tier-system единая на двух уровнях:
- **per-result tier** (в `gate.results.l4.tier=t1`) — качество **отдельного run'a**: `t1` = full validation harness (L4/L5), `t2` = sweep/smoke (L1/L2), `t3` = unit-only/inferred
- **aggregate tier** (в `#quality tier=t1` секции tool response) — качество **ответа в целом**: `t1` если >50% возвращённых гипотез имеют tier-1 runs; `t3` если все только frontmatter без runs

Keys секции `#quality`:
- `coverage` — % гипотез с непустым `runs:` поверх запрошенного скоупа
- `tier` — aggregate tier ответа (см. выше)
- `freshness` — max(`now - last_touched`) в скоупе

Для goal tools дополнительно: `goal_coverage` — % linked гипотез которые `status: live` (показывает реальный прогресс vs wishlist).

---

## 8. PROTOCOL — structured-first wire format

Пакет идёт **structured-first** через `hex-common/runtime/results.result()`, который сериализует структуру так:

```js
const text = JSON.stringify(structured);
return {
    content: [{ type: "text", text }],     // = JSON serialization
    structuredContent: structured,         // = same object
};
```

Таким образом `content[0].text` — это JSON-сериализация той же структуры, что и `structuredContent`. Эта схема унифицирована с `hex-common` и совместима с другими пакетами семьи (`hex-line-mcp` / `hex-graph-mcp`). Line grammar используется только как human-readable rendering на стороне клиента (см. §8.5), не как wire format.

### 8.1. Wire format

Каждый tool возвращает через `hex-common/result()`:

| Поле | Содержание |
|---|---|
| `content[0].text` | `JSON.stringify(structured)` — для legacy clients и token-economy fallback |
| `structuredContent` | structured payload (object, валидируется по `outputSchema`) |
| `outputSchema` | объявляется при `server.registerTool(name, opts, handler)`; current TypeScript SDK server docs support direct Zod `inputSchema`/`outputSchema`, поэтому отдельная app-level зависимость `zod-to-json-schema` не нужна (см. §12 Phase 0) |
| `isError: true` | устанавливается **в tool result** для failed requested operations, которые модель может исправить/retry'нуть: `structured.status === "ERROR"`, а также validation/unsupported failures (`INVALID`, `UNSUPPORTED`) когда конкретный tool call не может быть выполнен. Diagnostic statuses вроде `STALE`, `NO_CHANGES`, `CHANGED` не ставят `isError`. MCP spec различает: `isError: true` в result = **tool execution error**; JSON-RPC errors = **protocol errors**. |

Соответствие [MCP spec 2025-11-25 / Tools][mcp-spec]: spec прямо говорит «structured tool result MUST be conformant to outputSchema» и «for backwards compatibility, also return a response in `content` field with serialized JSON».

### 8.2. Структура `structured` payload

Каждый tool возвращает объект со схемой, использующей **canonical uppercase statuses** из [`docs/best-practice/MCP_OUTPUT_CONTRACT_GUIDE.md`](../docs/best-practice/MCP_OUTPUT_CONTRACT_GUIDE.md):

```ts
{
  status: "OK" | "ERROR" | "INVALID" | "UNSUPPORTED" | "NO_CHANGES" | "CHANGED" | "STALE",
  reason?: string,                           // lowercase snake_case classifier (e.g. "hypothesis_not_found", "index_stale")
  next_action: string,                       // verb-first snake_case (см. ниже)
  // tool-specific payload в порядке из guide §2 (см. per-tool schemas в Phase 1)
  summary?: object,                          // counts, aggregates
  // ... domain-specific sections
  quality?: { coverage: number, tier: "t1"|"t2"|"t3", freshness_days: number },
  provenance?: { source: "frontmatter"|"run_manifest"|"git"|"derived", ref?: string }[],
  warnings?: { code: string, message: string }[],   // code: lowercase snake_case
  follow_ups?: { tool: string, args: Record<string, any> }[]   // executable pointers
}
```

**Casing convention (важно для schemas/tests):**
- `status` — UPPERCASE (canonical 7 values)
- `reason` — **lowercase snake_case** (e.g. `hypothesis_not_found`, `implementation_gap`, `task_drift`, `status_verdict_drift`, `task_status_stale`, `no_comprehensive_run_for_goal`)
- `warnings[].code` — **lowercase snake_case** (тот же vocabulary что и `reason`)
- `next_action` — verb-first snake_case (см. ниже)
- В tests / schema validation **используется только lowercase**. UPPERCASE-формы в прозе плана (`IMPLEMENTATION_GAP`, `STATUS_VERDICT_DRIFT`, `TASK_DRIFT`, `NO_COMPREHENSIVE_RUN_FOR_GOAL`, и т.д.) — это **mnemonic для удобства чтения**, не часть wire format. Парсер/Zod-схемы принимают только lowercase.

**Status mapping для нашего домена:**
- `OK` — успешный результат:
  - **selector lookup hit** — `inspect_hypothesis id=H04` нашёл узел
  - **search hit** — `find_hypotheses status=live` вернул ≥1 результат
  - **search no matches** — `find_hypotheses claim_substring="quantum"` legitimately ничего не нашёл (это валидный нулевой результат). В payload `result: []` + `reason: "no_matches"` для трассируемости. Это НЕ ошибка — search legitimately возвращает empty set.
- `NO_CHANGES` — `analyze_progress` нашёл что между двумя git refs ничего не изменилось
- `CHANGED` — `analyze_progress` нашёл изменения
- `STALE` — `verify_index` обнаружил drift (файлы новее DB); diagnostic result, `isError` не ставится
- `INVALID` — frontmatter validation failed. For `index_hypotheses`, this is failed requested operation (`isError: true`); for `verify_index`, this is successful diagnostic report (`isError` omitted/false).
- `UNSUPPORTED` — попытка вызвать tool на unindexed project и т.п.; failed requested operation, `isError: true`
- `ERROR` — failure modes:
  - **selector lookup miss** — `inspect_hypothesis id=H99` где H99 не существует → `status: "ERROR"` + `reason: "hypothesis_not_found"`. Это ошибка потому что caller передал конкретный ID и ожидал найти.
  - path not found, ambiguous selector, missing required field, cycle detected, и т.д.

Различение **«selector lookup miss» vs «search no matches»** — критическое:
- `inspect_hypothesis id=X` / `inspect_goal id=X` / `find_evidence id=X` — caller делает **point lookup** по конкретному ID; не найдено → `ERROR` с reason
- `find_hypotheses status=Y` / `find_runs type=Z` — caller делает **search/filter**; пустой результат — валидный → `OK` с `result: []` + `reason: "no_matches"`

Не используется: `partial`, `not_found` (см. mapping выше), `success`, `done`. См. guide §3 правила.

`next_action` ∈ verb-first snake_case labels:
- inspect-class: `inspect_hypothesis`, `inspect_goal`
- find-class: `find_evidence`, `find_runs`, `find_hypotheses`
- traverse: `trace_lineage`, `trace_goal_tree`
- audit: `audit_orphans`, `audit_goal_alignment`
- recovery: `widen_query`, `widen_range`, `index_project`, `fix_path`, `review_deleted_api`
- terminal: `none`

### 8.3. Per-tool output schemas (контракт)

Полные Zod-схемы — в Phase 1 deliverable `lib/schema/tool-outputs.mjs`. Здесь для иллюстрации схема `inspect_hypothesis`:

```ts
{
  status: "OK",
  next_action: "find_runs",
  hypothesis: {
    id: "H04",
    claim: "Funding rate ENTRY filter ...",
    category: "signal",
    status: "live",
    goals: ["G1", "G1.1_signal"],
    tree: { parents: ["H02"], children: ["H28"], competes_with: ["H08"] },
    variables: { independent: ["funding_threshold"], control: [...], dependent: [...] },
    gate: {
      metric: ["calmar_advantage", ...],
      thresholds: {...},
      results: { l4: { pass: 28, total: 30, ratio: 0.93, tier: "t1" }, ... },
      kills_on_fail: [], validates_on_pass: ["H02"]
    },
    last_verdict: { decision: "proceed", date: "2026-05-07", rationale: "...", next_hypothesis: "H28" },
    runs: [{ id: "...", type: "l4_multi_entry", metrics: {...}, artifact: "..." }, ...],
    evidence: [{ type: "commit", ref: "5eba9d6", ...}, ...],
    implementation: { branch: "master", symbols: [...], ... }
  },
  quality: { coverage: 1.0, tier: "t1", freshness_days: 1 },
  follow_ups: [
    { tool: "mcp__hex-research__find_runs", args: { path: "/btc-trader", id: "H04", type: "l4_multi_entry" } },
    { tool: "mcp__hex-graph__inspect_symbol", args: { path: "/btc-trader", workspace_qualified_name: "src/data/funding.py:BinanceFundingFetcher" } }
  ]
}
```

### 8.4. Errors

Канонический объект для `status: "ERROR"`:

```ts
{
  status: "ERROR",
  reason: "path_not_found" | "hypothesis_not_found" | "goal_not_found" | "task_not_found" | "source_not_found" | "ambiguous_hypothesis" | "ambiguous_goal" | "wrong_node_kind" | "missing_required_field" | "run_manifest_not_found" | "run_hypothesis_drift" | "goal_hypothesis_drift" | "cycle_detected" | "edge_kind_mismatch" | "no_comprehensive_run_for_goal" | "run_id_reused" | "implementation_gap" | "status_verdict_drift" | "task_drift" | "task_status_stale" | "derived_field_in_source" | "not_implemented",
  // Также используются вне status: "ERROR":
  //   "no_matches" — search вернул empty set (status: "OK", result: [], isError omitted/false)
  //   "index_built_at_<ts>" — для STALE diagnostic responses (isError omitted/false)
  //   "frontmatter_validation_failed" — INVALID; isError depends on tool semantics (`index_hypotheses` true, `verify_index` false)
  next_action: "fix_path" | "widen_query" | "index_project" | "rename_run" | ...,
  message: string,
  details?: Record<string, any>
}
```

Также используется `status: "STALE"` (для `verify_index` когда файлы новее DB), `status: "INVALID"` (frontmatter validation failures), `status: "UNSUPPORTED"` (для запросов на unindexed project). `STALE` и `verify_index` diagnostics без `isError`; `INVALID`/`UNSUPPORTED` ставят `isError: true` только когда конкретный tool call не может выполнить запрошенное действие (например `index_hypotheses` не может построить индекс).

`isError: true` ↔ failed requested operation, not only `structured.status === "ERROR"` (см. MCP Tools error handling и `hex-common/src/runtime/results.mjs:21` как implementation adapter).

### 8.5. Human-readable rendering (NOT wire format, для READMEs/docs)

Документация (README, examples) использует **компактную line-grammar для иллюстрации** того как Claude CLI / другие клиенты могут отрендерить structured payload в человекочитаемый вид. Это **не часть wire format**, а формат документации:

```
ok inspect_hypothesis  H04  next=find_runs  status=live category=signal
  tree: parents=[H02] children=[H28] competes=[H08]
  gate: l4 28/30 (t1)  l5_n12 9/12 (t1)  single_path=+154.3
  verdict: proceed (2026-05-07) → next: H28
  runs: 3   evidence: 3   symbols: 3
  → mcp__hex-research__find_runs id=H04 type=l4_multi_entry
  → mcp__hex-graph__inspect_symbol src/data/funding.py:BinanceFundingFetcher
```

Этот формат **рендерится клиентом из structured payload**, а не приходит в `content[0].text`. Wire format всегда — JSON.stringify через hex-common's `result()`.

### 8.6. Cross-MCP `follow_ups`

Pointers на соседний `hex-graph-mcp` встраиваются в `structured.follow_ups[]`:

```ts
follow_ups: [
  { tool: "mcp__hex-graph__inspect_symbol",
    args: { path: "/btc-trader", workspace_qualified_name: "src/data/funding.py:BinanceFundingFetcher" } }
]
```

Клиент / агент решает вызывать ли. Кросс-MCP мост работает через convention `workspace_qualified_name` (см. §10), не через shared state.

---

## 9. SQLite schema (.hex-skills/researchgraph/index.db)

```sql
-- Schema v1: hypotheses, goals, runs, tasks, sources, edges, FTS5 indices
CREATE TABLE files (
  path TEXT PRIMARY KEY,           -- relative to project root
  kind TEXT NOT NULL,              -- 'hypothesis' | 'goal' | 'run_manifest'
  hash TEXT NOT NULL,              -- file content hash
  mtime INTEGER NOT NULL,
  parsed_at INTEGER NOT NULL
);

-- Canonical node registry — declared BEFORE domain tables для FK clarity.
-- Любой node-kind регистрируется здесь. Domain tables и edges FK на nodes(id).
CREATE TABLE nodes (
  id TEXT PRIMARY KEY,             -- 'H04', 'G1', '2026-05-07_funding_l4', 'src/data/funding.py:Class', 'LIN-1234', etc.
  kind TEXT NOT NULL CHECK (kind IN (
    'hypothesis', 'goal', 'run', 'symbol', 'metric_snapshot', 'branch_or_commit',
    'task', 'source'
  )),
  display_name TEXT,               -- для UI
  properties TEXT                  -- JSON (per-kind extras для denormalization)
);

CREATE INDEX nodes_kind ON nodes(kind);

-- Synthetic nodes (создаются индексом, не из markdown файлов):
-- - kind='symbol': из hypothesis.implementation.symbols[] (мост на hex-graph-mcp)
-- - kind='metric_snapshot': из gate.results entries (для achieves/gated_by edges)
-- - kind='branch_or_commit': из run manifest's git_commit / branch (для runs_in edges)
-- - kind='task': из hypothesis.tasks[] (мост на Linear/Jira/GitHub MCPs)
-- - kind='source': из hypothesis.sources[] И goal.sources[] (unified §4.7, dedup по canonical identity hash)
-- index_hypotheses() upsert'ит эти synthetic nodes ПЕРЕД insert'ом edges,
-- иначе FK constraint fails. См. Phase 1 deliverables (§12).

-- Domain tables (extensions of nodes — id одновременно PK и FK на nodes(id))
-- index_hypotheses() при upsert делает (1) INSERT INTO nodes (id, kind, ...),
-- (2) INSERT INTO hypotheses/goals/runs (id, ...). На delete — CASCADE через nodes.

CREATE TABLE hypotheses (
  id TEXT PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE,    -- 'H04'
  file TEXT NOT NULL REFERENCES files(path) ON DELETE CASCADE,
  claim TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL,
  priority_tier INTEGER,
  prior_belief REAL,
  confidence_post REAL,
  created_at TEXT,
  promoted_at TEXT,
  rejected_at TEXT,
  last_touched TEXT,
  raw_frontmatter TEXT NOT NULL    -- JSON, для inspect verbosity=full
);

-- Goal table
CREATE TABLE goals (
  id TEXT PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE,    -- 'G1', 'G1.1_signal'
  file TEXT NOT NULL REFERENCES files(path) ON DELETE CASCADE,
  claim TEXT NOT NULL,
  status TEXT NOT NULL,            -- 'active' | 'achieved' | 'paused' | 'abandoned'
  priority TEXT,                   -- 'primary' | 'secondary' | 'exploratory'
  deadline TEXT,
  metrics_target TEXT NOT NULL,    -- JSON: {primary: {...}, secondary: {...}}
  metrics_current TEXT,            -- JSON: aggregated by index_hypotheses, NOT from file
  achieved_at TEXT,                -- when metrics_current >= metrics_target.primary
  created_at TEXT,
  last_touched TEXT,
  raw_frontmatter TEXT NOT NULL
);

CREATE INDEX goals_status ON goals(status);

-- Hypothesis ↔ Goal mapping (denormalized for fast queries)
-- Edges типа serves_goal живут в общей edges table; этот table — fast index
-- для запросов "все гипотезы цели G1":
CREATE TABLE hypothesis_goals (
  hypothesis_id TEXT NOT NULL REFERENCES hypotheses(id) ON DELETE CASCADE,
  goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  contribution TEXT,               -- JSON: {calmar: "+0.18", max_drawdown_pp: "+0.7"}
  PRIMARY KEY (hypothesis_id, goal_id)
);

CREATE INDEX hg_goal ON hypothesis_goals(goal_id);
CREATE INDEX hg_hypothesis ON hypothesis_goals(hypothesis_id);

-- Tasks table — task tracker bridge (§4.5)
CREATE TABLE tasks (
  id TEXT PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE,
  -- id format: '<system>:<tracker_id>' для uniqueness across systems
  -- e.g. 'linear:LIN-1234', 'github:owner/repo#123', 'file:tasks/2026-05-07.md'
  system TEXT NOT NULL CHECK (system IN ('linear','jira','github','file','other')),
  tracker_id TEXT NOT NULL,          -- 'LIN-1234' / 'PROJ-567' / 'owner/repo#123'
  url TEXT,
  type TEXT NOT NULL CHECK (type IN ('implementation','refinement','research','rollback')),
  title TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('open','in_progress','done','cancelled')),
  state_snapshot_at TEXT NOT NULL,    -- ISO timestamp of last sync from tracker
  created_at TEXT,
  closed_at TEXT                   -- required by Zod when state IN ('done','cancelled')
);

CREATE INDEX tasks_state ON tasks(state);
CREATE INDEX tasks_system ON tasks(system);

-- Hypothesis ↔ Task mapping (denormalized for fast queries)
CREATE TABLE hypothesis_tasks (
  hypothesis_id TEXT NOT NULL REFERENCES hypotheses(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (hypothesis_id, task_id)
);

CREATE INDEX ht_task ON hypothesis_tasks(task_id);
CREATE INDEX ht_hypothesis ON hypothesis_tasks(hypothesis_id);

-- Sources table — structured external references (§4.7)
-- ВАЖНО: id = canonical content hash построенный ТОЛЬКО по identity-полям
-- (type + doi/arxiv_id/isbn/url/ref/repo/...). Per-cite поля (notes, accessed_at,
-- per-cite timestamp/pages) — в node_sources, не здесь.
-- Это даёт правильный dedup: 1 paper цитируемый 5 H## = 1 row в sources + 5 в node_sources.
-- См. §4.7 "Source identity и dedup" для полной таблицы identity-полей по типу.
CREATE TABLE sources (
  id TEXT PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('paper','video','website','book','podcast','code','dataset','archive')),
  title TEXT,                         -- canonical (одинаков для всех cites)
  url TEXT,                           -- canonical
  identifier TEXT,                    -- DOI / arxiv_id / isbn / repo+commit / archive_ref / dataset_url+snapshot_date
  raw_payload TEXT NOT NULL           -- full JSON canonical-полей для verbosity=full (БЕЗ per-cite полей)
);

CREATE INDEX sources_type ON sources(type);
CREATE INDEX sources_identifier ON sources(identifier);

-- Node ↔ Source mapping — unified для hypotheses И goals (см. §4.7)
-- Source может цитироваться обоими kind узлов с разными per-cite атрибутами;
-- cites edge также в общей edges table.
CREATE TABLE node_sources (
  node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  node_kind TEXT NOT NULL CHECK (node_kind IN ('hypothesis','goal')),
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  -- Per-cite поля (разные для каждой H/G→Source связи):
  notes TEXT,                         -- зачем именно эта гипотеза/цель цитирует этот source
  accessed_at TEXT,                   -- когда автор смотрел source в контексте этой H/G
  cite_extra TEXT,                    -- JSON: per-cite extras (timestamp для video/podcast, pages для book, ...)
  PRIMARY KEY (node_id, source_id)
);

CREATE INDEX ns_source ON node_sources(source_id);
CREATE INDEX ns_node ON node_sources(node_id);
CREATE INDEX ns_kind ON node_sources(node_kind);

-- Edges с FK на nodes для CASCADE и referential integrity
CREATE TABLE edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  src TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  dst TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  src_kind TEXT NOT NULL,          -- denormalized для быстрых kind-aware queries
  dst_kind TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN (
    -- H↔H (§6.1)
    'parent_of', 'refines', 'supersedes', 'refutes', 'competes_with', 'depends_on', 'blocks',
    -- H↔Run/Symbol/Branch/Metric/Task/Source (§6.2)
    'tested_by', 'implemented_in', 'runs_in', 'gated_by', 'tracked_by', 'cites',
    -- Goal edges (§6.3)
    'serves_goal', 'decomposes_goal', 'achieves'
  )),
  properties TEXT,                 -- JSON
  origin TEXT NOT NULL CHECK (origin IN ('frontmatter', 'inferred', 'derived')),
  created_at INTEGER NOT NULL
);

CREATE INDEX edges_src_kind ON edges(src, kind);
CREATE INDEX edges_dst_kind ON edges(dst, kind);
CREATE INDEX edges_kind_src_dst ON edges(kind, src_kind, dst_kind);

-- Schema-level invariants (enforced при index time, not via SQL CHECK):
-- - serves_goal: src_kind='hypothesis', dst_kind='goal'
-- - decomposes_goal: src_kind='goal', dst_kind='goal'
-- - parent_of/refines/supersedes/refutes/competes_with/depends_on/blocks: оба 'hypothesis'
-- - tested_by: src='hypothesis', dst='run'
-- - implemented_in: src='hypothesis', dst='symbol'
-- - runs_in: src='run', dst='branch_or_commit'
-- - gated_by: src='hypothesis', dst='metric_snapshot'
-- - achieves: src='goal', dst='metric_snapshot'
-- - tracked_by: src='hypothesis', dst='task'
-- - cites: src ∈ {'hypothesis','goal'}, dst='source' (sources применимы к обоим kind, см. §4.7)
-- index_hypotheses() валидирует эти инварианты, репортит edge_kind_mismatch

CREATE TABLE runs (
  id TEXT PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE,    -- '2026-05-07_funding_l4'
  hypothesis_id TEXT REFERENCES hypotheses(id), -- nullable for comprehensive goal-level snapshots
  goal_ids TEXT,                      -- JSON array; required when comprehensive=1
  comprehensive INTEGER NOT NULL DEFAULT 0,    -- 1 если run воспроизводит полную live-стратегию (см. §4.4.3)
  included_hypotheses TEXT,        -- JSON array, для comprehensive=1 must include all current live H##s for goal_ids
  branch TEXT,                     -- git branch (master = production strategy)
  type TEXT NOT NULL,              -- 'l4_multi_entry' | ...
  manifest_file TEXT NOT NULL REFERENCES files(path) ON DELETE CASCADE,
  artifact_dir TEXT NOT NULL,
  created_at TEXT NOT NULL,
  git_commit TEXT,
  metrics TEXT NOT NULL            -- JSON
);

CREATE INDEX runs_hypothesis ON runs(hypothesis_id);
CREATE INDEX runs_type ON runs(type);

CREATE TABLE evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hypothesis_id TEXT NOT NULL REFERENCES hypotheses(id) ON DELETE CASCADE,
  type TEXT NOT NULL,              -- 'commit' | 'paper' | 'agent_review' | ...
  ref TEXT NOT NULL,
  date TEXT,
  summary TEXT,
  properties TEXT                  -- JSON (per-type extras)
);

CREATE INDEX evidence_hypothesis ON evidence(hypothesis_id);

-- Hypothesis ↔ Symbol mapping (denormalized for fast queries)
-- Edges типа `implemented_in` живут в общей edges table; этот table — fast index
-- для запросов «все гипотезы трогающие symbol X», мост на hex-graph-mcp
CREATE TABLE hypothesis_symbols (
  hypothesis_id TEXT NOT NULL REFERENCES hypotheses(id) ON DELETE CASCADE,
  workspace_qualified_name TEXT NOT NULL,
  confidence TEXT DEFAULT 'exact', -- 'exact' (явно в frontmatter implementation.symbols) | 'inferred' (выведено из commit-bodies)
  PRIMARY KEY (hypothesis_id, workspace_qualified_name)
);

CREATE INDEX hsym_hypothesis ON hypothesis_symbols(hypothesis_id);
CREATE INDEX hsym_qn ON hypothesis_symbols(workspace_qualified_name);

-- FTS5 для discovery (отдельный для hypotheses и goals)
CREATE VIRTUAL TABLE hypothesis_fts USING fts5(
  id UNINDEXED,
  claim,
  mechanism,
  tags,
  content=''
);

CREATE VIRTUAL TABLE goal_fts USING fts5(
  id UNINDEXED,
  claim,
  rationale,
  content=''
);

PRAGMA user_version = 1;
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
```

Singleton store, idle-close через 1.5s, busy_timeout 2s, ON DELETE CASCADE — паттерн `hex-graph-mcp/lib/store.mjs` 1-в-1.

---

## 10. Кросс-walk с hex-graph-mcp

### 10.1. Конвенция идентификаторов

`hex-research-mcp` использует **те же** `workspace_qualified_name` строки, что `hex-graph-mcp`. Нет общего state — есть общая конвенция.

### 10.2. Pointer из research → graph

`inspect_hypothesis id=H04` в секции `#implementation`:

```
.symbol_link src/data/funding.py:BinanceFundingFetcher kind=class
>mcp__hex-graph__inspect_symbol path=/btc-trader workspace_qualified_name=src/data/funding.py:BinanceFundingFetcher
```

### 10.3. Опционально — обратный мост

При `index_hypotheses` пишется маленький JSON-файл реверс-ссылок:

```
.hex-skills/links/symbol-to-hypothesis.json
{
  "src/data/funding.py:BinanceFundingFetcher": ["H04"],
  "src/pipeline.py:_classify_macro_regime": ["H02", "H04"]
}
```

`hex-graph-mcp` опционально читает этот файл при `inspect_symbol` и в `#metadata`:

```
.linked_hypothesis H04 status=live conf=exact
>mcp__hex-research__inspect_hypothesis path=/btc-trader id=H04
```

Двунаправленность — opt-in для `hex-graph-mcp`. Не обязательна для первого релиза.

---

## 11. Pull-up план в hex-common

После первого работающего релиза `hex-research-mcp` (со скопированными `store.mjs` / `watcher.mjs` / `cycles.mjs`) делается отдельная итерация по выносу generic-инфраструктуры в `hex-common`. Не раньше — потому что нужен второй живой потребитель для определения настоящих границ интерфейса.

### 11.1. Кандидаты на pull-up

| Сейчас в | Будет в | Причина |
|---|---|---|
| `hex-graph-mcp/lib/store.mjs` | `hex-common/graph/sqlite-store.mjs` | generic, не зависит от tree-sitter |
| `hex-graph-mcp/lib/watcher.mjs` | `hex-common/fs/watcher.mjs` | callback-based ingestion |
| `hex-graph-mcp/lib/cycles.mjs` | `hex-common/graph/cycles.mjs` | чистый алгоритм |
| `hex-graph-mcp/lib/clone-hash.mjs` | дополняет `hex-common/text-protocol/hash.mjs` | content hashing |
| `hex-graph-mcp/lib/output-contract.mjs` | дополняет `hex-common/output/normalize.mjs` | grammar |

### 11.2. Что НЕ pull-up

- `parser.mjs` (tree-sitter) — code-specific, остаётся в hex-graph-mcp (или живёт в hex-common как opt-in import)
- `framework.mjs` (React/Django overlays) — остаётся в hex-graph-mcp
- `precise/*` (LSP/SCIP) — остаётся в hex-graph-mcp
- `frontmatter-parser.mjs` — research-specific, остаётся в hex-research-mcp
- `render/canvas.mjs` — research-specific

### 11.3. Граница интерфейса для pull-up'нутых модулей

```js
// hex-common/graph/sqlite-store.mjs
export function createGraphStore({ projectPath, dbDir, schemaSql, schemaVersion }) { ... }

// hex-common/fs/watcher.mjs
export function createFileWatcher({ rootPath, includeGlobs, onChange, onDelete }) { ... }

// hex-common/graph/cycles.mjs
export function detectCycles({ store, edgeKinds }) { ... }
```

Generic enough, чтобы оба MCP их использовали без adapter-слоя.

---

## 12. Roadmap реализации

### Phase 0 — каркас

- [ ] `mcp/hex-research-mcp/package.json` (workspace member, deps на hex-common)
- [ ] `server.mjs` через `hex-common/runtime/mcp-bootstrap`
- [ ] **15 stub tool-handlers** (12 hypothesis + 3 goal) — возвращают через `hex-common/result()` payload `{ status: "ERROR", reason: "not_implemented", next_action: "none", message: "Tool <name> is registered but not yet implemented" }` (соответствует §8 contract: failed requested operation → `isError: true`)
- [ ] Регистрация `inputSchema` И `outputSchema` для каждого tool (current TypeScript SDK server docs support direct Zod schemas; отдельная app-level зависимость `zod-to-json-schema` не нужна, см. [TypeScript SDK server docs](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md))
- [ ] Регистрация `annotations` для каждого tool (см. §7.5: `readOnlyHint`/`destructiveHint`/`idempotentHint`/`openWorldHint`)
- [ ] Все input-схемы — `.strict()`
- [ ] `PROTOCOL.md` — research grammar (включая goal-секции из §8.2)
- [ ] `README.md` — в стиле hex-graph-mcp
- [ ] `test/smoke.mjs` — server starts, listTools returns 15

### Phase 1 — index pipeline

- [ ] `lib/store.mjs` (копия hex-graph + research schema из §9 включая `goals`/`hypothesis_goals`/`tasks`/`sources`/`node_sources` таблицы)
- [ ] `lib/watcher.mjs` (копия hex-graph) — watch'ит `docs/hypotheses/` И `docs/goals/`
- [ ] `lib/frontmatter-parser.mjs` + Zod schemas (`hypothesis.mjs`, `goal.mjs`, `task.mjs`, `source.mjs`, `evidence.mjs`, `run.mjs`)
- [ ] В Zod schemas: run manifest — опциональные `runner_environment`, `random_seed`, `data_snapshot[]` с `name/source/artifact/through/sha256` для exact data identity, `goals` → SQL `runs.goal_ids`; task schema — required `title`, required `closed_at` когда `state ∈ {done,cancelled}`, и запрет `current_time` default для `status_snapshot.at`
- [ ] `tools/index_hypotheses.mjs` — full reindex + incremental по hash:
  - **(1) Upsert synthetic nodes ДО edges**: для каждого symbol из `hypothesis.implementation.symbols[]` создать `nodes(id=qualified_name, kind='symbol')`; для каждого `git_commit`/`branch` из run manifests — `nodes(id=sha, kind='branch_or_commit')`; для каждого `gate.results.<level>` snapshot — `nodes(id=<H##>:<level>, kind='metric_snapshot')`; для каждого task из `hypothesis.tasks[]` — `nodes(id=<system>:<tracker_id>, kind='task')`, где `tracker_id = tasks[].id`; для каждого source из `hypothesis.sources[]` И `goal.sources[]` (unified, см. §4.7) — `nodes(id=<canonical_identity_hash>, kind='source')` с dedup по identity-полям из таблицы §4.7. Без этого FK constraints на edges (`implemented_in`, `runs_in`, `gated_by`, `achieves`, `tracked_by`, `cites`) сломаются.
  - **(2) Upsert hypothesis/goal/run nodes** в общей таблице `nodes`, потом в domain tables (`hypotheses`, `goals`, `runs`, `tasks`, `sources`, `hypothesis_goals`, `hypothesis_tasks`, `hypothesis_symbols` для denorm symbol bridge на hex-graph-mcp, `node_sources` для cite'ов из обоих H##.sources[] и G##.sources[] с per-cite полями `notes`/`accessed_at`/`cite_extra`).
  - **(3) Insert edges** — теперь все FK targets существуют. Для каждого `node_sources` row создать `cites` edge с `src_kind ∈ {'hypothesis','goal'}` (см. §6.2 SQL invariants).
  - **(4) Aggregate `metrics_current` для каждой цели**: найти latest comprehensive run где `goal_ids` содержит G## и `included_hypotheses ⊇ LiveH(G##)`, его results.json metrics → `goals.metrics_current`. Если нет — `null` + warning `no_comprehensive_run_for_goal`.
  - **(5) Validate Status × Tasks invariant matrix** (§4.6): репортить warnings (mnemonic upper-case в плане, но в wire format `warnings[].code` — lowercase snake_case, см. §8.2): `implementation_gap` (pending_implementation без implementation task в open/in_progress; ИЛИ in_progress с refine verdict без refinement task), `status_verdict_drift` (verdict записан, status не транзитнулся: validated_branch с любым verdict; in_progress с не-refine verdict; reject/hold не транзитнулись), `task_drift` (pending_implementation с все task done/cancelled, live без done implementation, live с open/in_progress), `task_status_stale` (>30d).
- [ ] `tools/verify_index.mjs` — drift check (включая `goal_hypothesis_drift` и `derived_field_in_source`)
- [ ] Test fixtures: 3 валидные H##.md + 1 невалидная + 1 run manifest + 2 G##.md (G1 root + G1.1 sub-goal)

### Phase 2 — discovery & inspection

- [ ] `tools/find_hypotheses.mjs` — FTS5 + filter по `category`/`status`/`goal`/`task_state`/`cited_source_type`/`cited_source_year_min`
- [ ] `tools/inspect_hypothesis.mjs` — карточка с tree, variables, gate, verdict, runs, evidence, implementation, tasks, sources; в `follow_ups[]` cross-MCP pointers на установленные tracker MCPs (Linear/Jira/GitHub) для каждого task'a
- [ ] `tools/find_evidence.mjs`
- [ ] `tools/find_runs.mjs` — filter по type/metric thresholds + `comprehensive: bool`
- [ ] Semantic test fixtures (как `hex-graph-mcp/test/fixtures/`) — включая 1 H## с tasks разных state, 1 H## с sources разных types

### Phase 3 — graph traversal

- [ ] `lib/cycles.mjs` (копия hex-graph) — детектит циклы в `parent_of`/`refines`/`supersedes`/`depends_on`/`decomposes_goal`
- [ ] `tools/trace_lineage.mjs` — BFS/DFS по edges
- [ ] `tools/analyze_topology.mjs` — categories + cycles + coupling
- [ ] `tools/audit_orphans.mjs` — категории: `orphan`, `stale`, `dead_branch`, `missing_evidence`, `implementation_gap` (pending_implementation без implementation task в open/in_progress; ИЛИ in_progress с refine verdict без refinement task в open/in_progress), `status_verdict_drift` (verdict записан, status не транзитнулся — validated_branch с любым verdict; in_progress с не-refine verdict; reject/hold не транзитнулись в rejected/deferred), `task_drift` (status=pending_implementation с все done/cancelled; ИЛИ status=live без implementation task в state=done; ИЛИ status=live с open/in_progress task), `task_status_stale` (snapshot >30d)

### Phase 3bis — goal navigation

- [ ] `tools/inspect_goal.mjs` — карточка цели с metrics_target, metrics_current, achievement, hypotheses (linked counts by status), provenance (comprehensive run_id + git_commit), sources (структурированные external refs)
- [ ] `tools/trace_goal_tree.mjs` — `serves_goal` filtered traversal
- [ ] `tools/audit_goal_alignment.mjs` — orphan hypotheses (без `goals:`), misaligned (parent.goals не пересекается с child.goals)
- [ ] Test fixtures: цель + 4 H## с разными `goals: []` конфигурациями (1 нормальная, 1 orphan, 1 misaligned, 1 sub-goal)

### Phase 4 — change & proposal

- [ ] `tools/analyze_progress.mjs` — diff между двумя git-refs; включая дельту `metrics_current` целей
- [ ] `tools/analyze_proposed.mjs` — что задевает H## (включая «какие цели затронет»)

### Phase 5 — render & export

- [ ] `lib/render/canvas.mjs` — JSON Canvas (узлы двух kinds: hypotheses + goals, разные цвета)
- [ ] Position-preserving rendering: `export_canvas` читает существующий `.canvas` и сохраняет координаты (x/y/width/height) для known nodes; добавляет только новые узлы, не перерисовывает раскладку
- [ ] `lib/render/mermaid.mjs` — Mermaid graph (включая goal-узлы как distinguishable shape, `serves_goal` как dashed edge)
- [ ] `tools/export_canvas.mjs` со safe-by-default contract: input `mode: "merge" | "overwrite"` (default `"merge"`), `dry_run: bool` (default `false`); response включает `mode_used` и `layout_preserved_count` (см. §7.5 footnote)
- [ ] Скрипт автогенерации `docs/research-map.md` из индекса
- [ ] Wiki-link синтаксис: frontmatter-parser принимает `parents: [[H02]]` и `goals: [[G1]]` как альтернативу `[H02]`/`[G1]` (Obsidian-совместимость)

### Phase 6 — quality & publish

- [ ] `evals/index.mjs` — capability matrix (15 tools)
- [ ] `benchmark/index.mjs` — workflow token-savings (4-5 типичных сценариев, включая goal-driven «что взять следующим для G1»)
- [ ] `scripts/generate-quality-report.mjs`
- [ ] `scripts/sync-quality-docs.mjs`
- [ ] README — generated quality snapshot + landscape comparison (см. C.2.2) + goal-directed workflow example
- [ ] FAIR-aligned metadata check — встроить в `verify_index` (warnings если frontmatter не FAIR-complete: H## без `goals:`, G## без `metrics_target.primary`)
- [ ] Skill: `plugins/hex-research/skills/hex-research/SKILL.md` (соответствует repo convention `plugins/<plugin>/skills/<skill>/` из `claude-code-skills/AGENTS.md` rule "Plugin-first edits"); содержит описание когда вызывать какие MCP tools (workflow: `inspect_goal G1` → `find_hypotheses goal=G1 status=not_started priority_tier=1` → `inspect_hypothesis` → проектирование теста)
- [ ] `HEX_RESEARCH_AGENTS.md` в корне пакета — короткий контракт «как пользоваться», который ACP-агенты (Claude Code, Codex CLI, Copilot CLI) автоматически читают; включает goal-directed workflow
- [ ] Pre-commit hook — пример в README: `hex-research-mcp verify_index --strict` падает если frontmatter invalid, `runs[].artifact` указывает на несуществующий path, или гипотеза без `goals:` field. CI-friendly exit code.
- [ ] `npm publish` (после тестов на btc-trader)

### Phase 7 — pull-up в hex-common (отдельная PR после первого релиза)

- [ ] Migrate `store.mjs` → `hex-common/graph/sqlite-store.mjs`
- [ ] Migrate `watcher.mjs` → `hex-common/fs/watcher.mjs`
- [ ] Migrate `cycles.mjs` → `hex-common/graph/cycles.mjs`
- [ ] Update `hex-graph-mcp` и `hex-research-mcp` на новые импорты
- [ ] Bump `hex-common` 0.1 → 0.2
- [ ] Bump `hex-graph-mcp` minor

---

## 13. План миграции существующего research-map.md и objective.md

Однократная конвертация 33 гипотез + 1 цели из `btc-trader/docs/`.

### 13.0. Конвертация objective.md → goals/G1.md (делается первым)

`btc-trader/docs/objective.md` сейчас текстовый — содержит формулировку цели и метрики (Calmar, max DD). Перед миграцией гипотез:

1. Прочитать `objective.md` — извлечь measurable thresholds
2. Создать `docs/goals/G1.md` с frontmatter по схеме §4.4.1:
   - `metrics_target.primary` — обязательные thresholds из objective.md (Calmar, max DD)
   - `metrics_target.secondary` — desirable но не обязательные
   - `claim` — одна строка
   - `rationale` — параграф из objective.md как обоснование
   - `sources: [{type: archive, ref: "docs/objective.md", system: "internal_docs", notes: "Исходный документ"}]` (структурированный schema по §4.7)
3. **Не удалять `objective.md`** сразу — пусть полежит для контекста; позже можно сделать stub с pointer на `docs/goals/G1.md`

Если в `btc-trader` цель сразу декомпозируется (например, отдельные блоки про signal-quality vs sizing), создать sub-goals `G1.1_signal.md` и `G1.2_sizing.md` с `parents: [G1]` в каждом. **`G1.children` не писать руками** — это derived field, агрегируется индексом из `G##.parents` других целей (см. §4.4.3).

### 13.1. Скрипт `scripts/migrate-research-map.mjs`

Запускается из `hex-research-mcp/scripts/`. Принимает path к старому файлу, генерирует:

```
btc-trader/docs/hypotheses/H01.md
btc-trader/docs/hypotheses/H02.md
...
btc-trader/docs/hypotheses/H33.md
```

Парсит блоки между `H##  <claim>` и следующим `H##` или `###`. Извлекает:

- `Mechanism`, `Test`, `Gate`, `Status`, `Subsystem`, `Source` → frontmatter
- ASCII dependency-граф из секции "Dependency graph" → только `parents:` для каждой гипотезы (`children` — derived field, агрегируется индексом из `parents` других H##; миграционный скрипт его НЕ пишет, см. §4.4.3)
- "Testing-priority backlog" → `priority_tier:`
- По умолчанию проставляет `goals: [G1]` для всех мигрированных гипотез (т.к. в `btc-trader` все 33 служат единственной цели)

### 13.2. Manual review pass

После автоконверсии — ручной обход каждого файла (33 шт) для:

- Структурирование `gate` из текста в numeric `gate.results`
- Извлечение run-references (где есть упоминания "L4 28/30", "L5 9/12") в `runs:`
- Создание manifest'ов в `benchmark/runs/` для прошлых валидаций (опц. — можно делать только для будущих)
- Заполнение `implementation.symbols` (грепом по упоминаниям в Subsystem)
- Уточнение `goals:` — для гипотез которые служат конкретной sub-goal (e.g. H01-H03 — regime detection — в `goals: [G1, G1.1_signal]`), переключить с дефолтного `[G1]`
- Заполнение `goal_contribution` для `status: live` гипотез (опц. но полезно для ranking)

Объём: 33 файла × проход по списку полей. Можно делегировать Claude в Cowork-режиме.

### 13.3. Старый research-map.md

После миграции:

**Вариант A (recommended):** превращается в auto-generated overview, который рендерится из индекса каждый раз через `hex-research-mcp.export_canvas format=markdown`. Идентичная структура, что и сейчас, но с автообновляемой таблицей и Mermaid-графом.

**Вариант B:** остаётся как ручной narrative-overview (история проекта, big-picture rationale), но без catalog'а отдельных гипотез — каталог в `docs/hypotheses/` сам себе документация.

---

## 14. Риски и открытые вопросы

### 14.1. Риски

| Риск | Митигация |
|---|---|
| Frontmatter становится слишком большой (>200 строк YAML на файл) | Жёсткий лимит на inline-метрики; всё тяжёлое — в `benchmark/runs/` |
| ID-конфликты при merge веток (две ветки добавили H34) | Конвенция: ID присваивается через `next_id` запрос к индексу; merge-conflict в `id:` ловит CI |
| Manual rename H## | Жёстко не поддерживается — все ссылки (`parents`, `supersedes`, `serves_goal`, `included_hypotheses` в run manifests, `goals: [G##]` в других файлах) надо переписать вручную через find-replace по проекту. `verify_index --strict` ловит висячие ссылки через `*_not_found` reasons. Возможное расширение: `aliases: [old_id]` в frontmatter с alias-resolve в индексе. |
| Drift между manifest.hypothesis и H##.runs[].id | `verify_index` детектирует, репортит; CI hook (опц.) |
| Граф разрастается (>500 узлов) | SQLite + индексы тянут до десятков тысяч; интерфейсы `summary-first` | 
| Watcher на windows прыгает на сетевых дисках | hex-graph уже это пережил; chokidar-options скопировать |

### 14.2. Зафиксированные defaults

Каждое решение по конвенции имеет default и обоснование, чтобы не размывать scope.

| Вопрос | Default | Обоснование |
|---|---|---|
| `meta`-гипотезы (H33-style) | `category: meta` (флаг, не отдельный kind) | Goal уже занимает «не-algo» roles; meta-флаг — про process decisions внутри hypothesis tree |
| Versioning гипотезы | Только через git log; YAML `history: []` НЕ вводим | Дублирование с git, drift-источник |
| Comments / discussion | В прозе ниже frontmatter (markdown body); YAML `discussion: []` НЕ вводим | YAML для structured query-able fields, проза для свободного текста |
| Multi-project | One project per index (как hex-graph). Multi-project через несколько `claude mcp add` инстансов | KISS; rebuild каждого индекса дешёв |
| External references | Унифицированное поле `sources: []` (см. §4.7) для обоих H## и G## — типизированный schema (paper/video/website/book/podcast/code/dataset/archive) | Структура заменяет opaque strings; даёт filter-able discovery через `find_hypotheses cited_source_type=...` |
| Run rerun с тем же id | Запрещено — `verify_index --strict` падает с `run_id_reused`; для re-run выдать новый id (e.g. `2026-05-07_funding_l4_v2`) | Идемпотентность артефактов, защита от silent overwrite |
| Comprehensive run frequency | После каждого live-promotion (см. §4.4.3 workflow); не привязано к расписанию | Trigger-based, не time-based |

### 14.3. Не-цели

- Bayesian inference / belief propagation поверх графа (хранение `prior_belief` — да; счёт posterior — нет)
- Web UI / dashboard
- Multi-user collaboration / locking
- **Автономная** автогенерация гипотез агентом без человека (генерация остаётся за автором; индекс — только хранение). Vetting/review предложенной человеком гипотезы — допустим, см. `propose_hypothesis` в §16 (post-v1 roadmap)
- **Автономный выбор «куда двигаться к цели»**: `find_hypotheses goal=G1 priority_tier=1` отдаёт ranked backlog, но финальное решение «брать H29 или H34» остаётся за человеком+Claude в conversation. Индекс — навигационный инструмент, не autopilot. См. §1.5
- LSP-подобные precise overlays (нет аналога LSP для гипотез)

---

## 15. Definition of Done

### 15.0. MVP Acceptance Snapshot

The Server MVP requested for the first implementation pass is complete in commit `63b5439`.

Completed in this repository:

- Local workspace package `@levnikolaevich/hex-research-mcp`.
- Runtime through `@levnikolaevich/hex-common/runtime/mcp-bootstrap`.
- All 15 MCP tools with structured-first output, strict input schemas, output schemas, and annotations.
- SQLite research graph at `.hex-skills/researchgraph/index.db`.
- Fixture-based tests for server startup, schemas/result contract, indexing, query tools, audits, and JSON Canvas export.
- `README.md` and `PROTOCOL.md` for local use and wire contract.

Verification evidence for the MVP:

- `npm --prefix mcp --workspace @levnikolaevich/hex-research-mcp test` passed.
- `npm --prefix mcp --workspace @levnikolaevich/hex-research-mcp run check` passed.
- `npm --prefix mcp --workspace @levnikolaevich/hex-research-mcp run lint` passed.
- `npm --prefix mcp --workspace @levnikolaevich/hex-research-mcp run build` passed.
- `npm --prefix mcp test` passed.
- `npm --prefix mcp audit --audit-level=moderate` passed with 0 vulnerabilities.
- `git diff --check` passed, with only pre-existing CRLF warnings in unrelated files.

Not part of this MVP:

- No btc-trader migration.
- No npm publish.
- No Phase 7 pull-up into `hex-common`.
- No new skill package / `HEX_RESEARCH_AGENTS.md`.
- No generated quality snapshot, eval matrix, or token-savings benchmark beyond the fixture test suite.

The full release DoD below remains the broader target for a published `0.1.0`; the MVP acceptance above is the current completed scope.

`hex-research-mcp@0.1.0` считается готовым когда:

1. Установлено через `npm i -g @levnikolaevich/hex-research-mcp` (после publish) или подключено локально через `claude mcp add`.
2. На `btc-trader/` (после миграции 33 гипотез + конвертации objective.md → G1.md, с проставленными tasks для `live`, `pending_implementation`, и refinement tasks для `in_progress` гипотез с `last_verdict.decision: refine`):
   - `index_hypotheses` строит граф (включая агрегацию `metrics_current` для G1, upsert task/source synthetic nodes)
   - `find_hypotheses status=live` возвращает все live-гипотезы
   - `find_hypotheses goal=G1 status=not_started priority_tier=1` возвращает ranked backlog
   - `find_hypotheses status=pending_implementation` возвращает гипотезы ожидающие merge/deploy
   - `find_hypotheses task_state=open` возвращает все гипотезы с открытыми задачами
   - `find_hypotheses cited_source_type=paper` возвращает гипотезы со ссылками на статьи
   - `inspect_hypothesis id=H04` возвращает полную карточку (frontmatter + tree + variables + verdict + runs + evidence + implementation + tasks + sources); в `follow_ups[]` присутствуют cross-MCP pointers на linear/jira/github MCP (если установлены)
   - `inspect_goal id=G1` возвращает карточку с `metrics_current` из latest comprehensive run, achievement verdict, counts по статусам, sources
   - `trace_lineage from=H04` возвращает H02→H04→H28 + H08 (competes_with)
   - `trace_goal_tree from=G1` возвращает все гипотезы с `goals: [G1]` сгруппированные по category и status
   - `audit_orphans` находит все 8 категорий: orphan, stale, dead_branch, missing_evidence, implementation_gap, status_verdict_drift, task_drift, task_status_stale
   - `audit_goal_alignment` возвращает 0 orphans на здоровом btc-trader
   - `verify_index` репортит 0 drift (включая `goal_hypothesis_drift`, edges с инвариантами `tracked_by`/`cites`)
   - Все edge-types валидируются: `tracked_by` (H→Task) и `cites` (H/G→Source) корректно создаются и FK работают
   - Pointer на `hex-graph-mcp.inspect_symbol` корректно срабатывает в Claude Code
3. Test suite: semantic-fixture тестов passing — покрывают все 8 категорий `audit_orphans`, status × tasks invariant matrix (§4.6), refine/non-refine scenarios (`validated_branch` + `decision: refine` → `status_verdict_drift`; `in_progress` + `decision: refine` без open/in_progress refinement task → `implementation_gap`; `in_progress` + `decision: refine` с valid refinement task → no drift; `in_progress` + `decision: proceed/reject/hold` → `status_verdict_drift`), все 16 edge-types из §6 (7 H↔H + 6 H↔Run/Symbol/Branch/Metric/Task/Source + 3 Goal)
4. Eval matrix: все 15 tools `verified`
5. Workflow benchmark: ≥5 сценариев с замером token-savings vs «прочитать research-map.md + objective.md полностью» (включая goal-driven «что делать дальше для G1» и task-driven «что в pending_implementation»)
6. README — generated quality snapshot встроен через `npm run docs:quality`; включает goal-directed workflow example + task tracker bridge example
7. PROTOCOL.md — полная грамматика research-extension с goal-секциями, task references, structured sources
8. Pull-up план задокументирован, но НЕ выполнен (это Phase 7, отдельная PR)

Целевая метрика workflow-savings: **≥85%** относительно baseline «Read full research-map.md + objective.md» (по аналогии с 91% у hex-graph).

---

## 16. Roadmap после первого релиза

Возможные расширения после `0.1.0` — каждое опционально, не блокирует первый релиз:

**Pull-up в hex-common** — вынос generic-инфраструктуры из локальных копий (`store.mjs`, `watcher.mjs`, `cycles.mjs`) в `hex-common/graph/*` после появления второго потребителя (см. §11).

**Двунаправленный кросс-walk с hex-graph-mcp** — `linked_hypothesis` поле в `inspect_symbol` ответе, чтобы из любого symbol можно было прыгнуть к гипотезе которая его реализует.

**`compare_arena ids=H04,H08`** — текстовый эквивалент MLflow run comparison; side-by-side метрики гипотез из одной арены через `competes_with` edges (см. D.B2).

**`propose_hypothesis claim="..."`** — multi-agent advocate-vs-skeptic vetting (паттерн из ARClaw Stage 7-8, переориентировано на review предложенной человеком гипотезы, не на автогенерацию — см. §14.3); возвращает structured critique с цитированием prior art через `find_hypotheses` + `inspect_hypothesis` (см. D.B1).

**`audit_lessons`** — извлекает паттерны из `status: rejected` гипотез и гипотез с `supersedes`/derived `superseded_by` связями (паттерн MetaClaw Lesson→Skill); генерирует guidance-блок для `docs/CLAUDE.md` проекта (см. D.B3).

**Bayesian extensions** — belief propagation `confidence_post` от runs к гипотезам и parents.

**`extract_evidence path=docs/notes/`** — облегчённая Cognee-style: regex + LLM-classifier на пары предложений, находит упоминания H## в свободных заметках, предлагает добавить в `evidence: []`. Не heavy entity-extraction; opt-in (см. D.B4).

**`analyze_proposed` enhancement** — с MCP sampling-advisory: «эта гипотеза похожа на H07, рассмотри `competes_with`».

**MCP registry submission** — после стабилизации API.

---

## Приложение A — примеры файлов после миграции

### A.1. Hypothesis: docs/hypotheses/H01.md

```markdown
---
id: H01
claim: "Rule-based 4-state classifier (BULL / BEAR / RANGE / TRANSITION)"
category: regime
status: live
goals: [G1, G1.1_signal]        # какие цели обслуживает
goal_contribution:
  G1:
    calmar: "+0.4"              # вклад в primary метрику
    max_drawdown_pp: "+1.2"
parents: []                     # source — корневая, никого не уточняет
competes_with: [H03]
# children — derived (агрегируется из H03.parents=[H01]); НЕ писать руками
mechanism: |
  EMA-cascade + ADX + BB-width quartile. Cheap, interpretable, works
  as a filter even when "wrong" because TRANSITION suppresses everything.
test_protocol: ["L2_sweep", "L4_multi_entry"]
gate:
  metric: ["calmar", "drawdown"]
  thresholds: { calmar_advantage: ">=0", dd_advantage: ">=0" }
  results:
    l4: { pass: 30, total: 30, ratio: 1.0, tier: t1 }
last_verdict:
  decision: proceed
  date: 2026-01-15
  rationale: "L4 30/30, foundational classifier — все downstream signals на нём"
  next_hypothesis: H03           # породила HMM альтернативу
runs:
  - id: 2026-01-15_regime_l4
    type: l4_multi_entry
    metrics: { pass_rate: 1.0 }
    artifact: benchmark/runs/2026-01-15_regime_l4/
evidence:                         # outputs/proofs о тестировании этой гипотезы
  - type: commit
    ref: a1b2c3d
    date: 2026-01-15
    summary: "regime classifier merged to master"
# Документы, которые мотивировали гипотезу (cascade spec из dev-strategy.md),
# идут в `sources` ниже — они не output testing'а, а input.
implementation:
  branch: master
  symbols:
    - "src/signals/regime.py:classify_regime"
tasks:                            # required для status: live (см. §4.5)
  - id: LIN-0042
    system: linear
    url: "https://linear.app/btc-trader/issue/LIN-0042"
    type: implementation
    title: "Implement 4-state regime classifier (H01)"
    status_snapshot:
      state: done
      at: 2026-01-15T09:00:00Z
    created_at: 2025-12-15
    closed_at: 2026-01-15
sources:                          # структурированные external refs
  - type: archive
    ref: "dev-strategy.md §3.1.4"
    system: "internal_docs"
    notes: "cascade specification"
created_at: 2025-12-01
last_touched: 2026-01-15
priority_tier: 1
---

# H01 — Rule-based 4-state classifier

## История

[свободный текст с rationale, обсуждением альтернатив, ссылками на статьи и т.д.]
```

### A.2. Goal: docs/goals/G1.md

```markdown
---
id: G1
claim: "Production-ready BTC long-only strategy"
status: active
priority: primary
deadline: 2026-Q4
metrics_target:
  primary:
    calmar: ">=2.0"
    max_drawdown: "<=25%"
  secondary:
    single_path_return_annual: ">=50%"
    plateau_robustness: required
parents: []                     # source — корневая цель
# children — derived (агрегируется из G1.1_signal.parents=[G1] и G1.2_sizing.parents=[G1]); НЕ писать руками
created_at: 2025-10-01
last_touched: 2026-05-07
rationale: |
  Личный R&D проект. Production-ready = можно запустить с реальными деньгами
  без stop-выключения каждые 2 недели. Calmar — risk-adjusted return.
  Max DD 25% — психологический предел оператора.
sources:                          # унифицированный schema (§4.7), тот же что у H##
  - type: archive
    ref: "docs/objective.md"
    system: "internal_docs"
    notes: "Исходный документ, конвертированный в G1"
  - type: book
    title: "Systematic Trading"
    authors: ["Carver, Robert"]
    edition: "2nd"
    year: 2023
---

# G1 — Production-ready BTC long-only strategy

## Бизнес-контекст

[свободный текст: почему именно эти метрики, как формулировались, история]
```

**Замечание:** в файле НЕТ `metrics_current` — это derived view, агрегируется индексом из `status: live` гипотез. См. §4.4.3.

---

## Приложение B — пример output для inspect_hypothesis

> **ВАЖНО:** Wire format — это `JSON.stringify(structuredContent)` через `hex-common/result()`, см. §8.1-8.3. Пример B.2 ниже — это **human-readable rendering** (CLI/UI representation того же payload'a), **НЕ wire format**. Клиент рендерит line-grammar из structured payload для удобочитаемости; на проводе всегда JSON (B.1).

### B.1. Wire format (что реально летит в MCP envelope)

```json
{
  "content": [{ "type": "text", "text": "{\"status\":\"OK\",\"next_action\":\"find_runs\",\"hypothesis\":{\"id\":\"H04\",\"claim\":\"Funding rate ENTRY filter — skip ENTRY when 7d mean of 8h funding > 0.0004\",\"category\":\"signal\",\"status\":\"live\",\"goals\":[\"G1\",\"G1.1_signal\"],\"tree\":{\"parents\":[\"H02\"],\"children\":[\"H28\"],\"competes_with\":[\"H08\"]},\"variables\":{...},\"gate\":{...},\"last_verdict\":{...},\"runs\":[...],\"evidence\":[...],\"implementation\":{...},\"tasks\":[...],\"sources\":[...]},\"quality\":{\"coverage\":1.0,\"tier\":\"t1\",\"freshness_days\":1},\"follow_ups\":[...]}" }],
  "structuredContent": {
    "status": "OK",
    "next_action": "find_runs",
    "hypothesis": { "id": "H04", "claim": "...", ... },
    "quality": { "coverage": 1.0, "tier": "t1", "freshness_days": 1 },
    "follow_ups": [
      { "tool": "mcp__hex-research__find_runs", "args": { "path": "/btc-trader", "id": "H04", "type": "l4_multi_entry" } },
      { "tool": "mcp__hex-graph__inspect_symbol", "args": { "path": "/btc-trader", "workspace_qualified_name": "src/data/funding.py:BinanceFundingFetcher" } }
    ]
  }
}
```

### B.2. Human-readable rendering (как клиент может отобразить тот же payload)

Это **не часть протокола** — это пример того как Claude CLI / Cursor / любой UI клиент может отрендерить structuredContent для пользователя. Конкретный формат рендеринга — на стороне клиента, не у MCP сервера.

```
OK inspect_hypothesis  H04  next=find_runs  status=live category=signal
  claim: Funding rate ENTRY filter — skip ENTRY when 7d mean of 8h funding > 0.0004
  goals: G1, G1.1_signal
  tree: parents=[H02] children=[H28] competes=[H08]
  variables: indep=funding_threshold, control=[regime_classifier,step_size,period], dep=[calmar,drawdown,single_path_return]
  gate: l4 28/30 (t1)  l5_n12 9/12 (t1)  l5_n20 16/20 (t1)  single_path=+154.3  drawdown=-23.4
  verdict: proceed (2026-05-07) → next: H28
  runs: 3 (incl. 1 comprehensive)   evidence: 3   symbols: 3
  tasks: LIN-1234 (linear, implementation, done)
  sources: 3 (1 paper, 1 archive, 1 website)
  quality: coverage=100% tier=t1 freshness=1d
  → mcp__hex-research__find_runs id=H04 type=l4_multi_entry
  → mcp__hex-graph__inspect_symbol src/data/funding.py:BinanceFundingFetcher
```

Это **рендерится клиентом из B.1 structuredContent**, а не приходит в `content[0].text`. На проводе — JSON (B.1).

---

**Объём реализации.** Коммит `63b5439` покрывает Server MVP из Phase 0-5 плюс минимальную документацию/fixture verification из Phase 6: каркас, 15 tools, schemas, annotations, index pipeline, nodes/edges/goals/runs/tasks/sources schema, comprehensive flag handling, discovery & inspection, graph traversal, goal navigation, change/proposal tools, JSON Canvas export, README, PROTOCOL, and fixture tests. Full Phase 6 artifacts (quality report/evals/benchmark, skill package, AGENTS onboarding, publish) are still post-MVP. Pull-up в hex-common — отдельная PR (Phase 7).

Сроки сознательно не фиксируются в плане — зависят от рабочего темпа, доступности fixtures и параллельных задач. Phase 0 и Phase 1 — самые большие по объёму (output contract + index pipeline). Phase 6 — самый по разбросу (quality/benchmarks/docs зависят от внешних факторов).

**Приложения C и D ниже** — архитектурное обоснование и каталог заимствованных паттернов. Это справочные материалы, не требуются для реализации, но фиксируют рассуждения «почему не reinvent the wheel» и «какие конкретные паттерны применены откуда».

---

## Приложение C — Архитектурное обоснование

Эта секция фиксирует обоснования принятых решений: какие методологические рамки в основе плана, как решение соотносится с существующими решениями на рынке, и какие best-practices применены.

### C.1. Методологическая основа

1. **Strong Inference (Platt 1964) — формальная рамка для дерева гипотез.**
   Работа [Wagstaff et al. 2024 «Design Principles for Falsifiable, Replicable and Reproducible Empirical ML Research»][arxiv-falsifiable] подтверждает falsifiability + per-experiment variable documentation как ядро современной reproducibility-практики.

2. **Markdown frontmatter + MCP-adjacent workflows — не экзотика.**
   Изученные решения используют части этого паттерна: markdown/frontmatter как durable SoT, MCP wrapper, skills loading, или research metadata. План берёт этот подход как synthesis, а не утверждает что каждый prior-art продукт реализует полный markdown-frontmatter+MCP contract.

3. **Parent-child иерархия для experiments — стандартная практика.**
   [MLflow nested runs][mlflow-nested] ровно так же организуют hyperparameter sweep'ы (родитель = эксперимент, дети = конкретные конфиги). Наша tree-структура для гипотез — generalization того же паттерна на уровень исследования.

4. **JSON Canvas v1.0 — open standard.**
   [jsoncanvas.org][json-canvas] поддерживает MIT-лицензированные библиотеки в нескольких экосистемах. `export_canvas` стоит на твёрдом фундаменте.

5. **FAIR principles** — FAIR-aligned coverage по [Wilkinson et al. 2016][wilkinson-fair], без заявления full FAIR compliance:
   - **F**indable: H## / G## ID + FTS5 ✓
   - **A**ccessible: plain markdown без proprietary lock-in ✓
   - **I**nteroperable: open YAML/JSON Canvas/Mermaid ✓
   - **R**eusable: `evidence` + `runs` references + `git_commit` в каждом run manifest ✓

   См. также [The Turing Way / FAIR][turing-fair].

#### C.2.2. ВАЖНО — Прайор-арт: явно сравнить и обосновать собственный пакет

### C.2. Сравнение с прайор-артом

Близких аналогов с полным набором требований (git-committable markdown SoT + heavy run references + cross-walk на code-symbols + tree of falsifiable claims + low-token MCP surface) на рынке не нашлось. Изученные продукты покрывают ортогональные срезы — ниже разбор каждого с обоснованием почему не используем.

##### (a) `tejpalvirk/quantitativeresearch` MCP server [[GitHub][tejpalvirk-quant]]

Существует MCP-сервер с тем же названием концепта: knowledge graph для quantitative research, узлы Hypothesis / Dataset / Variable / StatisticalTest / Project, инструменты `getHypothesisTests`, `getVariableRelationships`. **Концептуально близко к нашей идее.**

*Почему не берём:*
1. Вокабуляр заточен под академическую статистику (variables, descriptive stats, p-values), а не под алготрейдинговые гипотезы (sweeps, multi-entry, walk-forward L4/L5).
2. Не использует git-committable markdown как source of truth — состояние живёт во внутреннем хранилище MCP-сервера, что нарушает наш базовый принцип reproducibility (см. §3).
3. Узкая специализация на статистических тестах не покрывает сабсистемы, branches, gate-plateau, agent-reviews.

*Что взять:* подтверждение что тип-связи `Hypothesis → Test → Project` — общепринятый паттерн (валидирует наши edges).

##### (b) Graphiti / Zep temporal graph и Cognee knowledge-memory systems [[Graphiti][graphiti], [Cognee][cognee]]

Graphiti/Zep дают temporal knowledge graph с validity windows и real-time updates; Cognee даёт MCP/knowledge-graph memory и heavy document extraction (включая Bayer R&D 10K-paper сценарий), но не тот же temporal-validity model.

*Почему не берём:*
1. **Heavyweight:** требуют Neo4j / FalkorDB как зависимость. Для 33-узлового дерева — пушка по воробьям.
2. Designed для **extracting entities** из conversations / unstructured text, не для structured hypothesis trees где автор сам пишет YAML.
3. Temporal validity model Graphiti/Zep ортогонален нашей: статус гипотезы — это её последний state, история — в `git log`, а не в graph properties.

*Что взять:* идея temporal facts может пригодиться позже для Bayesian update'ов (`prior_belief` → `confidence_post` после серии runs).

##### (c) MLflow parent/child runs [[MLflow nested runs][mlflow-nested]]

Уже хранит run hierarchy: parent run = experiment, child runs = hyperparameter configs. Persisted в SQLite/Postgres + filesystem.

*Почему не берём для гипотез:* MLflow runs ≠ research hypotheses. Run — это конкретное выполнение конкретной конфигурации; hypothesis — claim о том, что такая конфигурация работает. Рантайм-иерархия hyperparameter children внутри MLflow run — это другая ось, чем H02 → H04 → H28 lineage гипотез.

*Что взять (опционально):* `runs` в нашем frontmatter могут БЫТЬ MLflow run_id вместо `benchmark/runs/<id>/`. Это даёт UI для просмотра runs бесплатно. Но добавляет heavy dependency на MLflow tracking server. **Решение: не делаем по умолчанию; держим в reserve как integration story для пользователей у которых уже есть MLflow.**

##### (d) `research-hub` (WenyuChiou) [[GitHub][research-hub]]

AI-operable workspace для Zotero / Obsidian / NotebookLM с MCP-обёрткой. Markdown-notes с frontmatter (title, authors, year, DOI, tags, status, cluster).

*Почему не берём:* Целевая аудитория — литературный обзор / Zotero-библиотеки. Frontmatter заточен под academic papers, не под trading hypotheses. **Inspiration source, не prior art.**

##### (e) `AutoResearchClaw` [[GitHub][autoresearchclaw]]

Fully autonomous research system — генерирует идеи, пишет статьи. Включает Idea Workshop для hypothesis co-creation.

*Почему не берём:* Цель — **автогенерация** гипотез. Наша цель — ручная фиксация и навигация по ним. Ортогональные системы.

##### (f) Obsidian + Excalibrain / Logseq / Heptabase

Markdown-first knowledge bases с graph view. Покрывают **визуальный** слой.

*Почему не берём как замену:* Они — **viewing layer**, не storage + query layer. Они не дают MCP-tools для агента. Но: они могут быть **complemented** — например, Obsidian открывает ту же папку `docs/hypotheses/` и Excalibrain рендерит граф из `parents:` свойств для человека. Это не конфликт, это разные слои.

##### Вывод по landscape

Близких аналогов с полным набором требований не нашлось:
- git-committable markdown source of truth ✓
- heavy run references в виде directory artifacts ✓
- cross-walk на code-symbols через `hex-graph-mcp` (`workspace_qualified_name`) ✓
- tree of falsifiable claims (Strong Inference) ✓
- алготрейдинговый вокабуляр (sweep / L0..L5 / multi-entry / walk-forward) ✓
- low-token MCP surface (15 tools, summary-first) ✓

Мы **не reinvent the wheel.** Мы строим узкоспециализированный комбайн на стыке experiment-tracking (MLflow-style), scientific-research-graph (tejpalvirk-style) и knowledge-graph-MCP (Graphiti-style), но с радикально другим storage model (git/markdown) и радикально меньшим scope (один проект, ~30-300 гипотез, не корпоративная семантическая сеть).

### C.3. Reproducibility checklist coverage

[arxiv 2405.18077 «Falsifiable, Replicable Empirical ML Research»][arxiv-falsifiable] перечисляет sources of oversight: lack of workflow frameworks, missing dependencies, manual data manipulation, lack of versioning, lack of intermediates, lack of literate programming.

План адресует:

| Risk | Где адресовано |
|---|---|
| Workflow frameworks | run manifests + `benchmark/runs/` |
| Versioning | git + `git_commit` в manifest |
| Intermediates | parquet/csv в run artifact dir |
| Literate programming | свободная проза в H##.md под frontmatter |
| Runner provenance | опциональный `runner_environment.lockfile` в manifest §3.4 для внешнего benchmark runner |
| Data lineage | `data_snapshot[]` в manifest §3.4 with `name/source/artifact/through/sha256` |

### C.4. MCP best practices

- **Tool count.** 15 tools — в норме per [Webfuse MCP cheat sheet][mcp-cheatsheet] (рекомендация ≤20). Есть запас на расширения.
- **Strict input validation.** Все Zod-схемы input-параметров используют `.strict()` (additionalProperties: false) — соответствует MCP-спеку.
- **Annotations.** Все 15 tools имеют explicit `readOnlyHint`/`destructiveHint`/`idempotentHint`/`openWorldHint` (§7.5). Это risk hints для UX/policy, а не security enforcement; clients still treat untrusted-server annotations as untrusted.
- **Output contract.** structured-first через `hex-common/result()` — `content[0].text` = `JSON.stringify(structuredContent)` (см. §8). Соответствует [MCP spec 2025-11-25][mcp-spec] требованию «structured tool result MUST be conformant to outputSchema» и backwards-compat «also return a response in `content` field».
- **Status vocabulary.** Uppercase canonical (`OK`/`ERROR`/`STALE`/`INVALID`/`UNSUPPORTED`/`NO_CHANGES`/`CHANGED`) per `MCP_OUTPUT_CONTRACT_GUIDE.md`. Reasons и warnings codes — lowercase snake_case.

---

[arxiv-falsifiable]: https://arxiv.org/html/2405.18077v1
[mlflow-nested]: https://mlflow.org/docs/latest/traditional-ml/hyperparameter-tuning-with-child-runs/part1-child-runs/
[json-canvas]: https://jsoncanvas.org/
[turing-fair]: https://book.the-turing-way.org/reproducible-research/rdm/rdm-fair/
[wilkinson-fair]: https://www.nature.com/articles/sdata201618
[mcp-spec]: https://modelcontextprotocol.io/specification/2025-11-25
[atlassian-okr]: https://www.atlassian.com/agile/agile-at-scale/okr
[own]: ./
[tejpalvirk-quant]: https://github.com/tejpalvirk/quantitativeresearch
[graphiti]: https://github.com/getzep/graphiti
[cognee]: https://www.cognee.ai/
[research-hub]: https://github.com/WenyuChiou/research-hub
[autoresearchclaw]: https://github.com/aiming-lab/AutoResearchClaw
[mcp-cheatsheet]: https://www.webfuse.com/mcp-cheat-sheet
[metaclaw]: https://github.com/aiming-lab/MetaClaw
[platt-strong]: https://www.whoi.edu/cms/files/platt64sci_72743.pdf
[ibis-rittel]: https://en.wikipedia.org/wiki/Issue-based_information_system
[dvc]: https://dvc.org/doc

---

## Приложение D — Заимствованные паттерны из изученных продуктов

Каталог изученных решений и обоснование «что взяли / что не взяли» из каждого. Паттерны разделены на три уровня: применённые в плане, отложенные в roadmap, и справочные (анти-паттерны с обоснованием отказа).

### D.0. Источники паттернов

| # | Источник | Что взяли | Что НЕ взяли |
|---|---|---|---|
| 1 | [AutoResearchClaw][autoresearchclaw] | PIVOT/REFINE/PROCEED enum, propose_hypothesis review, skills loading, HEX_RESEARCH_AGENTS.md паттерн, quality gates, branch exploration через git | 23-stage pipeline, autonomous paper writing, multi-agent debate для генерации, 4-layer citation verification, OpenCode beast mode |
| 2 | [MetaClaw][metaclaw] | audit_lessons (lesson→skill conversion), cross-run learning принцип | PRM judge gates, metaclaw proxy infrastructure |
| 3 | [tejpalvirk/quantitativeresearch][tejpalvirk-quant] | специализированные `get_*` aggregations, session-based context, hypothesis ↔ test ↔ project edges | внутреннее in-memory хранилище (нарушает наш SoT-принцип), академический stat-вокабуляр |
| 4 | [Graphiti / Zep][graphiti] | provenance tracking, идея temporal facts (для будущих расширений) | Neo4j/FalkorDB зависимость, entity extraction из conversations |
| 5 | [Cognee][cognee] | extract_evidence (легковесная версия) | heavy entity-extraction на 10K документов |
| 6 | [MLflow nested runs][mlflow-nested] | parent/child run hierarchy в `runs[]`, run comparison паттерн (compare_arena), state-machine валидация | tracking server, UI зависимость |
| 7 | [DVC][dvc] | data lineage + runner provenance в run manifest, DAG view | DVC pipeline формат, S3-storage |
| 8 | [research-hub (WenyuChiou)][research-hub] | frontmatter-as-MCP-source-of-truth, cluster поле | Zotero-specific schema, paper-only фокус |
| 9 | Tolaria / MindForger / Obsidian | wiki-link синтаксис `[[H##]]`, position-preserving canvas, backlinks через edges | макOS-only deps, GUI-first design |
| 10 | [JSON Canvas v1.0][json-canvas] | формат экспорта для визуального дерева | — |
| 11 | [Strong Inference (Platt 1964)][platt-strong] | crucial experiment design (`kills_on_fail`/`validates_on_pass`), conditional inductive tree | формальный disproof через formal logic |
| 12 | [IBIS / Argument Mapping][ibis-rittel] | разделение Position vs Argument (кандидат на будущее расширение `arguments: []`) | формальная dialogue mapping |
| 13 | [FAIR principles][turing-fair] | FAIR-aligned metadata section | full FAIR compliance with DataCite/ORCID/license/access-rights |
| 14 | [Falsifiable ML (arxiv 2405.18077)][arxiv-falsifiable] | variables (independent/control/dependent), reproducibility checklist в manifest | формальные statistical-power tests |
| 15 | [hex-graph-mcp][own] | tier-system для evidence (t1/t2/t3), confidence levels, action-line grammar, use-case-first surface, summary-first responses, `>` follow-up pointers | tree-sitter, framework overlays, LSP precise overlays |
| 16 | [hex-common][own] | бутстрап, results.mjs (dual content+structuredContent), schema validation | parser/tree-sitter (code-specific) |
| 17 | research-map.md (текущий) | формат `Mechanism / Test / Gate / Status / Subsystem / Source`, dependency graph, testing-priority backlog, validation levels L0..L5 | плоский monolithic-файл (заменяем on per-file structure) |

### D.1. Применённые в плане

| # | Паттерн | Где применено | Источник |
|---|---|---|---|
| **A1** | `last_verdict` (decision/date/rationale/next_hypothesis) | §4.1, §4.2 | ARClaw PIVOT/REFINE/PROCEED (Stage 15) |
| **A2** | `variables.{independent, control, dependent}` | §4.1, §4.2 | arxiv 2405.18077 reproducibility checklist |
| **A3** | `gate.kills_on_fail` + `gate.validates_on_pass` | §4.1, §4.2 | Strong Inference (Platt 1964) crucial experiments |
| **A4** | `tier` field в `gate.results` элементах | §4.1, §4.2 | hex-graph-mcp evidence tier system |
| **A5** | Goal as first-class node-kind + `goals: [G##]` field в гипотезах | §1.5, §4.4, §6.3, §7.2, §9 | Управленческая практика (OKR, Opportunity Solution Tree, MLflow Model Registry стадии) |
| **C1** | `plugins/hex-research/skills/hex-research/SKILL.md` (per repo convention) | Phase 6 deliverable | ARClaw skills library |
| **C4** | pre-commit hook `verify_index --strict` | Phase 6 deliverable | ARClaw quality gates |
| **D1** | position-preserving canvas rendering | Phase 5 deliverable | Obsidian Canvas usability |
| **D2** | wiki-link синтаксис `[[H##]]` / `[[G##]]` accepted | Phase 5 deliverable | Obsidian convention |
| **D4** | `HEX_RESEARCH_AGENTS.md` в корне пакета | Phase 6 deliverable | ARClaw RESEARCHCLAW_AGENTS.md паттерн |

**Эффект:** покрытие reproducibility-checklist, Strong-Inference-as-code, goal-directed navigation как ключевая семантика, Obsidian-совместимость, ACP-агент onboarding из коробки.

### D.2. Отложенные в roadmap (см. §16)

| # | Паттерн | Источник |
|---|---|---|
| **B1** | `propose_hypothesis claim="..."` — multi-agent advocate-vs-skeptic review (не генерация, а vetting) | ARClaw Stage 7-8 (Idea Workshop), переориентировано |
| **B2** | `compare_arena ids=H04,H08,H28` — side-by-side метрик гипотез из одной арены | MLflow run comparison + ARClaw branch exploration |
| **B3** | `audit_lessons` — извлекает паттерны из rejected гипотез, генерирует guidance в `docs/CLAUDE.md` | MetaClaw Lesson→Skill conversion |
| **B4** | `extract_evidence path=docs/notes/` — regex + LLM-classifier finds H## упоминания в свободных заметках | Cognee entity extraction (облегчённая) |

**Почему отложены:** каждый из этих tools требует либо отдельного дизайн-цикла (B1, B3 — нужно проработать advocate/skeptic prompts; B4 — нужно собрать корпус для классификатора), либо ждёт стабилизации edges (B2 без `competes_with` арены не работает — а арены формируются по факту, не из frontmatter).

**Когда брать:** B2 первым (после pull-up в hex-common) — самый дешёвый и сразу полезный. B1 после того как накопится 50+ гипотез и появится prior art для vetting. B3 когда наберётся ≥10 rejected гипотез. B4 — самый последний, опционален.

### D.3. Workflow-практики (не код, а методология)

| Паттерн | Что делать | Источник |
|---|---|---|
| Branch exploration через git | Параллельные ветки `feature/H34-vstate-redesign-v3` и `feature/H35-...` с разными H##.md; тестировать обе, мерджить победителя | ARClaw Branch Exploration + git natively |
| Cost guardrails | Периодический ручной запрос «сколько часов в backlog tier-1?»; если >40 часов untested — pivot decision, не копать ещё | ARClaw cost monitoring (50%/80%/100% thresholds) |
| Conditional inductive tree | Каждый узел в дереве должен соответствовать crucial experiment — иначе он не Strong-Inference, а просто wishlist | Platt 1964 + `gate.kills_on_fail` |
| State machine validation | not_started → in_progress → validated_branch → pending_implementation → live (или rejected/deferred) — не пропускать стадии, transitions триггерятся verdict'ами | MLflow Model Registry stages |

Эти не требуют кода — это правила самой работы с системой. Входят в `HEX_RESEARCH_AGENTS.md` как guidance для агента и в README как guidance для человека.

### D.4. Отвергнутые анти-паттерны (с обоснованием)

| Паттерн | Источник | Почему отказались |
|---|---|---|
| Multi-agent debate для **генерации** гипотез | ARClaw Stage 7-8 (полностью) | У Lev гипотезы рождаются из провалов тестов и от чтения папир, не из литературного gap-finding. Берём только vetting (B1) |
| Temporal validity windows | Graphiti | Для 33-300 узлов overhead не оправдан; git log даёт историю |
| Heavy graph DB (Neo4j/FalkorDB) | Graphiti / Cognee | SQLite полностью покрывает scale; не вводим dependency |
| MLflow tracking server | MLflow | UI ради UI — для одного человека overkill; filesystem manifests + наш `find_runs` дают эквивалент |
| 4-layer citation verification (arXiv/CrossRef/DataCite/LLM) | ARClaw Stage 23 | У Lev `evidence: type=paper` в основном internal v2.1 archive + 5-10 публичных папир; полный pipeline overkill. Опциональное `verified: true\|false` достаточно |
| PRM (Process Reward Model) judges | MetaClaw advanced | LLM-as-judge на каждой стадии = токены × API calls; для нашего use case ручное review + B1 покрывает |
| Internal in-memory storage | tejpalvirk/quantitativeresearch | Нарушает базовый принцип «source of truth — git-committable markdown» |
| Polyglot domain entities (Dataset, Variable, StatisticalTest, Model как отдельные node-kinds) | tejpalvirk | Усложнение без выгоды — у нас всё уже в frontmatter гипотезы как структурированные поля |
| Autonomous PIVOT decision | ARClaw Stage 15 | У нас человек+Claude принимает решение в conversation, не автоматический LLM-judge |
| Self-healing experiment code (10 раундов repair) | ARClaw Stage 13 | У Lev sweep-скрипты стабильны и тестируются отдельно; добавлять self-heal слой здесь — не ROI-positive |
| Conference LaTeX export (NeurIPS/ICML/ICLR) | ARClaw Stage 22 | У нас output — не paper, а живая стратегия + queryable tree |

### D.5. Сводная таблица влияния на план

| Источник | В плане | В roadmap | Анти-паттерн |
|---|:---:|:---:|:---:|
| AutoResearchClaw | A1, C1, C4, D4 | B1 | autonomous paper, multi-agent gen |
| MetaClaw | — | B3 | PRM judges |
| tejpalvirk | — | — | internal storage, narrow stat-vocab |
| Graphiti | — | (temporal facts когда-нибудь) | Neo4j |
| Cognee | — | B4 | heavy extraction |
| MLflow | — | B2, state-machine | tracking server |
| DVC | runner provenance в manifest (Phase 1) | — | DVC format |
| research-hub | подтвердило markdown-first | — | Zotero-specific |
| Obsidian / JSON Canvas | D1, D2 | — | — |
| Strong Inference | A3 | — | — |
| IBIS | — | (arguments[] кандидат) | формальная dialogue mapping |
| FAIR | §1.4 compliance section | — | DataCite/ORCID |
| Falsifiable ML (arxiv) | A2 | — | — |
| hex-graph-mcp | A4, наследование PROTOCOL | — | tree-sitter |
| hex-common | base infra | — | parser/tree-sitter |

### D.6. Резюме

Из 40+ паттернов отобрано **10 в плане** (A1-A5, C1, C4, D1, D2, D4) и **4 в roadmap** (B1-B4) — остальные либо anti-pattern для нашего use case, либо станут actionable только при росте графа за 1000 узлов.

Главное концептуальное усиление — **A5 (Goal node как first-class kind)** делает hex-research-mcp **goal-directed research navigation system**, а не просто «filing system гипотез». Пакет отвечает на вопрос «насколько мы близки к цели?», а не только на «что мы пробовали?».

Пакет не reinvent the wheel и не raids чужие архитектуры — он **синтезирует** проверенные паттерны (Strong Inference + reproducibility checklist + MLflow state machine + ARClaw skills + Obsidian conventions + Goal-directed navigation) под узкий use case: long-running algorithmic research с git-committable markdown SoT.
