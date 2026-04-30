#!/usr/bin/env python3
"""
claude-relay-bot — central state-store + bidirectional Telegram bridge for
the ${PROJECT_NAME} god-session.

Responsibilities:
  - Durable inbound Telegram queue → tmux send-keys when god-session is ready
  - Claude Code HTTP hook receiver (UserPromptSubmit / Stop / StopFailure /
    SessionStart / PostCompact / SubagentStop)
  - Durable outbox with retry/backoff/abandon — Stop hook never blocks on
    Telegram API; an asyncio worker drains the queue
  - Session lifecycle tracking (sessions, session_events, lineage on resume)
  - Dispatch run tracking (one dispatch slash-command invocation = one run; phases map to
    your project's pipeline stages)
  - Persistent memory across session restarts (injected into SessionStart
    additionalContext)
  - Local HTTP API for claude bash blocks (dispatch/memory/health)

This is the single source of truth for god-session state. Claude inside tmux
is compute, not persistence. systemd Restart=always ensures the relay survives
its own crashes; SQLite WAL ensures writes survive process restarts.

Reference: https://code.claude.com/docs/en/hooks
"""
from __future__ import annotations

import asyncio
import contextlib
import datetime as dt
import fcntl
import hashlib
import json
import logging
import os
import re
import secrets
import sqlite3
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Any, Awaitable, Callable, Optional

from aiogram import BaseMiddleware, Bot, Dispatcher, F
from aiogram.exceptions import (
    TelegramAPIError,
    TelegramBadRequest,
    TelegramNetworkError,
    TelegramRetryAfter,
)
from aiogram.filters import Command, CommandObject
from aiogram.types import (
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
    TelegramObject,
)
from aiohttp import web

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
log = logging.getLogger("claude-relay-bot")

# --------------------------------------------------------------------------
# Configuration (env-driven, with template defaults baked at install time)
# --------------------------------------------------------------------------

TG_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
ALLOWED_CHAT = int(os.environ["TELEGRAM_CHAT_ID"])
PROJECT_NAME = os.environ.get("PROJECT_NAME", "${PROJECT_NAME}")
PROJECT_DIR = os.environ.get("PROJECT_DIR", "${PROJECT_DIR}")
SERVICE_PREFIX = os.environ.get("SERVICE_PREFIX", "${SERVICE_PREFIX}")
BOT_USER = os.environ.get("BOT_USER", "${BOT_USER}")
TMUX_TARGET = os.environ.get("TMUX_TARGET", f"{SERVICE_PREFIX}-god")
TMUX_USER = os.environ.get("TMUX_USER", BOT_USER)
DB_PATH = os.environ.get("RELAY_DB_PATH", f"/var/lib/{PROJECT_NAME}/relay.db")
HOOK_HOST = os.environ.get("RELAY_HOOK_HOST", "127.0.0.1")
HOOK_PORT = int(os.environ.get("RELAY_HOOK_PORT", "9999"))

# Sessions feature — atomic command queue + sessions UI
STATE_DIR = Path(f"/var/lib/{PROJECT_NAME}")
CMD_FILE = STATE_DIR / "god-command.json"
LAST_CMD_FILE = STATE_DIR / "last-god-command.json"
CMD_LOCK_FILE = STATE_DIR / ".cmd-lock"
SESSIONS_DIR_FILE = STATE_DIR / "sessions-dir.path"
ERROR_FILE = STATE_DIR / "last-god-error.json"
LAST_CMD_TTL_SEC = 300  # operator command attributed to next SessionStart within 5 min
GOD_SERVICE_NAME = f"{SERVICE_PREFIX}-god.service"
CLAUDE_PROJECTS_HOME = Path(f"/home/{BOT_USER}/.claude/projects")

OUTBOX_POLL_SEC = 2.0
OUTBOX_MAX_ATTEMPTS = 5
OUTBOX_ABANDON_TTL_SEC = 24 * 3600
INBOUND_POLL_SEC = 1.0
INBOUND_MAX_ATTEMPTS = 30
INBOUND_ABANDON_TTL_SEC = 24 * 3600
TG_MAX_LEN = 4096
TG_PREFIX_RE = re.compile(r"^\[tg id=(\d+):(\d+)(?:\s+user=\S+)?\]\s?")
MEMORY_INJECT_LIMIT = 20
DISPATCH_RECENT_LIMIT = 3

UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)
SESSIONS_TOP_N = 10
SESSIONS_ALL_CAP = 50
ERROR_ALERTER_POLL_SEC = 5.0

# Communication policy
RELAY_VERBOSITY = os.environ.get("RELAY_VERBOSITY", "normal").lower()
# CSV of emojis to randomly pick from for inbound-ack reaction. Bots may set
# only 1 reaction per message; we rotate which one to keep things lively.
_RELAY_REACTIONS_DEFAULT = "👀,👍,✅,🫡,🤝,✍,🆒,👌,🙏"
_REACTIONS_RAW = os.environ.get("RELAY_INBOUND_REACTIONS") or _RELAY_REACTIONS_DEFAULT
RELAY_INBOUND_REACTIONS: list[str] = [
    e.strip() for e in _REACTIONS_RAW.split(",") if e.strip()
] or ["👀"]
RELAY_REACTION_FALLBACK = "❤"
TOKEN_BUCKET_MAX = 5
TOKEN_BUCKET_WINDOW_SEC = 60
SKILL_NAME_MAX_LEN = 60
TODO_TEXT_MAX_LEN = 80

# --------------------------------------------------------------------------
# SQLite schema + connection
# --------------------------------------------------------------------------

SCHEMA = """
CREATE TABLE IF NOT EXISTS messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  ts              INTEGER NOT NULL,
  direction       TEXT NOT NULL,
  kind            TEXT NOT NULL DEFAULT 'text',
  status          TEXT NOT NULL,
  text            TEXT NOT NULL,
  tg_chat_id      INTEGER,
  tg_msg_id       INTEGER,
  session_id      TEXT,
  replied_to_id   INTEGER,
  error           TEXT,
  attempts        INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL DEFAULT 0,
  delivered_at    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_msg_session ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_msg_inbound ON messages(tg_chat_id, tg_msg_id);

CREATE TABLE IF NOT EXISTS pending_reply (
  session_id      TEXT PRIMARY KEY,
  inbound_msg_id  INTEGER NOT NULL,
  prompt_hash     TEXT NOT NULL,
  created_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS outbox (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  ts               INTEGER NOT NULL,
  text             TEXT NOT NULL,
  chat_id          INTEGER NOT NULL,
  status           TEXT NOT NULL,
  attempts         INTEGER NOT NULL DEFAULT 0,
  next_attempt_at  INTEGER NOT NULL,
  replied_to_id    INTEGER,
  session_id       TEXT,
  tg_msg_id        INTEGER,
  error            TEXT,
  audit_msg_id     INTEGER
);
CREATE INDEX IF NOT EXISTS idx_outbox_due ON outbox(status, next_attempt_at);

CREATE TABLE IF NOT EXISTS sessions (
  session_id        TEXT PRIMARY KEY,
  started_at        INTEGER NOT NULL,
  ended_at          INTEGER,
  source            TEXT NOT NULL,
  previous_session  TEXT,
  model             TEXT,
  cwd               TEXT,
  transcript_path   TEXT,
  end_reason        TEXT,
  created_by_user_id INTEGER
);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(ended_at);

CREATE TABLE IF NOT EXISTS session_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  TEXT NOT NULL,
  ts          INTEGER NOT NULL,
  kind        TEXT NOT NULL,
  details     TEXT
);
CREATE INDEX IF NOT EXISTS idx_session_events_session ON session_events(session_id, ts);

CREATE TABLE IF NOT EXISTS dispatch_runs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  ts_started      INTEGER NOT NULL,
  ts_finished     INTEGER,
  trigger         TEXT NOT NULL,
  session_id      TEXT,
  issue_number    INTEGER,
  issue_title     TEXT,
  status          TEXT NOT NULL,
  budget_5h_pct   INTEGER,
  budget_week_pct INTEGER,
  pr_number       INTEGER,
  pr_url          TEXT,
  branch          TEXT,
  error           TEXT
);
CREATE INDEX IF NOT EXISTS idx_dispatch_runs_recent ON dispatch_runs(ts_started DESC);

CREATE TABLE IF NOT EXISTS dispatch_phases (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id      INTEGER NOT NULL,
  phase       TEXT NOT NULL,
  ts_started  INTEGER NOT NULL,
  ts_finished INTEGER,
  status      TEXT NOT NULL,
  verdict     TEXT,
  details     TEXT
);
CREATE INDEX IF NOT EXISTS idx_dispatch_phases_run ON dispatch_phases(run_id, ts_started);

CREATE TABLE IF NOT EXISTS memories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ts_created  INTEGER NOT NULL,
  ts_used     INTEGER,
  category    TEXT NOT NULL,
  text        TEXT NOT NULL,
  tags        TEXT,
  source      TEXT,
  expires_at  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_memories_active ON memories(ts_created DESC);

CREATE TABLE IF NOT EXISTS health_snapshots (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ts            INTEGER NOT NULL,
  source        TEXT NOT NULL,
  ram_used_mb   INTEGER,
  cpu_pct       INTEGER,
  details       TEXT
);

-- forensics for rejected (non-allowlisted) Telegram events.
-- Anyone who finds the public bot username can DM it; this table records
-- attempts that the AllowlistMiddleware filtered out before any handler ran.
CREATE TABLE IF NOT EXISTS auth_rejects (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ts            INTEGER NOT NULL,
  from_user_id  INTEGER,
  username      TEXT,
  chat_id       INTEGER,
  event_kind    TEXT NOT NULL,
  text_preview  TEXT
);
CREATE INDEX IF NOT EXISTS idx_auth_rejects_ts ON auth_rejects(ts DESC);

-- allowlist managed via Telegram `/users` command (with [Allow]/[Block]/
-- [Delete] inline buttons). Primary operator (TELEGRAM_CHAT_ID) is bootstrapped
-- and cannot be modified via the bot. Other users start in 'pending' on first
-- DM, then primary approves or blocks.
CREATE TABLE IF NOT EXISTS allowed_users (
  user_id              INTEGER PRIMARY KEY,
  username             TEXT,
  status               TEXT NOT NULL CHECK(status IN ('allowed','blocked','pending')),
  added_by             INTEGER,
  added_at             INTEGER NOT NULL,
  pending_notified_at  INTEGER,
  notes                TEXT
);
CREATE INDEX IF NOT EXISTS idx_allowed_users_status ON allowed_users(status);

-- ownership tag for sessions (so `/sessions` shows only own).
-- Existing rows are assigned to ALLOWED_CHAT (primary operator) during startup.
-- Note: ALTER TABLE is in Python startup code (try/except) since CREATE TABLE
-- IF NOT EXISTS doesn't add columns to pre-existing tables.

-- per-session todo state for diff detection in PreToolUse TodoWrite hook.
-- task_id = sha1(content)[:16]; renames register as delete+create (accepted noise).
CREATE TABLE IF NOT EXISTS todo_state (
  session_id  TEXT NOT NULL,
  task_id     TEXT NOT NULL,
  status      TEXT NOT NULL,
  content     TEXT NOT NULL,
  active_form TEXT,
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (session_id, task_id)
);
CREATE INDEX IF NOT EXISTS idx_todo_state_session ON todo_state(session_id);

-- outbox.event_type added via ALTER in startup code (not via this script).
-- Values: 'reply' | 'status_skill' | 'status_todo' | 'status_subagent' | 'system'.

CREATE INDEX IF NOT EXISTS idx_health_recent ON health_snapshots(ts DESC);
"""

_DB: Optional[sqlite3.Connection] = None


def db() -> sqlite3.Connection:
    global _DB
    if _DB is None:
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        _DB = sqlite3.connect(
            DB_PATH, isolation_level=None, check_same_thread=False
        )
        _DB.row_factory = sqlite3.Row
        _DB.execute("PRAGMA journal_mode=WAL")
        _DB.execute("PRAGMA synchronous=NORMAL")
        _DB.execute("PRAGMA foreign_keys=ON")
        _DB.executescript(SCHEMA)
        ensure_schema_migrations(_DB)
    return _DB


