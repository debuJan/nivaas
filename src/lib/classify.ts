/**
 * Complaint intelligence: category + urgency classification, and duplicate
 * detection for the "ten flats, same lift" problem.
 *
 * Design rules (from the client brief, in priority order):
 *  1. SAFETY FIRST. Words like fire, gas leak, lift stuck or electric shock
 *     escalate to CRITICAL and flag the duty manager — whatever else the
 *     text says. This check runs before any scoring and cannot be outvoted.
 *  2. The classifier is advisory. It returns a confidence, and low-confidence
 *     results land as OTHER so the help desk confirms the category (they can
 *     change it in one tap). A wrong category must never block a resident.
 *  3. Duplicates are LINKED, never closed. Ten flats reporting the same lift
 *     is a signal about severity, not noise to delete.
 */

export type Category =
  | "PLUMBING"
  | "ELECTRICAL"
  | "LIFT"
  | "CARPENTRY"
  | "HOUSEKEEPING"
  | "SECURITY"
  | "OTHER";

export type Urgency = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface Classification {
  category: Category;
  urgency: Urgency;
  /** 0..1 — below 0.5 means "unsure, human should confirm". */
  confidence: number;
  /** True when a safety rule forced CRITICAL escalation. */
  escalated: boolean;
}

// ── Safety rules ──────────────────────────────────────────────────────────
// [phrase, category that owns the response]. Fire and gas have no owning
// trade in the category list, so they map to OTHER + escalation — the duty
// manager, not a workman, is the first responder there.
const SAFETY_RULES: Array<[string, Category]> = [
  ["lift stuck", "LIFT"],
  ["stuck in the lift", "LIFT"],
  ["stuck in lift", "LIFT"],
  ["trapped in", "LIFT"],
  ["people inside", "LIFT"],
  ["electric shock", "ELECTRICAL"],
  ["got a shock", "ELECTRICAL"],
  ["short circuit", "ELECTRICAL"],
  ["sparking", "ELECTRICAL"],
  ["burst pipe", "PLUMBING"],
  ["pipe burst", "PLUMBING"],
  ["flooding", "PLUMBING"],
  ["gas leak", "OTHER"],
  ["gas smell", "OTHER"],
  ["smell of gas", "OTHER"],
  ["fire", "OTHER"],
  ["smoke coming", "OTHER"],
];

// ── Category keywords ─────────────────────────────────────────────────────
// Weight 2 = distinctive (almost only used for that trade),
// weight 1 = suggestive but shared ("water", "door", "light").
const CATEGORY_KEYWORDS: Record<Exclude<Category, "OTHER">, Record<string, number>> = {
  PLUMBING: {
    leak: 2, leakage: 2, tap: 1, pipe: 1, water: 1, drainage: 2, drain: 1,
    bathroom: 1, flush: 2, toilet: 1, sink: 1, blockage: 2, blocked: 1,
    seepage: 2, plumber: 2, tank: 1, motor: 1,
  },
  ELECTRICAL: {
    light: 1, fan: 1, switch: 2, power: 1, mcb: 2, fuse: 2, electrician: 2,
    wiring: 2, socket: 2, bulb: 1, electricity: 1, inverter: 1, "no power": 2,
  },
  LIFT: {
    lift: 2, elevator: 2,
  },
  CARPENTRY: {
    door: 1, lock: 2, hinge: 2, wood: 1, carpenter: 2, handle: 1, latch: 2,
    cupboard: 1, window: 1, frame: 1,
  },
  HOUSEKEEPING: {
    cleaning: 2, garbage: 2, dustbin: 2, sweeping: 2, dirty: 1, waste: 1,
    housekeeping: 2, corridor: 1, stinking: 1, smell: 1,
  },
  SECURITY: {
    guard: 2, stranger: 2, theft: 2, stolen: 2, cctv: 2, security: 2,
    suspicious: 1, gate: 1, visitor: 1,
  },
};

const HIGH_URGENCY_WORDS = [
  "urgent", "immediately", "asap", "emergency", "no water", "no power",
  "not working", "completely stopped", "dangerous",
];
const MEDIUM_URGENCY_WORDS = [
  "since", "days", "again", "repeatedly", "every day", "daily", "getting worse",
];

const tokenizeWords = (text: string) =>
  text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

