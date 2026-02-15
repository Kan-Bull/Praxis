/**
 * Scans free-text descriptions for PII patterns.
 * Returns matches with pattern name, matched text, and step ID.
 */

export interface SensitiveMatch {
  pattern: string;
  match: string;
  stepId: string;
}

interface PatternDef {
  name: string;
  regex: RegExp;
}

const PATTERNS: PatternDef[] = [
  { name: 'email', regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  { name: 'ssn', regex: /\b\d{3}-\d{2}-\d{4}\b/g },
  { name: 'credit-card', regex: /\b(?:\d[ -]*?){13,16}\b/g },
  { name: 'phone', regex: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g },
];

/** Scan a single text for sensitive patterns. */
function scanText(text: string): { pattern: string; match: string }[] {
  const results: { pattern: string; match: string }[] = [];
  for (const { name, regex } of PATTERNS) {
    // Reset lastIndex for global regexes
    regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      results.push({ pattern: name, match: m[0] });
    }
  }
  return results;
}

/** Scan multiple steps for sensitive data in descriptions. */
export function scanStepsForSensitiveData(
  steps: { id: string; description: string }[],
): SensitiveMatch[] {
  const matches: SensitiveMatch[] = [];
  for (const step of steps) {
    const found = scanText(step.description);
    for (const f of found) {
      matches.push({ ...f, stepId: step.id });
    }
  }
  return matches;
}
