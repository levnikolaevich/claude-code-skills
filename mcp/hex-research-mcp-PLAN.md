# hex-research-mcp — План создания

> **Статус:** draft v0.3 — 2026-05-08 (с критической оценкой по MCP spec 2025-11-25, прайор-арту, и заимствованными паттернами из 19 изученных продуктов)
> **Автор плана:** Claude (Cowork)
> **Заказчик:** Lev Nikolaevich
> **Связанные пакеты:** `@levnikolaevich/hex-common`, `@levnikolaevich/hex-graph-mcp`
>
> **Приложение C** — критический ресёрч-обзор и сравнение с прайор-артом.
> **Приложение D** — заимствованные паттерны из изученных продуктов (AutoResearchClaw, MetaClaw, MLflow, DVC, Strong Inference, IBIS, FAIR и др.) с разбивкой «брать сейчас / в roadmap / справочно».

## 0. TL;DR

Создаём четвёртый пакет в семье `hex-*` — `@levnikolaevich/hex-research-mcp`. Это **MCP-сервис для дерева гипотез исследования**, дополняющий `hex-graph-mcp` (код) и опирающийся на `hex-common` (runtime, output-contract, hash, file-text).

Ключевые принципы:

1. **Source of truth — markdown с YAML frontmatter** в `docs/hypotheses/H##.md`. Коммитится в git. SQLite-индекс — rebuildable cache в `.hex-skills/researchgraph/index.db` (`.gitignored`).
2. **Тяжёлые результаты — отдельные артефакты** в `benchmark/runs/<run_id>/` (JSON / parquet / графики). Гипотеза ссылается на них по path; индекс знает мост `hypothesis → run → metrics`.
3. **Методология — Strong Inference (Platt 1964)** с расширениями: edges `parent_of`, `refines`, `supersedes`, `refutes`, `competes_with`, `depends_on`, `tested_by`, `implemented_in`, `runs_in`.
4. **Кросс-walk с кодом** через `workspace_qualified_name` — те же canonical selectors, что у `hex-graph-mcp`.
5. **Pull-up в hex-common** делается по факту появления второго потребителя (store, watcher, cycles, output-contract — см. §11).

Цель v0.1: индексирует существующие 33 гипотезы из `btc-trader/docs/research-map.md`, отдаёт 12 tool-surface, drift-проверка, кросс-walk pointers на `hex-graph-mcp`.

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
- **IBIS / Argument Mapping** — узлы Issue / Position / Argument через edges `refutes` / `supports`

### 1.3. Цель пакета

Дать AI-агенту (Claude, Cursor, Cody, любой MCP-клиент) ту же интероперабельность с **деревом исследования**, которую `hex-graph-mcp` даёт с **кодом**: дешёвые, детерминированные, summary-first запросы вместо чтения 1000-строчного markdown-файла.

### 1.4. FAIR-совместимость дизайна

План соответствует [FAIR Guiding Principles (Wilkinson et al. 2016)][wilkinson-fair] — это важно для долгосрочной воспроизводимости, даже если работа не публикуется:

- **Findable** — канонический `id` (H##), FTS5 индекс по claim/mechanism/tags
- **Accessible** — plain markdown без зависимости от инструмента (даже без `hex-research-mcp` файлы читаемы)
- **Interoperable** — open YAML / JSON Canvas / Mermaid; никакого proprietary lock-in
- **Reusable** — `evidence` + `runs` ссылки на воспроизводимые артефакты; `git_commit` в каждом run manifest позволяет пересобрать любой результат

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
  │   ├── frontmatter-parser.mjs   ← НОВОЕ (gray-matter + Zod валидация)
  │   ├── schema/
  │   │   ├── hypothesis.mjs       ← Zod schema гипотезы
  │   │   ├── evidence.mjs         ← Zod schema evidence
  │   │   └── run.mjs              ← Zod schema run reference
  │   ├── tools/
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
  │   │   └── export_canvas.mjs
  │   └── render/
  │       ├── canvas.mjs           ← JSON Canvas (Obsidian)
  │       └── mermaid.mjs          ← Mermaid graph для research-map.md
  ├── PROTOCOL.md                  ← research-extension grammar
  ├── README.md                    ← в стиле hex-graph
  ├── package.json
  ├── test/                        ← node:test, semantic suite
  ├── evals/                       ← capability matrix, quality targets
  ├── benchmark/                   ← workflow token-savings benchmark
  └── scripts/                     ← generate-quality-report, sync-quality-docs
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
    "zod": "^4.3.6"
  }
}
```

`gray-matter` — единственная новая внешняя зависимость относительно `hex-graph-mcp`.

---

## 3. Источник правды и хранение тяжёлых результатов

### 3.1. Раскладка в проекте-потребителе (например, `btc-trader/`)

```
btc-trader/
├── docs/
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
| Полная карточка гипотезы (frontmatter + проза) | `docs/hypotheses/H##.md` | ✅ commit |
| Run descriptor (manifest, config, agent reviews) | `benchmark/runs/<run_id>/manifest.yaml` | ✅ commit |
| Numeric outcomes (Calmar, DD, pass-rate) | `benchmark/runs/<run_id>/results.json` | ✅ commit |
| Equity curves, trade lists | `benchmark/runs/<run_id>/*.parquet,*.csv` | commit или git-lfs (по размеру) |
| stdout / stderr логи | `benchmark/runs/<run_id>/*.log` | ⛔ .gitignore |
| Generated research-map.md (Mermaid + сводка) | `docs/research-map.md` | ✅ commit (overview) |
| SQLite индекс гипотез | `.hex-skills/researchgraph/index.db` | ⛔ .gitignore |
| SQLite индекс кода | `.hex-skills/codegraph/index.db` | ⛔ .gitignore (как было) |

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
hypothesis: H04
type: l4_multi_entry           # l0_unit | l1_smoke | l2_sweep | l3_live_xcheck | l4_multi_entry | l5_walk_forward
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

# Reproducibility (опционально, добавлено в v0.3 по reproducibility-checklist arxiv 2405.18077)
dependencies:
  python: "3.13.2"
  packages:                    # подмножество `pip freeze` или Poetry lock
    pandas: "2.2.3"
    ccxt: "4.4.50"
data_snapshot:                 # ссылка на data slice
  funding_rates_through: 2026-05-06
  klines_through: 2026-05-07
random_seed: 42
```

`hex-research-mcp.index_hypotheses` индексирует **И** `docs/hypotheses/*.md` **И** `benchmark/runs/*/manifest.yaml`, строит граф `Hypothesis ←runs_in→ Run` с метриками в edges/properties.

---

## 4. Schema гипотезы

### 4.1. YAML frontmatter (один файл = одна гипотеза)

```yaml
# docs/hypotheses/H04.md
---
id: H04
claim: "Funding rate ENTRY filter — skip ENTRY when 7d mean of 8h funding > 0.0004"
category: signal              # regime | signal | sizing | exit | composition | robustness | meta
status: live                  # not_started | in_progress | validated_branch | live | rejected | deferred | mixed

# Tree position (становится edges в графе)
parents: [H02]
children: [H28]
supersedes: []
superseded_by: []
competes_with: [H08]
refutes: []
blocked_by: []

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

# Variables (D.A2 — Falsifiable ML reproducibility checklist)
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
  kills_on_fail: []                # D.A3 — Strong Inference: какие H## рейтятся down при провале
  validates_on_pass: [H02]         # H02 (macro filter) подтверждается ещё раз если H04 проходит
  results:
    l4: { pass: 28, total: 30, ratio: 0.93, tier: t1 }       # D.A4 — verification tier
    l5_n12: { pass: 9, total: 12, ratio: 0.75, tier: t1 }
    l5_n20: { pass: 16, total: 20, ratio: 0.80, tier: t1 }
    single_path_return: 154.3
    drawdown: -23.4
    plateau_threshold_set: [0.0004, 0.0008, 0.0016]
    live_cross_check_delta_pp: 1.6

