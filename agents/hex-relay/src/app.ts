import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import type { Env } from "./config/env.js";
import { loadBuildInfo } from "./config/buildInfo.js";
import { buildPaths, buildUserRuntimePaths } from "./config/paths.js";
import { createLogger, type Logger } from "./lib/logger.js";
import { MutexMap } from "./lib/mutex.js";
import { closeDb, createDb } from "./infrastructure/db/client.js";
import { createRepositories } from "./infrastructure/db/repositories/index.js";
import { createTelegramClient } from "./infrastructure/telegram/client.js";
import { createGodStatusProbe } from "./infrastructure/systemd/godStatus.js";
import { createSessionsDirCache } from "./infrastructure/filesystem/sessionsDirCache.js";
import { createSessionTranscriptStore } from "./infrastructure/filesystem/sessionTranscriptStore.js";
import { createGodErrorReader } from "./infrastructure/filesystem/godError.js";
import { createMediaStore } from "./infrastructure/filesystem/mediaStore.js";
import { createLastGodCommandReader } from "./infrastructure/filesystem/lastGodCommand.js";
import { createAtomicCommandWriter } from "./infrastructure/filesystem/atomicCommand.js";
import { createLastSessionWriter } from "./infrastructure/filesystem/lastSession.js";
import { createTmuxPane } from "./infrastructure/tmux/pane.js";
import { createLocalVoiceTranscriber } from "./infrastructure/process/localVoiceTranscriber.js";
import { createTaskProviderClient } from "./infrastructure/providers/taskProviderClient.js";
import { TIMING } from "./config/paths.js";
import { createControlLane } from "./services/controlLane.service.js";
import { createOutboxService } from "./services/outbox.service.js";
import { createSessionService } from "./services/session.service.js";
import { createInboundService } from "./services/inbound.service.js";
import { createGodRuntimeService } from "./services/godRuntime.service.js";
import { createDispatchService } from "./services/dispatch.service.js";
import { createMemoryService } from "./services/memory.service.js";
import { createAllowlistService } from "./services/allowlist.service.js";
import { createTodoDiffService } from "./services/todoDiff.service.js";
import { createVerbosityService } from "./services/verbosity.service.js";
import { createTypingService } from "./services/typing.service.js";
import { createTaskService } from "./services/task.service.js";
import { createUserBuddyService } from "./services/userBuddy.service.js";
import { createHookIngestionService } from "./services/hookIngestion.service.js";
import { createTelegramInboundCaptureService } from "./services/telegramInboundCapture.service.js";
import { buildAllowlistMiddleware } from "./handlers/telegram/allowlist.middleware.js";
import { buildNewSessionHandler } from "./handlers/telegram/newSession.js";
import { buildSessionsHandler } from "./handlers/telegram/sessions.js";
import { buildSessionsCallbackHandler } from "./handlers/telegram/sessionsCallback.js";
import { buildUsersHandler } from "./handlers/telegram/users.js";
import { buildUsersCallbackHandler } from "./handlers/telegram/usersCallback.js";
import { buildTasksHandler } from "./handlers/telegram/tasks.js";
import { buildTasksCallbackHandler } from "./handlers/telegram/tasksCallback.js";
import { buildInboundHandler } from "./handlers/telegram/inbound.js";
import { buildSetBuddyHandler } from "./handlers/telegram/setBuddy.js";
import { buildUsageHandler } from "./handlers/telegram/usage.js";
import { createReactToInbound, createReactToVoiceTranscribing } from "./handlers/telegram/react.js";
import { registerErrorHandler } from "./handlers/http/plugins/errorHandler.plugin.js";
import { registerBearerAuth } from "./handlers/http/plugins/auth.plugin.js";
import { registerRequestContext } from "./handlers/http/plugins/requestContext.plugin.js";
import { configureZodFastify } from "./handlers/http/zodFastify.js";
import { registerHookRoutes } from "./handlers/http/hooks.routes.js";
import { registerDispatchRoutes } from "./handlers/http/dispatch.routes.js";
import { registerTaskRoutes } from "./handlers/http/tasks.routes.js";
import { registerMemoryRoutes } from "./handlers/http/memory.routes.js";
import { registerHealthRoutes } from "./handlers/http/health.routes.js";
import { createInboundWorker } from "./workers/inbound.worker.js";
import { createOutboxWorker } from "./workers/outbox.worker.js";
import { createErrorAlerterWorker } from "./workers/errorAlerter.worker.js";
import { createMediaCleanupWorker } from "./workers/mediaCleanup.worker.js";
import { createVoiceTranscriptionWorker } from "./workers/voiceTranscription.worker.js";
import { createIdleSessionService } from "./services/idleSession.service.js";
import { createIdleSessionWorker } from "./workers/idleSession.worker.js";
import { createPendingReplyGcWorker } from "./workers/pendingReplyGc.worker.js";
import { runProcess } from "./infrastructure/process/runProcess.js";
import { readCodexRateLimitsJson } from "./infrastructure/process/codexAppServerClient.js";
import { unwrapOrThrowInvariant } from "./services/outcome.js";

