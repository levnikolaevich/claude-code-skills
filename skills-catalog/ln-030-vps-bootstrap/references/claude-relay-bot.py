#!/usr/bin/env python3
"""
claude-relay-bot v3 — central state-store + bidirectional Telegram bridge for
the ${PROJECT_NAME} god-session.

Responsibilities:
  - Inbound Telegram → tmux send-keys (with stable [tg id=<chat>:<msg>] prefix)
  - Claude Code HTTP hook receiver (UserPromptSubmit / Stop / StopFailure /
    SessionStart / PostCompact / SubagentStop)
  - Durable outbox with retry/backoff/abandon — Stop hook never blocks on
    Telegram API; an asyncio worker drains the queue
  - Session lifecycle tracking (sessions, session_events, lineage on resume)
  - Dispatch run tracking (one /dispatch invocation = one run; phases map to
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
from typing import Any, Optional

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

# Sessions feature (v5.1) — atomic command queue + sessions UI
STATE_DIR = Path(f"/var/lib/{PROJECT_NAME}")
CMD_FILE = STATE_DIR / "god-command.json"
CMD_LOCK_FILE = STATE_DIR / ".cmd-lock"
SESSIONS_DIR_FILE = STATE_DIR / "sessions-dir.path"
ERROR_FILE = STATE_DIR / "last-god-error.json"
GOD_SERVICE_NAME = f"{SERVICE_PREFIX}-god.service"
CLAUDE_PROJECTS_HOME = Path(f"/home/{BOT_USER}/.claude/projects")

OUTBOX_POLL_SEC = 2.0
OUTBOX_MAX_ATTEMPTS = 5
OUTBOX_ABANDON_TTL_SEC = 24 * 3600
TG_MAX_LEN = 4096
TG_PREFIX_RE = re.compile(r"^\[tg id=(\d+):(\d+)\]\s?")
MEMORY_INJECT_LIMIT = 20
DISPATCH_RECENT_LIMIT = 3

UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)
SESSIONS_TOP_N = 10
SESSIONS_ALL_CAP = 50
ERROR_ALERTER_POLL_SEC = 5.0

# --------------------------------------------------------------------------
# SQLite schema + connection
# --------------------------------------------------------------------------

SCHEMA = """
CREATE TABLE IF NOT EXISTS messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  ts              INTEGER NOT NULL,
  direction       TEXT NOT NULL,
  status          TEXT NOT NULL,
  text            TEXT NOT NULL,
  tg_chat_id      INTEGER,
  tg_msg_id       INTEGER,
  session_id      TEXT,
  replied_to_id   INTEGER,
  error           TEXT
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
  end_reason        TEXT
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

-- v5.1: forensics for rejected (non-allowlisted) Telegram events.
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

