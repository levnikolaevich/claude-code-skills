// Template Compliance Validation
// Used by story-planning and task-planning guards to enforce
// mandatory section structure before allowing phase transitions.

const STORY_SECTIONS = [
    "Story",
    "Context",
    "Acceptance Criteria",
    "Implementation Tasks",
    "Test Strategy",
    "Technical Notes",
    "Definition of Done",
    "Dependencies",
    "Assumptions",
];

const TASK_SECTIONS = [
    "Context",
    "Implementation Plan",
    "Technical Approach",
    "Acceptance Criteria",
    "Affected Components",
    "Existing Code Impact",
    "Definition of Done",
];

function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Validate that a description contains all required template sections in order.
 * @param {string} description - Issue body markdown
 * @param {"story"|"task"} docType - Document type
 * @returns {{ valid: boolean, missing: string[], outOfOrder: string[] }}
 */
export function validateTemplateCompliance(description, docType) {
    const sections = docType === "story" ? STORY_SECTIONS : TASK_SECTIONS;
    const missing = [];
    const positions = [];

    for (const section of sections) {
        const re = new RegExp(`##\\s+${escapeRegex(section)}`, "i");
        const match = re.exec(description);
        if (!match) {
            missing.push(section);
        } else {
            positions.push({ section, index: match.index });
        }
    }

    const outOfOrder = [];
    for (let i = 1; i < positions.length; i++) {
        if (positions[i].index < positions[i - 1].index) {
            outOfOrder.push(
                `"${positions[i].section}" before "${positions[i - 1].section}"`,
            );
        }
    }

    return {
        valid: missing.length === 0 && outOfOrder.length === 0,
        missing,
        outOfOrder,
    };
}

/**
 * Format validation result into a human-readable error string.
 * Returns null if valid.
 */
export function formatComplianceError(result, docType) {
    if (result.valid) return null;
    const label = docType === "story" ? "Story (9-section)" : "Task (7-section)";
    const parts = [`${label} template violation`];
    if (result.missing.length > 0) {
        parts.push(`Missing: ${result.missing.join(", ")}`);
    }
    if (result.outOfOrder.length > 0) {
        parts.push(`Out of order: ${result.outOfOrder.join("; ")}`);
    }
    return parts.join(". ");
}

export { STORY_SECTIONS, TASK_SECTIONS };
