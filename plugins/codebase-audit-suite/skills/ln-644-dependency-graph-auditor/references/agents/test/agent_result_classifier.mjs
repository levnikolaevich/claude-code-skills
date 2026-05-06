#!/usr/bin/env node

import {
    AGENT_FAILURE_CLASSES,
    classifyAgentResult,
} from "../agent_result_classifier.mjs";

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

const success = classifyAgentResult({
    success: true,
    response: "done",
    sessionId: "session-1",
});
assert(success.failure_class === AGENT_FAILURE_CLASSES.NONE, "success should classify as none");
assert(success.session_usable === true, "successful captured session should be usable");

const idleTimeout = classifyAgentResult({
    success: false,
    timedOut: true,
});
assert(idleTimeout.failure_class === AGENT_FAILURE_CLASSES.TIMEOUT_IDLE, "idle timeout should classify");

const productiveTimeout = classifyAgentResult({
    success: false,
    timedOut: true,
    outputWritten: true,
});
assert(productiveTimeout.failure_class === AGENT_FAILURE_CLASSES.TIMEOUT_PRODUCTIVE, "productive timeout should classify");

const permission = classifyAgentResult({
    success: false,
    error: "Permission denied by sandbox",
});
assert(permission.failure_class === AGENT_FAILURE_CLASSES.PERMISSION_DENIAL, "permission denial should classify");
assert(permission.session_usable === false, "failed session should not be usable");

const toolMissing = classifyAgentResult({
    success: false,
    error: "Command 'codex' not found in PATH",
    exitCode: -1,
});
assert(toolMissing.failure_class === AGENT_FAILURE_CLASSES.TOOL_MISSING, "tool missing should classify");

const authMissing = classifyAgentResult({
    success: false,
    rawStderr: "Authentication required: not logged in",
});
assert(authMissing.failure_class === AGENT_FAILURE_CLASSES.AUTH_MISSING, "auth missing should classify");

const rateLimited = classifyAgentResult({
    success: false,
    rawStderr: "429 Too Many Requests, retry after 30s",
});
assert(rateLimited.failure_class === AGENT_FAILURE_CLASSES.RATE_LIMITED, "rate limit should classify");

const question = classifyAgentResult({
    success: false,
    response: "Which option should I use?",
});
assert(question.failure_class === AGENT_FAILURE_CLASSES.ASKED_QUESTION, "agent question should classify");

process.stdout.write("agent result classifier tests passed\n");