export function classifyComplaint(text: string): Classification {
  const lower = ` ${text.toLowerCase()} `;

  // Rule 1 — safety first, always.
  for (const [phrase, category] of SAFETY_RULES) {
    if (lower.includes(phrase)) {
      return { category, urgency: "CRITICAL", confidence: 0.97, escalated: true };
    }
  }

  // Rule 2 — weighted keyword scoring per category.
  const words = new Set(tokenizeWords(text));
  let best: Category = "OTHER";
  let bestScore = 0;
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const [keyword, weight] of Object.entries(keywords)) {
      const hit = keyword.includes(" ")
        ? lower.includes(keyword)
        : words.has(keyword);
      if (hit) score += weight;
    }
    if (score > bestScore) {
      bestScore = score;
      best = category as Category;
    }
  }

  // Only suggestive words matched — too weak to commit. The help desk
  // confirms the category instead of the resident being mis-filed.
  if (bestScore <= 1) {
    return { category: "OTHER", urgency: "LOW", confidence: 0.3, escalated: false };
  }

  // Urgency from the resident's own words.
  let urgency: Urgency = "LOW";
  if (HIGH_URGENCY_WORDS.some((w) => lower.includes(w))) urgency = "HIGH";
  else if (MEDIUM_URGENCY_WORDS.some((w) => lower.includes(w))) urgency = "MEDIUM";
  // A stopped lift strands elderly residents and children even when the
  // text sounds calm — never file a lift issue below MEDIUM.
  if (best === "LIFT" && urgency === "LOW") urgency = "MEDIUM";

  const confidence = Math.min(0.95, 0.5 + bestScore * 0.09);
  return { category: best, urgency, confidence, escalated: false };
}

// ── Duplicate detection (TF-IDF cosine, same tower, within 72h) ──────────
// The same approach as the YC Match matcher: small, explainable, no
// external model. Ten near-identical texts about one lift should arrive as
// one linked incident, so the help desk sees severity at a glance.

export interface ExistingComplaint {
  id: string;
  text: string; // title + description
  tower: string; // "T12"
  createdAt: Date | string;
}

const STOPWORDS = new Set([
  "the", "a", "an", "in", "my", "is", "of", "to", "and", "for", "on", "it",
  "this", "that", "please", "our", "we", "has", "have", "from", "at", "not",
]);

const tokens = (text: string) =>
  tokenizeWords(text).filter((w) => w.length > 2 && !STOPWORDS.has(w));

const HOUR_MS = 3600_000;

export function findDuplicates(
  newText: string,
  newTower: string,
  newCreatedAt: Date | string,
  existingOpen: ExistingComplaint[],
  threshold = 0.45,
): string[] {
  const newTime = new Date(newCreatedAt).getTime();
  const candidates = existingOpen.filter((c) => {
    if (c.tower !== newTower) return false;
    const ageHours = Math.abs(newTime - new Date(c.createdAt).getTime()) / HOUR_MS;
    return ageHours <= 72;
  });
  if (candidates.length === 0) return [];

  // TF-IDF over the candidate set, with the new text as the query document.
  const docs = candidates.map((c) => tokens(c.text));
  const query = tokens(newText);
  const allDocs = [...docs, query];
  const N = allDocs.length;

  const df = new Map<string, number>();
  for (const doc of allDocs) {
    for (const term of new Set(doc)) df.set(term, (df.get(term) ?? 0) + 1);
  }
  const idf = (term: string) =>
    Math.log((N + 1) / ((df.get(term) ?? 0) + 1)) + 1;

  const vectorize = (doc: string[]) => {
    const vec = new Map<string, number>();
    for (const term of doc) vec.set(term, (vec.get(term) ?? 0) + idf(term));
    return vec;
  };
  const cosine = (a: Map<string, number>, b: Map<string, number>) => {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (const [t, v] of a) {
      normA += v * v;
      if (b.has(t)) dot += v * (b.get(t) ?? 0);
    }
    for (const v of b.values()) normB += v * v;
    return normA === 0 || normB === 0 ? 0 : dot / (Math.sqrt(normA) * Math.sqrt(normB));
  };

  const queryVec = vectorize(query);
  return candidates
    .map((c, i) => ({ id: c.id, sim: cosine(queryVec, vectorize(docs[i])) }))
    .filter((r) => r.sim >= threshold)
    .sort((a, b) => b.sim - a.sim)
    .map((r) => r.id);
}