export interface App {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export function buildApp(env: Env, log: Logger = createLogger()): App {
  const paths = buildPaths(env);
  const buildInfo = loadBuildInfo();

  const sessionsDir = createSessionsDirCache({
    cacheFileForUser: (userId) => buildUserRuntimePaths(env, userId).sessionsDirCacheFile,
    claudeProjectsHomeForUser: (userId) => buildUserRuntimePaths(env, userId).claudeProjectsHome,
    projectDir: env.projectDir,
    log,
  });

  const db = createDb({
    dbPath: env.dbPath,
    log,
    primaryOperator: env.allowedChat,
    sessionsDir: () => sessionsDir.get(env.allowedChat),
  });
  const repos = createRepositories(db);

  const bot = createTelegramClient({ token: env.tgToken });
  const godStatus = createGodStatusProbe({
    env,
    log,
  });
  const godError = createGodErrorReader(paths.errorFile, log);
  const lastGodCommand = createLastGodCommandReader({
    usersDir: `${paths.stateDir}/users`,
    ttlSec: TIMING.lastCmdTtlSec,
    log,
  });
  const transcriptStore = createSessionTranscriptStore({ log, sessionsDir });

  const controlLane = createControlLane();
  const sessionLocks = new MutexMap();
  const godRuntime = createGodRuntimeService({
    runtimePaths: {
      forUser: (userId, agent) => buildUserRuntimePaths(env, userId, agent),
    },
    godStatus,
    adapters: {
      pane: (runtimePaths) =>
        createTmuxPane({
          target: runtimePaths.tmuxTarget,
          socketName: env.tmuxSocketName,
          log,
        }),
      atomicCommand: (runtimePaths) =>
        createAtomicCommandWriter({
          cmdFile: runtimePaths.cmdFile,
          stateDir: runtimePaths.userStateDir,
          log,
        }),
      lastSession: (runtimePaths) =>
        createLastSessionWriter({
          filePath: runtimePaths.lastSessionFile,
          log,
        }),
    },
  });

  const outbox = createOutboxService({ outboxRepo: repos.outbox, log });
  const verbosity = createVerbosityService(env.verbosity);
  const typing = createTypingService({ bot, log });
  const allowlist = createAllowlistService({
    log,
    usersRepo: repos.users,
    primaryOperator: env.allowedChat,
  });
  const userBuddy = createUserBuddyService({ repo: repos.userBuddy });
  const sessionService = createSessionService({
    log,
    sessionsRepo: repos.sessions,
    sessionEventsRepo: repos.sessionEvents,
    transcriptStore,
    lastGodCommand,
    lastSessionForUser: (userId, agent) =>
      unwrapOrThrowInvariant(godRuntime.runtimeFor(userId, agent)).lastSession,
    primaryOperator: env.allowedChat,
  });
  const reactToInbound = createReactToInbound({
    bot,
    log,
    reactions: env.inboundReactions,
  });
  const reactToVoiceTranscribing = createReactToVoiceTranscribing({
    bot,
    log,
    reactions: env.inboundReactions,
  });
  const mediaStore = createMediaStore({
    log,
    mediaDir: paths.mediaDir,
    botToken: env.tgToken,
  });
  const voiceTranscriber =
    env.voiceTranscription === "local"
      ? createLocalVoiceTranscriber({
          ffmpegBin: env.ffmpegBin,
          whisperCppBin: env.whisperCppBin,
          whisperCppModel: env.whisperCppModel,
          timeoutMs: env.voiceTranscribeTimeoutSec * 1000,
        })
      : null;
  const inboundService = createInboundService({
    log,
    messagesRepo: repos.messages,
    outboxService: outbox,
    controlLane,
    godRuntime,
    verbosity,
    reactToInbound,
  });
  const dispatch = createDispatchService({ repo: repos.dispatch });
  const memory = createMemoryService({ repo: repos.memory });
  const todoDiff = createTodoDiffService({ log, repo: repos.todoState });
  const hookIngestion = createHookIngestionService({
    log,
    messagesRepo: repos.messages,
    pendingRepo: repos.pendingReply,
    outbox,
    sessionService,
    todoDiff,
    memory,
    dispatch,
    verbosity,
    typing,
    primaryOperator: env.allowedChat,
    dbPath: env.dbPath,
  });
  const telegramInboundCapture = createTelegramInboundCaptureService({
    log,
    messagesRepo: repos.messages,
    userBuddy,
    voiceTranscription: env.voiceTranscription,
    voiceMaxDurationSec: env.voiceMaxDurationSec,
    reactToVoiceTranscribing: verbosity.allows("L1") ? reactToVoiceTranscribing : undefined,
  });
  const taskProvider = createTaskProviderClient({ env, log });
  const tasks = createTaskService({
    config: {
      allowedChat: env.allowedChat,
      gitProvider: env.gitProvider,
    },
    log,
    provider: taskProvider,
    outbox,
    messagesRepo: repos.messages,
    taskPollState: repos.taskPollState,
    inbound: inboundService,
  });

