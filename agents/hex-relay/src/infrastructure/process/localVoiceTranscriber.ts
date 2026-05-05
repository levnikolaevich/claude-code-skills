import { existsSync, unlinkSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, parse } from "node:path";
import { runProcess, type RunProcessResult } from "./runProcess.js";

export interface LocalVoiceTranscriberConfig {
  ffmpegBin: string;
  whisperCppBin: string;
  whisperCppModel: string;
  timeoutMs: number;
}

export interface VoiceTranscript {
  text: string;
}

export type ProcessRunner = (
  cmd: string,
  args: string[],
  options: { timeoutMs: number; label?: string }
) => Promise<RunProcessResult>;

export type LocalVoiceTranscriber = ReturnType<typeof createLocalVoiceTranscriber>;

function cleanup(path: string): void {
  try {
    if (existsSync(path)) unlinkSync(path);
  } catch {
    /* ignore temp cleanup */
  }
}

export function normalizeTranscript(raw: string): string {
  return raw
    .split(/\r?\n/)
    .map((line) => line.replace(/^\[[\d:.,\s>-]+\]\s*/, "").trim())
    .filter((line) => line.length > 0)
    .join(" ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

export function createLocalVoiceTranscriber(
  config: LocalVoiceTranscriberConfig,
  runner: ProcessRunner = runProcess
) {
  return {
    async transcribe(inputPath: string): Promise<VoiceTranscript> {
      const parsed = parse(inputPath);
      const workDir = dirname(inputPath);
      const wavPath = join(workDir, `${parsed.name}.16k.wav`);
      const outBase = join(workDir, `${parsed.name}.transcript`);
      const outTxt = `${outBase}.txt`;
      cleanup(wavPath);
      cleanup(outTxt);

      try {
        const ffmpeg = await runner(
          config.ffmpegBin,
          ["-y", "-i", inputPath, "-ac", "1", "-ar", "16000", "-vn", wavPath],
          { timeoutMs: config.timeoutMs, label: "ffmpeg voice normalize" }
        );
        if (ffmpeg.code !== 0) {
          throw new Error(`ffmpeg failed: ${ffmpeg.stderr.slice(0, 500)}`);
        }

        const whisper = await runner(
          config.whisperCppBin,
          [
            "-m",
            config.whisperCppModel,
            "-f",
            wavPath,
            "-l",
            "auto",
            "-otxt",
            "-of",
            outBase,
            "-nt",
            "-bs",
            "1",
            "-bo",
            "1",
          ],
          { timeoutMs: config.timeoutMs, label: "whisper.cpp voice transcribe" }
        );
        if (whisper.code !== 0) {
          throw new Error(`whisper.cpp failed: ${whisper.stderr.slice(0, 500)}`);
        }

        const raw = existsSync(outTxt) ? await readFile(outTxt, "utf8") : whisper.stdout;
        const text = normalizeTranscript(raw);
        if (!text) {
          throw new Error("empty voice transcript");
        }
        return { text };
      } finally {
        cleanup(wavPath);
        cleanup(outTxt);
      }
    },
  };
}
