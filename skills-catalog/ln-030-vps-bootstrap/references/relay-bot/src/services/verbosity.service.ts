import { verbosityAllows, type Layer, type Verbosity } from "../domain/verbosity.js";

export type VerbosityService = ReturnType<typeof createVerbosityService>;

export function createVerbosityService(level: Verbosity) {
  return {
    allows(layer: Layer): boolean {
      return verbosityAllows(level, layer);
    },
    level,
  };
}
