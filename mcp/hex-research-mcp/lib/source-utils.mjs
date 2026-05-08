export const SOURCE_TYPE_WEIGHTS = {
    paper: 2.0,
    book: 1.7,
    dataset: 1.4,
    code: 1.4,
    website: 1.0,
    video: 0.7,
    podcast: 0.7,
    archive: 0.5,
};

const PAPER_DOMAINS = [
    "arxiv.org",
    "nber.org",
    "sciencedirect.com",
    "jstor.org",
    "ssrn.com",
    "tandfonline.com",
    "springer.com",
    "nature.com",
    "acm.org",
    "ieee.org",
];

const BOOK_DOMAINS = [
    "wiley.com",
    "oreilly.com",
    "penguinrandomhouse.com",
    "routledge.com",
    "cambridge.org",
    "oup.com",
];

function textOf(source) {
    return [
        source.url,
        source.ref,
        source.title,
        source.name,
        source.doi,
        source.arxiv_id,
        source.isbn,
        source.repo,
    ].filter(Boolean).join(" ").toLowerCase();
}

function includesAny(text, values) {
    return values.some(value => text.includes(value));
}

export function inferSourceType(source = {}) {
    const text = textOf(source);
    if (source.doi || source.arxiv_id || includesAny(text, PAPER_DOMAINS)) {
        return { type: "paper", confidence: "high", reason: source.doi ? "doi" : source.arxiv_id ? "arxiv_id" : "paper_domain" };
    }
    if (source.isbn || includesAny(text, BOOK_DOMAINS)) {
        return { type: "book", confidence: "high", reason: source.isbn ? "isbn" : "book_domain" };
    }
    if (source.repo || /\bgithub\.com\b|\bgitlab\.com\b/.test(text)) {
        return { type: "code", confidence: "high", reason: "repo_domain" };
    }
    if (/\bkaggle\.com\b|\bzenodo\.org\b|\bfigshare\.com\b|\bdataset\b/.test(text)) {
        return { type: "dataset", confidence: "high", reason: "dataset_hint" };
    }
    if (/\byoutube\.com\b|\byoutu\.be\b|\bvimeo\.com\b/.test(text)) {
        return { type: "video", confidence: "high", reason: "video_domain" };
    }
    if (/\bpodcast\b|\bspotify\.com\b|\bpodcasts\.apple\.com\b/.test(text)) {
        return { type: "podcast", confidence: "high", reason: "podcast_hint" };
    }
    if (source.url || /^https?:\/\//.test(String(source.ref || ""))) {
        return { type: "website", confidence: "low", reason: "url" };
    }
    return { type: null, confidence: "none", reason: "no_signal" };
}

export function scoreEvidenceDepth(sourceRows = []) {
    const seen = new Set();
    const byType = {};
    let score = 0;
    for (const source of sourceRows) {
        const id = source.id || source.source_id || source.identifier || source.url || source.title;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const type = source.type || "archive";
        const weight = SOURCE_TYPE_WEIGHTS[type] ?? SOURCE_TYPE_WEIGHTS.archive;
        score += weight;
        byType[type] = (byType[type] || 0) + 1;
    }
    return {
        score: Number(score.toFixed(2)),
        unique_sources: seen.size,
        by_type: byType,
        weights: SOURCE_TYPE_WEIGHTS,
    };
}
