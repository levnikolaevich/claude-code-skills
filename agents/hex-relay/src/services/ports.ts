import type { DispatchRun, DispatchPhaseStatus, DispatchRunStatus } from "../domain/dispatch.js";
import type {
  AgentKind,
  InboundMessage,
  MessageStatus,
  MessageKind,
  OutboxEventType,
  OutboxRow,
  PendingReply,
} from "../domain/message.js";
import type { MemoryRow } from "../domain/memory.js";
import type { SessionListItem } from "../domain/session.js";
import type { ProviderTask } from "../domain/task.js";
import type { TodoStateRow } from "../domain/todoState.js";
import type { AllowedUserRow, AllowedUserStatus } from "../domain/user.js";

export interface DispatchStartCommand {
  trigger: string;
  sessionId: string | null;
  issueNumber: number | null;
  issueTitle: string | null;
  budget5h: number | null;
  budgetWeek: number | null;
}

export interface DispatchPhaseCommand {
  runId: number;
  phase: string;
  status: DispatchPhaseStatus;
  verdict: string | null;
  details: string | null;
}

export interface DispatchEndCommand {
  status: DispatchRunStatus;
  prNumber: number | null;
  prUrl: string | null;
  branch: string | null;
  error: string | null;
}

export interface DispatchRepository {
  start(args: DispatchStartCommand): number;
  phase(args: DispatchPhaseCommand): void;
  end(runId: number, args: DispatchEndCommand): void;
  recent(n?: number): DispatchRun[];
}

export interface MemoryAddCommand {
  category: string;
  text: string;
  tags?: string | null;
  source?: string | null;
  expiresAt?: number | null;
}

export interface MemoryRepository {
  add(args: MemoryAddCommand): number;
  recent(limit: number, category: string | null): MemoryRow[];
  forget(memoryId: number | null, tagMatch: string | null): number;
  markUsed(ids: number[]): void;
}

export interface UserUpsertCommand {
  userId: number;
  username: string | null;
  status: AllowedUserStatus;
  addedBy: number | null;
  notes?: string | null;
}

export interface AuthRejectCommand {
  fromUserId: number | null;
  username: string | null;
  chatId: number | null;
  eventKind: string;
  textPreview: string | null;
}

export interface UsersRepository {
  allowlistCacheSnapshot(): Map<number, AllowedUserStatus>;
  upsert(args: UserUpsertCommand): void;
  delete(userId: number): number;
  insertAuthReject(args: AuthRejectCommand): void;
  markPendingNotified(userId: number): void;
  getRow(userId: number): AllowedUserRow | null;
  list(): AllowedUserRow[];
}

export interface MessageUpdateCommand {
  status?: MessageStatus;
  kind?: MessageKind;
  sessionId?: string | null;
  attempts?: number;
  nextAttemptAt?: number;
  deliveredAt?: number | null;
  error?: string | null;
  repliedToId?: number | null;
  text?: string;
  mediaPath?: string | null;
}

export interface MessageCounts {
  inboundQueued: number;
  inboundFailed: number;
  inboundRejected: number;
}

export interface MessagesRepository {
  insertInbound(
    text: string,
    tgChatId: number,
    tgMsgId: number,
    fromUserId: number,
    agent?: AgentKind
  ): number;
  update(msgId: number, fields: MessageUpdateCommand): void;
  selectDue(limit?: number): InboundMessage[];
  claimDue(limit?: number): InboundMessage[];
  findById(id: number): InboundMessage | null;
  findByTg(chatId: number, msgId: number): InboundMessage | null;
  getChatId(id: number): number | null;
  counts(): MessageCounts;
  lastActivityForUserAgent(userId: number, agent: AgentKind): number | null;
  hasActiveInboundForUserAgent(userId: number, agent: AgentKind): boolean;
}

export interface HookMessagesRepository {
  findByTg(chatId: number, msgId: number): InboundMessage | null;
  findById(id: number): InboundMessage | null;
  getChatId(id: number): number | null;
  update(msgId: number, fields: MessageUpdateCommand): void;
  insertOutboundAudit(
    text: string,
    sessionId: string,
    repliedToId: number | null,
    agent?: AgentKind
  ): number;
}

export interface TaskPollStateRepository {
  get(): { lastNotifiedAt: number | null; lastCount: number; updatedAt: number } | null;
  save(args: { lastNotifiedAt: number | null; lastCount: number }): void;
}

