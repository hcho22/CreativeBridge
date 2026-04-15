/**
 * Server-Side AI Actions for CreativeBridge
 *
 * All OpenAI API calls are routed through these Convex actions so that:
 * 1. API keys never appear in the client bundle
 * 2. Child PII is scrubbed before reaching external APIs
 * 3. Retry/timeout logic runs server-side
 *
 * @implements US-001: Remove Hardcoded Credentials and Move AI Server-Side
 */

import { action } from './_generated/server';
import { v } from 'convex/values';
import { requireAuth } from './auth';

// ---------------------------------------------------------------------------
// PII Scrubbing
// ---------------------------------------------------------------------------

/**
 * Common PII patterns to strip before sending text to OpenAI.
 * Patterns target names, emails, phone numbers, and street addresses.
 */
const PII_PATTERNS: { regex: RegExp; replacement: string }[] = [
  // SSN patterns (most specific numeric — must run before phone)
  { regex: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN]' },
  // Email addresses
  {
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replacement: '[EMAIL]',
  },
  // Phone numbers (US formats)
  {
    regex: /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    replacement: '[PHONE]',
  },
  // Street addresses (number + street name pattern)
  {
    regex:
      /\d{1,5}\s+[A-Z][a-zA-Z]*(\s+[A-Z][a-zA-Z]*)?\s+(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Lane|Ln|Court|Ct|Way|Place|Pl)\b\.?/g,
    replacement: '[ADDRESS]',
  },
  // ZIP codes with state prefix (e.g. "CA 90210")
  { regex: /\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/g, replacement: '[ZIP]' },
  // Location introductions ("I live in Chicago", "I'm from X")
  {
    regex:
      /\b(?:[Ii] live (?:in|at|on)|[Mm]y address is|[Ii]'m from|[Ii] stay at)\s+([A-Z][a-zA-Z\s,]+?)(?=[.!?\n]|$)/g,
    replacement: '[LOCATION]',
  },
  // School references ("I go to Lincoln Elementary", "student at X")
  {
    regex:
      /\b(?:[Ii] (?:go|went) to|[Mm]y school is|[Ii] attend|[Ii]'m at|[Ss]tudent at)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,4}(?:\s+(?:School|Elementary|Middle|High|Academy|Prep|College|University))?)\b/g,
    replacement: '[SCHOOL]',
  },
  // Name introductions ("My name is Tommy Smith", "I'm Emma") — excludes prepositions
  {
    regex:
      /\b(?:[Mm]y name is|[Tt]hey call me|[Pp]eople call me)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b|(?:[Ii]'m|[Ii] am)\s+(?!from\b|at\b|in\b|a\b|the\b|so\b|very\b|really\b|not\b|going\b|here\b|there\b)([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g,
    replacement: '[NAME]',
  },
  // Narrative names ("named Emma Chen", "whose name was X") — excludes fictional titles
  {
    regex:
      /\b(?:named|whose (?:full )?name (?:is|was)|full name (?:is|was)|known as)\s+(?!(?:Sir|Lord|Lady|King|Queen|Prince|Princess|Captain|Doctor|Professor|Wizard|Master|Chief)\b)([A-Z][a-z]+(?:\s+(?:["'][A-Z][a-z]+["']\s+)?[A-Z][a-z]+){1,2})\b/g,
    replacement: '[NAME]',
  },
  // Age disclosures ("age 7", "7 years old", "7-year-old") — COPPA-critical
  {
    regex:
      /\bage\s+(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen)\b|\b(\d{1,2})[\s-]+years?\s*old\b|\b(\d{1,2})-year-old\b/gi,
    replacement: '[AGE]',
  },
];

export function scrubPII(text: string): string {
  let scrubbed = text;
  for (const { regex, replacement } of PII_PATTERNS) {
    scrubbed = scrubbed.replace(regex, replacement);
  }
  return scrubbed;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const OPENAI_BASE_URL = 'https://api.openai.com/v1';
const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000; // 1s, 2s, 4s exponential backoff

function getOpenAIApiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error(
      'OPENAI_API_KEY is not set in Convex environment variables',
    );
  }
  return key;
}

function getOpenAIHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getOpenAIApiKey()}`,
  };
  if (process.env.OPENAI_ORG_ID) {
    headers['OpenAI-Organization'] = process.env.OPENAI_ORG_ID;
  }
  return headers;
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface OpenAIChatRequest {
  model: string;
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  max_tokens?: number;
  temperature?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

interface OpenAIChatResponse {
  choices: { message: { content: string }; finish_reason: string }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Make an OpenAI chat completion request with timeout and exponential backoff.
 */
async function openAIChatCompletion(
  body: OpenAIChatRequest,
): Promise<OpenAIChatResponse> {
  const headers = getOpenAIHeaders();
  const url = `${OPENAI_BASE_URL}/chat/completions`;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Don't retry auth errors
        if (response.status === 401 || response.status === 403) {
          throw new Error(`OpenAI authentication error: ${response.status}`);
        }
        if (isRetryableStatus(response.status) && attempt < MAX_RETRIES - 1) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt);
          await sleep(delay);
          continue;
        }
        const errorText = await response.text();
        throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
      }

      return (await response.json()) as OpenAIChatResponse;
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        if (attempt < MAX_RETRIES - 1) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt);
          await sleep(delay);
          continue;
        }
        throw new Error('OpenAI request timed out after 30 seconds');
      }

      // Don't retry auth errors
      if (error.message?.includes('authentication error')) {
        throw error;
      }

      if (attempt < MAX_RETRIES - 1) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }

  throw new Error('OpenAI request failed after maximum retries');
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Generate a story completion server-side.
 * PII is scrubbed from both system and user prompts before sending to OpenAI.
 */
export const generateStoryCompletion = action({
  args: {
    systemPrompt: v.string(),
    userPrompt: v.string(),
    model: v.optional(v.string()),
    maxTokens: v.optional(v.number()),
    temperature: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const model = args.model || 'gpt-4o-mini';
    const scrubbedSystem = scrubPII(args.systemPrompt);
    const scrubbedUser = scrubPII(args.userPrompt);

    const response = await openAIChatCompletion({
      model,
      messages: [
        { role: 'system', content: scrubbedSystem },
        { role: 'user', content: scrubbedUser },
      ],
      max_tokens: args.maxTokens ?? 2000,
      temperature: args.temperature ?? 0.7,
      frequency_penalty: 0.7,
      presence_penalty: 0.6,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('Empty response from OpenAI API');
    }

    return content;
  },
});

/**
 * Analyze story text and generate an optimized image-generation prompt.
 * PII is scrubbed from the story text before sending to OpenAI.
 */
export const analyzeStoryForImageGeneration = action({
  args: {
    storyText: v.string(),
    model: v.optional(v.string()),
    gradeLevel: v.optional(v.string()),
    artStyleGuidance: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const model = args.model || 'gpt-4o-mini';
    const scrubbedStory = scrubPII(args.storyText);

    const artStyleInstruction = args.artStyleGuidance
      ? `5. Use this EXACT ARTISTIC STYLE: ${args.artStyleGuidance}. Do NOT invent a different style. The image MUST look like a watercolor painting on textured paper with visible brushstrokes and paint edges. NEVER use terms like "digital", "3d", "cartoon", "photorealistic", "CGI", or "render".`
      : '5. Suggest ARTISTIC STYLE (illustration style appropriate for children)';

    const gradeLevelNote = args.gradeLevel
      ? `\nGRADE LEVEL: ${args.gradeLevel} — ensure content complexity and visual style are age-appropriate for this grade range.`
      : '';

    const systemPrompt = `You are an expert at analyzing children's stories and creating detailed image generation prompts for Stable Diffusion.

CRITICAL: Stable Diffusion weights early tokens MUCH more heavily than later tokens. The artistic style and medium MUST appear at the VERY BEGINNING of every prompt. This is non-negotiable.

Your task is to read a story excerpt and create an optimized prompt that will generate a single, cohesive watercolor-style image.
${gradeLevelNote}
REQUIREMENTS:
1. Extract the MAIN SUBJECT (who/what is the focus?)
2. Identify the SETTING (where does this take place?)
3. Capture the MOOD (what emotion or atmosphere?)
4. Note KEY VISUAL ELEMENTS (important objects, colors, actions)
${artStyleInstruction}

COMPOSITION RULES:
- Create ONE cohesive scene with a CLEAR FOCAL POINT
- Avoid split images, multiple scenes, or collages
- Ensure the main subject is prominent and well-framed
- Keep the composition simple and child-friendly

OUTPUT FORMAT — STYLE MUST COME FIRST:
Provide a concise image generation prompt in this EXACT format:
"watercolor painting on textured paper, [artistic technique and style], [main subject and action], [setting details], [mood/lighting], painted with visible brushstrokes"

The prompt MUST:
- START with "watercolor painting on textured paper"
- END with a watercolor reinforcement phrase like "painted with visible brushstrokes"
- NEVER mention digital, 3d, photorealistic, or CGI
- Keep the entire prompt under 200 tokens`;

    const userPrompt = `Analyze this story excerpt and create an optimized Stable Diffusion prompt:

Story:
"""
${scrubbedStory}
"""

Create a focused image prompt that captures the story's key visual moment.`;

    const response = await openAIChatCompletion({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 200,
      temperature: 0.7,
    });

    const imagePrompt = response.choices[0]?.message?.content?.trim();
    if (!imagePrompt) {
      throw new Error('Empty image prompt from story analysis');
    }

    return imagePrompt;
  },
});

/**
 * Moderate content using OpenAI's Moderation API.
 * Returns flagged categories and whether the content was flagged.
 */
export const moderateContent = action({
  args: {
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const headers = getOpenAIHeaders();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(`${OPENAI_BASE_URL}/moderations`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ input: args.content }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Moderation API error ${response.status}: ${errorText}`,
        );
      }

      const data = await response.json();
      const result = data.results?.[0];

      return {
        flagged: result?.flagged ?? false,
        categories: result?.categories ?? {},
        categoryScores: result?.category_scores ?? {},
      };
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Moderation request timed out after 30 seconds');
      }
      throw error;
    }
  },
});

/**
 * Transcribe an audio recording via OpenAI Whisper.
 *
 * Replaces on-device speech recognition (`@react-native-voice/voice`) for the
 * voice-first input bar (US-013). iOS's `SFSpeechRecognizer` aggressively
 * auto-finalizes in "search" mode, chopping long sentences — Whisper handles
 * arbitrary-length utterances server-side with no segmentation loss.
 *
 * Keeps the OpenAI API key server-side per US-001 / COPPA C03. The returned
 * transcript is passed through `scrubPII` before returning to the client so
 * the downstream story pipeline never sees child PII in memory on-device.
 *
 * @param audioBase64 Base64-encoded audio content (m4a/aac from iOS,
 *   opus/webm on Android via expo-av HIGH_QUALITY preset). Size cap ~25MB
 *   (Whisper hard limit); in practice our recordings are <1MB for 30s.
 * @param mimeType e.g. "audio/m4a", "audio/mp4", "audio/webm".
 * @param language Optional ISO-639-1 code ("en", "es", ...). Improves
 *   accuracy when known; Whisper auto-detects if omitted.
 */
export const transcribeAudio = action({
  args: {
    audioBase64: v.string(),
    mimeType: v.string(),
    language: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<string> => {
    await requireAuth(ctx);

    // Decode base64 → Uint8Array → Blob for multipart upload.
    // atob is available in the Convex Node runtime.
    const binary = atob(args.audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    // Derive a reasonable filename extension from mimeType so Whisper's
    // format detection picks the right decoder. Whisper rejects unknown
    // extensions even when given via multipart, so this is load-bearing.
    const extFromMime: Record<string, string> = {
      'audio/m4a': 'm4a',
      'audio/mp4': 'm4a',
      'audio/aac': 'm4a',
      'audio/mpeg': 'mp3',
      'audio/mp3': 'mp3',
      'audio/wav': 'wav',
      'audio/x-wav': 'wav',
      'audio/webm': 'webm',
      'audio/ogg': 'ogg',
    };
    const ext = extFromMime[args.mimeType.toLowerCase()] ?? 'm4a';
    // Convex's TS lib narrows Blob/FormData shapes vs. the Node runtime where
    // this actually executes; cast through `any` only at these Web API
    // boundaries. Runtime has full spec support (Blob accepts BufferSource,
    // FormData.append accepts (name, blob, filename)).
    const blob = new Blob([bytes as any], { type: args.mimeType } as any);

    const form = new FormData();
    (form as any).append('file', blob, `recording.${ext}`);
    form.append('model', 'whisper-1');
    form.append('response_format', 'json');
    // `temperature=0` gives deterministic transcripts; helpful for tests.
    form.append('temperature', '0');
    if (args.language) {
      form.append('language', args.language);
    }

    const url = `${OPENAI_BASE_URL}/audio/transcriptions`;
    // Whisper auth uses Bearer but Content-Type must be auto-set by fetch for
    // multipart boundaries — do NOT reuse getOpenAIHeaders() which pins JSON.
    const headers: Record<string, string> = {
      Authorization: `Bearer ${getOpenAIApiKey()}`,
    };
    if (process.env.OPENAI_ORG_ID) {
      headers['OpenAI-Organization'] = process.env.OPENAI_ORG_ID;
    }

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: form,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            throw new Error(`OpenAI authentication error: ${response.status}`);
          }
          if (isRetryableStatus(response.status) && attempt < MAX_RETRIES - 1) {
            await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
            continue;
          }
          const errorText = await response.text();
          throw new Error(`Whisper API error ${response.status}: ${errorText}`);
        }

        const data = (await response.json()) as { text?: string };
        const text = (data.text ?? '').trim();
        // Scrub PII out of the TRANSCRIPT before returning (not the input —
        // we can't scrub audio). This keeps the downstream story prompt
        // build in the same COPPA posture as generateStoryCompletion.
        return scrubPII(text);
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          if (attempt < MAX_RETRIES - 1) {
            await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
            continue;
          }
          throw new Error('Whisper request timed out after 30 seconds');
        }
        if (error.message?.includes('authentication error')) {
          throw error;
        }
        if (attempt < MAX_RETRIES - 1) {
          await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
          continue;
        }
        throw error;
      }
    }

    throw new Error('Whisper request failed after maximum retries');
  },
});
