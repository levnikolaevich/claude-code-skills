import { join } from "node:path";
import { environmentStateSchema } from "./schemas.mjs";
import { readJsonFile } from "./core.mjs";
import { assertSchema } from "./validate.mjs";

export function environmentStatePath(projectRoot) {
    return join(projectRoot || process.cwd(), ".hex-skills", "environment_state.json");
}

export function loadEnvironmentState(projectRoot) {
    const filePath = environmentStatePath(projectRoot);
    const raw = readJsonFile(filePath);
    if (raw == null) {
        return {
            ok: true,
            exists: false,
            path: filePath,
            state: null,
        };
    }

    const validation = assertSchema(environmentStateSchema, raw, "environment state");
    if (!validation.ok) {
        return {
            ok: false,
            exists: true,
            path: filePath,
            error: validation.error,
            details: validation.details,
        };
    }

    return {
        ok: true,
        exists: true,
        path: filePath,
        state: raw,
    };
}

export function getDisabledAgents(projectRoot) {
    const loaded = loadEnvironmentState(projectRoot);
    if (!loaded.ok || !loaded.state?.agents) {
        return loaded;
    }

    const disabled = Object.entries(loaded.state.agents)
        .filter(([, config]) => config?.disabled === true)
        .map(([name]) => name);

    return {
        ...loaded,
        disabled_agents: disabled,
    };
}

export function getTaskProvider(projectRoot) {
    const loaded = loadEnvironmentState(projectRoot);
    if (!loaded.ok || !loaded.state) return "file";
    return loaded.state.task_management?.provider ?? "file";
}

export function getResearchChain(projectRoot) {
    const loaded = loadEnvironmentState(projectRoot);
    if (!loaded.ok || !loaded.state) return ["websearch"];
    return loaded.state.research?.fallback_chain ?? [loaded.state.research?.provider ?? "websearch"];
}