# Last verdict (D.A1 — ARClaw PIVOT/REFINE/PROCEED)
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
related_external:
  - "v2.1::R-04"
  - "Hirsa/Xu/Malhotra 2024"
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
| Theory | `mechanism` | ✅ |
| Test | `gate` (минимум `metric` и `thresholds`) | ✅ для тестируемых; для `not_started` — может быть только `metric:` |
| Tree | `parents`, `children` | ✅ (хотя бы пустые списки) |
| Test | `test_protocol`, `test_scripts` | желательно |
| Variables (D.A2) | `variables.independent`, `.control`, `.dependent` | желательно для тестированных (reproducibility) |
| Gate results | `gate.results` (структурно, с `tier` D.A4) | желательно для тестированных |
| Crucial design (D.A3) | `gate.kills_on_fail`, `gate.validates_on_pass` | опционально, но ценно для Strong Inference |
| Last verdict (D.A1) | `last_verdict.{decision, date, rationale, next_hypothesis}` | ✅ для status ∈ {validated_branch, live, rejected, mixed} |
| Runs | `runs: []` | желательно для тестированных |
| Evidence | `evidence: []` | желательно |
| Implementation | `implementation.symbols` | если status ∈ {validated_branch, live} |
| Lifecycle | `created_at`, `last_touched` | ✅ |
| Edges | `supersedes`, `competes_with`, `refutes`, `blocked_by` | по факту |
| Bayesian | `prior_belief`, `confidence_post`, `assumptions`, `risks` | опционально |
| Meta | `tags`, `related_external` | опционально |

### 4.3. Валидация

Zod-схема в `lib/schema/hypothesis.mjs`. `index_hypotheses` валидирует каждый файл и возвращает по нарушающим:

```
partial fix_frontmatter total=33 invalid=2
.invalid docs/hypotheses/H07.md
!code=MISSING_REQUIRED_FIELD
!message=field 'category' is required
!field=category
```

CI hook опционально: `hex-research-mcp validate path=. --strict` падает если что-то невалидно.

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

`hex-research-mcp` не парсит `*.parquet` / `*.csv` — это работа sweep-script'а. Manifest несёт сводные метрики и path до сырых данных. Если нужно глубже — агент дёргает свой shell/python.

### 5.3. Mapping run → hypothesis

Двунаправленный:

- В YAML гипотезы: `runs: [{id, ...}]` ← фронтальный список
- В manifest run'a: `hypothesis: H04` ← обратная ссылка

Index-time проверка: оба направления должны совпадать. `verify_index` репортит drift.

---

## 6. Типы рёбер графа

| Edge | Domain → Range | Семантика | Edge properties |
|---|---|---|---|
| `parent_of` | H_parent → H_child | детская гипотеза уточняет / расширяет родителя | `created_at` |
| `refines` | H_new → H_old | new — улучшение old (но old не отвергнута) | `aspect` (что уточняется) |
| `supersedes` | H_new → H_old | new заменяет old; old → status=rejected | `reason` |
| `refutes` | H_a → H_b | результаты H_a опровергают H_b | `evidence_run_id` |
| `competes_with` | H_a ↔ H_b | оба тестировались в одной арене (L4 / L5) | `arena_run_id` |
| `depends_on` | H_a → H_b | H_a нельзя тестировать пока H_b не валидирована | `blocker_kind` |
| `tested_by` | H → Run | гипотеза имеет run в evidence | `run_type`, `metrics` |
| `implemented_in` | H → Symbol | продукт-сабсистема (мост на hex-graph) | `symbol_qn`, `confidence` |
| `runs_in` | Run → BranchOrCommit | run воспроизводим из git-state | `commit_sha` |
| `gated_by` | H → Metric | гейт описан критерием | `metric`, `threshold` |
| `blocks` | H_a → H_b | обратное к `depends_on` | — |

`cycles.mjs` детектирует случайные циклы в `parent_of` / `depends_on` / `supersedes` (это инвариант: дерево не должно быть петлевым).

---

## 7. MCP tool surface (12 инструментов)

Маппинг с `hex-graph-mcp` в стиле use-case-first контракта.

| Tool | Use case | Аналог в hex-graph-mcp |
|---|---|---|
| `index_hypotheses` | Build / refresh research graph index | `index_project` |
| `find_hypotheses` | Discover hypotheses by name/category/status | `find_symbols` |
| `inspect_hypothesis` | Full hypothesis card | `inspect_symbol` |
| `find_evidence` | All evidence (commit, paper, agent_review, run) for a hypothesis | `find_references` |
| `find_runs` | All runs matching filter (type, metric threshold, date) | (новый) |
| `trace_lineage` | Path from root to hypothesis OR descendants of hypothesis | `trace_paths` |
| `analyze_topology` | Categories, coupling, cycles, orphans summary | `analyze_architecture` |
| `audit_orphans` | Stale, orphan, dead-branch, missing-evidence hypotheses | `audit_workspace` |
| `analyze_progress` | Status delta between two git refs | `analyze_changes` |
| `analyze_proposed` | What does adding H## affect / who will be its parents | `analyze_edit_region` |
| `verify_index` | Drift check: files vs DB vs run-manifests | (новый) |
| `export_canvas` | Dump JSON Canvas / Mermaid for human view | `export_scip` (по духу) |

### 7.1. Primary selectors

Как у `hex-graph-mcp`, requirement `path` для всех (root проекта, где живут `docs/hypotheses/`). Hypothesis-oriented tools принимают ровно один из:

- `id` (canonical, e.g. `H04`)
- `claim_substring` (резерв на случай, если ID не помнится)
- `qualified_name` (`signal/H04` если будем поддерживать иерархию категорий)

Ambiguous → возвращаем `AMBIGUOUS_HYPOTHESIS` (не silent first-match).

### 7.2. Heavy tools — summary-first

`audit_orphans`, `analyze_topology`, `trace_lineage` — те же принципы, что у hex-graph: возвращаем counts + bounded preview + provenance + executable `>` follow-up pointers, не дамп графа.

### 7.3. Quality metadata

Каждый tool, который рапортует evidence, добавляет inline `quality` (как `hex-graph-mcp`).

Tier-system единая на двух уровнях:
- **per-result tier** (в `gate.results.l4.tier=t1`) — качество **отдельного run'a**: `t1` = full validation harness (L4/L5), `t2` = sweep/smoke (L1/L2), `t3` = unit-only/inferred
- **aggregate tier** (в `#quality tier=t1` секции tool response) — качество **ответа в целом**: `t1` если >50% возвращённых гипотез имеют tier-1 runs; `t3` если все только frontmatter без runs

Keys секции `#quality`:
- `coverage` — % гипотез с непустым `runs:` поверх запрошенного скоупа
- `tier` — aggregate tier ответа (см. выше)
- `freshness` — max(`now - last_touched`) в скоупе

---

## 8. PROTOCOL grammar — research extension

**КОРРЕКТИРОВКА v0.2 (см. Приложение C.2.1):** В отличие от hex-graph-mcp (который на уровне tool-registration дропнул `structuredContent` и `outputSchema`), hex-research-mcp **эмитит оба поля** согласно MCP spec 2025-11-25 «complementary roles»:

- `content[0].text` — компактная текстовая грамматика (как ниже) для conversational mode и token efficiency
- `structuredContent` — JSON-объект для programmatic mode, валидируется через `outputSchema` (Zod → JSON Schema)

Это уже поддерживается `hex-common/runtime/results.result()` (см. `hex-common/src/runtime/results.mjs`), который возвращает `{ content, structuredContent, ...}` одновременно. Каждый tool регистрирует свой `outputSchema` через MCP SDK — это даёт type safety и code generation на стороне клиента бесплатно, не теряя token-efficiency text mode.

Текстовая грамматика (наследуется по форме от [hex-graph PROTOCOL.md](./hex-graph-mcp/PROTOCOL.md), новый только вокабуляр):

### 8.1. Action-line statuses

Те же: `ok | partial | not_found | stale | error`.

### 8.2. Body sections (`#`-префикс)

Новые семантические секции:

