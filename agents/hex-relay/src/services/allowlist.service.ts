import type { Logger } from "../lib/logger.js";
import type { AuthRejectCommand, UsersRepository, UserUpsertCommand } from "./ports.js";
import type { AllowedUserStatus, AllowedUserRow } from "../domain/user.js";

export type AllowlistService = ReturnType<typeof createAllowlistService>;

export function createAllowlistService(deps: {
  log: Logger;
  usersRepo: UsersRepository;
  primaryOperator: number;
}) {
  let cache = new Map<number, AllowedUserStatus>();

  function refresh(): void {
    try {
      cache = deps.usersRepo.allowlistCacheSnapshot();
      deps.log.info({ entries: cache.size }, "allowlist cache refreshed");
    } catch (error) {
      deps.log.error({ err: String(error) }, "refresh_allowlist_cache failed");
    }
  }

  function bootstrap(): void {
    deps.usersRepo.upsert({
      userId: deps.primaryOperator,
      username: null,
      status: "allowed",
      addedBy: null,
      notes: "primary operator (bootstrap)",
    });
    refresh();
  }

  function status(userId: number): AllowedUserStatus | undefined {
    return cache.get(userId);
  }

  function isPrimary(userId: number | null | undefined): boolean {
    return userId !== null && userId !== undefined && userId === deps.primaryOperator;
  }

  function upsertUser(args: UserUpsertCommand): void {
    deps.usersRepo.upsert(args);
    refresh();
  }

  function deleteUser(userId: number): number {
    const n = deps.usersRepo.delete(userId);
    refresh();
    return n;
  }

  return {
    bootstrap,
    refresh,
    status,
    isPrimary,
    primaryOperator: deps.primaryOperator,
    insertAuthReject(args: AuthRejectCommand): void {
      try {
        deps.usersRepo.insertAuthReject(args);
      } catch (error) {
        deps.log.error({ err: String(error) }, "insert_auth_reject failed");
      }
    },
    markPendingNotified(userId: number): void {
      deps.usersRepo.markPendingNotified(userId);
    },
    getRow(userId: number): AllowedUserRow | null {
      return deps.usersRepo.getRow(userId);
    },
    list(): AllowedUserRow[] {
      return deps.usersRepo.list();
    },
    upsertUser,
    deleteUser,
  };
}