export interface PendingReplyRepository {
  hasOpenForUserAgent(userId: number, agent: AgentKind): boolean;
}

export interface HookPendingReplyRepository {
  get(sessionId: string): PendingReply | null;
  getAllForSession(sessionId: string): PendingReply[];
  set(sessionId: string, inboundMsgId: number, prompt: string, agent?: AgentKind): void;
  clear(sessionId: string): void;
  listOthers(currentSessionId: string): PendingReply[];
}

export interface TelegramInboundMessagesRepository {
  insertRejected(
    text: string,
    tgChatId: number,
    tgMsgId: number,
    error: string,
    agent?: AgentKind
  ): number;
  insertTranscribingVoice(
    tgChatId: number,
    tgMsgId: number,
    fromUserId: number,
    mediaPath: string,
    agent?: AgentKind
  ): number;
  insertInbound(
    text: string,
    tgChatId: number,
    tgMsgId: number,
    fromUserId: number,
    agent?: AgentKind
  ): number;
  update(msgId: number, fields: MessageUpdateCommand): void;
}

export interface OutboxEnqueueCommand {
  text: string;
  chatId: number;
  repliedToId: number | null;
  sessionId: string | null;
  auditMsgId: number | null;
  eventType: OutboxEventType;
  agent: AgentKind;
}

export interface OutboxRepository {
  enqueue(args: OutboxEnqueueCommand): number;
  selectDue(limit?: number): OutboxRow[];
  claimDue(limit?: number): OutboxRow[];
  update(id: number, fields: Partial<OutboxRow>): void;
  counts(): { queued: number; abandoned: number; unknown: number };
}

export interface TodoStateRepository {
  forSession(sessionId: string): Map<string, TodoStateRow>;
  upsertMany(sessionId: string, rows: TodoStateRow[]): void;
}

export interface UserBuddyRepository {
  get(userId: number): { agent: AgentKind } | null;
  set(userId: number, agent: AgentKind): void;
  remove(userId: number): void;
}

export interface GodInstance {
  userId: number;
  agent: AgentKind;
}

export interface GodStatusPort {
  isActive(userId: number, agent: AgentKind): Promise<boolean>;
  start(userId: number, agent: AgentKind): Promise<void>;
  restart(userId: number, agent: AgentKind): Promise<void>;
  stop(userId: number, agent: AgentKind): Promise<void>;
  isAnyActive(): Promise<boolean>;
  listActiveInstances(): Promise<GodInstance[]>;
}

export interface GodRuntimePaths {
  tmuxTarget: string;
  cmdFile: string;
  userStateDir: string;
  lastSessionFile: string;
}

export interface TmuxPanePort {
  send(text: string): Promise<void>;
  killGracefully(): Promise<void>;
  hasSession(): Promise<boolean>;
}

export interface AtomicCommandWriterPort {
  write(mode: string, sessionId: string | null, operatorUserId: number | null): void;
}

export interface LastSessionWriterPort {
  write(sid: string): void;
}

export interface GodRuntimeAdapters {
  pane(paths: GodRuntimePaths): TmuxPanePort;
  atomicCommand(paths: GodRuntimePaths): AtomicCommandWriterPort;
  lastSession(paths: GodRuntimePaths): LastSessionWriterPort;
}

export interface GodRuntimePathResolver {
  forUser(userId: number, agent: AgentKind): GodRuntimePaths;
}

export interface SessionRepository {
  allOwners(): Map<string, number | null>;
  getOwner(sessionId: string): number | null;
  upsert(args: {
    sessionId: string;
    source: string;
    model: string | null;
    cwd: string | null;
    transcriptPath: string | null;
    previousSession: string | null;
    createdByUserId?: number | null;
    agent?: AgentKind;
  }): void;
  lastActiveSid(ownerUserId?: number): string | null;
}

export interface SessionEventsRepository {
  insert(sessionId: string, kind: string, details?: Record<string, unknown>): void;
}

export interface LastGodCommandPort {
  consumeOwner(): number | null;
}

export interface SessionTranscriptStore {
  resolvePath(sessionId: string, ownerUserId: number | null): string | null;
  listSessions(ownerIds: number[], owners: Map<string, number | null>): SessionListItem[];
  deleteSessionFile(sessionId: string, ownerUserId: number | null): boolean;
  remember(ownerUserId: number, transcriptPath: string | null): void;
}

export interface TaskProviderPort {
  fetchOpenTasks(): Promise<ProviderTask[]>;
}