def now_ts() -> int:
    return int(time.time())


def ensure_schema_migrations(conn: sqlite3.Connection) -> None:
    """Forward-migrate existing relay.db files into the v6 text-only schema."""
    msg_cols = {row["name"] for row in conn.execute("PRAGMA table_info(messages)").fetchall()}
    for col, ddl in {
        "kind": "ALTER TABLE messages ADD COLUMN kind TEXT NOT NULL DEFAULT 'text'",
        "attempts": "ALTER TABLE messages ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0",
        "next_attempt_at": "ALTER TABLE messages ADD COLUMN next_attempt_at INTEGER NOT NULL DEFAULT 0",
        "delivered_at": "ALTER TABLE messages ADD COLUMN delivered_at INTEGER",
    }.items():
        if col not in msg_cols:
            conn.execute(ddl)
    sess_cols = {row["name"] for row in conn.execute("PRAGMA table_info(sessions)").fetchall()}
    if "created_by_user_id" not in sess_cols:
        conn.execute("ALTER TABLE sessions ADD COLUMN created_by_user_id INTEGER")
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_msg_inbound_due "
        "ON messages(direction, status, next_attempt_at)"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_msg_kind_status "
        "ON messages(direction, kind, status)"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_sessions_owner "
        "ON sessions(created_by_user_id)"
    )
    conn.execute(
        "UPDATE messages SET status='queued', next_attempt_at=? "
        "WHERE direction='inbound' AND status='delivering'",
        (now_ts(),),
    )


# --------------------------------------------------------------------------
# Domain queries
# --------------------------------------------------------------------------

def insert_inbound(text: str, tg_chat_id: int, tg_msg_id: int) -> int:
    cur = db().execute(
        "INSERT INTO messages (ts, direction, kind, status, text, tg_chat_id, tg_msg_id, "
        "next_attempt_at) VALUES (?, 'inbound', 'text', 'queued', ?, ?, ?, ?)",
        (now_ts(), text, tg_chat_id, tg_msg_id, now_ts()),
    )
    return cur.lastrowid


def insert_rejected_inbound(text: str, tg_chat_id: int, tg_msg_id: int, error: str) -> int:
    cur = db().execute(
        "INSERT INTO messages (ts, direction, kind, status, text, tg_chat_id, tg_msg_id, error) "
        "VALUES (?, 'inbound', 'text', 'rejected', ?, ?, ?, ?)",
        (now_ts(), text, tg_chat_id, tg_msg_id, error),
    )
    return cur.lastrowid


def select_due_inbound(limit: int = 5) -> list[sqlite3.Row]:
    cur = db().execute(
        "SELECT * FROM messages WHERE direction='inbound' "
        "AND status='queued' AND next_attempt_at<=? ORDER BY id LIMIT ?",
        (now_ts(), limit),
    )
    return list(cur.fetchall())


def update_message(msg_id: int, **fields) -> None:
    if not fields:
        return
    parts = ", ".join(f"{k}=?" for k in fields)
    db().execute(
        f"UPDATE messages SET {parts} WHERE id=?",
        list(fields.values()) + [msg_id],
    )


def find_inbound_by_tg(chat_id: int, msg_id: int) -> Optional[sqlite3.Row]:
    cur = db().execute(
        "SELECT * FROM messages WHERE direction='inbound' "
        "AND tg_chat_id=? AND tg_msg_id=? LIMIT 1",
        (chat_id, msg_id),
    )
    return cur.fetchone()


def set_pending(session_id: str, inbound_id: int, prompt: str) -> None:
    h = hashlib.sha256(prompt.encode("utf-8")).hexdigest()
    db().execute(
        "INSERT OR IGNORE INTO pending_reply "
        "(session_id, inbound_msg_id, prompt_hash, created_at) VALUES (?,?,?,?)",
        (session_id, inbound_id, h, now_ts()),
    )


def get_pending(session_id: str) -> Optional[sqlite3.Row]:
    cur = db().execute(
        "SELECT * FROM pending_reply WHERE session_id=?", (session_id,)
    )
    return cur.fetchone()


def clear_pending(session_id: str) -> None:
    db().execute("DELETE FROM pending_reply WHERE session_id=?", (session_id,))


def enqueue_outbox(
    text: str, chat_id: int, replied_to_id: Optional[int],
    session_id: Optional[str], audit_msg_id: Optional[int] = None,
    event_type: str = "reply",
) -> int:
    cur = db().execute(
        "INSERT INTO outbox (ts, text, chat_id, status, next_attempt_at, "
        "replied_to_id, session_id, audit_msg_id, event_type) "
        "VALUES (?,?,?,'queued',?,?,?,?,?)",
        (now_ts(), text, chat_id, now_ts(), replied_to_id, session_id,
         audit_msg_id, event_type),
    )
    return cur.lastrowid


def select_due_outbox(limit: int = 5) -> list[sqlite3.Row]:
    cur = db().execute(
        "SELECT * FROM outbox WHERE status='queued' AND next_attempt_at<=? "
        "ORDER BY id LIMIT ?",
        (now_ts(), limit),
    )
    return list(cur.fetchall())


def update_outbox(row_id: int, **fields) -> None:
    if not fields:
        return
    parts = ", ".join(f"{k}=?" for k in fields)
    db().execute(
        f"UPDATE outbox SET {parts} WHERE id=?",
        list(fields.values()) + [row_id],
    )


def upsert_session(
    session_id: str, source: str, model: Optional[str],
    cwd: Optional[str], transcript_path: Optional[str],
    previous_session: Optional[str] = None,
    created_by_user_id: Optional[int] = None,
) -> None:
    """
    Insert a new session row (no-op if exists). The caller is responsible
    for resolving `created_by_user_id` from the operator who triggered
    the new session (god-command.json's operator_chat_id) — see
    `hook_session_start` for the live wiring.
    """
    db().execute(
        "UPDATE sessions SET ended_at=?, end_reason='replaced' "
        "WHERE ended_at IS NULL AND session_id != ?",
        (now_ts(), session_id),
    )
    db().execute(
        "INSERT OR IGNORE INTO sessions "
        "(session_id, started_at, source, previous_session, model, cwd, transcript_path, created_by_user_id) "
        "VALUES (?,?,?,?,?,?,?,?)",
        (session_id, now_ts(), source, previous_session, model, cwd, transcript_path, created_by_user_id),
    )
    # If the row already existed but had no owner, attribute it now.
    if created_by_user_id is not None:
        db().execute(
            "UPDATE sessions SET created_by_user_id=? "
            "WHERE session_id=? AND created_by_user_id IS NULL",
            (created_by_user_id, session_id),
        )


def insert_session_event(session_id: str, kind: str, details: Any = None) -> None:
    if details is not None and not isinstance(details, str):
        details = json.dumps(details, ensure_ascii=False)
    db().execute(
        "INSERT INTO session_events (session_id, ts, kind, details) VALUES (?,?,?,?)",
        (session_id, now_ts(), kind, details),
    )


def dispatch_start(
    trigger: str, session_id: Optional[str],
    issue_number: Optional[int], issue_title: Optional[str],
    budget_5h: Optional[int], budget_week: Optional[int],
) -> int:
    cur = db().execute(
        "INSERT INTO dispatch_runs (ts_started, trigger, session_id, issue_number, "
        "issue_title, status, budget_5h_pct, budget_week_pct) "
        "VALUES (?,?,?,?,?,'started',?,?)",
        (now_ts(), trigger, session_id, issue_number, issue_title, budget_5h, budget_week),
    )
    return cur.lastrowid


def dispatch_phase(
    run_id: int, phase: str, status: str,
    verdict: Optional[str] = None, details: Optional[str] = None,
) -> None:
    cur = db().execute(
        "SELECT id FROM dispatch_phases WHERE run_id=? AND phase=? AND ts_finished IS NULL",
        (run_id, phase),
    )
    row = cur.fetchone()
    ts = now_ts()
    if row:
        db().execute(
            "UPDATE dispatch_phases SET status=?, verdict=?, details=?, ts_finished=? "
            "WHERE id=?",
            (status, verdict, details, ts if status != "running" else None, row["id"]),
        )
    else:
        db().execute(
            "INSERT INTO dispatch_phases (run_id, phase, ts_started, ts_finished, "
            "status, verdict, details) VALUES (?,?,?,?,?,?,?)",
            (run_id, phase, ts, ts if status != "running" else None,
             status, verdict, details),
        )


def dispatch_end(
    run_id: int, status: str,
    pr_number: Optional[int] = None, pr_url: Optional[str] = None,
    branch: Optional[str] = None, error: Optional[str] = None,
) -> None:
    db().execute(
        "UPDATE dispatch_runs SET ts_finished=?, status=?, pr_number=?, pr_url=?, "
        "branch=?, error=? WHERE id=?",
        (now_ts(), status, pr_number, pr_url, branch, error, run_id),
    )


def dispatch_recent(n: int = 10) -> list[dict]:
    cur = db().execute(
        "SELECT * FROM dispatch_runs ORDER BY ts_started DESC LIMIT ?", (n,)
    )
    runs = [dict(r) for r in cur.fetchall()]
    for r in runs:
        pcur = db().execute(
            "SELECT phase, status, verdict, ts_started, ts_finished, details "
            "FROM dispatch_phases WHERE run_id=? ORDER BY ts_started",
            (r["id"],),
        )
        r["phases"] = [dict(p) for p in pcur.fetchall()]
    return runs


def memory_add(
    category: str, text: str,
    tags: Optional[str] = None, source: Optional[str] = None,
    expires_at: Optional[int] = None,
) -> int:
    cur = db().execute(
        "INSERT INTO memories (ts_created, category, text, tags, source, expires_at) "
        "VALUES (?,?,?,?,?,?)",
        (now_ts(), category, text, tags, source, expires_at),
    )
    return cur.lastrowid


def memory_recent(
    n: int = MEMORY_INJECT_LIMIT, category: Optional[str] = None,
) -> list[sqlite3.Row]:
    where = ["(expires_at IS NULL OR expires_at > ?)"]
    args: list[Any] = [now_ts()]
    if category:
        where.append("category=?")
        args.append(category)
    args.append(n)
    cur = db().execute(
        f"SELECT * FROM memories WHERE {' AND '.join(where)} "
        f"ORDER BY ts_created DESC LIMIT ?", args,
    )
    return list(cur.fetchall())


def memory_forget(memory_id: Optional[int] = None, tag_match: Optional[str] = None) -> int:
    if memory_id is not None:
        cur = db().execute("DELETE FROM memories WHERE id=?", (memory_id,))
        return cur.rowcount
    if tag_match:
        cur = db().execute("DELETE FROM memories WHERE tags LIKE ?", (f"%{tag_match}%",))
        return cur.rowcount
    return 0


def memory_mark_used(ids: list[int]) -> None:
    if not ids:
        return
    placeholders = ",".join("?" * len(ids))
    db().execute(
        f"UPDATE memories SET ts_used=? WHERE id IN ({placeholders})",
        [now_ts(), *ids],
    )


# --------------------------------------------------------------------------
# Telegram inbound (aiogram)
# --------------------------------------------------------------------------

# --------------------------------------------------------------------------
# Sessions feature helpers — atomic command queue, JSONL parsing,
# tmux lifecycle, god-service introspection. All file ops are defensive:
# missing/corrupt files never crash the daemon, only degrade the feature.
# --------------------------------------------------------------------------

# Per-session asyncio lock prevents Resume + Delete races on the same card.
_session_locks: dict[str, asyncio.Lock] = {}


