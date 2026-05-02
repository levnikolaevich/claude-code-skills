export type Verbosity = "quiet" | "normal" | "verbose";
export type Layer = "L1" | "L2" | "L3" | "L4" | "L5" | "verbose_bash";

const ALLOWED: Record<Verbosity, Set<Layer>> = {
  quiet: new Set(["L1", "L4", "L5"]),
  normal: new Set(["L1", "L2", "L3", "L4", "L5"]),
  verbose: new Set(["L1", "L2", "L3", "L4", "L5", "verbose_bash"]),
};

export function verbosityAllows(v: Verbosity, layer: Layer): boolean {
  return ALLOWED[v].has(layer);
}