-- v5.2: allowlist managed via Telegram `/users` command (with [Allow]/[Block]/
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

-- v5.2: ownership tag for sessions (so `/sessions` shows only own).
-- Backfilled to ALLOWED_CHAT (primary operator) for legacy rows on first run.
-- Note: ALTER TABLE is in Python startup code (try/except) since CREATE TABLE
-- IF NOT EXISTS doesn't add columns to pre-existing tables.
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
    return _DB


def now_ts() -> int:
    return int(time.time())


# --------------------------------------------------------------------------
# Domain queries
# --------------------------------------------------------------------------

def insert_inbound(text: str, tg_chat_id: int, tg_msg_id: int) -> int:
    cur = db().execute(
        "INSERT INTO messages (ts, direction, status, text, tg_chat_id, tg_msg_id) "
        "VALUES (?, 'inbound', 'received', ?, ?, ?)",
        (now_ts(), text, tg_chat_id, tg_msg_id),
    )
    return cur.lastrowid


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
) -> int:
    cur = db().execute(
        "INSERT INTO outbox (ts, text, chat_id, status, next_attempt_at, "
        "replied_to_id, session_id, audit_msg_id) "
        "VALUES (?,?,?,'queued',?,?,?,?)",
        (now_ts(), text, chat_id, now_ts(), replied_to_id, session_id, audit_msg_id),
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
) -> None:
    db().execute(
        "UPDATE sessions SET ended_at=?, end_reason='replaced' "
        "WHERE ended_at IS NULL AND session_id != ?",
        (now_ts(), session_id),
    )
    db().execute(
        "INSERT OR IGNORE INTO sessions "
        "(session_id, started_at, source, previous_session, model, cwd, transcript_path) "
        "VALUES (?,?,?,?,?,?,?)",
        (session_id, now_ts(), source, previous_session, model, cwd, transcript_path),
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
# Sessions feature helpers (v5.1) — atomic command queue, JSONL parsing,
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


def list_sessions(limit: Optional[int] = SESSIONS_TOP_N) -> list[dict]:
    """
    Return list of {sid, slug, ts} sorted by recency desc.

    Defensive: skips files with non-UUID names, missing slugs default to
    sid[:8], missing timestamps default to file mtime.
    """
    sd = get_sessions_dir()
    if sd is None or not sd.exists():
        return []
    out: list[dict] = []
    for jsonl in sd.glob("*.jsonl"):
        sid = jsonl.stem
        if not UUID_RE.match(sid):
            continue
        slug = session_display_name(jsonl, sid)
        ts = jsonl.stat().st_mtime
        last = read_last_jsonl_object(jsonl)
        if last and isinstance(last, dict):
            ts_iso = last.get("timestamp")
            ts_parsed = parse_iso8601_to_epoch(ts_iso) if isinstance(ts_iso, str) else None
            if ts_parsed:
                ts = ts_parsed
        out.append({"sid": sid, "slug": slug, "ts": ts})
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
# Allowlist (defense-in-depth, v5.1 — sec hardening)
#
# The bot username is publicly discoverable on Telegram, so anyone can DM
# this bot and try to inject commands. Telegram has NO API-level allowlist
# for DMs — guarding is purely application-side. We layer:
#
#   L1 (BotFather, manual): /setjoingroups Disable → bot is DM-only.
#   L2 (this middleware): drops every Message/CallbackQuery whose
#       chat_id or from_user.id is not in the allowlist, BEFORE any
#       handler runs. Audited to SQLite.
#   L3 (per-handler chat_id checks, kept for redundancy): if anyone removes
#       or bypasses the middleware, the per-handler checks still hold.
# --------------------------------------------------------------------------

ALLOWED_USERS: set[int] = {ALLOWED_CHAT}  # in DM, chat_id == from_user.id


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


class AllowlistMiddleware(BaseMiddleware):
    """
    Drop any Message/CallbackQuery whose user is not in ALLOWED_USERS.
    Records every reject to SQLite `auth_rejects` for forensics.
    Silent drop — replying would confirm bot existence to scanners.
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

        if isinstance(event, Message):
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

        # Strict: BOTH user_id and chat_id must be allowlisted (in DM they
        # match; this catches edge cases like forwarded messages or weird
        # Telegram client bugs).
        if from_user_id is not None and from_user_id not in ALLOWED_USERS:
            log.warning(
                "AUTH REJECT %s from_user=%s username=%s chat=%s text=%r",
                event_kind, from_user_id, username, chat_id,
                (text_preview or "")[:80],
            )
            insert_auth_reject(from_user_id, username, chat_id, event_kind, text_preview)
            return  # silent drop — do not call handler
        if chat_id is not None and chat_id != ALLOWED_CHAT:
            log.warning(
                "AUTH REJECT (chat mismatch) %s chat_id=%s",
                event_kind, chat_id,
            )
            insert_auth_reject(from_user_id, username, chat_id, event_kind, text_preview)
            return

        return await handler(event, data)


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


def send_keys_to_pane(text: str) -> None:
    """Synchronous fallback (kept for non-async callers if any)."""
    subprocess.run(
        ["tmux", "send-keys", "-l", "-t", TMUX_TARGET, text],
        check=True, timeout=5,
    )
    subprocess.run(
        ["tmux", "send-keys", "-t", TMUX_TARGET, "Enter"],
        check=True, timeout=5,
    )


# --------------------------------------------------------------------------
# Sessions feature handlers (v5.1)
# Registered BEFORE the catch-all relay_inbound so they intercept matching
# messages and DO NOT forward to tmux (claude never sees /new_session etc.).
# --------------------------------------------------------------------------

@dp.message(Command("new_session"))
async def cmd_new_session(msg: Message, command: CommandObject) -> None:
    if msg.chat.id != ALLOWED_CHAT:
        log.warning("rejected /new_session from chat_id=%s", msg.chat.id)
        return
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
        cmd_id = write_command_atomic("new", operator_chat_id=msg.chat.id)
    except (OSError, ValueError) as exc:
        log.error("write_command_atomic failed: %s", exc)
        await msg.reply(f"❌ Failed to queue command: {exc}")
        return
    log.info("/new_session queued cmd_id=%s; killing tmux", cmd_id)
    kill_tmux_gracefully(TMUX_TARGET)
    await msg.reply("🔄 Killing god-session — fresh context will start in ~5–10s.")


@dp.message(Command("sessions"))
async def cmd_sessions(msg: Message, command: CommandObject) -> None:
    if msg.chat.id != ALLOWED_CHAT:
        log.warning("rejected /sessions from chat_id=%s", msg.chat.id)
        return
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
        async with session_lock(sid):
            if path.exists():
                with contextlib.suppress(OSError):
                    path.unlink()
        await msg.reply(f"✓ Deleted `{sid[:8]}…`.")
        return

    show_all = args == "all"
    sessions = list_sessions(limit=None if show_all else SESSIONS_TOP_N)
    if not sessions:
        await msg.reply("📭 No sessions found yet for this project.")
        return

    if show_all:
        lines = [
            f"• `{s['sid'][:8]}` *{s['slug']}* — {fmt_ts(s['ts'])}"
            for s in sessions
        ]
        body = "\n".join(lines)
        footer = "\n\nDelete: `/sessions delete <id>`"
        await msg.reply(
            f"All sessions ({len(sessions)}):\n{body}{footer}",
            parse_mode="Markdown",
        )
        return

    total = len(list_sessions(limit=None))
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
    if query.message is None or query.message.chat.id != ALLOWED_CHAT:
        await query.answer("forbidden", show_alert=True)
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
                write_command_atomic(
                    "resume", session_id=sid, operator_chat_id=query.from_user.id,
                )
            except (OSError, ValueError) as exc:
                log.error("write_command_atomic resume failed: %s", exc)
                await query.answer(f"failed: {exc}", show_alert=True)
                return
            kill_tmux_gracefully(TMUX_TARGET)
            log.info("[Resume] queued sid=%s", sid)
            with contextlib.suppress(TelegramAPIError):
                await query.message.edit_text(
                    f"🔄 Resuming `{sid[:8]}…` — pane will reload in ~5–10s.",
                    parse_mode="Markdown",
                    reply_markup=None,
                )
        elif action == "s_del":
            with contextlib.suppress(OSError):
                path.unlink()
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


@dp.message()
async def relay_inbound(msg: Message) -> None:
    if msg.chat.id != ALLOWED_CHAT:
        log.warning("rejected non-allowed chat_id=%s", msg.chat.id)
        return
    text = (msg.text or msg.caption or "").strip()
    if not text:
        return
    inbound_id = insert_inbound(text, msg.chat.id, msg.message_id)
    log.info(
        "INBOUND #%d %d chars chat=%s tg_msg=%s",
        inbound_id, len(text), msg.chat.id, msg.message_id,
    )
    pane_text = f"[tg id={msg.chat.id}:{msg.message_id}] {text}"
    try:
        await send_keys_to_pane_async(pane_text)
        update_message(inbound_id, status="delivered")
    except (RuntimeError, asyncio.TimeoutError, OSError) as exc:
        update_message(inbound_id, status="failed", error=str(exc)[:300])
        log.error("send-keys ultimately failed (after retries): %s", exc)
        # Tell the operator their message was lost so they retry.
        try:
            await msg.reply(
                "⚠️ Не смог доставить твоё сообщение в pane "
                "(tmux недоступен дольше ~12с — обычно после "
                "/new_session или Resume). Попробуй ещё раз через 10–15с."
            )
        except TelegramAPIError as reply_exc:
            log.error("failed to notify operator about drop: %s", reply_exc)


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

    audit_id = db().execute(
        "INSERT INTO messages (ts, direction, status, text, session_id, replied_to_id) "
        "VALUES (?, 'outbound', 'queued', ?, ?, ?)",
        (now_ts(), last_msg, session_id, pending["inbound_msg_id"]),
    ).lastrowid

    outbox_id = enqueue_outbox(
        last_msg, ALLOWED_CHAT,
        replied_to_id=pending["inbound_msg_id"],
        session_id=session_id, audit_msg_id=audit_id,
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
        enqueue_outbox(
            f"⚠️ Claude turn failed: {error_type}",
            ALLOWED_CHAT,
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

    upsert_session(
        session_id, source=source, model=model, cwd=cwd,
        transcript_path=transcript_path, previous_session=previous_session,
    )
    insert_session_event(session_id, "session_start", {
        "source": source, "model": model, "previous": previous_session,
    })
    log.info(
        "HOOK session-start: session=%s source=%s model=%s prev=%s",
        session_id[:8], source, model, (previous_session or "")[:8],
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
    cur = db().execute(
        "SELECT session_id FROM sessions WHERE ended_at IS NULL "
        "ORDER BY started_at DESC LIMIT 1"
    )
    row = cur.fetchone()
    last_session = row["session_id"][:8] if row else None
    db_size = os.path.getsize(DB_PATH) if os.path.exists(DB_PATH) else 0
    return web.json_response({
        "ok": True,
        "version": "v3",
        "outbox_queued": queued,
        "outbox_abandoned": abandoned,
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
    app = make_app()
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, HOOK_HOST, HOOK_PORT)
    await site.start()
    log.info(
        "claude-relay-bot v3 up: chat=%s tmux=%s:%s hooks=%s:%d db=%s",
        ALLOWED_CHAT, TMUX_USER, TMUX_TARGET, HOOK_HOST, HOOK_PORT, DB_PATH,
    )

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
        worker_task.cancel()
        alerter_task.cancel()
        await runner.cleanup()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log.info("interrupted, exiting")
        sys.exit(0)
