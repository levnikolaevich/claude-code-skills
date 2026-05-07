export type ServiceErrorKind =
  | "validation"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "transient"
  | "permanent"
  | "invariant";

export interface ServiceError {
  code: string;
  kind: ServiceErrorKind;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
  cause?: string;
}

export type ServiceOutcome<T, E extends ServiceError = ServiceError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): ServiceOutcome<T, never> {
  return { ok: true, value };
}

export function okVoid(): ServiceOutcome<void, never> {
  return { ok: true, value: undefined };
}

export function fail<E extends ServiceError>(error: E): ServiceOutcome<never, E> {
  return { ok: false, error };
}

export function isOk<T, E extends ServiceError>(
  outcome: ServiceOutcome<T, E>
): outcome is { ok: true; value: T } {
  return outcome.ok;
}

export function mapError<T, E extends ServiceError, E2 extends ServiceError>(
  outcome: ServiceOutcome<T, E>,
  mapper: (error: E) => E2
): ServiceOutcome<T, E2> {
  return outcome.ok ? outcome : fail(mapper(outcome.error));
}

export function unwrapOrThrowInvariant<T, E extends ServiceError>(
  outcome: ServiceOutcome<T, E>
): T {
  if (outcome.ok) return outcome.value;
  if (outcome.error.kind === "invariant") {
    throw new Error(outcome.error.message);
  }
  throw new Error(`unexpected non-invariant outcome: ${outcome.error.code}`);
}

export function serviceError(args: {
  code: string;
  kind: ServiceErrorKind;
  message: string;
  retryable?: boolean;
  details?: Record<string, unknown>;
  cause?: unknown;
}): ServiceError {
  return {
    code: args.code,
    kind: args.kind,
    message: args.message,
    retryable: args.retryable ?? (args.kind === "transient" || args.kind === "rate_limited"),
    details: args.details,
    cause: args.cause === undefined ? undefined : causeToString(args.cause),
  };
}

function causeToString(cause: unknown): string {
  if (cause instanceof Error) return cause.message;
  if (typeof cause === "string") return cause;
  if (typeof cause === "number" || typeof cause === "boolean" || typeof cause === "bigint") {
    return String(cause);
  }
  try {
    return JSON.stringify(cause) ?? Object.prototype.toString.call(cause);
  } catch {
    return Object.prototype.toString.call(cause);
  }
}