def find_first_user_message(path: Path, max_lines: int = 100) -> Optional[str]:
    """
    Return the first user-typed message text from a session JSONL.
    Used as a fallback name when the session has no `slug` field
    (sessions started via `claude --dangerously-skip-permissions` without
    the `-n <name>` flag often lack slug). Strips `[tg id=...]` prefix
    so Telegram-inbound sessions show the actual operator text.
    """
    try:
        with path.open("r", encoding="utf-8") as f:
            for _ in range(max_lines):
                line = f.readline()
                if not line:
                    break
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if not isinstance(obj, dict) or obj.get("type") != "user":
                    continue
                msg = obj.get("message")
                if not isinstance(msg, dict):
                    continue
                content = msg.get("content")
                if isinstance(content, str):
                    text = content.strip()
                elif isinstance(content, list) and content:
                    first = content[0]
                    text = first.get("text", "") if isinstance(first, dict) else ""
                    text = text.strip() if isinstance(text, str) else ""
                else:
                    text = ""
                if text:
                    text = TG_PREFIX_RE.sub("", text).strip()
                    # Strip Claude Code's XML wrappers for slash commands:
                    # `<command-message>loop</command-message>` → `/loop`
                    cmd_match = CMD_MESSAGE_RE.match(text)
                    if cmd_match:
                        text = "/" + cmd_match.group(1).strip()
                    if text:
                        return text
    except OSError:
        pass
    return None


CMD_MESSAGE_RE = re.compile(
    r"<command-message>\s*([^<]+?)\s*</command-message>", re.IGNORECASE,
)


def session_display_name(jsonl_path: Path, sid: str) -> str:
    """
    Return human-readable session name with three-tier fallback:
    1. `slug` field (Claude auto-generates this in 2.1+ for new sessions)
    2. First user message text (Telegram prefix stripped, truncated)
    3. session_id[:8]
    """
    meta = find_first_metadata_obj(jsonl_path, ("slug",))
    if meta and isinstance(meta.get("slug"), str) and meta["slug"]:
        return meta["slug"]
    first_msg = find_first_user_message(jsonl_path)
    if first_msg:
        clean = " ".join(first_msg.split())  # collapse newlines/whitespace
        if len(clean) > 40:
            return clean[:40].rstrip() + "…"
        return clean
    return sid[:8]


def find_first_metadata_obj(
    path: Path, required_fields: tuple[str, ...] = ("slug",), max_lines: int = 50,
) -> Optional[dict]:
    """
    Scan first N lines of a JSONL file for the first object that has all
    required fields populated. Claude Code's session JSONLs interleave
    queue-operation entries (no slug/cwd) with transcript entries
    (slug + cwd + sessionId + entrypoint), so the very first line is
    usually NOT the metadata-bearing one.
    """
    try:
        with path.open("r", encoding="utf-8") as f:
            for _ in range(max_lines):
                line = f.readline()
                if not line:
                    break
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if not isinstance(obj, dict):
                    continue
                if all(obj.get(field) for field in required_fields):
                    return obj
    except OSError:
        pass
    return None


def is_god_active() -> bool:
    """Return True iff the god-session systemd unit is active."""
    try:
        result = subprocess.run(
            ["systemctl", "is-active", GOD_SERVICE_NAME],
            capture_output=True, text=True, timeout=3,
        )
        return result.stdout.strip() == "active"
    except (subprocess.SubprocessError, OSError) as exc:
        log.warning("is_god_active probe failed: %s", exc)
        return False


def get_sessions_dir() -> Optional[Path]:
    """
    Resolve Claude Code's per-cwd session dir for PROJECT_DIR.

    Cached in $STATE_DIR/sessions-dir.path. On first run (cache absent),
    scans ~$BOT_USER/.claude/projects/ for a dir whose oldest JSONL has
    cwd matching PROJECT_DIR (case-insensitive trailing-slash-tolerant).
    Returns None if no match — sessions feature degrades gracefully.
    """
    if SESSIONS_DIR_FILE.exists():
        try:
            cached = Path(SESSIONS_DIR_FILE.read_text().strip())
            if cached.exists() and cached.is_dir():
                return cached
            log.warning("cached sessions-dir gone: %s; rediscovering", cached)
        except OSError as exc:
            log.warning("read sessions-dir cache failed: %s", exc)

    if not CLAUDE_PROJECTS_HOME.exists():
        return None

    target_cwd = PROJECT_DIR.rstrip("/").lower()
    for d in sorted(
        CLAUDE_PROJECTS_HOME.iterdir(),
        key=lambda p: p.stat().st_mtime if p.exists() else 0,
        reverse=True,
    ):
        if not d.is_dir():
            continue
        for jsonl in d.glob("*.jsonl"):
            meta = find_first_metadata_obj(jsonl, ("cwd",))
            if meta is None:
                continue
            cwd = (meta.get("cwd") or "").rstrip("/").lower()
            if cwd == target_cwd:
                try:
                    SESSIONS_DIR_FILE.write_text(str(d))
                except OSError as exc:
                    log.warning("cache sessions-dir write failed: %s", exc)
                log.info("sessions-dir resolved: %s", d)
                return d
    return None


def write_command_atomic(
    action: str,
    session_id: Optional[str] = None,
    operator_chat_id: Optional[int] = None,
) -> str:
    """Write god-command.json atomically under flock. Returns command_id."""
    if action not in ("new", "resume"):
        raise ValueError(f"invalid action: {action}")
    if action == "resume":
        if not session_id or not UUID_RE.match(session_id):
            raise ValueError(f"resume requires valid UUID session_id; got {session_id!r}")

    cmd_id = secrets.token_hex(12)  # opaque, monotonic-enough via creation order
    payload = {
        "command_id": cmd_id,
        "ts": int(time.time()),
        "action": action,
        "session_id": session_id,
        "operator_chat_id": operator_chat_id,
    }
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(
        dir=str(STATE_DIR), prefix=".cmd-", suffix=".tmp",
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            fcntl.flock(f.fileno(), fcntl.LOCK_EX)
            json.dump(payload, f)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_path, CMD_FILE)
    except Exception:
        with contextlib.suppress(FileNotFoundError):
            os.unlink(tmp_path)
        raise
    return cmd_id


def read_last_jsonl_object(path: Path) -> Optional[dict]:
    """
    Read the last JSON object from a JSONL file, defensive against partial
    writes (last line may be empty / mid-write during tmux kill). Falls back
    by walking backwards.
    """
    try:
        with path.open("rb") as f:
            f.seek(0, os.SEEK_END)
            size = f.tell()
            if size == 0:
                return None
            # Read up to last 64KB; that's enough for any single JSONL turn.
            chunk_size = min(size, 65536)
            f.seek(size - chunk_size)
            tail = f.read(chunk_size).decode("utf-8", errors="replace")
        for line in reversed(tail.splitlines()):
            line = line.strip()
            if not line:
                continue
            try:
                return json.loads(line)
            except json.JSONDecodeError:
                continue
        return None
    except OSError:
        return None


def parse_iso8601_to_epoch(s: str) -> Optional[float]:
    if not s:
        return None
    try:
        # Claude Code emits e.g. 2026-04-30T12:00:00.000Z
        return dt.datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp()
    except (ValueError, TypeError):
        return None


def list_sessions(
    owner_user_id: Optional[int] = None,
    limit: Optional[int] = SESSIONS_TOP_N,
) -> list[dict]:
    """
    Return list of {sid, slug, ts, owner} sorted by recency desc.

    If `owner_user_id` is provided, only sessions owned by that user are
    returned. Sessions with NULL owner are skipped — startup reconciliation
    tags every existing row to the primary operator, so a NULL after
    deployment indicates a bug or a hand-tampered DB and shouldn't be
    silently treated as someone's session.
    """
    sd = get_sessions_dir()
    if sd is None or not sd.exists():
        return []
    owners: dict[str, Optional[int]] = {}
    try:
        with db() as conn:
            for row in conn.execute("SELECT session_id, created_by_user_id FROM sessions").fetchall():
                owners[row["session_id"]] = row["created_by_user_id"]
    except sqlite3.Error as exc:
        log.error("list_sessions owners lookup failed: %s", exc)
    out: list[dict] = []
    for jsonl in sd.glob("*.jsonl"):
        sid = jsonl.stem
        if not UUID_RE.match(sid):
            continue
        owner = owners.get(sid)
        if owner is None:
            log.warning("session %s has no owner in DB — skipping", sid)
            continue
        if owner_user_id is not None and owner != owner_user_id:
            continue
        slug = session_display_name(jsonl, sid)
        ts = jsonl.stat().st_mtime
        last = read_last_jsonl_object(jsonl)
        if last and isinstance(last, dict):
            ts_iso = last.get("timestamp")
            ts_parsed = parse_iso8601_to_epoch(ts_iso) if isinstance(ts_iso, str) else None
            if ts_parsed:
                ts = ts_parsed
        out.append({"sid": sid, "slug": slug, "ts": ts, "owner": owner})
    out.sort(key=lambda s: s["ts"], reverse=True)
    if limit:
        return out[:limit]
    return out[:SESSIONS_ALL_CAP]


def fmt_ts(epoch: float) -> str:
    return dt.datetime.utcfromtimestamp(epoch).strftime("%Y-%m-%d %H:%M UTC")


def kill_tmux_gracefully(target: str) -> None:
    """
    Try to let claude flush its JSONL writes before the pane dies:
    1) Send Ctrl-C twice (interrupt any in-flight tool call).
    2) Send /exit + Enter (claude TUI's clean shutdown).
    3) Force kill-session as last resort.
    """
    for cmd in (
        ["tmux", "send-keys", "-t", target, "C-c", "C-c"],
        ["tmux", "send-keys", "-t", target, "/exit", "Enter"],
    ):
        try:
            subprocess.run(cmd, check=False, timeout=3)
        except (subprocess.SubprocessError, OSError) as exc:
            log.warning("graceful tmux step failed: %s — %s", cmd, exc)
        time.sleep(1.5)
    try:
        subprocess.run(
            ["tmux", "kill-session", "-t", target],
            check=False, timeout=5,
        )
    except (subprocess.SubprocessError, OSError) as exc:
        log.error("tmux kill-session failed: %s", exc)


def session_lock(sid: str) -> asyncio.Lock:
    return _session_locks.setdefault(sid, asyncio.Lock())


_control_lock = asyncio.Lock()
_control_pending = 0
_control_current: Optional[str] = None
_control_last_action: Optional[str] = None


async def run_control(action: str, op: Callable[[], Awaitable[Any]]) -> Any:
    """Serialize all God-session mutations and tmux delivery through one lane."""
    global _control_pending, _control_current, _control_last_action
    _control_pending += 1
    queued = True
    try:
        async with _control_lock:
            _control_pending -= 1
            queued = False
            _control_current = action
            _control_last_action = action
            try:
                return await op()
            finally:
                _control_current = None
    except Exception:
        if queued and _control_pending > 0:
            _control_pending -= 1
        raise


async def kill_tmux_gracefully_async(target: str) -> None:
    await asyncio.to_thread(kill_tmux_gracefully, target)


# --------------------------------------------------------------------------
# Communication policy: token bucket, verbosity gate, formatters,
# inbound reaction ack. PreToolUse / PostToolUse hook handlers below.
# --------------------------------------------------------------------------

from collections import deque
_status_buckets: dict[int, deque[float]] = {}


def can_emit_status(chat_id: int) -> bool:
    """Per-chat token bucket: max N status messages per W seconds."""
    now = time.time()
    bucket = _status_buckets.setdefault(chat_id, deque())
    while bucket and now - bucket[0] > TOKEN_BUCKET_WINDOW_SEC:
        bucket.popleft()
    if len(bucket) >= TOKEN_BUCKET_MAX:
        return False
    bucket.append(now)
    return True


def verbosity_allows(layer: str) -> bool:
    """layer in {'L1','L2','L3','L4','L5','verbose_bash'}."""
    if RELAY_VERBOSITY == "quiet":
        return layer in ("L1", "L4", "L5")
    if RELAY_VERBOSITY == "normal":
        return layer in ("L1", "L2", "L3", "L4", "L5")
    return True  # verbose


def md_safe(text: str) -> str:
    """Wrap in backticks for Telegram Markdown (handles _,*,[ etc)."""
    return f"`{text.replace('`', '′')}`"


def truncate(text: str, max_len: int) -> str:
    return text[:max_len] + "…" if len(text) > max_len else text