  // wire telegram middleware + handlers (catch-all inbound LAST)
  const allowlistMw = buildAllowlistMiddleware({ bot, log, allowlist });
  bot.use(allowlistMw);
  const newSessionHandler = buildNewSessionHandler({
    log,
    controlLane,
    godRuntime,
  });
  const sessionsHandler = buildSessionsHandler({
    log,
    sessionService,
    controlLane,
    sessionLocks,
  });
  const sessionsCallback = buildSessionsCallbackHandler({
    log,
    sessionService,
    controlLane,
    sessionLocks,
    godRuntime,
  });
  const usersHandler = buildUsersHandler({ log, allowlist });
  const usersCallback = buildUsersCallbackHandler({ log, bot, allowlist });
  const tasksHandler = buildTasksHandler({ log, tasks });
  const tasksCallback = buildTasksCallbackHandler({ log, tasks });
  const setBuddyHandler = buildSetBuddyHandler({ log, userBuddy });
  const usageHandler = buildUsageHandler({
    log,
    godRuntime,
    messagesRepo: repos.messages,
    userBuddy,
    runClaudeUsageReport: async () => {
      const result = await runProcess("/usr/local/bin/claude-usage-report", [], {
        timeoutMs: 5000,
        label: "claude-usage-report",
      });
      if (result.code !== 0) {
        throw new Error(
          `claude-usage-report exit ${result.code}: ${result.stderr.trim().slice(0, 200) || "no stderr"}`
        );
      }
      return result.stdout.trim();
    },
    runCodexUsageReport: async () => {
      return readCodexRateLimitsJson({ timeoutMs: 10_000 });
    },
  });
  const inboundHandler = buildInboundHandler({
    log,
    mediaStore,
    capture: telegramInboundCapture,
  });
  bot.use(newSessionHandler);
  bot.use(sessionsHandler);
  bot.use(sessionsCallback);
  bot.use(usersHandler);
  bot.use(usersCallback);
  bot.use(tasksHandler);
  bot.use(tasksCallback);
  bot.use(setBuddyHandler);
  bot.use(usageHandler);
  bot.use(inboundHandler);

  const httpServer: FastifyInstance = Fastify({
    logger: false,
    bodyLimit: 1 * 1024 * 1024,
  });
  configureZodFastify(httpServer);
  registerRequestContext(httpServer, log);
  registerErrorHandler(httpServer, log);
  registerBearerAuth(httpServer, {
    token: env.httpToken,
    protectedPrefixes: ["/hook", "/tasks", "/dispatch", "/memory"],
  });
  registerHookRoutes(httpServer, {
    hookIngestion,
  });
  registerDispatchRoutes(httpServer, { log, dispatch });
  registerTaskRoutes(httpServer, { log, tasks });
  registerMemoryRoutes(httpServer, { log, memory });
  registerHealthRoutes(httpServer, {
    outboxRepo: repos.outbox,
    messagesRepo: repos.messages,
    pendingRepo: repos.pendingReply,
    sessionsRepo: repos.sessions,
    controlLane,
    godStatus,
    dbPath: env.dbPath,
    ...buildInfo,
  });