| Section | Семантика |
|---|---|
| `#hypothesis` | основной блок карточки |
| `#tree` | parents/children/supersedes |
| `#gate` | thresholds + results |
| `#runs` | run references |
| `#evidence` | evidence list |
| `#implementation` | symbols + branch + flag |
| `#lineage` | path A->B->C по дереву |
| `#topology` | category counts, coupling, cycles |
| `#orphans` | категория проблемных |
| `#progress` | дельта статусов |
| `#quality` | coverage / tier / freshness |
| `#provenance` | откуда факт (frontmatter / run-manifest / git) |
| `#summary` | counts (heavy tools) |

### 8.3. Body entries (`.`-префикс)

| Prefix | Пример |
|---|---|
| `.hypothesis` | `.hypothesis H04 status=live category=signal claim="Funding rate ENTRY filter"` |
| `.evidence` | `.evidence H04 type=agent_review ref=ln-500 issues=4 resolved=1` |
| `.run` | `.run 2026-05-07_funding_l4 type=l4_multi_entry pass=28 total=30 ratio=0.93` |
| `.lineage_step` | `.H02->H04->H28 depth=3` |
| `.orphan` | `.orphan H17 reason=stale last_touched=2025-12-01 days=158` |
| `.cycle` | `.cycle H05->H11->H05 kind=parent_of` |
| `.symbol_link` | `.symbol src/data/funding.py:BinanceFundingFetcher kind=class` |

### 8.4. Pointers (`>`-префикс)

```
>mcp__hex-research__inspect_hypothesis path=/btc-trader id=H04
>mcp__hex-research__find_runs path=/btc-trader id=H04 type=l4_multi_entry
>mcp__hex-graph__inspect_symbol path=/btc-trader workspace_qualified_name=src/data/funding.py:BinanceFundingFetcher
```

Кросс-MCP pointers (третья строка выше) — это и есть мост на hex-graph-mcp.

### 8.5. Errors (`!`-префикс)

| Code | Когда |
|---|---|
| `HYPOTHESIS_NOT_FOUND` | id не найден |
| `AMBIGUOUS_HYPOTHESIS` | несколько кандидатов |
| `MISSING_REQUIRED_FIELD` | YAML не валидируется |
| `RUN_MANIFEST_NOT_FOUND` | гипотеза ссылается на run, которого нет |
| `RUN_HYPOTHESIS_DRIFT` | manifest указывает H_x, а гипотеза — на другой run-id |
| `CYCLE_DETECTED` | петля в parent_of / depends_on |
| `INDEX_STALE` | файлы новее DB |
| `PATH_NOT_FOUND` | проект не существует |

---

## 9. SQLite schema (.hex-skills/researchgraph/index.db)

```sql
-- v1
CREATE TABLE files (
  path TEXT PRIMARY KEY,           -- relative to project root
  kind TEXT NOT NULL,              -- 'hypothesis' | 'run_manifest'
  hash TEXT NOT NULL,              -- file content hash
  mtime INTEGER NOT NULL,
  parsed_at INTEGER NOT NULL
);

CREATE TABLE hypotheses (
  id TEXT PRIMARY KEY,             -- 'H04'
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

CREATE TABLE edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  src TEXT NOT NULL,               -- hypothesis_id
  dst TEXT NOT NULL,
  kind TEXT NOT NULL,              -- 'parent_of' | 'refines' | 'supersedes' | ...
  properties TEXT,                 -- JSON
  origin TEXT NOT NULL,            -- 'frontmatter' | 'inferred'
  created_at INTEGER NOT NULL
);

CREATE INDEX edges_src_kind ON edges(src, kind);
CREATE INDEX edges_dst_kind ON edges(dst, kind);

CREATE TABLE runs (
  id TEXT PRIMARY KEY,             -- '2026-05-07_funding_l4'
  hypothesis_id TEXT NOT NULL REFERENCES hypotheses(id),
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

CREATE TABLE symbol_links (        -- мост на hex-graph-mcp
  hypothesis_id TEXT NOT NULL REFERENCES hypotheses(id) ON DELETE CASCADE,
  workspace_qualified_name TEXT NOT NULL,
  confidence TEXT DEFAULT 'exact', -- 'exact' (явно в frontmatter implementation.symbols) | 'inferred' (выведено из commit-bodies)
  PRIMARY KEY (hypothesis_id, workspace_qualified_name)
);

-- FTS5 для discovery
CREATE VIRTUAL TABLE hypothesis_fts USING fts5(
  id UNINDEXED,
  claim,
  mechanism,
  tags,
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

`hex-graph-mcp` (в будущей версии) при `inspect_symbol` опционально читает этот файл и в `#metadata`:

```
.linked_hypothesis H04 status=live conf=exact
>mcp__hex-research__inspect_hypothesis path=/btc-trader id=H04
```

Двунаправленность — opt-in для `hex-graph-mcp`. Не обязательна для v0.1.

---

## 11. Pull-up план в hex-common

После того как `hex-research-mcp` v0.1 заработает (со скопированными `store.mjs` / `watcher.mjs` / `cycles.mjs`), делается отдельная итерация по выносу generic-инфраструктуры в `hex-common`. **Не делается до**, потому что нужен второй живой потребитель для определения настоящих границ интерфейса.

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

### Phase 0 — каркас (день 1)

- [ ] `mcp/hex-research-mcp/package.json` (workspace member, deps на hex-common)
- [ ] `server.mjs` через `hex-common/runtime/mcp-bootstrap`
- [ ] 12 stub tool-handlers (возвращают `error not_implemented`)
- [ ] `PROTOCOL.md` — research grammar
- [ ] `README.md` — в стиле hex-graph-mcp
- [ ] `test/smoke.mjs` — server starts, listTools returns 12

### Phase 1 — index pipeline (день 2-3)

- [ ] `lib/store.mjs` (копия hex-graph + research schema из §9)
- [ ] `lib/watcher.mjs` (копия hex-graph)
- [ ] `lib/frontmatter-parser.mjs` + Zod schemas (`hypothesis.mjs`, `evidence.mjs`, `run.mjs`)
- [ ] `tools/index_hypotheses.mjs` — full reindex + incremental по hash
- [ ] `tools/verify_index.mjs` — drift check
- [ ] Test fixtures: 3 валидные H##.md + 1 невалидная + 1 run manifest

### Phase 2 — discovery & inspection (день 4-5)

- [ ] `tools/find_hypotheses.mjs` — FTS5 + filter по category/status
- [ ] `tools/inspect_hypothesis.mjs` — карточка с #tree, #gate, #runs, #evidence, #implementation
- [ ] `tools/find_evidence.mjs`
- [ ] `tools/find_runs.mjs` — filter по type/metric thresholds
- [ ] Semantic test fixtures (как `hex-graph-mcp/test/fixtures/`)

### Phase 3 — graph traversal (день 6-7)

- [ ] `lib/cycles.mjs` (копия hex-graph)
- [ ] `tools/trace_lineage.mjs` — BFS/DFS по edges
- [ ] `tools/analyze_topology.mjs` — categories + cycles + coupling
- [ ] `tools/audit_orphans.mjs` — orphan / stale / dead_branch / missing_evidence

### Phase 4 — change & proposal (день 8)

- [ ] `tools/analyze_progress.mjs` — diff между двумя git-refs (опц. через `hex-common/git/semantic-diff` если применимо)
- [ ] `tools/analyze_proposed.mjs` — что задевает H##

### Phase 5 — render & export (день 9)

- [ ] `lib/render/canvas.mjs` — JSON Canvas
- [ ] **D.D1: position-preserving rendering** — `export_canvas` читает существующий `.canvas` и сохраняет координаты (x/y/width/height) для known nodes; добавляет только новые узлы, не перерисовывает раскладку
- [ ] `lib/render/mermaid.mjs` — Mermaid graph
- [ ] `tools/export_canvas.mjs`
- [ ] Скрипт автогенерации `docs/research-map.md` из индекса (опционально для btc-trader)
- [ ] **D.D2: wiki-link синтаксис** — frontmatter-parser принимает `parents: [[H02]]` как альтернативу `parents: [H02]` (Obsidian-совместимость)