async def react_to_inbound(chat_id: int, message_id: int) -> None:
    """
    Set a reaction on operator's message as silent ack of receipt. Cosmetic;
    failures must NOT downgrade send-keys delivery status. Pick a random emoji
    from RELAY_INBOUND_REACTIONS (variety keeps the chat from feeling robotic),
    fall back to ❤ if chat blocks the primary, then silently skip.
    """
    import random
    from aiogram.types import ReactionTypeEmoji
    primary = random.choice(RELAY_INBOUND_REACTIONS) if RELAY_INBOUND_REACTIONS else "👀"
    for emoji in (primary, RELAY_REACTION_FALLBACK):
        try:
            await bot.set_message_reaction(
                chat_id=chat_id, message_id=message_id,
                reaction=[ReactionTypeEmoji(emoji=emoji)],
            )
            return
        except TelegramAPIError as exc:
            log.debug("reaction %r failed: %s", emoji, exc)
    log.warning("could not set any reaction on chat=%s msg=%s — skipping ack", chat_id, message_id)


def enqueue_status_outbox(
    chat_id: int, text: str, event_type: str, session_id: Optional[str] = None,
) -> Optional[int]:
    """Token-bucketed outbox enqueue for status messages (L2/L3/L4)."""
    if event_type in ("status_skill", "status_todo") and not can_emit_status(chat_id):
        log.debug("token bucket overflow chat=%s — drop %s", chat_id, event_type)
        return None
    try:
        with db() as conn:
            cur = conn.execute(
                "INSERT INTO outbox (ts, text, chat_id, status, attempts, "
                "next_attempt_at, session_id, event_type) "
                "VALUES (?, ?, ?, 'queued', 0, ?, ?, ?)",
                (now_ts(), text, chat_id, now_ts(), session_id, event_type),
            )
            return cur.lastrowid
    except sqlite3.Error as exc:
        log.error("enqueue_status_outbox failed: %s", exc)
        return None


def operator_chat_for_session(session_id: Optional[str]) -> int:
    """
    Resolve which Telegram chat receives status messages for this session.
    Falls back to primary operator (ALLOWED_CHAT) when no inbound is pending
    (e.g. cron-triggered /dispatch).
    """
    if not session_id:
        return ALLOWED_CHAT
    pending = get_pending(session_id)
    if not pending:
        return ALLOWED_CHAT
    try:
        with db() as conn:
            row = conn.execute(
                "SELECT tg_chat_id FROM messages WHERE id = ?", (pending["inbound_msg_id"],),
            ).fetchone()
        if row and row["tg_chat_id"]:
            return int(row["tg_chat_id"])
    except sqlite3.Error:
        pass
    return ALLOWED_CHAT


def task_id_for(content: str) -> str:
    return hashlib.sha1(content.encode("utf-8", errors="replace")).hexdigest()[:16]


def diff_and_emit_todos(session_id: str, todos: list) -> list[str]:
    """
    Compare incoming TodoWrite array against todo_state. Return list of
    formatted transition messages. Upserts new state. No aggregation —
    each transition is its own line/message.
    """
    if not session_id:
        return []
    emits: list[str] = []
    try:
        with db() as conn:
            prev_rows = {
                row["task_id"]: row
                for row in conn.execute(
                    "SELECT task_id, status, content, active_form FROM todo_state WHERE session_id = ?",
                    (session_id,),
                ).fetchall()
            }
            for item in todos:
                if not isinstance(item, dict):
                    continue
                content = (item.get("content") or "").strip()
                if not content:
                    continue
                status = (item.get("status") or "pending").strip().lower()
                active_form = (item.get("activeForm") or "").strip()
                tid = task_id_for(content)
                prev = prev_rows.get(tid)
                prev_status = prev["status"] if prev else None
                if prev_status == status:
                    continue
                display = active_form if status == "in_progress" and active_form else content
                display = truncate(display, TODO_TEXT_MAX_LEN)
                if status == "in_progress":
                    emits.append(f"🟡 {display}")
                elif status == "completed":
                    emits.append(f"✅ {display}")
                conn.execute(
                    "INSERT INTO todo_state (session_id, task_id, status, content, active_form, updated_at) "
                    "VALUES (?, ?, ?, ?, ?, ?) "
                    "ON CONFLICT(session_id, task_id) DO UPDATE SET "
                    "status=excluded.status, content=excluded.content, "
                    "active_form=excluded.active_form, updated_at=excluded.updated_at",
                    (session_id, tid, status, content, active_form, now_ts()),
                )
    except sqlite3.Error as exc:
        log.error("diff_and_emit_todos failed: %s", exc)
    return emits


def format_skill_event(tool_input: dict, prefix: str = "🔧") -> Optional[str]:
    """Extract `<prefix> Skill: <name>` line from a Skill PreToolUse payload."""
    if not isinstance(tool_input, dict):
        return None
    name = tool_input.get("skill") or tool_input.get("name") or tool_input.get("agent_type")
    if not isinstance(name, str) or not name.strip():
        return None
    return f"{prefix} Skill: {md_safe(truncate(name, SKILL_NAME_MAX_LEN))}"


def format_agent_event(tool_input: dict) -> Optional[str]:
    if not isinstance(tool_input, dict):
        return None
    sub = tool_input.get("subagent_type") or tool_input.get("agent_type") or "subagent"
    desc = tool_input.get("description") or ""
    label = f"🤖 Subagent: {md_safe(truncate(str(sub), 30))}"
    if desc:
        label += f" — {truncate(str(desc), 60)}"
    return label


def validate_session_path(sid: str) -> Optional[Path]:
    """
    Return the validated jsonl Path for sid, or None if anything's off
    (path traversal, bad UUID, missing dir, parent mismatch, missing file).
    """
    if not UUID_RE.match(sid):
        return None
    sd = get_sessions_dir()
    if sd is None:
        return None
    target = (sd / f"{sid}.jsonl").resolve()
    if target.parent != sd.resolve():
        log.warning("path traversal rejected: sid=%s target=%s", sid, target)
        return None
    if not target.exists():
        return None
    return target


def session_card_kb(sid: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="▶ Resume", callback_data=f"s_run:{sid}"),
        InlineKeyboardButton(text="🗑 Delete", callback_data=f"s_del:{sid}"),
    ]])


# --------------------------------------------------------------------------
# Allowlist (defense-in-depth, DB-backed, managed via /users)
#
# The bot username is publicly discoverable on Telegram, so anyone can DM
# this bot and try to inject commands. Telegram has NO API-level allowlist
# for DMs — guarding is purely application-side. We layer:
#
#   L1 (BotFather, manual): /setjoingroups Disable → bot is DM-only.
#   L2 (middleware): consults SQLite `allowed_users` table. status='allowed'
#       passes; 'pending'/'blocked'/missing drop with audit. Bootstrap
#       inserts primary operator as 'allowed' and seeds optional CSV
#       TELEGRAM_ALLOWED_USERS on first run only.
#   L3 (`/users` command): primary-operator-only Telegram UI for adding/
#       removing/blocking users with [Allow]/[Block]/[Delete] inline buttons.
#       Status mutations invalidate the in-memory cache.
#   L4 (per-handler chat_id checks): kept for defense-in-depth.
# --------------------------------------------------------------------------

# In-memory cache of {user_id: status}. Populated at startup, mutated by
# /users callbacks (refresh_allowlist_cache).
_allowlist_cache: dict[int, str] = {}


def insert_auth_reject(
    from_user_id: Optional[int],
    username: Optional[str],
    chat_id: Optional[int],
    event_kind: str,
    text_preview: Optional[str],
) -> None:
    try:
        with db() as conn:
            conn.execute(
                "INSERT INTO auth_rejects (ts, from_user_id, username, chat_id, event_kind, text_preview) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (now_ts(), from_user_id, username, chat_id, event_kind,
                 (text_preview or "")[:200]),
            )
    except sqlite3.Error as exc:
        log.error("audit insert_auth_reject failed: %s", exc)


def refresh_allowlist_cache() -> None:
    """Reload {user_id: status} from DB. Called at startup and after every /users mutation."""
    try:
        with db() as conn:
            rows = conn.execute("SELECT user_id, status FROM allowed_users").fetchall()
        _allowlist_cache.clear()
        for row in rows:
            _allowlist_cache[row["user_id"]] = row["status"]
        log.info("allowlist cache refreshed: %d entries", len(_allowlist_cache))
    except sqlite3.Error as exc:
        log.error("refresh_allowlist_cache failed: %s", exc)


def upsert_user(
    user_id: int,
    username: Optional[str],
    status: str,
    added_by: Optional[int],
    notes: Optional[str] = None,
) -> None:
    if status not in ("allowed", "blocked", "pending"):
        raise ValueError(f"invalid status: {status}")
    with db() as conn:
        conn.execute(
            "INSERT INTO allowed_users (user_id, username, status, added_by, added_at, notes) "
            "VALUES (?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(user_id) DO UPDATE SET "
            "username=COALESCE(excluded.username, allowed_users.username), "
            "status=excluded.status, "
            "added_by=COALESCE(excluded.added_by, allowed_users.added_by), "
            "notes=COALESCE(excluded.notes, allowed_users.notes)",
            (user_id, username, status, added_by, now_ts(), notes),
        )
    refresh_allowlist_cache()


def mark_pending_notified(user_id: int) -> None:
    with db() as conn:
        conn.execute(
            "UPDATE allowed_users SET pending_notified_at = ? WHERE user_id = ? AND pending_notified_at IS NULL",
            (now_ts(), user_id),
        )


def get_user_row(user_id: int) -> Optional[sqlite3.Row]:
    with db() as conn:
        return conn.execute(
            "SELECT * FROM allowed_users WHERE user_id = ?", (user_id,)
        ).fetchone()


def list_allowlisted_users() -> list[sqlite3.Row]:
    with db() as conn:
        return conn.execute(
            "SELECT * FROM allowed_users "
            "ORDER BY (status='pending') DESC, (status='allowed') DESC, added_at DESC"
        ).fetchall()


def migrate_outbox_event_type() -> None:
    """ALTER TABLE outbox ADD COLUMN event_type + index. Idempotent."""
    try:
        with db() as conn:
            cols = {row["name"] for row in conn.execute("PRAGMA table_info(outbox)").fetchall()}
            if "event_type" not in cols:
                conn.execute("ALTER TABLE outbox ADD COLUMN event_type TEXT")
                conn.execute("UPDATE outbox SET event_type = 'reply' WHERE event_type IS NULL")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_outbox_event_type ON outbox(event_type)")
                log.info("migrate: added outbox.event_type column")
    except sqlite3.Error as exc:
        log.error("migrate_outbox_event_type failed: %s", exc)


def reconcile_sessions_owner() -> None:
    """
    Ensure `sessions.created_by_user_id` column exists, insert
    rows for any on-disk JSONL that pre-dates relay-bot's SessionStart
    hook, and tag every untracked row to the primary operator. After
    this runs once, ownership is strict.
    """
    try:
        with db() as conn:
            cols = {row["name"] for row in conn.execute("PRAGMA table_info(sessions)").fetchall()}
            if "created_by_user_id" not in cols:
                conn.execute("ALTER TABLE sessions ADD COLUMN created_by_user_id INTEGER")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_sessions_owner ON sessions(created_by_user_id)")
                log.info("migrate: added sessions.created_by_user_id column")
    except sqlite3.Error as exc:
        log.error("sessions owner migration ALTER failed: %s", exc)
        return

    # Resolve sessions dir lazily — may not be cached yet on first run.
    sd = get_sessions_dir()
    inserted = 0
    if sd is not None and sd.exists():
        try:
            with db() as conn:
                for jsonl in sd.glob("*.jsonl"):
                    sid = jsonl.stem
                    if not UUID_RE.match(sid):
                        continue
                    cur = conn.execute(
                        "INSERT OR IGNORE INTO sessions "
                        "(session_id, started_at, source, transcript_path, created_by_user_id) "
                        "VALUES (?, ?, 'session_reconcile', ?, ?)",
                        (sid, int(jsonl.stat().st_mtime), str(jsonl), ALLOWED_CHAT),
                    )
                    if cur.rowcount > 0:
                        inserted += 1
        except sqlite3.Error as exc:
            log.error("sessions owner reconciliation INSERT scan failed: %s", exc)
    if inserted > 0:
        log.info("sessions owner reconciliation: inserted %d untracked jsonl sessions tagged to primary operator", inserted)

    # Tag any pre-existing rows with NULL owner.
    try:
        with db() as conn:
            cur = conn.execute(
                "UPDATE sessions SET created_by_user_id = ? WHERE created_by_user_id IS NULL",
                (ALLOWED_CHAT,),
            )
            if cur.rowcount > 0:
                log.info("sessions owner reconciliation: tagged %d null-owner sessions to primary", cur.rowcount)
    except sqlite3.Error as exc:
        log.error("sessions owner reconciliation UPDATE failed: %s", exc)


