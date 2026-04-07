export function textResult(text) {
    return { content: [{ type: "text", text }] };
}

export function errorResult(text) {
    return { content: [{ type: "text", text }], isError: true };
}

export function jsonResult(value, options = {}) {
    const { pretty = false } = options;
    return textResult(JSON.stringify(value, null, pretty ? 2 : 0));
}