  const inboundWorker = createInboundWorker({ log, service: inboundService });
  const voiceTranscriptionWorker = createVoiceTranscriptionWorker({
    log,
    messagesRepo: repos.messages,
    outbox,
    transcriber: voiceTranscriber,
  });
  const outboxWorker = createOutboxWorker({ log, bot, outbox });
  const errorAlerterWorker = createErrorAlerterWorker({
    log,
    bot,
    reader: godError,
    primaryOperator: env.allowedChat,
  });
  const mediaCleanupWorker = createMediaCleanupWorker({
    log,
    mediaDir: paths.mediaDir,
  });
  const idleSessionService = env.idleShutdownEnabled
    ? createIdleSessionService({
        log,
        godStatus,
        messagesRepo: repos.messages,
        pendingRepo: repos.pendingReply,
        controlLane,
        idleThresholdSec: env.idleShutdownSec,
        bootGraceSec: env.idleBootGraceSec,
        bootTimestampSec: Math.floor(Date.now() / 1000),
      })
    : null;
  const idleSessionWorker = idleSessionService
    ? createIdleSessionWorker({
        log,
        service: idleSessionService,
        tickIntervalMs: env.idleTickSec * 1000,
      })
    : null;
  const pendingReplyGcWorker = createPendingReplyGcWorker({
    log,
    pendingRepo: repos.pendingReply,
    messagesRepo: repos.messages,
    outbox,
    primaryOperator: env.allowedChat,
    retentionSec: TIMING.pendingReplyRetentionSec,
    tickIntervalMs: TIMING.pendingReplyGcTickMs,
  });
  let started = false;
  let pollPromise: Promise<void> | null = null;

  async function stopApp(markFatal = false): Promise<void> {
    if (!started) {
      if (markFatal) process.exitCode = 1;
      return;
    }
    if (markFatal) process.exitCode = 1;
    started = false;
    log.info("stopping bot polling");
    try {
      await bot.stop();
    } catch (error) {
      log.warn({ err: String(error) }, "bot.stop failed");
    }
    if (pollPromise) {
      await pollPromise;
      pollPromise = null;
    }
    try {
      await httpServer.close();
    } catch (error) {
      log.warn({ err: String(error) }, "http close failed");
    }
    const stopResults = await Promise.allSettled([
      inboundWorker.stop(),
      voiceTranscriptionWorker.stop(),
      outboxWorker.stop(),
      errorAlerterWorker.stop(),
      mediaCleanupWorker.stop(),
      ...(idleSessionWorker ? [idleSessionWorker.stop()] : []),
      pendingReplyGcWorker.stop(),
    ]);
    for (const result of stopResults) {
      if (result.status === "rejected") {
        process.exitCode = 1;
        log.warn({ err: String(result.reason) }, "worker stop failed");
      }
    }
    typing.stopAll();
    closeDb(db);
    log.info("shutdown complete");
  }

  return {
    async start() {
      if (started) return;
      started = true;
      allowlist.bootstrap();
      await httpServer.listen({ host: env.hookHost, port: env.hookPort });
      log.info(
        {
          chat: env.allowedChat,
          tmuxSocket: env.tmuxSocketName,
          godServiceTemplate: paths.godServiceName,
          hook: `${env.hookHost}:${env.hookPort}`,
          db: env.dbPath,
        },
        "hex-relay up"
      );
      // fire-and-forget background loops
      void inboundWorker.start();
      void voiceTranscriptionWorker.start();
      void outboxWorker.start();
      void errorAlerterWorker.start();
      void mediaCleanupWorker.start();
      if (idleSessionWorker) void idleSessionWorker.start();
      void pendingReplyGcWorker.start();
      pollPromise = bot
        .start({
          drop_pending_updates: false,
        })
        .catch(async (error: unknown) => {
          if (!started) return;
          log.error({ err: String(error) }, "telegram polling stopped unexpectedly");
          pollPromise = null;
          await stopApp(true);
        });
    },
    async stop() {
      await stopApp(false);
    },
  };
}