def consume_last_god_command_owner() -> Optional[int]:
    """
    Read `last-god-command.json` (preserved by god-session.sh after consuming
    the command file) and return operator_chat_id. Discards stale entries
    (>5 min old) — those most likely belong to a previous SessionStart that
    was already attributed.

    Returns None if the file is missing, stale, or unparseable. The file is
    deleted after read to ensure one-shot attribution per command.
    """
    if not LAST_CMD_FILE.exists():
        return None
    try:
        data = json.loads(LAST_CMD_FILE.read_text(encoding="utf-8"))
        ts = int(data.get("ts", 0))
        if now_ts() - ts > LAST_CMD_TTL_SEC:
            log.info("last-god-command stale (>%ds); ignoring", LAST_CMD_TTL_SEC)
            with contextlib.suppress(OSError):
                LAST_CMD_FILE.unlink()
            return None
        owner = data.get("operator_chat_id")
        with contextlib.suppress(OSError):
            LAST_CMD_FILE.unlink()
        if isinstance(owner, int):
            return owner
    except (json.JSONDecodeError, OSError, ValueError) as exc:
        log.warning("read last-god-command.json failed: %s", exc)
    return None


def get_session_owner(session_id: str) -> Optional[int]:
    """Return created_by_user_id for a session, or None if not in DB."""
    try:
        with db() as conn:
            row = conn.execute(
                "SELECT created_by_user_id FROM sessions WHERE session_id = ?",
                (session_id,),
            ).fetchone()
        if row is None:
            return None
        return row["created_by_user_id"]
    except sqlite3.Error as exc:
        log.error("get_session_owner failed: %s", exc)
        return None


def bootstrap_allowlist() -> None:
    """
    Insert primary operator (TELEGRAM_CHAT_ID) as 'allowed'. All other
    users are added via the `/users` Telegram command after they DM the
    bot once and land in 'pending'. No env-var seeding — DB is the only
    source of truth.
    """
    try:
        with db() as conn:
            conn.execute(
                "INSERT OR IGNORE INTO allowed_users "
                "(user_id, username, status, added_by, added_at, notes) "
                "VALUES (?, NULL, 'allowed', NULL, ?, 'primary operator (bootstrap)')",
                (ALLOWED_CHAT, now_ts()),
            )
    except sqlite3.Error as exc:
        log.error("bootstrap_allowlist failed: %s", exc)
    refresh_allowlist_cache()


def is_primary_operator(user_id: Optional[int]) -> bool:
    return user_id is not None and user_id == ALLOWED_CHAT


class AllowlistMiddleware(BaseMiddleware):
    """
    DB-backed allowlist filter. Reads `_allowlist_cache` (populated from
    `allowed_users` table), and routes events:
      - allowed → pass to handler
      - blocked → silent drop + audit
      - pending → silent drop + audit + (once) reply «pending approval»
      - missing → INSERT pending + audit + alert primary operator
    """

    async def __call__(
        self,
        handler,
        event: TelegramObject,
        data: dict,
    ):
        from_user_id: Optional[int] = None
        username: Optional[str] = None
        chat_id: Optional[int] = None
        event_kind = event.__class__.__name__
        text_preview: Optional[str] = None
        msg_obj: Optional[Message] = None

        if isinstance(event, Message):
            msg_obj = event
            chat_id = event.chat.id
            if event.from_user:
                from_user_id = event.from_user.id
                username = event.from_user.username
            text_preview = event.text or event.caption
        elif isinstance(event, CallbackQuery):
            if event.from_user:
                from_user_id = event.from_user.id
                username = event.from_user.username
            if event.message:
                chat_id = event.message.chat.id
            text_preview = event.data

        if from_user_id is None:
            return  # no user — drop

        status = _allowlist_cache.get(from_user_id)

        if status == "allowed":
            return await handler(event, data)

        # Anything below = drop event. Audit.
        insert_auth_reject(from_user_id, username, chat_id, event_kind, text_preview)

        if status == "blocked":
            log.warning("AUTH REJECT blocked user=%s username=%s", from_user_id, username)
            return

        if status == "pending":
            log.info("AUTH REJECT pending user=%s username=%s", from_user_id, username)
            row = get_user_row(from_user_id)
            already_notified = row is not None and row["pending_notified_at"] is not None
            if msg_obj is not None and not already_notified:
                with contextlib.suppress(TelegramAPIError):
                    await msg_obj.reply(
                        "⏳ Your access is pending approval by the operator. "
                        "You'll be notified when approved."
                    )
                mark_pending_notified(from_user_id)
            return

        # status is None — first-time DM. Insert pending + alert primary.
        log.info("AUTH NEW pending user=%s username=%s", from_user_id, username)
        try:
            upsert_user(from_user_id, username, "pending", added_by=None,
                        notes="first DM — auto-pending")
        except sqlite3.Error as exc:
            log.error("upsert pending failed: %s", exc)
        if msg_obj is not None:
            with contextlib.suppress(TelegramAPIError):
                await msg_obj.reply(
                    "⏳ Your access is pending approval by the operator. "
                    "You'll be notified when approved."
                )
                mark_pending_notified(from_user_id)
        with contextlib.suppress(TelegramAPIError):
            uname = f"@{username}" if username else "(no username)"
            await bot.send_message(
                ALLOWED_CHAT,
                f"🆕 New user request: {uname} (id=`{from_user_id}`)\n"
                f"Type `/users` to manage.",
                parse_mode="Markdown",
            )
        return


# --------------------------------------------------------------------------
# Bot + dispatcher
# --------------------------------------------------------------------------

bot = Bot(token=TG_TOKEN)
dp = Dispatcher()
_allowlist_mw = AllowlistMiddleware()
dp.message.middleware(_allowlist_mw)
dp.callback_query.middleware(_allowlist_mw)


SEND_KEYS_RETRIES = 8
SEND_KEYS_RETRY_DELAY = 1.5