### Phase 6 — quality & publish (день 10)

- [ ] `evals/index.mjs` — capability matrix
- [ ] `benchmark/index.mjs` — workflow token-savings (4-5 типичных сценариев)
- [ ] `scripts/generate-quality-report.mjs`
- [ ] `scripts/sync-quality-docs.mjs`
- [ ] README — generated quality snapshot + landscape comparison (см. C.2.2)
- [ ] **D.C1: hex-research skill** — добавить `claude-code-skills/skills/hex-research/SKILL.md` с описанием когда вызывать какие MCP tools (когда смотришь H##: сначала trace_lineage, потом compare_arena, потом inspect)
- [ ] **D.D4: HEX_RESEARCH_AGENTS.md** в корне пакета — короткий контракт «как пользоваться», который ACP-агенты (Claude Code, Codex CLI, Copilot CLI) автоматически читают (паттерн ARClaw `RESEARCHCLAW_AGENTS.md`)
- [ ] **D.C4: pre-commit hook** — пример в README: `hex-research-mcp verify_index --strict` падает если frontmatter invalid или `runs[].artifact` указывает на несуществующий path. CI-friendly exit code.
- [ ] `npm publish` (после тестов на btc-trader)

### Phase 7 — pull-up в hex-common (день 11-12, отдельная PR)

- [ ] Migrate `store.mjs` → `hex-common/graph/sqlite-store.mjs`
- [ ] Migrate `watcher.mjs` → `hex-common/fs/watcher.mjs`
- [ ] Migrate `cycles.mjs` → `hex-common/graph/cycles.mjs`
- [ ] Update `hex-graph-mcp` и `hex-research-mcp` на новые импорты
- [ ] Bump `hex-common` 0.1 → 0.2
- [ ] Bump `hex-graph-mcp` minor

---

## 13. План миграции существующего research-map.md

Однократная конвертация 33 гипотез из `btc-trader/docs/research-map.md` в per-file формат.

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
- ASCII dependency-граф из секции "Dependency graph" → `parents:` / `children:` для каждой гипотезы
- "Testing-priority backlog" → `priority_tier:`

### 13.2. Manual review pass

После автоконверсии — ручной обход каждого файла (33 шт) для:

- Структурирование `gate` из текста в numeric `gate.results`
- Извлечение run-references (где есть упоминания "L4 28/30", "L5 9/12") в `runs:`
- Создание manifest'ов в `benchmark/runs/` для прошлых валидаций (опц. — можно делать только для будущих)
- Заполнение `implementation.symbols` (грепом по упоминаниям в Subsystem)

Оценка: 33 × ~10 мин = ~5 часов работы. Можно делегировать Claude в Cowork-режиме.

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
| Manual rename H## | В YAML `aliases: [old_id]`; `index_hypotheses` поддерживает alias-resolve |
| Drift между manifest.hypothesis и H##.runs[].id | `verify_index` детектирует, репортит; CI hook (опц.) |
| Граф разрастается (>500 узлов) | SQLite + индексы тянут до десятков тысяч; интерфейсы `summary-first` | 
| Watcher на windows прыгает на сетевых дисках | hex-graph уже это пережил; chokidar-options скопировать |

### 14.2. Открытые вопросы (требуют решения автора)

1. **Категория `meta` гипотез (H33-style — не algo, а scope/process решения)** — отдельный node-kind или флаг `category: meta`?
2. **Versioning гипотезы** — если H04 переформулировалась 3 раза, хранить ли историю в YAML (`history: []`) или полагаться на git log?
3. **Comments / discussion** — поддерживать ли inline `discussion:` в YAML как массив `{date, author, text}` или хранить в прозе под frontmatter?
4. **Multi-project** — index работает на одном проекте за раз (как hex-graph). Если у Lev несколько проектов с research-folders — отдельные индексы? Pyproject-style monorepo?
5. **External references** — `related_external` ссылки на v2.1 archive — это URL? Path? Стоит ли индексировать external-references как fts-corpus?
6. **Run rerun policy** — если `benchmark/runs/<old_id>` пересобран с тем же id, индекс должен видеть это как `update` или как `new run`? (Hash сравнение manifest.yaml)

### 14.3. Не-цели v0.1

- Bayesian inference / belief propagation поверх графа (хранение `prior_belief` — да; счёт posterior — нет)
- Web UI / dashboard
- Multi-user collaboration / locking
- **Автономная** автогенерация гипотез агентом без человека (генерация остаётся за автором; индекс — только хранение). Vetting/review предложенной человеком гипотезы — допустим, см. `propose_hypothesis` в §16 v0.4
- LSP-подобные precise overlays (нет аналога LSP для гипотез)

---

## 15. Definition of Done для v0.1

`hex-research-mcp@0.1.0` считается готовым когда:

1. Установлено через `npm i -g @levnikolaevich/hex-research-mcp` (после publish) или подключено локально через `claude mcp add`.
2. На `btc-trader/` (после миграции 33 гипотез):
   - `index_hypotheses` строит граф за <2с
   - `find_hypotheses status=live` возвращает все live-гипотезы за <100мс
   - `inspect_hypothesis id=H04` возвращает полную карточку (frontmatter + tree + runs + evidence + implementation)
   - `trace_lineage from=H04` возвращает H02→H04→H28 + H08 (competes_with)
   - `audit_orphans` находит зависшие in_progress > 30d, гипотезы без parent кроме корней, dead branches
   - `verify_index` репортит 0 drift
   - Pointer на `hex-graph-mcp.inspect_symbol` корректно срабатывает в Claude Code
3. Test suite: ≥30 semantic-fixture тестов passing
4. Eval matrix: все 12 tools `verified`
5. Workflow benchmark: ≥4 сценария с замером token-savings vs «прочитать research-map.md полностью»
6. README — generated quality snapshot встроен через `npm run docs:quality`
7. PROTOCOL.md — полная грамматика research-extension
8. Pull-up план задокументирован, но НЕ выполнен (это Phase 7, отдельная PR)

Целевая метрика workflow-savings: **≥85%** относительно baseline «Read full research-map.md» (по аналогии с 91% у hex-graph).

---

## 16. Пост-v0.1 — что дальше

**v0.2** — Phase 7 pull-up в hex-common
- `store/watcher/cycles` → `hex-common/graph/*` (см. §11)

**v0.3** — двунаправленный кросс-walk и run comparison
- Двунаправленный мост с hex-graph-mcp (`linked_hypothesis` в `inspect_symbol`)
- **D.B2: `compare_arena ids=H04,H08`** — текстовый эквивалент MLflow run comparison; side-by-side метрики гипотез из одной арены через `competes_with` edges

**v0.4** — vetting, lessons, Bayesian
- **D.B1: `propose_hypothesis claim="..."`** — multi-agent advocate-vs-skeptic vetting (паттерн из ARClaw Stage 7-8, **переориентировано на review предложенной человеком гипотезы, не на автогенерацию** — см. §14.3); возвращает structured critique с цитированием prior art через `find_hypotheses` + `inspect_hypothesis`
- **D.B3: `audit_lessons`** — извлекает паттерны из `status: rejected`/`superseded` гипотез (паттерн MetaClaw Lesson→Skill); генерирует guidance-блок для `docs/CLAUDE.md` проекта
- Bayesian extensions: belief propagation `confidence_post` от runs к гипотезам и parents

**v0.5** — extraction и enhancements
- **D.B4: `extract_evidence path=docs/notes/`** — облегчённая Cognee-style: regex + LLM-classifier на пары предложений, находит упоминания H## в свободных заметках, предлагает добавить в `evidence: []`. Не heavy entity-extraction; opt-in.
- **`analyze_proposed` enhancement** (поверх v0.1 baseline) — с MCP sampling-advisory: «эта гипотеза похожа на H07, рассмотри `competes_with`»

**v1.0** — стабильный API; MCP registry submission

---

## Приложение A — пример H##.md после миграции

```markdown
---
id: H01
claim: "Rule-based 4-state classifier (BULL / BEAR / RANGE / TRANSITION)"
category: regime
status: live
parents: []
children: [H03]
competes_with: [H03]
mechanism: |
  EMA-cascade + ADX + BB-width quartile. Cheap, interpretable, works
  as a filter even when "wrong" because TRANSITION suppresses everything.
test_protocol: ["L2_sweep", "L4_multi_entry"]
gate:
  metric: ["calmar", "drawdown"]
  thresholds: { calmar_advantage: ">=0", dd_advantage: ">=0" }
  results:
    l4: { pass: 30, total: 30, ratio: 1.0 }
runs:
  - id: 2026-01-15_regime_l4
    type: l4_multi_entry
    metrics: { pass_rate: 1.0 }
    artifact: benchmark/runs/2026-01-15_regime_l4/
evidence:
  - type: doc
    ref: "dev-strategy.md §3.1.4"
    summary: "cascade specification"
implementation:
  branch: master
  symbols:
    - "src/signals/regime.py:classify_regime"
created_at: 2025-12-01
last_touched: 2026-01-15
priority_tier: 1
---

# H01 — Rule-based 4-state classifier

## История

[свободный текст с rationale, обсуждением альтернатив, ссылками на статьи и т.д.]
```

---

## Приложение B — пример output для inspect_hypothesis

(Обновлено для v0.3 — показывает новые секции `#verdict`, `#variables`)

```
ok find_runs total=1 conf=exact
#hypothesis H04 status=live category=signal
.claim Funding rate ENTRY filter — skip ENTRY when 7d mean of 8h funding > 0.0004
#tree parents=1 children=1 competes_with=1
.parent H02 kind=parent_of
.child H28 kind=parent_of
.competitor H08 kind=competes_with arena=l4_multi_entry
#variables independent=1 control=3 dependent=3
.var_independent funding_threshold
.var_control regime_classifier,step_size,period
.var_dependent calmar,drawdown,single_path_return
#gate metric=calmar_advantage,single_path_return,plateau pass=1
.threshold l4_pass_rate=>=70%
.threshold l5_n12_pass_rate=>=70%
.result l4=28/30=0.93 tier=t1
.result l5_n12=9/12=0.75 tier=t1
.result single_path_return=+154.3
.result drawdown=-23.4
.validates_on_pass H02
#verdict decision=proceed date=2026-05-07
.rationale "Все три гейта прошли с margin; plateau подтверждён; live cross-check в 1.6pp."
.next_hypothesis H28
#runs total=3
.run 2026-05-07_funding_l4 type=l4_multi_entry pass=28 total=30 ratio=0.93
.run 2026-05-07_funding_l5_n12 type=l5_walk_forward pass=9 total=12 ratio=0.75
.run 2026-05-07_funding_live_xcheck type=l3_live_xcheck delta_pp=1.6
#evidence total=3
.evidence type=commit ref=5eba9d6 date=2026-05-07
.evidence type=agent_review ref=ln-500 issues=4 severity=high resolved=1
.evidence type=paper ref=v2.1::R-04
#implementation branch=master flag=null symbols=3
.symbol_link src/data/funding.py:BinanceFundingFetcher kind=class conf=exact
.symbol_link src/db/repo.py:FundingRatesRepo kind=class conf=exact
.symbol_link src/pipeline.py:_classify_macro_regime kind=function conf=exact
#quality coverage=1.0 tier=t1 freshness=1d
>mcp__hex-research__find_runs path=/btc-trader id=H04 type=l4_multi_entry
>mcp__hex-research__trace_lineage path=/btc-trader from=H04 direction=descendants
>mcp__hex-graph__inspect_symbol path=/btc-trader workspace_qualified_name=src/data/funding.py:BinanceFundingFetcher
```

Соответственно §8.2 расширяется секциями `#variables` и `#verdict`, §8.3 — entries `.var_independent`/`.var_control`/`.var_dependent`/`.validates_on_pass`/`.rationale`/`.next_hypothesis`. Конкретный набор закрепляется в PROTOCOL.md при реализации Phase 0.

---

**Сроки реализации.** v0.1: 10 рабочих дней при one-developer focus, или ~3 недели при part-time. Pull-up (Phase 7): +1-2 дня. Заимствованные D.1 паттерны (см. Приложение D): уже включены в Phase 0-6, +1 день суммарно.

**Приложения C и D ниже** — критическая оценка плана и каталог заимствованных паттернов. Это справочные материалы, не требуются для реализации, но фиксируют рассуждения «почему не reinvent the wheel» и «какие конкретные паттерны применены откуда».

---

## Приложение C — Критическая оценка плана (v0.1 → v0.2, 2026-05-08)

После записи v0.1 проведён ресёрч по: (1) актуальной документации MCP, (2) существующим решениям hypothesis/research-tracking, (3) лучшим практикам reproducible research. Эта секция фиксирует находки, корректировки и обоснования «почему всё-таки строим, а не используем существующее».

### C.1. Что подтвердилось ресёрчем (план верен по этим осям)

1. **Strong Inference как методология валидна и переиспользуется в современной ML-практике.**
   Работа [Wagstaff et al. 2024 «Design Principles for Falsifiable, Replicable and Reproducible Empirical ML Research»][arxiv-falsifiable] подтверждает falsifiability + per-experiment variable documentation как ядро современной reproducibility-практики.

2. **Markdown frontmatter + MCP — устоявшийся паттерн, не экзотика.**
   `research-hub` (WenyuChiou, 2026), AutoResearchClaw, Tolaria, scientific-agent-skills — все используют markdown-frontmatter-as-source-of-truth с MCP-обёрткой. Наш план на правильной стороне тренда.

3. **Parent-child иерархия для experiments — стандартная практика.**
   [MLflow nested runs][mlflow-nested] ровно так же организуют hyperparameter sweep'ы (родитель = эксперимент, дети = конкретные конфиги). Наша tree-структура для гипотез — generalization того же паттерна на уровень исследования.

4. **JSON Canvas v1.0 жив и расширяется.**
   [jsoncanvas.org][json-canvas] поддерживает MIT-лицензированные библиотеки на C, Dart, Go, Python, React, Rust, TypeScript. `export_canvas` стоит на твёрдом фундаменте.

5. **FAIR principles совместимы с дизайном.**
   - **F**indable: H## ID + FTS5 ✓
   - **A**ccessible: plain markdown без proprietary lock-in ✓
   - **I**nteroperable: open YAML/JSON Canvas/Mermaid ✓
   - **R**eusable: `evidence` + `runs` references ✓

   См. [The Turing Way / FAIR][turing-fair] и [Wilkinson et al. 2016][wilkinson-fair].

### C.2. Что нужно скорректировать

#### C.2.1. КРИТИЧНО — PROTOCOL должен эмитить и `content`, и `structuredContent`

**Находка:** [MCP спек 2025-11-25][mcp-spec] явно рекомендует **дополняющий** дизайн `content` + `structuredContent`, не их взаимоисключение:

> Tool developers should design outputs where `content` and `structuredContent` serve **complementary** roles: `content` provides a human/model-oriented representation... while `structuredContent` provides a machine-oriented representation with strict schema validation via `outputSchema`.

[SEP-1624][sep-1624] подтверждает: «For backwards compatibility, a tool that returns structured content SHOULD also return a response in `content`».

Решение `hex-graph-mcp` дропать `structuredContent` (см. `hex-graph-mcp/PROTOCOL.md` строка «NO `structuredContent` field. NO `outputSchema` declaration») было обоснованным trade-off в момент написания, но **не оптимально для нового пакета в 2026**.

При этом важно: твой `hex-common/runtime/results.mjs` уже эмитит **оба поля одновременно**:
```js
return {
    content: [{ type: "text", text }],
    structuredContent: structured,
};
```
То есть `hex-common` уже на правильной стороне спека, а `hex-graph-mcp` дропнул `structuredContent` на уровне tool registration (через `outputSchema` declaration), не на уровне `result()`-обёртки.

**Корректировка:** Применена в §8 inline. Каждый tool в `hex-research-mcp`:
- регистрирует `outputSchema` через `zodToJsonSchema(schema)` в MCP SDK
- использует `hex-common/runtime/results.result(structured, opts)` для эмита обоих полей
- сохраняет text grammar как primary representation для conversational/agent mode

Это даёт programmatic mode (валидация типов, code generation, scripting на стороне клиента) бесплатно, не теряя token-efficiency text mode.

#### C.2.2. ВАЖНО — Прайор-арт: явно сравнить и обосновать собственный пакет

В исходном плане я не упомянул несколько существующих решений. Честный анализ:

##### (a) `tejpalvirk/quantitativeresearch` MCP server [[GitHub][tejpalvirk-quant]]

Существует MCP-сервер с тем же названием концепта: knowledge graph для quantitative research, узлы Hypothesis / Dataset / Variable / StatisticalTest / Project, инструменты `getHypothesisTests`, `getVariableRelationships`. **Концептуально близко к нашей идее.**

*Почему не берём:*
1. Вокабуляр заточен под академическую статистику (variables, descriptive stats, p-values), а не под алготрейдинговые гипотезы (sweeps, multi-entry, walk-forward L4/L5).
2. Не использует git-committable markdown как source of truth — состояние живёт во внутреннем хранилище MCP-сервера, что нарушает наш базовый принцип reproducibility (см. §3).
3. Узкая специализация на статистических тестах не покрывает сабсистемы, branches, gate-plateau, agent-reviews.

*Что взять:* подтверждение что тип-связи `Hypothesis → Test → Project` — общепринятый паттерн (валидирует наши edges).

##### (b) Graphiti / Zep / Cognee — temporal knowledge graphs [[Graphiti][graphiti], [Cognee][cognee]]

Опен-сорс MCP-серверы поверх Neo4j / FalkorDB. Поддержка temporal facts (validity windows), entity extraction, real-time updates. Cognee использовался Bayer R&D для генерации гипотез по 10K научных статей.

*Почему не берём:*
1. **Heavyweight:** требуют Neo4j / FalkorDB как зависимость. Для 33-узлового дерева — пушка по воробьям.
2. Designed для **extracting entities** из conversations / unstructured text, не для structured hypothesis trees где автор сам пишет YAML.
3. Их temporal model (facts с validity windows) ортогональна нашей: статус гипотезы — это её последний state, история — в `git log`, а не в graph properties.

*Что взять:* идея temporal facts может пригодиться позже для Bayesian update'ов (`prior_belief` → `confidence_post` после серии runs). Кандидат на v0.5+.

##### (c) MLflow parent/child runs [[MLflow nested runs][mlflow-nested]]

Уже хранит run hierarchy: parent run = experiment, child runs = hyperparameter configs. Persisted в SQLite/Postgres + filesystem.

*Почему не берём для гипотез:* MLflow runs ≠ research hypotheses. Run — это конкретное выполнение конкретной конфигурации; hypothesis — claim о том, что такая конфигурация работает. Рантайм-иерархия hyperparameter children внутри MLflow run — это другая ось, чем H02 → H04 → H28 lineage гипотез.

*Что взять (опционально):* в v0.4+ — `runs` в нашем frontmatter могут БЫТЬ MLflow run_id вместо `benchmark/runs/<id>/`. Это даёт UI для просмотра runs бесплатно. Но добавляет heavy dependency на MLflow tracking server. **Решение для v0.1: не делаем; держим в reserve как «integration story».**

##### (d) `research-hub` (WenyuChiou) [[GitHub][research-hub]]

AI-operable workspace для Zotero / Obsidian / NotebookLM с MCP-обёрткой. Markdown-notes с frontmatter (title, authors, year, DOI, tags, status, cluster).

*Почему не берём:* Целевая аудитория — литературный обзор / Zotero-библиотеки. Frontmatter заточен под academic papers, не под trading hypotheses. **Inspiration source, не prior art.**

##### (e) `AutoResearchClaw` [[GitHub][autoresearchclaw]]

Fully autonomous research system — генерирует идеи, пишет статьи. Включает Idea Workshop для hypothesis co-creation.

*Почему не берём:* Цель — **автогенерация** гипотез. Наша цель — ручная фиксация и навигация по ним. Ортогональные системы.

##### (f) Obsidian + Excalibrain / Logseq / Heptabase

Markdown-first knowledge bases с graph view. Покрывают **визуальный** слой.

*Почему не берём как замену:* Они — **viewing layer**, не storage + query layer. Они не дают MCP-tools для агента. Но: они могут быть **complemented** — например, Obsidian открывает ту же папку `docs/hypotheses/` и Excalibrain рендерит граф из `parents:` свойств для человека. Это не конфликт, это разные слои.

##### Вывод

Близких аналогов с таким же набором требований **не нашлось**:
- git-committable markdown source of truth ✓
- heavy run references в виде directory artifacts ✓
- cross-walk на code-symbols через `hex-graph-mcp` (`workspace_qualified_name`) ✓
- tree of falsifiable claims (Strong Inference) ✓
- алготрейдинговый вокабуляр (sweep / L0..L5 / multi-entry / walk-forward) ✓
- low-token MCP surface (12 tools, summary-first) ✓

Мы **не reinvent the wheel.** Мы строим узкоспециализированный комбайн на стыке experiment-tracking (MLflow-style), scientific-research-graph (tejpalvirk-style) и knowledge-graph-MCP (Graphiti-style), но с radикально другим storage model (git/markdown) и radикально меньшим scope (один проект, ~30-300 гипотез, не корпоративная семантическая сеть).

**Действие:** в README и в §1.3 плана добавить этот «landscape comparison» — для discoverability и доверия, чтобы будущим пользователям было сразу понятно, какую нишу пакет занимает.

#### C.2.3. УТОЧНЕНИЕ — FAIR-compliance стоит явно зафиксировать

В §1 добавить блок (после миграционного контекста):

> **FAIR-совместимость дизайна:**
> - **Findable:** канонический `id` (H##), FTS5 индекс по claim/mechanism/tags
> - **Accessible:** plain markdown без зависимости от инструмента
> - **Interoperable:** open YAML / JSON Canvas / Mermaid
> - **Reusable:** `evidence` + `runs` ссылки на воспроизводимые артефакты + `git_commit` в каждом run manifest

Это формальное соответствие [Wilkinson et al. 2016 *Scientific Data*][wilkinson-fair] — важно если когда-либо публиковать research или pre-print.

#### C.2.4. УТОЧНЕНИЕ — Reproducibility checklist gap

[arxiv 2405.18077][arxiv-falsifiable] перечисляет sources of oversight: lack of workflow frameworks, missing dependencies, manual data manipulation, lack of versioning, lack of intermediates, lack of literate programming.

План адресует:

| Risk | Адресовано? | Где |
|---|---|---|
| Workflow frameworks | ✓ | run manifests + `benchmark/runs/` |
| Versioning | ✓ | git + `git_commit` в manifest |
| Intermediates | ✓ | parquet/csv в run artifact dir |
| Literate programming | ✓ | свободная проза в H##.md под frontmatter |
| **Dependencies** | ✗ | manifest НЕ фиксирует версии библиотек / data snapshot |
| **Data lineage** | ✗ | нет lineage от raw data → processed data |

**Корректировка:** в §3.4 manifest run'a добавить опциональные поля:

```yaml
dependencies:
  python: "3.13.2"
  packages:                    # output of `pip freeze` или Poetry lock subset
    pandas: "2.2.3"
    ccxt: "4.4.50"
data_snapshot:                  # ссылка на data slice
  funding_rates_through: 2026-05-06
  klines_through: 2026-05-07
random_seed: 42
```

#### C.2.5. ВТОРОСТЕПЕННОЕ — MCP tool count guidance

Текущий план — 12 tools. Best practice 2026 ([Webfuse MCP cheat sheet][mcp-cheatsheet]) рекомендует ≤20 tools на сервер для надёжной диспетчеризации агентом. **12 — в норме.**

Stretch-вопрос: рассмотреть мерджинг `find_evidence` + `find_runs` в один `find_evidence type=...` (run — это особый тип evidence). Сократит до 11 и упростит ментальную модель агента. Но evidence имеет lightweight payload, run — heavy reference + metrics; разделение оправдано. **Решение: оставить 12.**

#### C.2.6. ВТОРОСТЕПЕННОЕ — strict input validation

MCP-спек рекомендует strict JSON Schema with `additionalProperties: false` для tool inputs. Zod даёт это бесплатно через `.strict()`. **Действие:** во всех Zod-схемах input-параметров использовать `.strict()`.

### C.3. Что НЕ нужно менять (подтверждено ресёрчем)

- Storage model «markdown source of truth + SQLite cache» — правильное решение, подтверждается всеми markdown-first MCP проектами (research-hub, scientific-agent-skills, Tolaria).
- 12 tool surface — в норме для MCP best practices 2026.
- Tree edge types (`parent_of` / `refines` / `supersedes` / `refutes`) — close match с Argument Mapping / IBIS academic literature.
- JSON Canvas export — open standard v1.0, поддерживается.
- Cross-walk через `workspace_qualified_name` — соответствует общему MCP паттерну convention-over-configuration.
- Strong Inference как методологическая рамка — academically sound и reused в современной ML-research practice.

### C.4. Обновлённый roadmap deltas (что добавлено в Phase 0..6)

**Phase 0:**
- Регистрация `outputSchema` для каждого tool (Zod → JSON Schema через `zod-to-json-schema`)
- Все input-схемы — `.strict()`

**Phase 1:**
- В Zod schema run manifest — опциональные `dependencies`, `data_snapshot`, `random_seed`

**Phase 6:**
- FAIR-compliance check встроить в `verify_index` (warnings если frontmatter не FAIR-complete)
- README — добавить «Landscape comparison» секцию (см. C.2.2)

**Стоимость корректировок:** ~1 рабочий день. Не меняет общую архитектуру и не отменяет ни одного решения v0.1.

### C.5. Вердикт

План **в основном корректен**, не изобретает колесо в смысле «строит тот же продукт что уже есть на рынке». Реальные близкие аналоги (tejpalvirk/quantitativeresearch, Graphiti, MLflow, research-hub) покрывают ортогональные срезы (academic stats, agent memory, ML training, literature management) и не закрывают specific need «git-committable hypothesis tree с heavy run references для алготрейдингового исследования + cross-walk на code-symbols через hex-graph-mcp».

Корректировки сводятся к:
1. **PROTOCOL:** эмитить и `content` и `structuredContent` — соответствие MCP spec 2025-11-25 (применено в §8)
2. **Прайор-арт:** явно задокументировать в README и §1 (для discovery / trust)
3. **FAIR + reproducibility:** добавить опциональные поля в manifest и compliance-чек
4. **Strict-Zod:** для всех inputs

**Plan v0.3 после интеграции D.1 паттернов — ready to execute.** (См. Приложение D ниже для конкретных заимствованных паттернов и Приложение D.5 для матрицы влияния.)

---

[arxiv-falsifiable]: https://arxiv.org/html/2405.18077v1
[mlflow-nested]: https://mlflow.org/docs/latest/traditional-ml/hyperparameter-tuning-with-child-runs/part1-child-runs/
[json-canvas]: https://jsoncanvas.org/
[turing-fair]: https://book.the-turing-way.org/reproducible-research/rdm/rdm-fair/
[wilkinson-fair]: https://www.nature.com/articles/sdata201618
[mcp-spec]: https://modelcontextprotocol.io/specification/2025-11-25
[sep-1624]: https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1624
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

После Приложения C (критическая оценка) проведён отдельный синтез: **что из 19 изученных продуктов конкретно стоит позаимствовать**. Все паттерны разделены на три уровня: «брать в v0.1», «в roadmap v0.2-v0.5», «справочно (не берём, но знаем причину)». Каждый паттерн привязан к конкретной правке плана.

### D.0. Источники паттернов

| # | Источник | Что взяли | Что НЕ взяли |
|---|---|---|---|
| 1 | [AutoResearchClaw][autoresearchclaw] | PIVOT/REFINE/PROCEED enum, propose_hypothesis review, skills loading, HEX_RESEARCH_AGENTS.md паттерн, quality gates, branch exploration через git | 23-stage pipeline, autonomous paper writing, multi-agent debate для генерации, 4-layer citation verification, OpenCode beast mode |
| 2 | [MetaClaw][metaclaw] | audit_lessons (lesson→skill conversion), cross-run learning принцип | PRM judge gates, metaclaw proxy infrastructure |
| 3 | [tejpalvirk/quantitativeresearch][tejpalvirk-quant] | специализированные `get_*` aggregations, session-based context, hypothesis ↔ test ↔ project edges | внутреннее in-memory хранилище (нарушает наш SoT-принцип), академический stat-вокабуляр |
| 4 | [Graphiti / Zep][graphiti] | provenance tracking, идея temporal facts (для v1.0+) | Neo4j/FalkorDB зависимость, entity extraction из conversations |
| 5 | [Cognee][cognee] | extract_evidence (легковесная версия) | heavy entity-extraction на 10K документов |
| 6 | [MLflow nested runs][mlflow-nested] | parent/child run hierarchy в `runs[]`, run comparison паттерн (compare_arena), state-machine валидация | tracking server, UI зависимость |
| 7 | [DVC][dvc] | data lineage + dependencies в run manifest, DAG view | DVC pipeline формат, S3-storage |
| 8 | [research-hub (WenyuChiou)][research-hub] | frontmatter-as-MCP-source-of-truth, cluster поле | Zotero-specific schema, paper-only фокус |
| 9 | Tolaria / MindForger / Obsidian | wiki-link синтаксис `[[H##]]`, position-preserving canvas, backlinks через edges | макOS-only deps, GUI-first design |
| 10 | [JSON Canvas v1.0][json-canvas] | формат экспорта для визуального дерева | — |
| 11 | [Strong Inference (Platt 1964)][platt-strong] | crucial experiment design (`kills_on_fail`/`validates_on_pass`), conditional inductive tree | формальный disproof через formal logic |
| 12 | [IBIS / Argument Mapping][ibis-rittel] | разделение Position vs Argument (для будущего расширения `arguments: []`) | формальная dialogue mapping |
| 13 | [FAIR principles][turing-fair] | id-as-PID, machine-actionable metadata, явная FAIR-compliance section | DataCite registration, ORCID integration |
| 14 | [Falsifiable ML (arxiv 2405.18077)][arxiv-falsifiable] | variables (independent/control/dependent), reproducibility checklist в manifest | формальные statistical-power tests |
| 15 | [hex-graph-mcp][own] | tier-system для evidence (t1/t2/t3), confidence levels, action-line grammar, use-case-first surface, summary-first responses, `>` follow-up pointers | tree-sitter, framework overlays, LSP precise overlays |
| 16 | [hex-common][own] | бутстрап, results.mjs (dual content+structuredContent), schema validation | parser/tree-sitter (code-specific) |
| 17 | research-map.md (текущий) | формат `Mechanism / Test / Gate / Status / Subsystem / Source`, dependency graph, testing-priority backlog, validation levels L0..L5 | плоский monolithic-файл (заменяем on per-file structure) |

### D.1. БЕРЁМ В v0.1 — добавлено в плане выше

| # | Паттерн | Где применено | Источник |
|---|---|---|---|
| **A1** | `last_verdict` (decision/date/rationale/next_hypothesis) | §4.1, §4.2 | ARClaw PIVOT/REFINE/PROCEED (Stage 15) |
| **A2** | `variables.{independent, control, dependent}` | §4.1, §4.2 | arxiv 2405.18077 reproducibility checklist |
| **A3** | `gate.kills_on_fail` + `gate.validates_on_pass` | §4.1, §4.2 | Strong Inference (Platt 1964) crucial experiments |
| **A4** | `tier` field в `gate.results` элементах | §4.1, §4.2 | hex-graph-mcp evidence tier system |
| **C1** | `claude-code-skills/skills/hex-research/SKILL.md` | Phase 6 deliverable | ARClaw skills library |
| **C4** | pre-commit hook `verify_index --strict` | Phase 6 deliverable | ARClaw quality gates |
| **D1** | position-preserving canvas rendering | Phase 5 deliverable | Obsidian Canvas usability |
| **D2** | wiki-link синтаксис `[[H##]]` accepted | Phase 5 deliverable | Obsidian convention |
| **D4** | `HEX_RESEARCH_AGENTS.md` в корне пакета | Phase 6 deliverable | ARClaw RESEARCHCLAW_AGENTS.md паттерн |

**Стоимость в Phase 0-6:** ~+1 день суммарно (A1-A4 — schema добавки, C1/C4/D1/D2/D4 — небольшие deliverables).

**Польза:** покрытие reproducibility-checklist, Strong-Inference-as-code, Obsidian-совместимость, ACP-агент onboarding из коробки.

### D.2. БЕРЁМ В ROADMAP — добавлено в §16

| # | Паттерн | Версия | Источник |
|---|---|---|---|
| **B1** | `propose_hypothesis claim="..."` — multi-agent advocate-vs-skeptic review (не генерация, а vetting) | v0.4 | ARClaw Stage 7-8 (Idea Workshop), но переориентировано |
| **B2** | `compare_arena ids=H04,H08,H28` — side-by-side метрик гипотез из одной арены | v0.3 | MLflow run comparison + ARClaw branch exploration |
| **B3** | `audit_lessons` — извлекает паттерны из rejected гипотез, генерирует guidance в `docs/CLAUDE.md` | v0.4 | MetaClaw Lesson→Skill conversion |
| **B4** | `extract_evidence path=docs/notes/` — regex + LLM-classifier finds H## упоминания в свободных заметках | v0.5 | Cognee entity extraction (облегчённая) |

**Почему НЕ в v0.1:** каждый из этих tools требует либо отдельного дизайн-цикла (B1, B3 — нужно проработать advocate/skeptic prompts; B4 — нужно собрать корпус для классификатора), либо ждёт стабилизации edges (B2 без `competes_with` арены не работает — а арены формируются по факту, не из frontmatter).

**Когда брать:** B2 первым (после v0.2 pull-up) — самый дешёвый и сразу полезный. B1 после того как накопится 50+ гипотез и появится prior art для vetting. B3 когда наберётся ≥10 rejected гипотез. B4 — самый последний, опционален.

### D.3. БЕРЁМ КАК WORKFLOW-ПРАКТИКУ (не код, а методология)

| Паттерн | Что делать | Источник |
|---|---|---|
| **C2: Branch exploration через git** | Параллельные ветки `feature/H34-vstate-redesign-v3` и `feature/H35-...` с разными H##.md; тестировать обе, мерджить победителя | ARClaw Branch Exploration + git natively |
| **C3: Cost guardrails** | Периодический ручной запрос "сколько часов в backlog tier-1?"; если >40 часов untested — pivot decision, не копать ещё | ARClaw cost monitoring (50%/80%/100% thresholds) |
| **Conditional inductive tree** | Каждый узел в дереве должен соответствовать crucial experiment — иначе он не Strong-Inference, а просто wishlist | Platt 1964 + наша `gate.kills_on_fail` |
| **MLflow state machine validation** | not_started → in_progress → validated_branch → live → rejected/deferred — не пропускать стадии | MLflow Model Registry stages |

Эти не требуют кода — это правила самой работы с системой. Войдут в `HEX_RESEARCH_AGENTS.md` (D.D4) как guidance для агента и в README как guidance для человека.

### D.4. НЕ БЕРЁМ — анти-паттерны (документируем причину)

| Паттерн | Источник | Почему отказались |
|---|---|---|
| Multi-agent debate для **генерации** гипотез | ARClaw Stage 7-8 (полностью) | У Lev гипотезы рождаются из провалов тестов и от чтения папир, не из литературного gap-finding. Берём только vetting (B1) |
| Temporal validity windows | Graphiti | Для 33-300 узлов overhead не оправдан; git log даёт историю |
| Heavy graph DB (Neo4j/FalkorDB) | Graphiti / Cognee | SQLite полностью покрывает scale; не вводим dependency |
| MLflow tracking server | MLflow | UI ради UI — для одного человека overkill; filesystem manifests + наш `inspect_runs` дают эквивалент |
| 4-layer citation verification (arXiv/CrossRef/DataCite/LLM) | ARClaw Stage 23 | У Lev `evidence: type=paper` в основном internal v2.1 archive + 5-10 публичных папир; полный pipeline overkill. Опциональное `verified: true\|false` достаточно |
| PRM (Process Reward Model) judges | MetaClaw advanced | LLM-as-judge на каждой стадии = токены × API calls; для нашего use case ручное review + B1 покрывает |
| Internal in-memory storage | tejpalvirk/quantitativeresearch | Нарушает базовый принцип «source of truth — git-committable markdown» |
| Polyglot domain entities (Dataset, Variable, StatisticalTest, Model как отдельные node-kinds) | tejpalvirk | Усложнение без выгоды — у нас всё уже в frontmatter гипотезы как структурированные поля |
| Autonomous PIVOT decision | ARClaw Stage 15 | У нас человек+Claude принимает решение в conversation, не автоматический LLM-judge |
| Self-healing experiment code (10 раундов repair) | ARClaw Stage 13 | У Lev sweep-скрипты стабильны и тестируются отдельно; добавлять self-heal слой здесь — не ROI-positive |
| Conference LaTeX export (NeurIPS/ICML/ICLR) | ARClaw Stage 22 | У нас output — не paper, а живая стратегия + queryable tree |

### D.5. Сводная таблица влияния на план

| Источник | Влияние v0.1 | Влияние roadmap | Анти-паттерн |
|---|:---:|:---:|:---:|
| AutoResearchClaw | A1, C1, C4, D4 | B1 | autonomous paper, multi-agent gen |
| MetaClaw | — | B3 | PRM judges |
| tejpalvirk | — | — (вдохновение для get_*-aggregations в v0.4) | internal storage, narrow stat-vocab |
| Graphiti | — | (temporal v1.0+) | Neo4j |
| Cognee | — | B4 | heavy extraction |
| MLflow | — | B2, state-machine | tracking server |
| DVC | dependencies в manifest (Phase 1) | — | DVC format |
| research-hub | подтвердило markdown-first | — | Zotero-specific |
| Obsidian / JSON Canvas | D1, D2 | — | — |
| Strong Inference | A3 | — | — |
| IBIS | — | (arguments[] в v0.5+) | формальная dialogue mapping |
| FAIR | §1 compliance section | — | DataCite/ORCID |
| Falsifiable ML (arxiv) | A2 | — | — |
| hex-graph-mcp | A4, наследование PROTOCOL | — | tree-sitter |
| hex-common | base infra | — | parser/tree-sitter |

### D.6. Вердикт

Из 40+ паттернов отобрано **9 в v0.1** (A1-A4, C1, C4, D1, D2, D4) и **4 в roadmap** (B1-B4) — остальные либо anti-pattern для нашего use case, либо станут actionable только после v1.0 при росте графа за 1000 узлов.

Плагин не reinvent the wheel и не raids чужие архитектуры — он **синтезирует** проверенные паттерны (Strong Inference + reproducibility checklist + MLflow state machine + ARClaw skills + Obsidian conventions) под узкий use case (long-running algorithmic research с git-committable markdown SoT).

**Plan v0.3 после интеграции D.1 паттернов — ready to execute.** Phase 0 включает schema-валидацию для новых полей, Phase 5-6 — дополнительные deliverables. Совокупная стоимость интеграции: ~+1 рабочий день поверх v0.2 roadmap.

[own]: # "Внутренние пакеты Lev — hex-graph-mcp и hex-common"
