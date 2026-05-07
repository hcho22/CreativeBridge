// PII Scrubber for COPPA Compliance (US-008)
// Detects and redacts personally identifiable information before AI API calls.
// Runs client-side so PII never leaves the device.

export interface ScrubResult {
  text: string;
  redactionsCount: number;
  redactionTypes: string[];
}

// Email: standard email pattern
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

// US phone formats: (xxx) xxx-xxxx, xxx-xxx-xxxx, xxx.xxx.xxxx, xxx xxx xxxx, +1xxxxxxxxxx
const PHONE_REGEX = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;

// SSN: xxx-xx-xxxx
const SSN_REGEX = /\b\d{3}-\d{2}-\d{4}\b/g;

// Street addresses: number + street name (e.g., "123 Main Street", "4567 Oak Ave")
const ADDRESS_REGEX =
  /\b\d{1,5}\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*\s+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Drive|Dr|Lane|Ln|Road|Rd|Court|Ct|Place|Pl|Way|Circle|Cir|Terrace|Ter)\.?\b/gi;

// ZIP codes (standalone 5-digit or 5+4): only when preceded by state-like context
const ZIP_REGEX = /\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/g;

// "My name is X", "I'm X", "I am X" followed by capitalized words.
// NOT case-insensitive — the captured name MUST start with uppercase to distinguish
// real names from regular words like "happy", "from", etc.
// "I'm/I am" only match for names, not preposition phrases like "I'm from", "I'm at".
const NAME_INTRO_REGEX =
  /\b(?:[Mm]y name is|[Tt]hey call me|[Pp]eople call me)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b|(?:[Ii]'m|[Ii] am)\s+(?!from\b|at\b|in\b|a\b|the\b|so\b|very\b|really\b|not\b|going\b|here\b|there\b)([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g;

// Narrative name patterns: "named X Y", "whose name was X Y", "full name was X Y"
// These appear in stories when children embed real names in narrative form.
// Excludes fictional titles common in storytelling (Sir, Lord, Princess, etc.)
const FICTIONAL_TITLES =
  'Sir|Lord|Lady|King|Queen|Prince|Princess|Captain|Doctor|Professor|Wizard|Master|Chief';
const NARRATIVE_NAME_REGEX = new RegExp(
  `\\b(?:named|whose (?:full )?name (?:is|was)|full name (?:is|was)|known as)\\s+(?!(?:${FICTIONAL_TITLES})\\b)([A-Z][a-z]+(?:\\s+(?:["'][A-Z][a-z]+["']\\s+)?[A-Z][a-z]+){1,2})\\b`,
  'g',
);

// Age disclosure: "age 7", "age seven", "7 years old", "7-year-old"
// Important for COPPA — revealing a child's age alongside other PII.
const AGE_DISCLOSURE_REGEX =
  /\bage\s+(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen)\b|\b(\d{1,2})[\s-]+years?\s*old\b|\b(\d{1,2})-year-old\b/gi;

// School references: "I go to X school", "my school is X", "I attend X"
const SCHOOL_REGEX =
  /\b(?:[Ii] (?:go|went) to|[Mm]y school is|[Ii] attend|[Ii]'m at|[Ss]tudent at)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,4}(?:\s+(?:School|Elementary|Middle|High|Academy|Prep|College|University))?)\b/g;

// "I live in/at X" or "my address is X"
const LOCATION_INTRO_REGEX =
  /\b(?:[Ii] live (?:in|at|on)|[Mm]y address is|[Ii]'m from|[Ii] stay at)\s+([A-Z][a-zA-Z\s,]+?)(?=[.!?\n]|$)/g;

type PatternEntry = {
  regex: RegExp;
  replacement: string;
  type: string;
};

const _PII_PATTERNS: PatternEntry[] = [
  { regex: SSN_REGEX, replacement: '[SSN]', type: 'ssn' },
  { regex: EMAIL_REGEX, replacement: '[EMAIL]', type: 'email' },
  { regex: PHONE_REGEX, replacement: '[PHONE]', type: 'phone' },
  { regex: ADDRESS_REGEX, replacement: '[ADDRESS]', type: 'address' },
  { regex: ZIP_REGEX, replacement: '[ZIP]', type: 'zip' },
  {
    regex: SCHOOL_REGEX,
    replacement: '$1 [SCHOOL]'.replace('$1', ''),
    type: 'school',
  },
  { regex: NAME_INTRO_REGEX, replacement: '[NAME_INTRO]', type: 'name' },
  { regex: LOCATION_INTRO_REGEX, replacement: '[LOCATION]', type: 'location' },
];

/**
 * Scrub PII from text before sending to AI services.
 * Order matters: SSN before phone (SSN is more specific), email before general text.
 */
export function scrub(text: string): ScrubResult {
  if (!text || typeof text !== 'string') {
    return { text: text || '', redactionsCount: 0, redactionTypes: [] };
  }

  let scrubbed = text;
  let redactionsCount = 0;
  const redactionTypesSet = new Set<string>();

  // Apply SSN first (most specific numeric pattern)
  scrubbed = scrubbed.replace(SSN_REGEX, () => {
    redactionsCount++;
    redactionTypesSet.add('ssn');
    return '[SSN]';
  });

  // Email
  scrubbed = scrubbed.replace(EMAIL_REGEX, () => {
    redactionsCount++;
    redactionTypesSet.add('email');
    return '[EMAIL]';
  });

  // Phone (after SSN to avoid double-matching)
  scrubbed = scrubbed.replace(PHONE_REGEX, () => {
    redactionsCount++;
    redactionTypesSet.add('phone');
    return '[PHONE]';
  });

  // Street address
  scrubbed = scrubbed.replace(ADDRESS_REGEX, () => {
    redactionsCount++;
    redactionTypesSet.add('address');
    return '[ADDRESS]';
  });

  // ZIP code with state prefix
  scrubbed = scrubbed.replace(ZIP_REGEX, () => {
    redactionsCount++;
    redactionTypesSet.add('zip');
    return '[ZIP]';
  });

  // Location introductions ("I live in Chicago", "I'm from X") — before name to avoid overlap
  scrubbed = scrubbed.replace(LOCATION_INTRO_REGEX, () => {
    redactionsCount++;
    redactionTypesSet.add('location');
    return 'I live in [LOCATION]';
  });

  // School references
  scrubbed = scrubbed.replace(SCHOOL_REGEX, () => {
    redactionsCount++;
    redactionTypesSet.add('school');
    return 'I go to [SCHOOL]';
  });

  // Name introductions ("My name is John Smith") — after location to avoid "I'm from" overlap
  scrubbed = scrubbed.replace(NAME_INTRO_REGEX, () => {
    redactionsCount++;
    redactionTypesSet.add('name');
    return 'my name is [NAME]';
  });

  // Narrative name patterns ("named Emma Chen", "whose full name was Robert Mackenzie")
  scrubbed = scrubbed.replace(NARRATIVE_NAME_REGEX, () => {
    redactionsCount++;
    redactionTypesSet.add('name');
    return 'named [NAME]';
  });

  // Age disclosures ("age 7", "7 years old") — important for COPPA
  scrubbed = scrubbed.replace(AGE_DISCLOSURE_REGEX, () => {
    redactionsCount++;
    redactionTypesSet.add('age');
    return '[AGE]';
  });

  return {
    text: scrubbed,
    redactionsCount,
    redactionTypes: Array.from(redactionTypesSet),
  };
}

/**
 * Convenience: returns only the scrubbed text string.
 */
export function scrubText(text: string): string {
  return scrub(text).text;
}

export const piiScrubber = { scrub, scrubText };
export default piiScrubber;