async def send_keys_to_pane_async(text: str) -> None:
    """
    Type text + Enter into the tmux pane, with retries to bridge the
    kill→respawn window during /new_session and Resume actions.

    During those windows the tmux server may briefly not exist
    (kill-session removes the only session, server exits). The wrapper
    re-creates tmux within ~10–15s; we retry every ~1.5s up to 8 times
    so an operator message that arrives mid-window still lands in the
    new pane instead of being dropped.
    """
    last_err: Optional[BaseException] = None
    for attempt in range(SEND_KEYS_RETRIES):
        try:
            r1 = await asyncio.create_subprocess_exec(
                "tmux", "send-keys", "-l", "-t", TMUX_TARGET, text,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            _, err1 = await asyncio.wait_for(r1.communicate(), timeout=5)
            if r1.returncode != 0:
                raise RuntimeError(f"send-keys -l rc={r1.returncode}: {err1.decode(errors='replace')[:200]}")
            r2 = await asyncio.create_subprocess_exec(
                "tmux", "send-keys", "-t", TMUX_TARGET, "Enter",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            _, err2 = await asyncio.wait_for(r2.communicate(), timeout=5)
            if r2.returncode != 0:
                raise RuntimeError(f"send-keys Enter rc={r2.returncode}: {err2.decode(errors='replace')[:200]}")
            if attempt > 0:
                log.info("send-keys recovered after %d retries", attempt)
            return
        except (asyncio.TimeoutError, RuntimeError, OSError) as exc:
            last_err = exc
            if attempt < SEND_KEYS_RETRIES - 1:
                log.warning(
                    "send-keys attempt %d/%d failed: %s — retrying in %.1fs",
                    attempt + 1, SEND_KEYS_RETRIES, exc, SEND_KEYS_RETRY_DELAY,
                )
                await asyncio.sleep(SEND_KEYS_RETRY_DELAY)
    raise RuntimeError(f"send-keys failed after {SEND_KEYS_RETRIES} retries: {last_err}")


# --------------------------------------------------------------------------
# Sessions feature handlers
# Registered BEFORE the catch-all relay_inbound so they intercept matching
# messages and DO NOT forward to tmux (claude never sees /new_session etc.).
# --------------------------------------------------------------------------

@dp.message(Command("new_session"))
async def cmd_new_session(msg: Message, command: CommandObject) -> None:
    if command.args:
        await msg.reply("`/new_session` accepts no arguments.")
        return
    if not is_god_active():
        await msg.reply(
            "⚠️ god-session is paused. Run `/dispatcher resume` first, "
            "then re-issue `/new_session`."
        )
        return
    try:
        async def op() -> str:
            cmd = write_command_atomic("new", operator_chat_id=msg.chat.id)
            await kill_tmux_gracefully_async(TMUX_TARGET)
            return cmd

        cmd_id = await run_control("new_session", op)
    except (OSError, ValueError) as exc:
        log.error("write_command_atomic failed: %s", exc)
        await msg.reply(f"❌ Failed to queue command: {exc}")
        return
    log.info("/new_session queued cmd_id=%s; killing tmux", cmd_id)
    await msg.reply("🔄 Killing god-session — fresh context will start in ~5–10s.")


@dp.message(Command("sessions"))
async def cmd_sessions(msg: Message, command: CommandObject) -> None:
    args = (command.args or "").strip()

    # /sessions delete <id>
    if args.startswith("delete"):
        parts = args.split(maxsplit=1)
        sid = parts[1].strip() if len(parts) == 2 else ""
        if not sid:
            await msg.reply("Usage: `/sessions delete <session-id>`")
            return
        path = validate_session_path(sid)
        if path is None:
            await msg.reply(f"❌ Session `{sid}` not found or invalid id.")
            return
        owner = get_session_owner(sid)
        if owner is None:
            await msg.reply(f"❌ Session `{sid[:8]}…` has no recorded owner.", parse_mode="Markdown")
            return
        if msg.from_user and msg.from_user.id != owner:
            await msg.reply("❌ Not your session.")
            return
        async def delete_op() -> None:
            async with session_lock(sid):
                if path.exists():
                    with contextlib.suppress(OSError):
                        path.unlink()

        await run_control("delete_session", delete_op)
        await msg.reply(f"✓ Deleted `{sid[:8]}…`.")
        return

    show_all = args == "all"
    owner = msg.from_user.id if msg.from_user else ALLOWED_CHAT
    sessions = list_sessions(owner_user_id=owner, limit=None if show_all else SESSIONS_TOP_N)
    if not sessions:
        await msg.reply("📭 No sessions found for your account yet.")
        return

    if show_all:
        lines = [
            f"• `{s['sid'][:8]}` *{s['slug']}* — {fmt_ts(s['ts'])}"
            for s in sessions
        ]
        body = "\n".join(lines)
        footer = "\n\nDelete: `/sessions delete <id>`"
        await msg.reply(
            f"Your sessions ({len(sessions)}):\n{body}{footer}",
            parse_mode="Markdown",
        )
        return

    total = len(list_sessions(owner_user_id=owner, limit=None))
    for s in sessions:
        text = (
            f"📂 *{s['slug']}*\n"
            f"last: {fmt_ts(s['ts'])}\n"
            f"id: `{s['sid'][:8]}…`"
        )
        try:
            await bot.send_message(
                msg.chat.id, text,
                reply_markup=session_card_kb(s["sid"]),
                parse_mode="Markdown",
            )
        except TelegramAPIError as exc:
            log.error("send sessions card failed sid=%s: %s", s["sid"], exc)
    if total > SESSIONS_TOP_N:
        await msg.reply(
            f"+{total - SESSIONS_TOP_N} more — type `/sessions all`",
            parse_mode="Markdown",
        )


@dp.callback_query(F.data.startswith("s_run:") | F.data.startswith("s_del:"))
async def cb_session(query: CallbackQuery) -> None:
    if query.message is None:
        await query.answer("malformed", show_alert=True)
        return
    if not query.data or ":" not in query.data:
        await query.answer("malformed", show_alert=True)
        return
    action, sid = query.data.split(":", 1)

    path = validate_session_path(sid)
    if path is None:
        await query.answer("session not found", show_alert=True)
        with contextlib.suppress(TelegramAPIError):
            await query.message.edit_reply_markup(reply_markup=None)
        return

    # Ownership check: user can only Resume/Delete own sessions.
    owner = get_session_owner(sid)
    if owner is None:
        log.warning("session %s has no owner; refusing %s by user=%s",
                    sid, action, query.from_user.id)
        await query.answer("session ownership unknown", show_alert=True)
        return
    if query.from_user.id != owner:
        log.warning(
            "user %s tried to %s session %s owned by %s — rejected",
            query.from_user.id, action, sid, owner,
        )
        await query.answer("not your session", show_alert=True)
        with contextlib.suppress(TelegramAPIError):
            await query.message.edit_reply_markup(reply_markup=None)
        return

    async with session_lock(sid):
        # Recheck under lock (concurrent Delete may have just removed it).
        if not path.exists():
            await query.answer("session gone", show_alert=True)
            with contextlib.suppress(TelegramAPIError):
                await query.message.edit_reply_markup(reply_markup=None)
            return

        if action == "s_run":
            if not is_god_active():
                await query.answer(
                    "god-session paused; /dispatcher resume first",
                    show_alert=True,
                )
                return
            try:
                async def resume_op() -> None:
                    write_command_atomic(
                        "resume", session_id=sid, operator_chat_id=query.from_user.id,
                    )
                    await kill_tmux_gracefully_async(TMUX_TARGET)

                await run_control("resume_session", resume_op)
            except (OSError, ValueError) as exc:
                log.error("write_command_atomic resume failed: %s", exc)
                await query.answer(f"failed: {exc}", show_alert=True)
                return
            log.info("[Resume] queued sid=%s", sid)
            with contextlib.suppress(TelegramAPIError):
                await query.message.edit_text(
                    f"🔄 Resuming `{sid[:8]}…` — pane will reload in ~5–10s.",
                    parse_mode="Markdown",
                    reply_markup=None,
                )
        elif action == "s_del":
            async def delete_op() -> None:
                with contextlib.suppress(OSError):
                    path.unlink()

            await run_control("delete_session", delete_op)
            log.info("[Delete] removed sid=%s", sid)
            with contextlib.suppress(TelegramAPIError):
                await query.message.edit_text(
                    f"✓ Deleted `{sid[:8]}…`",
                    parse_mode="Markdown",
                    reply_markup=None,
                )
        else:
            await query.answer("unknown action", show_alert=True)
            return

    await query.answer()


# --------------------------------------------------------------------------
# Background error alerter — pushes wrapper-side errors (resume_invalid, etc.)
# from $STATE_DIR/last-god-error.json to the operator via Telegram.
# --------------------------------------------------------------------------

async def error_alerter() -> None:
    log.info(
        "error alerter started (poll every %.1fs)", ERROR_ALERTER_POLL_SEC,
    )
    while True:
        try:
            if ERROR_FILE.exists():
                try:
                    err = json.loads(ERROR_FILE.read_text(encoding="utf-8"))
                    kind = err.get("kind", "unknown")
                    snippet = json.dumps(err, ensure_ascii=False)[:300]
                    await bot.send_message(
                        ALLOWED_CHAT,
                        f"⚠️ god-session error: *{kind}*\n```\n{snippet}\n```",
                        parse_mode="Markdown",
                    )
                    ERROR_FILE.unlink()
                    log.info("alerted operator about god-session error: %s", kind)
                except (json.JSONDecodeError, OSError, TelegramAPIError) as exc:
                    log.warning("error alerter handle failed: %s", exc)
        except Exception as exc:  # never crash the loop
            log.error("error_alerter iteration failed: %s", exc)
        await asyncio.sleep(ERROR_ALERTER_POLL_SEC)


# --------------------------------------------------------------------------
# /users — primary-operator-only allowlist management
# --------------------------------------------------------------------------

def user_card_text(row: sqlite3.Row) -> str:
    primary_marker = " 🛡 primary" if row["user_id"] == ALLOWED_CHAT else ""
    uname = f"@{row['username']}" if row["username"] else "(no username)"
    status_emoji = {"allowed": "✓", "blocked": "⛔", "pending": "⏳"}.get(row["status"], "?")
    notes = f"\n_{row['notes']}_" if row["notes"] else ""
    return (
        f"{status_emoji} *{row['status']}*{primary_marker}\n"
        f"{uname}\n"
        f"id: `{row['user_id']}`{notes}"
    )


def user_card_kb(row: sqlite3.Row) -> Optional[InlineKeyboardMarkup]:
    if row["user_id"] == ALLOWED_CHAT:
        return None  # primary operator is protected
    uid = row["user_id"]
    buttons: list[InlineKeyboardButton] = []
    if row["status"] in ("pending", "blocked"):
        buttons.append(InlineKeyboardButton(text="✓ Allow", callback_data=f"usr_allow:{uid}"))
    if row["status"] in ("pending", "allowed"):
        buttons.append(InlineKeyboardButton(text="⛔ Block", callback_data=f"usr_block:{uid}"))
    buttons.append(InlineKeyboardButton(text="🗑 Delete", callback_data=f"usr_del:{uid}"))
    return InlineKeyboardMarkup(inline_keyboard=[buttons])


@dp.message(Command("users"))
async def cmd_users(msg: Message, command: CommandObject) -> None:
    if not is_primary_operator(msg.from_user.id if msg.from_user else None):
        await msg.reply("❌ Only the primary operator can manage the allowlist.")
        return
    rows = list_allowlisted_users()
    if not rows:
        await msg.reply("📭 Allowlist is empty (impossible — primary should always be there).")
        return
    await msg.reply(f"👥 Allowlist ({len(rows)} entries):")
    for row in rows:
        kb = user_card_kb(row)
        try:
            await bot.send_message(
                msg.chat.id,
                user_card_text(row),
                reply_markup=kb,
                parse_mode="Markdown",
            )
        except TelegramAPIError as exc:
            log.error("send users card failed user_id=%s: %s", row["user_id"], exc)


@dp.callback_query(
    F.data.startswith("usr_allow:")
    | F.data.startswith("usr_block:")
    | F.data.startswith("usr_del:")
)
async def cb_users(query: CallbackQuery) -> None:
    if not is_primary_operator(query.from_user.id if query.from_user else None):
        await query.answer("forbidden", show_alert=True)
        return
    if not query.data or ":" not in query.data:
        await query.answer("malformed", show_alert=True)
        return
    action, raw_uid = query.data.split(":", 1)
    try:
        uid = int(raw_uid)
    except ValueError:
        await query.answer("invalid id", show_alert=True)
        return

    if uid == ALLOWED_CHAT:
        await query.answer("cannot modify primary operator", show_alert=True)
        return

    row = get_user_row(uid)
    if row is None:
        await query.answer("user not found", show_alert=True)
        with contextlib.suppress(TelegramAPIError):
            await query.message.edit_reply_markup(reply_markup=None)
        return

    new_status: Optional[str] = None
    notify_user_msg: Optional[str] = None
    if action == "usr_allow":
        new_status = "allowed"
        notify_user_msg = "✓ Access granted by operator. You can use the bot now."
    elif action == "usr_block":
        new_status = "blocked"
    elif action == "usr_del":
        try:
            with db() as conn:
                conn.execute("DELETE FROM allowed_users WHERE user_id = ?", (uid,))
        except sqlite3.Error as exc:
            log.error("delete user %s failed: %s", uid, exc)
            await query.answer(f"db error: {exc}", show_alert=True)
            return
        refresh_allowlist_cache()
        log.info("[/users delete] uid=%s by primary", uid)
        with contextlib.suppress(TelegramAPIError):
            await query.message.edit_text(
                f"🗑 Deleted user `{uid}` from allowlist.",
                parse_mode="Markdown",
                reply_markup=None,
            )
        await query.answer()
        return
    else:
        await query.answer("unknown action", show_alert=True)
        return

    try:
        upsert_user(uid, row["username"], new_status, added_by=ALLOWED_CHAT)
    except (sqlite3.Error, ValueError) as exc:
        log.error("set status %s for uid=%s failed: %s", new_status, uid, exc)
        await query.answer(f"db error: {exc}", show_alert=True)
        return

    log.info("[/users %s] uid=%s by primary", action, uid)

    # Notify the user (only on Allow — silent on Block).
    if notify_user_msg:
        with contextlib.suppress(TelegramAPIError):
            await bot.send_message(uid, notify_user_msg)

    # Update the card to reflect new status.
    fresh_row = get_user_row(uid)
    if fresh_row is not None:
        with contextlib.suppress(TelegramAPIError):
            await query.message.edit_text(
                user_card_text(fresh_row),
                reply_markup=user_card_kb(fresh_row),
                parse_mode="Markdown",
            )
    await query.answer()


# --------------------------------------------------------------------------
# Durable inbound: Telegram messages are queued, then drained into tmux.
# Middleware already filtered to allowed users.
# --------------------------------------------------------------------------

UNSUPPORTED_MEDIA_REPLY = "Сейчас поддерживаются только текстовые сообщения."


def has_unsupported_media(msg: Message) -> bool:
    return any(
        getattr(msg, attr, None)
        for attr in (
            "voice", "audio", "document", "photo", "video",
            "video_note", "animation", "sticker",
        )
    )


def inbound_user_tag(msg: Message) -> str:
    if msg.from_user and msg.from_user.username:
        return f" user={msg.from_user.username}"
    if msg.from_user:
        return f" user={msg.from_user.id}"
    return ""


@dp.message()
async def relay_inbound(msg: Message) -> None:
    text = (msg.text or msg.caption or "").strip()
    if not text:
        if has_unsupported_media(msg):
            rejected_id = insert_rejected_inbound(
                UNSUPPORTED_MEDIA_REPLY,
                msg.chat.id,
                msg.message_id,
                "unsupported media without text/caption",
            )
            log.info(
                "INBOUND #%d rejected unsupported media chat=%s tg_msg=%s",
                rejected_id, msg.chat.id, msg.message_id,
            )
            with contextlib.suppress(TelegramAPIError):
                await msg.reply(UNSUPPORTED_MEDIA_REPLY)
        return
    user_tag = inbound_user_tag(msg)
    pane_text = f"[tg id={msg.chat.id}:{msg.message_id}{user_tag}] {text}"
    inbound_id = insert_inbound(pane_text, msg.chat.id, msg.message_id)
    log.info(
        "INBOUND #%d queued (%d chars) chat=%s tg_msg=%s",
        inbound_id, len(text), msg.chat.id, msg.message_id,
    )
    log.info("INBOUND #%d queued for tmux delivery", inbound_id)


def god_session_ready() -> bool:
    try:
        res = subprocess.run(
            ["tmux", "has-session", "-t", TMUX_TARGET],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=3,
            check=False,
        )
        return res.returncode == 0
    except (subprocess.SubprocessError, OSError):
        return False


async def inbound_worker() -> None:
    log.info("inbound worker started (poll every %.1fs)", INBOUND_POLL_SEC)
    while True:
        try:
            if not god_session_ready():
                await asyncio.sleep(INBOUND_POLL_SEC)
                continue
            rows = select_due_inbound(limit=5)
            for row in rows:
                await deliver_inbound_row(row)
        except Exception as exc:
            log.error("inbound worker iteration failed: %s", exc)
        await asyncio.sleep(INBOUND_POLL_SEC)


async def deliver_inbound_row(row: sqlite3.Row) -> None:
    try:
        async def op() -> None:
            update_message(row["id"], status="delivering")
            await send_keys_to_pane_async(row["text"])

        await run_control("deliver_inbound", op)
        update_message(
            row["id"], status="delivered", delivered_at=now_ts(), error=None,
        )
        log.info("INBOUND #%d delivered to tmux", row["id"])
        # L1: silent reaction ack on operator's original message.
        # Cosmetic; failures must NOT change delivery status.
        if verbosity_allows("L1") and row["tg_chat_id"] and row["tg_msg_id"]:
            await react_to_inbound(int(row["tg_chat_id"]), int(row["tg_msg_id"]))
    except (RuntimeError, asyncio.TimeoutError, OSError) as exc:
        attempts = row["attempts"] + 1
        age = now_ts() - row["ts"]
        terminal_status = "failed" if attempts >= INBOUND_MAX_ATTEMPTS else "abandoned"
        if terminal_status == "failed" or age > INBOUND_ABANDON_TTL_SEC:
            update_message(
                row["id"], status=terminal_status, attempts=attempts,
                error=str(exc)[:300],
            )
            enqueue_outbox(
                "⚠️ Не смог доставить твоё сообщение в god-session после "
                "многократных попыток. Проверь `/dispatcher status` и отправь "
                "сообщение снова, когда tmux восстановится.",
                row["tg_chat_id"],
                replied_to_id=row["tg_msg_id"],
                session_id=row["session_id"],
            )
            log.error("INBOUND #%d %s permanently: %s", row["id"], terminal_status, exc)
        else:
            backoff = min(2 ** min(attempts, 6), 60)
            update_message(
                row["id"], status="queued", attempts=attempts,
                next_attempt_at=now_ts() + backoff, error=str(exc)[:300],
            )
            log.warning(
                "INBOUND #%d delivery failed; retry in %ds (attempt %d): %s",
                row["id"], backoff, attempts, exc,
            )


# --------------------------------------------------------------------------
# Outbox worker (Hermes-borrowed: utf16-aware split, RetryAfter handling,
# TimedOut → unknown to avoid duplicates)
# --------------------------------------------------------------------------

def utf16_len(s: str) -> int:
    return sum(2 if ord(c) > 0xFFFF else 1 for c in s)


def split_for_telegram(text: str, limit: int = TG_MAX_LEN) -> list[str]:
    if utf16_len(text) <= limit:
        return [text]
    chunks: list[str] = []
    rest = text
    while rest:
        end = len(rest)
        while utf16_len(rest[:end]) > limit:
            split_at = rest[:end].rfind("\n")
            end = split_at if split_at > 0 else end - 1
        chunk = rest[:end].rstrip()
        if chunk:
            chunks.append(chunk)
        rest = rest[end:].lstrip()
    return chunks


async def outbox_worker() -> None:
    log.info("outbox worker started (poll every %.1fs)", OUTBOX_POLL_SEC)
    while True:
        try:
            rows = select_due_outbox(limit=5)
            for row in rows:
                await deliver_outbox_row(row)
        except Exception as exc:
            log.error("outbox worker iteration failed: %s", exc)
        await asyncio.sleep(OUTBOX_POLL_SEC)


async def deliver_outbox_row(row: sqlite3.Row) -> None:
    update_outbox(row["id"], status="sending")
    text = row["text"]
    chunks = split_for_telegram(text)
    sent_msg_ids: list[int] = []
    try:
        for chunk in chunks:
            sent = await bot.send_message(chat_id=row["chat_id"], text=chunk)
            sent_msg_ids.append(sent.message_id)
        update_outbox(
            row["id"], status="sent",
            tg_msg_id=sent_msg_ids[-1] if sent_msg_ids else None,
            error=None,
        )
        log.info(
            "OUTBOX #%d sent (%d chunks, last tg_msg=%s)",
            row["id"], len(chunks), sent_msg_ids[-1] if sent_msg_ids else None,
        )
    except TelegramRetryAfter as exc:
        next_at = now_ts() + exc.retry_after + 1
        update_outbox(
            row["id"], status="queued", next_attempt_at=next_at,
            attempts=row["attempts"] + 1, error=f"retry_after={exc.retry_after}",
        )
        log.warning(
            "OUTBOX #%d flood control: retry in %ds (attempt %d)",
            row["id"], exc.retry_after, row["attempts"] + 1,
        )
    except (asyncio.TimeoutError, TelegramNetworkError) as exc:
        # Hermes-pattern: do NOT retry timeouts. Telegram may have received
        # the message; a retry could deliver a duplicate.
        update_outbox(
            row["id"], status="unknown",
            attempts=row["attempts"] + 1, error=f"timeout/net: {exc}",
        )
        log.error("OUTBOX #%d timeout/network — marked unknown: %s", row["id"], exc)
    except (TelegramBadRequest, TelegramAPIError) as exc:
        attempts = row["attempts"] + 1
        if attempts >= OUTBOX_MAX_ATTEMPTS or (now_ts() - row["ts"]) > OUTBOX_ABANDON_TTL_SEC:
            update_outbox(row["id"], status="abandoned", attempts=attempts, error=str(exc))
            log.error("OUTBOX #%d abandoned after %d attempts: %s", row["id"], attempts, exc)
        else:
            backoff = min(2 ** attempts * 5, 300)
            update_outbox(
                row["id"], status="queued",
                next_attempt_at=now_ts() + backoff,
                attempts=attempts, error=str(exc),
            )
            log.warning(
                "OUTBOX #%d API error (retry in %ds, attempt %d): %s",
                row["id"], backoff, attempts, exc,
            )
    except Exception as exc:  # noqa: BLE001
        update_outbox(
            row["id"], status="queued",
            next_attempt_at=now_ts() + 30,
            attempts=row["attempts"] + 1, error=f"unexpected: {exc}",
        )
        log.exception("OUTBOX #%d unexpected error", row["id"])


# --------------------------------------------------------------------------
# Hook handlers
# --------------------------------------------------------------------------

async def hook_user_prompt_submit(request: web.Request) -> web.Response:
    try:
        data = await request.json()
    except Exception as exc:  # noqa: BLE001
        log.warning("malformed UserPromptSubmit: %s", exc)
        return web.json_response({}, status=200)

    session_id = data.get("session_id", "")
    prompt = data.get("prompt") or ""
    if not session_id:
        return web.json_response({}, status=200)

    insert_session_event(session_id, "user_prompt_submit", {
        "prompt_len": len(prompt),
        "starts_with_tg": prompt.startswith("[tg id="),
    })

    m = TG_PREFIX_RE.match(prompt)
    if not m:
        return web.json_response({}, status=200)

    chat_id = int(m.group(1))
    tg_msg_id = int(m.group(2))
    inbound = find_inbound_by_tg(chat_id, tg_msg_id)
    inbound_id = inbound["id"] if inbound else 0
    if inbound:
        update_message(inbound["id"], session_id=session_id)
    set_pending(session_id, inbound_id, prompt)
    log.info(
        "HOOK user-prompt-submit: session=%s pending set inbound=%d (tg %s:%s)",
        session_id[:8], inbound_id, chat_id, tg_msg_id,
    )
    return web.json_response({}, status=200)


async def hook_stop(request: web.Request) -> web.Response:
    try:
        data = await request.json()
    except Exception as exc:  # noqa: BLE001
        log.warning("malformed Stop: %s", exc)
        return web.json_response({}, status=200)

    session_id = data.get("session_id", "")
    last_msg = (data.get("last_assistant_message") or "").strip()
    if not session_id:
        return web.json_response({}, status=200)

    insert_session_event(session_id, "stop", {"msg_len": len(last_msg)})

    if not last_msg:
        return web.json_response({}, status=200)

    pending = get_pending(session_id)
    if not pending:
        log.info("HOOK stop: session=%s no pending; not bridging", session_id[:8])
        return web.json_response({}, status=200)

    # Resolve the chat_id of the original inbound — reply goes back to whoever
    # asked, not always to the primary operator (multi-user mode).
    inbound_row = db().execute(
        "SELECT tg_chat_id FROM messages WHERE id = ?", (pending["inbound_msg_id"],),
    ).fetchone()
    reply_chat_id = inbound_row["tg_chat_id"] if inbound_row else ALLOWED_CHAT

    audit_id = db().execute(
        "INSERT INTO messages (ts, direction, status, text, session_id, replied_to_id) "
        "VALUES (?, 'outbound', 'queued', ?, ?, ?)",
        (now_ts(), last_msg, session_id, pending["inbound_msg_id"]),
    ).lastrowid

    final_text = f"💬 {last_msg}" if not last_msg.startswith("💬") else last_msg
    outbox_id = enqueue_outbox(
        final_text, reply_chat_id,
        replied_to_id=pending["inbound_msg_id"],
        session_id=session_id, audit_msg_id=audit_id,
        event_type="reply",
    )
    clear_pending(session_id)
    log.info(
        "HOOK stop: session=%s enqueued outbox #%d (audit #%d, %d chars)",
        session_id[:8], outbox_id, audit_id, len(last_msg),
    )
    return web.json_response({}, status=200)


async def hook_stop_failure(request: web.Request) -> web.Response:
    try:
        data = await request.json()
    except Exception:
        return web.json_response({}, status=200)
    session_id = data.get("session_id", "")
    error_type = data.get("error_type", "unknown")
    insert_session_event(session_id, "stop_failure", {"error_type": error_type})
    log.error("HOOK stop-failure: session=%s error_type=%s", session_id[:8], error_type)
    pending = get_pending(session_id) if session_id else None
    if pending:
        inbound_row = db().execute(
            "SELECT tg_chat_id FROM messages WHERE id = ?", (pending["inbound_msg_id"],),
        ).fetchone()
        reply_chat_id = inbound_row["tg_chat_id"] if inbound_row else ALLOWED_CHAT
        enqueue_outbox(
            f"⚠️ Claude turn failed: {error_type}",
            reply_chat_id,
            replied_to_id=pending["inbound_msg_id"],
            session_id=session_id,
        )
        clear_pending(session_id)
    return web.json_response({}, status=200)


async def hook_session_start(request: web.Request) -> web.Response:
    try:
        data = await request.json()
    except Exception:
        return web.json_response({}, status=200)

    session_id = data.get("session_id", "")
    source = data.get("source", "startup")
    model = data.get("model")
    cwd = data.get("cwd")
    transcript_path = data.get("transcript_path")

    cur = db().execute(
        "SELECT session_id FROM sessions WHERE ended_at IS NULL "
        "AND session_id != ? ORDER BY started_at DESC LIMIT 1",
        (session_id,),
    )
    prev = cur.fetchone()
    previous_session = prev["session_id"] if prev else None

    # Ownership chain:
    #   /new_session or [Resume] click → relay writes god-command.json with
    #   operator_chat_id → wrapper consumes it AND copies to last-god-command.json
    #   → next SessionStart hook reads last-god-command.json and tags new
    #     `sessions` row with that operator_chat_id.
    # Fallback: if SessionStart fires for `--continue` (auto-respawn, no
    # command queued), inherit owner from previous session, else default to
    # primary operator (ALLOWED_CHAT).
    owner = consume_last_god_command_owner()
    if owner is None and previous_session:
        prev_owner = get_session_owner(previous_session)
        owner = prev_owner if prev_owner is not None else ALLOWED_CHAT
    elif owner is None:
        owner = ALLOWED_CHAT

    upsert_session(
        session_id, source=source, model=model, cwd=cwd,
        transcript_path=transcript_path, previous_session=previous_session,
        created_by_user_id=owner,
    )
    insert_session_event(session_id, "session_start", {
        "source": source, "model": model, "previous": previous_session,
        "owner": owner,
    })
    log.info(
        "HOOK session-start: session=%s source=%s model=%s prev=%s owner=%s",
        session_id[:8], source, model, (previous_session or "")[:8], owner,
    )

    additional_context = build_session_start_context(session_id, source, previous_session)
    return web.json_response({
        "hookSpecificOutput": {
            "hookEventName": "SessionStart",
            "additionalContext": additional_context,
        },
    }, status=200)


def build_session_start_context(
    session_id: str, source: str, previous_session: Optional[str],
) -> str:
    lines = [
        "## Persistent context (claude-relay-bot, " + DB_PATH + ")",
        "",
        f"_Session start: source={source}, prev={previous_session or 'none'}_",
        "",
    ]

    mems = memory_recent(MEMORY_INJECT_LIMIT)
    if mems:
        memory_mark_used([m["id"] for m in mems])
        by_cat: dict[str, list[str]] = {}
        for m in mems:
            by_cat.setdefault(m["category"], []).append(m["text"])
        lines.append("### Recent memories")
        for cat, texts in by_cat.items():
            lines.append(f"**{cat}**:")
            for t in texts:
                lines.append(f"- {t}")
            lines.append("")
    else:
        lines.append("### Recent memories")
        lines.append("_no memories saved yet_")
        lines.append("")

    runs = dispatch_recent(DISPATCH_RECENT_LIMIT)
    if runs:
        lines.append("### Last dispatch runs")
        for r in runs:
            ts = time.strftime("%b %d %H:%M", time.localtime(r["ts_started"]))
            issue = f"#{r['issue_number']}" if r.get("issue_number") else "—"
            pr = f"PR #{r['pr_number']}" if r.get("pr_number") else ""
            lines.append(
                f"- run {r['id']} ({ts}): issue {issue}, status={r['status']} {pr}".rstrip()
            )
        lines.append("")

    cur = db().execute(
        "SELECT * FROM pending_reply WHERE session_id != ?", (session_id,)
    )
    orphans = list(cur.fetchall())
    if orphans:
        lines.append("### Orphaned pending replies (operator messaged before crash)")
        for o in orphans:
            lines.append(f"- session={o['session_id'][:8]} inbound_msg_id={o['inbound_msg_id']}")
        lines.append("")

    return "\n".join(lines)


async def hook_subagent_stop(request: web.Request) -> web.Response:
    try:
        data = await request.json()
    except Exception:
        return web.json_response({}, status=200)
    session_id = data.get("session_id", "")
    agent_id = data.get("agent_id", "")
    agent_type = data.get("agent_type", "")
    insert_session_event(session_id, "subagent_stop", {
        "agent_id": agent_id, "agent_type": agent_type,
    })
    log.info(
        "HOOK subagent-stop: session=%s agent=%s type=%s",
        session_id[:8], agent_id[:8], agent_type,
    )
    # L4: subagent boundary notification (always passes token bucket).
    if verbosity_allows("L4") and agent_type:
        chat_id = operator_chat_for_session(session_id)
        try:
            with db() as conn:
                conn.execute(
                    "INSERT INTO outbox (ts, text, chat_id, status, attempts, "
                    "next_attempt_at, session_id, event_type) "
                    "VALUES (?, ?, ?, 'queued', 0, ?, ?, 'status_subagent')",
                    (now_ts(), f"✅ Subagent: {md_safe(truncate(agent_type, 40))} done",
                     chat_id, now_ts(), session_id),
                )
        except sqlite3.Error as exc:
            log.error("L4 enqueue failed: %s", exc)
    return web.json_response({}, status=200)


async def hook_pre_tool_use(request: web.Request) -> web.Response:
    """L2 (Skill), L3 (TodoWrite), L4-pre (Agent) emitter."""
    try:
        data = await request.json()
    except Exception:
        return web.json_response({}, status=200)
    tool_name = data.get("tool_name", "")
    tool_input = data.get("tool_input", {}) or {}
    session_id = data.get("session_id", "") or ""
    chat_id = operator_chat_for_session(session_id)
    log.debug("HOOK pre-tool-use tool_name=%s session=%s", tool_name, session_id[:8])

    try:
        if tool_name == "Skill" and verbosity_allows("L2"):
            text = format_skill_event(tool_input, prefix="🔧")
            if text:
                enqueue_status_outbox(chat_id, text, "status_skill", session_id)
        elif tool_name == "TodoWrite" and verbosity_allows("L3"):
            todos = tool_input.get("todos") if isinstance(tool_input, dict) else None
            if isinstance(todos, list):
                for line in diff_and_emit_todos(session_id, todos):
                    enqueue_status_outbox(chat_id, line, "status_todo", session_id)
        elif tool_name == "Agent" and verbosity_allows("L2"):
            text = format_agent_event(tool_input)
            if text:
                enqueue_status_outbox(chat_id, text, "status_skill", session_id)
    except Exception as exc:
        log.error("hook_pre_tool_use handler failed: %s", exc)
    return web.json_response({}, status=200)


async def hook_post_tool_use(request: web.Request) -> web.Response:
    """L2 close (Skill done) — verbose only."""
    try:
        data = await request.json()
    except Exception:
        return web.json_response({}, status=200)
    if not verbosity_allows("verbose_bash"):
        return web.json_response({}, status=200)
    tool_name = data.get("tool_name", "")
    tool_input = data.get("tool_input", {}) or {}
    session_id = data.get("session_id", "") or ""
    if tool_name == "Skill":
        text = format_skill_event(tool_input, prefix="✅")
        if text:
            chat_id = operator_chat_for_session(session_id)
            enqueue_status_outbox(chat_id, text + " done", "status_skill", session_id)
    return web.json_response({}, status=200)


# --------------------------------------------------------------------------
# Application API (called by claude inside its bash blocks)
# --------------------------------------------------------------------------

async def api_dispatch_start(request: web.Request) -> web.Response:
    try:
        data = await request.json()
    except Exception:
        return web.json_response({"error": "bad json"}, status=400)
    run_id = dispatch_start(
        trigger=data.get("trigger", "manual"),
        session_id=data.get("session_id"),
        issue_number=data.get("issue_number"),
        issue_title=data.get("issue_title"),
        budget_5h=data.get("budget_5h_pct"),
        budget_week=data.get("budget_week_pct"),
    )
    log.info("DISPATCH start run=%d trigger=%s", run_id, data.get("trigger"))
    return web.json_response({"run_id": run_id})


async def api_dispatch_phase(request: web.Request) -> web.Response:
    try:
        data = await request.json()
    except Exception:
        return web.json_response({"error": "bad json"}, status=400)
    if "run_id" not in data or "phase" not in data:
        return web.json_response({"error": "run_id and phase required"}, status=400)
    dispatch_phase(
        run_id=int(data["run_id"]),
        phase=data["phase"],
        status=data.get("status", "running"),
        verdict=data.get("verdict"),
        details=data.get("details"),
    )
    return web.json_response({"ok": True})


async def api_dispatch_end(request: web.Request) -> web.Response:
    try:
        data = await request.json()
    except Exception:
        return web.json_response({"error": "bad json"}, status=400)
    if "run_id" not in data:
        return web.json_response({"error": "run_id required"}, status=400)
    dispatch_end(
        run_id=int(data["run_id"]),
        status=data.get("status", "finished"),
        pr_number=data.get("pr_number"),
        pr_url=data.get("pr_url"),
        branch=data.get("branch"),
        error=data.get("error"),
    )
    log.info("DISPATCH end run=%s status=%s", data["run_id"], data.get("status"))
    return web.json_response({"ok": True})


async def api_dispatch_recent(request: web.Request) -> web.Response:
    n = int(request.query.get("n", "10"))
    return web.json_response({"runs": dispatch_recent(n)})


async def api_memory_add(request: web.Request) -> web.Response:
    try:
        data = await request.json()
    except Exception:
        return web.json_response({"error": "bad json"}, status=400)
    if "category" not in data or "text" not in data:
        return web.json_response({"error": "category and text required"}, status=400)
    mem_id = memory_add(
        category=data["category"],
        text=data["text"],
        tags=data.get("tags"),
        source=data.get("source"),
        expires_at=data.get("expires_at"),
    )
    log.info("MEMORY add id=%d category=%s", mem_id, data["category"])
    return web.json_response({"memory_id": mem_id})


async def api_memory_recent(request: web.Request) -> web.Response:
    n = int(request.query.get("n", "20"))
    cat = request.query.get("category")
    rows = memory_recent(n, cat)
    return web.json_response({"memories": [dict(r) for r in rows]})


async def api_memory_forget(request: web.Request) -> web.Response:
    try:
        data = await request.json()
    except Exception:
        return web.json_response({"error": "bad json"}, status=400)
    deleted = memory_forget(
        memory_id=data.get("memory_id"),
        tag_match=data.get("tag_match"),
    )
    return web.json_response({"deleted": deleted})


async def api_health(request: web.Request) -> web.Response:
    cur = db().execute("SELECT COUNT(*) AS c FROM outbox WHERE status='queued'")
    queued = cur.fetchone()["c"]
    cur = db().execute("SELECT COUNT(*) AS c FROM outbox WHERE status='abandoned'")
    abandoned = cur.fetchone()["c"]
    cur = db().execute("SELECT COUNT(*) AS c FROM outbox WHERE status='unknown'")
    unknown = cur.fetchone()["c"]
    cur = db().execute(
        "SELECT COUNT(*) AS c FROM messages WHERE direction='inbound' AND status='queued'"
    )
    inbound_queued = cur.fetchone()["c"]
    cur = db().execute(
        "SELECT COUNT(*) AS c FROM messages WHERE direction='inbound' "
        "AND status IN ('failed','abandoned')"
    )
    inbound_failed = cur.fetchone()["c"]
    cur = db().execute(
        "SELECT COUNT(*) AS c FROM messages WHERE direction='inbound' AND status='rejected'"
    )
    inbound_rejected = cur.fetchone()["c"]
    cur = db().execute(
        "SELECT session_id FROM sessions WHERE ended_at IS NULL "
        "ORDER BY started_at DESC LIMIT 1"
    )
    row = cur.fetchone()
    last_session = row["session_id"][:8] if row else None
    db_size = os.path.getsize(DB_PATH) if os.path.exists(DB_PATH) else 0
    return web.json_response({
        "ok": True,
        "version": "v6",
        "god_session_ready": god_session_ready(),
        "control_busy": _control_lock.locked(),
        "control_pending": _control_pending,
        "control_current": _control_current,
        "control_last_action": _control_last_action,
        "inbound_queued": inbound_queued,
        "inbound_failed": inbound_failed,
        "inbound_rejected": inbound_rejected,
        "outbox_queued": queued,
        "outbox_abandoned": abandoned,
        "outbox_unknown": unknown,
        "active_session_short": last_session,
        "db_size_bytes": db_size,
    })


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------

def make_app() -> web.Application:
    app = web.Application()
    app.router.add_post("/hook/user-prompt-submit", hook_user_prompt_submit)
    app.router.add_post("/hook/stop", hook_stop)
    app.router.add_post("/hook/stop-failure", hook_stop_failure)
    app.router.add_post("/hook/session-start", hook_session_start)
    app.router.add_post("/hook/subagent-stop", hook_subagent_stop)
    app.router.add_post("/hook/pre-tool-use", hook_pre_tool_use)
    app.router.add_post("/hook/post-tool-use", hook_post_tool_use)

    app.router.add_post("/dispatch/start", api_dispatch_start)
    app.router.add_post("/dispatch/phase", api_dispatch_phase)
    app.router.add_post("/dispatch/end", api_dispatch_end)
    app.router.add_get("/dispatch/recent", api_dispatch_recent)

    app.router.add_post("/memory/add", api_memory_add)
    app.router.add_get("/memory/recent", api_memory_recent)
    app.router.add_post("/memory/forget", api_memory_forget)

    app.router.add_get("/health", api_health)
    return app


async def main() -> None:
    db()
    bootstrap_allowlist()
    migrate_outbox_event_type()
    reconcile_sessions_owner()
    app = make_app()
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, HOOK_HOST, HOOK_PORT)
    await site.start()
    log.info(
        "claude-relay-bot up: chat=%s tmux=%s:%s hooks=%s:%d db=%s allowlist=%d users",
        ALLOWED_CHAT, TMUX_USER, TMUX_TARGET, HOOK_HOST, HOOK_PORT, DB_PATH,
        len(_allowlist_cache),
    )

    inbound_task = asyncio.create_task(inbound_worker())
    worker_task = asyncio.create_task(outbox_worker())
    alerter_task = asyncio.create_task(error_alerter())

    # Resolve sessions dir once at startup (best-effort; will retry on demand).
    sd = get_sessions_dir()
    if sd:
        log.info("sessions feature ready: dir=%s", sd)
    else:
        log.info(
            "sessions dir not yet resolvable; will retry on /sessions invocation",
        )

    try:
        await dp.start_polling(bot)
    finally:
        inbound_task.cancel()
        worker_task.cancel()
        alerter_task.cancel()
        await runner.cleanup()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log.info("interrupted, exiting")
        sys.exit(0)
