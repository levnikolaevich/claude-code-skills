# Python Virtual Environment Handling

<!-- SCOPE: Python venv management ONLY. Contains pip/poetry/uv commands, activation steps. -->
<!-- DO NOT add here: Upgrade workflow → ln-823-pip-upgrader SKILL.md -->

Guide for managing virtual environments during dependency upgrades.

---

## Package Managers

### pip + venv

| Task | Command |
|------|---------|
| Create venv | `python -m venv .venv` |
| Activate (Windows) | `.venv\Scripts\activate` |
| Activate (Unix) | `source .venv/bin/activate` |
| Install deps | `pip install -r requirements.txt` |
| Freeze | `pip freeze > requirements.txt` |

### poetry

| Task | Command |
|------|---------|
| Create env | `poetry install` (auto) |
| Activate | `poetry shell` |
| Update deps | `poetry update` |
| Lock | `poetry lock` |
| Export | `poetry export -f requirements.txt` |

### pipenv

| Task | Command |
|------|---------|
| Create env | `pipenv install` (auto) |
| Activate | `pipenv shell` |
| Update deps | `pipenv update` |
| Lock | `pipenv lock` |

---

## Upgrade Workflow

### With pip

1. Activate virtual environment
2. `pip list --outdated --format=json`
3. `pip install --upgrade <package>`
4. `pip freeze > requirements.txt`
5. Run tests

### With poetry

1. `poetry show --outdated`
2. `poetry update` (all) or `poetry update <package>`
3. Poetry auto-updates lock file
4. Run tests

### With pipenv

1. `pipenv update --outdated`
2. `pipenv update` (all) or `pipenv update <package>`
3. Run tests

---

## Virtual Environment Best Practices

### Location

| Convention | Path |
|------------|------|
| In-project | `.venv/` |
| poetry default | `{cache-dir}/virtualenvs/` |
| pipenv default | `~/.local/share/virtualenvs/` |

### .gitignore

```
.venv/
__pycache__/
*.pyc
.pytest_cache/
```

---

## Troubleshooting

### Conflicting Versions

| Issue | Solution |
|-------|----------|
| pip resolver | Use `pip install --use-feature=fast-deps` |
| poetry conflicts | `poetry lock --no-update` then investigate |
| pipenv lock slow | Clear cache: `pipenv --clear` |

### Recreate Environment

```bash
# pip
rm -rf .venv
python -m venv .venv
pip install -r requirements.txt

# poetry
poetry env remove python
poetry install

# pipenv
pipenv --rm
pipenv install
```

---

**Version:** 1.0.0
**Last Updated:** 2026-01-10
