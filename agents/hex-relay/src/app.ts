import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { Composer } from "grammy";
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
import { createGodErrorReader } from "./infrastructure/filesystem/godError.js";
import { createMediaStore } from "./infrastructure/filesystem/mediaStore.js";
import { createLastGodCommandReader } from "./infrastructure/filesystem/lastGodCommand.js";
import { createLocalVoiceTranscriber } from "./infrastructure/process/localVoiceTranscriber.js";
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
import { createTaskProviderService } from "./services/taskProvider.service.js";
import { createTaskService } from "./services/task.service.js";
import { buildAllowlistMiddleware } from "./handlers/telegram/allowlist.middleware.js";
import { buildNewSessionHandler } from "./handlers/telegram/newSession.js";
import { buildSessionsHandler } from "./handlers/telegram/sessions.js";
import { buildSessionsCallbackHandler } from "./handlers/telegram/sessionsCallback.js";
import { buildUsersHandler } from "./handlers/telegram/users.js";
import { buildUsersCallbackHandler } from "./handlers/telegram/usersCallback.js";
import { buildTasksHandler } from "./handlers/telegram/tasks.js";
import { buildTasksCallbackHandler } from "./handlers/telegram/tasksCallback.js";
import { buildInboundHandler } from "./handlers/telegram/inbound.js";
import { createReactToInbound, createReactToVoiceTranscribing } from "./handlers/telegram/react.js";
import { registerErrorHandler } from "./handlers/http/plugins/errorHandler.plugin.js";
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

  const controlLane = createControlLane();
  const sessionLocks = new MutexMap();
  const godRuntime = createGodRuntimeService({ env, log, godStatus });

  const outbox = createOutboxService({ outboxRepo: repos.outbox, log });
  const verbosity = createVerbosityService(env.verbosity);
  const allowlist = createAllowlistService({
    log,
    usersRepo: repos.users,
    primaryOperator: env.allowedChat,
  });
  const sessionService = createSessionService({
    log,
    sessionsRepo: repos.sessions,
    sessionEventsRepo: repos.sessionEvents,
    sessionsDir,
    lastGodCommand,
    lastSessionForUser: (userId) => godRuntime.runtimeFor(userId).lastSession,
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
  const taskProvider = createTaskProviderService({ env, log });
  const tasks = createTaskService({
    env,
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
  const inboundHandler = buildInboundHandler({
    log,
    messagesRepo: repos.messages,
    mediaStore,
    voiceTranscription: env.voiceTranscription,
    voiceMaxDurationSec: env.voiceMaxDurationSec,
    reactToVoiceTranscribing: verbosity.allows("L1") ? reactToVoiceTranscribing : undefined,
  });
  bot.use(newSessionHandler);
  bot.use(sessionsHandler);
  bot.use(sessionsCallback);
  bot.use(usersHandler);
  bot.use(usersCallback);
  bot.use(tasksHandler);
  bot.use(tasksCallback);
  bot.use(inboundHandler);

  void Composer;

  const httpServer: FastifyInstance = Fastify({
    logger: false,
    bodyLimit: 1 * 1024 * 1024,
  });
  configureZodFastify(httpServer);
  registerErrorHandler(httpServer, log);
  registerHookRoutes(httpServer, {
    log,
    messagesRepo: repos.messages,
    pendingRepo: repos.pendingReply,
    sessionsRepo: repos.sessions,
    outbox,
    sessionService,
    todoDiff,
    memory,
    dispatch,
    verbosity,
    primaryOperator: env.allowedChat,
    dbPath: env.dbPath,
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

  let started = false;
  let pollPromise: Promise<void> | null = null;

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
      pollPromise = bot
        .start({
          drop_pending_updates: false,
        })
        .catch((error: unknown) => {
          if (!started) return;
          log.error({ err: String(error) }, "telegram polling stopped unexpectedly");
          process.exit(1);
        });
    },
    async stop() {
      if (!started) return;
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
      inboundWorker.stop();
      voiceTranscriptionWorker.stop();
      outboxWorker.stop();
      errorAlerterWorker.stop();
      mediaCleanupWorker.stop();
      try {
        await httpServer.close();
      } catch (error) {
        log.warn({ err: String(error) }, "http close failed");
      }
      closeDb(db);
      log.info("shutdown complete");
    },
  };
}
